/**
 * GAME CONTROLLER - SIMULTANEOUS MULTIPLAYER TUG-OF-WAR
 * Handles concurrent answers, non-blocking asynchronous play,
 * keyboard & multi-touch controls, tug balance, and educational review.
 */

class TugOfWarGame {
  constructor() {
    this.world = null;
    this.sound = sound;

    // Team Configurations
    this.teamA = {
      name: "Tim Steve",
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      streak: 0,
      maxStreak: 0,
      queue: [],
      currentIndex: 0,
      isLocked: false,
      answeredHistory: []
    };

    this.teamB = {
      name: "Tim Alex",
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      streak: 0,
      maxStreak: 0,
      queue: [],
      currentIndex: 0,
      isLocked: false,
      answeredHistory: []
    };

    // Game Settings
    this.targetPulls = 6; // Pull distance to win
    this.timeLimit = 0; // 0 = unlimited (first to target), >0 = seconds
    this.timeRemaining = 0;
    this.timerInterval = null;

    // State
    this.tugBalance = 0; // Negative = Team A winning, Positive = Team B winning
    this.gameState = 'IDLE'; // 'IDLE', 'COUNTDOWN', 'PLAYING', 'VICTORY'
    this.winner = null;

    this.initDOMReferences();
    this.bindEvents();
  }

  initDOMReferences() {
    // Top HUD
    this.hudTeamAName = document.getElementById('hudTeamAName');
    this.hudTeamBName = document.getElementById('hudTeamBName');
    this.hudTeamAScore = document.getElementById('hudTeamAScore');
    this.hudTeamBScore = document.getElementById('hudTeamBScore');
    this.tugIndicatorBar = document.getElementById('tugIndicatorBar');
    this.tugFlag = document.getElementById('tugFlag');
    this.timerDisplay = document.getElementById('timerDisplay');
    this.statusBanner = document.getElementById('statusBanner');

    // Left Team Panel (Team A)
    this.panelTeamA = document.getElementById('panelTeamA');
    this.titleTeamA = document.getElementById('titleTeamA');
    this.categoryTeamA = document.getElementById('categoryTeamA');
    this.textTeamA = document.getElementById('textTeamA');
    this.streakTeamA = document.getElementById('streakTeamA');
    this.optionsContainerA = document.getElementById('optionsContainerA');
    this.cooldownOverlayA = document.getElementById('cooldownOverlayA');

    // Right Team Panel (Team B)
    this.panelTeamB = document.getElementById('panelTeamB');
    this.titleTeamB = document.getElementById('titleTeamB');
    this.categoryTeamB = document.getElementById('categoryTeamB');
    this.textTeamB = document.getElementById('textTeamB');
    this.streakTeamB = document.getElementById('streakTeamB');
    this.optionsContainerB = document.getElementById('optionsContainerB');
    this.cooldownOverlayB = document.getElementById('cooldownOverlayB');

    // Modals
    this.modalSetup = document.getElementById('modalSetup');
    this.modalVictory = document.getElementById('modalVictory');
    this.modalReview = document.getElementById('modalReview');

    // Inputs
    this.inputTeamAName = document.getElementById('inputTeamAName');
    this.inputTeamBName = document.getElementById('inputTeamBName');
    this.selectTargetPulls = document.getElementById('selectTargetPulls');
    this.selectTimeLimit = document.getElementById('selectTimeLimit');

    // Audio controls
    this.btnMute = document.getElementById('btnMute');
    this.btnMusic = document.getElementById('btnMusic');
  }

  bindEvents() {
    // Keyboard controls for simultaneous local play
    window.addEventListener('keydown', (e) => {
      if (this.gameState !== 'PLAYING') return;

      const key = e.key.toUpperCase();

      // Team A: Keys '1', '2', '3', '4' OR 'Q', 'W', 'E', 'R'
      const keyMapA = { '1': 0, '2': 1, '3': 2, '4': 3, 'Q': 0, 'W': 1, 'E': 2, 'R': 3 };
      if (keyMapA.hasOwnProperty(key)) {
        this.handleAnswer('A', keyMapA[key]);
      }

      // Team B: Keys '7', '8', '9', '0' OR 'U', 'I', 'O', 'P'
      const keyMapB = { '7': 0, '8': 1, '9': 2, '0': 3, 'U': 0, 'I': 1, 'O': 2, 'P': 3 };
      if (keyMapB.hasOwnProperty(key)) {
        this.handleAnswer('B', keyMapB[key]);
      }
    });

    // Mute button
    if (this.btnMute) {
      this.btnMute.addEventListener('click', () => {
        const isMuted = this.sound.toggleMute();
        this.btnMute.textContent = isMuted ? '🔇 Muted' : '🔊 Suara: ON';
      });
    }

    // Music toggle button
    if (this.btnMusic) {
      this.btnMusic.addEventListener('click', () => {
        if (this.sound.bgmPlaying) {
          this.sound.stopBgm();
          this.btnMusic.textContent = '🎵 BGM: OFF';
        } else {
          this.sound.startBgm();
          this.btnMusic.textContent = '🎵 BGM: ON';
        }
      });
    }

    // Modal buttons
    document.getElementById('btnStartGame').addEventListener('click', () => {
      this.applySettingsAndStart();
    });

    document.getElementById('btnRematch').addEventListener('click', () => {
      this.modalVictory.classList.add('hidden');
      this.startCountdown();
    });

    document.getElementById('btnOpenSettings').addEventListener('click', () => {
      this.modalSetup.classList.remove('hidden');
    });

    document.getElementById('btnShowReview').addEventListener('click', () => {
      this.openReviewModal();
    });

    document.getElementById('btnCloseReview').addEventListener('click', () => {
      this.modalReview.classList.add('hidden');
    });
  }

