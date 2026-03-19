/* =====================================================
   GTEC CANTEEN – app.js
   Full production version with:
   - Firestore live menu loading
   - Cart with localStorage persistence
   - Payment method selection (UPI/Card/NetBanking/Cash)
   - Razorpay online payment integration
   - Stock auto-deduction
   - Order confirmation + redirect
   ===================================================== */

// =========================================================
// FIREBASE CONFIG
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, doc, serverTimestamp }
    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCTYUDlDX5rRi5E1QUUupzgsOAva1nnpJY",
    authDomain: "gtec-canteen.firebaseapp.com",
    projectId: "gtec-canteen",
    storageBucket: "gtec-canteen.firebasestorage.app",
    messagingSenderId: "26361828930",
    appId: "1:26361828930:web:4bba631e299810f3233fdb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

// =========================================================
// RAZORPAY CONFIG – Replace with your actual Test Key ID
// =========================================================
const RAZORPAY_KEY_ID = 'rzp_test_YourKeyHere'; // <-- REPLACE with your Razorpay Test Key ID

// =========================================================
// DEFAULT MENU (fallback if Firestore is empty)
// =========================================================
const DEFAULT_ITEMS = [
    { id: 1, name: "Idli", emoji: "🍚", img: "assets/food_idli.png", category: "breakfast", price: 15, desc: "Soft steamed rice cakes served with hot sambar & coconut chutney", available: true, stock: 20 },
    { id: 2, name: "Vada", emoji: "🍩", img: "assets/food_vada.png", category: "breakfast", price: 12, desc: "Crispy golden medu vada with sambar & chutneys", available: true, stock: 18 },
    { id: 3, name: "Dosa", emoji: "🫓", img: "assets/food_dosa.png", category: "breakfast", price: 20, desc: "Thin crispy rice crepe with sambar & three chutneys", available: true, stock: 15 },
    { id: 4, name: "Pongal", emoji: "🍲", img: "assets/food_pongal.png", category: "breakfast", price: 18, desc: "Savory khichdi made with rice and moong dal, seasoned with pepper", available: true, stock: 12 },
    { id: 5, name: "Upma", emoji: "🥣", img: "assets/food_upma.png", category: "breakfast", price: 15, desc: "Savory semolina porridge with vegetables and mild spices", available: true, stock: 10 },
    { id: 6, name: "Poha", emoji: "🌾", img: "assets/food_poha.png", category: "snacks", price: 12, desc: "Flattened rice flakes with onion, lemon, and mustard seeds", available: true, stock: 14 },
    { id: 7, name: "Samosa", emoji: "🔺", img: "assets/food_samosa.png", category: "snacks", price: 10, desc: "Crispy pastry filled with spiced potato and peas", available: true, stock: 25 },
    { id: 8, name: "Meals", emoji: "🍱", img: "assets/food_meals.png", category: "meals", price: 60, desc: "Full South Indian thali: rice, dal, sabzi, rasam, papad & pickle", available: true, stock: 8 },
    { id: 9, name: "Tea", emoji: "☕", img: "assets/food_tea.png", category: "drinks", price: 10, desc: "Freshly brewed hot tea with milk and sugar", available: true, stock: 50 },
    { id: 10, name: "Coffee", emoji: "☕", img: "assets/food_coffee.png", category: "drinks", price: 12, desc: "Hot filter coffee made fresh every morning", available: true, stock: 40 },
    { id: 11, name: "Juice", emoji: "🥤", img: "assets/food_juice.png", category: "drinks", price: 20, desc: "Fresh seasonal fruit juice – ask for today's variety", available: true, stock: 30 },
    { id: 12, name: "Lemon Rice", emoji: "🍋", img: "assets/food_lemon_rice.png", category: "meals", price: 30, desc: "Tangy rice seasoned with lemon, curry leaves and peanuts", available: true, stock: 10 }
];

// =========================================================
// STATE
// =========================================================
function loadMenuItems() {
    const stored = JSON.parse(localStorage.getItem('gtec_menu'));
    if (!stored) return DEFAULT_ITEMS;
    return stored.map(item => {
        const def = DEFAULT_ITEMS.find(d => d.id === item.id);
        return def ? { ...item, img: def.img, emoji: def.emoji } : item;
    });
}

