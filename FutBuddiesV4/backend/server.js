// ============================================================
//  FutBuddies - Servidor Principal
//  Node.js + Express.js + Socket.IO + SQL Server
//  Iniciar: npm run dev
// ============================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { getPool } = require('./config/database');
const path = require('path');
const routes = require('./routes/index');
const { iniciarScheduler } = require('./jobs/scheduler');

// ── Validações de arranque (fail-fast) ────────────────────
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  console.error('❌ JWT_SECRET e JWT_REFRESH_SECRET são obrigatórios. Define-os no .env.');
  process.exit(1);
}
if (isProd && (process.env.JWT_SECRET.length < 32 || process.env.JWT_REFRESH_SECRET.length < 32)) {
  console.error('❌ Em produção JWT_SECRET/JWT_REFRESH_SECRET devem ter pelo menos 32 caracteres.');
  process.exit(1);
}
if (isProd && !process.env.CORS_ORIGIN) {
  console.error('❌ Em produção CORS_ORIGIN é obrigatório (lista separada por vírgulas).');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// ── CORS ──────────────────────────────────────────────────
// Em dev: aceita qualquer origem se CORS_ORIGIN não estiver definido.
// Em prod: lista estrita (separada por vírgulas).
const corsAllowList = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOrigin = isProd
  ? (origin, cb) => {
      // Permite requests server-to-server / curl (sem origin)
      if (!origin) return cb(null, true);
      if (corsAllowList.includes(origin)) return cb(null, true);
      return cb(new Error(`Origem não permitida pelo CORS: ${origin}`));
    }
  : (corsAllowList.length ? corsAllowList : true);

// ── Socket.IO ─────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Autenticação Socket.IO via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Token não fornecido'));

  try {
    socket.utilizador = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new Error('Token inválido'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket ligado: ${socket.utilizador.nome} (${socket.id})`);

  // Entrar na sala pessoal (para chat privado)
  socket.join(`user_${socket.utilizador.id}`);

  // Mensagem privada em tempo real
  socket.on('mensagem_privada', (data) => {
    const { destinatarioId, mensagem, id } = data;
    if (!mensagem || !destinatarioId) return;
    io.to(`user_${destinatarioId}`).emit('nova_mensagem_privada', {
      id: id || Date.now(),
      remetente_id: socket.utilizador.id,
      destinatario_id: destinatarioId,
      mensagem: mensagem.trim().substring(0, 1000),
      created_at: new Date(),
      remetente_nome: socket.utilizador.nome,
    });
  });

  // Entrar na sala do jogo
  socket.on('entrar_jogo', (jogoId) => {
    socket.join(`jogo_${jogoId}`);
    console.log(`👥 ${socket.utilizador.nome} entrou no jogo ${jogoId}`);
  });

  // Sair da sala do jogo
  socket.on('sair_jogo', (jogoId) => {
    socket.leave(`jogo_${jogoId}`);
  });

  // Enviar mensagem de chat em tempo real
  socket.on('chat_mensagem', (data) => {
    const { jogoId, mensagem } = data;
    if (!mensagem || mensagem.trim().length === 0) return;

    const novaMensagem = {
      id: Date.now(),
      mensagem: mensagem.trim().substring(0, 500),
      tipo: 'texto',
      created_at: new Date(),
      utilizador_id: socket.utilizador.id,
      utilizador_nome: socket.utilizador.nome,
    };

    // Emitir para todos na sala do jogo
    io.to(`jogo_${jogoId}`).emit('nova_mensagem', novaMensagem);
  });

  // ── Chat de Equipa ──────────────────────────────
  socket.on('entrar_equipa', (equipaId) => {
    socket.join(`equipa_${equipaId}`);
    console.log(`👥 ${socket.utilizador.nome} entrou no chat da equipa ${equipaId}`);
  });

  socket.on('sair_equipa', (equipaId) => {
    socket.leave(`equipa_${equipaId}`);
  });

  socket.on('chat_equipa_mensagem', (data) => {
    const { equipaId, mensagem } = data;
    if (!mensagem || mensagem.trim().length === 0) return;

    const novaMensagem = {
      id: Date.now(),
      mensagem: mensagem.trim().substring(0, 500),
      tipo: 'texto',
      created_at: new Date(),
      utilizador_id: socket.utilizador.id,
      utilizador_nome: socket.utilizador.nome,
      nickname: socket.utilizador.nickname || null,
    };

    io.to(`equipa_${equipaId}`).emit('nova_mensagem_equipa', novaMensagem);
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket desligado: ${socket.utilizador.nome}`);
  });
});