  setWorld(worldInstance) {
    this.world = worldInstance;
  }

  applySettingsAndStart() {
    this.teamA.name = this.inputTeamAName.value.trim() || "Tim Steve";
    this.teamB.name = this.inputTeamBName.value.trim() || "Tim Alex";
    this.targetPulls = parseInt(this.selectTargetPulls.value) || 6;
    this.timeLimit = parseInt(this.selectTimeLimit.value) || 0;

    this.hudTeamAName.textContent = this.teamA.name;
    this.hudTeamBName.textContent = this.teamB.name;
    this.titleTeamA.textContent = this.teamA.name;
    this.titleTeamB.textContent = this.teamB.name;

    this.modalSetup.classList.add('hidden');
    this.sound.playClick();
    this.sound.startBgm();

    this.startCountdown();
  }

  startCountdown() {
    this.resetGameState();
    this.gameState = 'COUNTDOWN';

    let count = 3;
    this.statusBanner.classList.remove('hidden');
    this.statusBanner.textContent = `PERSIAPAN... ${count}`;
    this.sound.playCountdown(false);

    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.statusBanner.textContent = `PERSIAPAN... ${count}`;
        this.sound.playCountdown(false);
      } else if (count === 0) {
        this.statusBanner.textContent = `TARIK TAMBANG DIMULAI! 🔥`;
        this.sound.playCountdown(true);
        this.sound.playRaidHorn();
      } else {
        clearInterval(timer);
        this.statusBanner.classList.add('hidden');
        this.beginMatch();
      }
    }, 900);
  }

  resetGameState() {
    this.tugBalance = 0;
    this.winner = null;

    // Reset team stats
    [this.teamA, this.teamB].forEach(team => {
      team.score = 0;
      team.correctCount = 0;
      team.wrongCount = 0;
      team.streak = 0;
      team.maxStreak = 0;
      team.isLocked = false;
      team.currentIndex = 0;
      team.answeredHistory = [];
      team.queue = getShuffledQuestionQueue();
    });

    if (this.cooldownOverlayA) this.cooldownOverlayA.classList.add('hidden');
    if (this.cooldownOverlayB) this.cooldownOverlayB.classList.add('hidden');

    this.updateHUD();
    if (this.world) this.world.reset();
  }

  beginMatch() {
    this.gameState = 'PLAYING';

    // Render initial questions for both teams
    this.renderQuestion('A');
    this.renderQuestion('B');

    // Start timer if configured
    if (this.timeLimit > 0) {
      this.timeRemaining = this.timeLimit;
      this.updateTimerDisplay();
      this.timerInterval = setInterval(() => {
        this.timeRemaining--;
        this.updateTimerDisplay();
        if (this.timeRemaining <= 0) {
          clearInterval(this.timerInterval);
          this.endMatchByTime();
        }
      }, 1000);
    } else {
      this.timerDisplay.textContent = `🎯 Target: ${this.targetPulls} Tarikan`;
    }
  }

  updateTimerDisplay() {
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    this.timerDisplay.textContent = `⏱️ ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // --- RENDERING QUESTIONS FOR INDIVIDUAL TEAMS ---

  renderQuestion(teamId) {
    const team = (teamId === 'A') ? this.teamA : this.teamB;
    const qData = team.queue[team.currentIndex];

    if (!qData) {
      // Loop or re-shuffle if exhausted
      team.queue = getShuffledQuestionQueue();
      team.currentIndex = 0;
      return this.renderQuestion(teamId);
    }

    const categoryElem = (teamId === 'A') ? this.categoryTeamA : this.categoryTeamB;
    const textElem = (teamId === 'A') ? this.textTeamA : this.textTeamB;
    const container = (teamId === 'A') ? this.optionsContainerA : this.optionsContainerB;

    categoryElem.textContent = `📚 [${qData.category}] (Soal #${team.currentIndex + 1})`;
    textElem.textContent = qData.question;

    container.innerHTML = '';

    const letters = ['A', 'B', 'C', 'D'];
    const hotkeysA = ['1', '2', '3', '4'];
    const hotkeysB = ['7', '8', '9', '0'];

    qData.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'mc-btn mc-answer-btn';
      
      const hotkey = (teamId === 'A') ? hotkeysA[idx] : hotkeysB[idx];
      btn.innerHTML = `<span class="badge-hotkey">[${hotkey}]</span> <strong>${letters[idx]}.</strong> ${optText}`;

      // Simultaneous click / touch handling
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleAnswer(teamId, idx);
      });

      container.appendChild(btn);
    });
  }

  // --- ANSWER PROCESSING (CONCURRENT & NON-BLOCKING) ---

  handleAnswer(teamId, chosenIndex) {
    if (this.gameState !== 'PLAYING') return;

    const team = (teamId === 'A') ? this.teamA : this.teamB;
    if (team.isLocked) return; // Prevent spamming during cooldown

    const qData = team.queue[team.currentIndex];
    if (!qData) return;

    const isCorrect = (chosenIndex === qData.answer);

    // Save record for educational review
    team.answeredHistory.push({
      question: qData.question,
      category: qData.category,
      options: qData.options,
      correctAnswer: qData.options[qData.answer],
      chosenAnswer: qData.options[chosenIndex],
      isCorrect: isCorrect,
      explanation: qData.explanation
    });

    if (isCorrect) {
      this.processCorrectAnswer(teamId);
    } else {
      this.processWrongAnswer(teamId);
    }
  }

  processCorrectAnswer(teamId) {
    const team = (teamId === 'A') ? this.teamA : this.teamB;
    const panel = (teamId === 'A') ? this.panelTeamA : this.panelTeamB;
    const streakElem = (teamId === 'A') ? this.streakTeamA : this.streakTeamB;

    team.correctCount++;
    team.streak++;
    if (team.streak > team.maxStreak) team.maxStreak = team.streak;

    // Tug balance shift: Team A pulls Left (-1), Team B pulls Right (+1)
    if (teamId === 'A') {
      this.tugBalance -= 1;
    } else {
      this.tugBalance += 1;
    }

    // Audio & 3D world trigger
    this.sound.playCorrect();
    this.sound.playTug();
    if (this.world) {
      this.world.triggerTug(teamId);
      // Map balance to 3D world rope displacement
      const maxDisp = 5.0; // World units
      const ratio = this.tugBalance / this.targetPulls;
      this.world.setRopePosition(ratio * maxDisp);
    }

    // Streak and visual flash
    streakElem.textContent = team.streak > 1 ? `🔥 Combo x${team.streak}!` : `✨ Tepat!`;
    panel.classList.add('flash-correct');
    setTimeout(() => panel.classList.remove('flash-correct'), 300);

    // Show floating "+1 TARIKAN" banner over the team card
    this.showFloatingText(teamId, "+1 TARIKAN! 💪", "#55ff55");

    this.updateHUD();

    // Check Win Condition
    if (Math.abs(this.tugBalance) >= this.targetPulls) {
      this.endMatch(this.tugBalance < 0 ? 'A' : 'B');
      return;
    }

    // Advance to next question immediately
    team.currentIndex++;
    this.renderQuestion(teamId);
  }

  processWrongAnswer(teamId) {
    const team = (teamId === 'A') ? this.teamA : this.teamB;
    const panel = (teamId === 'A') ? this.panelTeamA : this.panelTeamB;
    const streakElem = (teamId === 'A') ? this.streakTeamA : this.streakTeamB;
    const overlay = (teamId === 'A') ? this.cooldownOverlayA : this.cooldownOverlayB;

    team.wrongCount++;
    team.streak = 0;
    streakElem.textContent = "❌ Meleset!";

    this.sound.playWrong();

    panel.classList.add('shake-wrong');
    setTimeout(() => panel.classList.remove('shake-wrong'), 400);

    this.showFloatingText(teamId, "SALAH! ⚠️", "#ff4444");

    // Fair Cooldown penalty: Lock buttons for 1.5 seconds to discourage blind guessing
    team.isLocked = true;
    overlay.classList.remove('hidden');
    overlay.innerHTML = `<span>⏳ TUNGGU 1.5s...</span>`;

    setTimeout(() => {
      team.isLocked = false;
      overlay.classList.add('hidden');
      // Advance to next question so they don't get stuck
      team.currentIndex++;
      this.renderQuestion(teamId);
    }, 1500);

    this.updateHUD();
  }

  showFloatingText(teamId, text, color) {
    const panel = (teamId === 'A') ? this.panelTeamA : this.panelTeamB;
    const floatEl = document.createElement('div');
    floatEl.className = 'mc-float-text';
    floatEl.style.color = color;
    floatEl.textContent = text;
    panel.appendChild(floatEl);

    setTimeout(() => {
      if (floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
    }, 900);
  }

  // --- HUD & TUG BAR UPDATE ---

  updateHUD() {
    this.hudTeamAScore.textContent = `${this.teamA.correctCount} Tarikan`;
    this.hudTeamBScore.textContent = `${this.teamB.correctCount} Tarikan`;

    // Calculate percent for the tug-of-war meter (-targetPulls to +targetPulls -> 0% to 100%)
    const fraction = (this.tugBalance + this.targetPulls) / (this.targetPulls * 2);
    const clampedPercent = Math.max(5, Math.min(95, fraction * 100));

    if (this.tugFlag) {
      this.tugFlag.style.left = `${clampedPercent}%`;
    }
  }

  // --- VICTORY & GAME OVER ---

  endMatch(winnerId) {
    this.gameState = 'VICTORY';
    this.winner = winnerId;
    if (this.timerInterval) clearInterval(this.timerInterval);

    const winnerName = (winnerId === 'A') ? this.teamA.name : this.teamB.name;
    const winnerTeam = (winnerId === 'A') ? this.teamA : this.teamB;

    this.sound.playVictory();
    if (this.world) {
      this.world.setVictory(winnerId);
    }

    // Populate Victory Modal
    document.getElementById('victoryTitle').textContent = `🏆 ${winnerName} MENANG! 🏆`;
    document.getElementById('victorySubtitle').textContent =
      `Hebat! Tim berhasil menguasai materi Ekosistem dan menarik tali hingga melewati garis kemenangan!`;

    document.getElementById('statWinnerPulls').textContent = `${winnerTeam.correctCount} tarikan benar`;
    document.getElementById('statTotalPulls').textContent = `${this.teamA.correctCount + this.teamB.correctCount}`;
    
    const accuracy = winnerTeam.correctCount + winnerTeam.wrongCount > 0
      ? Math.round((winnerTeam.correctCount / (winnerTeam.correctCount + winnerTeam.wrongCount)) * 100)
      : 100;
    document.getElementById('statAccuracy').textContent = `${accuracy}% Akurasi`;

    setTimeout(() => {
      this.modalVictory.classList.remove('hidden');
    }, 1200);
  }

  endMatchByTime() {
    let winnerId = null;
    if (this.tugBalance < 0) {
      winnerId = 'A';
    } else if (this.tugBalance > 0) {
      winnerId = 'B';
    } else {
      // Draw breaker: whichever has more correct answers
      winnerId = (this.teamA.correctCount >= this.teamB.correctCount) ? 'A' : 'B';
    }
    this.endMatch(winnerId);
  }

  // --- EDUCATIONAL REVIEW MODAL ---

  openReviewModal() {
    const listContainer = document.getElementById('reviewListContainer');
    listContainer.innerHTML = '';

    const allAnswered = [
      ...this.teamA.answeredHistory.map(item => ({ ...item, team: this.teamA.name })),
      ...this.teamB.answeredHistory.map(item => ({ ...item, team: this.teamB.name }))
    ];

    if (allAnswered.length === 0) {
      listContainer.innerHTML = `<p style="text-align:center; padding: 20px;">Belum ada soal yang dijawab pada sesi ini.</p>`;
    } else {
      allAnswered.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = `review-item ${item.isCorrect ? 'review-correct' : 'review-wrong'}`;

        card.innerHTML = `
          <div class="review-header">
            <span class="badge-cat">[${item.category}]</span>
            <span class="badge-team">${item.team} - ${item.isCorrect ? '✅ Benar' : '❌ Salah'}</span>
          </div>
          <div class="review-question"><strong>#${index + 1}.</strong> ${item.question}</div>
          <div class="review-details">
            <p><strong>Jawaban Tim:</strong> ${item.chosenAnswer}</p>
            <p><strong>Kunci Jawaban:</strong> <span style="color:#2ecc71;">${item.correctAnswer}</span></p>
            <div class="review-explanation"><strong>💡 Pembahasan IPAS:</strong> ${item.explanation}</div>
          </div>
        `;
        listContainer.appendChild(card);
      });
    }

    this.modalVictory.classList.add('hidden');
    this.modalReview.classList.remove('hidden');
  }
}

// Global Game Controller Instance
const game = new TugOfWarGame();
