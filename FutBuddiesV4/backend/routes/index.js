// ============================================================
//  FutBuddies - Rotas da API RESTful v2
// ============================================================

const express = require('express');
const router  = express.Router();
const { autenticar, autenticarOpcional, isAdmin } = require('../middleware/auth');
const authCtrl         = require('../controllers/authController');
const jogosCtrl        = require('../controllers/jogosController');
const utilizadoresCtrl = require('../controllers/utilizadoresController');
const chatCtrl         = require('../controllers/chatController');
const equipasCtrl      = require('../controllers/equipasController');
const amigosCtrl       = require('../controllers/amigosController');
const notifCtrl        = require('../controllers/notificacoesController');
const adminNotasCtrl   = require('../controllers/adminNotasController');
const resultadosCtrl   = require('../controllers/resultadosController');
const stripeCtrl       = require('../controllers/stripeController');
const camposCtrl       = require('../controllers/camposController');
const pagamentosCtrl   = require('../controllers/pagamentosController');
const candidaturasCtrl = require('../controllers/candidaturasController');
const suporteCtrl      = require('../controllers/suporteController');
const avalCampoCtrl    = require('../controllers/avaliacoesCampoController');
const testeCtrl        = require('../controllers/testeController');
const { upload, uploadImagem } = require('../controllers/uploadController');

// ── AUTH ──────────────────────────────────────────────────
router.post('/auth/registar', authCtrl.registar);
router.post('/auth/login',    authCtrl.login);
router.post('/auth/refresh',  authCtrl.refresh);
router.post('/auth/logout',   authCtrl.logout);
router.get('/auth/me',        autenticar, authCtrl.me);

// ── JOGOS ─────────────────────────────────────────────────
router.get('/jogos',                      autenticarOpcional, jogosCtrl.listarJogos);
router.get('/jogos/:id',                  autenticarOpcional, jogosCtrl.obterJogo);
router.post('/jogos',        autenticar,  jogosCtrl.criarJogo);
router.put('/jogos/:id',     autenticar,  jogosCtrl.editarJogo);
router.post('/jogos/:id/inscrever',   autenticar, jogosCtrl.inscreverJogo);
router.delete('/jogos/:id/inscrever', autenticar, jogosCtrl.cancelarInscricao);
router.post('/jogos/:id/checkin',     autenticar, jogosCtrl.checkin);
router.delete('/jogos/:id',           autenticar, isAdmin, jogosCtrl.eliminarJogo);

// ── CHAT ──────────────────────────────────────────────────
router.get('/jogos/:id/chat',  autenticar, chatCtrl.getMensagens);
router.post('/jogos/:id/chat', autenticar, chatCtrl.enviarMensagem);

// ── UTILIZADORES ──────────────────────────────────────────
router.get('/utilizadores/perfil',     autenticar, utilizadoresCtrl.getPerfil);
router.put('/utilizadores/perfil',     autenticar, utilizadoresCtrl.updatePerfil);
router.put('/utilizadores/password',   autenticar, utilizadoresCtrl.alterarPassword);
router.delete('/utilizadores/conta',   autenticar, utilizadoresCtrl.eliminarConta);
router.get('/utilizadores/me/equipa',  autenticar, equipasCtrl.getEquipaDoUtilizador);
router.get('/utilizadores/me/meus-jogos', autenticar, utilizadoresCtrl.getMeusJogos);
router.get('/utilizadores/me/historico',  autenticar, utilizadoresCtrl.getHistorico);
router.get('/jogadores/:id',           autenticarOpcional, utilizadoresCtrl.getPerfilPublico);

// ── EQUIPAS ───────────────────────────────────────────────
router.get('/equipas',                              equipasCtrl.listarEquipas);
router.get('/equipas/:id',                          equipasCtrl.obterEquipa);
router.post('/equipas',             autenticar,     equipasCtrl.criarEquipa);
router.put('/equipas/:id',          autenticar,     equipasCtrl.editarEquipa);
router.delete('/equipas/:id',       autenticar,     equipasCtrl.eliminarEquipa);
router.post('/equipas/:id/entrar',                     autenticar, equipasCtrl.entrarEquipa);
router.post('/equipas/:id/pedir',                      autenticar, equipasCtrl.pedirEntrada);
router.get('/equipas/:id/pedidos',                     autenticar, equipasCtrl.listarPedidosEquipa);
router.put('/equipas/:id/pedidos/:pedidoId/aceitar',   autenticar, equipasCtrl.aceitarPedidoEquipa);
router.put('/equipas/:id/pedidos/:pedidoId/rejeitar',  autenticar, equipasCtrl.rejeitarPedidoEquipa);
router.post('/equipas/:id/membros',                    autenticar, equipasCtrl.adicionarMembro);
router.delete('/equipas/:id/membros/:utilizadorId',    autenticar, equipasCtrl.removerMembro);
router.put('/equipas/:id/membros/:utilizadorId/promover', autenticar, equipasCtrl.promoverCapitao);
router.get('/equipas/:id/chat',                        autenticar, equipasCtrl.getMensagensEquipa);
router.post('/equipas/:id/chat',                       autenticar, equipasCtrl.enviarMensagemEquipa);
router.get('/equipas/:id/calendario',                  autenticar, equipasCtrl.getCalendarioEquipa);

