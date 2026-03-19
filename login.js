import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCTYUDlDX5rRi5E1QUUupzgsOAva1nnpJY",
    authDomain: "gtec-canteen.firebaseapp.com",
    projectId: "gtec-canteen",
    storageBucket: "gtec-canteen.firebasestorage.app",
    messagingSenderId: "26361828930",
    appId: "1:26361828930:web:4bba631e299810f3233fdb"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('emailLoginBtn');
const signupBtn = document.getElementById('emailSignupBtn');
const googleBtn = document.getElementById('googleLoginBtn');
const errorDiv = document.getElementById('authError');

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
}

// Redirect if already logged in
onAuthStateChanged(auth, (user) => {
    if (user) {
        window.location.href = 'index.html';
    }
});

// Email/Password Login
loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    loginBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging in...';
    loginBtn.disabled = true;
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            showError('Invalid email or password.');
            loginBtn.innerHTML = 'Login';
            loginBtn.disabled = false;
        });
});

// Email/Password Sign Up
signupBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
        showError('Please enter both email and password.');
        return;
    }
    
    signupBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Signing up...';
    signupBtn.disabled = true;
    
    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            showError(error.message);
            signupBtn.innerHTML = 'Sign Up';
            signupBtn.disabled = false;
        });
});

// Google Login
googleBtn.addEventListener('click', () => {
    googleBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
    googleBtn.disabled = true;
    
    signInWithPopup(auth, provider)
        .then((result) => {
            window.location.href = 'index.html';
        })
        .catch((error) => {
            showError(error.message);
            googleBtn.innerHTML = '<img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google"> Continue with Google';
            googleBtn.disabled = false;
        });
});
