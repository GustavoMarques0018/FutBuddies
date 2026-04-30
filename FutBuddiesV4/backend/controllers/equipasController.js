// ============================================================
//  FutBuddies - Controlador de Equipas (v3 — público/privado)
// ============================================================

const { query } = require('../config/database');

// GET /api/equipas
async function listarEquipas(req, res) {
  try {
    const { regiao, nivel, recrutar, pesquisa } = req.query;
    let where = 'WHERE 1=1';
    const params = {};

    if (regiao)   { where += ' AND e.regiao = @regiao'; params.regiao = regiao; }
    if (nivel)    { where += ' AND e.nivel = @nivel'; params.nivel = nivel; }
    if (recrutar === 'true') { where += ' AND e.a_recrutar = 1'; }
    if (pesquisa) { where += ' AND (e.nome LIKE @pesquisa OR e.descricao LIKE @pesquisa)'; params.pesquisa = `%${pesquisa}%`; }

    const resultado = await query(
      `SELECT e.id, e.nome, e.emblema, e.descricao, e.nivel, e.regiao, e.a_recrutar,
              e.visibilidade, e.aceitar_pedidos,
              /* Stats dinâmicos: computados a partir de inscricoes_equipa + resultado_jogo (Fase C). */
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN jogos j ON j.id = ie.jogo_id
                 WHERE ie.equipa_id = e.id
                   AND ie.estado = 'confirmado'
                   AND j.data_jogo < GETUTCDATE()) AS total_jogos,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND ((ie.lado = 'A' AND r.golos_equipa_a > r.golos_equipa_b)
                     OR (ie.lado = 'B' AND r.golos_equipa_b > r.golos_equipa_a))) AS vitorias,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND ((ie.lado = 'A' AND r.golos_equipa_a < r.golos_equipa_b)
                     OR (ie.lado = 'B' AND r.golos_equipa_b < r.golos_equipa_a))) AS derrotas,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND r.golos_equipa_a = r.golos_equipa_b) AS empates,
              e.created_at,
              u.nome AS capitao_nome, u.id AS capitao_id,
              (SELECT COUNT(*) FROM equipa_membros m WHERE m.equipa_id = e.id) AS total_membros
       FROM equipas e
       JOIN utilizadores u ON e.capitao_id = u.id
       ${where}
       ORDER BY e.created_at DESC`, params
    );

    res.json({ sucesso: true, equipas: resultado.recordset });
  } catch (err) {
    console.error('[Equipas] Erro ao listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/equipas/:id
async function obterEquipa(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query(
      `SELECT e.id, e.nome, e.emblema, e.descricao, e.nivel, e.regiao, e.a_recrutar,
              e.visibilidade, e.codigo_acesso, e.aceitar_pedidos,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN jogos j ON j.id = ie.jogo_id
                 WHERE ie.equipa_id = e.id
                   AND ie.estado = 'confirmado'
                   AND j.data_jogo < GETUTCDATE()) AS total_jogos,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND ((ie.lado = 'A' AND r.golos_equipa_a > r.golos_equipa_b)
                     OR (ie.lado = 'B' AND r.golos_equipa_b > r.golos_equipa_a))) AS vitorias,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND ((ie.lado = 'A' AND r.golos_equipa_a < r.golos_equipa_b)
                     OR (ie.lado = 'B' AND r.golos_equipa_b < r.golos_equipa_a))) AS derrotas,
              (SELECT COUNT(*) FROM inscricoes_equipa ie
                 JOIN resultado_jogo r ON r.jogo_id = ie.jogo_id
                 WHERE ie.equipa_id = e.id AND ie.estado = 'confirmado'
                   AND r.golos_equipa_a = r.golos_equipa_b) AS empates,
              e.created_at,
              u.nome AS capitao_nome, u.id AS capitao_id
       FROM equipas e JOIN utilizadores u ON e.capitao_id = u.id
       WHERE e.id = @id`, { id: parseInt(id) }
    );

    if (resultado.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });

    const membros = await query(
      `SELECT m.id, m.papel, m.created_at, u.id AS utilizador_id, u.nome, u.nickname, u.posicao, u.regiao, u.foto_url
       FROM equipa_membros m JOIN utilizadores u ON m.utilizador_id = u.id
       WHERE m.equipa_id = @id ORDER BY m.papel DESC, m.created_at ASC`, { id: parseInt(id) }
    );

    const equipa = resultado.recordset[0];
    equipa.membros = membros.recordset;

    // Only show codigo_acesso to the captain
    const utilizadorId = req.headers.authorization ? null : null; // will be checked in frontend
    // We send it and let the frontend decide visibility based on isCriador

    res.json({ sucesso: true, equipa });
  } catch (err) {
    console.error('[Equipas] Erro ao obter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/equipas
async function criarEquipa(req, res) {
  try {
    const { nome, emblema = '⚽', descricao, nivel = 'Descontraído', regiao,
            aRecrutar = false, visibilidade = 'publica', aceitarPedidos = false } = req.body;
    const capitaoId = req.utilizador.id;

    if (!nome?.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'O nome da equipa é obrigatório.' });

    // Verificar se já é capitão de outra equipa
    const jaCapitao = await query(
      'SELECT id FROM equipas WHERE capitao_id = @capitaoId', { capitaoId }
    );
    if (jaCapitao.recordset.length > 0)
      return res.status(400).json({ sucesso: false, mensagem: 'Já és capitão de uma equipa. Elimina-a primeiro.' });

    // Gerar código de acesso para equipas privadas
    let codigoAcesso = null;
    if (visibilidade === 'privada') {
      codigoAcesso = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const resultado = await query(
      `INSERT INTO equipas (nome, emblema, descricao, nivel, regiao, capitao_id, a_recrutar,
                            visibilidade, codigo_acesso, aceitar_pedidos, created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (@nome, @emblema, @descricao, @nivel, @regiao, @capitaoId, @aRecrutar,
               @visibilidade, @codigoAcesso, @aceitarPedidos, GETUTCDATE(), GETUTCDATE())`,
      { nome: nome.trim(), emblema, descricao: descricao || null, nivel, regiao: regiao || null,
        capitaoId, aRecrutar: aRecrutar ? 1 : 0, visibilidade, codigoAcesso,
        aceitarPedidos: aceitarPedidos ? 1 : 0 }
    );

    const equipaId = resultado.recordset[0].id;

    // Adicionar capitão como membro
    await query(
      `INSERT INTO equipa_membros (equipa_id, utilizador_id, papel, created_at)
       VALUES (@equipaId, @capitaoId, 'capitao', GETUTCDATE())`,
      { equipaId, capitaoId }
    );

    res.status(201).json({ sucesso: true, mensagem: 'Equipa criada!', equipaId, codigoAcesso });
  } catch (err) {
    console.error('[Equipas] Erro ao criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/equipas/:id
async function editarEquipa(req, res) {
  try {
    const { id } = req.params;
    const { nome, emblema, descricao, nivel, regiao, aRecrutar, visibilidade, aceitarPedidos } = req.body;

    const equipa = await query('SELECT capitao_id, visibilidade, codigo_acesso FROM equipas WHERE id = @id', { id: parseInt(id) });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id && req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode editar a equipa.' });

    // If changing to private and no code exists, generate one
    let codigoAcesso = equipa.recordset[0].codigo_acesso;
    if (visibilidade === 'privada' && !codigoAcesso) {
      codigoAcesso = Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    if (visibilidade === 'publica') {
      codigoAcesso = null;
    }

    await query(
      `UPDATE equipas SET nome=@nome, emblema=@emblema, descricao=@descricao, nivel=@nivel,
       regiao=@regiao, a_recrutar=@aRecrutar, visibilidade=@visibilidade,
       codigo_acesso=@codigoAcesso, aceitar_pedidos=@aceitarPedidos,
       updated_at=GETUTCDATE() WHERE id=@id`,
      { id: parseInt(id), nome, emblema, descricao: descricao || null, nivel,
        regiao: regiao || null, aRecrutar: aRecrutar ? 1 : 0,
        visibilidade: visibilidade || 'publica', codigoAcesso,
        aceitarPedidos: aceitarPedidos ? 1 : 0 }
    );

    res.json({ sucesso: true, mensagem: 'Equipa atualizada.', codigoAcesso });
  } catch (err) {
    console.error('[Equipas] Erro ao editar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/equipas/:id
async function eliminarEquipa(req, res) {
  try {
    const { id } = req.params;
    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: parseInt(id) });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id && req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode eliminar a equipa.' });

    const p = { id: parseInt(id) };
    const tentativa = async (sql) => { try { await query(sql, p); } catch (e) { /* ignora se tabela não existir */ } };
    await tentativa('DELETE FROM pedidos_equipa WHERE equipa_id = @id');
    await tentativa('DELETE FROM equipa_membros WHERE equipa_id = @id');
    await tentativa('DELETE FROM inscricoes_equipa WHERE equipa_id = @id');
    await tentativa('DELETE FROM mensagens_equipa WHERE equipa_id = @id');
    await tentativa('DELETE FROM notificacoes WHERE equipa_id = @id');
    await query('DELETE FROM equipas WHERE id = @id', p);
    res.json({ sucesso: true, mensagem: 'Equipa eliminada.' });
  } catch (err) {
    console.error('[Equipas] Erro ao eliminar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/equipas/:id/entrar — entrar numa equipa pública ou com código
async function entrarEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { codigoAcesso } = req.body;

    const equipa = await query(
      'SELECT id, visibilidade, codigo_acesso FROM equipas WHERE id = @id', { id: equipaId }
    );
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });

    const eq = equipa.recordset[0];

    // Check if already a member
    const jaMembro = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @uid',
      { equipaId, uid: utilizadorId }
    );
    if (jaMembro.recordset.length > 0)
      return res.status(409).json({ sucesso: false, mensagem: 'Já pertences a esta equipa.' });

    // Private team: validate access code
    if (eq.visibilidade === 'privada') {
      if (!codigoAcesso || codigoAcesso.toUpperCase() !== eq.codigo_acesso)
        return res.status(403).json({ sucesso: false, mensagem: 'Código de acesso inválido.' });
    }

    await query(
      `INSERT INTO equipa_membros (equipa_id, utilizador_id, papel, created_at)
       VALUES (@equipaId, @uid, 'membro', GETUTCDATE())`,
      { equipaId, uid: utilizadorId }
    );

    res.json({ sucesso: true, mensagem: 'Entraste na equipa!' });
  } catch (err) {
    console.error('[Equipas] Erro ao entrar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/equipas/:id/pedir — pedir para entrar (equipa privada com aceitar_pedidos)
async function pedirEntrada(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;

    const equipa = await query(
      'SELECT id, aceitar_pedidos FROM equipas WHERE id = @id', { id: equipaId }
    );
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (!equipa.recordset[0].aceitar_pedidos)
      return res.status(400).json({ sucesso: false, mensagem: 'Esta equipa não aceita pedidos de entrada.' });

    // Check if already member
    const jaMembro = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @uid',
      { equipaId, uid: utilizadorId }
    );
    if (jaMembro.recordset.length > 0)
      return res.status(409).json({ sucesso: false, mensagem: 'Já pertences a esta equipa.' });

    // Check if already has a pending request
    const jaExiste = await query(
      `SELECT id FROM pedidos_equipa WHERE equipa_id = @equipaId AND utilizador_id = @uid AND estado = 'pendente'`,
      { equipaId, uid: utilizadorId }
    );
    if (jaExiste.recordset.length > 0)
      return res.status(409).json({ sucesso: false, mensagem: 'Já tens um pedido pendente.' });

    await query(
      `INSERT INTO pedidos_equipa (equipa_id, utilizador_id, estado, created_at)
       VALUES (@equipaId, @uid, 'pendente', GETUTCDATE())`,
      { equipaId, uid: utilizadorId }
    );

    res.status(201).json({ sucesso: true, mensagem: 'Pedido de entrada enviado!' });
  } catch (err) {
    console.error('[Equipas] Erro ao pedir entrada:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/equipas/:id/pedidos — listar pedidos de entrada (só capitão)
async function listarPedidosEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode ver os pedidos.' });

    const resultado = await query(
      `SELECT p.id, p.estado, p.created_at,
              u.id AS utilizador_id, u.nome, u.nickname, u.foto_url, u.posicao, u.regiao
       FROM pedidos_equipa p
       JOIN utilizadores u ON p.utilizador_id = u.id
       WHERE p.equipa_id = @equipaId AND p.estado = 'pendente'
       ORDER BY p.created_at DESC`, { equipaId }
    );

    res.json({ sucesso: true, pedidos: resultado.recordset });
  } catch (err) {
    console.error('[Equipas] Erro ao listar pedidos:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/equipas/:id/pedidos/:pedidoId/aceitar
async function aceitarPedidoEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const pedidoId = parseInt(req.params.pedidoId);

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });

    const pedido = await query(
      `SELECT utilizador_id FROM pedidos_equipa WHERE id = @pid AND equipa_id = @eid AND estado = 'pendente'`,
      { pid: pedidoId, eid: equipaId }
    );
    if (pedido.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });

    const uid = pedido.recordset[0].utilizador_id;

    // Add as member
    await query(
      `INSERT INTO equipa_membros (equipa_id, utilizador_id, papel, created_at)
       VALUES (@eid, @uid, 'membro', GETUTCDATE())`,
      { eid: equipaId, uid }
    );

    // Update request state
    await query(`UPDATE pedidos_equipa SET estado = 'aceite' WHERE id = @pid`, { pid: pedidoId });

    res.json({ sucesso: true, mensagem: 'Pedido aceite! Membro adicionado.' });
  } catch (err) {
    console.error('[Equipas] Erro ao aceitar pedido:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/equipas/:id/pedidos/:pedidoId/rejeitar
async function rejeitarPedidoEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const pedidoId = parseInt(req.params.pedidoId);

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });

    await query(`UPDATE pedidos_equipa SET estado = 'rejeitado' WHERE id = @pid AND equipa_id = @eid`,
      { pid: pedidoId, eid: equipaId });

    res.json({ sucesso: true, mensagem: 'Pedido rejeitado.' });
  } catch (err) {
    console.error('[Equipas] Erro ao rejeitar pedido:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/equipas/:id/membros — kept for backwards compatibility (captain adds member)
async function adicionarMembro(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const { utilizadorId } = req.body;

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode adicionar membros.' });

    const jaExiste = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @utilizadorId',
      { equipaId, utilizadorId: parseInt(utilizadorId) }
    );
    if (jaExiste.recordset.length > 0)
      return res.status(409).json({ sucesso: false, mensagem: 'Jogador já pertence à equipa.' });

    await query(
      `INSERT INTO equipa_membros (equipa_id, utilizador_id, papel, created_at)
       VALUES (@equipaId, @utilizadorId, 'membro', GETUTCDATE())`,
      { equipaId, utilizadorId: parseInt(utilizadorId) }
    );

    res.json({ sucesso: true, mensagem: 'Membro adicionado.' });
  } catch (err) {
    console.error('[Equipas] Erro ao adicionar membro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/equipas/:id/membros/:utilizadorId
async function removerMembro(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const membroId = parseInt(req.params.utilizadorId);

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });

    const isCapitao = equipa.recordset[0].capitao_id === req.utilizador.id;
    const isSelf = membroId === req.utilizador.id;

    if (!isCapitao && !isSelf)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
    if (isCapitao && membroId === req.utilizador.id)
      return res.status(400).json({ sucesso: false, mensagem: 'O capitão não pode sair. Elimina a equipa.' });

    await query(
      'DELETE FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @membroId',
      { equipaId, membroId }
    );

    res.json({ sucesso: true, mensagem: 'Membro removido.' });
  } catch (err) {
    console.error('[Equipas] Erro ao remover membro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/utilizadores/me/equipa
async function getEquipaDoUtilizador(req, res) {
  try {
    const id = req.utilizador?.id || req.params?.id;
    if (!id) return res.json({ sucesso: true, equipa: null });
    const resultado = await query(
      `SELECT e.id, e.nome, e.emblema, e.nivel, e.regiao, e.a_recrutar, m.papel
       FROM equipa_membros m JOIN equipas e ON m.equipa_id = e.id
       WHERE m.utilizador_id = @id`, { id: parseInt(id) }
    );
    res.json({ sucesso: true, equipa: resultado.recordset[0] || null });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// ── CHAT DE EQUIPA ───────────────────────────────────────────

// GET /api/equipas/:id/chat
async function getMensagensEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;

    // Verificar se é membro
    const membro = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @uid',
      { equipaId, uid: utilizadorId }
    );
    if (membro.recordset.length === 0)
      return res.status(403).json({ sucesso: false, mensagem: 'Só membros podem ver o chat.' });

    const resultado = await query(
      `SELECT m.id, m.mensagem, m.tipo, m.created_at,
              u.id AS utilizador_id, u.nome, u.nickname, u.foto_url, u.perfil_publico
       FROM mensagens_equipa m
       JOIN utilizadores u ON m.utilizador_id = u.id
       WHERE m.equipa_id = @equipaId
       ORDER BY m.created_at ASC`, { equipaId }
    );

    res.json({ sucesso: true, mensagens: resultado.recordset });
  } catch (err) {
    console.error('[Equipas] Erro ao obter chat:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/equipas/:id/chat
async function enviarMensagemEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { mensagem } = req.body;

    if (!mensagem?.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem vazia.' });

    const membro = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @uid',
      { equipaId, uid: utilizadorId }
    );
    if (membro.recordset.length === 0)
      return res.status(403).json({ sucesso: false, mensagem: 'Só membros podem enviar mensagens.' });

    const resultado = await query(
      `INSERT INTO mensagens_equipa (equipa_id, utilizador_id, mensagem, tipo, created_at)
       OUTPUT INSERTED.id, INSERTED.created_at
       VALUES (@equipaId, @uid, @mensagem, 'texto', GETUTCDATE())`,
      { equipaId, uid: utilizadorId, mensagem: mensagem.trim().substring(0, 500) }
    );

    res.status(201).json({
      sucesso: true,
      mensagem: {
        id: resultado.recordset[0].id,
        mensagem: mensagem.trim().substring(0, 500),
        tipo: 'texto',
        created_at: resultado.recordset[0].created_at,
        utilizador_id: utilizadorId,
        utilizador_nome: req.utilizador.nome,
      }
    });
  } catch (err) {
    console.error('[Equipas] Erro ao enviar mensagem:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// ── ADMIN DE EQUIPA ──────────────────────────────────────────

// PUT /api/equipas/:id/membros/:utilizadorId/promover
async function promoverCapitao(req, res) {
  try {
    const equipaId = parseInt(req.params.id);
    const novoCapitaoId = parseInt(req.params.utilizadorId);

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: equipaId });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode promover.' });

    const membro = await query(
      'SELECT id FROM equipa_membros WHERE equipa_id = @equipaId AND utilizador_id = @uid',
      { equipaId, uid: novoCapitaoId }
    );
    if (membro.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Membro não encontrado.' });

    // Trocar papéis
    await query(
      `UPDATE equipa_membros SET papel = 'membro' WHERE equipa_id = @equipaId AND utilizador_id = @antigoId`,
      { equipaId, antigoId: req.utilizador.id }
    );
    await query(
      `UPDATE equipa_membros SET papel = 'capitao' WHERE equipa_id = @equipaId AND utilizador_id = @novoId`,
      { equipaId, novoId: novoCapitaoId }
    );
    await query(
      'UPDATE equipas SET capitao_id = @novoId, updated_at = GETUTCDATE() WHERE id = @equipaId',
      { equipaId, novoId: novoCapitaoId }
    );

    res.json({ sucesso: true, mensagem: 'Capitão atualizado!' });
  } catch (err) {
    console.error('[Equipas] Erro ao promover:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// ── CALENDÁRIO DE EQUIPA ─────────────────────────────────────

// GET /api/equipas/:id/calendario
async function getCalendarioEquipa(req, res) {
  try {
    const equipaId = parseInt(req.params.id);

    const resultado = await query(
      `SELECT j.id, j.titulo, j.data_jogo, j.local, j.regiao, j.tipo_jogo, j.nivel,
              j.max_jogadores, j.estado, j.visibilidade, j.modo_jogo,
              ie.lado, ie.estado AS inscricao_estado,
              u.nome AS criador_nome,
              ea.nome AS adversario_nome, ea.emblema AS adversario_emblema,
              r.golos_equipa_a, r.golos_equipa_b
       FROM inscricoes_equipa ie
       JOIN jogos j ON ie.jogo_id = j.id
       JOIN utilizadores u ON j.criador_id = u.id
       LEFT JOIN inscricoes_equipa ie2 ON ie2.jogo_id = j.id AND ie2.equipa_id != @equipaId
       LEFT JOIN equipas ea ON ie2.equipa_id = ea.id
       LEFT JOIN resultado_jogo r ON r.jogo_id = j.id
       WHERE ie.equipa_id = @equipaId
         AND j.data_jogo >= DATEADD(DAY, -30, GETUTCDATE())
       ORDER BY j.data_jogo ASC`, { equipaId }
    );

    res.json({ sucesso: true, jogos: resultado.recordset });
  } catch (err) {
    console.error('[Equipas] Erro ao obter calendário:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// ── JOGOS DE EQUIPA ──────────────────────────────────────────

// POST /api/jogos/:id/inscrever-equipa
async function inscreverEquipa(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { equipaId, codigoAcesso } = req.body;

    if (!equipaId)
      return res.status(400).json({ sucesso: false, mensagem: 'ID da equipa é obrigatório.' });

    // Verificar se é capitão da equipa
    const equipa = await query(
      'SELECT id, nome, capitao_id FROM equipas WHERE id = @id', { id: parseInt(equipaId) }
    );
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== utilizadorId)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode inscrever a equipa.' });

    // Verificar jogo
    const jogo = await query(
      `SELECT id, modo_jogo, estado, visibilidade, codigo_acesso FROM jogos WHERE id = @id`,
      { id: jogoId }
    );
    if (jogo.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const j = jogo.recordset[0];
    if (j.modo_jogo !== 'equipa')
      return res.status(400).json({ sucesso: false, mensagem: 'Este jogo não é de equipas.' });
    if (j.estado !== 'aberto')
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo não está aberto.' });

    // Validar código privado
    if (j.visibilidade === 'privado') {
      if (!codigoAcesso || codigoAcesso.toUpperCase() !== j.codigo_acesso)
        return res.status(403).json({ sucesso: false, mensagem: 'Código de acesso inválido.' });
    }

    // Verificar se a equipa já está inscrita
    const jaInscrita = await query(
      'SELECT id FROM inscricoes_equipa WHERE jogo_id = @jogoId AND equipa_id = @equipaId',
      { jogoId, equipaId: parseInt(equipaId) }
    );
    if (jaInscrita.recordset.length > 0)
      return res.status(409).json({ sucesso: false, mensagem: 'Equipa já inscrita.' });

    // Determinar lado (A ou B)
    const inscritas = await query(
      'SELECT lado FROM inscricoes_equipa WHERE jogo_id = @jogoId AND estado = \'confirmado\'',
      { jogoId }
    );
    if (inscritas.recordset.length >= 2)
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo já tem 2 equipas inscritas.' });

    const lado = inscritas.recordset.some(i => i.lado === 'A') ? 'B' : 'A';

    await query(
      `INSERT INTO inscricoes_equipa (jogo_id, equipa_id, lado, estado, created_at)
       VALUES (@jogoId, @equipaId, @lado, 'confirmado', GETUTCDATE())`,
      { jogoId, equipaId: parseInt(equipaId), lado }
    );

    // Se 2 equipas, marcar como cheio
    if (inscritas.recordset.length + 1 >= 2)
      await query("UPDATE jogos SET estado = 'cheio' WHERE id = @jogoId", { jogoId });

    res.json({ sucesso: true, mensagem: `Equipa inscrita no lado ${lado}!`, lado });
  } catch (err) {
    console.error('[Jogos] Erro ao inscrever equipa:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/jogos/:id/inscrever-equipa
async function cancelarInscricaoEquipa(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const { equipaId } = req.body;

    const equipa = await query('SELECT capitao_id FROM equipas WHERE id = @id', { id: parseInt(equipaId) });
    if (equipa.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Equipa não encontrada.' });
    if (equipa.recordset[0].capitao_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Só o capitão pode cancelar.' });

    await query(
      'DELETE FROM inscricoes_equipa WHERE jogo_id = @jogoId AND equipa_id = @equipaId',
      { jogoId, equipaId: parseInt(equipaId) }
    );
    await query("UPDATE jogos SET estado = 'aberto' WHERE id = @jogoId AND estado = 'cheio'", { jogoId });

    res.json({ sucesso: true, mensagem: 'Inscrição da equipa cancelada.' });
  } catch (err) {
    console.error('[Jogos] Erro ao cancelar inscrição equipa:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = {
  listarEquipas, obterEquipa, criarEquipa, editarEquipa, eliminarEquipa,
  entrarEquipa, pedirEntrada, listarPedidosEquipa, aceitarPedidoEquipa, rejeitarPedidoEquipa,
  adicionarMembro, removerMembro, getEquipaDoUtilizador,
  getMensagensEquipa, enviarMensagemEquipa,
  promoverCapitao, getCalendarioEquipa,
  inscreverEquipa, cancelarInscricaoEquipa
};