let menuItems = loadMenuItems();
let cart = (JSON.parse(localStorage.getItem('gtec_cart')) || []).map(c => {
    const def = DEFAULT_ITEMS.find(d => d.id === c.id);
    return def ? { ...c, img: def.img, emoji: def.emoji } : c;
});
let lastOrder = JSON.parse(localStorage.getItem('gtec_lastOrder')) || null;
let activeFilter = 'all';
let cartOpen = false;

// =========================================================
// PERSISTENCE
// =========================================================
function saveMenu() { localStorage.setItem('gtec_menu', JSON.stringify(menuItems)); }
function saveCart() { localStorage.setItem('gtec_cart', JSON.stringify(cart)); }
function saveOrder() { localStorage.setItem('gtec_lastOrder', JSON.stringify(lastOrder)); }

// =========================================================
// AUTHENTICATION
// =========================================================
onAuthStateChanged(auth, (user) => {
    const authNav = document.getElementById('authNavItem');
    if (user) {
        currentUser = user;
        if(authNav) {
            authNav.innerHTML = `<a href="#" onclick="logoutUser(event)" class="nav-link" style="color:var(--danger); font-weight: 600;"><i class="fa-solid fa-right-from-bracket"></i> Logout</a>`;
        }
    } else {
        currentUser = null;
        if(authNav) {
            authNav.innerHTML = `<a href="login.html" class="nav-link" style="font-weight: 700; color: var(--primary);"><i class="fa-solid fa-user"></i> Login</a>`;
        }
    }
});

function logoutUser(e) {
    if(e) e.preventDefault();
    signOut(auth).then(() => {
        showToast('Logged out successfully', 'success');
        setTimeout(() => window.location.reload(), 1000);
    }).catch((error) => {
        showToast('Logout failed', 'error');
    });
}
window.logoutUser = logoutUser;

// =========================================================
// INIT
// =========================================================
document.addEventListener('DOMContentLoaded', async () => {
    const grid = document.getElementById('menuGrid');
    if (grid) {
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);">
            <i class="fa-solid fa-spinner fa-spin" style="font-size:2.5rem;opacity:.5;display:block;margin-bottom:14px;"></i>
            <p style="font-size:.9rem;">Loading menu…</p>
          </div>`;
    }

    try {
        const snap = await getDocs(collection(db, 'menu'));
        if (!snap.empty) {
            const firestoreItems = snap.docs.map(d => d.data());
            menuItems = firestoreItems.map(fItem => {
                const def = DEFAULT_ITEMS.find(d => d.id === fItem.id);
                return def ? { ...fItem, img: def.img, emoji: def.emoji } : fItem;
            });
            menuItems.sort((a, b) => a.id - b.id);
            localStorage.setItem('gtec_menu', JSON.stringify(menuItems));
            console.log(`🍽️ Firestore menu loaded: ${menuItems.length} items`);
        }
    } catch (err) {
        console.warn('Firestore menu fetch failed, using cached/default:', err.message);
    }

    renderMenuGrid();
    updateCartUI();
    renderOrderPanel();
    initHeader();
    initNavHighlight();
});

// =========================================================
// HEADER SCROLL + NAV
// =========================================================
function initHeader() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 20);
    });
}

function initNavHighlight() {
    const sections = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.nav-link');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                links.forEach(l => l.classList.remove('active'));
                const link = document.querySelector(`.nav-link[href="#${e.target.id}"]`);
                if (link) link.classList.add('active');
            }
        });
    }, { threshold: 0.4 });
    sections.forEach(s => observer.observe(s));
}

function toggleNav() {
    const nav = document.getElementById('nav');
    const ham = document.getElementById('hamburger');
    const open = nav.classList.toggle('open');
    ham.classList.toggle('open', open);
}

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('nav').classList.remove('open');
        document.getElementById('hamburger').classList.remove('open');
    });
});

// =========================================================
// MENU RENDER
// =========================================================
function renderMenuGrid(filter = activeFilter, query = '') {
    const grid = document.getElementById('menuGrid');
    grid.innerHTML = '';

    let items = menuItems;

    if (filter !== 'all') {
        items = items.filter(i => i.category === filter);
    }
    if (query.trim()) {
        const q = query.trim().toLowerCase();
        items = items.filter(i =>
            i.name.toLowerCase().includes(q) ||
            (i.desc || '').toLowerCase().includes(q) ||
            i.category.toLowerCase().includes(q)
        );
    }

    if (items.length === 0) {
        grid.innerHTML = `<div class="no-items" style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text-muted);">
      <i class="fa-solid fa-bowl-food" style="font-size:3rem;opacity:.3;display:block;margin-bottom:12px;"></i>
      No items found.
    </div>`;
        return;
    }

    items.forEach((item, i) => {
        const cartItem = cart.find(c => c.id === item.id);
        const qty = cartItem ? cartItem.qty : 0;

        const card = document.createElement('div');
        card.className = 'menu-card';
        card.style.animationDelay = `${i * 0.05}s`;
        card.dataset.category = item.category;

        const imgHTML = item.img
            ? `<img src="${item.img}" alt="${item.name}" class="menu-card-real-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <span class="menu-card-emoji-fb" style="display:none">${item.emoji || '🍽️'}</span>`
            : `<span>${item.emoji || '🍽️'}</span>`;

        // SPEC: Green ≥5 available, Orange ≤2 left, Red = Out of Stock
        const stockBadge = () => {
            if (item.stock === undefined || item.stock === null) return '';
            if (item.stock === 0) return `<div class="stock-badge stock-out">🚫 Out of Stock</div>`;
            if (item.stock <= 2) return `<div class="stock-badge stock-low">🟠 Only ${item.stock} left!</div>`;
            if (item.stock <= 5) return `<div class="stock-badge stock-few">🟡 ${item.stock} available</div>`;
            return `<div class="stock-badge stock-ok">✅ ${item.stock} available</div>`;
        };

        const isOutOfStock = item.stock !== undefined && item.stock === 0;
        const canAdd = item.available && !isOutOfStock;

        card.innerHTML = `
      ${!item.available ? '<span class="unavailable-badge">Unavailable</span>' : ''}
      <div class="menu-card-img">
        ${imgHTML}
      </div>
      <div class="menu-card-body">
        <div class="menu-card-cat">${item.category}</div>
        <div class="menu-card-name">${item.name}</div>
        <div class="menu-card-desc">${item.desc || ''}</div>
        ${stockBadge()}
        <div class="menu-card-footer">
          <div class="menu-card-price">₹${item.price} <span>/plate</span></div>
          ${canAdd
                ? (qty > 0
                    ? `<div class="qty-control">
                    <button class="qty-btn" onclick="changeQty(${item.id}, -1)">−</button>
                    <span class="qty-num">${qty}</span>
                    <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
                  </div>`
                    : `<button class="add-btn" onclick="addToCart(${item.id})">
                    <i class="fa-solid fa-plus"></i> Add
                  </button>`)
                : isOutOfStock
                    ? `<button class="add-btn" disabled style="opacity:.45;cursor:not-allowed;">Sold Out</button>`
                    : '<span style="color:var(--danger);font-size:.8rem;font-weight:600;">Not Available</span>'
            }
        </div>
      </div>`;
        grid.appendChild(card);
    });
}