// ── RESULTADOS DE JOGO (Fase C) ──────────────────────────
router.get('/jogos/:id/resultado',            autenticarOpcional, resultadosCtrl.obterResultados);
router.post('/jogos/:id/resultado',           autenticar, resultadosCtrl.submeterResultadoJogo);
router.post('/jogos/:id/resultado-pessoal',   autenticar, resultadosCtrl.submeterResultadoPessoal);

// ── JOGOS DE EQUIPA ──────────────────────────────────────
router.post('/jogos/:id/inscrever-equipa',   autenticar, equipasCtrl.inscreverEquipa);
router.delete('/jogos/:id/inscrever-equipa', autenticar, equipasCtrl.cancelarInscricaoEquipa);

// ── AMIGOS ────────────────────────────────────────────────
router.get('/amigos',                        autenticar, amigosCtrl.listarAmigos);
router.get('/amigos/pedidos',                autenticar, amigosCtrl.listarPedidos);
router.get('/amigos/pesquisar',              autenticar, amigosCtrl.pesquisarUtilizadores);
router.get('/amigos/sugestoes',              autenticar, amigosCtrl.sugerirUtilizadores);
router.post('/amigos/enviar',                autenticar, amigosCtrl.enviarPedido);
router.put('/amigos/:id/aceitar',            autenticar, amigosCtrl.aceitarPedido);
router.put('/amigos/:id/rejeitar',           autenticar, amigosCtrl.rejeitarPedido);
router.delete('/amigos/:id',                 autenticar, amigosCtrl.removerAmigo);
router.get('/amigos/chat/:amigoId',          autenticar, amigosCtrl.getMensagensPrivadas);
router.post('/amigos/chat/:amigoId',         autenticar, amigosCtrl.enviarMensagemPrivada);

// ── ADMIN ─────────────────────────────────────────────────
router.get('/admin/dashboard',              autenticar, isAdmin, utilizadoresCtrl.getDashboard);
router.get('/admin/utilizadores',           autenticar, isAdmin, utilizadoresCtrl.getUtilizadores);
router.get('/admin/jogos',                  autenticar, isAdmin, utilizadoresCtrl.getTodosJogos);
router.put('/admin/utilizadores/:id/role',  autenticar, isAdmin, utilizadoresCtrl.updateRole);
router.put('/admin/utilizadores/:id/ativo', autenticar, isAdmin, utilizadoresCtrl.toggleAtivo);

// ── ADMIN: notas globais ─────────────────────────────────
router.get('/admin/notas',             autenticar, isAdmin, adminNotasCtrl.listarNotas);
router.post('/admin/notas',            autenticar, isAdmin, adminNotasCtrl.criarNota);
router.delete('/admin/notas/:id',      autenticar, isAdmin, adminNotasCtrl.eliminarNota);

// ── NOTIFICAÇÕES (utilizador) ─────────────────────────────
router.get('/notificacoes',                   autenticar, notifCtrl.listarNotificacoes);
router.get('/notificacoes/nao-lidas-count',   autenticar, notifCtrl.contarNaoLidas);
router.put('/notificacoes/lidas',             autenticar, notifCtrl.marcarTodasLidas);
router.put('/notificacoes/:id/lida',          autenticar, notifCtrl.marcarLida);
router.delete('/notificacoes/:id',            autenticar, notifCtrl.eliminarNotificacao);

// ── STRIPE CONNECT (Fase D) ──────────────────────────────
router.post('/stripe/connect/onboarding',     autenticar, stripeCtrl.iniciarOnboarding);
router.get('/stripe/connect/status',          autenticar, stripeCtrl.obterEstadoConta);
router.post('/stripe/connect/dashboard-link', autenticar, stripeCtrl.linkDashboard);
// NOTA: /stripe/webhook é registado em server.js (antes de express.json) com raw body

// ── CAMPOS (donos) ───────────────────────────────────────
router.get('/campos',               autenticarOpcional, camposCtrl.listarCampos);
router.get('/campos/:id',           autenticarOpcional, camposCtrl.obterCampo);
router.post  ('/campos/:id/favorito',  autenticar, camposCtrl.favoritar);
router.delete('/campos/:id/favorito',  autenticar, camposCtrl.desfavoritar);
router.get   ('/meus/campos-favoritos', autenticar, camposCtrl.listarFavoritos);
router.post('/campos',               autenticar, camposCtrl.criarCampo);
router.put('/campos/:id',            autenticar, camposCtrl.editarCampo);
router.delete('/campos/:id',         autenticar, camposCtrl.eliminarCampo);
router.get('/campos/:id/disponibilidade',        camposCtrl.getDisponibilidade);
router.get('/campos/:id/bloqueios',              camposCtrl.listarBloqueios);
router.post('/campos/:id/bloqueios', autenticar, camposCtrl.criarBloqueio);
router.delete('/campos/:campoId/bloqueios/:id', autenticar, camposCtrl.eliminarBloqueio);
router.delete('/admin/campos/:id',             autenticar, camposCtrl.adminEliminarCampo);
router.post  ('/admin/campos/:id/pedir-info',  autenticar, camposCtrl.adminPedirInfoCampo);
router.get('/campos/:id/avaliacoes',                        avalCampoCtrl.listarPorCampo);
router.post('/jogos/:jogoId/avaliar-campo',    autenticar, avalCampoCtrl.submeter);

