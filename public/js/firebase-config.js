// Firebase Configuration
// VoteCerto - Sistema de Eleição Online

// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Your web app's Firebase configuration
// Para produção, substitua pelas suas credenciais do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDDtcc3MYu28GqhFEUBtep9lhZcS8uDIuo",
    authDomain: "votofacil-30139.firebaseapp.com",
    databaseURL: "https://votofacil-30139-default-rtdb.firebaseio.com",
    projectId: "votofacil-30139",
    storageBucket: "votofacil-30139.firebasestorage.app",
    messagingSenderId: "297918826223",
    appId: "1:297918826223:web:ec329db87d43776ce37d1a",
    measurementId: "G-1YD0GGXDMD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Initialize Realtime Database and get a reference to the service
export const database = getDatabase(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Export the app instance
export default app;

// Database structure helper functions
export const dbPaths = {
    users: 'users',
    elections: 'elections',
    candidates: 'candidates',
    votes: 'votes',
    voters: 'voters',
    results: 'results',
    logs: 'logs'
};

// User roles
export const userRoles = {
    ADMIN: 'admin',
    COMMISSION: 'commission',
    VOTER: 'voter'
};

// Election status
export const electionStatus = {
    DRAFT: 'draft',
    OPEN: 'open',
    IN_PROGRESS: 'in_progress',
    CLOSED: 'closed',
    FINISHED: 'finished'
};

// Election types
export const electionTypes = {
    CIPA: 'cipa',
    SCHOOL: 'school',
    CONDOMINIUM: 'condominium',
    GUILD: 'guild',
    ASSOCIATION: 'association'
};

// Utility functions
export const utils = {
    // Generate unique ID
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Format date
    formatDate: (date) => {
        return new Date(date).toLocaleString('pt-BR');
    },
    
    // Validate email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Hash vote for security (simple implementation)
    hashVote: (voterId, candidateId, timestamp) => {
        return btoa(`${voterId}-${candidateId}-${timestamp}`);
    },
    
    // Show loading
    showLoading: () => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('d-none');
        }
    },
    
    // Hide loading
    hideLoading: () => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('d-none');
        }
    },
    
    // Show alert
    showAlert: (message, type = 'info') => {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }
};

// Console log for development
console.log('🔥 Firebase initialized successfully!');
console.log('📊 VoteCerto System Ready!');