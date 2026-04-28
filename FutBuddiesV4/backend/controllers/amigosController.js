// ============================================================
//  FutBuddies - Controlador de Amigos e Chat Privado
// ============================================================

const { query } = require('../config/database');

// GET /api/amigos — lista amigos aceites
async function listarAmigos(req, res) {
  try {
    const uid = req.utilizador.id;
    const resultado = await query(
      `SELECT a.id AS amizade_id,
              CASE WHEN a.remetente_id=@uid THEN a.destinatario_id ELSE a.remetente_id END AS amigo_id,
              u.nome, u.nickname, u.foto_url, u.posicao, u.regiao,
              a.created_at
       FROM amizades a
       JOIN utilizadores u ON u.id = CASE WHEN a.remetente_id=@uid THEN a.destinatario_id ELSE a.remetente_id END
       WHERE (a.remetente_id=@uid OR a.destinatario_id=@uid) AND a.estado='aceite'
       ORDER BY u.nome ASC`, { uid }
    );
    res.json({ sucesso: true, amigos: resultado.recordset });
  } catch (err) {
    console.error('[Amigos] Listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/amigos/pedidos — pedidos pendentes recebidos
async function listarPedidos(req, res) {
  try {
    const uid = req.utilizador.id;
    const resultado = await query(
      `SELECT a.id, a.remetente_id, u.nome, u.nickname, u.foto_url, u.posicao, u.regiao, a.created_at
       FROM amizades a
       JOIN utilizadores u ON u.id = a.remetente_id
       WHERE a.destinatario_id=@uid AND a.estado='pendente'
       ORDER BY a.created_at DESC`, { uid }
    );
    res.json({ sucesso: true, pedidos: resultado.recordset });
  } catch (err) {
    console.error('[Amigos] Pedidos:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/amigos/enviar — enviar pedido de amizade
async function enviarPedido(req, res) {
  try {
    const uid = req.utilizador.id;
    const { destinatarioId } = req.body;
    if (!destinatarioId || destinatarioId === uid)
      return res.status(400).json({ sucesso: false, mensagem: 'Destinatário inválido.' });

    // Verificar se já existe relação
    const existe = await query(
      `SELECT id, estado FROM amizades
       WHERE (remetente_id=@uid AND destinatario_id=@dest) OR (remetente_id=@dest AND destinatario_id=@uid)`,
      { uid, dest: parseInt(destinatarioId) }
    );
    if (existe.recordset.length > 0) {
      const rel = existe.recordset[0];
      if (rel.estado === 'aceite') return res.status(409).json({ sucesso: false, mensagem: 'Já são amigos.' });
      if (rel.estado === 'pendente') return res.status(409).json({ sucesso: false, mensagem: 'Pedido já enviado.' });
      if (rel.estado === 'rejeitado') {
        await query('UPDATE amizades SET estado=\'pendente\', remetente_id=@uid, destinatario_id=@dest, created_at=GETUTCDATE() WHERE id=@id',
          { uid, dest: parseInt(destinatarioId), id: rel.id });
        return res.json({ sucesso: true, mensagem: 'Pedido de amizade reenviado!' });
      }
    }

    await query(
      `INSERT INTO amizades (remetente_id, destinatario_id, estado, created_at)
       VALUES (@uid, @dest, 'pendente', GETUTCDATE())`,
      { uid, dest: parseInt(destinatarioId) }
    );
    res.status(201).json({ sucesso: true, mensagem: 'Pedido de amizade enviado!' });
  } catch (err) {
    console.error('[Amigos] Enviar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/amigos/:id/aceitar
async function aceitarPedido(req, res) {
  try {
    const uid = req.utilizador.id;
    const { id } = req.params;
    const resultado = await query(
      'UPDATE amizades SET estado=\'aceite\' WHERE id=@id AND destinatario_id=@uid AND estado=\'pendente\'',
      { id: parseInt(id), uid }
    );
    if (resultado.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
    res.json({ sucesso: true, mensagem: 'Amizade aceite!' });
  } catch (err) {
    console.error('[Amigos] Aceitar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/amigos/:id/rejeitar
async function rejeitarPedido(req, res) {
  try {
    const uid = req.utilizador.id;
    const { id } = req.params;
    const resultado = await query(
      'UPDATE amizades SET estado=\'rejeitado\' WHERE id=@id AND destinatario_id=@uid AND estado=\'pendente\'',
      { id: parseInt(id), uid }
    );
    if (resultado.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Pedido não encontrado.' });
    res.json({ sucesso: true, mensagem: 'Pedido rejeitado.' });
  } catch (err) {
    console.error('[Amigos] Rejeitar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/amigos/:id — remover amigo
async function removerAmigo(req, res) {
  try {
    const uid = req.utilizador.id;
    const { id } = req.params;
    const resultado = await query(
      'DELETE FROM amizades WHERE id=@id AND (remetente_id=@uid OR destinatario_id=@uid) AND estado=\'aceite\'',
      { id: parseInt(id), uid }
    );
    if (resultado.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Amizade não encontrada.' });
    res.json({ sucesso: true, mensagem: 'Amigo removido.' });
  } catch (err) {
    console.error('[Amigos] Remover:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/amigos/pesquisar?q=nome — pesquisar utilizadores para adicionar
async function pesquisarUtilizadores(req, res) {
  try {
    const uid = req.utilizador.id;
    const { q } = req.query;
    if (!q || q.trim().length < 2)
      return res.json({ sucesso: true, utilizadores: [] });

    const resultado = await query(
      `SELECT TOP 20 u.id, u.nome, u.nickname, u.foto_url, u.posicao, u.regiao,
              (SELECT TOP 1 a.estado FROM amizades a
               WHERE (a.remetente_id=@uid AND a.destinatario_id=u.id) OR (a.remetente_id=u.id AND a.destinatario_id=@uid)) AS estado_amizade
       FROM utilizadores u
       WHERE u.id != @uid AND (u.nome LIKE @q OR u.nickname LIKE @q)
       ORDER BY u.nome ASC`,
      { uid, q: `%${q.trim()}%` }
    );
    res.json({ sucesso: true, utilizadores: resultado.recordset });
  } catch (err) {
    console.error('[Amigos] Pesquisar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/amigos/sugestoes — perfis sugeridos (mesma região, mesma equipa, etc.)
async function sugerirUtilizadores(req, res) {
  try {
    const uid = req.utilizador.id;
    const resultado = await query(
      `SELECT TOP 15 u.id, u.nome, u.nickname, u.foto_url, u.posicao, u.regiao
       FROM utilizadores u
       WHERE u.id != @uid
         AND u.id NOT IN (
           SELECT CASE WHEN a.remetente_id=@uid THEN a.destinatario_id ELSE a.remetente_id END
           FROM amizades a WHERE (a.remetente_id=@uid OR a.destinatario_id=@uid) AND a.estado IN ('aceite','pendente')
         )
       ORDER BY
         CASE WHEN u.regiao = (SELECT regiao FROM utilizadores WHERE id=@uid) THEN 0 ELSE 1 END,
         u.total_jogos DESC`, { uid }
    );
    res.json({ sucesso: true, sugestoes: resultado.recordset });
  } catch (err) {
    console.error('[Amigos] Sugestões:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/amigos/chat/:amigoId — mensagens privadas
async function getMensagensPrivadas(req, res) {
  try {
    const uid = req.utilizador.id;
    const amigoId = parseInt(req.params.amigoId);
    const { limite = 50, antes } = req.query;
    const params = { uid, amigoId, limite: parseInt(limite) };

    let where = 'WHERE ((m.remetente_id=@uid AND m.destinatario_id=@amigoId) OR (m.remetente_id=@amigoId AND m.destinatario_id=@uid))';
    if (antes) { where += ' AND m.id < @antes'; params.antes = parseInt(antes); }

    const resultado = await query(
      `SELECT TOP (@limite) m.id, m.remetente_id, m.destinatario_id, m.mensagem, m.lida, m.created_at,
              u.nome AS remetente_nome, u.foto_url AS remetente_foto
       FROM mensagens_privadas m
       JOIN utilizadores u ON u.id = m.remetente_id
       ${where}
       ORDER BY m.created_at DESC`, params
    );

    // Marcar como lidas
    await query(
      'UPDATE mensagens_privadas SET lida=1 WHERE remetente_id=@amigoId AND destinatario_id=@uid AND lida=0',
      { uid, amigoId }
    );

    res.json({ sucesso: true, mensagens: resultado.recordset.reverse() });
  } catch (err) {
    console.error('[Amigos] Chat:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/amigos/chat/:amigoId — enviar mensagem privada
async function enviarMensagemPrivada(req, res) {
  try {
    const uid = req.utilizador.id;
    const amigoId = parseInt(req.params.amigoId);
    const { mensagem } = req.body;

    if (!mensagem || mensagem.trim().length === 0)
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem vazia.' });
    if (mensagem.length > 1000)
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem demasiado longa (máx. 1000).' });

    // Verificar amizade
    const amizade = await query(
      `SELECT id FROM amizades WHERE ((remetente_id=@uid AND destinatario_id=@amigoId) OR (remetente_id=@amigoId AND destinatario_id=@uid)) AND estado='aceite'`,
      { uid, amigoId }
    );
    if (amizade.recordset.length === 0)
      return res.status(403).json({ sucesso: false, mensagem: 'Não são amigos.' });

    const resultado = await query(
      `INSERT INTO mensagens_privadas (remetente_id, destinatario_id, mensagem, lida, created_at)
       OUTPUT INSERTED.id, INSERTED.created_at
       VALUES (@uid, @amigoId, @msg, 0, GETUTCDATE())`,
      { uid, amigoId, msg: mensagem.trim() }
    );

    res.status(201).json({
      sucesso: true,
      mensagem: {
        id: resultado.recordset[0].id,
        remetente_id: uid,
        destinatario_id: amigoId,
        mensagem: mensagem.trim(),
        lida: false,
        created_at: resultado.recordset[0].created_at,
        remetente_nome: req.utilizador.nome,
      }
    });
  } catch (err) {
    console.error('[Amigos] Enviar msg:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = {
  listarAmigos, listarPedidos, enviarPedido, aceitarPedido, rejeitarPedido,
  removerAmigo, pesquisarUtilizadores, sugerirUtilizadores, getMensagensPrivadas, enviarMensagemPrivada
};