// =========================================================
// FILTER & SEARCH
// =========================================================
function filterMenu(cat, btn) {
    activeFilter = cat;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMenuGrid(cat, document.getElementById('menuSearch').value);
}

function searchMenu() {
    const q = document.getElementById('menuSearch').value;
    renderMenuGrid(activeFilter, q);
}

// =========================================================
// CART
// =========================================================
function addToCart(id) {
    const item = menuItems.find(i => i.id === id);
    if (!item || !item.available) return;

    const existing = cart.find(c => c.id === id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ id, name: item.name, emoji: item.emoji, img: item.img || '', price: item.price, qty: 1 });
    }
    saveCart();
    updateCartUI();
    renderMenuGrid(activeFilter, document.getElementById('menuSearch').value);
    showToast(`${item.name} added to order!`, 'success');
}

function changeQty(id, delta) {
    const idx = cart.findIndex(c => c.id === id);
    if (idx === -1) return;
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    saveCart();
    updateCartUI();
    renderMenuGrid(activeFilter, document.getElementById('menuSearch').value);
}

function removeFromCart(id) {
    cart = cart.filter(c => c.id !== id);
    saveCart();
    updateCartUI();
    renderMenuGrid(activeFilter, document.getElementById('menuSearch').value);
}

function clearCart() {
    cart = [];
    saveCart();
    updateCartUI();
    renderMenuGrid(activeFilter, document.getElementById('menuSearch').value);
    showToast('Order cleared.', 'info');
}

