// ============================================================
//  FutBuddies - Controlador de Notas Globais (Admin)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacaoBroadcast } = require('./notificacoesController');

// POST /api/admin/notas
// Cria uma nota global + envia notificação a todos os utilizadores ativos
async function criarNota(req, res) {
  try {
    const { titulo, mensagem, expiraEm } = req.body;
    const adminId = req.utilizador.id;

    if (!titulo?.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'Título obrigatório.' });
    if (!mensagem?.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem obrigatória.' });

    // 1. Persistir a nota em si (histórico do admin)
    const inserida = await query(
      `INSERT INTO notas_admin (admin_id, titulo, mensagem, expira_em)
         OUTPUT INSERTED.id
         VALUES (@aid, @t, @m, @exp)`,
      {
        aid: adminId,
        t: titulo.trim().substring(0, 120),
        m: mensagem.trim().substring(0, 1000),
        exp: expiraEm ? new Date(expiraEm) : null,
      }
    );

    // 2. Obter todos os utilizadores ativos (excluir o próprio admin? — não, mostrar também)
    const users = await query(
      `SELECT id FROM utilizadores WHERE ativo = 1`
    );
    const ids = users.recordset.map(u => u.id);

    // 3. Broadcast em batch
    await criarNotificacaoBroadcast({
      utilizadorIds: ids,
      tipo: 'nota_admin',
      titulo: titulo.trim().substring(0, 120),
      mensagem: mensagem.trim().substring(0, 500),
      acaoUrl: null,
      expiraEm: expiraEm ? new Date(expiraEm) : null,
    });

    res.json({
      sucesso: true,
      mensagem: `Nota enviada a ${ids.length} utilizador(es).`,
      notaId: inserida.recordset[0].id,
    });
  } catch (err) {
    console.error('[AdminNotas] Erro criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar nota.' });
  }
}

// GET /api/admin/notas
async function listarNotas(req, res) {
  try {
    const r = await query(
      `SELECT TOP 100 n.id, n.titulo, n.mensagem, n.expira_em, n.created_at,
                      u.nome AS admin_nome
         FROM notas_admin n
         JOIN utilizadores u ON u.id = n.admin_id
         ORDER BY n.created_at DESC`
    );
    res.json({ sucesso: true, notas: r.recordset });
  } catch (err) {
    console.error('[AdminNotas] Erro listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// DELETE /api/admin/notas/:id
// Apaga a nota (histórico) — NÃO apaga as notificações já entregues, por design
// (os utilizadores continuam a ver o anúncio até o fecharem).
async function eliminarNota(req, res) {
  try {
    const { id } = req.params;
    const r = await query(`DELETE FROM notas_admin WHERE id = @id`, { id: parseInt(id) });
    if (r.rowsAffected[0] === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Nota não encontrada.' });
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[AdminNotas] Erro eliminar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { criarNota, listarNotas, eliminarNota };
