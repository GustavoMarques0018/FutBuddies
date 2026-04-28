// ============================================================
//  FutBuddies - Conquistas (Badges)
//  Sistema baseado em métricas já existentes no utilizador.
//  Cada badge tem id, nome, descrição, icone, threshold e função
//  de avaliação. Idempotente: só desbloqueia se ainda não existe.
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// ── Catálogo de conquistas ───────────────────────────────────
// Todas as regras leem campos já existentes em `utilizadores`
// (total_golos, total_assistencias, total_jogos, total_mvp,
//  total_vitorias, total_derrotas, total_empates)
const CATALOGO = [
  // Primeiros passos
  { id: 'primeiro_jogo',      nome: 'Primeiro Jogo',      descricao: 'Jogaste o teu primeiro jogo.',       icone: '⚽', categoria: 'inicio', tier: 'bronze',   rule: u => u.total_jogos >= 1 },
  { id: 'primeiro_golo',      nome: 'Primeiro Golo',      descricao: 'Marcaste o teu primeiro golo.',       icone: '🎯', categoria: 'ataque', tier: 'bronze',   rule: u => u.total_golos >= 1 },
  { id: 'primeira_assist',    nome: 'Primeira Assistência', descricao: 'Primeira assistência registada.',  icone: '🎁', categoria: 'meio',   tier: 'bronze',   rule: u => u.total_assistencias >= 1 },
  { id: 'primeiro_mvp',       nome: 'Primeiro MVP',       descricao: 'Foste eleito MVP pela primeira vez.', icone: '👑', categoria: 'destaque', tier: 'prata',  rule: u => u.total_mvp >= 1 },
  { id: 'primeira_vitoria',   nome: 'Primeira Vitória',   descricao: 'Ganhaste o teu primeiro jogo.',       icone: '🏆', categoria: 'vitorias', tier: 'bronze', rule: u => u.total_vitorias >= 1 },

  // Volume de jogos
  { id: 'jogos_10',           nome: 'Regular',            descricao: '10 jogos disputados.',                icone: '📅', categoria: 'volume', tier: 'prata',    rule: u => u.total_jogos >= 10 },
  { id: 'jogos_50',           nome: 'Veterano',           descricao: '50 jogos disputados.',                icone: '🎖️', categoria: 'volume', tier: 'ouro',     rule: u => u.total_jogos >= 50 },
  { id: 'jogos_100',          nome: 'Lenda',              descricao: '100 jogos disputados!',               icone: '🌟', categoria: 'volume', tier: 'lenda',    rule: u => u.total_jogos >= 100 },

  // Golos
  { id: 'golos_10',           nome: 'Goleador',           descricao: '10 golos marcados.',                  icone: '⚡', categoria: 'ataque', tier: 'prata',    rule: u => u.total_golos >= 10 },
  { id: 'golos_50',           nome: 'Artilheiro',         descricao: '50 golos marcados.',                  icone: '🔥', categoria: 'ataque', tier: 'ouro',     rule: u => u.total_golos >= 50 },
  { id: 'golos_100',          nome: 'Máquina de Golos',   descricao: '100 golos marcados!',                 icone: '💥', categoria: 'ataque', tier: 'lenda',    rule: u => u.total_golos >= 100 },

  // Assistências
  { id: 'assist_10',          nome: 'Maestro',            descricao: '10 assistências.',                     icone: '🎨', categoria: 'meio',   tier: 'prata',   rule: u => u.total_assistencias >= 10 },
  { id: 'assist_50',          nome: 'Arquiteto',          descricao: '50 assistências.',                     icone: '🧠', categoria: 'meio',   tier: 'ouro',    rule: u => u.total_assistencias >= 50 },

  // MVP
  { id: 'mvp_5',              nome: 'Estrela',            descricao: '5 MVPs.',                              icone: '⭐', categoria: 'destaque', tier: 'ouro',   rule: u => u.total_mvp >= 5 },
  { id: 'mvp_20',             nome: 'Astro',              descricao: '20 MVPs — és o melhor!',               icone: '🌠', categoria: 'destaque', tier: 'lenda',  rule: u => u.total_mvp >= 20 },

  // Vitórias
  { id: 'vitorias_10',        nome: 'Vencedor',           descricao: '10 vitórias.',                         icone: '🥇', categoria: 'vitorias', tier: 'prata', rule: u => u.total_vitorias >= 10 },
  { id: 'vitorias_50',        nome: 'Campeão',            descricao: '50 vitórias.',                         icone: '🏅', categoria: 'vitorias', tier: 'ouro',  rule: u => u.total_vitorias >= 50 },

  // Combo
  { id: 'duplo_impacto',      nome: 'Duplo Impacto',      descricao: 'Pelo menos 10 golos E 10 assistências.', icone: '🎯', categoria: 'combo', tier: 'ouro', rule: u => u.total_golos >= 10 && u.total_assistencias >= 10 },
  { id: 'jogador_completo',   nome: 'Jogador Completo',   descricao: '25+ golos, 25+ assist., 5+ MVPs.',     icone: '💎', categoria: 'combo', tier: 'lenda', rule: u => u.total_golos >= 25 && u.total_assistencias >= 25 && u.total_mvp >= 5 },

  // Fair-play (inverso de no-shows)
  { id: 'fair_play',          nome: 'Fair Play',          descricao: '20+ jogos sem faltar.',                icone: '🤝', categoria: 'fair',  tier: 'ouro',     rule: u => u.total_jogos >= 20 && (u.no_show_count || 0) === 0 },
];