function updateCartUI() {
    const badge = document.getElementById('cartBadge');
    const itemsEl = document.getElementById('cartItems');
    const emptyEl = document.getElementById('cartEmpty');
    const footerEl = document.getElementById('cartFooter');

    const totalQty = cart.reduce((s, c) => s + c.qty, 0);
    const totalAmt = cart.reduce((s, c) => s + c.qty * c.price, 0);

    badge.textContent = totalQty;
    document.getElementById('cartTotal').textContent = `₹${totalAmt}`;

    if (cart.length === 0) {
        emptyEl.style.display = 'flex';
        footerEl.style.display = 'none';
        const rows = itemsEl.querySelectorAll('.cart-item');
        rows.forEach(r => r.remove());
        return;
    }

    emptyEl.style.display = 'none';
    footerEl.style.display = 'block';

    const existing = itemsEl.querySelectorAll('.cart-item');
    existing.forEach(e => e.remove());

    cart.forEach(c => {
        const div = document.createElement('div');
        div.className = 'cart-item';
        const thumbHTML = c.img
            ? `<img src="${c.img}" alt="${c.name}" class="cart-item-thumb"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
               <span class="cart-item-thumb-fb" style="display:none">${c.emoji || '🍽️'}</span>`
            : `<span class="cart-item-thumb-fb">${c.emoji || '🍽️'}</span>`;

        div.innerHTML = `
      <div class="cart-item-img-wrap">${thumbHTML}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${c.name}</div>
        <div class="cart-item-price">₹${c.price} × ${c.qty} = ₹${c.price * c.qty}</div>
      </div>
      <div class="cart-item-actions">
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${c.id}, -1)">−</button>
          <span class="qty-num">${c.qty}</span>
          <button class="qty-btn" onclick="changeQty(${c.id}, 1)">+</button>
        </div>
        <button class="cart-remove" onclick="removeFromCart(${c.id})" title="Remove">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>`;
        itemsEl.appendChild(div);
    });
}

function toggleCart() {
    cartOpen = !cartOpen;
    document.getElementById('cartSidebar').classList.toggle('open', cartOpen);
    document.getElementById('cartOverlay').classList.toggle('open', cartOpen);
    document.body.style.overflow = cartOpen ? 'hidden' : '';
}

// =========================================================
// GET PAYMENT METHOD FROM UI
// =========================================================
function getSelectedPaymentMethod() {
    const radios = document.querySelectorAll('input[name="payMethod"]');
    for (const r of radios) {
        if (r.checked) return r.value;
    }
    return 'cash';
}

// =========================================================
// DEDUCT STOCK FROM FIRESTORE
// =========================================================
async function deductStock(orderItems) {
    for (const cartItem of orderItems) {
        try {
            const menuIdx = menuItems.findIndex(m => m.id === cartItem.id);
            if (menuIdx === -1) continue;
            const menuItem = menuItems[menuIdx];
            if (menuItem.stock === undefined || menuItem.stock === null) continue;

            const newStock = Math.max(0, menuItem.stock - cartItem.qty);
            const newAvail = newStock > 0;

            await updateDoc(doc(db, 'menu', String(cartItem.id)), {
                stock: newStock,
                available: newAvail
            });
            menuItems[menuIdx] = { ...menuItem, stock: newStock, available: newAvail };
            console.log(`📦 ${cartItem.name}: stock → ${newStock}`);
        } catch (stockErr) {
            console.warn(`Stock update skipped for "${cartItem.name}":`, stockErr.message);
        }
    }
    // Update local cache
    localStorage.setItem('gtec_menu', JSON.stringify(menuItems));
}

// =========================================================
// PLACE ORDER – Entry Point
// =========================================================
async function placeOrder() {
    if (!currentUser) {
        showToast('Please login to place an order.', 'error');
        setTimeout(() => window.location.href = 'login.html', 1500);
        toggleCart();
        return;
    }

    if (cart.length === 0) { showToast('Your order is empty!', 'error'); return; }

    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const paymentMethod = getSelectedPaymentMethod();

    if (!name) {
        document.getElementById('customerName').focus();
        showToast('Please enter your name!', 'error'); return;
    }
    if (!phone || !/^\d{10}$/.test(phone)) {
        document.getElementById('customerPhone').focus();
        showToast('Please enter a valid 10-digit phone number!', 'error'); return;
    }

    const btn = document.getElementById('placeOrderBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing…';
    }

    const now = new Date();
    const orderId = 'ORD' + Date.now();
    const orderData = {
        id: orderId,
        items: [...cart],
        name,
        phone,
        date: now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        timestamp: now.toISOString(),
        total: cart.reduce((s, c) => s + c.qty * c.price, 0),
        paymentMethod,
        status: 'Pending Payment',
        paid: false,
        completed: false
    };

    lastOrder = orderData;
    saveOrder();
    const history = JSON.parse(localStorage.getItem('gtec_orders') || '[]');
    history.push(lastOrder);
    localStorage.setItem('gtec_orders', JSON.stringify(history));

    if (paymentMethod === 'cash') {
        await placeCashOrder(orderData);
    } else {
        await placeOnlineOrder(orderData);
    }
}

