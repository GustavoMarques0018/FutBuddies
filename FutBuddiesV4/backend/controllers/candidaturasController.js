// ============================================================
//  FutBuddies - Candidaturas a Dono de Campo
// ============================================================
const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// POST /api/candidaturas/dono-campo
async function submeter(req, res) {
  try {
    const uid = req.utilizador.id;
    const {
      nome, tipoPiso, morada, regiao, telefone,
      precoHoraCents, duracaoMin,
      fotos,          // array de URLs
      provaUrl,       // URL da prova de titularidade
      nota,           // opcional
      horaAbertura, horaFecho, diasSemana, lotacoes,
    } = req.body;

    const clampM = (v) => {
      const n = parseInt(v);
      return (Number.isNaN(n) || n < 0 || n > 1440) ? null : n;
    };
    const jsonArr = (v) => {
      if (Array.isArray(v)) return JSON.stringify(v);
      if (typeof v === 'string' && v.trim().startsWith('[')) return v;
      return null;
    };

    if (!nome || !nome.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'Nome do campo obrigatório.' });
    if (!provaUrl)
      return res.status(400).json({ sucesso: false, mensagem: 'Prova de titularidade obrigatória (upload).' });
    if (!Array.isArray(fotos) || fotos.length < 5)
      return res.status(400).json({ sucesso: false, mensagem: 'Submete pelo menos 5 fotos do campo.' });

    // Não permitir 2 candidaturas pendentes em simultâneo
    const pend = await query(
      `SELECT id FROM campo_candidaturas WHERE utilizador_id=@u AND estado IN ('pendente','info_requerida')`,
      { u: uid }
    );
    if (pend.recordset.length) {
      return res.status(400).json({ sucesso: false, mensagem: 'Já tens uma candidatura em análise.' });
    }

    const r = await query(
      `INSERT INTO campo_candidaturas
        (utilizador_id, nome, tipo_piso, morada, regiao, telefone,
         preco_hora_cents, duracao_min, fotos_json, prova_url, nota_candidato, estado,
         hora_abertura, hora_fecho, dias_semana_json, lotacoes_json)
       OUTPUT INSERTED.*
       VALUES (@u,@n,@tp,@m,@r,@t,@p,@d,@fj,@pr,@nc,'pendente',
               @ha,@hf,@ds,@lot)`,
      { u: uid, n: nome.trim(), tp: tipoPiso || null, m: morada || null, r: regiao || null,
        t: telefone || null, p: precoHoraCents ? parseInt(precoHoraCents) : null,
        d: parseInt(duracaoMin || 60),
        fj: JSON.stringify(fotos || []), pr: provaUrl, nc: nota || null,
        ha: clampM(horaAbertura), hf: clampM(horaFecho),
        ds: jsonArr(diasSemana), lot: jsonArr(lotacoes) }
    );

    // Notificar admins
    try {
      const admins = await query(`SELECT id FROM utilizadores WHERE role='admin' AND ativo=1`);
      for (const a of admins.recordset) {
        await criarNotificacao({
          utilizadorId: a.id,
          tipo: 'candidatura_admin',
          titulo: `📝 Nova candidatura a Dono de Campo: ${nome.trim().slice(0, 80)}`,
          mensagem: `Região: ${regiao || '—'} · Preço: ${precoHoraCents ? (precoHoraCents/100).toFixed(2) + '€/h' : '—'}`,
          acaoUrl: '/admin?tab=candidaturas',
        });
      }
    } catch (e) { console.warn('[Candidaturas] notif admin falhou:', e?.message); }

    res.status(201).json({ sucesso: true, candidatura: r.recordset[0] });
  } catch (err) {
    console.error('[Candidaturas] submeter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/candidaturas/minhas
async function minhas(req, res) {
  try {
    const r = await query(
      `SELECT * FROM campo_candidaturas WHERE utilizador_id=@u ORDER BY created_at DESC`,
      { u: req.utilizador.id }
    );
    res.json({ sucesso: true, candidaturas: r.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/admin/candidaturas?estado=pendente
async function listarAdmin(req, res) {
  try {
    const { estado } = req.query;
    const where = estado ? `WHERE c.estado = @e` : '';
    const r = await query(
      `SELECT c.*, u.nome AS candidato_nome, u.email AS candidato_email, u.foto_url AS candidato_foto
       FROM campo_candidaturas c
       JOIN utilizadores u ON u.id = c.utilizador_id
       ${where}
       ORDER BY
         CASE c.estado WHEN 'pendente' THEN 0 WHEN 'info_requerida' THEN 1 ELSE 2 END,
         c.created_at DESC`,
      estado ? { e: estado } : {}
    );
    res.json({ sucesso: true, candidaturas: r.recordset });
  } catch (err) {
    console.error('[Candidaturas] listarAdmin:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/admin/candidaturas/:id/aprovar
async function aprovar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const adminId = req.utilizador.id;
    const { nota } = req.body || {};

    const cR = await query(`SELECT * FROM campo_candidaturas WHERE id=@id`, { id });
    if (!cR.recordset.length) return res.status(404).json({ sucesso: false });
    const c = cR.recordset[0];
    if (c.estado === 'aprovada')
      return res.status(400).json({ sucesso: false, mensagem: 'Já aprovada.' });

    // 1. Criar o campo efectivamente (estado='ativo')
    const campoR = await query(
      `INSERT INTO campos (dono_id, nome, foto_url, fotos_json, tipo_piso, morada, regiao,
                           preco_hora_cents, duracao_min, estado, ativo,
                           hora_abertura, hora_fecho, dias_semana_json, lotacoes_json)
       OUTPUT INSERTED.id
       VALUES (@d,@n,@f,@fj,@tp,@m,@r,@p,@du,'ativo',1,
               @ha,@hf,@ds,@lot)`,
      { d: c.utilizador_id, n: c.nome,
        f: (() => { try { return (JSON.parse(c.fotos_json || '[]'))[0] || null; } catch { return null; } })(),
        fj: c.fotos_json || '[]',
        tp: c.tipo_piso, m: c.morada, r: c.regiao,
        p: c.preco_hora_cents || 0, du: c.duracao_min || 60,
        ha: c.hora_abertura ?? 480,
        hf: c.hora_fecho ?? 1380,
        ds: c.dias_semana_json || '[1,2,3,4,5,6,7]',
        lot: c.lotacoes_json || '[5,7]' }
    );
    const campoId = campoR.recordset[0].id;

    // 2. Atualizar candidatura
    await query(
      `UPDATE campo_candidaturas SET estado='aprovada', campo_id=@cid,
         revisto_por=@a, revisto_em=GETUTCDATE(), nota_admin=@n, updated_at=GETUTCDATE()
       WHERE id=@id`,
      { id, cid: campoId, a: adminId, n: nota || null }
    );

    // 3. Promover utilizador a FIELD_OWNER
    await query(
      `UPDATE utilizadores SET user_role='FIELD_OWNER' WHERE id=@u`,
      { u: c.utilizador_id }
    );

    // 4. Notificar candidato
    await criarNotificacao({
      utilizadorId: c.utilizador_id,
      tipo: 'sistema',
      titulo: '✅ Candidatura aprovada!',
      mensagem: `O campo "${c.nome}" foi aprovado. Já podes configurar pagamentos via Stripe.`,
      acaoUrl: '/dono-campo',
    });

    res.json({ sucesso: true, campoId });
  } catch (err) {
    console.error('[Candidaturas] aprovar:', err);
    res.status(500).json({ sucesso: false, mensagem: err.message });
  }
}

// PUT /api/admin/candidaturas/:id/rejeitar
async function rejeitar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { nota } = req.body || {};
    const cR = await query(`SELECT utilizador_id, nome FROM campo_candidaturas WHERE id=@id`, { id });
    if (!cR.recordset.length) return res.status(404).json({ sucesso: false });

    await query(
      `UPDATE campo_candidaturas SET estado='rejeitada', nota_admin=@n,
         revisto_por=@a, revisto_em=GETUTCDATE(), updated_at=GETUTCDATE()
       WHERE id=@id`,
      { id, n: nota || null, a: req.utilizador.id }
    );

    await criarNotificacao({
      utilizadorId: cR.recordset[0].utilizador_id,
      tipo: 'sistema',
      titulo: '❌ Candidatura rejeitada',
      mensagem: `A candidatura para "${cR.recordset[0].nome}" foi rejeitada.${nota ? ' Motivo: ' + nota : ''}`,
      acaoUrl: '/dono-campo',
    });

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Candidaturas] rejeitar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/admin/candidaturas/:id/pedir-info
async function pedirInfo(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { nota } = req.body || {};
    if (!nota) return res.status(400).json({ sucesso: false, mensagem: 'Indica o que precisas de mais informação.' });

    const cR = await query(`SELECT utilizador_id, nome FROM campo_candidaturas WHERE id=@id`, { id });
    if (!cR.recordset.length) return res.status(404).json({ sucesso: false });

    await query(
      `UPDATE campo_candidaturas SET estado='info_requerida', nota_admin=@n,
         revisto_por=@a, revisto_em=GETUTCDATE(), updated_at=GETUTCDATE()
       WHERE id=@id`,
      { id, n: nota, a: req.utilizador.id }
    );

    await criarNotificacao({
      utilizadorId: cR.recordset[0].utilizador_id,
      tipo: 'sistema',
      titulo: 'ℹ️ Informação adicional necessária',
      mensagem: `Candidatura "${cR.recordset[0].nome}": ${nota}`,
      acaoUrl: '/dono-campo',
    });

    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { submeter, minhas, listarAdmin, aprovar, rejeitar, pedirInfo };