// ── Avaliar e atribuir conquistas para um utilizador ────────
async function avaliarConquistas(utilizadorId, { silencioso = false } = {}) {
  const r = await query(
    `SELECT id, nome,
            ISNULL(total_golos,0) AS total_golos,
            ISNULL(total_assistencias,0) AS total_assistencias,
            ISNULL(total_jogos,0) AS total_jogos,
            ISNULL(total_mvp,0) AS total_mvp,
            ISNULL(total_vitorias,0) AS total_vitorias,
            ISNULL(no_show_count,0) AS no_show_count
       FROM utilizadores WHERE id=@uid`,
    { uid: utilizadorId }
  );
  if (!r.recordset.length) return [];
  const u = r.recordset[0];

  const jaR = await query(
    `SELECT conquista_id FROM utilizador_conquistas WHERE utilizador_id=@uid`,
    { uid: utilizadorId }
  );
  const ja = new Set(jaR.recordset.map(x => x.conquista_id));

  const novas = [];
  for (const b of CATALOGO) {
    if (ja.has(b.id)) continue;
    try {
      if (b.rule(u)) {
        await query(
          `IF NOT EXISTS (SELECT 1 FROM utilizador_conquistas WHERE utilizador_id=@uid AND conquista_id=@cid)
             INSERT INTO utilizador_conquistas (utilizador_id, conquista_id) VALUES (@uid, @cid)`,
          { uid: utilizadorId, cid: b.id }
        );
        novas.push(b);
        if (!silencioso) {
          try {
            await criarNotificacao({
              utilizadorId,
              tipo: 'sistema',
              titulo: `🏅 Nova conquista: ${b.nome}`,
              mensagem: b.descricao,
              acaoUrl: '/perfil?tab=conquistas',
            });
          } catch {}
        }
      }
    } catch (e) {
      console.warn('[Conquistas] regra falhou', b.id, e.message);
    }
  }
  return novas;
}

// GET /api/utilizadores/me/conquistas
async function listarMinhas(req, res) {
  try {
    const uid = req.utilizador.id;
    // Reavalia antes de devolver para garantir que estão atualizadas
    await avaliarConquistas(uid);

    const r = await query(
      `SELECT conquista_id, created_at FROM utilizador_conquistas WHERE utilizador_id=@uid`,
      { uid }
    );
    const mapa = new Map(r.recordset.map(x => [x.conquista_id, x.created_at]));

    const lista = CATALOGO.map(b => ({
      id: b.id,
      nome: b.nome,
      descricao: b.descricao,
      icone: b.icone,
      categoria: b.categoria,
      tier: b.tier,
      desbloqueada: mapa.has(b.id),
      desbloqueada_em: mapa.get(b.id) || null,
    }));

    res.json({
      sucesso: true,
      conquistas: lista,
      total: lista.length,
      desbloqueadas: lista.filter(x => x.desbloqueada).length,
    });
  } catch (err) {
    console.error('[Conquistas] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/jogadores/:id/conquistas  (perfil público)
async function listarPublicas(req, res) {
  try {
    const uid = parseInt(req.params.id);
    const r = await query(
      `SELECT conquista_id, created_at FROM utilizador_conquistas WHERE utilizador_id=@uid`,
      { uid }
    );
    const mapa = new Map(r.recordset.map(x => [x.conquista_id, x.created_at]));
    const lista = CATALOGO
      .filter(b => mapa.has(b.id))
      .map(b => ({
        id: b.id, nome: b.nome, descricao: b.descricao, icone: b.icone,
        categoria: b.categoria, tier: b.tier,
        desbloqueada_em: mapa.get(b.id),
      }));
    res.json({ sucesso: true, conquistas: lista, total: CATALOGO.length });
  } catch (err) {
    console.error('[Conquistas] públicas:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { CATALOGO, avaliarConquistas, listarMinhas, listarPublicas };
