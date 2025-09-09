// Admin Dashboard System
// VoteCerto - Sistema de Eleição Online

import { 
    auth, 
    database, 
    userRoles,
    electionStatus,
    electionTypes,
    utils 
} from './firebase-config.js';

import {
    ref,
    get,
    set,
    push,
    update,
    remove,
    query,
    orderByChild,
    limitToLast,
    onValue
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class AdminDashboard {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.elections = [];
        this.candidates = [];
        this.voters = [];
        this.stats = {
            totalElections: 0,
            totalCandidates: 0,
            totalVoters: 0,
            totalVotes: 0
        };
        this.init();
    }

    init() {
        // Wait for authentication
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserProfile();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadUserProfile() {
        if (!this.currentUser) return;

        try {
            const userRef = ref(database, `users/${this.currentUser.uid}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                this.userProfile = snapshot.val();
                
                // Check if user has admin permissions
                if (!this.hasAdminPermissions()) {
                    utils.showAlert('Acesso negado! Você não tem permissões administrativas.', 'danger');
                    setTimeout(() => {
                        window.location.href = 'urna.html';
                    }, 2000);
                    return;
                }
                
                document.getElementById('userName').textContent = this.userProfile.name || 'Admin';
                await this.loadDashboardData();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    hasAdminPermissions() {
        return this.userProfile && 
               (this.userProfile.role === userRoles.ADMIN || 
                this.userProfile.role === userRoles.COMMISSION);
    }

    async loadDashboardData() {
        utils.showLoading();
        
        try {
            await Promise.all([
                this.loadStats(),
                this.loadElections(),
                this.loadCandidates(),
                this.loadVoters(),
                this.loadRecentActivities()
            ]);
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            utils.showAlert('Erro ao carregar dados do dashboard!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async loadStats() {
        try {
            // Load elections count
            const electionsRef = ref(database, 'elections');
            const electionsSnapshot = await get(electionsRef);
            this.stats.totalElections = electionsSnapshot.exists() ? Object.keys(electionsSnapshot.val()).length : 0;

            // Load candidates count
            const candidatesRef = ref(database, 'candidates');
            const candidatesSnapshot = await get(candidatesRef);
            this.stats.totalCandidates = candidatesSnapshot.exists() ? Object.keys(candidatesSnapshot.val()).length : 0;

            // Load voters count
            const votersRef = ref(database, 'users');
            const votersSnapshot = await get(votersRef);
            if (votersSnapshot.exists()) {
                const users = Object.values(votersSnapshot.val());
                this.stats.totalVoters = users.filter(user => user.role === userRoles.VOTER).length;
            }

            // Load votes count
            const votesRef = ref(database, 'votes');
            const votesSnapshot = await get(votesRef);
            this.stats.totalVotes = votesSnapshot.exists() ? Object.keys(votesSnapshot.val()).length : 0;

            this.updateStatsDisplay();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    updateStatsDisplay() {
        document.getElementById('totalElections').textContent = this.stats.totalElections;
        document.getElementById('totalCandidates').textContent = this.stats.totalCandidates;
        document.getElementById('totalVoters').textContent = this.stats.totalVoters;
        document.getElementById('totalVotes').textContent = this.stats.totalVotes;
    }

    async loadElections() {
        try {
            const electionsRef = ref(database, 'elections');
            const snapshot = await get(electionsRef);
            
            if (snapshot.exists()) {
                const electionsData = snapshot.val();
                this.elections = Object.keys(electionsData).map(id => ({
                    id,
                    ...electionsData[id]
                }));
            } else {
                this.elections = [];
            }
            
            this.displayElections();
        } catch (error) {
            console.error('Error loading elections:', error);
        }
    }

    displayElections() {
        const electionsTable = document.getElementById('electionsTable');
        
        if (this.elections.length === 0) {
            electionsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="fas fa-inbox fa-2x mb-2"></i><br>
                        Nenhuma eleição encontrada
                    </td>
                </tr>
            `;
            return;
        }

        electionsTable.innerHTML = this.elections.map(election => {
            const statusBadge = this.getStatusBadge(election.status);
            const typeBadge = this.getTypeBadge(election.type);
            
            return `
                <tr>
                    <td>${election.title}</td>
                    <td>${typeBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${utils.formatDate(election.startDate)}</td>
                    <td>${utils.formatDate(election.endDate)}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="editElection('${election.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-info" onclick="viewElectionDetails('${election.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-outline-danger" onclick="deleteElection('${election.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    getStatusBadge(status) {
        const badges = {
            [electionStatus.DRAFT]: '<span class="badge bg-secondary">Rascunho</span>',
            [electionStatus.OPEN]: '<span class="badge bg-primary">Aberta</span>',
            [electionStatus.IN_PROGRESS]: '<span class="badge bg-success">Em Andamento</span>',
            [electionStatus.CLOSED]: '<span class="badge bg-warning">Fechada</span>',
            [electionStatus.FINISHED]: '<span class="badge bg-info">Finalizada</span>'
        };
        return badges[status] || '<span class="badge bg-dark">Desconhecido</span>';
    }

    getTypeBadge(type) {
        const types = {
            [electionTypes.CIPA]: 'CIPA',
            [electionTypes.SCHOOL]: 'Escolar',
            [electionTypes.CONDOMINIUM]: 'Condomínio',
            [electionTypes.GUILD]: 'Grêmio',
            [electionTypes.ASSOCIATION]: 'Associação'
        };
        return types[type] || type;
    }

    async loadCandidates() {
        try {
            const candidatesRef = ref(database, 'candidates');
            const snapshot = await get(candidatesRef);
            
            if (snapshot.exists()) {
                const candidatesData = snapshot.val();
                this.candidates = Object.keys(candidatesData).map(id => ({
                    id,
                    ...candidatesData[id]
                }));
            } else {
                this.candidates = [];
            }
            
            this.displayCandidates();
        } catch (error) {
            console.error('Error loading candidates:', error);
        }
    }

    displayCandidates() {
        const candidatesGrid = document.getElementById('candidatesGrid');
        
        if (this.candidates.length === 0) {
            candidatesGrid.innerHTML = `
                <div class="col-12 text-center">
                    <div class="dashboard-card py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">Nenhum candidato encontrado</h5>
                        <button class="btn neon-btn mt-3" onclick="showCreateCandidateModal()">
                            <i class="fas fa-plus me-2"></i>
                            Adicionar Primeiro Candidato
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        candidatesGrid.innerHTML = this.candidates.map(candidate => {
            const photoUrl = candidate.photoUrl || 'https://via.placeholder.com/150x150/333/fff?text=Foto';
            
            return `
                <div class="col-md-6 col-lg-4 mb-4">
                    <div class="dashboard-card">
                        <div class="text-center">
                            <img src="${photoUrl}" alt="${candidate.name}" 
                                 class="candidate-photo mb-3" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover;">
                            <h5 class="neon-text">${candidate.name}</h5>
                            <p class="text-muted">${candidate.position}</p>
                            <div class="badge bg-primary mb-2">Número: ${candidate.number}</div>
                            <p class="small text-muted">${candidate.description || 'Sem descrição'}</p>
                            <div class="btn-group btn-group-sm w-100">
                                <button class="btn btn-outline-primary" onclick="editCandidate('${candidate.id}')">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="btn btn-outline-danger" onclick="deleteCandidate('${candidate.id}')">
                                    <i class="fas fa-trash"></i> Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadVoters() {
        try {
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);
            
            if (snapshot.exists()) {
                const usersData = snapshot.val();
                this.voters = Object.keys(usersData)
                    .map(id => ({ id, ...usersData[id] }))
                    .filter(user => user.role === userRoles.VOTER);
            } else {
                this.voters = [];
            }
            
            this.displayVoters();
        } catch (error) {
            console.error('Error loading voters:', error);
        }
    }

    displayVoters() {
        const votersTable = document.getElementById('votersTable');
        
        if (this.voters.length === 0) {
            votersTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="fas fa-user-friends fa-2x mb-2"></i><br>
                        Nenhum eleitor encontrado
                    </td>
                </tr>
            `;
            return;
        }

        votersTable.innerHTML = this.voters.map(voter => {
            const statusBadge = voter.active ? 
                '<span class="badge bg-success">Ativo</span>' : 
                '<span class="badge bg-danger">Inativo</span>';
            
            const lastLogin = voter.lastLogin ? 
                utils.formatDate(voter.lastLogin) : 
                'Nunca';
            
            return `
                <tr>
                    <td>${voter.name || 'Sem nome'}</td>
                    <td>${voter.email}</td>
                    <td>${voter.registration || voter.cpf || 'N/A'}</td>
                    <td>${statusBadge}</td>
                    <td>${lastLogin}</td>
                    <td>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary" onclick="editVoter('${voter.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-outline-${voter.active ? 'warning' : 'success'}" 
                                    onclick="toggleVoterStatus('${voter.id}', ${voter.active})">
                                <i class="fas fa-${voter.active ? 'ban' : 'check'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    async loadRecentActivities() {
        try {
            const logsRef = ref(database, 'logs');
            const recentLogsQuery = query(logsRef, limitToLast(10));
            const snapshot = await get(recentLogsQuery);
            
            const activitiesDiv = document.getElementById('recentActivities');
            
            if (snapshot.exists()) {
                const logsData = snapshot.val();
                const activities = Object.values(logsData).reverse();
                
                activitiesDiv.innerHTML = activities.map(activity => {
                    const icon = this.getActivityIcon(activity.action);
                    const time = utils.formatDate(activity.timestamp);
                    
                    return `
                        <div class="d-flex align-items-center mb-3 p-2 rounded" style="background: rgba(255,255,255,0.05);">
                            <div class="me-3">
                                <i class="${icon} text-primary"></i>
                            </div>
                            <div class="flex-grow-1">
                                <div class="small text-light">${activity.details}</div>
                                <div class="small text-muted">${time}</div>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                activitiesDiv.innerHTML = `
                    <div class="text-center text-muted py-3">
                        <i class="fas fa-history fa-2x mb-2"></i><br>
                        Nenhuma atividade recente
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading recent activities:', error);
        }
    }

    getActivityIcon(action) {
        const icons = {
            'login': 'fas fa-sign-in-alt',
            'logout': 'fas fa-sign-out-alt',
            'vote': 'fas fa-vote-yea',
            'create_election': 'fas fa-plus-circle',
            'edit_election': 'fas fa-edit',
            'delete_election': 'fas fa-trash',
            'create_candidate': 'fas fa-user-plus',
            'edit_candidate': 'fas fa-user-edit',
            'delete_candidate': 'fas fa-user-minus'
        };
        return icons[action] || 'fas fa-info-circle';
    }

    async createElection() {
        const form = document.getElementById('createElectionForm');
        const formData = new FormData(form);
        
        const electionData = {
            title: document.getElementById('electionTitle').value,
            type: document.getElementById('electionType').value,
            description: document.getElementById('electionDescription').value,
            startDate: new Date(document.getElementById('startDate').value).getTime(),
            endDate: new Date(document.getElementById('endDate').value).getTime(),
            status: electionStatus.DRAFT,
            createdBy: this.currentUser.uid,
            createdAt: Date.now()
        };

        // Validation
        if (!electionData.title || !electionData.type || !electionData.startDate || !electionData.endDate) {
            utils.showAlert('Por favor, preencha todos os campos obrigatórios!', 'danger');
            return;
        }

        if (electionData.startDate >= electionData.endDate) {
            utils.showAlert('A data de fim deve ser posterior à data de início!', 'danger');
            return;
        }

        utils.showLoading();

        try {
            const electionsRef = ref(database, 'elections');
            await push(electionsRef, electionData);
            
            // Log activity
            await this.logActivity('create_election', `Created election: ${electionData.title}`);
            
            utils.showAlert('Eleição criada com sucesso!', 'success');
            
            // Close modal and refresh data
            const modal = bootstrap.Modal.getInstance(document.getElementById('createElectionModal'));
            modal.hide();
            
            form.reset();
            await this.loadElections();
            await this.loadStats();
            
        } catch (error) {
            console.error('Error creating election:', error);
            utils.showAlert('Erro ao criar eleição!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async logActivity(action, details) {
        try {
            const logRef = ref(database, `logs/${utils.generateId()}`);
            await set(logRef, {
                userId: this.currentUser.uid,
                action,
                details,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }
}

// Initialize Admin Dashboard
const adminDashboard = new AdminDashboard();

// Export functions for global access
window.adminDashboard = adminDashboard;
window.createElection = () => adminDashboard.createElection();
window.editElection = (id) => console.log('Edit election:', id);
window.deleteElection = (id) => console.log('Delete election:', id);
window.viewElectionDetails = (id) => console.log('View election:', id);
window.editCandidate = (id) => console.log('Edit candidate:', id);
window.deleteCandidate = (id) => console.log('Delete candidate:', id);
window.editVoter = (id) => console.log('Edit voter:', id);
window.toggleVoterStatus = (id, currentStatus) => console.log('Toggle voter status:', id, currentStatus);

console.log('🏢 Admin Dashboard initialized!');