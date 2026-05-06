// ============================================================
//  FutBuddies - Controlador de Chat (v2 — imagens, gifs, reações, menções)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// GET /api/jogos/:id/chat
async function getMensagens(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const { limite = 60, antes } = req.query;

    let whereClause = 'WHERE m.jogo_id = @jogoId';
    const params = { jogoId, limite: parseInt(limite) };

    if (antes) {
      whereClause += ' AND m.id < @antes';
      params.antes = parseInt(antes);
    }

    const resultado = await query(
      `SELECT TOP (@limite)
         m.id, m.mensagem, m.tipo, m.media_url, m.mencoes_json, m.created_at,
         u.id AS utilizador_id, u.nome AS utilizador_nome,
         u.nickname, u.foto_url, u.perfil_publico
       FROM mensagens_chat m
       JOIN utilizadores u ON m.utilizador_id = u.id
       ${whereClause}
       ORDER BY m.created_at DESC`,
      params
    );

    const mensagens = resultado.recordset.reverse();
    const ids = mensagens.map(m => m.id);

    // Buscar reações agrupadas para estas mensagens
    let reacoes = [];
    if (ids.length > 0) {
      try {
        const rRes = await query(
          `SELECT mensagem_id, emoji, COUNT(*) AS total,
                  STRING_AGG(CAST(utilizador_id AS NVARCHAR), ',') AS utilizadores
           FROM reacoes_chat
           WHERE mensagem_id IN (${ids.join(',')})
           GROUP BY mensagem_id, emoji`
        );
        reacoes = rRes.recordset;
      } catch (_) { /* tabela pode não existir ainda */ }
    }

    // Juntar reações às mensagens
    const mensagensComReacoes = mensagens.map(m => ({
      ...m,
      reacoes: reacoes
        .filter(r => r.mensagem_id === m.id)
        .map(r => ({
          emoji: r.emoji,
          total: r.total,
          utilizadores: r.utilizadores ? r.utilizadores.split(',').map(Number) : [],
        })),
    }));

    res.json({ sucesso: true, mensagens: mensagensComReacoes });
  } catch (err) {
    console.error('[Chat] Erro ao buscar mensagens:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/jogos/:id/chat
async function enviarMensagem(req, res) {
  try {
    const jogoId  = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { mensagem, tipo = 'texto', mediaUrl, mencoes = [] } = req.body;

    // Validações
    if (tipo === 'texto' && (!mensagem || mensagem.trim().length === 0))
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem não pode estar vazia.' });
    if (tipo !== 'texto' && !mediaUrl)
      return res.status(400).json({ sucesso: false, mensagem: 'media_url obrigatório para imagem/gif.' });
    if (tipo === 'texto' && mensagem.length > 1000)
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem demasiado longa (máx. 1000 caracteres).' });

    // Verificar se utilizador está inscrito ou é criador
    const inscricao = await query(
      `SELECT i.id FROM inscricoes i WHERE i.jogo_id=@jogoId AND i.utilizador_id=@uid AND i.estado='confirmado'
       UNION
       SELECT j.id FROM jogos j WHERE j.id=@jogoId AND j.criador_id=@uid`,
      { jogoId, uid: utilizadorId }
    );
    if (inscricao.recordset.length === 0 && req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Tens de estar inscrito no jogo para enviar mensagens.' });

    const mencoesFinal = Array.isArray(mencoes) ? mencoes.slice(0, 10) : [];

    const resultado = await query(
      `INSERT INTO mensagens_chat (jogo_id, utilizador_id, mensagem, tipo, media_url, mencoes_json, created_at)
       OUTPUT INSERTED.id, INSERTED.created_at
       VALUES (@jogoId, @utilizadorId, @mensagem, @tipo, @mediaUrl, @mencoes, GETUTCDATE())`,
      {
        jogoId, utilizadorId,
        mensagem: tipo === 'texto' ? mensagem.trim() : (mensagem || ''),
        tipo,
        mediaUrl: mediaUrl || null,
        mencoes: mencoesFinal.length ? JSON.stringify(mencoesFinal) : null,
      }
    );

    const msg = resultado.recordset[0];

    // Notificar utilizadores mencionados
    for (const uid of mencoesFinal) {
      if (uid !== utilizadorId) {
        try {
          await criarNotificacao({
            utilizadorId: uid,
            tipo: 'chat',
            titulo: '💬 Mencionaram-te no chat',
            mensagem: `${req.utilizador.nome} mencionou-te no chat do jogo.`,
            jogoId,
          });
        } catch (_) {}
      }
    }

    const novaMensagem = {
      id: msg.id,
      mensagem: tipo === 'texto' ? mensagem.trim() : (mensagem || ''),
      tipo,
      media_url: mediaUrl || null,
      mencoes_json: mencoesFinal.length ? JSON.stringify(mencoesFinal) : null,
      created_at: msg.created_at,
      utilizador_id: utilizadorId,
      utilizador_nome: req.utilizador.nome,
      nickname: req.utilizador.nickname || null,
      foto_url: req.utilizador.foto_url || null,
      reacoes: [],
    };

    // Broadcast para todos na sala (incluindo sender) com o ID real do DB
    const io = req.app.get('io');
    if (io) io.to(`jogo_${jogoId}`).emit('nova_mensagem', novaMensagem);

    res.status(201).json({ sucesso: true, mensagem: novaMensagem });
  } catch (err) {
    console.error('[Chat] Erro ao enviar mensagem:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno do servidor.' });
  }
}

// POST /api/jogos/:id/chat/:msgId/reacao
async function toggleReacao(req, res) {
  try {
    const mensagemId  = parseInt(req.params.msgId);
    const utilizadorId = req.utilizador.id;
    const { emoji } = req.body;

    const EMOJIS_PERMITIDOS = ['👍', '⚽', '🔥', '😂', '❤️'];
    if (!emoji || !EMOJIS_PERMITIDOS.includes(emoji))
      return res.status(400).json({ sucesso: false, mensagem: 'Emoji não permitido.' });

    // Verificar se já existe (toggle)
    const existente = await query(
      `SELECT id FROM reacoes_chat WHERE mensagem_id=@mid AND utilizador_id=@uid AND emoji=@emoji`,
      { mid: mensagemId, uid: utilizadorId, emoji }
    );

    if (existente.recordset.length > 0) {
      await query(`DELETE FROM reacoes_chat WHERE mensagem_id=@mid AND utilizador_id=@uid AND emoji=@emoji`,
        { mid: mensagemId, uid: utilizadorId, emoji });
    } else {
      await query(
        `INSERT INTO reacoes_chat (mensagem_id, utilizador_id, emoji) VALUES (@mid, @uid, @emoji)`,
        { mid: mensagemId, uid: utilizadorId, emoji }
      );
    }

    // Devolver estado actualizado das reações desta mensagem
    const rRes = await query(
      `SELECT emoji, COUNT(*) AS total,
              STRING_AGG(CAST(utilizador_id AS NVARCHAR), ',') AS utilizadores
       FROM reacoes_chat WHERE mensagem_id=@mid
       GROUP BY emoji`,
      { mid: mensagemId }
    );

    res.json({
      sucesso: true,
      mensagemId,
      reacoes: rRes.recordset.map(r => ({
        emoji: r.emoji,
        total: r.total,
        utilizadores: r.utilizadores ? r.utilizadores.split(',').map(Number) : [],
      })),
    });
  } catch (err) {
    console.error('[Chat] Reação:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { getMensagens, enviarMensagem, toggleReacao };
