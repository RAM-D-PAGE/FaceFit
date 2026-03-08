/**
 * FaceFit WebApp: Speech Therapy Game Logic
 * Combines MediaPipe FaceMesh and Web Speech API
 */

const app = {
    // --- State ---
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
        mouthOpenness: 0, // 0 to 100
        smileWidth: 0, // 0 to 100
        expectedAction: 'open',
        faceMeshLoaded: false,
        cameraGranted: false,

        // Calibration
        isCalibrating: false,
        calibMaxMouth: 0.05, // Default safe value
        calibMaxSmile: 0.10, // Default safe value
        calibTicks: 0
    },

    // --- Vocabulary Data ---
    vocab: null,

    // --- DOM Elements ---
    els: {},

    // --- Initialization ---
    init() {
        console.log("FaceFit Game Logic Initializing...");

        this.els = {
            screens: document.querySelectorAll('.screen'),
            video: document.querySelector('.input_video'),
            canvas: document.getElementById('game_canvas'),
            ctx: document.getElementById('game_canvas').getContext('2d'),

            // UI elements
            scoreText: document.getElementById('game-score'),
            roundText: document.getElementById('game-round'),
            targetWordText: document.getElementById('target-word'),
            taskInstruction: document.getElementById('task-instruction'),
            feedbackBox: document.getElementById('speech-feedback'),
            progressBar: document.getElementById('game-progress-bar'),
            progressText: document.getElementById('progress-text'),

            // Overlays
            loadingOverlay: document.getElementById('camera-loading'),
            listeningIndicator: document.getElementById('listening-indicator'),
            btnListen: document.getElementById('btn-listen'),

            // Audio
            sndSuccess: document.getElementById('snd-success'),
            sndCheer: document.getElementById('snd-cheer'),
        };

        // Resize canvas
        window.addEventListener('resize', () => this.resizeCanvas());

        this.showScreen('screen-login');
        this.loadOfflineVocab();
    },

    loadOfflineVocab() {
        if (!this.vocab) {
            this.vocab = {
                easy: [
                    { word: 'อา', hint: 'อ้าปากกว้างๆ', action: 'open', aliases: ['อ้า'] },
                    { word: 'อี', hint: 'ฉีกยิ้มกว้างๆ', action: 'smile', aliases: ['อี้'] },
                    { word: 'อู', hint: 'ทำปากจู๋', action: 'open', aliases: ['อู้'] },
                    { word: 'ตา', hint: 'อ้าปากกว้างๆ', action: 'open', aliases: ['ต้า', 'จา'] },
                    { word: 'มา', hint: 'อ้าปากกว้างๆ', action: 'open', aliases: ['ม้า', 'นา'] },
                    { word: 'ดี', hint: 'ฉีกยิ้มกว้างๆ', action: 'smile', aliases: ['ดิ', 'บี', 'ตี'] },
                    { word: 'ปลา', hint: 'อ้าปากกว้างๆ', action: 'open', aliases: ['ปา', 'ป้า'] }
                ],
                normal: [
                    { word: 'กินข้าว', hint: 'พูดเสียงดังฟังชัด', action: 'open', aliases: ['กินคาว', 'กิงข้าว'] },
                    { word: 'หิวน้ำ', hint: 'พูดเสียงดังฟังชัด', action: 'open', aliases: ['หิวหนำ', 'ฮิวน้ำ'] },
                    { word: 'สบาย', hint: 'ฉีกยิ้มตอนพูด ส-บาย', action: 'smile', aliases: ['สะบาย', 'ซะบาย'] },
                    { word: 'รักนะ', hint: 'ฉีกยิ้มเวลาพูด', action: 'smile', aliases: ['ลักนะ', 'ลักน่ะ'] },
                    { word: 'สวัสดี', hint: 'พูดเสียงดังฟังชัด', action: 'smile', aliases: ['สะหวัดดี', 'สวัดดี'] },
                    { word: 'ขอบคุณ', hint: 'พูดเสียงดังฟังชัด', action: 'open', aliases: ['คอบคุน'] },
                    { word: 'ไปไหน', hint: 'พูดเสียงดังฟังชัด', action: 'open', aliases: ['ไปไน', 'อัยไหน'] }
                ],
                hard: [
                    { word: 'กินข้าวอิ่มแล้ว', hint: 'พูดประโยคให้ต่อเนื่อง', action: 'open', aliases: ['กินข้าวอิมแล้ว'] },
                    { word: 'วันนี้อากาศดี', hint: 'พูดประโยคให้ต่อเนื่อง (ฉีกยิ้มคำว่า ดี)', action: 'smile', aliases: ['วันนีอากาดดี'] },
                    { word: 'สบายดีไหมครับ', hint: 'พูดประโยคให้ต่อเนื่อง', action: 'smile', aliases: ['สบายดีไหม', 'สะบายดีมัย'] },
                    { word: 'พรุ่งนี้ไปเที่ยว', hint: 'พูดประโยคให้ต่อเนื่อง', action: 'smile', aliases: ['พุ่งนี้ไปเทียว'] },
                    { word: 'ขอบคุณมากค่ะ', hint: 'พูดประโยคให้ต่อเนื่อง', action: 'open', aliases: ['คอบคุนมาก'] }
                ]
            };
        }
    },

    async loadOnlineVocab() {
        if (window.db) {
            const onlineVocab = await window.db.getVocabulary();
            if (onlineVocab) {
                this.vocab = onlineVocab;
                console.log("Loaded vocabulary from Supabase.");
            } else {
                console.log("Using offline fallback vocabulary.");
            }
        }
    },

    async doLogin() {
        const pinInput = document.getElementById('login-pin').value;
        const errDiv = document.getElementById('login-error');
        errDiv.style.display = 'none';

        if (!pinInput) {
            errDiv.innerText = "กรุณากรอกรหัส PIN";
            errDiv.style.display = 'block';
            return;
        }

        const btn = document.querySelector('#screen-login .btn-primary');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
        btn.disabled = true;

        if (window.db) {
            const user = await window.db.login(pinInput);
            if (user) {
                console.log("Logged in as:", user.name);
                await this.loadOnlineVocab();
                this.finishLogin(user.name);
            } else {
                errDiv.innerText = "รหัส/ระบบติดต่อขัดข้อง";
                errDiv.style.display = 'block';
            }
        } else {
            errDiv.innerText = "ไม่พบเชื่อมต่อ DB (db.js missing)";
            errDiv.style.display = 'block';
        }

        btn.innerHTML = oldText;
        btn.disabled = false;
    },

    async skipLogin() {
        if (window.db) {
            window.db.logout();
        }
        await this.loadOnlineVocab();
        this.finishLogin("บุคคลทั่วไป");
    },

    finishLogin(name) {
        const subtitle = document.querySelector('#screen-home .subtitle');
        if (subtitle) {
            subtitle.innerText = `ยินดีต้อนรับ, ${name}\nมาสนุกกับการฝึกพูดและบริหารกล้ามเนื้อใบหน้ากันครับ!`;
        }
        this.showScreen('screen-home');
        this.initSpeechAPI();
        this.initMediaPipe();
    },

    // --- Admin Dashboard Logic ---
    async doAdminLogin() {
        const user = document.getElementById('admin-user').value;
        const pass = document.getElementById('admin-pass').value;
        const errorDiv = document.getElementById('admin-error');
        errorDiv.style.display = 'none';

        if (!user || !pass) {
            errorDiv.innerText = "กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน";
            errorDiv.style.display = 'block';
            return;
        }

        const btn = document.querySelector('#screen-admin-login .btn-warning');
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังเข้าสู่ระบบ...';
        btn.disabled = true;

        if (window.db) {
            const success = await window.db.adminLogin(user, pass);
            if (success) {
                this.loadAdminDash();
            } else {
                errorDiv.innerText = "ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง";
                errorDiv.style.display = 'block';
            }
        } else {
            errorDiv.innerText = "ไม่สามารถเชื่อมต่อฐานข้อมูลได้";
            errorDiv.style.display = 'block';
        }

        btn.innerHTML = oldText;
        btn.disabled = false;
    },

    adminLogout() {
        if (window.db) window.db.logout();
        this.showScreen('screen-home'); // Give them a choice to log in as patient again
    },

    async loadAdminDash() {
        this.showScreen('screen-admin-dash');
        if (!window.db) return;

        // Load Patients
        const patients = await window.db.getPatientsList();
        const ptBody = document.querySelector('#admin-patients-table tbody');
        ptBody.innerHTML = '';
        patients.forEach(pt => {
            ptBody.innerHTML += `
                <tr>
                    <td>${pt.name}</td>
                    <td>${pt.pin}</td>
                    <td>${pt.totalPlaySessions || 0} รอบ</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="app.adminDeletePatient('${pt.id}')">ลบ</button>
                    </td>
                </tr>
            `;
        });

        // Load Vocab
        const vocab = await window.db.getAllVocabRaw();
        const vBody = document.querySelector('#admin-vocab-table tbody');
        vBody.innerHTML = '';
        vocab.forEach(v => {
            const aliases = Array.isArray(v.aliases) ? v.aliases.join(', ') : '';
            const actionText = v.action === 'smile' ? 'ฉีกยิ้ม' : 'อ้าปาก';
            const diffText = v.difficulty === 'easy' ? 'ง่าย' : (v.difficulty === 'normal' ? 'ปานกลาง' : 'ยาก');
            vBody.innerHTML += `
                <tr>
                    <td>${diffText}</td>
                    <td><strong>${v.word}</strong></td>
                    <td>${v.hint} (${actionText})</td>
                    <td><small>${aliases}</small></td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="app.adminDeleteVocab(${v.id})">ลบ</button>
                    </td>
                </tr>
            `;
        });
    },

    async adminAddPatient() {
        const name = document.getElementById('new-patient-name').value;
        const pin = document.getElementById('new-patient-pin').value;
        if (!name || !pin) return alert("กรุณาใส่ชื่อผู้ป่วยและรหัส PIN");

        const success = await window.db.addPatient(name, pin);
        if (success) {
            document.getElementById('new-patient-name').value = '';
            document.getElementById('new-patient-pin').value = '';
            this.loadAdminDash();
        } else {
            alert("ไม่สามารถเพิ่มผู้ป่วยได้ (เป็นไปได้ว่า PIN ซ้ำ)");
        }
    },

    async adminDeletePatient(id) {
        if (confirm("ต้องการลบข้อมูลผู้ป่วยคนนี้ รวมถึงประวัติการฝึกทั้งหมดใช่หรือไม่?")) {
            const success = await window.db.deletePatient(id);
            if (success) this.loadAdminDash();
            else alert("ไม่สามารถลบข้อมูลได้");
        }
    },

    async adminAddVocab() {
        const word = document.getElementById('new-vocab-word').value;
        const hint = document.getElementById('new-vocab-hint').value;
        const action = document.getElementById('new-vocab-action').value;
        const diff = document.getElementById('new-vocab-diff').value;
        const aliases = document.getElementById('new-vocab-aliases').value;

        if (!word || !hint) return alert("กรุณาใส่คำศัพท์และคำใบ้");

        const success = await window.db.addVocab(word, hint, action, diff, aliases);
        if (success) {
            document.getElementById('new-vocab-word').value = '';
            document.getElementById('new-vocab-hint').value = '';
            document.getElementById('new-vocab-aliases').value = '';
            this.loadAdminDash();
        } else {
            alert("ไม่สามารถเพิ่มคำศัพท์ได้");
        }
    },

    async adminDeleteVocab(id) {
        if (confirm("ต้องการลบคำศัพท์นี้ออกจากระบบใช่หรือไม่?")) {
            const success = await window.db.deleteVocab(id);
            if (success) this.loadAdminDash();
            else alert("ไม่สามารถลบข้อมูลได้");
        }
    },

    resizeCanvas() {
        if (this.els.canvas) {
            this.els.canvas.width = this.els.canvas.clientWidth;
            this.els.canvas.height = this.els.canvas.clientHeight;
        }
    },

    // --- Speech API ---
    initSpeechAPI() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("เบราว์เซอร์ของคุณไม่รองรับระบบสั่งงานด้วยเสียง (Speech API) แนะนำให้ใช้ Google Chrome ครับ");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'th-TH';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onstart = () => {
            this.state.isListening = true;
            this.els.listeningIndicator.style.display = 'flex';
            this.els.btnListen.disabled = true;
            this.setFeedback("🎤 กำลังฟังเสียง... พูดได้เลย!", "default");
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.trim().replace(/\s+/g, '');
            console.log("Recognized:", transcript);
            this.handleSpeechResult(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            if (event.error === 'no-speech') {
                this.setFeedback("ไม่ได้ยินเสียง กรุณาลองใหม่อีกครั้ง", "error");
            } else {
                this.setFeedback("เกิดข้อผิดพลาดของไมโครโฟน", "error");
            }
        };

        this.recognition.onend = () => {
            this.state.isListening = false;
            this.els.listeningIndicator.style.display = 'none';
            this.els.btnListen.disabled = false;
            if (!this.feedbackShowingSuccess) {
                // Return to wait state if we didn't just succeed
                setTimeout(() => {
                    if (!this.state.isListening && !this.feedbackShowingSuccess) {
                        this.setFeedback("กดปุ่มไมโครโฟนเพื่อพูด", "default");
                    }
                }, 2000);
            }
        };
    },

    startListening() {
        if (this.state.isListening) return;
        try {
            this.recognition.start();
        } catch (e) {
            console.warn("Recognition already started or error", e);
        }
    },

    handleSpeechResult(spokenWord) {
        // ลบช่องว่าง และจุด (punctuation) ออก เพื่อให้ทียบได้ง่าย
        const cleanTarget = this.state.targetWord.replace(/\s+/g, '');
        const cleanSpoken = spokenWord.replace(/\s+/g, '');

        console.log(`Target: [${cleanTarget}] | Spoken: [${cleanSpoken}]`);

        // ตรวจสอบความคล้าย
        // อนุญาตให้มีคำต่อท้ายเช่น ครับ/ค่ะ ได้ แต่ความยาวไม่ควรต่างกันเกินไป 
        // เพื่อป้องกันการพูดคำอื่นที่ยาวกว่าแล้วระบบให้ผ่าน
        let isMatch = false;

        const currentItem = this.vocab[this.state.difficulty].find(v => v.word === this.state.targetWord);
        const aliases = currentItem && currentItem.aliases ? currentItem.aliases : [];

        if (cleanSpoken === cleanTarget || aliases.some(alias => cleanSpoken.includes(alias.replace(/\s+/g, '')))) {
            isMatch = true;
        } else if (cleanSpoken.includes(cleanTarget)) {
            // ถ้ายาวกว่าไม่เกิน 5 ตัวอักษร (เผื่อคำลงท้าย ครับ, ค่ะ, จ้ะ) หรือคำเป้าหมายยาวอยู่แล้ว
            if (cleanSpoken.length - cleanTarget.length <= 5 || cleanTarget.length >= 6) {
                isMatch = true;
            }
        }

        if (isMatch) {
            this.wordSuccess(spokenWord);
        } else {
            this.setFeedback(`คุณพูดว่า: "${spokenWord}"<br>ลองใหม่อีกครั้งนะครับ!`, "error");
        }
    },

    wordSuccess(spokenStr) {
        this.feedbackShowingSuccess = true;
        this.playSound('snd-success');

        // คำนวณคะแนนพื้นฐาน + โบนัสท่าทางปาก
        let points = 10;
        let bonus = 0;

        let actionVal = 0;
        let actionName = '';

        if (this.state.expectedAction === 'smile') {
            actionVal = this.state.smileWidth;
            actionName = 'ฉีกยิ้ม';
        } else if (this.state.expectedAction === 'pucker') {
            actionVal = this.state.puckerWidth;
            actionName = 'ทำปากจู๋';
        } else {
            actionVal = this.state.mouthOpenness;
            actionName = 'อ้าปากกว้าง';
        }

        if (this.state.difficulty === 'easy' && actionVal > 40) bonus = 5;
        if (this.state.difficulty === 'normal' && actionVal > 30) bonus = 3;

        const roundScore = points + bonus;
        this.state.score += roundScore;
        this.state.completed += 1;

        let bonusMsg = bonus > 0 ? `<br><small class="text-warning">+โบนัส${actionName} ${bonus} แต้ม!</small>` : "";
        this.setFeedback(`ยอดเยี่ยม! คุณพูดคำว่า "${spokenStr}" ถูกต้อง ${bonusMsg}`, "success");

        this.updateUI();

        setTimeout(() => {
            this.feedbackShowingSuccess = false;
            this.state.currentRound++;
            if (this.state.currentRound > this.state.maxRounds) {
                this.endGame();
            } else {
                this.nextWord();
            }
        }, 2500);
    },

    skipWord() {
        this.state.skipped += 1;
        this.state.currentRound++;
        this.setFeedback("ไม่เป็นไรครับ ข้ามคำนี้ก่อนนะ", "warning");

        setTimeout(() => {
            if (this.state.currentRound > this.state.maxRounds) {
                this.endGame();
            } else {
                this.nextWord();
            }
        }, 1500);
    },

    // --- FaceMesh & Camera ---
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
                if (this.state.currentScreen === 'screen-game') {
                    await this.faceMesh.send({ image: this.els.video });
                }
            },
            width: 640,
            height: 480
        });
    },

    onFaceMeshResults(results) {
        if (!this.state.faceMeshLoaded) {
            this.state.faceMeshLoaded = true;
            const loadingElements = document.querySelectorAll('.camera-overlay');
            loadingElements.forEach(el => el.style.display = 'none');

            // Show start button on calibration screen 
            if (this.state.currentScreen === 'screen-calibration') {
                document.getElementById('btn-calib-action').style.display = 'inline-block';
            }
        }

        let isCalibScreen = this.state.currentScreen === 'screen-calibration';
        const ctx = isCalibScreen ? document.getElementById('calib_canvas').getContext('2d') : this.els.ctx;
        const canvas = isCalibScreen ? document.getElementById('calib_canvas') : this.els.canvas;

        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.state.faceTracked = true;
            const landmarks = results.multiFaceLandmarks[0];

            // Draw lips
            drawConnectors(ctx, landmarks, FACEMESH_LIPS, { color: '#2ECC71', lineWidth: 3 });

            // Calculate mouth openness (distance between upper and lower inner lip)
            const upperLip = landmarks[13];
            const lowerLip = landmarks[14];

            const dx = upperLip.x - lowerLip.x;
            const dy = upperLip.y - lowerLip.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Calculate smile width (distance between left and right mouth corners)
            const leftCorner = landmarks[61];
            const rightCorner = landmarks[291];
            const sx = leftCorner.x - rightCorner.x;
            const sy = leftCorner.y - rightCorner.y;
            const sDistance = Math.sqrt(sx * sx + sy * sy);

            if (this.state.isCalibrating) {
                if (distance > this.state.calibMaxMouth) this.state.calibMaxMouth = distance;
                if (sDistance > this.state.calibMaxSmile) this.state.calibMaxSmile = sDistance;
                if (this.state.calibMinSmile === undefined || sDistance < this.state.calibMinSmile) {
                    this.state.calibMinSmile = sDistance;
                }

                this.state.calibTicks++;
                const totalTicks = 100; // ~3.5 seconds
                const progressPercent = Math.min(100, (this.state.calibTicks / totalTicks) * 100);
                document.getElementById('calib-progress-bar').style.width = `${progressPercent}%`;

                if (this.state.calibTicks >= totalTicks) {
                    this.finishCalibration();
                }
            }

            // Map distance (~0.01 to maximum calibrated) to 0-100%
            let mouthDenominator = Math.max(0.02, this.state.calibMaxMouth - 0.01);
            let openPercent = Math.max(0, Math.min(100, ((distance - 0.01) / mouthDenominator) * 100));
            this.state.mouthOpenness = openPercent;

            // Map smile distance (~0.08 to maximum calibrated) to 0-100%
            let smileDenominator = Math.max(0.02, this.state.calibMaxSmile - 0.08);
            let smilePercent = Math.max(0, Math.min(100, ((sDistance - 0.08) / smileDenominator) * 100));
            this.state.smileWidth = smilePercent;

            // Calculate Pucker Percent
            let minSmile = this.state.calibMinSmile || 0.08;
            let maxPuckerDistance = minSmile * 0.7; // Assume max pucker reduces neutral width by 30%
            let puckerDenominator = Math.max(0.01, minSmile - maxPuckerDistance);
            let puckerPercent = 0;
            if (sDistance < minSmile) {
                puckerPercent = Math.min(100, ((minSmile - sDistance) / puckerDenominator) * 100);
            }
            this.state.puckerWidth = puckerPercent;

            // Update UI based on expected action
            let displayPercent = 0;
            let actionText = '';

            if (this.state.expectedAction === 'smile') {
                displayPercent = smilePercent;
                actionText = 'ฉีกยิ้ม';
            } else if (this.state.expectedAction === 'pucker') {
                displayPercent = puckerPercent;
                actionText = 'ทำปากจู๋';
            } else {
                displayPercent = openPercent;
                actionText = 'อ้าปากกว้าง';
            }

            // Smoothly update bar
            this.els.progressBar.style.width = `${displayPercent}%`;

            if (displayPercent > 60) {
                this.els.progressText.innerText = `${actionText}ดีมาก!`;
                this.els.progressText.classList.add('text-success');
            } else {
                this.els.progressText.innerText = `ท่าทางปาก(${actionText}): ${Math.floor(displayPercent)}%`;
                this.els.progressText.classList.remove('text-success');
            }

        } else {
            this.state.faceTracked = false;
            this.els.progressText.innerText = "มองไม่เห็นใบหน้า กรุณาขยับหน้าเข้ากล้อง";
            this.els.progressText.classList.remove('text-success');
            this.els.progressBar.style.width = `0%`;
        }

        ctx.restore();
    },

    // --- Screen Navigation & Flow ---
    showScreen(screenId) {
        this.els.screens.forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
        this.state.currentScreen = screenId;

        if (screenId === 'screen-game') {
            this.resizeCanvas();
        }
    },

    startGame(difficulty) {
        this.state.difficulty = difficulty;
        this.state.score = 0;
        this.state.currentRound = 1;
        this.state.completed = 0;
        this.state.skipped = 0;

        // Reset calibration values
        this.state.calibMaxMouth = 0.05;
        this.state.calibMaxSmile = 0.10;
        this.state.calibMinSmile = undefined;
        document.getElementById('calib-progress-bar').style.width = '0%';

        const instruction = document.getElementById('calib-instruction');
        if (instruction) {
            instruction.innerText = "กรุณามองกล้องให้เห็นหน้าชัดเจน";
            instruction.className = "text-primary";
        }

        const btnCalib = document.getElementById('btn-calib-action');
        if (btnCalib) {
            btnCalib.style.display = 'none';
        }

        // Start camera if not running
        if (!this.state.cameraGranted) {
            document.getElementById('calib-loading').style.display = 'flex';
            this.camera.start().then(() => {
                this.state.cameraGranted = true;
            }).catch(err => {
                alert("กรุณาอนุญาตให้ใช้งานกล้องและไมโครโฟน");
                console.error(err);
                this.showScreen('screen-home');
                return;
            });
        }

        this.showScreen('screen-calibration');
    },

    doCalibrationAction() {
        this.state.isCalibrating = true;
        this.state.calibTicks = 0;
        this.state.calibMaxMouth = 0;
        this.state.calibMaxSmile = 0;

        const btn = document.getElementById('btn-calib-action');
        if (btn) btn.style.display = 'none';

        const instruction = document.getElementById('calib-instruction');
        if (instruction) {
            instruction.innerText = "กำลังบันทึก... กรุณา 'อ้าปากกว้างๆ' สลับ 'ฉีกยิ้ม'";
            instruction.className = "text-warning pulse-anim";
        }
    },

    finishCalibration() {
        this.state.isCalibrating = false;

        // Ensure minimum values so it doesn't break if face wasn't detected well
        if (this.state.calibMaxMouth < 0.03) this.state.calibMaxMouth = 0.05;
        if (this.state.calibMaxSmile < 0.08) this.state.calibMaxSmile = 0.12;

        console.log("Calibration Fixed: MaxMouth=", this.state.calibMaxMouth, "MaxSmile=", this.state.calibMaxSmile);

        const instruction = document.getElementById('calib-instruction');
        if (instruction) {
            instruction.innerText = "บันทึกค่าสำเร็จ! ระบบพร้อมสำหรับคุณแล้ว";
            instruction.className = "text-success fade-in";
        }

        setTimeout(() => {
            this.showScreen('screen-game');
            this.nextWord();
        }, 1500);
    },

    nextWord() {
        this.updateUI();
        this.setFeedback("กดปุ่มไมโครโฟนแล้วพูดให้ชัดเจน", "default");

        const wordList = this.vocab[this.state.difficulty];
        // Randomly pick a word
        const randomItem = wordList[Math.floor(Math.random() * wordList.length)];

        this.state.targetWord = randomItem.word;
        this.state.expectedAction = randomItem.action || 'open';

        // Update UI Text
        this.els.targetWordText.innerText = randomItem.word;
        this.els.taskInstruction.innerText = randomItem.hint;

        // Auto-start listening after short delay to give user time to read
        setTimeout(() => {
            if (this.state.currentScreen === 'screen-game' && !this.state.isListening && !this.feedbackShowingSuccess) {
                // Optional: auto play speech recognition if wanted
                // this.startListening();
            }
        }, 1000);
    },

    endGame() {
        if (this.state.isListening) {
            try { this.recognition.stop(); } catch (e) { }
        }
        this.showScreen('screen-result');
        this.playSound('snd-cheer');

        document.getElementById('res-score').innerText = this.state.score;
        document.getElementById('res-completed').innerText = this.state.completed;
        document.getElementById('res-skipped').innerText = this.state.skipped;

        // Save History to Database
        if (window.db && window.db.patient) {
            window.db.saveHistory({
                score: this.state.score,
                completed: this.state.completed,
                skipped: this.state.skipped,
                difficulty: this.state.difficulty
            });
        }
    },

    endGameForce() {
        if (confirm("ต้องการจบเกมทันทีหรือไม่?")) {
            this.endGame();
        }
    },

    // --- Helpers ---
    updateUI() {
        this.els.scoreText.innerText = this.state.score;
        this.els.roundText.innerText = `${this.state.currentRound}/${this.state.maxRounds}`;
    },

    setFeedback(htmlText, type) {
        this.els.feedbackBox.innerHTML = htmlText;
        this.els.feedbackBox.className = "feedback-box fade-in";
        if (type === 'success') {
            this.els.feedbackBox.classList.add('feedback-success');
        } else if (type === 'error') {
            this.els.feedbackBox.classList.add('feedback-error');
        }
    },

    playSound(id) {
        const audio = document.getElementById(id);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(e => console.warn("Autoplay audio blocked", e));
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
