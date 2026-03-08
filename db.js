// ตรวจสอบว่ามี Supabase JS library โหลดมาในหน้าจอหรือไม่
if (window.supabase && typeof CONFIG !== 'undefined') {
    window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

const db = {
    patient: null,
    isAdmin: false,

    async login(pin) {
        if (!window.supabaseClient) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('patients')
                .select('*')
                .eq('pin', pin)
                .single();

            if (error || !data) return null;
            this.patient = data;
            this.isAdmin = false;
            return data;
        } catch (e) {
            console.error("Network/DB Error:", e);
            return null;
        }
    },

    async hashPassword(password) {
        const msgBuffer = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    async adminLogin(username, password) {
        if (!window.supabaseClient) return false;
        try {
            const hashedPass = await this.hashPassword(password);

            const { data, error } = await window.supabaseClient
                .from('admins')
                .select('*')
                .eq('username', username)
                .eq('password', hashedPass)
                .single();

            if (error || !data) return false;
            this.isAdmin = true;
            this.patient = null;
            return true;
        } catch (e) {
            console.error("Admin Login Error:", e);
            return false;
        }
    },

    logout() {
        this.patient = null;
        this.isAdmin = false;
    },

    async getVocabulary() {
        if (!window.supabaseClient) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('vocabulary')
                .select('*')
                .eq('is_active', true)
                .order('id', { ascending: true });

            if (error || !data) return null;

            let loadedVocab = { easy: [], normal: [], hard: [] };
            data.forEach(item => {
                let diff = item.difficulty.toLowerCase();
                if (loadedVocab[diff]) {
                    loadedVocab[diff].push({
                        id: item.id,
                        word: item.word,
                        hint: item.hint,
                        action: item.action || 'open',
                        aliases: typeof item.aliases === 'string' ? JSON.parse(item.aliases) : (item.aliases || [])
                    });
                }
            });
            if (loadedVocab.easy.length > 0 || loadedVocab.normal.length > 0 || loadedVocab.hard.length > 0) {
                return loadedVocab;
            }
            return null;
        } catch (e) {
            console.error("Exception getting vocab:", e);
            return null;
        }
    },

    async saveHistory(historyData) {
        if (!window.supabaseClient || !this.patient) return false;
        try {
            const { error } = await window.supabaseClient
                .from('play_history')
                .insert([{
                    patient_id: this.patient.id,
                    score: historyData.score,
                    completed: historyData.completed,
                    skipped: historyData.skipped,
                    difficulty: historyData.difficulty,
                    played_at: new Date().toISOString()
                }]);
            return !error;
        } catch (e) {
            return false;
        }
    },

    // --- Admin Functions ---
    async getPatientsList() {
        if (!window.supabaseClient) return [];
        const { data } = await window.supabaseClient.from('patients').select('*').order('created_at', { ascending: false });
        if (data) {
            for (let i = 0; i < data.length; i++) {
                const { count } = await window.supabaseClient.from('play_history').select('*', { count: 'exact', head: true }).eq('patient_id', data[i].id);
                data[i].totalPlaySessions = count || 0;
            }
        }
        return data || [];
    },

    async addPatient(name, pin) {
        if (!window.supabaseClient) return false;
        const { error } = await window.supabaseClient.from('patients').insert([{ name, pin }]);
        return !error;
    },

    async deletePatient(id) {
        if (!window.supabaseClient) return false;
        const { error } = await window.supabaseClient.from('patients').delete().eq('id', id);
        return !error;
    },

    async getAllVocabRaw() {
        if (!window.supabaseClient) return [];
        const { data } = await window.supabaseClient.from('vocabulary').select('*').order('difficulty', { ascending: true }).order('id', { ascending: true });
        return data || [];
    },

    async addVocab(word, hint, action, difficulty, aliasesString) {
        if (!window.supabaseClient) return false;
        let aliasesArray = [];
        if (aliasesString) {
            aliasesArray = aliasesString.split(',').map(s => s.trim()).filter(s => s);
        }
        const { error } = await window.supabaseClient.from('vocabulary').insert([{
            word, hint, action, difficulty,
            aliases: aliasesArray,
            is_active: true
        }]);
        return !error;
    },

    async deleteVocab(id) {
        if (!window.supabaseClient) return false;
        const { error } = await window.supabaseClient.from('vocabulary').delete().eq('id', id);
        return !error;
    }
};

window.db = db;
