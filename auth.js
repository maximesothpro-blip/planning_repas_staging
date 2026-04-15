// auth.js — Gestion de l'authentification multi-comptes
// Charge avant planning.js

const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USERNAME_KEY = 'auth_username';

// ===== TOKEN MANAGEMENT =====

function getToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function saveToken(token, username) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USERNAME_KEY, username);
}

function clearToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USERNAME_KEY);
}

function getUsername() {
  return localStorage.getItem(AUTH_USERNAME_KEY);
}

// ===== API FETCH WRAPPER =====
// Remplace fetch() dans planning.js — injecte automatiquement le token Bearer

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  const response = await fetch(url, { ...options, headers });

  // Si 401 → token expiré ou invalide → déconnexion
  if (response.status === 401) {
    clearToken();
    showLoginOverlay();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  return response;
}

// ===== LOGIN OVERLAY =====

function showLoginOverlay(errorMessage) {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) {
    overlay.classList.add('active');
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
      errorEl.textContent = errorMessage || '';
      errorEl.style.display = errorMessage ? 'block' : 'none';
    }
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.classList.remove('active');
}

// ===== AUTH CHECK (appelé par init() dans planning.js) =====

async function checkAuth() {
  const token = getToken();

  if (!token) {
    showLoginOverlay();
    return false;
  }

  try {
    const response = await fetch(`${window.BACKEND_API_URL || 'http://localhost:3000'}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      updateUserDisplay(data.username);
      return true;
    } else {
      clearToken();
      showLoginOverlay();
      return false;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    // En cas d'erreur réseau, on laisse passer (mode offline graceful)
    // Si le token est présent, on fait confiance localement
    return true;
  }
}

// ===== LOGIN FORM HANDLER =====

async function handleLogin(username, password) {
  const submitBtn = document.getElementById('loginSubmitBtn');
  const errorEl = document.getElementById('loginError');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion...';
  errorEl.style.display = 'none';

  try {
    const response = await fetch(`${window.BACKEND_API_URL || 'http://localhost:3000'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok && data.token) {
      saveToken(data.token, data.username);
      hideLoginOverlay();
      updateUserDisplay(data.username);
      // Déclencher le chargement de l'app
      if (typeof init === 'function') init();
    } else {
      errorEl.textContent = data.error || 'Identifiants incorrects';
      errorEl.style.display = 'block';
    }
  } catch (error) {
    errorEl.textContent = 'Impossible de contacter le serveur';
    errorEl.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
}

function updateUserDisplay(username) {
  const el = document.getElementById('currentUsername');
  if (el) el.textContent = username;
}

function logout() {
  clearToken();
  location.reload();
}

// ===== INIT DES ÉCOUTEURS =====

document.addEventListener('DOMContentLoaded', () => {
  // Formulaire de login
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      handleLogin(username, password);
    });
  }

  // Bouton logout
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});
