/**
 * FaceFit WebApp v2.0 — Upgraded Game Logic
 * Additions: Toast notifications, Confetti, Round dots, Smooth transitions,
 *            Better feedback UX, Home stats display, Enhanced calibration
 */

// ─── Toast Notification System ───
const toast = {
  show(message, type = 'info', duration = 3000) {
    const icons = {
      success: 'fa-circle-check',
      error:   'fa-circle-xmark',
      info:    'fa-circle-info',
      warning: 'fa-triangle-exclamation'
    };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<i class="fa-solid ${icons[type] || icons.info} toast-icon"></i><span>${message}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.classList.add('toast-out');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  }
};

// ─── Confetti System ───
const confetti = {
  canvas: null, ctx: null, particles: [], running: false,
  colors: ['#FF6B6B','#FFD166','#4ECDC4','#06D6A0','#9B72CF','#FF9F1C'],

  init() {
    this.canvas = document.getElementById('confetti-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    if (this.canvas) {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
    }
  },

  burst(count = 80) {
    if (!this.canvas) this.init();
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: window.innerWidth / 2 + (Math.random() - 0.5) * 300,
        y: window.innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() * -10) - 4,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        gravity: 0.35,
        opacity: 1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle'
      });
    }
    if (!this.running) this._animate();
  },

  _animate() {
    this.running = true;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.particles = this.particles.filter(p => p.opacity > 0.01);

    this.particles.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.012;

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.opacity);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation * Math.PI / 180);
      this.ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    if (this.particles.length > 0) {
      requestAnimationFrame(() => this._animate());
    } else {
      this.running = false;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
};

