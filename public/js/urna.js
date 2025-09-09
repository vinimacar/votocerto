// Urna Eletrônica System
// VoteCerto - Sistema de Eleição Online

import { 
    auth, 
    database, 
    electionStatus,
    utils 
} from './firebase-config.js';

import {
    ref,
    get,
    set,
    push,
    query,
    orderByChild,
    equalTo,
    onValue
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

class UrnaEletronica {
    constructor() {
        this.currentElection = null;
        this.candidates = [];
        this.selectedCandidate = null;
        this.hasVoted = false;
        this.currentUser = null;
        this.init();
    }

    init() {
        // Wait for authentication
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.loadUserInfo();
                this.loadCurrentElection();
                this.setupEventListeners();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadUserInfo() {
        if (!this.currentUser) return;

        try {
            const userRef = ref(database, `users/${this.currentUser.uid}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                const userData = snapshot.val();
                document.getElementById('userName').textContent = userData.name || 'Eleitor';
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    async loadCurrentElection() {
        utils.showLoading();

        try {
            // Get active election
            const electionsRef = ref(database, 'elections');
            const activeElectionQuery = query(electionsRef, orderByChild('status'), equalTo(electionStatus.IN_PROGRESS));
            const snapshot = await get(activeElectionQuery);

            if (snapshot.exists()) {
                const elections = snapshot.val();
                const electionId = Object.keys(elections)[0];
                this.currentElection = { id: electionId, ...elections[electionId] };
                
                await this.displayElectionInfo();
                await this.checkIfAlreadyVoted();
                
                if (!this.hasVoted) {
                    await this.loadCandidates();
                } else {
                    this.showAlreadyVotedModal();
                }
            } else {
                this.showNoActiveElection();
            }
        } catch (error) {
            console.error('Error loading election:', error);
            utils.showAlert('Erro ao carregar eleição!', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    displayElectionInfo() {
        if (!this.currentElection) return;

        document.getElementById('electionTitle').textContent = this.currentElection.title;
        document.getElementById('electionDescription').textContent = this.currentElection.description;
        document.getElementById('electionStatus').textContent = 'Em Andamento';
        document.getElementById('electionType').textContent = this.currentElection.type.toUpperCase();
    }

    async checkIfAlreadyVoted() {
        if (!this.currentUser || !this.currentElection) return;

        try {
            const votesRef = ref(database, 'votes');
            const userVoteQuery = query(votesRef, orderByChild('voterId'), equalTo(this.currentUser.uid));
            const snapshot = await get(userVoteQuery);

            if (snapshot.exists()) {
                const votes = snapshot.val();
                // Check if user voted in current election
                this.hasVoted = Object.values(votes).some(vote => 
                    vote.electionId === this.currentElection.id
                );
            }
        } catch (error) {
            console.error('Error checking vote status:', error);
        }
    }

    async loadCandidates() {
        if (!this.currentElection) return;

        try {
            const candidatesRef = ref(database, 'candidates');
            const electionCandidatesQuery = query(candidatesRef, orderByChild('electionId'), equalTo(this.currentElection.id));
            const snapshot = await get(electionCandidatesQuery);

            if (snapshot.exists()) {
                const candidatesData = snapshot.val();
                this.candidates = Object.keys(candidatesData).map(id => ({
                    id,
                    ...candidatesData[id]
                }));
                
                this.displayCandidates();
            } else {
                this.showNoCandidates();
            }
        } catch (error) {
            console.error('Error loading candidates:', error);
            utils.showAlert('Erro ao carregar candidatos!', 'danger');
        }
    }

    displayCandidates() {
        const candidatesList = document.getElementById('candidatesList');
        candidatesList.innerHTML = '';

        this.candidates.forEach(candidate => {
            const candidateCard = this.createCandidateCard(candidate);
            candidatesList.appendChild(candidateCard);
        });
    }

    createCandidateCard(candidate) {
        const col = document.createElement('div');
        col.className = 'col-md-6 col-lg-4 mb-4';

        const photoUrl = candidate.photoUrl || 'assets/candidatos/default-avatar.svg';
        const party = candidate.party || 'Independente';
        const age = candidate.age || 'N/A';
        const profession = candidate.profession || 'Não informado';
        const proposals = candidate.proposals || 'Propostas não informadas';

        col.innerHTML = `
            <div class="candidate-card card h-100" data-candidate-id="${candidate.id}">
                <div class="card-header text-center p-3">
                    <img src="${photoUrl}" alt="${candidate.name}" class="candidate-photo mb-2">
                    <div class="vote-number mb-2">${candidate.number}</div>
                </div>
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title text-center mb-3">${candidate.name}</h5>
                    
                    <div class="candidate-info mb-3">
                        <div class="info-item mb-2">
                            <i class="fas fa-briefcase text-primary me-2"></i>
                            <strong>Cargo:</strong> ${candidate.position}
                        </div>
                        <div class="info-item mb-2">
                            <i class="fas fa-flag text-primary me-2"></i>
                            <strong>Partido:</strong> ${party}
                        </div>
                        <div class="info-item mb-2">
                            <i class="fas fa-birthday-cake text-primary me-2"></i>
                            <strong>Idade:</strong> ${age} anos
                        </div>
                        <div class="info-item mb-2">
                            <i class="fas fa-user-tie text-primary me-2"></i>
                            <strong>Profissão:</strong> ${profession}
                        </div>
                    </div>
                    
                    <div class="candidate-proposals mb-3 flex-grow-1">
                        <h6 class="text-primary mb-2">
                            <i class="fas fa-lightbulb me-2"></i>
                            Principais Propostas:
                        </h6>
                        <p class="small text-muted">${proposals}</p>
                    </div>
                    
                    <button class="btn btn-primary select-candidate-btn mt-auto" data-candidate-id="${candidate.id}">
                        <i class="fas fa-vote-yea me-2"></i>
                        Votar neste candidato
                    </button>
                </div>
            </div>
        `;

        return col;
    }

    setupEventListeners() {
        // Candidate selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('select-candidate-btn') || e.target.closest('.select-candidate-btn')) {
                const candidateId = e.target.dataset.candidateId || e.target.closest('.select-candidate-btn').dataset.candidateId;
                this.selectCandidate(candidateId);
            }
        });

        // Clear vote
        document.getElementById('clearVoteBtn').addEventListener('click', () => {
            this.clearSelection();
        });

        // Confirm vote
        document.getElementById('confirmVoteBtn').addEventListener('click', () => {
            this.showVoteConfirmation();
        });

        // Final confirmation
        document.getElementById('finalConfirmBtn').addEventListener('click', () => {
            this.submitVote();
        });

        // Finish voting
        document.getElementById('finishVotingBtn').addEventListener('click', () => {
            window.location.href = 'resultados.html';
        });
    }

    selectCandidate(candidateId) {
        // Clear previous selection
        document.querySelectorAll('.candidate-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Select new candidate
        const candidateCard = document.querySelector(`[data-candidate-id="${candidateId}"]`);
        if (candidateCard) {
            candidateCard.classList.add('selected');
        }

        // Find candidate data
        this.selectedCandidate = this.candidates.find(c => c.id === candidateId);
        
        if (this.selectedCandidate) {
            this.showSelectedCandidate();
        }
    }

    showSelectedCandidate() {
        if (!this.selectedCandidate) return;

        const selectedInfo = document.getElementById('selectedCandidateInfo');
        const photoUrl = this.selectedCandidate.photoUrl || 'assets/candidatos/default-avatar.svg';
        const party = this.selectedCandidate.party || 'Independente';
        
        selectedInfo.innerHTML = `
            <div class="row align-items-center">
                <div class="col-auto">
                    <img src="${photoUrl}" alt="${this.selectedCandidate.name}" 
                         style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid var(--primary-color); object-fit: cover;">
                </div>
                <div class="col">
                    <h5 class="mb-2 text-primary">${this.selectedCandidate.name}</h5>
                    <div class="mb-1">
                        <i class="fas fa-briefcase text-primary me-2"></i>
                        <strong>Cargo:</strong> ${this.selectedCandidate.position}
                    </div>
                    <div class="mb-1">
                        <i class="fas fa-flag text-primary me-2"></i>
                        <strong>Partido:</strong> ${party}
                    </div>
                    <div class="mb-2">
                        <span class="badge bg-primary">Número: ${this.selectedCandidate.number}</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('voteActions').style.display = 'block';
    }

    clearSelection() {
        document.querySelectorAll('.candidate-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        this.selectedCandidate = null;
        document.getElementById('voteActions').style.display = 'none';
    }

    showVoteConfirmation() {
        if (!this.selectedCandidate) return;

        const confirmationDiv = document.getElementById('candidateConfirmation');
        const photoUrl = this.selectedCandidate.photoUrl || 'assets/candidatos/default-avatar.svg';
        const party = this.selectedCandidate.party || 'Independente';
        
        confirmationDiv.innerHTML = `
            <div class="text-center">
                <img src="${photoUrl}" alt="${this.selectedCandidate.name}" 
                     style="width: 120px; height: 120px; border-radius: 50%; border: 3px solid var(--primary-color); margin-bottom: 1rem; object-fit: cover;">
                <h4 class="text-primary mb-2">${this.selectedCandidate.name}</h4>
                <div class="candidate-details mb-3">
                    <div class="mb-2">
                        <i class="fas fa-briefcase text-primary me-2"></i>
                        <strong>Cargo:</strong> ${this.selectedCandidate.position}
                    </div>
                    <div class="mb-2">
                        <i class="fas fa-flag text-primary me-2"></i>
                        <strong>Partido:</strong> ${party}
                    </div>
                    ${this.selectedCandidate.profession ? `
                        <div class="mb-2">
                            <i class="fas fa-user-tie text-primary me-2"></i>
                            <strong>Profissão:</strong> ${this.selectedCandidate.profession}
                        </div>
                    ` : ''}
                </div>
                <div class="vote-number">${this.selectedCandidate.number}</div>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('voteConfirmationModal'));
        modal.show();
    }

    async submitVote() {
        if (!this.selectedCandidate || !this.currentUser || !this.currentElection) return;

        utils.showLoading();

        try {
            // Create vote record
            const voteData = {
                voterId: this.currentUser.uid,
                candidateId: this.selectedCandidate.id,
                electionId: this.currentElection.id,
                timestamp: Date.now(),
                hash: utils.hashVote(this.currentUser.uid, this.selectedCandidate.id, Date.now())
            };

            // Save vote
            const votesRef = ref(database, 'votes');
            await push(votesRef, voteData);

            // Log the vote
            await this.logVoteActivity();

            // Hide confirmation modal
            const confirmModal = bootstrap.Modal.getInstance(document.getElementById('voteConfirmationModal'));
            if (confirmModal) {
                confirmModal.hide();
            }

            // Show success modal
            setTimeout(() => {
                const successModal = new bootstrap.Modal(document.getElementById('voteSuccessModal'));
                successModal.show();
            }, 500);

        } catch (error) {
            console.error('Error submitting vote:', error);
            utils.showAlert('Erro ao registrar voto! Tente novamente.', 'danger');
        } finally {
            utils.hideLoading();
        }
    }

    async logVoteActivity() {
        try {
            const logRef = ref(database, `logs/${utils.generateId()}`);
            await set(logRef, {
                userId: this.currentUser.uid,
                action: 'vote',
                details: `Vote cast in election: ${this.currentElection.title}`,
                electionId: this.currentElection.id,
                candidateId: this.selectedCandidate.id,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Error logging vote activity:', error);
        }
    }

    showAlreadyVotedModal() {
        const modal = new bootstrap.Modal(document.getElementById('alreadyVotedModal'));
        modal.show();
        
        // Hide voting section
        document.getElementById('votingSection').style.display = 'none';
    }

    showNoActiveElection() {
        const candidatesList = document.getElementById('candidatesList');
        candidatesList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card bg-dark-custom border-neon">
                    <div class="card-body py-5">
                        <i class="fas fa-info-circle text-info" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                        <h4 class="neon-text">Nenhuma eleição ativa</h4>
                        <p class="text-muted">Não há eleições em andamento no momento.</p>
                        <a href="resultados.html" class="btn neon-btn">
                            <i class="fas fa-chart-bar me-2"></i>
                            Ver Resultados Anteriores
                        </a>
                    </div>
                </div>
            </div>
        `;
    }

    showNoCandidates() {
        const candidatesList = document.getElementById('candidatesList');
        candidatesList.innerHTML = `
            <div class="col-12 text-center">
                <div class="card bg-dark-custom border-neon">
                    <div class="card-body py-5">
                        <i class="fas fa-users text-warning" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                        <h4 class="neon-text">Nenhum candidato encontrado</h4>
                        <p class="text-muted">Esta eleição ainda não possui candidatos cadastrados.</p>
                    </div>
                </div>
            </div>
        `;
    }
}

// Initialize Urna Eletrônica
const urna = new UrnaEletronica();

// Export for debugging
window.urna = urna;

console.log('🗳️ Urna Eletrônica initialized!');