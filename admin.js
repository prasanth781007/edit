/* =====================================================
   GTEC CANTEEN – admin.js  (Firebase Firestore Backend)
   ===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =========================================================
// FIREBASE INIT
// =========================================================
const firebaseConfig = {
    apiKey: "AIzaSyCTYUDlDX5rRi5E1QUUupzgsOAva1nnpJY",
    authDomain: "gtec-canteen.firebaseapp.com",
    projectId: "gtec-canteen",
    storageBucket: "gtec-canteen.firebasestorage.app",
    messagingSenderId: "26361828930",
    appId: "1:26361828930:web:4bba631e299810f3233fdb"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// =========================================================
// CONSTANTS
// =========================================================
const SECRET_CODE = 'gtec@2025';
const SESSION_KEY = 'gtec_admin_session';

// Default menu items (used as seed if Firestore menu is empty)
const DEFAULT_MENU = [
    { id: 1, name: 'Idli', emoji: '🍚', img: 'assets/food_idli.png', category: 'breakfast', price: 15, desc: 'Soft steamed rice cakes served with hot sambar & coconut chutney', available: true },
    { id: 2, name: 'Vada', emoji: '🍩', img: 'assets/food_vada.png', category: 'breakfast', price: 12, desc: 'Crispy golden medu vada with sambar & chutneys', available: true },
    { id: 3, name: 'Dosa', emoji: '🫓', img: 'assets/food_dosa.png', category: 'breakfast', price: 20, desc: 'Thin crispy rice crepe with sambar & three chutneys', available: true },
    { id: 4, name: 'Pongal', emoji: '🍲', img: 'assets/food_pongal.png', category: 'breakfast', price: 18, desc: 'Savory khichdi made with rice and moong dal, seasoned with pepper', available: true },
    { id: 5, name: 'Upma', emoji: '🥣', img: 'assets/food_upma.png', category: 'breakfast', price: 15, desc: 'Savory semolina porridge with vegetables and mild spices', available: true },
    { id: 6, name: 'Poha', emoji: '🌾', img: 'assets/food_poha.png', category: 'snacks', price: 12, desc: 'Flattened rice flakes with onion, lemon, and mustard seeds', available: true },
    { id: 7, name: 'Samosa', emoji: '🔺', img: 'assets/food_samosa.png', category: 'snacks', price: 10, desc: 'Crispy pastry filled with spiced potato and peas', available: true },
    { id: 8, name: 'Meals', emoji: '🍱', img: 'assets/food_meals.png', category: 'meals', price: 60, desc: 'Full South Indian thali: rice, dal, sabzi, rasam, papad & pickle', available: true },
    { id: 9, name: 'Tea', emoji: '☕', img: 'assets/food_tea.png', category: 'drinks', price: 10, desc: 'Freshly brewed hot tea with milk and sugar', available: true },
    { id: 10, name: 'Coffee', emoji: '☕', img: 'assets/food_coffee.png', category: 'drinks', price: 12, desc: 'Hot filter coffee made fresh every morning', available: true },
    { id: 11, name: 'Juice', emoji: '🥤', img: 'assets/food_juice.png', category: 'drinks', price: 20, desc: 'Fresh seasonal fruit juice – ask for today\'s variety', available: true },
    { id: 12, name: 'Lemon Rice', emoji: '🍋', img: 'assets/food_lemon_rice.png', category: 'meals', price: 30, desc: 'Tangy rice seasoned with lemon, curry leaves and peanuts', available: true },
];

// =========================================================
// STATE
// =========================================================
let menuItems = [];
let orders = [];           // live orders from Firestore
let allOrdersCache = [];
let unsubscribeOrders = null; // Firestore real-time listener cleanup

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Always show login (require password every time)
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('adminShell').style.display = 'none';
    document.getElementById('secretInput').focus();
});

// =========================================================
// LOGIN / LOGOUT
// =========================================================
function doLogin() {
    const val = document.getElementById('secretInput').value.trim();
    const err = document.getElementById('loginError');

    if (val === SECRET_CODE) {
        err.classList.remove('show');
        enterAdmin();
    } else {
        err.classList.add('show');
        document.getElementById('secretInput').value = '';
        document.getElementById('secretInput').focus();
        const box = document.querySelector('.login-box');
        box.style.animation = 'none';
        box.offsetHeight;
        box.style.animation = 'shake 0.4s ease';
        setTimeout(() => box.style.animation = '', 500);
    }
}
window.doLogin = doLogin;

function doLogout() {
    // Stop listening to Firestore
    if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    document.getElementById('adminShell').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
    document.getElementById('secretInput').value = '';
    document.getElementById('secretInput').focus();
}
window.doLogout = doLogout;

async function enterAdmin() {
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminShell').style.display = 'block';

    showLoadingState(true);
    await loadMenuFromFirestore();
    startOrdersListener();
    showLoadingState(false);
}

function showLoadingState(loading) {
    const shell = document.getElementById('adminShell');
    if (loading) {
        shell.style.opacity = '0.6';
        shell.style.pointerEvents = 'none';
    } else {
        shell.style.opacity = '1';
        shell.style.pointerEvents = '';
    }
}

function toggleEye() {
    const inp = document.getElementById('secretInput');
    const icon = document.getElementById('eyeIcon');
    if (inp.type === 'password') {
        inp.type = 'text'; icon.className = 'fa-solid fa-eye-slash';
    } else {
        inp.type = 'password'; icon.className = 'fa-solid fa-eye';
    }
}
window.toggleEye = toggleEye;

// =========================================================
// FIRESTORE – ORDERS (Real-Time Listener)
// =========================================================
function startOrdersListener() {
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));

    unsubscribeOrders = onSnapshot(q, (snapshot) => {
        orders = snapshot.docs.map(docSnap => {
            const d = docSnap.data();
            return {
                firestoreDocId: docSnap.id,          // <-- used by checkbox to updateDoc
                id: d.orderId || docSnap.id,
                name: d.customerName || '—',
                phone: d.customerPhone || '—',
                items: d.items || [],
                total: d.total || 0,
                status: d.status || 'Order Received',
                paid: d.paid || false,
                completed: d.completed || false,
                paymentMethod: d.paymentMethod || 'cash',
                paymentId: d.paymentId || '',
                date: d.dateString || (d.timestamp?.toDate
                    ? d.timestamp.toDate().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                    : '—'),
                timestamp: d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : '',
            };
        });
        allOrdersCache = [...orders]; // already newest-first from Firestore query

        // Refresh whichever page is currently visible
        const activePage = document.querySelector('.page.active')?.id;
        if (activePage === 'page-dashboard') renderDashboard();
        if (activePage === 'page-orders') renderAllOrders();

        console.log(`📦 Firestore: ${orders.length} orders loaded`);
    }, (err) => {
        console.error('Firestore orders listener error:', err);
        showToast('Failed to load orders from database.', 'error');
    });
}

// =========================================================
// FIRESTORE – MENU
// =========================================================
async function loadMenuFromFirestore() {
    try {
        const snap = await getDocs(collection(db, 'menu'));
        if (snap.empty) {
            // Seed Firestore with DEFAULT_MENU on first run
            console.log('🌱 Seeding Firestore menu with default items…');
            await seedMenuToFirestore();
        } else {
            menuItems = snap.docs.map(d => ({ firestoreId: d.id, ...d.data() }));
            // Always patch img from DEFAULT_MENU (img not stored in Firestore)
            menuItems = menuItems.map(item => {
                const def = DEFAULT_MENU.find(d => d.id === item.id);
                return def ? { ...item, img: def.img, emoji: def.emoji || item.emoji } : item;
            });
            menuItems.sort((a, b) => a.id - b.id);
            console.log(`🍽️ Firestore: ${menuItems.length} menu items loaded`);
        }
    } catch (err) {
        console.error('Menu load error:', err);
        showToast('Failed to load menu from database. Using local data.', 'error');
        menuItems = DEFAULT_MENU;
    }

    renderMenuTable();
    renderDashboard();
}

async function seedMenuToFirestore() {
    for (const item of DEFAULT_MENU) {
        const { img, ...itemData } = item; // don't store img path in Firestore
        await setDoc(doc(db, 'menu', String(item.id)), itemData);
    }
    menuItems = DEFAULT_MENU;
    showToast('Menu seeded to Firebase ✅', 'success');
}

async function saveMenuItemToFirestore(item) {
    const { img, firestoreId, ...data } = item;
    if (firestoreId) {
        await updateDoc(doc(db, 'menu', firestoreId), data);
    } else {
        // Use item.id as the Firestore document ID for easy lookup
        await setDoc(doc(db, 'menu', String(item.id)), data);
    }
}

async function deleteMenuItemFromFirestore(firestoreId) {
    await deleteDoc(doc(db, 'menu', firestoreId));
}

// =========================================================
// NAVIGATION
// =========================================================
function showPage(id, navEl) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.side-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    if (navEl) navEl.classList.add('active');

    if (id === 'dashboard') renderDashboard();
    if (id === 'orders') renderAllOrders();
    if (id === 'menu') renderMenuTable();

    document.getElementById('sideNav').classList.remove('open');
}
window.showPage = showPage;

function toggleSideNav() {
    document.getElementById('sideNav').classList.toggle('open');
}
window.toggleSideNav = toggleSideNav;

// =========================================================
// DASHBOARD
// =========================================================
function renderDashboard() {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);

    const todayOrders = orders.filter(o => (o.timestamp || '').startsWith(today));
    const monthOrders = orders.filter(o => (o.timestamp || '').startsWith(month));

    // Revenue counts only PAID orders (spec requirement)
    const todayRev = todayOrders.filter(o => o.paid).reduce((s, o) => s + (o.total || 0), 0);
    const monthRev = monthOrders.filter(o => o.paid).reduce((s, o) => s + (o.total || 0), 0);
    const totalRev = orders.filter(o => o.paid).reduce((s, o) => s + (o.total || 0), 0);
    const availItems = menuItems.filter(i => i.available).length;

    el('statToday').textContent = '₹' + todayRev;
    el('statTodayOrders').textContent = todayOrders.length + ' orders today';
    el('statMonth').textContent = '₹' + monthRev;
    el('statMonthOrders').textContent = monthOrders.length + ' orders this month';
    el('statTotal').textContent = orders.length;
    el('statTotalRev').textContent = '₹' + totalRev + ' all time';
    el('statItems').textContent = menuItems.length;
    el('statAvailItems').textContent = availItems + ' available';

    renderWeekChart();
    renderCategoryChart();
    renderRecentOrders();
}

function renderWeekChart() {
    const chart = el('weekChart');
    chart.innerHTML = '';
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        days.push(d);
    }
    const maxRev = Math.max(...days.map(d => {
        const ds = d.toISOString().slice(0, 10);
        return orders.filter(o => (o.timestamp || '').startsWith(ds)).reduce((s, o) => s + o.total, 0);
    }), 1);

    days.forEach(d => {
        const ds = d.toISOString().slice(0, 10);
        const rev = orders.filter(o => (o.timestamp || '').startsWith(ds)).reduce((s, o) => s + o.total, 0);
        const pct = Math.round((rev / maxRev) * 100);
        const label = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const col = document.createElement('div');
        col.className = 'bar-col';
        col.innerHTML = `
      <div class="bar" style="height:${pct}%" data-val="₹${rev}"></div>
      <div class="bar-label">${label}</div>`;
        chart.appendChild(col);
    });
}

function renderCategoryChart() {
    const legend = el('categoryLegend');
    legend.innerHTML = '';
    const cats = { breakfast: '#facc15', snacks: '#22c55e', drinks: '#3b82f6', meals: '#f97316' };
    const totals = {};
    orders.forEach(o => {
        (o.items || []).forEach(item => {
            const mi = menuItems.find(m => m.name === item.name);
            const cat = mi ? mi.category : 'snacks';
            totals[cat] = (totals[cat] || 0) + item.qty * item.price;
        });
    });
    const grand = Object.values(totals).reduce((a, b) => a + b, 0) || 1;

    Object.entries(cats).forEach(([cat, color]) => {
        const val = totals[cat] || 0;
        const pct = Math.round((val / grand) * 100);
        const row = document.createElement('div');
        row.className = 'legend-item';
        row.innerHTML = `
      <span class="legend-dot" style="background:${color}"></span>
      <span style="flex:1;text-transform:capitalize">${cat}</span>
      <strong style="color:${color}">₹${val}</strong>
      <span style="color:var(--muted);font-size:.7rem">(${pct}%)</span>`;
        legend.appendChild(row);
    });
}

function renderRecentOrders() {
    const tbody = el('recentOrdersBody');
    tbody.innerHTML = '';
    const recent = orders.slice(0, 5); // already newest-first
    if (!recent.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-row">
      <i class="fa-solid fa-receipt" style="font-size:2rem;opacity:.3;display:block;margin-bottom:8px;"></i>
      No orders yet — they'll appear here in real-time!
    </td></tr>`;
        return;
    }
    recent.forEach(o => {
        const tr = document.createElement('tr');
        const itemList = (o.items || []).map(i => `${i.name}×${i.qty}`).join(', ');
        const statusColor = o.status === 'Delivered' ? '#22c55e' : o.status === 'Preparing' ? '#facc15' : '#94a3b8';
        tr.innerHTML = `
      <td><code style="font-size:.72rem;color:var(--muted)">${(o.id || '–').slice(-8)}</code></td>
      <td><strong>${o.name || '–'}</strong></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemList}</td>
      <td style="color:var(--primary);font-weight:700">₹${o.total || 0}</td>
      <td style="color:var(--muted);font-size:.78rem">${o.date || '–'}</td>`;
        tbody.appendChild(tr);
    });
}

// =========================================================
// ALL ORDERS PAGE
// =========================================================
function renderAllOrders(data) {
    const tbody = el('allOrdersBody');
    const source = data || allOrdersCache;
    tbody.innerHTML = '';

    if (!source.length) {
        tbody.innerHTML = `<tr><td colspan="9"><div class="no-data">
      <i class="fa-solid fa-receipt"></i>
      <p>No orders found in database.<br>Orders placed on the main site will appear here in real-time.</p>
    </div></td></tr>`;
        return;
    }

    source.forEach((o, i) => {
        const tr = document.createElement('tr');
        if (o.completed) tr.style.opacity = '0.55';

        const itemList = (o.items || []).map(item => `${item.name}(${item.qty})`).join(', ');
        const isDone = !!o.completed;
        const statusColor = isDone ? '#22c55e' : o.status === 'Preparing' ? '#facc15' : '#94a3b8';
        const statusLabel = isDone ? 'Delivered ✔' : (o.status || 'Order Received');
        const paidLabel = o.paid
            ? '<span style="color:#22c55e;font-weight:700;">✅ Paid</span>'
            : '<span style="color:#fb923c;font-weight:700;">💵 Unpaid</span>';
        const methodIcons = { upi: '📱', card: '💳', netbanking: '🏦', cash: '💵' };
        const methodLabel = (methodIcons[o.paymentMethod] || '💵') + ' ' + (o.paymentMethod || 'cash');

        tr.innerHTML = `
      <td style="text-align:center;">
        <label class="done-check-wrap" title="${isDone ? 'Mark as pending' : 'Mark as complete'}">
          <input type="checkbox" class="done-check" ${isDone ? 'checked' : ''}
            onchange="toggleOrderComplete('${o.firestoreDocId || ''}', '${o.id || ''}', this.checked)" />
          <span class="done-check-box"></span>
        </label>
      </td>
      <td style="color:var(--muted)">${i + 1}</td>
      <td><code style="font-size:.72rem;color:var(--muted)">${(o.id || 'N/A').slice(-10)}</code></td>
      <td><strong style="${isDone ? 'text-decoration:line-through;color:var(--muted)' : ''}">${o.name || '–'}</strong></td>
      <td style="font-size:.82rem;color:var(--muted)">${o.phone || '–'}</td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.8rem;">${itemList}</td>
      <td style="color:var(--primary);font-weight:700">₹${o.total || 0}</td>
      <td>${paidLabel}<br><span style="font-size:.7rem;color:var(--muted);">${methodLabel}</span></td>
      <td><span style="color:${statusColor};font-weight:600;font-size:.8rem;">${statusLabel}</span></td>
      <td style="color:var(--muted);font-size:.76rem;white-space:nowrap">${o.date || '–'}</td>`;
        tbody.appendChild(tr);
    });
}

async function toggleOrderComplete(firestoreDocId, orderId, isChecked) {
    // Find the Firestore document — prefer firestoreDocId, fallback to orderId query
    try {
        let docRef;

        if (firestoreDocId) {
            docRef = doc(db, 'orders', firestoreDocId);
        } else {
            // Query by orderId field
            const q = query(collection(db, 'orders'), where('orderId', '==', orderId));
            const snap = await getDocs(q);
            if (snap.empty) { showToast('Order not found in database.', 'error'); return; }
            docRef = doc(db, 'orders', snap.docs[0].id);
        }

        if (isChecked) {
            await updateDoc(docRef, {
                completed: true,
                status: 'Delivered',
                paid: true
            });
            showToast(`✅ Order marked as Delivered!`, 'success');
        } else {
            await updateDoc(docRef, {
                completed: false,
                status: 'Order Received',
                paid: false
            });
            showToast('Order marked as pending.', 'info');
        }
        // Real-time listener will auto-refresh the table
    } catch (err) {
        console.error('toggleOrderComplete error:', err);
        showToast('Failed to update order: ' + err.message, 'error');
    }
}
window.toggleOrderComplete = toggleOrderComplete;

function filterOrders() {
    const q = el('orderSearch').value.trim().toLowerCase();
    if (!q) { renderAllOrders(allOrdersCache); return; }
    const filtered = allOrdersCache.filter(o =>
        (o.name || '').toLowerCase().includes(q) ||
        (o.id || '').toLowerCase().includes(q) ||
        (o.date || '').toLowerCase().includes(q)
    );
    renderAllOrders(filtered);
}
window.filterOrders = filterOrders;

async function clearOrderHistory() {
    if (!confirm('Delete ALL orders from Firestore? This cannot be undone.')) return;
    showToast('Deleting all orders…', 'info');
    try {
        const snap = await getDocs(collection(db, 'orders'));
        const deletions = snap.docs.map(d => deleteDoc(doc(db, 'orders', d.id)));
        await Promise.all(deletions);
        showToast(`Deleted ${deletions.length} orders from database.`, 'success');
        // Real-time listener will auto-update the UI
    } catch (err) {
        console.error('Clear orders error:', err);
        showToast('Failed to clear orders.', 'error');
    }
}
window.clearOrderHistory = clearOrderHistory;

// =========================================================
// MENU CRUD (Firestore)
// =========================================================
function renderMenuTable() {
    const tbody = el('menuTableBody');
    tbody.innerHTML = '';
    el('menuItemCount').textContent = menuItems.length + ' items';

    if (!menuItems.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="no-data">
      <i class="fa-solid fa-bowl-food"></i><p>No menu items in database.</p>
    </div></td></tr>`;
        return;
    }

    menuItems.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const imgHtml = item.img
            ? `<img src="${item.img}" alt="${item.name}" style="width:38px;height:38px;border-radius:8px;object-fit:cover;vertical-align:middle;margin-right:8px;border:1px solid rgba(255,255,255,0.08);">`
            : `<span style="font-size:1.4rem;margin-right:8px;">${item.emoji || '🍽️'}</span>`;
        tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <div style="display:flex;align-items:center;">
          ${imgHtml}
          <div>
            <strong>${item.name}</strong>
            ${item.desc ? `<div style="font-size:.72rem;color:var(--muted);margin-top:2px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.desc}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="badge badge-${item.category}">${item.category}</span></td>
      <td style="font-weight:700;color:var(--primary)">₹${item.price}</td>
      <td style="font-weight:700;color:${item.stock === 0 ? 'var(--danger)' : item.stock !== undefined && item.stock <= 5 ? '#facc15' : '#22c55e'}">
        ${item.stock === undefined ? '<span style="color:var(--muted);font-size:.75rem">—</span>' : item.stock === 0 ? '🚫 Out' : item.stock + ' pcs'}
      </td>
      <td>
        <span class="avail-dot ${item.available ? 'yes' : 'no'}"></span>
        <span class="${item.available ? 'badge badge-avail' : 'badge badge-unavail'}">${item.available ? 'Yes' : 'No'}</span>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn-edit" onclick="editMenuItem(${item.id})"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="btn-del"  onclick="deleteMenuItem(${item.id})"><i class="fa-solid fa-trash"></i> Del</button>
        </div>
      </td>`;
        tbody.appendChild(tr);
    });
}

// Live image preview in the form
function previewImg(val) {
    const wrap = el('imgPreviewWrap');
    const img = el('imgPreview');
    if (val && val.trim()) {
        img.src = val.trim();
        wrap.style.display = 'block';
    } else {
        wrap.style.display = 'none';
        img.src = '';
    }
}
window.previewImg = previewImg;

async function saveMenuItem(e) {
    e.preventDefault();
    const id = el('editId').value;
    const name = el('iName').value.trim();
    const img = el('iImg').value.trim();
    const cat = el('iCat').value;
    const price = parseInt(el('iPrice').value);
    const stock = parseInt(el('iStock').value) || 0;
    const desc = el('iDesc').value.trim();
    const avail = el('iAvail').checked && stock > 0; // auto-unavailable if stock=0

    if (!name || !cat || !price) { showToast('Fill all required fields.', 'error'); return; }

    el('saveMenuBtn').disabled = true;
    el('saveMenuBtn').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

    try {
        if (id) {
            const idx = menuItems.findIndex(i => i.id === parseInt(id));
            if (idx > -1) {
                const updated = { ...menuItems[idx], name, img, category: cat, price, stock, desc, available: avail };
                await saveMenuItemToFirestore(updated);
                menuItems[idx] = updated;
                showToast(`✅ "${name}" updated! Stock: ${stock} pcs`, 'success');
            }
        } else {
            const nextId = menuItems.length ? Math.max(...menuItems.map(i => i.id)) + 1 : 13;
            const newItem = { id: nextId, name, img, category: cat, price, stock, desc, available: avail };
            await saveMenuItemToFirestore(newItem);
            menuItems.push(newItem);
            showToast(`✅ "${name}" added! Stock: ${stock} pcs`, 'success');
        }

        resetMenuForm();
        renderMenuTable();
        el('menuItemCount').textContent = menuItems.length + ' items';
    } catch (err) {
        console.error('Save menu item error:', err);
        showToast('Failed to save item to database.', 'error');
    } finally {
        el('saveMenuBtn').disabled = false;
        el('saveMenuBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Item';
    }
}
window.saveMenuItem = saveMenuItem;

function editMenuItem(id) {
    const item = menuItems.find(i => i.id === id);
    if (!item) return;
    el('editId').value = id;
    el('iName').value = item.name;
    el('iImg').value = item.img || '';
    el('iCat').value = item.category;
    el('iPrice').value = item.price;
    el('iStock').value = item.stock !== undefined ? item.stock : '';
    el('iDesc').value = item.desc || '';
    el('iAvail').checked = item.available;
    // Show live preview of the existing image
    previewImg(item.img || '');
    el('formTitle').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit – ${item.name}`;
    el('saveMenuBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Item';
    el('itemForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('Editing item – save when done.', 'info');
}
window.editMenuItem = editMenuItem;

async function deleteMenuItem(id) {
    const item = menuItems.find(i => i.id === id);
    if (!item) return;
    if (!confirm(`Delete "${item.name}" from the menu?`)) return;

    try {
        const firestoreId = item.firestoreId || String(item.id);
        await deleteMenuItemFromFirestore(firestoreId);
        menuItems = menuItems.filter(i => i.id !== id);
        renderMenuTable();
        showToast(`🗑️ "${item.name}" deleted from database.`, 'info');
    } catch (err) {
        console.error('Delete menu item error:', err);
        showToast('Failed to delete item.', 'error');
    }
}
window.deleteMenuItem = deleteMenuItem;

function resetMenuForm() {
    el('editId').value = '';
    el('itemForm').reset();
    el('iAvail').checked = true;
    // Clear image preview
    const wrap = el('imgPreviewWrap');
    const img = el('imgPreview');
    if (wrap) wrap.style.display = 'none';
    if (img) img.src = '';
    el('formTitle').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add New Item';
    el('saveMenuBtn').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Item';
}
window.resetMenuForm = resetMenuForm;

// =========================================================
// HELPERS
// =========================================================
function el(id) { return document.getElementById(id); }

let toastTimer;
function showToast(msg, type = 'info') {
    const t = el('aToast');
    clearTimeout(toastTimer);
    t.className = `a-toast ${type}`;
    t.textContent = msg;
    t.offsetHeight;
    t.classList.add('show');
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// Inject shake animation
const styleEl = document.createElement('style');
styleEl.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)}
    20%{transform:translateX(-8px)}
    40%{transform:translateX(8px)}
    60%{transform:translateX(-6px)}
    80%{transform:translateX(6px)}
  }
`;
document.head.appendChild(styleEl);

// =========================================================
// QR SCANNER (uses html5-qrcode loaded via CDN in admin.html)
// =========================================================
let html5QrScanner = null;
let qrScanLock = false;   // prevent duplicate scan triggers

function startScanner() {
    const startBtn = el('startScanBtn');
    const stopBtn = el('stopScanBtn');

    // Clear any autofilled text in the manual input
    const manualInput = el('manualOrderId');
    if (manualInput) manualInput.value = '';

    if (!window.Html5Qrcode) {
        showToast('QR scanner library not loaded yet. Please wait a moment and try again.', 'error');
        return;
    }
    if (html5QrScanner) {
        showToast('Scanner already running.', 'info');
        return;
    }

    qrScanLock = false;
    html5QrScanner = new window.Html5Qrcode('qrReader');

    html5QrScanner.start(
        { facingMode: 'environment' },          // rear camera on phones
        { fps: 10, qrbox: { width: 240, height: 240 } },
        handleQRScan,                           // success callback
        (_err) => { /* per-frame errors – ignore */ }
    ).then(() => {
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'inline-flex';
        showToast('📷 Camera started — point at the student\'s QR code', 'success');
    }).catch(err => {
        html5QrScanner = null;
        const msg = String(err);
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
            showToast('❌ Camera permission denied. Please allow camera access and try again.', 'error');
        } else {
            showToast('Camera error: ' + msg, 'error');
        }
    });
}
window.startScanner = startScanner;

