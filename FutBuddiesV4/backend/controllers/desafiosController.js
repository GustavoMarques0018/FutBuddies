// ============================================================
//  FutBuddies - Desafios entre Amigos
// ============================================================
const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// Helper: calcular stats do mês para um utilizador
async function statsDoMes(utilizadorId, tipo, mes, ano) {
  const campo = tipo === 'gols_mes' ? 'golos'
              : tipo === 'assistencias_mes' ? 'assistencias'
              : null;

  if (campo) {
    const r = await query(
      `SELECT ISNULL(SUM(rp.${campo}), 0) AS valor
       FROM resultado_pessoal rp
       JOIN jogos j ON j.id = rp.jogo_id
       WHERE rp.utilizador_id = @uid
         AND MONTH(j.data_jogo) = @mes
         AND YEAR(j.data_jogo) = @ano`,
      { uid: utilizadorId, mes, ano }
    );
    return r.recordset[0]?.valor || 0;
  }

  // jogos_mes
  const r = await query(
    `SELECT COUNT(*) AS valor
     FROM inscricoes i
     JOIN jogos j ON j.id = i.jogo_id
     WHERE i.utilizador_id = @uid AND i.estado = 'confirmado'
       AND MONTH(j.data_jogo) = @mes AND YEAR(j.data_jogo) = @ano`,
    { uid: utilizadorId, mes, ano }
  );
  return r.recordset[0]?.valor || 0;
}

// GET /api/desafios
async function listar(req, res) {
  try {
    const uid = req.utilizador.id;
    const r = await query(
      `SELECT d.*,
              c.nome AS criador_nome, c.nickname AS criador_nick, c.foto_url AS criador_foto,
              p.nome AS part_nome,   p.nickname AS part_nick,   p.foto_url AS part_foto
       FROM desafios d
       JOIN utilizadores c ON c.id = d.criador_id
       JOIN utilizadores p ON p.id = d.participante_id
       WHERE d.criador_id = @uid OR d.participante_id = @uid
       ORDER BY d.created_at DESC`,
      { uid }
    );
    res.json({ sucesso: true, desafios: r.recordset });
  } catch (err) {
    console.error('[Desafios] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/desafios
async function criar(req, res) {
  try {
    const uid = req.utilizador.id;
    const { participanteId, tipo, mes, ano } = req.body;

    if (!['gols_mes','assistencias_mes','jogos_mes'].includes(tipo))
      return res.status(400).json({ sucesso: false, mensagem: 'Tipo inválido.' });
    if (!participanteId || participanteId === uid)
      return res.status(400).json({ sucesso: false, mensagem: 'Participante inválido.' });

    // verificar amizade
    const amiz = await query(
      `SELECT 1 FROM amizades WHERE estado='aceite'
         AND ((remetente_id=@uid AND destinatario_id=@pid)
           OR (remetente_id=@pid AND destinatario_id=@uid))`,
      { uid, pid: participanteId }
    );
    if (!amiz.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Só podes desafiar amigos.' });

    const r = await query(
      `INSERT INTO desafios (criador_id, participante_id, tipo, mes, ano)
       OUTPUT INSERTED.id
       VALUES (@uid, @pid, @tipo, @mes, @ano)`,
      { uid, pid: participanteId, tipo, mes: mes || new Date().getMonth() + 1, ano: ano || new Date().getFullYear() }
    );

    const tipoLabel = tipo === 'gols_mes' ? 'golos' : tipo === 'assistencias_mes' ? 'assistências' : 'jogos';
    await criarNotificacao({
      utilizadorId: participanteId,
      tipo: 'sistema',
      titulo: '⚔️ Novo desafio!',
      mensagem: `${req.utilizador.nome} desafiou-te a ver quem marca mais ${tipoLabel} este mês!`,
    });

    res.status(201).json({ sucesso: true, id: r.recordset[0].id });
  } catch (err) {
    if (err.number === 2627) // unique constraint
      return res.status(400).json({ sucesso: false, mensagem: 'Já existe um desafio deste tipo com este amigo este mês.' });
    console.error('[Desafios] criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/desafios/:id/responder
async function responder(req, res) {
  try {
    const uid = req.utilizador.id;
    const { id } = req.params;
    const { estado } = req.body; // aceite | recusado

    if (!['aceite','recusado'].includes(estado))
      return res.status(400).json({ sucesso: false, mensagem: 'Estado inválido.' });

    const r = await query(
      `UPDATE desafios SET estado=@estado
       OUTPUT INSERTED.*
       WHERE id=@id AND participante_id=@uid AND estado='pending'`,
      { id: parseInt(id), uid, estado }
    );
    if (!r.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado ou já respondido.' });

    res.json({ sucesso: true, desafio: r.recordset[0] });
  } catch (err) {
    console.error('[Desafios] responder:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/desafios/:id/leaderboard
async function leaderboard(req, res) {
  try {
    const uid = req.utilizador.id;
    const { id } = req.params;

    const dR = await query(
      `SELECT d.*, c.nome AS criador_nome, c.foto_url AS criador_foto,
              p.nome AS part_nome, p.foto_url AS part_foto
       FROM desafios d
       JOIN utilizadores c ON c.id = d.criador_id
       JOIN utilizadores p ON p.id = d.participante_id
       WHERE d.id = @id AND (d.criador_id = @uid OR d.participante_id = @uid)`,
      { id: parseInt(id), uid }
    );
    if (!dR.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Desafio não encontrado.' });

    const d = dR.recordset[0];
    const [v1, v2] = await Promise.all([
      statsDoMes(d.criador_id, d.tipo, d.mes, d.ano),
      statsDoMes(d.participante_id, d.tipo, d.mes, d.ano),
    ]);

    res.json({
      sucesso: true,
      desafio: d,
      criador:      { id: d.criador_id,      nome: d.criador_nome, foto: d.criador_foto, valor: v1 },
      participante: { id: d.participante_id, nome: d.part_nome,    foto: d.part_foto,    valor: v2 },
    });
  } catch (err) {
    console.error('[Desafios] leaderboard:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// Chamado internamente após submeter resultado pessoal
async function verificarOvertake(utilizadorId) {
  try {
    const agora = new Date();
    const mes = agora.getMonth() + 1;
    const ano = agora.getFullYear();

    const desafiosAtivos = await query(
      `SELECT * FROM desafios
       WHERE estado='aceite' AND mes=@mes AND ano=@ano
         AND (criador_id=@uid OR participante_id=@uid)`,
      { uid: utilizadorId, mes, ano }
    );

    for (const d of desafiosAtivos.recordset) {
      const outroId = d.criador_id === utilizadorId ? d.participante_id : d.criador_id;
      const [meuValor, outroValor] = await Promise.all([
        statsDoMes(utilizadorId, d.tipo, mes, ano),
        statsDoMes(outroId, d.tipo, mes, ano),
      ]);
      if (meuValor > outroValor) {
        const label = d.tipo === 'gols_mes' ? 'golos' : d.tipo === 'assistencias_mes' ? 'assistências' : 'jogos';
        await criarNotificacao({
          utilizadorId: outroId,
          tipo: 'sistema',
          titulo: '📊 Ultrapassado no desafio!',
          mensagem: `O teu adversário está agora à tua frente no desafio de ${label} deste mês!`,
        });
      }
    }
  } catch (_) { /* não bloquear */ }
}

module.exports = { listar, criar, responder, leaderboard, verificarOvertake };
