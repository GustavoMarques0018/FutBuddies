// ============================================================
//  FutBuddies - Liga entre Amigos
// ============================================================
const { query } = require('../config/database');

function gerarCodigo() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// POST /api/ligas
async function criarLiga(req, res) {
  try {
    const { nome, tipo = 'mensal' } = req.body;
    if (!nome?.trim()) return res.status(400).json({ sucesso: false, mensagem: 'Nome obrigatório.' });
    if (!['semanal','mensal','epoca'].includes(tipo))
      return res.status(400).json({ sucesso: false, mensagem: 'Tipo inválido.' });

    const codigo = gerarCodigo();
    const r = await query(
      `INSERT INTO ligas (nome, criador_id, codigo, tipo, estado, created_at)
       OUTPUT INSERTED.id
       VALUES (@nome, @uid, @codigo, @tipo, 'ativa', GETUTCDATE())`,
      { nome: nome.trim(), uid: req.utilizador.id, codigo, tipo }
    );
    const ligaId = r.recordset[0].id;

    // Criador entra automaticamente como membro
    await query(
      `INSERT INTO liga_membros (liga_id, utilizador_id) VALUES (@lid, @uid)`,
      { lid: ligaId, uid: req.utilizador.id }
    );

    res.status(201).json({ sucesso: true, ligaId, codigo });
  } catch (err) {
    console.error('[Ligas] criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/ligas/entrar
async function entrarLiga(req, res) {
  try {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ sucesso: false, mensagem: 'Código obrigatório.' });

    const liga = await query(
      `SELECT id, estado FROM ligas WHERE codigo = @codigo`,
      { codigo: codigo.toUpperCase() }
    );
    if (!liga.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Liga não encontrada.' });
    if (liga.recordset[0].estado !== 'ativa')
      return res.status(400).json({ sucesso: false, mensagem: 'Liga encerrada.' });

    const ligaId = liga.recordset[0].id;

    const jaMembro = await query(
      `SELECT id FROM liga_membros WHERE liga_id=@lid AND utilizador_id=@uid`,
      { lid: ligaId, uid: req.utilizador.id }
    );
    if (jaMembro.recordset.length)
      return res.status(409).json({ sucesso: false, mensagem: 'Já és membro desta liga.' });

    await query(
      `INSERT INTO liga_membros (liga_id, utilizador_id) VALUES (@lid, @uid)`,
      { lid: ligaId, uid: req.utilizador.id }
    );
    res.json({ sucesso: true, ligaId, mensagem: 'Entraste na liga! ⚽' });
  } catch (err) {
    console.error('[Ligas] entrar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/ligas — listar ligas do utilizador
async function listarMinhasLigas(req, res) {
  try {
    const r = await query(
      `SELECT l.id, l.nome, l.codigo, l.tipo, l.estado, l.created_at,
              l.criador_id,
              (SELECT COUNT(*) FROM liga_membros WHERE liga_id=l.id) AS total_membros,
              (SELECT COUNT(*) FROM liga_jogos WHERE liga_id=l.id) AS total_jogos
         FROM ligas l
         JOIN liga_membros lm ON lm.liga_id=l.id
         WHERE lm.utilizador_id=@uid
         ORDER BY l.created_at DESC`,
      { uid: req.utilizador.id }
    );
    res.json({ sucesso: true, ligas: r.recordset });
  } catch (err) {
    console.error('[Ligas] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/ligas/:id — tabela classificativa
async function obterLiga(req, res) {
  try {
    const ligaId = parseInt(req.params.id);

    // Verificar acesso
    const acesso = await query(
      `SELECT id FROM liga_membros WHERE liga_id=@lid AND utilizador_id=@uid`,
      { lid: ligaId, uid: req.utilizador.id }
    );
    if (!acesso.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Não és membro desta liga.' });

    const liga = await query(
      `SELECT l.*, u.nome AS criador_nome FROM ligas l
         JOIN utilizadores u ON u.id=l.criador_id
         WHERE l.id=@lid`, { lid: ligaId }
    );
    if (!liga.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Liga não encontrada.' });

    // Tabela classificativa
    const tabela = await query(
      `SELECT lm.utilizador_id, lm.pontos, lm.vitorias, lm.empates, lm.derrotas,
              lm.golos_marcados, lm.golos_sofridos,
              lm.golos_marcados - lm.golos_sofridos AS dif_golos,
              u.nome, u.nickname, u.foto_url
         FROM liga_membros lm
         JOIN utilizadores u ON u.id=lm.utilizador_id
         WHERE lm.liga_id=@lid
         ORDER BY lm.pontos DESC, dif_golos DESC, lm.golos_marcados DESC`,
      { lid: ligaId }
    );

    // Jogos da liga
    const jogos = await query(
      `SELECT j.id, j.titulo, j.data_jogo, j.estado,
              rj.golos_equipa_a, rj.golos_equipa_b
         FROM liga_jogos lj
         JOIN jogos j ON j.id=lj.jogo_id
         LEFT JOIN resultado_jogo rj ON rj.jogo_id=j.id
         WHERE lj.liga_id=@lid
         ORDER BY j.data_jogo DESC`,
      { lid: ligaId }
    );

    res.json({
      sucesso: true,
      liga: liga.recordset[0],
      tabela: tabela.recordset,
      jogos: jogos.recordset,
    });
  } catch (err) {
    console.error('[Ligas] obter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/ligas/:id/jogos — adicionar jogo + atualizar standings
async function adicionarJogo(req, res) {
  try {
    const ligaId = parseInt(req.params.id);
    const { jogoId } = req.body;
    if (!jogoId) return res.status(400).json({ sucesso: false, mensagem: 'jogoId obrigatório.' });

    // Só o criador pode adicionar jogos
    const liga = await query(
      `SELECT criador_id FROM ligas WHERE id=@lid`, { lid: ligaId }
    );
    if (!liga.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Liga não encontrada.' });
    if (liga.recordset[0].criador_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode adicionar jogos.' });

    // Verificar que o jogo tem resultado
    const res2 = await query(
      `SELECT golos_equipa_a, golos_equipa_b FROM resultado_jogo WHERE jogo_id=@jid`,
      { jid: parseInt(jogoId) }
    );
    if (!res2.recordset.length)
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo sem resultado registado.' });

    const { golos_equipa_a: gA, golos_equipa_b: gB } = res2.recordset[0];

    // Evitar duplicados
    const dup = await query(
      `SELECT 1 FROM liga_jogos WHERE liga_id=@lid AND jogo_id=@jid`,
      { lid: ligaId, jid: parseInt(jogoId) }
    );
    if (dup.recordset.length)
      return res.status(409).json({ sucesso: false, mensagem: 'Jogo já está na liga.' });

    // Inserir
    await query(
      `INSERT INTO liga_jogos (liga_id, jogo_id) VALUES (@lid, @jid)`,
      { lid: ligaId, jid: parseInt(jogoId) }
    );

    // Atualizar pontos dos membros que jogaram
    const inscritos = await query(
      `SELECT utilizador_id, equipa FROM inscricoes
         WHERE jogo_id=@jid AND estado='confirmado'`,
      { jid: parseInt(jogoId) }
    );

    for (const insc of inscritos.recordset) {
      const isMembro = await query(
        `SELECT id FROM liga_membros WHERE liga_id=@lid AND utilizador_id=@uid`,
        { lid: ligaId, uid: insc.utilizador_id }
      );
      if (!isMembro.recordset.length) continue;

      const eq = insc.equipa; // 'A' ou 'B'
      const gmeu = eq === 'A' ? gA : gB;
      const gadv  = eq === 'A' ? gB : gA;
      const vit   = gmeu > gadv ? 1 : 0;
      const emp   = gmeu === gadv ? 1 : 0;
      const der   = gmeu < gadv ? 1 : 0;
      const pts   = vit * 3 + emp;

      await query(
        `UPDATE liga_membros
           SET pontos          = pontos + @pts,
               vitorias        = vitorias + @vit,
               empates         = empates + @emp,
               derrotas        = derrotas + @der,
               golos_marcados  = golos_marcados + @gm,
               golos_sofridos  = golos_sofridos + @gs
           WHERE liga_id=@lid AND utilizador_id=@uid`,
        { lid: ligaId, uid: insc.utilizador_id, pts, vit, emp, der, gm: gmeu, gs: gadv }
      );
    }

    res.json({ sucesso: true, mensagem: 'Jogo adicionado e standings atualizados!' });
  } catch (err) {
    console.error('[Ligas] adicionarJogo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/ligas/:id — encerrar liga (só criador)
async function encerrarLiga(req, res) {
  try {
    const ligaId = parseInt(req.params.id);
    const liga = await query(`SELECT criador_id FROM ligas WHERE id=@lid`, { lid: ligaId });
    if (!liga.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Liga não encontrada.' });
    if (liga.recordset[0].criador_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o criador pode encerrar a liga.' });

    await query(`UPDATE ligas SET estado='encerrada' WHERE id=@lid`, { lid: ligaId });
    res.json({ sucesso: true, mensagem: 'Liga encerrada.' });
  } catch (err) {
    console.error('[Ligas] encerrar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { criarLiga, entrarLiga, listarMinhasLigas, obterLiga, adicionarJogo, encerrarLiga };