function stopScanner() {
    if (!html5QrScanner) return Promise.resolve();
    return html5QrScanner.stop()
        .then(() => {
            html5QrScanner = null;
            qrScanLock = false;
            const startBtn = el('startScanBtn');
            const stopBtn = el('stopScanBtn');
            if (startBtn) startBtn.style.display = 'inline-flex';
            if (stopBtn) stopBtn.style.display = 'none';
        })
        .catch(() => {
            html5QrScanner = null;
        });
}
window.stopScanner = stopScanner;

async function handleQRScan(decodedText) {
    // Stop scanner after successful scan
    await stopScanner();

    let orderData = {};
    try {
        orderData = JSON.parse(decodedText);
    } catch {
        // Legacy: plain orderId string
        orderData = { orderId: decodedText.trim() };
    }

    const orderId = orderData.orderId || decodedText.trim();
    await markOrderComplete(orderId, orderData);
}

async function markOrderComplete(orderId, orderData = {}) {
    el('scanResultCard').style.display = 'none';

    if (!orderId) { showToast('Invalid QR code', 'error'); return; }

    showToast('Looking up order…', 'info');

    try {
        // Find the Firestore document where orderId field == orderId
        const q = query(collection(db, 'orders'), where('orderId', '==', orderId));
        const snap = await getDocs(q);

        if (snap.empty) {
            showToast(`Order "${orderId}" not found in database.`, 'error');
            el('scanResultCard').style.display = 'block';
            el('scanResultTitle').innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--danger)"></i> Order Not Found';
            el('scanResultBody').innerHTML = `<span style="color:var(--muted)">No order with ID <code>${orderId}</code> was found.</span>`;
            return;
        }

        const docSnap = snap.docs[0];
        const data = docSnap.data();

        if (data.completed) {
            showToast('This order is already marked as complete!', 'info');
        } else {
            // Mark complete
            await updateDoc(doc(db, 'orders', docSnap.id), {
                completed: true,
                status: 'Delivered',
                paid: true
            });
            showToast(`✅ Order ${orderId} marked as DELIVERED!`, 'success');
        }

        // Show result card
        el('scanResultCard').style.display = 'block';
        el('scanResultTitle').innerHTML = data.completed
            ? '<i class="fa-solid fa-circle-check" style="color:#facc15"></i> Already Completed'
            : '<i class="fa-solid fa-circle-check" style="color:#22c55e"></i> Order Marked Complete!';

        const itemList = (data.items || []).map(i => `${i.name} ×${i.qty}`).join(', ');
        el('scanResultBody').innerHTML = `
          <div><strong>Order ID:</strong> <code>${data.orderId || orderId}</code></div>
          <div><strong>Customer:</strong> ${data.customerName || '–'}</div>
          <div><strong>Phone:</strong> ${data.customerPhone || '–'}</div>
          <div><strong>Items:</strong> ${itemList || '–'}</div>
          <div><strong>Total:</strong> <span style="color:var(--primary);font-weight:700">₹${data.total || 0}</span></div>
          <div><strong>Status:</strong> <span style="color:#22c55e;font-weight:700">Delivered ✔</span></div>`;

    } catch (err) {
        console.error('QR order lookup error:', err);
        showToast('Error looking up order: ' + err.message, 'error');
    }
}
window.markOrderComplete = markOrderComplete;

function markOrderByInput() {
    const val = el('manualOrderId').value.trim();
    if (!val) { showToast('Enter an Order ID first.', 'error'); return; }
    markOrderComplete(val);
    el('manualOrderId').value = '';
}
window.markOrderByInput = markOrderByInput;
