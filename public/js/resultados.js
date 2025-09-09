// Results System
// VoteCerto - Sistema de Eleição Online

import { 
    auth, 
    database, 
    userRoles,
    electionStatus,
    utils 
} from './firebase-config.js';

import {
    ref,
    get,
    onValue,
    query,
    orderByChild,
    equalTo
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class ResultsSystem {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.currentElection = null;
        this.candidates = [];
        this.votes = [];
        this.voters = [];
        this.chart = null;
        this.chartType = 'bar';
        this.realTimeListeners = [];
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
                document.getElementById('userName').textContent = this.userProfile.name || 'Usuário';
                await this.loadResults();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async loadResults() {
        utils.showLoading();
        
        try {
            await this.loadActiveElection();
            if (this.currentElection) {
                await Promise.all([
                    this.loadCandidates(),
                    this.loadVoters(),
                    this.loadVotes()
                ]);
                
                this.setupRealTimeUpdates();
                this.updateDisplay();
                this.createChart();
            } else {
                this.showNoElectionMessage();
            }
        } catch (error) {
            console.error('Error loading results:', error);
            utils.showAlert('Erro ao carregar resultados!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async loadActiveElection() {
        try {
            const electionsRef = ref(database, 'elections');
            const snapshot = await get(electionsRef);
            
            if (snapshot.exists()) {
                const elections = Object.entries(snapshot.val())
                    .map(([id, data]) => ({ id, ...data }))
                    .filter(election => 
                        election.status === electionStatus.IN_PROGRESS || 
                        election.status === electionStatus.FINISHED
                    )
                    .sort((a, b) => b.createdAt - a.createdAt);
                
                this.currentElection = elections[0] || null;
            }
        } catch (error) {
            console.error('Error loading active election:', error);
        }
    }

    async loadCandidates() {
        if (!this.currentElection) return;
        
        try {
            const candidatesRef = ref(database, 'candidates');
            const candidatesQuery = query(candidatesRef, orderByChild('electionId'), equalTo(this.currentElection.id));
            const snapshot = await get(candidatesQuery);
            
            if (snapshot.exists()) {
                this.candidates = Object.entries(snapshot.val())
                    .map(([id, data]) => ({ id, ...data, votes: 0 }));
            } else {
                this.candidates = [];
            }
        } catch (error) {
            console.error('Error loading candidates:', error);
        }
    }

    async loadVoters() {
        try {
            const usersRef = ref(database, 'users');
            const snapshot = await get(usersRef);
            
            if (snapshot.exists()) {
                this.voters = Object.entries(snapshot.val())
                    .map(([id, data]) => ({ id, ...data }))
                    .filter(user => user.role === userRoles.VOTER);
            } else {
                this.voters = [];
            }
        } catch (error) {
            console.error('Error loading voters:', error);
        }
    }

    async loadVotes() {
        if (!this.currentElection) return;
        
        try {
            const votesRef = ref(database, 'votes');
            const votesQuery = query(votesRef, orderByChild('electionId'), equalTo(this.currentElection.id));
            const snapshot = await get(votesQuery);
            
            if (snapshot.exists()) {
                this.votes = Object.values(snapshot.val());
                this.calculateResults();
            } else {
                this.votes = [];
            }
        } catch (error) {
            console.error('Error loading votes:', error);
        }
    }

    calculateResults() {
        // Reset vote counts
        this.candidates.forEach(candidate => {
            candidate.votes = 0;
        });
        
        // Count votes for each candidate
        this.votes.forEach(vote => {
            const candidate = this.candidates.find(c => c.id === vote.candidateId);
            if (candidate) {
                candidate.votes++;
            }
        });
        
        // Sort candidates by vote count
        this.candidates.sort((a, b) => b.votes - a.votes);
    }

    setupRealTimeUpdates() {
        if (!this.currentElection) return;
        
        // Listen for new votes
        const votesRef = ref(database, 'votes');
        const votesQuery = query(votesRef, orderByChild('electionId'), equalTo(this.currentElection.id));
        
        const unsubscribe = onValue(votesQuery, (snapshot) => {
            if (snapshot.exists()) {
                this.votes = Object.values(snapshot.val());
                this.calculateResults();
                this.updateDisplay();
                this.updateChart();
                this.updateLastUpdateTime();
            }
        });
        
        this.realTimeListeners.push(unsubscribe);
    }

    updateDisplay() {
        this.updateElectionInfo();
        this.updateStats();
        this.updateRanking();
        this.updateDetailedResults();
    }

    updateElectionInfo() {
        if (!this.currentElection) return;
        
        const electionInfo = document.getElementById('electionInfo');
        const statusBadge = this.getStatusBadge(this.currentElection.status);
        
        electionInfo.innerHTML = `
            <h3 class="neon-text">${this.currentElection.title}</h3>
            <p class="mb-2">${this.currentElection.description || 'Sem descrição'}</p>
            <div class="d-flex justify-content-center align-items-center gap-3 flex-wrap">
                <span>${statusBadge}</span>
                <span class="badge bg-secondary">${this.getElectionType(this.currentElection.type)}</span>
                <span class="text-muted">
                    <i class="fas fa-calendar me-1"></i>
                    ${utils.formatDate(this.currentElection.startDate)} - ${utils.formatDate(this.currentElection.endDate)}
                </span>
            </div>
        `;
    }

    updateStats() {
        const totalVoters = this.voters.length;
        const totalVotes = this.votes.length;
        const turnoutPercentage = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(1) : 0;
        
        document.getElementById('totalVoters').textContent = totalVoters;
        document.getElementById('totalVotes').textContent = totalVotes;
        document.getElementById('turnoutPercentage').textContent = `${turnoutPercentage}%`;
    }

    updateRanking() {
        const rankingTable = document.getElementById('rankingTable');
        
        if (this.candidates.length === 0) {
            rankingTable.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-users fa-2x mb-2"></i><br>
                    Nenhum candidato encontrado
                </div>
            `;
            return;
        }
        
        rankingTable.innerHTML = this.candidates.slice(0, 5).map((candidate, index) => {
            const position = index + 1;
            const percentage = this.votes.length > 0 ? ((candidate.votes / this.votes.length) * 100).toFixed(1) : 0;
            const positionClass = position <= 3 ? ['first', 'second', 'third'][position - 1] : '';
            const photoUrl = candidate.photoUrl || 'https://via.placeholder.com/50x50/333/fff?text=Foto';
            
            return `
                <div class="ranking-item ${positionClass}">
                    <div class="position-badge position-${position <= 3 ? position : 'other'}">
                        ${position}
                    </div>
                    <img src="${photoUrl}" alt="${candidate.name}" class="candidate-photo">
                    <div class="flex-grow-1">
                        <div class="fw-bold">${candidate.name}</div>
                        <div class="small text-muted">Número: ${candidate.number}</div>
                    </div>
                    <div class="text-end">
                        <div class="vote-count">${candidate.votes}</div>
                        <div class="vote-percentage">${percentage}%</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateDetailedResults() {
        const detailedResultsTable = document.getElementById('detailedResultsTable');
        
        if (this.candidates.length === 0) {
            detailedResultsTable.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-4">
                        <i class="fas fa-users fa-2x mb-2"></i><br>
                        Nenhum candidato encontrado
                    </td>
                </tr>
            `;
            return;
        }
        
        detailedResultsTable.innerHTML = this.candidates.map((candidate, index) => {
            const position = index + 1;
            const percentage = this.votes.length > 0 ? ((candidate.votes / this.votes.length) * 100).toFixed(1) : 0;
            const statusIcon = position === 1 ? 
                '<i class="fas fa-crown text-warning"></i> Líder' : 
                position <= 3 ? 
                '<i class="fas fa-medal text-info"></i> Top 3' : 
                '<i class="fas fa-user text-muted"></i> Candidato';
            
            return `
                <tr>
                    <td>
                        <span class="badge ${position === 1 ? 'bg-warning text-dark' : position <= 3 ? 'bg-info' : 'bg-secondary'}">
                            ${position}º
                        </span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${candidate.photoUrl || 'https://via.placeholder.com/40x40/333/fff?text=Foto'}" 
                                 alt="${candidate.name}" class="rounded-circle me-2" 
                                 style="width: 40px; height: 40px; object-fit: cover;">
                            <div>
                                <div class="fw-bold">${candidate.name}</div>
                                <div class="small text-muted">${candidate.position || 'Candidato'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge bg-primary">${candidate.number}</span>
                    </td>
                    <td>
                        <span class="fw-bold text-primary">${candidate.votes}</span>
                    </td>
                    <td>
                        <div class="d-flex align-items-center">
                            <div class="progress me-2" style="width: 60px; height: 8px;">
                                <div class="progress-bar bg-primary" style="width: ${percentage}%"></div>
                            </div>
                            <span>${percentage}%</span>
                        </div>
                    </td>
                    <td>${statusIcon}</td>
                </tr>
            `;
        }).join('');
    }

    createChart() {
        const ctx = document.getElementById('votesChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const chartData = {
            labels: this.candidates.map(c => c.name),
            datasets: [{
                label: 'Votos',
                data: this.candidates.map(c => c.votes),
                backgroundColor: [
                    'rgba(0, 255, 255, 0.8)',
                    'rgba(255, 0, 255, 0.8)',
                    'rgba(255, 255, 0, 0.8)',
                    'rgba(0, 255, 0, 0.8)',
                    'rgba(255, 0, 0, 0.8)',
                    'rgba(0, 0, 255, 0.8)'
                ],
                borderColor: [
                    'rgba(0, 255, 255, 1)',
                    'rgba(255, 0, 255, 1)',
                    'rgba(255, 255, 0, 1)',
                    'rgba(0, 255, 0, 1)',
                    'rgba(255, 0, 0, 1)',
                    'rgba(0, 0, 255, 1)'
                ],
                borderWidth: 2
            }]
        };
        
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: this.chartType === 'pie',
                    labels: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = this.votes.length;
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} votos (${percentage}%)`;
                        }
                    }
                }
            },
            scales: this.chartType === 'bar' ? {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#ffffff',
                        stepSize: 1
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                },
                x: {
                    ticks: {
                        color: '#ffffff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            } : {}
        };
        
        this.chart = new Chart(ctx, {
            type: this.chartType,
            data: chartData,
            options: chartOptions
        });
    }

    updateChart() {
        if (!this.chart) return;
        
        this.chart.data.datasets[0].data = this.candidates.map(c => c.votes);
        this.chart.update('none');
    }

    showChart(type) {
        this.chartType = type;
        
        // Update button states
        document.getElementById('barChartBtn').classList.toggle('active', type === 'bar');
        document.getElementById('pieChartBtn').classList.toggle('active', type === 'pie');
        
        this.createChart();
    }

    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        document.getElementById('lastUpdate').textContent = timeString;
    }

    showNoElectionMessage() {
        const electionInfo = document.getElementById('electionInfo');
        electionInfo.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-vote-yea fa-4x text-muted mb-3"></i>
                <h3 class="text-muted">Nenhuma eleição ativa</h3>
                <p class="text-muted">Não há eleições em andamento ou finalizadas no momento.</p>
                <a href="dashboard.html" class="btn neon-btn mt-3">
                    <i class="fas fa-plus me-2"></i>
                    Criar Nova Eleição
                </a>
            </div>
        `;
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

    getElectionType(type) {
        const types = {
            'cipa': 'CIPA',
            'school': 'Escolar',
            'condominium': 'Condomínio',
            'guild': 'Grêmio',
            'association': 'Associação'
        };
        return types[type] || type;
    }

    // Export functions
    async exportToPDF() {
        utils.showAlert('Funcionalidade de exportação PDF em desenvolvimento!', 'info');
    }

    async exportToExcel() {
        utils.showAlert('Funcionalidade de exportação Excel em desenvolvimento!', 'info');
    }

    async exportChartImage() {
        if (!this.chart) {
            utils.showAlert('Nenhum gráfico disponível para exportar!', 'warning');
            return;
        }
        
        try {
            const url = this.chart.toBase64Image();
            const link = document.createElement('a');
            link.download = `resultados-${this.currentElection?.title || 'eleicao'}.png`;
            link.href = url;
            link.click();
            
            utils.showAlert('Gráfico exportado com sucesso!', 'success');
        } catch (error) {
            console.error('Error exporting chart:', error);
            utils.showAlert('Erro ao exportar gráfico!', 'danger');
        }
    }

    async shareResults() {
        if (!this.currentElection) {
            utils.showAlert('Nenhuma eleição selecionada!', 'warning');
            return;
        }
        
        const shareData = {
            title: `Resultados - ${this.currentElection.title}`,
            text: `Confira os resultados da eleição: ${this.currentElection.title}`,
            url: window.location.href
        };
        
        if (navigator.share) {
            try {
                await navigator.share(shareData);
                utils.showAlert('Resultados compartilhados com sucesso!', 'success');
            } catch (error) {
                console.error('Error sharing:', error);
            }
        } else {
            // Fallback: copy to clipboard
            try {
                await navigator.clipboard.writeText(window.location.href);
                utils.showAlert('Link copiado para a área de transferência!', 'success');
            } catch (error) {
                utils.showAlert('Erro ao compartilhar resultados!', 'danger');
            }
        }
    }

    destroy() {
        // Clean up real-time listeners
        this.realTimeListeners.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        
        // Destroy chart
        if (this.chart) {
            this.chart.destroy();
        }
    }
}

// Initialize Results System
const resultsSystem = new ResultsSystem();

// Export functions for global access
window.resultsSystem = resultsSystem;
window.showChart = (type) => resultsSystem.showChart(type);
window.exportToPDF = () => resultsSystem.exportToPDF();
window.exportToExcel = () => resultsSystem.exportToExcel();
window.exportChartImage = () => resultsSystem.exportChartImage();
window.shareResults = () => resultsSystem.shareResults();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    resultsSystem.destroy();
});

console.log('📊 Results System initialized!');