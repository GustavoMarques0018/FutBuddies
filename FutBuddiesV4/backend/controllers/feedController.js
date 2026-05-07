// ============================================================
//  FutBuddies - Feed de Atividade
// ============================================================
const { query } = require('../config/database');

// Inserir atividade (chamado internamente por outros controllers)
async function inserirAtividade(utilizadorId, tipo, dados) {
  try {
    await query(
      `INSERT INTO atividade_feed (utilizador_id, tipo, dados_json)
       VALUES (@uid, @tipo, @dados)`,
      { uid: utilizadorId, tipo, dados: dados ? JSON.stringify(dados) : null }
    );
  } catch (_) { /* nunca bloquear o fluxo principal */ }
}

// GET /api/feed — feed de atividade dos amigos
async function getFeed(req, res) {
  try {
    const uid = req.utilizador.id;
    const { pagina = 1 } = req.query;
    const offset = (parseInt(pagina) - 1) * 30;

    const r = await query(
      `SELECT af.id, af.tipo, af.dados_json, af.created_at,
              u.id AS utilizador_id, u.nome, u.nickname, u.foto_url
       FROM atividade_feed af
       JOIN utilizadores u ON u.id = af.utilizador_id
       WHERE af.utilizador_id IN (
         SELECT CASE WHEN a.remetente_id = @uid
                     THEN a.destinatario_id
                     ELSE a.remetente_id
                END
         FROM amizades a
         WHERE (a.remetente_id = @uid OR a.destinatario_id = @uid)
           AND a.estado = 'aceite'
       )
       OR af.utilizador_id = @uid
       ORDER BY af.created_at DESC
       OFFSET @offset ROWS FETCH NEXT 30 ROWS ONLY`,
      { uid, offset }
    );

    const atividades = r.recordset.map(a => ({
      ...a,
      dados: a.dados_json ? (() => { try { return JSON.parse(a.dados_json); } catch { return {}; } })() : {},
      dados_json: undefined,
    }));

    res.json({ sucesso: true, atividades });
  } catch (err) {
    console.error('[Feed] getFeed:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { inserirAtividade, getFeed };
