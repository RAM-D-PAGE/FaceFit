const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir);
}

// 1x1 transparent PNG
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
fs.writeFileSync(path.join(assetsDir, 'logo.png'), Buffer.from(pngBase64, 'base64'));

// Minimal valid silent mp3
const mp3Base64 = "SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIwBRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRUVFRVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3d3QAAP/zRAQAABM2oAAAEAKV+f951wA1wKAA//NEBQAABaWIAgAAwAAMAAwAAAQA//NEBRQAADaEAAAAwAAAUMAAAEB///NEBSQAABCEAAAAwAARQIAAAEB//zREUAAA==";
fs.writeFileSync(path.join(assetsDir, 'success-sound.mp3'), Buffer.from(mp3Base64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'cheer-voice.mp3'), Buffer.from(mp3Base64, 'base64'));

console.log("Assets created");
