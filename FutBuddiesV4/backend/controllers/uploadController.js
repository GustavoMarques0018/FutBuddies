// ============================================================
//  FutBuddies - Upload de Imagens
//  - Em produção (Render Free hiberna e perde filesystem):
//    usa Cloudinary se CLOUDINARY_URL ou CLOUDINARY_CLOUD_NAME
//    estiverem definidas. Caso contrário, fallback para disco.
//  - Em dev: usa disco local (uploads/).
// ============================================================

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT  = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];

const fileFilter = (req, file, cb) => {
  const ext  = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  // Accept if either mimetype or extension is whitelisted.
  // iOS Safari sends HEIC photos as image/jpeg (auto-converted) but keeps .heic filename,
  // so checking EITHER is the safest approach.
  if (ALLOWED_MIME.includes(mime) || ALLOWED_EXT.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de ficheiro não suportado. Usa JPG, PNG, GIF ou WebP.'));
};

// ── Cloudinary detection ────────────────────────────────────
let cloudinary = null;
let cloudinaryStorage = null;
let cloudinaryAtivo = false;

const cloudinaryConfigurado = !!(
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (cloudinaryConfigurado) {
  try {
    cloudinary = require('cloudinary').v2;
    if (process.env.CLOUDINARY_URL) {
      // CLOUDINARY_URL=cloudinary://<key>:<secret>@<cloud_name> — auto-config
    } else {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    cloudinaryStorage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: process.env.CLOUDINARY_FOLDER || 'futbuddies',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'],
        transformation: [{ quality: 'auto:good', fetch_format: 'auto' }],
      },
    });
    cloudinaryAtivo = true;
    console.log('✅ Uploads via Cloudinary');
  } catch (e) {
    console.warn('ℹ️  Cloudinary configurado mas modulo falhou ao carregar:', e.message);
  }
} else if (process.env.NODE_ENV === 'production') {
  console.warn('⚠️  Em producao sem Cloudinary — uploads sao perdidos quando o servico hibernar.');
  console.warn('    Define CLOUDINARY_URL no Render para resolver.');
}

// ── Storage de disco (fallback / dev) ──────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, nome);
  },
});

const upload = multer({
  storage: cloudinaryStorage || diskStorage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB — mobile photos can exceed 5 MB
});

// POST /api/upload/imagem — upload de uma imagem
async function uploadImagem(req, res) {
  try {
    if (!req.file)
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhum ficheiro recebido.' });

    let url;
    if (cloudinaryAtivo) {
      // Multer Cloudinary devolve req.file.path como URL HTTPS final.
      url = req.file.path;
    } else {
      // Disco: guarda SEMPRE o caminho relativo /uploads/... para que
      // resolverImgUrl() no frontend possa reconstruir a URL correcta
      // independentemente do host (evita guardar "localhost:5000" em dev
      // ou o host do Render em produção, o que quebraria após redeploy).
      url = `/uploads/${req.file.filename}`;
    }

    res.json({ sucesso: true, url, mensagem: 'Imagem carregada com sucesso!' });
  } catch (err) {
    console.error('[Upload] Erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao fazer upload.' });
  }
}

module.exports = { upload, uploadImagem };