// ── Middlewares ────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));
// ⚠️ Webhook Stripe TEM de ser registado ANTES do express.json()
// para que o body permaneça raw (Buffer) — necessário para validar a assinatura.
const stripeCtrl = require('./controllers/stripeController');
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeCtrl.webhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────
// Em desenvolvimento queremos limites altíssimos (a Navbar, sineta de
// notificações e hot-reload do React fazem dezenas de chamadas/min).
// Em produção mantemos os limites apertados para travar abuso.
const isDev = process.env.NODE_ENV !== 'production';

// Endpoints que fazem polling natural (notificações, badges) podem
// disparar muito tráfego legítimo. Só os contamos no rate-limit em
// produção para não bloquear a UI durante desenvolvimento.
const skipPollingEmDev = (req) => {
  if (!isDev) return false;
  const url = req.originalUrl || req.url || '';
  // Lista de endpoints "ruidosos" que toda a UI bate em background.
  return /\/(notificacoes|push|utilizadores\/me|carteira|conquistas)/.test(url);
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,                        // 15 minutos
  max: isDev ? 5000 : 200,                          // dev: 5000  /  prod: 200
  standardHeaders: true,                            // expõe RateLimit-* headers
  legacyHeaders: false,
  skip: skipPollingEmDev,
  message: { sucesso: false, mensagem: 'Demasiadas requisições. Tenta novamente mais tarde.' },
});
app.use('/api/', limiter);

// Rate limiting mais restrito para auth — em dev relaxamos para
// permitir testes com os botões de "login rápido".
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 200 : 10,                            // dev: 200   /  prod: 10
  standardHeaders: true,
  legacyHeaders: false,
  // Em dev não conta logins falhados (assim botões de teste não somam)
  skipSuccessfulRequests: false,
  skipFailedRequests: isDev,
  message: { sucesso: false, mensagem: 'Demasiadas tentativas de login. Aguarda 15 minutos.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registar', authLimiter);

if (isDev) {
  console.log('🧪 Modo DEV — rate limits relaxados (5000/15min global, 200/15min auth).');
}

// ── Servir uploads estáticos ──────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rotas ──────────────────────────────────────────────────
app.use('/api', routes);

// Rota de boas-vindas
app.get('/', (req, res) => {
  res.json({
    nome: 'FutBuddies API',
    versao: '1.0.0',
    documentacao: '/api/health',
    stack: 'Node.js + Express.js + SQL Server',
  });
});

// Rota 404
app.use((req, res) => {
  res.status(404).json({ sucesso: false, mensagem: 'Rota não encontrada.' });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  console.error('[Erro Global]', err);
  res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
});

