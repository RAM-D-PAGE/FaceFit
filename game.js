/**
 * FaceFit v3.0 — Full Phase 1-4 Implementation
 *
 * Phase 1: TTS, Fuzzy Matching, High Contrast, One-hand Mode, Oro-motor Exercises
 * Phase 2: Adaptive Difficulty, Lip Symmetry, Phoneme Drilling, 5-Stage Progression, Streaks
 * Phase 3: Progress tracking, Session stats (feeds dashboard.html)
 * Phase 4: Claude AI Encouragement, Enhanced Speech Processing
 */

// ══════════════════════════════════════════════════════════════
// TOAST SYSTEM
// ══════════════════════════════════════════════════════════════
const toast = {
  show(msg, type = 'info', duration = 3000) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} toast-icon"></i><span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); el.addEventListener('animationend', () => el.remove()); }, duration);
  }
};

// ══════════════════════════════════════════════════════════════
// CONFETTI
// ══════════════════════════════════════════════════════════════
const confetti = {
  canvas: null, ctx: null, particles: [], running: false,
  colors: ['#FF6B6B', '#FFD166', '#4ECDC4', '#06D6A0', '#9B72CF', '#FF9F1C'],
  init() {
    this.canvas = document.getElementById('confetti-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize(); window.addEventListener('resize', () => this.resize());
  },
  resize() { if (this.canvas) { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; } },
  burst(count = 80) {
    if (!this.canvas) this.init();
    for (let i = 0; i < count; i++) this.particles.push({
      x: window.innerWidth / 2 + (Math.random() - .5) * 400, y: window.innerHeight * .35,
      vx: (Math.random() - .5) * 16, vy: Math.random() * -12 - 4,
      color: this.colors[Math.floor(Math.random() * this.colors.length)],
      size: Math.random() * 9 + 4, rotation: Math.random() * 360,
      rotSpeed: (Math.random() - .5) * 12, gravity: .35, opacity: 1,
      shape: Math.random() > .5 ? 'rect' : 'circle'
    });
    if (!this.running) this._tick();
  },
  _tick() {
    this.running = true;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.opacity > .01);
    this.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.rotation += p.rotSpeed; p.opacity -= .013;
      this.ctx.save(); this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.translate(p.x, p.y); this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;
      if (p.shape === 'rect') this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      else { this.ctx.beginPath(); this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); this.ctx.fill(); }
      this.ctx.restore();
    });
    if (this.particles.length > 0) requestAnimationFrame(() => this._tick());
    else { this.running = false; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  }
};

