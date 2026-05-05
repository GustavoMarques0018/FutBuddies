// ============================================================
//  FutBuddies - Controlador de Autenticação
//  POST /api/auth/registar
//  POST /api/auth/login
//  POST /api/auth/refresh
//  GET  /api/auth/me
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Gerar tokens JWT
function gerarTokens(utilizador) {
  const payload = {
    id: utilizador.id,
    email: utilizador.email,
    nome: utilizador.nome,
    role: utilizador.role,
  };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(
    { id: utilizador.id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
}

// POST /api/auth/registar
async function registar(req, res) {
  try {
    const { nome, email, password, referralCode } = req.body;

    if (!nome || !email || !password) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nome, email e password são obrigatórios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ sucesso: false, mensagem: 'A password deve ter pelo menos 6 caracteres.' });
    }

    // Verificar se email já existe
    const existente = await query(
      'SELECT id FROM utilizadores WHERE email = @email',
      { email }
    );
    if (existente.recordset.length > 0) {
      return res.status(409).json({ sucesso: false, mensagem: 'Este email já está registado.' });
    }

    // Procurar referrer pelo código (case-insensitive)
    let referidoPor = null;
    if (referralCode) {
      try {
        const r = await query(
          `SELECT id FROM utilizadores WHERE UPPER(referral_code) = UPPER(@code)`,
          { code: String(referralCode).trim() }
        );
        if (r.recordset.length > 0) referidoPor = r.recordset[0].id;
      } catch { /* coluna pode ainda não existir em DBs antigas */ }
    }

    // Hash da password
    const passwordHash = await bcrypt.hash(password, 12);

    // Gerar código de referral próprio (UPPER 4 letras + timestamp curto)
    const slug = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '')
                  .replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'USER';
    const codigo = `${slug}${Date.now().toString(36).slice(-4).toUpperCase()}`;

    // Inserir utilizador (graceful degrade se as colunas novas não existirem)
    let resultado;
    try {
      resultado = await query(
        `INSERT INTO utilizadores (nome, email, password_hash, role, referral_code, referido_por, created_at, updated_at)
         OUTPUT INSERTED.id, INSERTED.nome, INSERTED.email, INSERTED.role
         VALUES (@nome, @email, @passwordHash, 'user', @codigo, @ref, GETUTCDATE(), GETUTCDATE())`,
        { nome, email, passwordHash, codigo, ref: referidoPor }
      );
    } catch (eRef) {
      console.warn('[Auth] insert com referral falhou, fallback sem colunas novas:', eRef.message);
      resultado = await query(
        `INSERT INTO utilizadores (nome, email, password_hash, role, created_at, updated_at)
         OUTPUT INSERTED.id, INSERTED.nome, INSERTED.email, INSERTED.role
         VALUES (@nome, @email, @passwordHash, 'user', GETUTCDATE(), GETUTCDATE())`,
        { nome, email, passwordHash }
      );
    }

    const novoUtilizador = resultado.recordset[0];
    const { accessToken, refreshToken } = gerarTokens(novoUtilizador);

    // Guardar refresh token
    await query(
      `INSERT INTO refresh_tokens (utilizador_id, token, expires_at)
       VALUES (@id, @token, DATEADD(DAY, 7, GETUTCDATE()))`,
      { id: novoUtilizador.id, token: refreshToken }
    );

    // Notifica o referrer (se aplicável) — best-effort, não bloqueia
    if (referidoPor) {
      try {
        const { criarNotificacao } = require('./notificacoesController');
        criarNotificacao({
          utilizadorId: referidoPor,
          tipo: 'sistema',
          titulo: '🎉 Alguém usou o teu convite!',
          mensagem: `${nome} criou uma conta a partir do teu link de convite. Obrigado por trazer mais jogadores ao FutBuddies!`,
          acaoUrl: '/perfil',
        }).catch(() => {});
      } catch { /* notif controller pode não estar disponível */ }
    }

    res.status(201).json({
      sucesso: true,
      mensagem: 'Conta criada com sucesso!',
      utilizador: {
        id: novoUtilizador.id,
        nome: novoUtilizador.nome,
        email: novoUtilizador.email,
        role: novoUtilizador.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Erro no registo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ sucesso: false, mensagem: 'Email e password são obrigatórios.' });
    }

    // Buscar utilizador
    const resultado = await query(
      `SELECT id, nome, email, password_hash, role, ativo, nickname, foto_url
       FROM utilizadores WHERE email = @email`,
      { email }
    );

    if (resultado.recordset.length === 0) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    const utilizador = resultado.recordset[0];

    if (!utilizador.ativo) {
      return res.status(403).json({ sucesso: false, mensagem: 'Conta desativada. Contacta o administrador.' });
    }

    // Verificar password
    const passwordValida = await bcrypt.compare(password, utilizador.password_hash);
    if (!passwordValida) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    // Atualizar último login
    await query(
      'UPDATE utilizadores SET ultimo_login = GETUTCDATE() WHERE id = @id',
      { id: utilizador.id }
    );

    const { accessToken, refreshToken } = gerarTokens(utilizador);

    // Guardar refresh token
    await query(
      `INSERT INTO refresh_tokens (utilizador_id, token, expires_at)
       VALUES (@id, @token, DATEADD(DAY, 7, GETUTCDATE()))`,
      { id: utilizador.id, token: refreshToken }
    );

    res.json({
      sucesso: true,
      mensagem: 'Login efetuado com sucesso!',
      utilizador: {
        id: utilizador.id,
        nome: utilizador.nome,
        email: utilizador.email,
        role: utilizador.role,
        nickname: utilizador.nickname,
        foto_url: utilizador.foto_url,
      },
      accessToken,
      refreshToken,
    });
  } catch (err) {
    console.error('[Auth] Erro no login:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/auth/refresh
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ sucesso: false, mensagem: 'Refresh token não fornecido.' });
    }

    // Verificar se token existe e não foi revogado
    const tokenDB = await query(
      `SELECT rt.id, rt.utilizador_id, u.nome, u.email, u.role
       FROM refresh_tokens rt
       JOIN utilizadores u ON rt.utilizador_id = u.id
       WHERE rt.token = @token AND rt.revogado = 0 AND rt.expires_at > GETUTCDATE()`,
      { token: refreshToken }
    );

    if (tokenDB.recordset.length === 0) {
      return res.status(401).json({ sucesso: false, mensagem: 'Refresh token inválido ou expirado.' });
    }

    // Verificar assinatura JWT
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    const utilizador = tokenDB.recordset[0];

    // Revogar token antigo e criar novo
    await query('UPDATE refresh_tokens SET revogado = 1 WHERE id = @id', { id: utilizador.id });

    const tokens = gerarTokens(utilizador);

    await query(
      `INSERT INTO refresh_tokens (utilizador_id, token, expires_at)
       VALUES (@id, @token, DATEADD(DAY, 7, GETUTCDATE()))`,
      { id: utilizador.utilizador_id, token: tokens.refreshToken }
    );

    res.json({ sucesso: true, ...tokens });
  } catch (err) {
    res.status(401).json({ sucesso: false, mensagem: 'Token inválido.' });
  }
}

// GET /api/auth/me
async function me(req, res) {
  try {
    const resultado = await query(
      `SELECT id, nome, email, role, nickname, posicao, cidade, bio, foto_url, pe_preferido, regiao,
              total_jogos, total_golos, total_assistencias, user_role, created_at, ultimo_login
       FROM utilizadores WHERE id = @id`,
      { id: req.utilizador.id }
    );

    if (resultado.recordset.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: 'Utilizador não encontrado.' });
    }

    res.json({ sucesso: true, utilizador: resultado.recordset[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('UPDATE refresh_tokens SET revogado = 1 WHERE token = @token', { token: refreshToken });
    }
    res.json({ sucesso: true, mensagem: 'Logout efetuado com sucesso.' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

module.exports = { registar, login, refresh, me, logout };
