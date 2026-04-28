// ============================================================
//  FutBuddies - Controlador de Chat
//  GET  /api/jogos/:id/chat   - Buscar mensagens
//  POST /api/jogos/:id/chat   - Enviar mensagem
// ============================================================

const { query } = require('../config/database');

// GET /api/jogos/:id/chat
async function getMensagens(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const { limite = 50, antes } = req.query;

    let whereClause = 'WHERE m.jogo_id = @jogoId';
    const params = { jogoId, limite: parseInt(limite) };

    if (antes) {
      whereClause += ' AND m.id < @antes';
      params.antes = parseInt(antes);
    }

    const resultado = await query(
      `SELECT TOP (@limite)
         m.id, m.mensagem, m.tipo, m.created_at,
         u.id AS utilizador_id, u.nome AS utilizador_nome, u.foto_perfil
       FROM mensagens_chat m
       JOIN utilizadores u ON m.utilizador_id = u.id
       ${whereClause}
       ORDER BY m.created_at DESC`,
      params
    );

    // Inverter para ordem cronológica
    const mensagens = resultado.recordset.reverse();

    res.json({ sucesso: true, mensagens });
  } catch (err) {
    console.error('[Chat] Erro ao buscar mensagens:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/jogos/:id/chat
async function enviarMensagem(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { mensagem } = req.body;

    if (!mensagem || mensagem.trim().length === 0) {
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem não pode estar vazia.' });
    }

    if (mensagem.length > 500) {
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem demasiado longa (máx. 500 caracteres).' });
    }

    // Verificar se utilizador está inscrito no jogo
    const inscricao = await query(
      `SELECT id FROM inscricoes
       WHERE jogo_id = @jogoId AND utilizador_id = @utilizadorId AND estado = 'confirmado'`,
      { jogoId, utilizadorId }
    );

    // Admins podem enviar mensagens em qualquer jogo
    if (inscricao.recordset.length === 0 && req.utilizador.role !== 'admin') {
      return res.status(403).json({
        sucesso: false,
        mensagem: 'Tens de estar inscrito no jogo para enviar mensagens.',
      });
    }

    const resultado = await query(
      `INSERT INTO mensagens_chat (jogo_id, utilizador_id, mensagem, tipo, created_at)
       OUTPUT INSERTED.id, INSERTED.created_at
       VALUES (@jogoId, @utilizadorId, @mensagem, 'texto', GETUTCDATE())`,
      { jogoId, utilizadorId, mensagem: mensagem.trim() }
    );

    const novaMensagem = {
      id: resultado.recordset[0].id,
      mensagem: mensagem.trim(),
      tipo: 'texto',
      created_at: resultado.recordset[0].created_at,
      utilizador_id: utilizadorId,
      utilizador_nome: req.utilizador.nome,
    };

    res.status(201).json({ sucesso: true, mensagem: novaMensagem });
  } catch (err) {
    console.error('[Chat] Erro ao enviar mensagem:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

module.exports = { getMensagens, enviarMensagem };