// ══════════════════════════════════════════════════════════════
// PHASE 1: TTS ENGINE
// ══════════════════════════════════════════════════════════════
const tts = {
  enabled: true,
  speak(text, onDone) {
    if (!this.enabled || !window.speechSynthesis) { if (onDone) onDone(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'th-TH'; utt.rate = 0.75; utt.pitch = 1.0; utt.volume = 1.0;
    // Try to find Thai voice
    const voices = window.speechSynthesis.getVoices();
    const thVoice = voices.find(v => v.lang.startsWith('th'));
    if (thVoice) utt.voice = thVoice;
    utt.onend = () => { if (onDone) onDone(); };
    utt.onerror = () => { if (onDone) onDone(); };
    window.speechSynthesis.speak(utt);
  },
  stop() { window.speechSynthesis?.cancel(); }
};

// ══════════════════════════════════════════════════════════════
// PHASE 1: FUZZY MATCHING (Levenshtein Distance)
// ══════════════════════════════════════════════════════════════
const fuzzy = {
  levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
    for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[m][n];
  },
  isSimilar(spoken, target, threshold = 0.45) {
    const a = spoken.replace(/\s+/g, '');
    const b = target.replace(/\s+/g, '');
    if (a === b) return true;
    if (a.includes(b) && a.length - b.length <= 6) return true;
    const dist = this.levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = 1 - dist / maxLen;
    return similarity >= threshold;
  },
  matchWord(spoken, targetWord, aliases = []) {
    if (this.isSimilar(spoken, targetWord)) return true;
    for (const alias of aliases) if (this.isSimilar(spoken, alias)) return true;
    // Also check if spoken contains any alias
    const s = spoken.replace(/\s+/g, '');
    for (const alias of aliases) {
      const a = alias.replace(/\s+/g, '');
      if (s.includes(a) && a.length >= 2) return true;
    }
    return false;
  }
};

// ══════════════════════════════════════════════════════════════
// PHASE 2: LIP SYMMETRY CALCULATOR
// ══════════════════════════════════════════════════════════════
const lipSymmetry = {
  calculate(landmarks) {
    // Compare left vs right facial landmarks symmetry
    // Left corner: 61, Right corner: 291
    // Upper lip left: 37, Upper lip right: 267
    // Lower lip left: 84, Lower lip right: 314
    try {
      const leftCorner = landmarks[61];
      const rightCorner = landmarks[291];
      const noseTip = landmarks[1]; // nose tip as center reference

      // How centered are the corners relative to nose?
      const leftDist = Math.abs(leftCorner.x - noseTip.x);
      const rightDist = Math.abs(rightCorner.x - noseTip.x);
      const minD = Math.min(leftDist, rightDist);
      const maxD = Math.max(leftDist, rightDist);
      if (maxD === 0) return 100;
      const ratio = minD / maxD; // 1.0 = perfect symmetry
      return Math.round(ratio * 100);
    } catch (e) { return 75; }
  }
};

// ══════════════════════════════════════════════════════════════
// PHASE 2: ADAPTIVE DIFFICULTY ENGINE
// ══════════════════════════════════════════════════════════════
const adaptive = {
  history: [], // last N results: true/false
  windowSize: 5,

  record(passed) {
    this.history.push(passed);
    if (this.history.length > this.windowSize) this.history.shift();
  },

  getSuccessRate() {
    if (!this.history.length) return 0.5;
    return this.history.filter(Boolean).length / this.history.length;
  },

  shouldIncrease() { return this.history.length >= 3 && this.getSuccessRate() >= 0.80; },
  shouldDecrease() { return this.history.length >= 3 && this.getSuccessRate() <= 0.35; },

  getSuggestedDifficulty(current) {
    const order = ['easy', 'normal', 'hard'];
    const idx = order.indexOf(current);
    if (this.shouldIncrease() && idx < 2) return order[idx + 1];
    if (this.shouldDecrease() && idx > 0) return order[idx - 1];
    return current;
  },

  reset() { this.history = []; }
};

// ══════════════════════════════════════════════════════════════
// PHASE 4: CLAUDE AI ENCOURAGEMENT
// ══════════════════════════════════════════════════════════════
const aiCoach = {
  async getEncouragement(context) {
    // context: { score, successRate, streak, patientName, difficulty, phase }
    try {
      const prompt = `คุณเป็นโค้ชฟื้นฟูการพูดที่อบอุ่นและเป็นกำลังใจ ให้คำชมสั้นๆ 1-2 ประโยคเป็นภาษาไทย สำหรับผู้ป่วย Stroke ที่เพิ่งฝึกพูดเสร็จ:
- ชื่อ: ${context.patientName || 'คุณ'}
- คะแนน: ${context.score}
- อัตราสำเร็จ: ${Math.round(context.successRate * 100)}%
- สายการฝึก: ${context.streak || 1} วัน
- ระดับ: ${context.difficulty}
ใช้ภาษาสุภาพ อบอุ่น ให้กำลังใจ ไม่เกิน 2 ประโยค ไม่ต้องใส่ emoji มากเกินไป`;

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.content?.[0]?.text?.trim() || null;
    } catch (e) { return null; }
  }
};

// ══════════════════════════════════════════════════════════════
// ORO-MOTOR EXERCISE DEFINITIONS (Phase 1)
// ══════════════════════════════════════════════════════════════
const oroMotorExercises = [
  {
    id: 'wide_open',
    name: 'อ้าปากกว้าง',
    icon: '😮',
    instruction: 'อ้าปากกว้างๆ ค้างไว้ 3 วินาที แล้วหุบปาก',
    detect: (state) => state.mouthOpenness > 55,
    holdSeconds: 3,
    reps: 5,
    color: '#FF6B6B'
  },
  {
    id: 'big_smile',
    name: 'ยิ้มกว้าง',
    icon: '😁',
    instruction: 'ฉีกยิ้มให้กว้างที่สุด ค้างไว้ 3 วินาที แล้วผ่อนคลาย',
    detect: (state) => state.smileWidth > 55,
    holdSeconds: 3,
    reps: 5,
    color: '#FFD166'
  },
  {
    id: 'pucker',
    name: 'ทำปากจู๋',
    icon: '😗',
    instruction: 'ทำปากจู๋ (จูบลม) ค้างไว้ 3 วินาที แล้วผ่อนคลาย',
    detect: (state) => state.puckerWidth > 40,
    holdSeconds: 3,
    reps: 5,
    color: '#9B72CF'
  },
  {
    id: 'alternating',
    name: 'อ้าปาก-ยิ้มสลับ',
    icon: '🔄',
    instruction: 'อ้าปากกว้าง แล้วฉีกยิ้ม สลับกัน 10 ครั้ง',
    detect: (state) => state.mouthOpenness > 40 || state.smileWidth > 40,
    holdSeconds: 1,
    reps: 10,
    color: '#4ECDC4'
  },
];

// ══════════════════════════════════════════════════════════════
// PHONEME DRILL DEFINITIONS (Phase 2)
// ══════════════════════════════════════════════════════════════
const phonemeDrills = {
  vowels: [
    { sound: 'อา', hint: 'อ้าปากกว้างๆ', action: 'open', aliases: ['อ้า', 'อา'] },
    { sound: 'อี', hint: 'ฉีกยิ้มกว้าง', action: 'smile', aliases: ['อี้', 'อิ'] },
    { sound: 'อู', hint: 'ทำปากจู๋', action: 'pucker', aliases: ['อู้'] },
    { sound: 'อึ', hint: 'อ้าปากแล้วออกเสียง อึ', action: 'open', aliases: ['อื'] },
    { sound: 'เอ', hint: 'ออกเสียง เ-อ', action: 'open', aliases: ['แอ'] },
    { sound: 'โอ', hint: 'ทำปากจู๋เล็กน้อย', action: 'open', aliases: ['โอ้'] },
  ],
  consonants: [
    { sound: 'กา', hint: 'ออกเสียง ก-อา', action: 'open', aliases: ['กาา', 'คา'] },
    { sound: 'ขา', hint: 'ออกเสียง ข-อา', action: 'open', aliases: ['ขาา', 'คา'] },
    { sound: 'ปา', hint: 'ออกเสียง ป-อา', action: 'open', aliases: ['ปาา', 'บา'] },
    { sound: 'มา', hint: 'ออกเสียง ม-อา', action: 'open', aliases: ['มาา', 'นา'] },
    { sound: 'นา', hint: 'ออกเสียง น-อา', action: 'open', aliases: ['นาา', 'มา'] },
    { sound: 'ตา', hint: 'ออกเสียง ต-อา', action: 'open', aliases: ['ตาา', 'ดา'] },
  ]
};

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
const app = {
  state: {
    currentScreen: 'screen-login',
    difficulty: 'normal',
    rehabPhase: 1,
    mode: 'speech',       // 'speech' | 'oro-motor' | 'phoneme'
    score: 0,
    currentRound: 1,
    maxRounds: 5,
    targetWord: '',
    completed: 0,
    skipped: 0,
    isListening: false,
    faceTracked: false,
    mouthOpenness: 0,
    smileWidth: 0,
    puckerWidth: 0,
    lipSymmetry: 75,
    expectedAction: 'open',
    faceMeshLoaded: false,
    cameraGranted: false,
    isCalibrating: false,
    calibMaxMouth: 0.05,
    calibMaxSmile: 0.10,
    calibMinSmile: undefined,
    calibTicks: 0,
    sessionHighScore: 0,
    sessionRounds: 0,
    highContrast: false,
    oneHandMode: false,
    ttsEnabled: true,
    sessionStartTime: null,
    wordResults: [],
    mouthOpenReadings: [],
    lipSymReadings: [],
    // Oro-motor specific
    currentExercise: null,
    exerciseRep: 0,
    holdTick: 0,
    isHolding: false,
    exerciseIdx: 0,
    peakActionVal: 0,
  },

  vocab: null,
  recognition: null,
  feedbackShowingSuccess: false,
  faceMesh: null,
  camera: null,
  els: {},

  // ── Init ──────────────────────────────────────────────────────────────────
  init() {
    confetti.init();
    this.els = {
      screens: document.querySelectorAll('.screen'),
      video: document.querySelector('.input_video'),
      canvas: document.getElementById('game_canvas'),
      ctx: document.getElementById('game_canvas')?.getContext('2d'),
      calibCanvas: document.getElementById('calib_canvas'),
      scoreText: document.getElementById('game-score'),
      roundText: document.getElementById('game-round'),
      roundDots: document.getElementById('round-dots'),
      targetWordText: document.getElementById('target-word'),
      taskInstruction: document.getElementById('task-instruction'),
      feedbackBox: document.getElementById('speech-feedback'),
      progressBar: document.getElementById('game-progress-bar'),
      progressText: document.getElementById('progress-text'),
      progressPct: document.getElementById('progress-pct'),
      lipBar: document.getElementById('lip-sym-bar'),
      lipPct: document.getElementById('lip-sym-pct'),
      loadingOverlay: document.getElementById('camera-loading'),
      listeningIndicator: document.getElementById('listening-indicator'),
      btnListen: document.getElementById('btn-listen'),
      sndSuccess: document.getElementById('snd-success'),
      sndCheer: document.getElementById('snd-cheer'),
    };

    // Load accessibility preferences
    if (localStorage.getItem('ff_highContrast') === '1') this.toggleHighContrast(true, true);
    if (localStorage.getItem('ff_oneHand') === '1') this.toggleOneHand(true, true);
    if (localStorage.getItem('ff_tts') === '0') { tts.enabled = false; this.state.ttsEnabled = false; }

    window.addEventListener('resize', () => this.resizeCanvas());
    this.showScreen('screen-login');
    this.loadOfflineVocab();
    this.initSpeechAPI();
  },

  loadOfflineVocab() {
    this.vocab = {
      easy: [
        { word: 'อา', hint: 'อ้าปากกว้างๆ ให้สุด', action: 'open', phase: 2, phonemes: ['อ', 'า'], aliases: ['อ้า', 'หา'] },
        { word: 'อี', hint: 'ฉีกยิ้มกว้างๆ', action: 'smile', phase: 2, phonemes: ['อ', 'ี'], aliases: ['อี้'] },
        { word: 'อู', hint: 'ทำปากจู๋', action: 'pucker', phase: 2, phonemes: ['อ', 'ู'], aliases: ['อู้'] },
        { word: 'ตา', hint: 'อ้าปากออกเสียง ต-อา', action: 'open', phase: 2, phonemes: ['ต', 'า'], aliases: ['ต้า', 'จา'] },
        { word: 'มา', hint: 'อ้าปากออกเสียง ม-อา', action: 'open', phase: 2, phonemes: ['ม', 'า'], aliases: ['ม้า', 'นา'] },
        { word: 'ดี', hint: 'ฉีกยิ้ม ออกเสียง ด-ี', action: 'smile', phase: 2, phonemes: ['ด', 'ี'], aliases: ['ดิ', 'บี', 'ตี'] },
        { word: 'ปลา', hint: 'อ้าปากออกเสียง ป-ล-า', action: 'open', phase: 2, phonemes: ['ป', 'ล', 'า'], aliases: ['ปา', 'ป้า'] },
      ],
      normal: [
        { word: 'กินข้าว', hint: 'พูดเสียงดังฟังชัด', action: 'open', phase: 4, phonemes: ['ก', 'ข', 'า', 'ว'], aliases: ['กินคาว', 'กิงข้าว'] },
        { word: 'หิวน้ำ', hint: 'พูดเสียงดังฟังชัด', action: 'open', phase: 4, phonemes: ['ห', 'น', 'ำ'], aliases: ['หิวหนำ', 'ฮิวน้ำ'] },
        { word: 'สบาย', hint: 'ฉีกยิ้ม ออกเสียง สะ-บาย', action: 'smile', phase: 4, phonemes: ['ส', 'บ', 'า', 'ย'], aliases: ['สะบาย', 'ซะบาย'] },
        { word: 'รักนะ', hint: 'ฉีกยิ้มขณะพูด', action: 'smile', phase: 4, phonemes: ['ร', 'น', 'ะ'], aliases: ['ลักนะ', 'ลักน่ะ'] },
        { word: 'สวัสดี', hint: 'พูดชัดแต่ละพยางค์', action: 'smile', phase: 4, phonemes: ['ส', 'ด', 'ี'], aliases: ['สะหวัดดี', 'สวัดดี'] },
        { word: 'ขอบคุณ', hint: 'พูดเสียงดัง ขอบ-คุณ', action: 'open', phase: 4, phonemes: ['ข', 'บ', 'ค', 'ณ'], aliases: ['คอบคุน', 'ขอบคุ'] },
        { word: 'ไปไหน', hint: 'พูดเสียงดัง ไป-ไหน', action: 'open', phase: 4, phonemes: ['ป', 'น'], aliases: ['ไปไน', 'อัยไหน'] },
      ],
      hard: [
        { word: 'กินข้าวอิ่มแล้ว', hint: 'พูดประโยคให้ต่อเนื่อง', action: 'open', phase: 5, aliases: ['กินข้าวอิมแล้ว', 'กินข้าวอิ่มละ'] },
        { word: 'วันนี้อากาศดี', hint: 'พูดให้ต่อเนื่อง ฉีกยิ้มตอนคำว่า ดี', action: 'smile', phase: 5, aliases: ['วันนีอากาดดี', 'วันนี้อากาสดี'] },
        { word: 'สบายดีไหมครับ', hint: 'พูดให้ต่อเนื่อง', action: 'smile', phase: 5, aliases: ['สบายดีไหม', 'สะบายดีมัย'] },
        { word: 'พรุ่งนี้ไปเที่ยว', hint: 'พูดให้ต่อเนื่อง', action: 'smile', phase: 5, aliases: ['พุ่งนี้ไปเทียว', 'พรุ่งนีไปเที่ยว'] },
        { word: 'ขอบคุณมากค่ะ', hint: 'พูดให้ต่อเนื่อง', action: 'open', phase: 5, aliases: ['คอบคุนมาก', 'ขอบคุณมาก'] },
      ]
    };
  },

  async loadOnlineVocab() {
    if (window.db) {
      const v = await window.db.getVocabulary();
      if (v) { this.vocab = v; }
    }
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  async doLogin() {
    const pin = document.getElementById('login-pin').value.trim();
    const errDiv = document.getElementById('login-error');
    errDiv.style.display = 'none';
    if (!pin) { errDiv.innerText = 'กรุณากรอกรหัส PIN'; errDiv.style.display = 'block'; return; }

    const btn = document.querySelector('#screen-login .btn-primary');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
    btn.disabled = true;

    if (window.db) {
      const user = await window.db.login(pin);
      if (user) {
        await this.loadOnlineVocab();
        this.finishLogin(user.name);
      } else {
        errDiv.innerText = 'รหัส PIN ไม่ถูกต้อง หรือระบบขัดข้อง';
        errDiv.style.display = 'block';
      }
    } else {
      errDiv.innerText = 'ไม่พบเชื่อมต่อ DB'; errDiv.style.display = 'block';
    }
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ';
    btn.disabled = false;
  },

  async skipLogin() {
    if (window.db) window.db.logout();
    await this.loadOnlineVocab();
    this.finishLogin('บุคคลทั่วไป');
  },

  finishLogin(name) {
    const chip = document.getElementById('home-welcome-chip');
    if (chip) chip.innerHTML = `<i class="fa-solid fa-hand-wave"></i> สวัสดี, ${name}`;
    this.showScreen('screen-home');
    this.initMediaPipe();
    this._refreshHomeStats();
  },

  _refreshHomeStats() {
    const streak = window.db?.profile?.streak_days || 0;
    const best = window.db?.profile?.best_score || 0;
    const total = window.db?.profile?.total_sessions || 0;
    const phase = window.db?.profile?.rehab_phase || 1;
    const el = (id) => document.getElementById(id);
    if (el('home-stat-streak')) el('home-stat-streak').innerText = streak || '—';
    if (el('home-stat-score')) el('home-stat-score').innerText = best || '—';
    if (el('home-stat-sessions')) el('home-stat-sessions').innerText = total || '—';
    if (el('home-stat-phase')) el('home-stat-phase').innerText = `ระยะที่ ${phase}`;
    if (el('home-phase-bar')) el('home-phase-bar').style.width = `${(phase / 5) * 100}%`;
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  async doAdminLogin() {
    const user = document.getElementById('admin-user').value;
    const pass = document.getElementById('admin-pass').value;
    const errDiv = document.getElementById('admin-error');
    errDiv.style.display = 'none';
    if (!user || !pass) { errDiv.innerText = 'กรุณากรอกข้อมูลให้ครบ'; errDiv.style.display = 'block'; return; }

    const btn = document.querySelector('#screen-admin-login .btn-warning');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    if (window.db) {
      const ok = await window.db.adminLogin(user, pass);
      if (ok) { toast.show('เข้าสู่ระบบแอดมินสำเร็จ', 'success'); this.loadAdminDash(); }
      else { errDiv.innerText = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'; errDiv.style.display = 'block'; }
    }
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ'; btn.disabled = false;
  },

  adminLogout() {
    if (window.db) window.db.logout();
    toast.show('ออกจากระบบแล้ว', 'info');
    this.showScreen('screen-home');
  },

  async loadAdminDash() {
    this.showScreen('screen-admin-dash');
    if (!window.db) return;
    const patients = await window.db.getPatientsList();
    const ptBody = document.querySelector('#admin-patients-table tbody');
    ptBody.innerHTML = '';
    if (patients?.length) {
      patients.forEach(pt => {
        const phase = pt.profile?.rehab_phase || '—';
        const sym = pt.profile?.avg_lip_symmetry?.toFixed(0) || '—';
        const streak = pt.profile?.streak_days || 0;
        ptBody.innerHTML += `<tr>
          <td><strong>${pt.name}</strong></td>
          <td><code>${pt.pin}</code></td>
          <td>${pt.totalPlaySessions} รอบ</td>
          <td>ระยะที่ ${phase}</td>
          <td>${sym}%</td>
          <td>${streak} วัน 🔥</td>
          <td>
            <button class="btn btn-teal btn-sm" onclick="app.openPatientDetail('${pt.id}','${pt.name}')"><i class="fa-solid fa-chart-line"></i></button>
            <button class="btn btn-danger btn-sm" onclick="app.adminDeletePatient('${pt.id}')"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>`;
      });
    } else {
      ptBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text-hint);">ยังไม่มีผู้ป่วย</td></tr>';
    }

    const vocab = await window.db.getAllVocabRaw();
    const vBody = document.querySelector('#admin-vocab-table tbody');
    vBody.innerHTML = '';
    if (vocab?.length) {
      const diffNames = { easy: 'ง่าย', normal: 'ปานกลาง', hard: 'ยาก' };
      vocab.forEach(v => {
        const aliases = Array.isArray(v.aliases) ? v.aliases.join(', ') : '';
        vBody.innerHTML += `<tr>
          <td>${diffNames[v.difficulty] || v.difficulty}</td>
          <td><strong>${v.word}</strong></td>
          <td>${v.hint}</td>
          <td>${v.action === 'smile' ? 'ฉีกยิ้ม' : v.action === 'pucker' ? 'ปากจู๋' : 'อ้าปาก'}</td>
          <td><small>${aliases}</small></td>
          <td><button class="btn btn-danger btn-sm" onclick="app.adminDeleteVocab(${v.id})"><i class="fa-solid fa-trash"></i></button></td>
        </tr>`;
      });
    }
  },

  openPatientDetail(patientId, patientName) {
    // Navigate to dashboard page
    window.open(`dashboard.html?pid=${patientId}&name=${encodeURIComponent(patientName)}`, '_blank');
  },

  async adminAddPatient() {
    const name = document.getElementById('new-patient-name').value.trim();
    const pin = document.getElementById('new-patient-pin').value.trim();
    if (!name || !pin) { toast.show('กรุณาใส่ชื่อและ PIN', 'warning'); return; }
    const ok = await window.db.addPatient(name, pin);
    if (ok) {
      document.getElementById('new-patient-name').value = '';
      document.getElementById('new-patient-pin').value = '';
      toast.show(`เพิ่มผู้ป่วย "${name}" สำเร็จ`, 'success');
      this.loadAdminDash();
    } else { toast.show('ไม่สามารถเพิ่มได้ (PIN อาจซ้ำ)', 'error'); }
  },

  async adminDeletePatient(id) {
    if (!confirm('ลบข้อมูลผู้ป่วยและประวัติทั้งหมดใช่หรือไม่?')) return;
    const ok = await window.db.deletePatient(id);
    if (ok) { toast.show('ลบสำเร็จ', 'success'); this.loadAdminDash(); }
    else toast.show('ไม่สามารถลบได้', 'error');
  },

  async adminAddVocab() {
    const word = document.getElementById('new-vocab-word').value.trim();
    const hint = document.getElementById('new-vocab-hint').value.trim();
    const action = document.getElementById('new-vocab-action').value;
    const diff = document.getElementById('new-vocab-diff').value;
    const phase = parseInt(document.getElementById('new-vocab-phase').value) || 3;
    const aliases = document.getElementById('new-vocab-aliases').value.trim();
    if (!word || !hint) { toast.show('กรุณาใส่คำศัพท์และคำแนะนำ', 'warning'); return; }
    const ok = await window.db.addVocab(word, hint, action, diff, aliases, phase);
    if (ok) {
      ['new-vocab-word', 'new-vocab-hint', 'new-vocab-aliases'].forEach(id => document.getElementById(id).value = '');
      toast.show(`เพิ่มคำว่า "${word}" สำเร็จ`, 'success');
      this.loadAdminDash();
    } else toast.show('ไม่สามารถเพิ่มคำศัพท์ได้', 'error');
  },

  async adminDeleteVocab(id) {
    if (!confirm('ลบคำศัพท์นี้ใช่หรือไม่?')) return;
    const ok = await window.db.deleteVocab(id);
    if (ok) { toast.show('ลบสำเร็จ', 'success'); this.loadAdminDash(); }
    else toast.show('ไม่สามารถลบได้', 'error');
  },

  // ── Accessibility Toggles (Phase 1) ──────────────────────────────────────
  toggleHighContrast(force, silent) {
    const on = (force !== undefined) ? force : !this.state.highContrast;
    this.state.highContrast = on;
    document.body.classList.toggle('high-contrast', on);
    localStorage.setItem('ff_highContrast', on ? '1' : '0');
    const btn = document.getElementById('btn-high-contrast');
    if (btn) btn.innerHTML = on ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-circle-half-stroke"></i>';
    if (!silent) toast.show(on ? 'เปิด High Contrast Mode' : 'ปิด High Contrast Mode', 'info', 2000);
  },

  toggleOneHand(force, silent) {
    const on = (force !== undefined) ? force : !this.state.oneHandMode;
    this.state.oneHandMode = on;
    document.body.classList.toggle('one-hand', on);
    localStorage.setItem('ff_oneHand', on ? '1' : '0');
    if (!silent) toast.show(on ? 'เปิด One-hand Mode' : 'ปิด One-hand Mode', 'info', 2000);
  },

  toggleTTS() {
    tts.enabled = !tts.enabled;
    this.state.ttsEnabled = tts.enabled;
    localStorage.setItem('ff_tts', tts.enabled ? '1' : '0');
    const btn = document.getElementById('btn-tts');
    if (btn) btn.innerHTML = tts.enabled
      ? '<i class="fa-solid fa-volume-high"></i>'
      : '<i class="fa-solid fa-volume-xmark"></i>';
    toast.show(tts.enabled ? 'เปิดเสียงอ่านคำ' : 'ปิดเสียงอ่านคำ', 'info', 2000);
  },

  // ── Speech API ────────────────────────────────────────────────────────────
  initSpeechAPI() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { return; }
    this.recognition = new SR();
    this.recognition.lang = 'th-TH';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.state.isListening = true;
      if (this.els.listeningIndicator) this.els.listeningIndicator.style.display = 'flex';
      if (this.els.btnListen) {
        this.els.btnListen.disabled = true;
        this.els.btnListen.classList.add('listening');
        this.els.btnListen.innerHTML = '<i class="fa-solid fa-circle-stop"></i> กำลังฟัง...';
      }
      this.setFeedback('🎤 กำลังฟังเสียง... พูดได้เลย!', 'default');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().replace(/\s+/g, '');
      const confidence = event.results[0][0].confidence;
      console.log(`Recognized: "${transcript}" (${(confidence * 100).toFixed(0)}%)`);
      this.handleSpeechResult(transcript);
    };

    this.recognition.onerror = (event) => {
      if (event.error === 'no-speech') this.setFeedback('ไม่ได้ยินเสียง กรุณาลองใหม่ 🎙️', 'error');
      else if (event.error === 'network') this.setFeedback('การเชื่อมต่อขัดข้อง ลองใช้เน็ตมือถือ หรือกด "ข้ามคำนี้"', 'error');
      else this.setFeedback('เกิดข้อผิดพลาดของไมค์ กรุณาลองใหม่', 'error');
    };

    this.recognition.onend = () => {
      this.state.isListening = false;
      if (this.els.listeningIndicator) this.els.listeningIndicator.style.display = 'none';
      if (this.els.btnListen) {
        this.els.btnListen.disabled = false;
        this.els.btnListen.classList.remove('listening');
        this.els.btnListen.innerHTML = '<i class="fa-solid fa-microphone"></i> กดเพื่อพูด';
      }
      if (!this.feedbackShowingSuccess) {
        setTimeout(() => {
          if (!this.state.isListening && !this.feedbackShowingSuccess)
            this.setFeedback('กดปุ่มไมโครโฟนเพื่อพูดอีกครั้ง', 'default');
        }, 1800);
      }
    };
  },

  startListening() {
    if (!this.recognition) { toast.show('เบราว์เซอร์ไม่รองรับไมค์ (ใช้ Chrome)', 'error'); return; }
    if (this.state.isListening) return;
    try { this.recognition.start(); } catch (e) { console.warn(e); }
  },

  handleSpeechResult(spokenWord) {
    const currentItem = this.vocab[this.state.difficulty]?.find(v => v.word === this.state.targetWord);
    const aliases = currentItem?.aliases || [];
    const isMatch = fuzzy.matchWord(spokenWord, this.state.targetWord, aliases);

    if (isMatch) {
      const threshold = 30; // 30% motion threshold (adjust as needed)
      if (this.state.peakActionVal >= threshold) {
        adaptive.record(true);
        this.wordSuccess(spokenWord);
      } else {
        // Speech recognized but movement was too small
        this.setFeedback(`ออกเสียงถูกแล้ว! แต่<strong>ช่วยขยับปาก/ยิ้มให้กว้างขึ้นอีกนิด</strong> (ต้องกว้างพอสมควรนะ ✨)`, 'warning');
        // We don't call adaptive.record(true) yet, let them try again for 'Perfect'
      }
    } else {
      adaptive.record(false);
      this.setFeedback(`คุณพูดว่า "<strong>${spokenWord}</strong>" — ลองใหม่นะครับ 💪`, 'error');
    }
  },

  wordSuccess(spokenStr) {
    this.feedbackShowingSuccess = true;
    this.playSound('snd-success');
    confetti.burst(55);

    const actionVal = this.state.expectedAction === 'smile' ? this.state.smileWidth
      : this.state.expectedAction === 'pucker' ? this.state.puckerWidth : this.state.mouthOpenness;

    let bonus = 0;
    if (this.state.difficulty === 'easy' && actionVal > 40) bonus = 5;
    if (this.state.difficulty === 'normal' && actionVal > 30) bonus = 3;
    if (this.state.difficulty === 'hard' && actionVal > 25) bonus = 4;

    const pts = 10 + bonus;
    this.state.score += pts;
    this.state.completed += 1;

    // Record word result
    const currentItem = this.vocab[this.state.difficulty]?.find(v => v.word === this.state.targetWord);
    this.state.wordResults.push({
      word: this.state.targetWord, passed: true, spoken: spokenStr,
      mouthOpenness: Math.round(actionVal),
      lipSymmetry: Math.round(this.state.lipSymmetry),
      phonemes: currentItem?.phonemes || []
    });

    this._updateRoundDots(this.state.currentRound - 1, 'done');
    const bonusMsg = bonus > 0 ? `<br><small style="color:var(--gold-dark)">✨ โบนัส +${bonus} แต้ม!</small>` : '';
    this.setFeedback(`🎉 ยอดเยี่ยม! พูดคำว่า "<strong>${spokenStr}</strong>" ถูกต้อง!${bonusMsg}`, 'success');
    toast.show(`+${pts} แต้ม! 🌟`, 'success', 1800);
    this.updateUI();

    // Check adaptive difficulty
    const suggested = adaptive.getSuggestedDifficulty(this.state.difficulty);
    if (suggested !== this.state.difficulty) {
      const msg = suggested === 'hard' ? 'เก่งมาก! ปรับระดับขึ้น 🚀' : 'ลองระดับที่เหมาะสมกว่า';
      setTimeout(() => toast.show(msg, 'info', 2500), 1500);
      this.state.difficulty = suggested;
    }

    setTimeout(() => {
      this.feedbackShowingSuccess = false;
      this.state.currentRound++;
      if (this.state.currentRound > this.state.maxRounds) this.endGame();
      else this.nextWord();
    }, 2600);
  },

  skipWord() {
    this.state.skipped += 1;
    adaptive.record(false);
    const currentItem = this.vocab[this.state.difficulty]?.find(v => v.word === this.state.targetWord);
    this.state.wordResults.push({
      word: this.state.targetWord, passed: false, spoken: '(ข้าม)',
      phonemes: currentItem?.phonemes || []
    });
    this._updateRoundDots(this.state.currentRound - 1, 'skip');
    this.setFeedback('ไม่เป็นไรครับ ข้ามคำนี้ก่อนนะ ✌️', 'warning');
    this.state.currentRound++;
    setTimeout(() => {
      if (this.state.currentRound > this.state.maxRounds) this.endGame();
      else this.nextWord();
    }, 1400);
  },

  // ── ORO-MOTOR MODE (Phase 1) ───────────────────────────────────────────────
  startOroMotor() {
    this.state.mode = 'oro-motor';
    this.state.score = 0; this.state.currentRound = 1;
    this.state.completed = 0; this.state.skipped = 0;
    this.state.wordResults = [];
    this.state.exerciseIdx = 0;
    this.state.maxRounds = oroMotorExercises.length;
    this.state.sessionStartTime = Date.now();
    this._ensureCamera(() => {
      this.showScreen('screen-game');
      this._buildRoundDots();
      this.nextOroMotorExercise();
    });
  },

  nextOroMotorExercise() {
    const ex = oroMotorExercises[this.state.exerciseIdx % oroMotorExercises.length];
    this.state.currentExercise = ex;
    this.state.exerciseRep = 0;
    this.state.holdTick = 0;
    this.state.isHolding = false;

    if (this.els.targetWordText) {
      this.els.targetWordText.style.fontSize = '2.2rem';
      this.els.targetWordText.innerText = `${ex.icon} ${ex.name}`;
    }
    if (this.els.taskInstruction) this.els.taskInstruction.innerText = ex.instruction;
    this.setFeedback(`ทำซ้ำ ${ex.reps} ครั้ง — เมื่อทำสำเร็จแต่ละครั้ง ระบบจะนับให้อัตโนมัติ`, 'default');
    this.updateUI();

    // Hide mic button, show progress
    if (this.els.btnListen) this.els.btnListen.style.display = 'none';
    const skipBtn = document.getElementById('btn-skip');
    if (skipBtn) skipBtn.style.display = 'inline-flex';
  },

  processOroMotorFrame() {
    const ex = this.state.currentExercise;
    if (!ex || !this.state.faceTracked) return;

    const detected = ex.detect(this.state);
    if (detected && !this.state.isHolding) {
      this.state.isHolding = true;
      this.state.holdTick = 0;
    }
    if (this.state.isHolding) {
      this.state.holdTick++;
      const holdNeeded = ex.holdSeconds * 10; // ~10fps
      const holdPct = Math.min(100, (this.state.holdTick / holdNeeded) * 100);
      if (this.els.progressBar) this.els.progressBar.style.width = `${holdPct}%`;
      if (this.els.progressText) this.els.progressText.innerText = `ค้างไว้ ${(this.state.holdTick / 10).toFixed(1)}/${ex.holdSeconds}s`;

      if (this.state.holdTick >= holdNeeded) {
        this.state.exerciseRep++;
        this.state.holdTick = 0;
        this.state.isHolding = false;
        const remaining = ex.reps - this.state.exerciseRep;
        if (this.els.progressText) this.els.progressText.innerText = `ทำสำเร็จ ${this.state.exerciseRep}/${ex.reps} ครั้ง!`;

        if (this.state.exerciseRep >= ex.reps) {
          // Exercise complete!
          this.state.score += 15;
          this.state.completed++;
          confetti.burst(40);
          this.setFeedback(`✅ ทำครบ ${ex.reps} ครั้งแล้ว! ยอดเยี่ยมมาก!`, 'success');
          toast.show(`${ex.icon} ${ex.name} — เสร็จสมบูรณ์! +15 แต้ม`, 'success', 2000);
          this.updateUI();
          this._updateRoundDots(this.state.currentRound - 1, 'done');
          this.state.currentRound++;
          this.state.exerciseIdx++;
          setTimeout(() => {
            if (this.state.exerciseIdx >= oroMotorExercises.length) this.endGame();
            else this.nextOroMotorExercise();
          }, 2000);
        } else {
          this.setFeedback(`ดีมาก! อีก ${remaining} ครั้ง`, 'default');
          if (this.els.progressBar) this.els.progressBar.style.width = `0%`;
        }
      }
    }
    if (!detected && this.state.isHolding && this.state.holdTick > 0) {
      this.state.holdTick = Math.max(0, this.state.holdTick - 2);
      if (this.state.holdTick === 0) this.state.isHolding = false;
    }
  },

  // ── PHONEME DRILL MODE (Phase 2) ───────────────────────────────────────────
  startPhonemeDrill(type = 'vowels') {
    this.state.mode = 'phoneme';
    this.state.score = 0; this.state.currentRound = 1;
    this.state.completed = 0; this.state.skipped = 0;
    this.state.wordResults = [];
    const drills = phonemeDrills[type] || phonemeDrills.vowels;
    // Override vocab for this session
    this._phonemeDrillList = drills;
    this.state.maxRounds = drills.length;
    this.state.sessionStartTime = Date.now();
    this._ensureCamera(() => {
      this.showScreen('screen-game');
      this._buildRoundDots();
      if (this.els.btnListen) this.els.btnListen.style.display = 'inline-flex';
      this.nextPhonemeDrill();
    });
  },

  nextPhonemeDrill() {
    const drill = this._phonemeDrillList[this.state.currentRound - 1];
    if (!drill) { this.endGame(); return; }
    this.state.targetWord = drill.sound;
    this.state.expectedAction = drill.action;
    this.updateUI();
    this.setFeedback('กดปุ่มไมโครโฟน แล้วออกเสียงให้ชัด', 'default');
    this._animateWordIn(drill.sound);
    if (this.els.taskInstruction) this.els.taskInstruction.innerText = drill.hint;
    tts.speak(drill.sound);
  },

  // ── MAIN GAME FLOW ────────────────────────────────────────────────────────
  startGame(difficulty) {
    this.state.mode = 'speech';
    this.state.difficulty = difficulty;
    this.state.score = 0; this.state.currentRound = 1;
    this.state.completed = 0; this.state.skipped = 0;
    this.state.wordResults = []; this.state.mouthOpenReadings = []; this.state.lipSymReadings = [];
    this.state.sessionStartTime = Date.now();
    adaptive.reset();

    this.state.calibMaxMouth = 0.05; this.state.calibMaxSmile = 0.10; this.state.calibMinSmile = undefined;
    document.getElementById('calib-progress-bar').style.width = '0%';
    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = 'มองกล้องให้เห็นหน้าชัดเจน'; instr.className = 'calib-status-text text-teal'; }
    const btnC = document.getElementById('btn-calib-action');
    if (btnC) btnC.style.display = 'none';
    this.state.faceMeshLoaded = false;
    document.querySelectorAll('.camera-overlay').forEach(el => el.style.display = 'flex');

    this._ensureCamera(() => this.showScreen('screen-calibration'));
  },

  _ensureCamera(cb) {
    if (this.state.cameraGranted) { cb(); return; }
    document.getElementById('calib-loading').style.display = 'flex';
    this.camera.start()
      .then(() => { this.state.cameraGranted = true; cb(); })
      .catch(err => {
        toast.show('กรุณาอนุญาตให้ใช้กล้องและไมโครโฟน', 'error', 6000);
        console.error(err);
      });
  },

  doCalibrationAction() {
    this.state.isCalibrating = true; this.state.calibTicks = 0;
    this.state.calibMaxMouth = 0; this.state.calibMaxSmile = 0;
    document.getElementById('btn-calib-action').style.display = 'none';
    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = '🎯 กำลังบันทึก... อ้าปากกว้างๆ สลับฉีกยิ้ม!'; instr.className = 'calib-status-text text-coral'; }
  },

  finishCalibration() {
    this.state.isCalibrating = false;
    if (this.state.calibMaxMouth < 0.03) this.state.calibMaxMouth = 0.05;
    if (this.state.calibMaxSmile < 0.08) this.state.calibMaxSmile = 0.12;
    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = '✅ บันทึกค่าสำเร็จ! ระบบพร้อมแล้ว'; instr.className = 'calib-status-text text-mint'; }
    toast.show('ปรับเทียบกล้องสำเร็จ! 🎉', 'success', 2000);
    setTimeout(() => {
      this.showScreen('screen-game');
      this._buildRoundDots();
      if (this.els.btnListen) this.els.btnListen.style.display = 'inline-flex';
      this.nextWord();
    }, 1500);
  },

  nextWord() {
    this.updateUI();
    this.state.peakActionVal = 0; // Reset peak action for new word
    this.setFeedback('กดปุ่มไมโครโฟนแล้วพูดให้ชัดเจน 🎤', 'default');

    const wordList = this.vocab[this.state.difficulty];
    const item = wordList[Math.floor(Math.random() * wordList.length)];
    this.state.targetWord = item.word;
    this.state.expectedAction = item.action || 'open';
    if (this.els.taskInstruction) this.els.taskInstruction.innerText = item.hint;
    this._animateWordIn(item.word);
    this._updateRoundDots(this.state.currentRound - 1, 'active');

    // TTS read the word aloud after brief delay
    setTimeout(() => tts.speak(item.word), 400);
  },

  _animateWordIn(word) {
    const el = this.els.targetWordText;
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0'; el.style.transform = 'scale(0.7)';
    el.style.fontSize = '3.2rem';
    setTimeout(() => {
      el.innerText = word;
      el.style.transition = 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      el.style.opacity = '1'; el.style.transform = 'scale(1)';
    }, 120);
  },

  async endGame() {
    if (this.state.isListening) try { this.recognition.stop(); } catch (e) { }
    tts.stop();

    const durationSec = Math.round((Date.now() - (this.state.sessionStartTime || Date.now())) / 1000);
    const successRate = this.state.completed / Math.max(1, this.state.completed + this.state.skipped);
    const avgMouth = this.state.mouthOpenReadings.length
      ? this.state.mouthOpenReadings.reduce((a, b) => a + b, 0) / this.state.mouthOpenReadings.length : 50;
    const avgSym = this.state.lipSymReadings.length
      ? this.state.lipSymReadings.reduce((a, b) => a + b, 0) / this.state.lipSymReadings.length : 75;

    this.state.sessionRounds++;
    if (this.state.score > this.state.sessionHighScore) this.state.sessionHighScore = this.state.score;

    // Save to DB
    if (window.db?.patient) {
      await window.db.saveSession({
        phase: this.state.rehabPhase,
        difficulty: this.state.difficulty,
        score: this.state.score,
        successRate: successRate * 100,
        avgMouthOpenness: Math.round(avgMouth),
        avgLipSymmetry: Math.round(avgSym),
        durationSeconds: durationSec,
        wordResults: this.state.wordResults
      });
    }

    this.showScreen('screen-result');
    this.playSound('snd-cheer');
    setTimeout(() => confetti.burst(100), 300);

    document.getElementById('res-score').innerText = this.state.score;
    document.getElementById('res-completed').innerHTML = `${this.state.completed} <small>คำ</small>`;
    document.getElementById('res-skipped').innerHTML = `${this.state.skipped} <small>คำ</small>`;
    document.getElementById('res-symmetry').innerText = `${Math.round(avgSym)}%`;
    document.getElementById('res-duration').innerText = `${Math.floor(durationSec / 60)}:${String(durationSec % 60).padStart(2, '0')}`;

    // Star rating
    const stars = successRate >= .8 ? 3 : successRate >= .5 ? 2 : 1;
    const starsEl = document.getElementById('res-stars');
    if (starsEl) starsEl.innerHTML = Array.from({ length: 3 }, (_, i) =>
      `<i class="fa-solid fa-star" style="color:${i < stars ? 'var(--gold-dark)' : '#ddd'};font-size:2rem;"></i>`
    ).join('');

    // AI Encouragement (Phase 4)
    const aiEl = document.getElementById('res-ai-message');
    if (aiEl && window.db?.patient) {
      aiEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI กำลังเตรียมข้อความ...';
      const msg = await aiCoach.getEncouragement({
        patientName: window.db.patient?.name,
        score: this.state.score,
        successRate,
        streak: window.db.profile?.streak_days || 1,
        difficulty: this.state.difficulty,
        phase: this.state.rehabPhase
      });
      aiEl.innerHTML = msg
        ? `<i class="fa-solid fa-robot" style="color:var(--teal);"></i> ${msg}`
        : `<i class="fa-solid fa-heart" style="color:var(--coral);"></i> ทำได้ดีมากครับ ขอบคุณที่ฝึกวันนี้!`;
    }

    this._refreshHomeStats();
  },

  endGameForce() {
    if (confirm('ต้องการจบเกมทันทีหรือไม่?')) this.endGame();
  },

  // ── MediaPipe ─────────────────────────────────────────────────────────────
  initMediaPipe() {
    if (!window.FaceMesh) return;
    this.faceMesh = new FaceMesh({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
    });
    this.faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: .6, minTrackingConfidence: .6 });
    this.faceMesh.onResults(r => this.onFaceMeshResults(r));

    this.camera = new Camera(this.els.video, {
      onFrame: async () => {
        if (['screen-game', 'screen-calibration'].includes(this.state.currentScreen))
          await this.faceMesh.send({ image: this.els.video });
      },
      width: 640, height: 480
    });
  },

  onFaceMeshResults(results) {
    if (!this.state.faceMeshLoaded) {
      this.state.faceMeshLoaded = true;
      document.querySelectorAll('.camera-overlay').forEach(el => el.style.display = 'none');
      if (this.state.currentScreen === 'screen-calibration') {
        const btn = document.getElementById('btn-calib-action');
        if (btn) btn.style.display = 'inline-flex';
      }
    }

    const isCalib = this.state.currentScreen === 'screen-calibration';
    const canvas = isCalib ? document.getElementById('calib_canvas') : this.els.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks?.length > 0) {
      this.state.faceTracked = true;
      const lm = results.multiFaceLandmarks[0];

      drawConnectors(ctx, lm, FACEMESH_LIPS, { color: 'rgba(78,205,196,0.9)', lineWidth: 2 });

      // Mouth openness
      const dy = lm[13].y - lm[14].y, dx = lm[13].x - lm[14].x;
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Smile width
      const sx = lm[61].x - lm[291].x, sy = lm[61].y - lm[291].y;
      const sDist = Math.sqrt(sx * sx + sy * sy);

      if (this.state.isCalibrating) {
        if (dist > this.state.calibMaxMouth) this.state.calibMaxMouth = dist;
        if (sDist > this.state.calibMaxSmile) this.state.calibMaxSmile = sDist;
        if (!this.state.calibMinSmile || sDist < this.state.calibMinSmile) this.state.calibMinSmile = sDist;
        this.state.calibTicks++;
        const pct = Math.min(100, (this.state.calibTicks / 100) * 100);
        const cBar = document.getElementById('calib-progress-bar');
        if (cBar) cBar.style.width = `${pct}%`;
        if (pct < 35) { ['calib-step-1'].forEach(id => document.getElementById(id)?.classList.add('active'));['calib-step-2', 'calib-step-3'].forEach(id => document.getElementById(id)?.classList.remove('active')); }
        else if (pct < 70) { ['calib-step-2'].forEach(id => document.getElementById(id)?.classList.add('active'));['calib-step-1', 'calib-step-3'].forEach(id => document.getElementById(id)?.classList.remove('active')); }
        else { ['calib-step-3'].forEach(id => document.getElementById(id)?.classList.add('active'));['calib-step-1', 'calib-step-2'].forEach(id => document.getElementById(id)?.classList.remove('active')); }
        if (this.state.calibTicks >= 100) this.finishCalibration();
      }

      // Compute %
      let openPct = Math.max(0, Math.min(100, ((dist - 0.01) / Math.max(0.02, this.state.calibMaxMouth - 0.01)) * 100));
      let smilePct = Math.max(0, Math.min(100, ((sDist - 0.08) / Math.max(0.02, this.state.calibMaxSmile - 0.08)) * 100));
      const minS = this.state.calibMinSmile || 0.08;
      const puckerPct = sDist < minS ? Math.min(100, ((minS - sDist) / Math.max(0.01, minS * 0.3)) * 100) : 0;

      this.state.mouthOpenness = openPct;
      this.state.smileWidth = smilePct;
      this.state.puckerWidth = puckerPct;

      // Lip symmetry (Phase 2)
      const sym = lipSymmetry.calculate(lm);
      this.state.lipSymmetry = sym;

      // Sample readings for session stats
      if (this.state.currentScreen === 'screen-game') {
        this.state.mouthOpenReadings.push(openPct);
        this.state.lipSymReadings.push(sym);
        if (this.state.mouthOpenReadings.length > 300) this.state.mouthOpenReadings.shift();
        if (this.state.lipSymReadings.length > 300) this.state.lipSymReadings.shift();
      }

      // Display progress
      let displayPct = 0, actionText = '';
      if (this.state.expectedAction === 'smile') { displayPct = smilePct; actionText = 'ฉีกยิ้ม'; }
      else if (this.state.expectedAction === 'pucker') { displayPct = puckerPct; actionText = 'ปากจู๋'; }
      else { displayPct = openPct; actionText = 'อ้าปาก'; }

      // Track peak action during speech practice
      if (this.state.currentScreen === 'screen-game') {
        if (displayPct > this.state.peakActionVal) this.state.peakActionVal = displayPct;
      }

      if (this.els.progressBar) {
        this.els.progressBar.style.width = `${displayPct}%`;
        this.els.progressBar.className = `progress-fill${displayPct > 60 ? ' great' : ''}`;
      }
      if (this.els.progressText) this.els.progressText.innerText = displayPct > 60 ? `${actionText} ดีมาก! 🌟` : `ท่าทาง (${actionText})`;
      if (this.els.progressPct) this.els.progressPct.innerText = `${Math.floor(displayPct)}%`;

      // Lip symmetry bar
      if (this.els.lipBar) this.els.lipBar.style.width = `${sym}%`;
      if (this.els.lipPct) {
        this.els.lipPct.innerText = `${sym}%`;
        this.els.lipPct.style.color = sym >= 70 ? 'var(--mint-dark)' : sym >= 50 ? 'var(--gold-dark)' : 'var(--coral)';
      }

      // Oro-motor processing
      if (this.state.mode === 'oro-motor') this.processOroMotorFrame();

    } else {
      this.state.faceTracked = false;
      if (this.els.progressText) this.els.progressText.innerText = '⚠️ มองไม่เห็นใบหน้า ขยับใกล้กล้องหน่อย';
      if (this.els.progressBar) this.els.progressBar.style.width = '0%';
      if (this.els.progressPct) this.els.progressPct.innerText = '0%';
    }
    ctx.restore();
  },

  // ── Screen Navigation ─────────────────────────────────────────────────────
  showScreen(screenId) {
    this.els.screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (!target) return;
    target.classList.add('active');
    target.querySelectorAll('.glass-card').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.07}s`;
      el.classList.remove('screen-enter');
      void el.offsetWidth;
      el.classList.add('screen-enter');
    });
    this.state.currentScreen = screenId;
    if (screenId === 'screen-game') this.resizeCanvas();
  },

  resizeCanvas() {
    if (this.els.canvas) { this.els.canvas.width = this.els.canvas.clientWidth; this.els.canvas.height = this.els.canvas.clientHeight; }
    const c = document.getElementById('calib_canvas');
    if (c) { c.width = c.clientWidth; c.height = c.clientHeight; }
    confetti.resize();
  },

  // ── Round Dots ────────────────────────────────────────────────────────────
  _buildRoundDots() {
    const c = this.els.roundDots; if (!c) return;
    c.innerHTML = '';
    for (let i = 0; i < this.state.maxRounds; i++) {
      const d = document.createElement('div');
      d.className = 'round-dot' + (i === 0 ? ' active' : ''); d.id = `dot-${i}`;
      c.appendChild(d);
    }
  },

  _updateRoundDots(index, status) {
    const dot = document.getElementById(`dot-${index}`); if (!dot) return;
    if (status === 'done') dot.className = 'round-dot done';
    else if (status === 'skip') dot.className = 'round-dot skipped';
    else dot.className = 'round-dot active';
    const next = document.getElementById(`dot-${index + 1}`);
    if (next && status !== 'active') next.classList.add('active');
  },

  // ── UI Helpers ────────────────────────────────────────────────────────────
  updateUI() {
    if (this.els.scoreText) this.els.scoreText.innerText = this.state.score;
    if (this.els.roundText) this.els.roundText.innerText = `${this.state.currentRound}/${this.state.maxRounds}`;
  },

  setFeedback(html, type = 'default') {
    const box = this.els.feedbackBox; if (!box) return;
    const icons = { success: '✅', error: '❌', warning: '⚠️', default: '💬' };
    box.className = 'feedback-box';
    if (type === 'success') box.classList.add('feedback-success');
    if (type === 'error') box.classList.add('feedback-error');
    if (type === 'warning') box.classList.add('feedback-warning');
    box.innerHTML = `<span style="font-size:1.2rem;flex-shrink:0;">${icons[type] || icons.default}</span><span>${html}</span>`;
  },

  playSound(id) {
    const a = document.getElementById(id);
    if (a) { a.currentTime = 0; a.play().catch(() => { }); }
  },

  // ── SQL Helper ────────────────────────────────────────────────────────────
  showSQLGuide() {
    const sql = window.db?.getInitSQL() || '';
    const win = window.open('', '_blank');
    win.document.write(`<pre style="font-family:monospace;padding:20px;font-size:14px;white-space:pre-wrap;">${sql}</pre>`);
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());