// ── MVP Voting ───────────────────────────────────────────
const mvpCtrl = require('../controllers/mvpController');
router.get ('/jogos/:id/mvp',  autenticar, mvpCtrl.getVotacao);
router.post('/jogos/:id/mvp',  autenticar, mvpCtrl.votar);

// ── Sorteio de equipas ───────────────────────────────────
const sorteioCtrl = require('../controllers/sorteioController');
router.get('/jogos/:id/sortear', autenticar, sorteioCtrl.sortear);
router.get('/dono/agenda',           autenticar, camposCtrl.agendaDono);
router.get('/dono/wallet',           autenticar, camposCtrl.wallet);

// ── Dashboard do Dono (heatmap + KPIs) ───────────────────
const donoDashCtrl = require('../controllers/donoDashboardController');
router.get('/dono/dashboard',        autenticar, donoDashCtrl.dashboard);

// ── Conquistas / Badges ──────────────────────────────────
const conquistasCtrl = require('../controllers/conquistasController');
router.get('/utilizadores/me/conquistas', autenticar, conquistasCtrl.listarMinhas);
router.get('/jogadores/:id/conquistas',   autenticarOpcional, conquistasCtrl.listarPublicas);

// ── Carteira interna ─────────────────────────────────────
const carteiraCtrl = require('../controllers/carteiraController');
router.get ('/carteira',                    autenticar, carteiraCtrl.obter);
router.post('/carteira/simular-uso',        autenticar, carteiraCtrl.simularUso);
router.post('/admin/carteira/:userId/creditar', autenticar, isAdmin, carteiraCtrl.adminCreditar);

// ── Web Push ─────────────────────────────────────────────
const pushCtrl = require('../controllers/webPushController');
router.get ('/push/vapid-public-key', pushCtrl.vapidKey);
router.post('/push/subscrever',       autenticar, pushCtrl.subscrever);
router.post('/push/desinscrever',     autenticar, pushCtrl.desinscrever);

// ── PAGAMENTOS ────────────────────────────────────────────
router.post('/jogos/:id/pagar',            autenticar, pagamentosCtrl.criarPagamento);
router.post('/jogos/:id/sync-pagamento',   autenticar, pagamentosCtrl.syncPagamento);
router.get('/jogos/:id/pagamentos',        autenticar, pagamentosCtrl.listarPagamentosJogo);
router.post('/jogos/:id/cobrir-diferenca', autenticar, pagamentosCtrl.cobrirDiferenca);
router.get('/jogos/:id/pagamento-diagnostico', autenticar, pagamentosCtrl.diagnostico);

// ── CANDIDATURAS A DONO DE CAMPO ─────────────────────────
router.post('/candidaturas/dono-campo', autenticar, candidaturasCtrl.submeter);
router.get('/candidaturas/minhas',      autenticar, candidaturasCtrl.minhas);
router.get('/admin/candidaturas',                 autenticar, isAdmin, candidaturasCtrl.listarAdmin);
router.put('/admin/candidaturas/:id/aprovar',     autenticar, isAdmin, candidaturasCtrl.aprovar);
router.put('/admin/candidaturas/:id/rejeitar',    autenticar, isAdmin, candidaturasCtrl.rejeitar);
router.put('/admin/candidaturas/:id/pedir-info',  autenticar, isAdmin, candidaturasCtrl.pedirInfo);

// ── SUPORTE ───────────────────────────────────────────────
router.post('/suporte/mensagens',                 autenticarOpcional, suporteCtrl.submeter);
router.get('/admin/suporte',             autenticar, isAdmin, suporteCtrl.listarAdmin);
router.get('/admin/suporte/stats',       autenticar, isAdmin, suporteCtrl.statsAdmin);
router.put('/admin/suporte/:id',         autenticar, isAdmin, suporteCtrl.atualizarAdmin);

// ── TESTE (apagar em produção) ────────────────────────────
router.post('/test/create-session', testeCtrl.criarSessaoTeste);

// ── UPLOAD ────────────────────────────────────────────────
router.post('/upload/imagem', autenticar, upload.single('imagem'), uploadImagem);

// ── HEALTH ────────────────────────────────────────────────
router.get('/health', (req, res) => res.json({ sucesso: true, mensagem: 'FutBuddies API online!', timestamp: new Date() }));

module.exports = router;