// =========================================================
// CASH ORDER FLOW
// =========================================================
async function placeCashOrder(orderData) {
    try {
        await addDoc(collection(db, 'orders'), {
            orderId: orderData.id,
            customerName: orderData.name,
            customerPhone: orderData.phone,
            items: orderData.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
            total: orderData.total,
            paymentMethod: 'cash',
            status: 'Order Received',
            paid: false,
            completed: false,
            timestamp: serverTimestamp(),
            dateString: orderData.date,
            qrCode: JSON.stringify({ orderId: orderData.id })
        });
        console.log('✅ Cash order saved to Firestore');
        await deductStock(orderData.items);
    } catch (err) {
        console.warn('Firestore save failed (order in localStorage):', err.message);
    }

    showToast('Order placed successfully!', 'success');
    renderOrderPanel();
    clearCart();

    const params = new URLSearchParams({
        id: orderData.id,
        name: orderData.name,
        phone: orderData.phone,
        total: orderData.total,
        items: orderData.items.map(i => `${i.name}×${i.qty}`).join(', '),
        method: 'cash',
        paid: 'false'
    });
    setTimeout(() => { window.location.href = `order-confirm.html?${params.toString()}`; }, 600);
}

// =========================================================
// ONLINE PAYMENT FLOW (Razorpay)
// =========================================================
async function placeOnlineOrder(orderData) {
    const btn = document.getElementById('placeOrderBtn');

    // First save order to Firestore with "Pending Payment" status
    let firestoreDocRef = null;
    try {
        const docRef = await addDoc(collection(db, 'orders'), {
            orderId: orderData.id,
            customerName: orderData.name,
            customerPhone: orderData.phone,
            items: orderData.items.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
            total: orderData.total,
            paymentMethod: orderData.paymentMethod,
            status: 'Pending Payment',
            paid: false,
            completed: false,
            timestamp: serverTimestamp(),
            dateString: orderData.date,
            qrCode: JSON.stringify({ orderId: orderData.id })
        });
        firestoreDocRef = docRef;
        console.log('✅ Order pre-created in Firestore:', orderData.id);
    } catch (err) {
        console.warn('Firestore pre-save failed:', err.message);
    }

    // Check if Razorpay is loaded
    if (!window.Razorpay) {
        showToast('Payment gateway not loaded. Please refresh and try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Place Order'; }
        return;
    }

    // Map method to Razorpay method name
    const rzpMethodMap = { upi: 'upi', card: 'card', netbanking: 'netbanking' };
    const rzpMethod = rzpMethodMap[orderData.paymentMethod] || 'upi';

    const options = {
        key: RAZORPAY_KEY_ID,
        amount: orderData.total * 100, // in paise
        currency: 'INR',
        name: 'GTEC Canteen',
        description: `Order ${orderData.id}`,
        image: 'https://i.ibb.co/0jQHVHs/gtec-logo.png',
        order_id: '', // For production: create order via server and pass server order_id here
        prefill: {
            name: orderData.name,
            contact: orderData.phone,
        },
        notes: {
            orderId: orderData.id,
            customerName: orderData.name
        },
        theme: {
            color: '#f97316'
        },
        modal: {
            ondismiss: async function () {
                showToast('Payment cancelled. Order was not placed.', 'info');
                // Delete the pre-created Firestore doc if payment cancelled
                if (firestoreDocRef) {
                    try {
                        const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
                        await deleteDoc(firestoreDocRef);
                    } catch (e) { /* ignore */ }
                }
                if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Place Order'; }
            }
        },
        handler: async function (response) {
            // Payment successful
            const paymentId = response.razorpay_payment_id;
            showToast('Payment successful! Confirming order…', 'success');

            // Update Firestore order with payment info
            if (firestoreDocRef) {
                try {
                    await updateDoc(firestoreDocRef, {
                        paid: true,
                        paymentId: paymentId,
                        status: 'Order Received',
                        completed: false
                    });
                    console.log('✅ Payment confirmed in Firestore, paymentId:', paymentId);
                } catch (err) {
                    console.warn('Failed to update payment status:', err.message);
                }
            }

            // Deduct stock
            await deductStock(orderData.items);

            renderOrderPanel();
            clearCart();

            const params = new URLSearchParams({
                id: orderData.id,
                name: orderData.name,
                phone: orderData.phone,
                total: orderData.total,
                items: orderData.items.map(i => `${i.name}×${i.qty}`).join(', '),
                method: orderData.paymentMethod,
                paid: 'true',
                paymentId: paymentId
            });
            window.location.href = `order-confirm.html?${params.toString()}`;
        }
    };

    // If razorpay key is placeholder, show demo mode
    if (RAZORPAY_KEY_ID === 'rzp_test_YourKeyHere' || !RAZORPAY_KEY_ID) {
        showToast('⚠️ Demo mode: Simulating successful payment...', 'info');

        // Simulate a 2-second payment processing delay
        setTimeout(async () => {
            const fakePaymentId = 'pay_demo_' + Math.random().toString(36).substring(2, 9);

            if (firestoreDocRef) {
                try {
                    await updateDoc(firestoreDocRef, {
                        status: 'Order Received',
                        paymentMethod: orderData.paymentMethod,
                        paid: true,
                        paymentId: fakePaymentId,
                        completed: false
                    });
                } catch (e) { /* ignore */ }
            }
            await deductStock(orderData.items);
            renderOrderPanel();
            clearCart();

            showToast('Payment successful! Confirming order…', 'success');

            const params = new URLSearchParams({
                id: orderData.id,
                name: orderData.name,
                phone: orderData.phone,
                total: orderData.total,
                items: orderData.items.map(i => `${i.name}×${i.qty}`).join(', '),
                method: orderData.paymentMethod,
                paid: 'true',
                paymentId: fakePaymentId
            });
            setTimeout(() => { window.location.href = `order-confirm.html?${params.toString()}`; }, 800);
        }, 2000);

        return;
    }

    try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
            showToast('Payment failed: ' + (response.error.description || 'Unknown error'), 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Place Order'; }
        });
        rzp.open();
    } catch (err) {
        showToast('Payment gateway error: ' + err.message, 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay & Place Order'; }
    }
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// =========================================================
// ORDER PANEL (My Order Summary section)
// =========================================================
function renderOrderPanel() {
    const emptyEl = document.getElementById('orderPanelEmpty');
    const listEl = document.getElementById('orderPanelList');
    const tbody = document.getElementById('orderTableBody');
    const nameEl = document.getElementById('orderCustomerName');
    const dateEl = document.getElementById('orderDate');
    const totalEl = document.getElementById('orderGrandTotal');

    if (!lastOrder) {
        emptyEl.style.display = 'flex';
        listEl.style.display = 'none';
        return;
    }

    emptyEl.style.display = 'none';
    listEl.style.display = 'block';
    nameEl.textContent = lastOrder.name;
    dateEl.textContent = lastOrder.date;
    totalEl.innerHTML = `<strong>₹${lastOrder.total}</strong>`;

    tbody.innerHTML = '';
    lastOrder.items.forEach(item => {
        const tr = document.createElement('tr');
        const cellImg = item.img
            ? `<img src="${item.img}" alt="${item.name}" class="order-table-img"
                 onerror="this.style.display='none';this.nextSibling.style.display='inline'">
               <span style="display:none">${item.emoji || '🍽️'} </span>`
            : `${item.emoji || '🍽️'} `;
        tr.innerHTML = `
      <td class="order-table-item-cell">${cellImg}<span>${item.name}</span></td>
      <td>${item.qty}</td>
      <td>₹${item.price}</td>
      <td>₹${item.qty * item.price}</td>`;
        tbody.appendChild(tr);
    });
}

// =========================================================
// TOAST
// =========================================================
let toastTimer;
function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    clearTimeout(toastTimer);
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    toast.offsetHeight;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// =========================================================
// ESC KEY CLOSES CART
// =========================================================
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (cartOpen) toggleCart();
        closeModal();
    }
});

// =========================================================
// EXPOSE TO WINDOW (required for type="module" + inline onclick)
// =========================================================
window.toggleCart = toggleCart;
window.toggleNav = toggleNav;
window.filterMenu = filterMenu;
window.searchMenu = searchMenu;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.placeOrder = placeOrder;
window.closeModal = closeModal;
