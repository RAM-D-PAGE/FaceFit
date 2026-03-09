-- Scripts for setting up the Supabase database for FaceFit Rehab (Production Ready)
-- Instructions: Copy and paste this script into the Supabase SQL Editor and run it.
-- ลบตารางเก่า (ถ้ามี) เพื่อสร้างใหม่ให้พร้อมใช้งานจริง
DROP TABLE IF EXISTS public.exercise_sessions CASCADE;
DROP TABLE IF EXISTS public.exercise_plans CASCADE;
DROP TABLE IF EXISTS public.patient_profiles CASCADE;
DROP TABLE IF EXISTS public.play_history CASCADE;
DROP TABLE IF EXISTS public.vocabulary CASCADE;
DROP TABLE IF EXISTS public.patients CASCADE;
DROP TABLE IF EXISTS public.admins CASCADE;

-- 1. Create Admins Table (สำหรับพยาบาล/นักกายภาพ)
CREATE TABLE public.admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- รหัสผ่านเข้าสู่ระบบหลังบ้าน
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Patients Table (สำหรับผู้ป่วย)
CREATE TABLE public.patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT UNIQUE NOT NULL, -- PIN 4-6 digits ตัวเลขจำง่ายๆ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Patient Profiles (ข้อมูลการฝึกระดับบุคคล)
CREATE TABLE public.patient_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
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
  updated_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 4. Create Vocabulary Table (ชุดคำศัพท์)
CREATE TABLE public.vocabulary (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL,
    hint TEXT NOT NULL,
    action TEXT DEFAULT 'open', -- 'open', 'smile', 'pucker'
    aliases JSONB DEFAULT '[]'::jsonb, -- Array ของคำที่มักพูดเพี้ยน เช่น ["ต๋า", "จ๋า"]
    phonemes JSONB DEFAULT '[]'::jsonb,
    difficulty TEXT NOT NULL, -- 'easy', 'normal', 'hard'
    phase int DEFAULT 3,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Exercise Sessions (ประวัติการฝึกเชิงลึกแต่ละรอบ)
CREATE TABLE public.exercise_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  phase int DEFAULT 3,
  difficulty text DEFAULT 'normal',
  score int DEFAULT 0,
  success_rate float DEFAULT 0,
  avg_mouth_openness float DEFAULT 0,
  avg_lip_symmetry float DEFAULT 0,
  duration_seconds int DEFAULT 0,
  word_results jsonb DEFAULT '[]',
  played_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 6. Create Exercise Plans (แผนการฝึกสั่งโดยพยาบาล)
CREATE TABLE public.exercise_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  target_phase int DEFAULT 1,
  sessions_per_week int DEFAULT 5,
  target_success_rate float DEFAULT 70,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- 7. Row Level Security Policies (ตั้งค่าสิทธิ์ให้เข้าถึงได้จากเว็บแอปแบบ Public)
-- Note: In a real production environment where security is strict, setup proper rules here.
-- For FaceFit WebApp scope utilizing the anon key:
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous all on admins" ON public.admins FOR ALL USING (true);
CREATE POLICY "Allow anonymous all on patients" ON public.patients FOR ALL USING (true);
CREATE POLICY "Allow anonymous all on patient_profiles" ON public.patient_profiles FOR ALL USING (true);
CREATE POLICY "Allow anonymous all on vocabulary" ON public.vocabulary FOR ALL USING (true);
CREATE POLICY "Allow anonymous all on exercise_sessions" ON public.exercise_sessions FOR ALL USING (true);
CREATE POLICY "Allow anonymous all on exercise_plans" ON public.exercise_plans FOR ALL USING (true);

-- 6. Insert Default Data
-- สร้างบัญชีแอดมินเริ่มต้น รหัสผ่านคือ 1234 (ถูกเข้ารหัสเป็น SHA-256 แล้วเพื่อความปลอดภัย)
INSERT INTO public.admins (username, password) VALUES ('admin', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4');

-- ใส่คำศัพท์พื้นฐานสำหรับกายภาพบำบัด (ข้อมูลจริงที่ใช้งานได้เลย)
INSERT INTO public.vocabulary (word, hint, action, aliases, difficulty) VALUES
('อา', 'อ้าปากกว้างๆ', 'open', '["อ้า"]', 'easy'),
('อี', 'ฉีกยิ้มกว้างๆ', 'smile', '["อี้"]', 'easy'),
('ตา', 'อ้าปากกว้างๆ', 'open', '["ต้า", "จา"]', 'easy'),
('ปลา', 'อ้าปากกว้างๆ', 'open', '["ปา", "ป้า"]', 'easy'),
('ดี', 'ฉีกยิ้มกว้างๆ', 'smile', '["ดิ", "บี", "ตี"]', 'easy'),
('กินข้าว', 'พูดเสียงดังฟังชัด', 'open', '["กินคาว", "กิงข้าว"]', 'normal'),
('สบาย', 'ฉีกยิ้มตอนพูด ส-บาย', 'smile', '["สะบาย", "ซะบาย"]', 'normal'),
('รักนะ', 'ฉีกยิ้มเวลาพูด', 'smile', '["ลักนะ", "ลักน่ะ"]', 'normal'),
('วันนี้อากาศดี', 'พูดประโยคให้ต่อเนื่อง (ฉีกยิ้มคำว่า ดี)', 'smile', '["วันนีอากาดดี"]', 'hard'),
('สบายดีไหมครับ', 'พูดประโยคให้ต่อเนื่อง', 'smile', '["สบายดีไหม", "สะบายดีมัย"]', 'hard');
