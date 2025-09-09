// Reports System
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
    query,
    orderByChild,
    equalTo
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class ReportsSystem {
    constructor() {
        this.currentUser = null;
        this.userProfile = null;
        this.elections = [];
        this.selectedElection = null;
        this.candidates = [];
        this.votes = [];
        this.voters = [];
        this.exportFormat = 'pdf';
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
                    utils.showAlert('Acesso negado! Você não tem permissões para acessar relatórios.', 'danger');
                    setTimeout(() => {
                        window.location.href = 'urna.html';
                    }, 2000);
                    return;
                }
                
                document.getElementById('userName').textContent = this.userProfile.name || 'Admin';
                await this.loadElections();
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

    async loadElections() {
        try {
            const electionsRef = ref(database, 'elections');
            const snapshot = await get(electionsRef);
            
            const electionSelect = document.getElementById('electionSelect');
            
            if (snapshot.exists()) {
                const electionsData = snapshot.val();
                this.elections = Object.keys(electionsData).map(id => ({
                    id,
                    ...electionsData[id]
                })).sort((a, b) => b.createdAt - a.createdAt);
                
                electionSelect.innerHTML = `
                    <option value="">Selecione uma eleição</option>
                    ${this.elections.map(election => 
                        `<option value="${election.id}">${election.title} - ${this.getStatusText(election.status)}</option>`
                    ).join('')}
                `;
            } else {
                electionSelect.innerHTML = '<option value="">Nenhuma eleição encontrada</option>';
            }
        } catch (error) {
            console.error('Error loading elections:', error);
            utils.showAlert('Erro ao carregar eleições!', 'danger');
        }
    }

    async loadElectionData() {
        const electionId = document.getElementById('electionSelect').value;
        
        if (!electionId) {
            this.selectedElection = null;
            this.clearStatistics();
            return;
        }
        
        utils.showLoading();
        
        try {
            this.selectedElection = this.elections.find(e => e.id === electionId);
            
            await Promise.all([
                this.loadCandidates(electionId),
                this.loadVotes(electionId),
                this.loadVoters()
            ]);
            
            this.updateStatistics();
        } catch (error) {
            console.error('Error loading election data:', error);
            utils.showAlert('Erro ao carregar dados da eleição!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async loadCandidates(electionId) {
        try {
            const candidatesRef = ref(database, 'candidates');
            const candidatesQuery = query(candidatesRef, orderByChild('electionId'), equalTo(electionId));
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

    async loadVotes(electionId) {
        try {
            const votesRef = ref(database, 'votes');
            const votesQuery = query(votesRef, orderByChild('electionId'), equalTo(electionId));
            const snapshot = await get(votesQuery);
            
            if (snapshot.exists()) {
                this.votes = Object.values(snapshot.val());
                this.calculateCandidateVotes();
            } else {
                this.votes = [];
            }
        } catch (error) {
            console.error('Error loading votes:', error);
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

    calculateCandidateVotes() {
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

    updateStatistics() {
        const totalVoters = this.voters.length;
        const totalVotes = this.votes.length;
        const participationRate = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(1) : 0;
        const candidatesCount = this.candidates.length;
        
        document.getElementById('totalVotersCount').textContent = totalVoters;
        document.getElementById('totalVotesCount').textContent = totalVotes;
        document.getElementById('participationRate').textContent = `${participationRate}%`;
        document.getElementById('candidatesCount').textContent = candidatesCount;
    }

    clearStatistics() {
        document.getElementById('totalVotersCount').textContent = '0';
        document.getElementById('totalVotesCount').textContent = '0';
        document.getElementById('participationRate').textContent = '0%';
        document.getElementById('candidatesCount').textContent = '0';
    }

    setExportFormat(format) {
        this.exportFormat = format;
        
        // Update UI
        document.querySelectorAll('.export-option').forEach(option => {
            option.classList.remove('active');
        });
        
        event.currentTarget.classList.add('active');
        
        // Update radio button
        document.querySelector(`input[value="${format}"]`).checked = true;
    }

    async generateGeneralReport() {
        if (!this.selectedElection) {
            utils.showAlert('Por favor, selecione uma eleição primeiro!', 'warning');
            return;
        }
        
        utils.showLoading();
        
        try {
            const reportData = this.prepareGeneralReportData();
            const reportHtml = this.generateGeneralReportHtml(reportData);
            
            this.showReportPreview(reportHtml);
            
            utils.showAlert('Relatório geral gerado com sucesso!', 'success');
        } catch (error) {
            console.error('Error generating general report:', error);
            utils.showAlert('Erro ao gerar relatório geral!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async generateParticipationReport() {
        if (!this.selectedElection) {
            utils.showAlert('Por favor, selecione uma eleição primeiro!', 'warning');
            return;
        }
        
        utils.showLoading();
        
        try {
            const reportData = this.prepareParticipationReportData();
            const reportHtml = this.generateParticipationReportHtml(reportData);
            
            this.showReportPreview(reportHtml);
            
            utils.showAlert('Relatório de participação gerado com sucesso!', 'success');
        } catch (error) {
            console.error('Error generating participation report:', error);
            utils.showAlert('Erro ao gerar relatório de participação!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async generateCandidatesReport() {
        if (!this.selectedElection) {
            utils.showAlert('Por favor, selecione uma eleição primeiro!', 'warning');
            return;
        }
        
        utils.showLoading();
        
        try {
            const reportData = this.prepareCandidatesReportData();
            const reportHtml = this.generateCandidatesReportHtml(reportData);
            
            this.showReportPreview(reportHtml);
            
            utils.showAlert('Relatório de candidatos gerado com sucesso!', 'success');
        } catch (error) {
            console.error('Error generating candidates report:', error);
            utils.showAlert('Erro ao gerar relatório de candidatos!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    prepareGeneralReportData() {
        const totalVoters = this.voters.length;
        const totalVotes = this.votes.length;
        const participationRate = totalVoters > 0 ? ((totalVotes / totalVoters) * 100).toFixed(1) : 0;
        
        return {
            election: this.selectedElection,
            statistics: {
                totalVoters,
                totalVotes,
                participationRate,
                candidatesCount: this.candidates.length
            },
            candidates: this.candidates,
            generatedAt: new Date().toLocaleString('pt-BR')
        };
    }

    prepareParticipationReportData() {
        const voterIds = this.votes.map(vote => vote.userId);
        const votersWhoVoted = this.voters.filter(voter => voterIds.includes(voter.id));
        const votersWhoDidNotVote = this.voters.filter(voter => !voterIds.includes(voter.id));
        
        return {
            election: this.selectedElection,
            votersWhoVoted,
            votersWhoDidNotVote,
            statistics: {
                totalVoters: this.voters.length,
                votedCount: votersWhoVoted.length,
                notVotedCount: votersWhoDidNotVote.length,
                participationRate: this.voters.length > 0 ? ((votersWhoVoted.length / this.voters.length) * 100).toFixed(1) : 0
            },
            generatedAt: new Date().toLocaleString('pt-BR')
        };
    }

    prepareCandidatesReportData() {
        const totalVotes = this.votes.length;
        
        const candidatesWithStats = this.candidates.map((candidate, index) => {
            const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
            
            return {
                ...candidate,
                position: index + 1,
                percentage,
                status: index === 0 ? 'Vencedor' : index < 3 ? 'Top 3' : 'Candidato'
            };
        });
        
        return {
            election: this.selectedElection,
            candidates: candidatesWithStats,
            statistics: {
                totalVotes,
                candidatesCount: this.candidates.length
            },
            generatedAt: new Date().toLocaleString('pt-BR')
        };
    }

    generateGeneralReportHtml(data) {
        return `
            <div class="report-header">
                <h1>Relatório Geral da Eleição</h1>
                <h2>${data.election.title}</h2>
                <p><strong>Tipo:</strong> ${this.getElectionType(data.election.type)}</p>
                <p><strong>Período:</strong> ${utils.formatDate(data.election.startDate)} - ${utils.formatDate(data.election.endDate)}</p>
                <p><strong>Status:</strong> ${this.getStatusText(data.election.status)}</p>
                <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
            </div>
            
            <div class="report-section">
                <h3>Estatísticas Gerais</h3>
                <table class="table table-bordered">
                    <tr><td><strong>Total de Eleitores</strong></td><td>${data.statistics.totalVoters}</td></tr>
                    <tr><td><strong>Votos Computados</strong></td><td>${data.statistics.totalVotes}</td></tr>
                    <tr><td><strong>Taxa de Participação</strong></td><td>${data.statistics.participationRate}%</td></tr>
                    <tr><td><strong>Número de Candidatos</strong></td><td>${data.statistics.candidatesCount}</td></tr>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Resultados por Candidato</h3>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Posição</th>
                            <th>Nome</th>
                            <th>Número</th>
                            <th>Votos</th>
                            <th>Percentual</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.candidates.map((candidate, index) => {
                            const percentage = data.statistics.totalVotes > 0 ? 
                                ((candidate.votes / data.statistics.totalVotes) * 100).toFixed(1) : 0;
                            return `
                                <tr>
                                    <td>${index + 1}º</td>
                                    <td>${candidate.name}</td>
                                    <td>${candidate.number}</td>
                                    <td>${candidate.votes}</td>
                                    <td>${percentage}%</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateParticipationReportHtml(data) {
        return `
            <div class="report-header">
                <h1>Relatório de Participação</h1>
                <h2>${data.election.title}</h2>
                <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
            </div>
            
            <div class="report-section">
                <h3>Resumo de Participação</h3>
                <table class="table table-bordered">
                    <tr><td><strong>Total de Eleitores</strong></td><td>${data.statistics.totalVoters}</td></tr>
                    <tr><td><strong>Eleitores que Votaram</strong></td><td>${data.statistics.votedCount}</td></tr>
                    <tr><td><strong>Eleitores que Não Votaram</strong></td><td>${data.statistics.notVotedCount}</td></tr>
                    <tr><td><strong>Taxa de Participação</strong></td><td>${data.statistics.participationRate}%</td></tr>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Eleitores que Votaram (${data.votersWhoVoted.length})</h3>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Matrícula/CPF</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.votersWhoVoted.map(voter => `
                            <tr>
                                <td>${voter.name || 'Sem nome'}</td>
                                <td>${voter.email}</td>
                                <td>${voter.registration || voter.cpf || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Eleitores que Não Votaram (${data.votersWhoDidNotVote.length})</h3>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Email</th>
                            <th>Matrícula/CPF</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.votersWhoDidNotVote.map(voter => `
                            <tr>
                                <td>${voter.name || 'Sem nome'}</td>
                                <td>${voter.email}</td>
                                <td>${voter.registration || voter.cpf || 'N/A'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateCandidatesReportHtml(data) {
        return `
            <div class="report-header">
                <h1>Relatório de Candidatos</h1>
                <h2>${data.election.title}</h2>
                <p><strong>Gerado em:</strong> ${data.generatedAt}</p>
            </div>
            
            <div class="report-section">
                <h3>Desempenho dos Candidatos</h3>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Posição</th>
                            <th>Nome</th>
                            <th>Número</th>
                            <th>Cargo</th>
                            <th>Votos</th>
                            <th>Percentual</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.candidates.map(candidate => `
                            <tr>
                                <td>${candidate.position}º</td>
                                <td>${candidate.name}</td>
                                <td>${candidate.number}</td>
                                <td>${candidate.position || 'Candidato'}</td>
                                <td>${candidate.votes}</td>
                                <td>${candidate.percentage}%</td>
                                <td>${candidate.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div class="report-section">
                <h3>Análise Detalhada</h3>
                ${data.candidates.map(candidate => `
                    <div class="candidate-analysis">
                        <h4>${candidate.name} (Número ${candidate.number})</h4>
                        <p><strong>Posição:</strong> ${candidate.position}º lugar</p>
                        <p><strong>Votos recebidos:</strong> ${candidate.votes} (${candidate.percentage}% do total)</p>
                        <p><strong>Descrição:</strong> ${candidate.description || 'Sem descrição disponível'}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showReportPreview(html) {
        document.getElementById('reportPreview').innerHTML = html;
        document.getElementById('reportPreviewSection').style.display = 'block';
        
        // Scroll to preview
        document.getElementById('reportPreviewSection').scrollIntoView({ 
            behavior: 'smooth' 
        });
    }

    printReport() {
        window.print();
    }

    downloadReport() {
        const reportContent = document.getElementById('reportPreview').innerHTML;
        
        switch (this.exportFormat) {
            case 'pdf':
                this.downloadAsPDF(reportContent);
                break;
            case 'excel':
                this.downloadAsExcel();
                break;
            case 'csv':
                this.downloadAsCSV();
                break;
            case 'json':
                this.downloadAsJSON();
                break;
            default:
                utils.showAlert('Formato de exportação não suportado!', 'warning');
        }
    }

    downloadAsPDF(content) {
        utils.showAlert('Funcionalidade de exportação PDF em desenvolvimento!', 'info');
    }

    downloadAsExcel() {
        utils.showAlert('Funcionalidade de exportação Excel em desenvolvimento!', 'info');
    }

    downloadAsCSV() {
        if (!this.selectedElection) return;
        
        const csvData = this.generateCSVData();
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio-${this.selectedElection.title.replace(/\s+/g, '-')}.csv`;
        link.click();
        
        utils.showAlert('Relatório CSV baixado com sucesso!', 'success');
    }

    downloadAsJSON() {
        if (!this.selectedElection) return;
        
        const jsonData = {
            election: this.selectedElection,
            candidates: this.candidates,
            votes: this.votes,
            voters: this.voters,
            generatedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { 
            type: 'application/json;charset=utf-8;' 
        });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio-${this.selectedElection.title.replace(/\s+/g, '-')}.json`;
        link.click();
        
        utils.showAlert('Relatório JSON baixado com sucesso!', 'success');
    }

    generateCSVData() {
        const headers = ['Posição', 'Nome', 'Número', 'Votos', 'Percentual'];
        const totalVotes = this.votes.length;
        
        const rows = this.candidates.map((candidate, index) => {
            const percentage = totalVotes > 0 ? ((candidate.votes / totalVotes) * 100).toFixed(1) : 0;
            return [
                index + 1,
                candidate.name,
                candidate.number,
                candidate.votes,
                `${percentage}%`
            ];
        });
        
        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    getStatusText(status) {
        const statusTexts = {
            [electionStatus.DRAFT]: 'Rascunho',
            [electionStatus.OPEN]: 'Aberta',
            [electionStatus.IN_PROGRESS]: 'Em Andamento',
            [electionStatus.CLOSED]: 'Fechada',
            [electionStatus.FINISHED]: 'Finalizada'
        };
        return statusTexts[status] || 'Desconhecido';
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

    refreshElections() {
        this.loadElections();
        utils.showAlert('Lista de eleições atualizada!', 'success');
    }
}

// Initialize Reports System
const reportsSystem = new ReportsSystem();

// Export functions for global access
window.reportsSystem = reportsSystem;
window.loadElectionData = () => reportsSystem.loadElectionData();
window.refreshElections = () => reportsSystem.refreshElections();
window.setExportFormat = (format) => reportsSystem.setExportFormat(format);
window.generateGeneralReport = () => reportsSystem.generateGeneralReport();
window.generateParticipationReport = () => reportsSystem.generateParticipationReport();
window.generateCandidatesReport = () => reportsSystem.generateCandidatesReport();
window.printReport = () => reportsSystem.printReport();
window.downloadReport = () => reportsSystem.downloadReport();

console.log('📊 Reports System initialized!');