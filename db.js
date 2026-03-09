/**
 * FaceFit DB Layer v2.0
 * Supabase integration — patients, profiles, exercise_sessions, exercise_plans, vocabulary
 */

if (window.supabase && typeof CONFIG !== 'undefined') {
  window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
}

const db = {
  patient: null,
  isAdmin: false,
  profile: null,

  // ─── Auth ─────────────────────────────────────────────────────────────────
  async login(pin) {
    if (!window.supabaseClient) return null;
    try {
      const { data, error } = await window.supabaseClient
        .from('patients').select('*').eq('pin', pin).single();
      if (error || !data) return null;
      this.patient = data;
      this.isAdmin = false;
      await this.loadProfile();
      await this.updateStreak();
      return data;
    } catch (e) { console.error('Login error:', e); return null; }
  },

  async hashPassword(pw) {
    const buf = new TextEncoder().encode(pw);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async adminLogin(username, password) {
    if (!window.supabaseClient) return false;
    try {
      const hashed = await this.hashPassword(password);
      const { data, error } = await window.supabaseClient
        .from('admins').select('*').eq('username', username).eq('password', hashed).single();
      if (error || !data) return false;
      this.isAdmin = true; this.patient = null; return true;
    } catch (e) { return false; }
  },

  logout() { this.patient = null; this.isAdmin = false; this.profile = null; },

  // ─── Patient Profile ───────────────────────────────────────────────────────
  async loadProfile() {
    if (!window.supabaseClient || !this.patient) return null;
    try {
      const { data } = await window.supabaseClient
        .from('patient_profiles').select('*').eq('patient_id', this.patient.id).single();
      if (data) {
        this.profile = data;
      } else {
        // Create default profile
        const { data: newProfile } = await window.supabaseClient
          .from('patient_profiles').insert([{
            patient_id: this.patient.id,
            rehab_phase: 1,
            weak_phonemes: [],
            avg_lip_symmetry: 75,
            avg_mouth_openness: 50,
            streak_days: 0,
            last_session_date: null,
            total_sessions: 0,
            best_score: 0,
          }]).select().single();
        this.profile = newProfile;
      }
      return this.profile;
    } catch (e) { console.error('Profile load error:', e); return null; }
  },

  async updateProfile(updates) {
    if (!window.supabaseClient || !this.patient) return false;
    try {
      const { error } = await window.supabaseClient
        .from('patient_profiles').update({ ...updates, updated_at: new Date().toISOString() })
        .eq('patient_id', this.patient.id);
      if (!error && this.profile) Object.assign(this.profile, updates);
      return !error;
    } catch (e) { return false; }
  },

  async updateStreak() {
    if (!this.profile) return;
    const today = new Date().toDateString();
    const lastDate = this.profile.last_session_date
      ? new Date(this.profile.last_session_date).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    let streak = this.profile.streak_days || 0;
    if (lastDate === today) return; // already logged today
    if (lastDate === yesterday) streak += 1;
    else if (lastDate !== today) streak = 1; // reset

    await this.updateProfile({ streak_days: streak, last_session_date: new Date().toISOString() });
  },

  // ─── Vocabulary ────────────────────────────────────────────────────────────
  async getVocabulary() {
    if (!window.supabaseClient) return null;
    try {
      const { data, error } = await window.supabaseClient
        .from('vocabulary').select('*').eq('is_active', true).order('id', { ascending: true });
      if (error || !data) return null;
      let vocab = { easy: [], normal: [], hard: [] };
      data.forEach(item => {
        const d = item.difficulty?.toLowerCase();
        if (vocab[d]) vocab[d].push({
          id: item.id, word: item.word, hint: item.hint,
          action: item.action || 'open',
          phase: item.phase || 3,
          phonemes: item.phonemes || [],
          aliases: typeof item.aliases === 'string' ? JSON.parse(item.aliases) : (item.aliases || [])
        });
      });
      return (vocab.easy.length || vocab.normal.length || vocab.hard.length) ? vocab : null;
    } catch (e) { return null; }
  },

  // ─── Exercise Sessions ─────────────────────────────────────────────────────
  async saveSession(sessionData) {
    if (!window.supabaseClient || !this.patient) return false;
    try {
      const { error } = await window.supabaseClient.from('exercise_sessions').insert([{
        patient_id: this.patient.id,
        phase: sessionData.phase,
        difficulty: sessionData.difficulty,
        score: sessionData.score,
        success_rate: sessionData.successRate,
        avg_mouth_openness: sessionData.avgMouthOpenness,
        avg_lip_symmetry: sessionData.avgLipSymmetry,
        duration_seconds: sessionData.durationSeconds,
        word_results: sessionData.wordResults,
        played_at: new Date().toISOString()
      }]);

      // Update profile stats
      const updates = {
        total_sessions: (this.profile?.total_sessions || 0) + 1,
        best_score: Math.max(this.profile?.best_score || 0, sessionData.score),
      };

      // Update weak phonemes based on word results
      const failedWords = sessionData.wordResults?.filter(w => !w.passed) || [];
      const weakPhonemes = this.profile?.weak_phonemes || [];
      failedWords.forEach(w => {
        (w.phonemes || []).forEach(p => {
          if (!weakPhonemes.includes(p)) weakPhonemes.push(p);
        });
      });
      if (weakPhonemes.length > 10) weakPhonemes.splice(0, weakPhonemes.length - 10);
      updates.weak_phonemes = weakPhonemes;
      updates.avg_lip_symmetry = Math.round(
        ((this.profile?.avg_lip_symmetry || 75) * 0.7) + (sessionData.avgLipSymmetry * 0.3)
      );
      updates.avg_mouth_openness = Math.round(
        ((this.profile?.avg_mouth_openness || 50) * 0.7) + (sessionData.avgMouthOpenness * 0.3)
      );

      await this.updateProfile(updates);

      // ── Automation Webhook (n8n, Make, etc.) ─────────────────────────────
      if (CONFIG && CONFIG.ENABLE_WEBHOOKS && CONFIG.WEBHOOK_URL) {
        try {
          const webhookData = {
            event: 'session_completed',
            patient_id: this.patient.id,
            patient_name: this.patient.name,
            timestamp: new Date().toISOString(),
            session_stats: {
              phase: sessionData.phase,
              difficulty: sessionData.difficulty,
              score: sessionData.score,
              success_rate: sessionData.successRate,
              duration_seconds: sessionData.durationSeconds,
              avg_mouth_openness: sessionData.avgMouthOpenness,
              avg_lip_symmetry: sessionData.avgLipSymmetry
            },
            profile_updates: updates
          };

          fetch(CONFIG.WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookData),
            // Use no-cors or ignore response to not block the UI
            mode: 'no-cors'
          }).catch(e => console.warn('[FaceFit] Webhook trigger failed:', e));
        } catch (e) {
          console.warn('[FaceFit] Failed to prepare webhook data:', e);
        }
      }

      return !error;
    } catch (e) { return false; }
  },

  async getSessionHistory(patientId, limit = 20) {
    if (!window.supabaseClient) return [];
    const pid = patientId || this.patient?.id;
    if (!pid) return [];
    try {
      const { data } = await window.supabaseClient
        .from('exercise_sessions').select('*')
        .eq('patient_id', pid).order('played_at', { ascending: false }).limit(limit);
      return data || [];
    } catch (e) { return []; }
  },

  // ─── Exercise Plans (Nurse) ────────────────────────────────────────────────
  async getActivePlan() {
    if (!window.supabaseClient || !this.patient) return null;
    try {
      const { data } = await window.supabaseClient
        .from('exercise_plans').select('*')
        .eq('patient_id', this.patient.id).eq('is_active', true)
        .order('created_at', { ascending: false }).limit(1).single();
      return data || null;
    } catch (e) { return null; }
  },

  // ─── Admin: Patient Management ─────────────────────────────────────────────
  async getPatientsList() {
    if (!window.supabaseClient) return [];
    try {
      const { data } = await window.supabaseClient
        .from('patients').select('*').order('created_at', { ascending: false });
      if (!data) return [];
      for (let p of data) {
        const { count } = await window.supabaseClient
          .from('exercise_sessions').select('*', { count: 'exact', head: true }).eq('patient_id', p.id);
        p.totalPlaySessions = count || 0;

        const { data: profile } = await window.supabaseClient
          .from('patient_profiles').select('*').eq('patient_id', p.id).single();
        p.profile = profile || null;
      }
      return data;
    } catch (e) { return []; }
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

  // ─── Admin: Analytics ─────────────────────────────────────────────────────
  async getDashboardStats(patientId) {
    if (!window.supabaseClient) return null;
    try {
      const { data: sessions } = await window.supabaseClient
        .from('exercise_sessions').select('*')
        .eq('patient_id', patientId).order('played_at', { ascending: true }).limit(30);

      const { data: profile } = await window.supabaseClient
        .from('patient_profiles').select('*').eq('patient_id', patientId).single();

      return { sessions: sessions || [], profile: profile || null };
    } catch (e) { return null; }
  },

  async getAllPatientsStats() {
    if (!window.supabaseClient) return [];
    try {
      const { data: patients } = await window.supabaseClient
        .from('patients').select('id, name');
      if (!patients) return [];
      const result = [];
      for (const p of patients) {
        const stats = await this.getDashboardStats(p.id);
        result.push({ ...p, ...stats });
      }
      return result;
    } catch (e) { return []; }
  },

  async addExercisePlan(patientId, plan) {
    if (!window.supabaseClient) return false;
    // Deactivate old plan
    await window.supabaseClient.from('exercise_plans')
      .update({ is_active: false }).eq('patient_id', patientId);
    const { error } = await window.supabaseClient.from('exercise_plans').insert([{
      patient_id: patientId, ...plan, is_active: true,
      created_at: new Date().toISOString()
    }]);
    return !error;
  },

  // ─── Vocab Management ──────────────────────────────────────────────────────
  async getAllVocabRaw() {
    if (!window.supabaseClient) return [];
    const { data } = await window.supabaseClient
      .from('vocabulary').select('*').order('difficulty').order('id');
    return data || [];
  },

  async addVocab(word, hint, action, difficulty, aliasesString, phase = 3) {
    if (!window.supabaseClient) return false;
    const aliases = aliasesString
      ? aliasesString.split(',').map(s => s.trim()).filter(Boolean) : [];
    const { error } = await window.supabaseClient.from('vocabulary').insert([{
      word, hint, action, difficulty, aliases, phase, is_active: true
    }]);
    return !error;
  },

  async deleteVocab(id) {
    if (!window.supabaseClient) return false;
    const { error } = await window.supabaseClient.from('vocabulary').delete().eq('id', id);
    return !error;
  },

  // ─── Supabase SQL Init Helper ──────────────────────────────────────────────
  getInitSQL() {
    return `
-- Run in Supabase SQL Editor to create new tables

CREATE TABLE IF NOT EXISTS patient_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  rehab_phase int DEFAULT 1 CHECK (rehab_phase BETWEEN 1 AND 5),
  weak_phonemes jsonb DEFAULT '[]',
  avg_lip_symmetry float DEFAULT 75,
  avg_mouth_openness float DEFAULT 50,
  streak_days int DEFAULT 0,
  last_session_date timestamptz,
  total_sessions int DEFAULT 0,
  best_score int DEFAULT 0,
  family_notify_email text,
  notes text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  phase int DEFAULT 3,
  difficulty text DEFAULT 'normal',
  score int DEFAULT 0,
  success_rate float DEFAULT 0,
  avg_mouth_openness float DEFAULT 0,
  avg_lip_symmetry float DEFAULT 0,
  duration_seconds int DEFAULT 0,
  word_results jsonb DEFAULT '[]',
  played_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
  target_phase int DEFAULT 1,
  sessions_per_week int DEFAULT 5,
  target_success_rate float DEFAULT 70,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Add phase column to vocabulary if not exists
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS phase int DEFAULT 3;
ALTER TABLE vocabulary ADD COLUMN IF NOT EXISTS phonemes jsonb DEFAULT '[]';
    `.trim();
  }
};

window.db = db;