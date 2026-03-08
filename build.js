const fs = require('fs');

// Vercel จะส่งค่าจากหน้า Environment Variables มาทาง process.env
const dbUrl = process.env.SUPABASE_URL || '';
const dbKey = process.env.SUPABASE_KEY || '';

const configContent = `// ไฟล์ถูกสร้างอัตโนมัติจาก Vercel Build (build.js)
const CONFIG = {
    SUPABASE_URL: '${dbUrl.trim()}',
    SUPABASE_KEY: '${dbKey.trim()}'
};
`;

try {
    fs.writeFileSync('config.js', configContent);
    console.log('Build Success: config.js generated from Environment Variables.');
} catch (err) {
    console.error('Build Error:', err);
    process.exit(1);
}
