// ============================================================
//  FutBuddies - Middleware de Autenticação
// ============================================================

const jwt = require('jsonwebtoken');

// Autenticação obrigatória
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ sucesso: false, mensagem: 'Token não fornecido.', expirado: false });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.utilizador = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const expirado = err.name === 'TokenExpiredError';
    return res.status(401).json({ sucesso: false, mensagem: expirado ? 'Token expirado.' : 'Token inválido.', expirado });
  }
}

// Autenticação opcional — popula req.utilizador se token válido, senão null
function autenticarOpcional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.utilizador = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    req.utilizador = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    req.utilizador = null;
  }
  next();
}

// Verificar se é admin
function isAdmin(req, res, next) {
  if (!req.utilizador || req.utilizador.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado. Apenas administradores.' });
  }
  next();
}

module.exports = { autenticar, autenticarOpcional, isAdmin };
