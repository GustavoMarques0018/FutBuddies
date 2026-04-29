// ============================================================
//  FutBuddies - Upload de Imagens
// ============================================================

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configuração do multer — guarda em disco com nome único
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const nome = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, nome);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Tipo de ficheiro não suportado. Usa JPG, PNG, GIF ou WebP.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// POST /api/upload/imagem — upload de uma imagem
async function uploadImagem(req, res) {
  try {
    if (!req.file)
      return res.status(400).json({ sucesso: false, mensagem: 'Nenhum ficheiro recebido.' });

    // Em produção devolvemos URL absoluta (frontend está noutro domínio).
    // Em dev mantemos relativa para o frontend conseguir reescrever via resolverImgUrl.
    const baseUrl = process.env.PUBLIC_BASE_URL
      || (process.env.NODE_ENV === 'production'
          ? `${req.protocol}://${req.get('host')}`
          : '');
    const url = `${baseUrl}/uploads/${req.file.filename}`;
    res.json({ sucesso: true, url, mensagem: 'Imagem carregada com sucesso!' });
  } catch (err) {
    console.error('[Upload] Erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao fazer upload.' });
  }
}

module.exports = { upload, uploadImagem };
