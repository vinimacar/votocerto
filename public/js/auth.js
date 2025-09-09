// Authentication System
// VoteCerto - Sistema de Eleição Online

import { 
    auth, 
    database, 
    userRoles, 
    utils,
    googleProvider 
} from './firebase-config.js';

import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

import {
    ref,
    set,
    get,
    child,
    update
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.init();
    }

    init() {
        // Monitor authentication state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile();
            } else {
                this.currentUser = null;
                this.userProfile = null;
                this.redirectToLogin();
            }
        });

        // Setup login form if exists
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Setup forgot password form if exists
        const forgotForm = document.getElementById('forgotPasswordForm');
        if (forgotForm) {
            forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        // Setup logout buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('logout-btn') || e.target.closest('.logout-btn')) {
                this.logout();
            }
        });

        // Setup Google login button
        const googleLoginBtn = document.getElementById('googleLoginBtn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', () => this.handleGoogleLogin());
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        if (!email || !password) {
            utils.showAlert('Por favor, preencha todos os campos!', 'danger');
            return;
        }

        if (!utils.validateEmail(email)) {
            utils.showAlert('Por favor, insira um e-mail válido!', 'danger');
            return;
        }

        utils.showLoading();

        try {
            // Try to sign in
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Log the login
            await this.logActivity(user.uid, 'login', 'User logged in successfully');
            
            utils.showAlert('Login realizado com sucesso!', 'success');
            
            // Redirect based on user role
            setTimeout(() => {
                this.redirectBasedOnRole();
            }, 1000);
            
        } catch (error) {
            console.error('Login error:', error);
            
            let errorMessage = 'Erro ao fazer login. Tente novamente.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Usuário não encontrado!';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Senha incorreta!';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'E-mail inválido!';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Muitas tentativas. Tente novamente mais tarde.';
                    break;
            }
            
            utils.showAlert(errorMessage, 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('resetEmail').value;
        
        if (!email) {
            utils.showAlert('Por favor, insira seu e-mail!', 'danger');
            return;
        }

        if (!utils.validateEmail(email)) {
            utils.showAlert('Por favor, insira um e-mail válido!', 'danger');
            return;
        }

        utils.showLoading();

        try {
            await sendPasswordResetEmail(auth, email);
            utils.showAlert('Link de recuperação enviado para seu e-mail!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('forgotPasswordModal'));
            if (modal) {
                modal.hide();
            }
            
        } catch (error) {
            console.error('Password reset error:', error);
            
            let errorMessage = 'Erro ao enviar e-mail de recuperação.';
            
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'E-mail não encontrado!';
            }
            
            utils.showAlert(errorMessage, 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async handleGoogleLogin() {
        utils.showLoading();

        try {
            // Sign in with Google popup
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;
            
            // Check if user profile exists, if not create one
            const userRef = ref(database, `users/${user.uid}`);
            const snapshot = await get(userRef);
            
            if (!snapshot.exists()) {
                // Create new user profile with Google data
                const userProfile = {
                    uid: user.uid,
                    email: user.email,
                    name: user.displayName || user.email.split('@')[0],
                    role: userRoles.VOTER, // Default role
                    photoURL: user.photoURL,
                    provider: 'google',
                    createdAt: new Date().toISOString(),
                    lastLogin: new Date().toISOString(),
                    isActive: true
                };
                
                await set(userRef, userProfile);
                utils.showAlert('Conta criada com sucesso via Google!', 'success');
            } else {
                // Update last login
                await this.updateLastLogin();
                utils.showAlert('Login realizado com sucesso!', 'success');
            }
            
            // Log the login
            await this.logActivity(user.uid, 'google_login', 'User logged in with Google');
            
            // Redirect based on user role
            setTimeout(() => {
                this.redirectBasedOnRole();
            }, 1000);
            
        } catch (error) {
            console.error('Google login error:', error);
            
            let errorMessage = 'Erro ao fazer login com Google.';
            
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Login cancelado pelo usuário.';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'Popup bloqueado. Permita popups para este site.';
                    break;
                case 'auth/cancelled-popup-request':
                    errorMessage = 'Solicitação de popup cancelada.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Erro de conexão. Verifique sua internet.';
                    break;
            }
            
            utils.showAlert(errorMessage, 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            const userRef = ref(database, `users/${this.currentUser.uid}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                this.userProfile = snapshot.val();
            } else {
                // Create default user profile
                await this.createUserProfile();
            }
            
            // Update last login
            await this.updateLastLogin();
            
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async createUserProfile() {
        if (!this.currentUser) return;

        const defaultProfile = {
            uid: this.currentUser.uid,
            email: this.currentUser.email,
            role: userRoles.VOTER, // Default role
            name: this.currentUser.displayName || 'Usuário',
            createdAt: Date.now(),
            lastLogin: Date.now(),
            active: true
        };

        try {
            const userRef = ref(database, `users/${this.currentUser.uid}`);
            await set(userRef, defaultProfile);
            this.userProfile = defaultProfile;
            
        } catch (error) {
            console.error('Error creating user profile:', error);
        }
    }

    async updateLastLogin() {
        if (!this.currentUser) return;

        try {
            const userRef = ref(database, `users/${this.currentUser.uid}`);
            await update(userRef, {
                lastLogin: Date.now()
            });
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }

    async logActivity(userId, action, details) {
        try {
            const logRef = ref(database, `logs/${utils.generateId()}`);
            await set(logRef, {
                userId,
                action,
                details,
                timestamp: Date.now(),
                ip: 'unknown' // In production, you might want to get the real IP
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    redirectBasedOnRole() {
        if (!this.userProfile) {
            this.redirectToLogin();
            return;
        }

        const role = this.userProfile.role;
        
        switch (role) {
            case userRoles.ADMIN:
                window.location.href = 'dashboard.html';
                break;
            case userRoles.COMMISSION:
                window.location.href = 'dashboard.html';
                break;
            case userRoles.VOTER:
                window.location.href = 'urna.html';
                break;
            default:
                window.location.href = 'urna.html';
        }
    }

    redirectToLogin() {
        const currentPage = window.location.pathname;
        const publicPages = ['/index.html', '/login.html', '/'];
        
        if (!publicPages.some(page => currentPage.includes(page))) {
            window.location.href = 'login.html';
        }
    }

    async logout() {
        if (!this.currentUser) return;

        try {
            // Log the logout
            await this.logActivity(this.currentUser.uid, 'logout', 'User logged out');
            
            await signOut(auth);
            utils.showAlert('Logout realizado com sucesso!', 'success');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1000);
            
        } catch (error) {
            console.error('Logout error:', error);
            utils.showAlert('Erro ao fazer logout!', 'danger');
        }
    }

    // Check if user has permission
    hasPermission(requiredRole) {
        if (!this.userProfile) return false;
        
        const roleHierarchy = {
            [userRoles.VOTER]: 1,
            [userRoles.COMMISSION]: 2,
            [userRoles.ADMIN]: 3
        };
        
        const userLevel = roleHierarchy[this.userProfile.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;
        
        return userLevel >= requiredLevel;
    }

    // Get current user info
    getCurrentUser() {
        return {
            user: this.currentUser,
            profile: this.userProfile
        };
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.currentUser;
    }
}

// Initialize authentication system
const authSystem = new AuthSystem();

// Export for use in other modules
window.authSystem = authSystem;

// Demo users creation (for development only)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.createDemoUsers = async function() {
        const demoUsers = [
            {
                email: 'admin@votecerto.com',
                password: 'admin123',
                role: userRoles.ADMIN,
                name: 'Administrador'
            },
            {
                email: 'comissao@votecerto.com',
                password: 'comissao123',
                role: userRoles.COMMISSION,
                name: 'Comissão Eleitoral'
            },
            {
                email: 'eleitor@votecerto.com',
                password: 'eleitor123',
                role: userRoles.VOTER,
                name: 'Eleitor Teste'
            }
        ];

        for (const user of demoUsers) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, user.email, user.password);
                const uid = userCredential.user.uid;
                
                // Create user profile
                const userRef = ref(database, `users/${uid}`);
                await set(userRef, {
                    uid,
                    email: user.email,
                    role: user.role,
                    name: user.name,
                    createdAt: Date.now(),
                    active: true
                });
                
                console.log(`Demo user created: ${user.email}`);
                
            } catch (error) {
                if (error.code !== 'auth/email-already-in-use') {
                    console.error(`Error creating demo user ${user.email}:`, error);
                }
            }
        }
        
        // Sign out after creating demo users
        await signOut(auth);
    };
}

console.log('🔐 Authentication system initialized!');