// ─── Main App Object ───
const app = {
  state: {
    currentScreen: 'screen-home',
    difficulty: 'normal',
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
    expectedAction: 'open',
    faceMeshLoaded: false,
    cameraGranted: false,
    isCalibrating: false,
    calibMaxMouth: 0.05,
    calibMaxSmile: 0.10,
    calibMinSmile: undefined,
    calibTicks: 0,
    sessionHighScore: 0,
    sessionRounds: 0
  },

  vocab: null,
  recognition: null,
  feedbackShowingSuccess: false,

  els: {},

  // ─── Init ───
  init() {
    console.log("FaceFit v2.0 Initializing...");
    confetti.init();

    this.els = {
      screens:          document.querySelectorAll('.screen'),
      video:            document.querySelector('.input_video'),
      canvas:           document.getElementById('game_canvas'),
      ctx:              document.getElementById('game_canvas').getContext('2d'),
      scoreText:        document.getElementById('game-score'),
      roundText:        document.getElementById('game-round'),
      roundDots:        document.getElementById('round-dots'),
      targetWordText:   document.getElementById('target-word'),
      taskInstruction:  document.getElementById('task-instruction'),
      feedbackBox:      document.getElementById('speech-feedback'),
      progressBar:      document.getElementById('game-progress-bar'),
      progressText:     document.getElementById('progress-text'),
      progressPct:      document.getElementById('progress-pct'),
      loadingOverlay:   document.getElementById('camera-loading'),
      listeningIndicator: document.getElementById('listening-indicator'),
      btnListen:        document.getElementById('btn-listen'),
      sndSuccess:       document.getElementById('snd-success'),
      sndCheer:         document.getElementById('snd-cheer'),
    };

    window.addEventListener('resize', () => this.resizeCanvas());

    this.showScreen('screen-login');
    this.loadOfflineVocab();
  },

  // ─── Vocabulary ───
  loadOfflineVocab() {
    if (!this.vocab) {
      this.vocab = {
        easy: [
          { word: 'อา',  hint: 'อ้าปากกว้างๆ ให้สุด',   action: 'open',  aliases: ['อ้า'] },
          { word: 'อี',  hint: 'ฉีกยิ้มให้กว้าง',        action: 'smile', aliases: ['อี้'] },
          { word: 'อู',  hint: 'ทำปากจู๋',               action: 'open',  aliases: ['อู้'] },
          { word: 'ตา',  hint: 'อ้าปากกว้างๆ',           action: 'open',  aliases: ['ต้า','จา'] },
          { word: 'มา',  hint: 'อ้าปากกว้างๆ',           action: 'open',  aliases: ['ม้า','นา'] },
          { word: 'ดี',  hint: 'ฉีกยิ้มให้กว้าง',        action: 'smile', aliases: ['ดิ','บี','ตี'] },
          { word: 'ปลา', hint: 'อ้าปากกว้างๆ',           action: 'open',  aliases: ['ปา','ป้า'] }
        ],
        normal: [
          { word: 'กินข้าว',  hint: 'พูดเสียงดังฟังชัด',            action: 'open',  aliases: ['กินคาว','กิงข้าว'] },
          { word: 'หิวน้ำ',   hint: 'พูดเสียงดังฟังชัด',            action: 'open',  aliases: ['หิวหนำ','ฮิวน้ำ'] },
          { word: 'สบาย',     hint: 'ฉีกยิ้มตอนพูด ส-บาย',         action: 'smile', aliases: ['สะบาย','ซะบาย'] },
          { word: 'รักนะ',    hint: 'ฉีกยิ้มเวลาพูด',               action: 'smile', aliases: ['ลักนะ','ลักน่ะ'] },
          { word: 'สวัสดี',   hint: 'พูดเสียงดังฟังชัด',            action: 'smile', aliases: ['สะหวัดดี','สวัดดี'] },
          { word: 'ขอบคุณ',   hint: 'พูดเสียงดังฟังชัด',            action: 'open',  aliases: ['คอบคุน'] },
          { word: 'ไปไหน',    hint: 'พูดเสียงดังฟังชัด',            action: 'open',  aliases: ['ไปไน','อัยไหน'] }
        ],
        hard: [
          { word: 'กินข้าวอิ่มแล้ว',  hint: 'พูดประโยคให้ต่อเนื่อง',                        action: 'open',  aliases: ['กินข้าวอิมแล้ว'] },
          { word: 'วันนี้อากาศดี',     hint: 'พูดประโยคให้ต่อเนื่อง (ฉีกยิ้มคำว่า ดี)',     action: 'smile', aliases: ['วันนีอากาดดี'] },
          { word: 'สบายดีไหมครับ',    hint: 'พูดประโยคให้ต่อเนื่อง',                        action: 'smile', aliases: ['สบายดีไหม','สะบายดีมัย'] },
          { word: 'พรุ่งนี้ไปเที่ยว',  hint: 'พูดประโยคให้ต่อเนื่อง',                        action: 'smile', aliases: ['พุ่งนี้ไปเทียว'] },
          { word: 'ขอบคุณมากค่ะ',     hint: 'พูดประโยคให้ต่อเนื่อง',                        action: 'open',  aliases: ['คอบคุนมาก'] }
        ]
      };
    }
  },

  async loadOnlineVocab() {
    if (window.db) {
      const onlineVocab = await window.db.getVocabulary();
      if (onlineVocab) {
        this.vocab = onlineVocab;
        console.log("Loaded vocab from Supabase.");
      }
    }
  },

  // ─── Auth ───
  async doLogin() {
    const pinInput = document.getElementById('login-pin').value.trim();
    const errDiv   = document.getElementById('login-error');
    errDiv.style.display = 'none';

    if (!pinInput) {
      errDiv.innerText = 'กรุณากรอกรหัส PIN';
      errDiv.style.display = 'block';
      return;
    }

    const btn = document.querySelector('#screen-login .btn-primary');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
    btn.disabled  = true;

    if (window.db) {
      const user = await window.db.login(pinInput);
      if (user) {
        await this.loadOnlineVocab();
        this.finishLogin(user.name);
      } else {
        errDiv.innerText = 'รหัส PIN ไม่ถูกต้อง หรือระบบติดต่อขัดข้อง';
        errDiv.style.display = 'block';
        btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ';
        btn.disabled  = false;
      }
    } else {
      errDiv.innerText = 'ไม่พบเชื่อมต่อ DB (db.js missing)';
      errDiv.style.display = 'block';
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ';
      btn.disabled  = false;
    }
  },

  async skipLogin() {
    if (window.db) window.db.logout();
    await this.loadOnlineVocab();
    this.finishLogin('บุคคลทั่วไป');
  },

  finishLogin(name) {
    const chip = document.getElementById('home-welcome-chip');
    if (chip) chip.innerHTML = `<i class="fa-solid fa-hand-wave"></i> ยินดีต้อนรับ, ${name}`;
    this.showScreen('screen-home');
    this.initSpeechAPI();
    this.initMediaPipe();
    this._loadHomeStats();
  },

  _loadHomeStats() {
    const sessEl  = document.getElementById('home-stat-sessions');
    const scoreEl = document.getElementById('home-stat-score');
    if (!sessEl || !scoreEl) return;
    if (window.db && window.db.patient) {
      // Can extend to fetch real history from DB
    }
    sessEl.innerText  = this.state.sessionRounds  || '—';
    scoreEl.innerText = this.state.sessionHighScore || '—';
  },

  // ─── Admin ───
  async doAdminLogin() {
    const user    = document.getElementById('admin-user').value;
    const pass    = document.getElementById('admin-pass').value;
    const errDiv  = document.getElementById('admin-error');
    errDiv.style.display = 'none';

    if (!user || !pass) {
      errDiv.innerText = 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน';
      errDiv.style.display = 'block';
      return;
    }

    const btn = document.querySelector('#screen-admin-login .btn-warning');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
    btn.disabled  = true;

    if (window.db) {
      const ok = await window.db.adminLogin(user, pass);
      if (ok) {
        this.loadAdminDash();
        toast.show('เข้าสู่ระบบแอดมินสำเร็จ', 'success');
      } else {
        errDiv.innerText = 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง';
        errDiv.style.display = 'block';
      }
    } else {
      errDiv.innerText = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
      errDiv.style.display = 'block';
    }

    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบแอดมิน';
    btn.disabled  = false;
  },

  adminLogout() {
    if (window.db) window.db.logout();
    toast.show('ออกจากระบบแอดมินแล้ว', 'info');
    this.showScreen('screen-home');
  },

  async loadAdminDash() {
    this.showScreen('screen-admin-dash');
    if (!window.db) return;

    const patients = await window.db.getPatientsList();
    const ptBody   = document.querySelector('#admin-patients-table tbody');
    ptBody.innerHTML = '';
    if (patients && patients.length > 0) {
      patients.forEach(pt => {
        ptBody.innerHTML += `
          <tr>
            <td><strong>${pt.name}</strong></td>
            <td><code style="background:rgba(0,0,0,0.05);padding:2px 8px;border-radius:6px;">${pt.pin}</code></td>
            <td>${pt.totalPlaySessions || 0} รอบ</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="app.adminDeletePatient('${pt.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>`;
      });
    } else {
      ptBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-hint);padding:20px;">ยังไม่มีข้อมูลผู้ป่วย</td></tr>';
    }

    const vocab = await window.db.getAllVocabRaw();
    const vBody  = document.querySelector('#admin-vocab-table tbody');
    vBody.innerHTML = '';
    if (vocab && vocab.length > 0) {
      vocab.forEach(v => {
        const aliases    = Array.isArray(v.aliases) ? v.aliases.join(', ') : '';
        const actionText = v.action === 'smile' ? '<span style="color:var(--gold-dark)">ฉีกยิ้ม</span>' : '<span style="color:var(--teal-dark)">อ้าปาก</span>';
        const diffColors = { easy: 'var(--mint-dark)', normal: 'var(--gold-dark)', hard: 'var(--coral-dark)' };
        const diffNames  = { easy: 'ง่าย', normal: 'ปานกลาง', hard: 'ยาก' };
        vBody.innerHTML += `
          <tr>
            <td><span style="color:${diffColors[v.difficulty] || '#666'};font-weight:600;">${diffNames[v.difficulty] || v.difficulty}</span></td>
            <td><strong style="font-family:'Kanit',sans-serif;font-size:1.05rem;">${v.word}</strong></td>
            <td>${v.hint} (${actionText})</td>
            <td><small style="color:var(--text-hint);">${aliases}</small></td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="app.adminDeleteVocab(${v.id})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>`;
      });
    } else {
      vBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-hint);padding:20px;">ยังไม่มีคำศัพท์</td></tr>';
    }
  },

  async adminAddPatient() {
    const name = document.getElementById('new-patient-name').value.trim();
    const pin  = document.getElementById('new-patient-pin').value.trim();
    if (!name || !pin) { toast.show('กรุณาใส่ชื่อผู้ป่วยและรหัส PIN', 'warning'); return; }

    const ok = await window.db.addPatient(name, pin);
    if (ok) {
      document.getElementById('new-patient-name').value = '';
      document.getElementById('new-patient-pin').value  = '';
      toast.show(`เพิ่มผู้ป่วย "${name}" สำเร็จ`, 'success');
      this.loadAdminDash();
    } else {
      toast.show('ไม่สามารถเพิ่มได้ (PIN อาจซ้ำ)', 'error');
    }
  },

  async adminDeletePatient(id) {
    if (!confirm('ต้องการลบข้อมูลผู้ป่วยคนนี้รวมถึงประวัติทั้งหมดใช่หรือไม่?')) return;
    const ok = await window.db.deletePatient(id);
    if (ok) { toast.show('ลบข้อมูลผู้ป่วยสำเร็จ', 'success'); this.loadAdminDash(); }
    else    { toast.show('ไม่สามารถลบข้อมูลได้', 'error'); }
  },

  async adminAddVocab() {
    const word    = document.getElementById('new-vocab-word').value.trim();
    const hint    = document.getElementById('new-vocab-hint').value.trim();
    const action  = document.getElementById('new-vocab-action').value;
    const diff    = document.getElementById('new-vocab-diff').value;
    const aliases = document.getElementById('new-vocab-aliases').value.trim();
    if (!word || !hint) { toast.show('กรุณาใส่คำศัพท์และคำแนะนำ', 'warning'); return; }

    const ok = await window.db.addVocab(word, hint, action, diff, aliases);
    if (ok) {
      ['new-vocab-word','new-vocab-hint','new-vocab-aliases'].forEach(id => { document.getElementById(id).value = ''; });
      toast.show(`เพิ่มคำว่า "${word}" สำเร็จ`, 'success');
      this.loadAdminDash();
    } else {
      toast.show('ไม่สามารถเพิ่มคำศัพท์ได้', 'error');
    }
  },

  async adminDeleteVocab(id) {
    if (!confirm('ต้องการลบคำศัพท์นี้ออกจากระบบใช่หรือไม่?')) return;
    const ok = await window.db.deleteVocab(id);
    if (ok) { toast.show('ลบคำศัพท์สำเร็จ', 'success'); this.loadAdminDash(); }
    else    { toast.show('ไม่สามารถลบข้อมูลได้', 'error'); }
  },

  // ─── Canvas Resize ───
  resizeCanvas() {
    if (this.els.canvas) {
      this.els.canvas.width  = this.els.canvas.clientWidth;
      this.els.canvas.height = this.els.canvas.clientHeight;
    }
    const c = document.getElementById('calib_canvas');
    if (c) { c.width = c.clientWidth; c.height = c.clientHeight; }
    confetti.resize();
  },

  // ─── Speech API ───
  initSpeechAPI() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast.show('เบราว์เซอร์ไม่รองรับ Speech API — แนะนำ Google Chrome', 'warning', 6000);
      return;
    }

    this.recognition = new SR();
    this.recognition.lang = 'th-TH';
    this.recognition.continuous    = false;
    this.recognition.interimResults = false;

    this.recognition.onstart = () => {
      this.state.isListening = true;
      this.els.listeningIndicator.style.display = 'flex';
      this.els.btnListen.disabled = true;
      this.els.btnListen.classList.add('listening');
      this.els.btnListen.innerHTML = '<i class="fa-solid fa-circle-stop"></i> กำลังฟัง...';
      this.setFeedback('🎤 กำลังฟังเสียง... พูดได้เลย!', 'default');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim().replace(/\s+/g,'');
      console.log("Recognized:", transcript);
      this.handleSpeechResult(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      if (event.error === 'no-speech') {
        this.setFeedback('ไม่ได้ยินเสียง กรุณาลองใหม่อีกครั้ง 🎙️', 'error');
      } else if (event.error === 'network') {
        this.setFeedback('การเชื่อมต่อขัดข้อง ลองใช้เน็ตมือถือ หรือกด "ข้ามคำนี้"', 'error');
      } else {
        this.setFeedback('เกิดข้อผิดพลาดของไมโครโฟน', 'error');
      }
    };

    this.recognition.onend = () => {
      this.state.isListening = false;
      this.els.listeningIndicator.style.display = 'none';
      this.els.btnListen.disabled = false;
      this.els.btnListen.classList.remove('listening');
      this.els.btnListen.innerHTML = '<i class="fa-solid fa-microphone"></i> กดเพื่อพูด';
      if (!this.feedbackShowingSuccess) {
        setTimeout(() => {
          if (!this.state.isListening && !this.feedbackShowingSuccess) {
            this.setFeedback('กดปุ่มไมโครโฟนเพื่อพูดอีกครั้ง', 'default');
          }
        }, 1800);
      }
    };
  },

  startListening() {
    if (!this.recognition) { toast.show('เบราว์เซอร์ไม่รองรับไมโครโฟน', 'error'); return; }
    if (this.state.isListening) return;
    try { this.recognition.start(); }
    catch (e) { console.warn("Recognition error:", e); }
  },

  handleSpeechResult(spokenWord) {
    const cleanTarget = this.state.targetWord.replace(/\s+/g,'');
    const cleanSpoken = spokenWord.replace(/\s+/g,'');
    console.log(`Target:[${cleanTarget}] | Spoken:[${cleanSpoken}]`);

    let isMatch = false;
    const currentItem = this.vocab[this.state.difficulty].find(v => v.word === this.state.targetWord);
    const aliases = currentItem?.aliases || [];

    if (cleanSpoken === cleanTarget || aliases.some(a => cleanSpoken.includes(a.replace(/\s+/g,'')))) {
      isMatch = true;
    } else if (cleanSpoken.includes(cleanTarget)) {
      if (cleanSpoken.length - cleanTarget.length <= 5 || cleanTarget.length >= 6) {
        isMatch = true;
      }
    }

    if (isMatch) {
      this.wordSuccess(spokenWord);
    } else {
      this.setFeedback(`คุณพูดว่า: "<strong>${spokenWord}</strong>"<br>ลองใหม่อีกครั้งนะครับ! 💪`, 'error');
    }
  },

  wordSuccess(spokenStr) {
    this.feedbackShowingSuccess = true;
    this.playSound('snd-success');
    confetti.burst(60);

    let points = 10;
    let bonus  = 0;
    let actionVal = 0;
    let actionName = '';

    if (this.state.expectedAction === 'smile') {
      actionVal = this.state.smileWidth; actionName = 'ฉีกยิ้ม';
    } else if (this.state.expectedAction === 'pucker') {
      actionVal = this.state.puckerWidth; actionName = 'ทำปากจู๋';
    } else {
      actionVal = this.state.mouthOpenness; actionName = 'อ้าปากกว้าง';
    }

    if (this.state.difficulty === 'easy'   && actionVal > 40) bonus = 5;
    if (this.state.difficulty === 'normal' && actionVal > 30) bonus = 3;
    if (this.state.difficulty === 'hard'   && actionVal > 25) bonus = 4;

    const roundScore = points + bonus;
    this.state.score += roundScore;
    this.state.completed += 1;

    // Update round dot to done
    this._updateRoundDots(this.state.currentRound - 1, 'done');

    let bonusMsg = bonus > 0
      ? `<br><small style="color:var(--gold-dark);font-weight:600;">✨ โบนัส ${actionName} +${bonus} แต้ม!</small>`
      : '';
    this.setFeedback(`🎉 ยอดเยี่ยม! คุณพูดคำว่า "<strong>${spokenStr}</strong>" ถูกต้อง${bonusMsg}`, 'success');
    toast.show(`+${roundScore} แต้ม! 🎊`, 'success', 2000);

    this.updateUI();

    setTimeout(() => {
      this.feedbackShowingSuccess = false;
      this.state.currentRound++;
      if (this.state.currentRound > this.state.maxRounds) this.endGame();
      else this.nextWord();
    }, 2600);
  },

  skipWord() {
    this.state.skipped += 1;
    this._updateRoundDots(this.state.currentRound - 1, 'skip');
    this.setFeedback('ไม่เป็นไรครับ ข้ามคำนี้ก่อนนะ ✌️', 'warning');
    this.state.currentRound++;
    setTimeout(() => {
      if (this.state.currentRound > this.state.maxRounds) this.endGame();
      else this.nextWord();
    }, 1400);
  },

  // ─── Round Dots ───
  _buildRoundDots() {
    const container = this.els.roundDots;
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < this.state.maxRounds; i++) {
      const dot = document.createElement('div');
      dot.className = 'round-dot' + (i === 0 ? ' active' : '');
      dot.id = `dot-${i}`;
      container.appendChild(dot);
    }
  },

  _updateRoundDots(index, status) {
    const dot = document.getElementById(`dot-${index}`);
    if (!dot) return;
    dot.className = 'round-dot ' + (status === 'done' ? 'done' : '');

    const next = document.getElementById(`dot-${index + 1}`);
    if (next) next.classList.add('active');
  },

  // ─── MediaPipe ───
  initMediaPipe() {
    this.faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    this.faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });
    this.faceMesh.onResults((results) => this.onFaceMeshResults(results));

    this.camera = new Camera(this.els.video, {
      onFrame: async () => {
        if (['screen-game','screen-calibration'].includes(this.state.currentScreen)) {
          await this.faceMesh.send({ image: this.els.video });
        }
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
        document.getElementById('calib-step-1')?.classList.add('active');
      }
    }

    const isCalib = this.state.currentScreen === 'screen-calibration';
    const canvas  = isCalib ? document.getElementById('calib_canvas') : this.els.canvas;
    const ctx     = canvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.multiFaceLandmarks?.length > 0) {
      this.state.faceTracked = true;
      const lm = results.multiFaceLandmarks[0];

      drawConnectors(ctx, lm, FACEMESH_LIPS, { color: 'rgba(78,205,196,0.8)', lineWidth: 2 });

      const upperLip   = lm[13], lowerLip  = lm[14];
      const leftCorner = lm[61],  rightCorner = lm[291];

      const dy = upperLip.y - lowerLip.y;
      const dx = upperLip.x - lowerLip.x;
      const distance  = Math.sqrt(dx * dx + dy * dy);

      const sx = leftCorner.x - rightCorner.x;
      const sy = leftCorner.y - rightCorner.y;
      const sDistance = Math.sqrt(sx * sx + sy * sy);

      if (this.state.isCalibrating) {
        if (distance  > this.state.calibMaxMouth) this.state.calibMaxMouth = distance;
        if (sDistance > this.state.calibMaxSmile) this.state.calibMaxSmile = sDistance;
        if (!this.state.calibMinSmile || sDistance < this.state.calibMinSmile) {
          this.state.calibMinSmile = sDistance;
        }
        this.state.calibTicks++;
        const pct = Math.min(100, (this.state.calibTicks / 100) * 100);
        document.getElementById('calib-progress-bar').style.width = `${pct}%`;

        // Animate calibration step icons
        if (pct < 35)      { document.getElementById('calib-step-1')?.classList.add('active'); document.getElementById('calib-step-2')?.classList.remove('active'); document.getElementById('calib-step-3')?.classList.remove('active'); }
        else if (pct < 70) { document.getElementById('calib-step-2')?.classList.add('active'); document.getElementById('calib-step-1')?.classList.remove('active'); document.getElementById('calib-step-3')?.classList.remove('active'); }
        else               { document.getElementById('calib-step-3')?.classList.add('active'); document.getElementById('calib-step-1')?.classList.remove('active'); document.getElementById('calib-step-2')?.classList.remove('active'); }

        if (this.state.calibTicks >= 100) this.finishCalibration();
      }

      // Compute percentages
      let mouthDenom   = Math.max(0.02, this.state.calibMaxMouth - 0.01);
      let openPercent  = Math.max(0, Math.min(100, ((distance - 0.01) / mouthDenom) * 100));
      this.state.mouthOpenness = openPercent;

      let smileDenom   = Math.max(0.02, this.state.calibMaxSmile - 0.08);
      let smilePercent = Math.max(0, Math.min(100, ((sDistance - 0.08) / smileDenom) * 100));
      this.state.smileWidth = smilePercent;

      let minSmile     = this.state.calibMinSmile || 0.08;
      let maxPucker    = minSmile * 0.7;
      let puckerDenom  = Math.max(0.01, minSmile - maxPucker);
      let puckerPercent = sDistance < minSmile ? Math.min(100, ((minSmile - sDistance) / puckerDenom) * 100) : 0;
      this.state.puckerWidth = puckerPercent;

      let displayPct = 0, actionText = '';
      if (this.state.expectedAction === 'smile')  { displayPct = smilePercent;   actionText = 'ฉีกยิ้ม'; }
      else if (this.state.expectedAction === 'pucker') { displayPct = puckerPercent; actionText = 'ทำปากจู๋'; }
      else { displayPct = openPercent; actionText = 'อ้าปากกว้าง'; }

      // Update game screen progress bar
      if (this.els.progressBar) {
        this.els.progressBar.style.width = `${displayPct}%`;
        this.els.progressBar.className   = `progress-fill${displayPct > 60 ? ' great' : ''}`;
      }
      if (this.els.progressText) {
        this.els.progressText.innerText = displayPct > 60 ? `${actionText}ดีมาก! 🌟` : `ท่าทาง (${actionText})`;
      }
      if (this.els.progressPct) {
        this.els.progressPct.innerText = `${Math.floor(displayPct)}%`;
      }

    } else {
      this.state.faceTracked = false;
      if (this.els.progressText) this.els.progressText.innerText = '⚠️ มองไม่เห็นใบหน้า';
      if (this.els.progressBar)  this.els.progressBar.style.width = '0%';
      if (this.els.progressPct)  this.els.progressPct.innerText = '0%';
    }

    ctx.restore();
  },

  // ─── Screen Navigation ───
  showScreen(screenId) {
    this.els.screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    target.classList.add('active');
    target.querySelectorAll('.glass-card, .game-container').forEach((el, i) => {
      el.style.animationDelay = `${i * 0.06}s`;
      el.classList.remove('screen-enter');
      void el.offsetWidth; // force reflow
      el.classList.add('screen-enter');
    });
    this.state.currentScreen = screenId;
    if (screenId === 'screen-game') this.resizeCanvas();
  },

  // ─── Game Flow ───
  startGame(difficulty) {
    this.state.difficulty    = difficulty;
    this.state.score         = 0;
    this.state.currentRound  = 1;
    this.state.completed     = 0;
    this.state.skipped       = 0;
    this.state.calibMaxMouth = 0.05;
    this.state.calibMaxSmile = 0.10;
    this.state.calibMinSmile = undefined;
    this.feedbackShowingSuccess = false;

    document.getElementById('calib-progress-bar').style.width = '0%';
    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = 'มองกล้องให้เห็นหน้าชัดเจน'; instr.className = 'calib-status-text text-teal'; }
    const btn = document.getElementById('btn-calib-action');
    if (btn) btn.style.display = 'none';

    if (!this.state.cameraGranted) {
      document.getElementById('calib-loading').style.display = 'flex';
      this.camera.start()
        .then(() => { this.state.cameraGranted = true; })
        .catch(err => {
          toast.show('กรุณาอนุญาตให้ใช้งานกล้องและไมโครโฟน', 'error', 6000);
          console.error(err);
          this.showScreen('screen-home');
        });
    }
    this.showScreen('screen-calibration');
  },

  doCalibrationAction() {
    this.state.isCalibrating = true;
    this.state.calibTicks    = 0;
    this.state.calibMaxMouth = 0;
    this.state.calibMaxSmile = 0;
    const btn  = document.getElementById('btn-calib-action');
    if (btn) btn.style.display = 'none';
    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = '🎯 กำลังบันทึก... อ้าปากกว้างๆ สลับฉีกยิ้ม!'; instr.className = 'calib-status-text text-coral'; }
  },

  finishCalibration() {
    this.state.isCalibrating = false;
    if (this.state.calibMaxMouth < 0.03) this.state.calibMaxMouth = 0.05;
    if (this.state.calibMaxSmile < 0.08) this.state.calibMaxSmile = 0.12;

    const instr = document.getElementById('calib-instruction');
    if (instr) { instr.innerText = '✅ บันทึกค่าสำเร็จ! ระบบพร้อมสำหรับคุณแล้ว'; instr.className = 'calib-status-text text-mint'; }
    toast.show('ปรับเทียบกล้องสำเร็จ', 'success', 2000);

    setTimeout(() => {
      this.showScreen('screen-game');
      this._buildRoundDots();
      this.nextWord();
    }, 1500);
  },

  nextWord() {
    this.updateUI();
    this.setFeedback('กดปุ่มไมโครโฟนแล้วพูดให้ชัดเจน 🎤', 'default');

    const wordList   = this.vocab[this.state.difficulty];
    const randomItem = wordList[Math.floor(Math.random() * wordList.length)];

    this.state.targetWord    = randomItem.word;
    this.state.expectedAction = randomItem.action || 'open';

    // Animate word change
    const wordEl = this.els.targetWordText;
    wordEl.style.opacity  = '0';
    wordEl.style.transform = 'scale(0.8)';
    setTimeout(() => {
      wordEl.innerText = randomItem.word;
      wordEl.style.transition = 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)';
      wordEl.style.opacity = '1';
      wordEl.style.transform = 'scale(1)';
      wordEl.classList.add('word-enter');
      setTimeout(() => wordEl.classList.remove('word-enter'), 500);
    }, 150);

    this.els.taskInstruction.innerText = randomItem.hint;

    // Update current dot
    this._updateRoundDots(this.state.currentRound - 1, 'active');
  },

  endGame() {
    if (this.state.isListening) try { this.recognition.stop(); } catch(e) {}

    this.state.sessionRounds++;
    if (this.state.score > this.state.sessionHighScore) {
      this.state.sessionHighScore = this.state.score;
    }

    this.showScreen('screen-result');
    this.playSound('snd-cheer');
    setTimeout(() => confetti.burst(120), 300);

    document.getElementById('res-score').innerText     = this.state.score;
    document.getElementById('res-completed').innerHTML = `${this.state.completed} <small style="font-size:0.75rem;">คำ</small>`;
    document.getElementById('res-skipped').innerHTML   = `${this.state.skipped} <small style="font-size:0.75rem;">คำ</small>`;

    if (window.db?.patient) {
      window.db.saveHistory({ score: this.state.score, completed: this.state.completed, skipped: this.state.skipped, difficulty: this.state.difficulty });
    }

    this._loadHomeStats();
  },

  endGameForce() {
    if (confirm('ต้องการจบเกมทันทีหรือไม่?')) this.endGame();
  },

  // ─── UI Helpers ───
  updateUI() {
    this.els.scoreText.innerText = this.state.score;
    this.els.roundText.innerText = `${this.state.currentRound}/${this.state.maxRounds}`;
  },

  setFeedback(htmlText, type = 'default') {
    const box = this.els.feedbackBox;
    const icons = { success: '✅', error: '❌', warning: '⚠️', default: '💬' };
    box.className  = 'feedback-box';
    if (type === 'success') box.classList.add('feedback-success');
    if (type === 'error')   box.classList.add('feedback-error');
    if (type === 'warning') box.classList.add('feedback-warning');

    box.innerHTML = `<span style="font-size:1.3rem;">${icons[type] || icons.default}</span><span>${htmlText}</span>`;
  },

  playSound(id) {
    const audio = document.getElementById(id);
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); }
  }
};

document.addEventListener('DOMContentLoaded', () => app.init());