// ── Iniciar servidor ───────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function iniciar() {
  try {
    // Testar ligação à base de dados
    const pool = await getPool();

    // Migração ad-hoc: remover CHECK constraint antigo em jogos.tipo_jogo
    // (impedia formatos como 6x6, 8x8 — agora validados dinamicamente via campo.lotacoes_json)
    try {
      await pool.request().query(`
        DECLARE @ck sysname;
        SELECT @ck = name FROM sys.check_constraints
         WHERE parent_object_id = OBJECT_ID('dbo.jogos')
           AND definition LIKE '%tipo_jogo%';
        IF @ck IS NOT NULL
          EXEC('ALTER TABLE dbo.jogos DROP CONSTRAINT ' + @ck);
      `);
      console.log('✅ CHECK constraint de tipo_jogo removido (se existia)');
    } catch (e) {
      console.warn('⚠️  Falha a remover CHECK de tipo_jogo:', e.message);
    }

    // Migração: fotos_json em campos (galeria) + nota_admin_extra em campo_candidaturas
    try {
      await pool.request().query(`
        IF COL_LENGTH('dbo.campos','fotos_json') IS NULL
          ALTER TABLE dbo.campos ADD fotos_json NVARCHAR(MAX) NULL;
        IF COL_LENGTH('dbo.campos','descricao') IS NULL
          ALTER TABLE dbo.campos ADD descricao NVARCHAR(1000) NULL;
      `);
      console.log('✅ Coluna fotos_json/descricao garantida em campos');
    } catch (e) {
      console.warn('⚠️  Falha a criar colunas fotos_json/descricao:', e.message);
    }

    // Migração: tabela avaliacoes_campo (rating + comentário por utilizador, por jogo)
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.avaliacoes_campo','U') IS NULL
          CREATE TABLE dbo.avaliacoes_campo (
            id INT IDENTITY(1,1) PRIMARY KEY,
            campo_id INT NOT NULL,
            jogo_id INT NOT NULL,
            utilizador_id INT NOT NULL,
            rating INT NOT NULL,
            comentario NVARCHAR(1000) NULL,
            reportar BIT NOT NULL DEFAULT 0,
            motivo_report NVARCHAR(500) NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT UQ_aval_jogo_user UNIQUE (jogo_id, utilizador_id)
          );
        IF COL_LENGTH('dbo.jogos','avaliacao_campo_pedida') IS NULL
          ALTER TABLE dbo.jogos ADD avaliacao_campo_pedida BIT NOT NULL DEFAULT 0;
      `);
      console.log('✅ Tabela avaliacoes_campo garantida');
    } catch (e) {
      console.warn('⚠️  Falha a criar tabela avaliacoes_campo:', e.message);
    }

    // Migração: campos_favoritos + jogos.jogo_pai_id (para "Repetir jogo")
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.campos_favoritos','U') IS NULL
          CREATE TABLE dbo.campos_favoritos (
            utilizador_id INT NOT NULL,
            campo_id      INT NOT NULL,
            created_at    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT PK_campos_favoritos PRIMARY KEY (utilizador_id, campo_id)
          );
        IF COL_LENGTH('dbo.jogos','jogo_pai_id') IS NULL
          ALTER TABLE dbo.jogos ADD jogo_pai_id INT NULL;
      `);
      console.log('✅ campos_favoritos + jogos.jogo_pai_id garantidos');
    } catch (e) {
      console.warn('⚠️  Falha a criar campos_favoritos/jogo_pai_id:', e.message);
    }

    // Migração: MVP voting + waitlist + checkin + no_show counter
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.mvp_votos','U') IS NULL
          CREATE TABLE dbo.mvp_votos (
            id INT IDENTITY(1,1) PRIMARY KEY,
            jogo_id INT NOT NULL,
            votante_id INT NOT NULL,
            votado_id INT NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT UQ_mvp_votante UNIQUE (jogo_id, votante_id)
          );
        IF COL_LENGTH('dbo.jogos','mvp_pedido') IS NULL
          ALTER TABLE dbo.jogos ADD mvp_pedido BIT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.inscricoes','checkin_at') IS NULL
          ALTER TABLE dbo.inscricoes ADD checkin_at DATETIME2 NULL;
        IF COL_LENGTH('dbo.inscricoes','no_show') IS NULL
          ALTER TABLE dbo.inscricoes ADD no_show BIT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.utilizadores','no_show_count') IS NULL
          ALTER TABLE dbo.utilizadores ADD no_show_count INT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.utilizadores','total_mvp') IS NULL
          ALTER TABLE dbo.utilizadores ADD total_mvp INT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.utilizadores','total_vitorias') IS NULL
          ALTER TABLE dbo.utilizadores ADD total_vitorias INT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.utilizadores','total_derrotas') IS NULL
          ALTER TABLE dbo.utilizadores ADD total_derrotas INT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.utilizadores','total_empates') IS NULL
          ALTER TABLE dbo.utilizadores ADD total_empates INT NOT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.jogos','checkin_processado') IS NULL
          ALTER TABLE dbo.jogos ADD checkin_processado BIT NOT NULL DEFAULT 0;
      `);
      console.log('✅ MVP + waitlist + checkin colunas garantidas');
    } catch (e) {
      console.warn('⚠️  Falha migração MVP/checkin:', e.message);
    }

    // Migração: tabela de conquistas desbloqueadas
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.utilizador_conquistas','U') IS NULL
          CREATE TABLE dbo.utilizador_conquistas (
            utilizador_id INT NOT NULL,
            conquista_id  NVARCHAR(80) NOT NULL,
            created_at    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT PK_utilizador_conquistas PRIMARY KEY (utilizador_id, conquista_id)
          );
      `);
      console.log('✅ Tabela utilizador_conquistas garantida');
    } catch (e) {
      console.warn('⚠️  Falha a criar utilizador_conquistas:', e.message);
    }

    // Migração: carteira interna + push subs
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.carteira_movimentos','U') IS NULL
          CREATE TABLE dbo.carteira_movimentos (
            id INT IDENTITY(1,1) PRIMARY KEY,
            utilizador_id INT NOT NULL,
            tipo NVARCHAR(40) NOT NULL,
            valor_cents INT NOT NULL,           -- positivo = crédito, negativo = débito
            descricao NVARCHAR(300) NULL,
            referencia NVARCHAR(100) NULL,      -- idempotência
            jogo_id INT NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE()
          );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_carteira_uid')
          CREATE INDEX IX_carteira_uid ON dbo.carteira_movimentos(utilizador_id);

        IF OBJECT_ID('dbo.push_subs','U') IS NULL
          CREATE TABLE dbo.push_subs (
            id INT IDENTITY(1,1) PRIMARY KEY,
            utilizador_id INT NOT NULL,
            endpoint NVARCHAR(500) NOT NULL,
            p256dh NVARCHAR(200) NOT NULL,
            auth   NVARCHAR(100) NOT NULL,
            created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            updated_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT UQ_push_endpoint UNIQUE (endpoint)
          );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_push_uid')
          CREATE INDEX IX_push_uid ON dbo.push_subs(utilizador_id);
      `);
      console.log('✅ carteira_movimentos + push_subs garantidos');
    } catch (e) {
      console.warn('⚠️  Falha migração carteira/push:', e.message);
    }

    // Migração: receber_emails em utilizadores (opt-in default ON)
    try {
      await pool.request().query(`
        IF COL_LENGTH('dbo.utilizadores','receber_emails') IS NULL
          ALTER TABLE dbo.utilizadores
            ADD receber_emails BIT NOT NULL CONSTRAINT DF_util_receber_emails DEFAULT 1;
      `);
      console.log('✅ Coluna receber_emails garantida');
    } catch (e) {
      console.warn('⚠️  Falha migração receber_emails:', e.message);
    }

    // Migração: referral_code + referido_por (sistema de convites)
    try {
      await pool.request().query(`
        IF COL_LENGTH('dbo.utilizadores','referral_code') IS NULL
          ALTER TABLE dbo.utilizadores ADD referral_code NVARCHAR(20) NULL;
        IF COL_LENGTH('dbo.utilizadores','referido_por') IS NULL
          ALTER TABLE dbo.utilizadores ADD referido_por INT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UQ_referral_code')
          CREATE UNIQUE INDEX UQ_referral_code ON dbo.utilizadores(referral_code) WHERE referral_code IS NOT NULL;
        -- Backfill: gera codigo deterministico para utilizadores existentes (UPPER(LEFT(nome,4)) + id)
        UPDATE dbo.utilizadores
           SET referral_code = UPPER(LEFT(REPLACE(REPLACE(nome,' ',''),'-',''), 4)) + CAST(id AS NVARCHAR(10))
         WHERE referral_code IS NULL;
      `);
      console.log('✅ referral_code + referido_por garantidos');
    } catch (e) {
      console.warn('⚠️  Falha migração referrals:', e.message);
    }

    // Migração: coordenadas GPS em jogos e campos (para mapa interativo)
    try {
      await pool.request().query(`
        IF COL_LENGTH('dbo.jogos','latitude') IS NULL
          ALTER TABLE dbo.jogos ADD latitude DECIMAL(9,6) NULL;
        IF COL_LENGTH('dbo.jogos','longitude') IS NULL
          ALTER TABLE dbo.jogos ADD longitude DECIMAL(9,6) NULL;
        IF COL_LENGTH('dbo.campos','latitude') IS NULL
          ALTER TABLE dbo.campos ADD latitude DECIMAL(9,6) NULL;
        IF COL_LENGTH('dbo.campos','longitude') IS NULL
          ALTER TABLE dbo.campos ADD longitude DECIMAL(9,6) NULL;
      `);
      console.log('✅ Colunas latitude/longitude garantidas em jogos e campos');
    } catch (e) {
      console.warn('⚠️  Falha migração lat/lng:', e.message);
    }

    // Migração: avaliações entre jogadores (sistema de 5 estrelas pós-jogo)
    try {
      await pool.request().query(`
        IF OBJECT_ID('dbo.avaliacoes_jogadores','U') IS NULL
          CREATE TABLE dbo.avaliacoes_jogadores (
            id           INT IDENTITY(1,1) PRIMARY KEY,
            jogo_id      INT NOT NULL,
            avaliador_id INT NOT NULL,
            avaliado_id  INT NOT NULL,
            nota         INT NOT NULL,
            comentario   NVARCHAR(300) NULL,
            created_at   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
            CONSTRAINT UQ_aval_jog UNIQUE (jogo_id, avaliador_id, avaliado_id),
            CONSTRAINT CHK_nota_range CHECK (nota BETWEEN 1 AND 5)
          );
        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_aval_jog_avaliado')
          CREATE INDEX IX_aval_jog_avaliado ON dbo.avaliacoes_jogadores(avaliado_id);
        IF COL_LENGTH('dbo.utilizadores','nota_media_jogador') IS NULL
          ALTER TABLE dbo.utilizadores ADD nota_media_jogador DECIMAL(3,1) NULL;
      `);
      console.log('✅ Tabela avaliacoes_jogadores garantida');
    } catch (e) {
      console.warn('⚠️  Falha migração avaliacoes_jogadores:', e.message);
    }

    // Migração: remover CHECK constraint em inscricoes.estado (para permitir 'espera')
    try {
      await pool.request().query(`
        DECLARE @ck sysname;
        SELECT @ck = name FROM sys.check_constraints
         WHERE parent_object_id = OBJECT_ID('dbo.inscricoes')
           AND definition LIKE '%estado%';
        IF @ck IS NOT NULL
          EXEC('ALTER TABLE dbo.inscricoes DROP CONSTRAINT ' + @ck);
      `);
      console.log('✅ CHECK inscricoes.estado flexibilizado');
    } catch (e) {
      console.warn('⚠️  Falha a ajustar CHECK inscricoes.estado:', e.message);
    }

    server.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('⚽ ==========================================');
      console.log(`   FutBuddies API iniciada na porta ${PORT}`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
      console.log('   Stack: Node.js + Express.js + SQL Server');
      console.log('⚽ ==========================================');
      console.log('');

      // Arrancar scheduler (limpeza + Fase C futura)
      iniciarScheduler();
    });
  } catch (err) {
    console.error('❌ Erro ao iniciar servidor:', err.message);
    console.error('   Verifica as configurações do SQL Server no ficheiro .env');
    process.exit(1);
  }
}

iniciar();

// ── Graceful shutdown (Azure App Service envia SIGTERM) ───
function shutdown(signal) {
  console.log(`\n🛑 Recebido ${signal}. A encerrar servidor...`);
  server.close(() => {
    console.log('✅ Servidor encerrado.');
    process.exit(0);
  });
  // Hard exit se não fechar em 10s
  setTimeout(() => {
    console.error('⚠️  Timeout no shutdown — a forçar saída.');
    process.exit(1);
  }, 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  // Em produção não faz sentido continuar com estado corrompido.
  if (process.env.NODE_ENV === 'production') process.exit(1);
});
