// ============================================================
//  FutBuddies - Controlador de Campos (donos)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// GET /api/campos?regiao=...&donoId=...
async function listarCampos(req, res) {
  try {
    const { regiao, donoId } = req.query;
    // Só campos ativos E aprovados aparecem nas pesquisas públicas.
    let where = "WHERE c.ativo = 1 AND c.estado = 'ativo'";
    const params = {};
    if (regiao)  { where += ' AND c.regiao = @regiao'; params.regiao = regiao; }
    if (donoId)  { where += ' AND c.dono_id = @donoId'; params.donoId = parseInt(donoId); }

    const uid = req.utilizador?.id || null;
    params.uid = uid;
    const r = await query(
      `SELECT c.*, u.nome AS dono_nome,
              sca.status AS dono_stripe_status, sca.charges_enabled AS dono_charges_enabled,
              CASE WHEN @uid IS NULL THEN 0
                   WHEN EXISTS (SELECT 1 FROM campos_favoritos f
                                 WHERE f.campo_id = c.id AND f.utilizador_id = @uid)
                   THEN 1 ELSE 0 END AS is_favorito
       FROM campos c
       JOIN utilizadores u ON u.id = c.dono_id
       LEFT JOIN stripe_connect_accounts sca ON sca.utilizador_id = c.dono_id
       ${where}
       ORDER BY c.nome`,
      params
    );
    res.json({ sucesso: true, campos: r.recordset });
  } catch (err) {
    console.error('[Campos] listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/campos/:id
async function obterCampo(req, res) {
  try {
    const r = await query(
      `SELECT c.*, u.nome AS dono_nome
       FROM campos c JOIN utilizadores u ON u.id = c.dono_id
       WHERE c.id = @id`,
      { id: parseInt(req.params.id) }
    );
    if (!r.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Campo não encontrado.' });
    res.json({ sucesso: true, campo: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// Helpers para validar horários/lotações
function toJsonArray(v, fallback) {
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'string' && v.trim().startsWith('[')) return v;
  return JSON.stringify(fallback);
}
function clampMinutos(v, fallback) {
  const n = parseInt(v);
  if (Number.isNaN(n) || n < 0 || n > 1440) return fallback;
  return n;
}

// POST /api/campos
async function criarCampo(req, res) {
  try {
    const {
      nome, fotoUrl, tipoPiso, morada, regiao, precoHoraCents, duracaoMin,
      horaAbertura, horaFecho, diasSemana, slotMin, lotacoes,
    } = req.body;
    if (!nome || !precoHoraCents) {
      return res.status(400).json({ sucesso: false, mensagem: 'Nome e preço/hora são obrigatórios.' });
    }

    const r = await query(
      `INSERT INTO campos (dono_id, nome, foto_url, tipo_piso, morada, regiao,
                           preco_hora_cents, duracao_min,
                           hora_abertura, hora_fecho, dias_semana_json, slot_min, lotacoes_json)
       OUTPUT INSERTED.*
       VALUES (@dono, @nome, @foto, @tipo, @morada, @regiao, @preco, @dur,
               @ha, @hf, @ds, @slot, @lot)`,
      { dono: req.utilizador.id, nome, foto: fotoUrl || null,
        tipo: tipoPiso || null, morada: morada || null, regiao: regiao || null,
        preco: parseInt(precoHoraCents), dur: parseInt(duracaoMin || 60),
        ha:   clampMinutos(horaAbertura, 480),   // 08:00
        hf:   clampMinutos(horaFecho, 1380),     // 23:00
        ds:   toJsonArray(diasSemana, [1,2,3,4,5,6,7]),
        slot: clampMinutos(slotMin, 60),
        lot:  toJsonArray(lotacoes, [5,7]) }
    );
    res.status(201).json({ sucesso: true, campo: r.recordset[0] });
  } catch (err) {
    console.error('[Campos] criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/campos/:id
async function editarCampo(req, res) {
  try {
    const id = parseInt(req.params.id);
    const campoR = await query(`SELECT dono_id FROM campos WHERE id = @id`, { id });
    if (!campoR.recordset.length) return res.status(404).json({ sucesso: false });
    if (campoR.recordset[0].dono_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });

    const {
      nome, fotoUrl, tipoPiso, morada, regiao, precoHoraCents, duracaoMin, ativo,
      horaAbertura, horaFecho, diasSemana, slotMin, lotacoes, latitude, longitude,
    } = req.body;
    await query(
      `UPDATE campos SET
         nome = COALESCE(@nome, nome),
         foto_url = COALESCE(@foto, foto_url),
         tipo_piso = COALESCE(@tipo, tipo_piso),
         morada = COALESCE(@morada, morada),
         regiao = COALESCE(@regiao, regiao),
         latitude = CASE WHEN @lat IS NOT NULL THEN @lat ELSE latitude END,
         longitude = CASE WHEN @lng IS NOT NULL THEN @lng ELSE longitude END,
         preco_hora_cents = COALESCE(@preco, preco_hora_cents),
         duracao_min = COALESCE(@dur, duracao_min),
         ativo = COALESCE(@ativo, ativo),
         hora_abertura = COALESCE(@ha, hora_abertura),
         hora_fecho = COALESCE(@hf, hora_fecho),
         dias_semana_json = COALESCE(@ds, dias_semana_json),
         slot_min = COALESCE(@slot, slot_min),
         lotacoes_json = COALESCE(@lot, lotacoes_json),
         updated_at = GETUTCDATE()
       WHERE id = @id`,
      { id,
        nome: nome || null, foto: fotoUrl || null, tipo: tipoPiso || null,
        morada: morada || null, regiao: regiao || null,
        lat: latitude != null && latitude !== '' ? parseFloat(latitude) : null,
        lng: longitude != null && longitude !== '' ? parseFloat(longitude) : null,
        preco: precoHoraCents != null ? parseInt(precoHoraCents) : null,
        dur: duracaoMin != null ? parseInt(duracaoMin) : null,
        ativo: ativo == null ? null : (ativo ? 1 : 0),
        ha:   horaAbertura != null ? clampMinutos(horaAbertura, 480)  : null,
        hf:   horaFecho    != null ? clampMinutos(horaFecho, 1380)    : null,
        ds:   diasSemana   != null ? toJsonArray(diasSemana, [1,2,3,4,5,6,7]) : null,
        slot: slotMin      != null ? clampMinutos(slotMin, 60)        : null,
        lot:  lotacoes     != null ? toJsonArray(lotacoes, [5,7])     : null,
      }
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Campos] editar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// DELETE /api/campos/:id  (soft delete — ativo=0)
async function eliminarCampo(req, res) {
  try {
    const id = parseInt(req.params.id);
    const campoR = await query(`SELECT dono_id FROM campos WHERE id = @id`, { id });
    if (!campoR.recordset.length) return res.status(404).json({ sucesso: false });
    if (campoR.recordset[0].dono_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão.' });
    await query(`UPDATE campos SET ativo = 0, updated_at = GETUTCDATE() WHERE id = @id`, { id });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── BLOQUEIOS MANUAIS ──────────────────────────────────────

// GET /api/campos/:id/bloqueios
async function listarBloqueios(req, res) {
  try {
    const id = parseInt(req.params.id);
    const r = await query(
      `SELECT * FROM campo_bloqueios WHERE campo_id = @id AND fim >= GETUTCDATE() ORDER BY inicio`,
      { id }
    );
    res.json({ sucesso: true, bloqueios: r.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/campos/:id/bloqueios
async function criarBloqueio(req, res) {
  try {
    const id = parseInt(req.params.id);
    const campoR = await query(`SELECT dono_id FROM campos WHERE id = @id`, { id });
    if (!campoR.recordset.length) return res.status(404).json({ sucesso: false });
    if (campoR.recordset[0].dono_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false });

    const { inicio, fim, motivo } = req.body;
    if (!inicio || !fim) return res.status(400).json({ sucesso: false, mensagem: 'Datas obrigatórias.' });
    const r = await query(
      `INSERT INTO campo_bloqueios (campo_id, inicio, fim, motivo)
       OUTPUT INSERTED.* VALUES (@id, @inicio, @fim, @motivo)`,
      { id, inicio, fim, motivo: motivo || null }
    );
    res.status(201).json({ sucesso: true, bloqueio: r.recordset[0] });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// DELETE /api/campos/:campoId/bloqueios/:id
async function eliminarBloqueio(req, res) {
  try {
    const campoId = parseInt(req.params.campoId);
    const bloqId = parseInt(req.params.id);
    const campoR = await query(`SELECT dono_id FROM campos WHERE id = @id`, { id: campoId });
    if (!campoR.recordset.length || campoR.recordset[0].dono_id !== req.utilizador.id)
      return res.status(403).json({ sucesso: false });
    await query(`DELETE FROM campo_bloqueios WHERE id = @id AND campo_id = @cid`,
                { id: bloqId, cid: campoId });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── DISPONIBILIDADE (slots livres/reservados num dia) ──────
// GET /api/campos/:id/disponibilidade?data=YYYY-MM-DD
async function getDisponibilidade(req, res) {
  try {
    const id = parseInt(req.params.id);
    const dataStr = (req.query.data || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Parâmetro data=YYYY-MM-DD obrigatório.' });
    }
    const campoR = await query(
      `SELECT id, hora_abertura, hora_fecho, slot_min, dias_semana_json, duracao_min
       FROM campos WHERE id = @id AND ativo = 1`,
      { id }
    );
    if (!campoR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Campo não encontrado.' });
    const c = campoR.recordset[0];

    // Validar dia da semana (1=segunda..7=domingo)
    const d = new Date(dataStr + 'T00:00:00Z');
    const jsDow = d.getUTCDay(); // 0=dom..6=sáb
    const iso = jsDow === 0 ? 7 : jsDow;
    let diasPermitidos = [1,2,3,4,5,6,7];
    try { diasPermitidos = JSON.parse(c.dias_semana_json || '[1,2,3,4,5,6,7]'); } catch (_) {}
    if (!diasPermitidos.includes(iso)) {
      return res.json({ sucesso: true, slots: [], fechado: true, mensagem: 'Campo fechado neste dia.' });
    }

    const slotMin = Math.max(15, c.slot_min || 60);
    const duracao = Math.max(slotMin, c.duracao_min || 60);

    // Jogos existentes (não cancelados/expirados) nesse dia
    const jogosR = await query(
      `SELECT id, data_jogo FROM jogos
       WHERE campo_id = @id
         AND CAST(data_jogo AS DATE) = @d
         AND (reserva_estado IS NULL OR reserva_estado NOT IN ('cancelada','expirada'))
         AND estado <> 'cancelado'`,
      { id, d: dataStr }
    );
    // Bloqueios que intersectam o dia
    const bloqR = await query(
      `SELECT inicio, fim, motivo FROM campo_bloqueios
       WHERE campo_id = @id
         AND CAST(inicio AS DATE) <= @d AND CAST(fim AS DATE) >= @d`,
      { id, d: dataStr }
    );

    // Helper: minutes-since-midnight do dia alvo para um Date
    const baseMs = Date.parse(dataStr + 'T00:00:00Z');
    const toMin = (date) => {
      const t = new Date(date).getTime();
      return Math.round((t - baseMs) / 60000);
    };

    const ocupados = [];
    for (const j of jogosR.recordset) {
      const ini = toMin(j.data_jogo);
      const fim = ini + duracao;
      ocupados.push({ ini, fim, tipo: 'reservado', jogoId: j.id });
    }
    for (const b of bloqR.recordset) {
      ocupados.push({
        ini: Math.max(0, toMin(b.inicio)),
        fim: Math.min(1440, toMin(b.fim)),
        tipo: 'bloqueado', motivo: b.motivo || null,
      });
    }

    const slots = [];
    for (let t = c.hora_abertura; t + duracao <= c.hora_fecho; t += slotMin) {
      const slotFim = t + duracao;
      const hit = ocupados.find((o) => o.ini < slotFim && o.fim > t);
      slots.push({
        inicio: t, fim: slotFim,
        inicioHHMM: `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`,
        fimHHMM:    `${String(Math.floor(slotFim/60)).padStart(2,'0')}:${String(slotFim%60).padStart(2,'0')}`,
        estado: hit ? hit.tipo : 'livre',
        motivo: hit?.motivo || null,
      });
    }

    res.json({ sucesso: true, data: dataStr, slots, config: {
      hora_abertura: c.hora_abertura, hora_fecho: c.hora_fecho,
      slot_min: slotMin, duracao_min: duracao,
    }});
  } catch (err) {
    console.error('[Campos] disponibilidade:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── AGENDA DO DONO ──────────────────────────────────────────

// GET /api/dono/agenda
// Lista os jogos marcados + bloqueios nos campos do dono
async function agendaDono(req, res) {
  try {
    const uid = req.utilizador.id;
    const jogosR = await query(
      `SELECT j.id, j.titulo, j.data_jogo, j.max_jogadores, j.reserva_estado,
              j.preco_total_cents, j.campo_id, c.nome AS campo_nome,
              j.modelo_pagamento, j.deadline_pagamento,
              ISNULL((SELECT SUM(valor_cents) FROM pagamentos
                      WHERE jogo_id = j.id AND status = 'succeeded'), 0) AS pago_cents
       FROM jogos j
       JOIN campos c ON c.id = j.campo_id
       WHERE c.dono_id = @uid AND j.estado NOT IN ('cancelado')
       ORDER BY j.data_jogo`,
      { uid }
    );
    const bloqR = await query(
      `SELECT cb.*, c.nome AS campo_nome FROM campo_bloqueios cb
       JOIN campos c ON c.id = cb.campo_id
       WHERE c.dono_id = @uid AND cb.fim >= GETUTCDATE()
       ORDER BY cb.inicio`,
      { uid }
    );
    res.json({ sucesso: true, jogos: jogosR.recordset, bloqueios: bloqR.recordset });
  } catch (err) {
    console.error('[Campos] agenda:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// GET /api/dono/wallet
// Painel financeiro — saldo e histórico
async function wallet(req, res) {
  try {
    const uid = req.utilizador.id;

    const historico = await query(
      `SELECT p.id, p.valor_cents, p.application_fee_cents, p.status, p.created_at,
              j.id AS jogo_id, j.titulo, j.data_jogo, j.reserva_estado,
              c.nome AS campo_nome,
              u.nome AS pagador_nome
       FROM pagamentos p
       JOIN jogos j     ON j.id = p.jogo_id
       JOIN campos c    ON c.id = j.campo_id
       JOIN utilizadores u ON u.id = p.utilizador_id
       WHERE c.dono_id = @uid
       ORDER BY p.created_at DESC`,
      { uid }
    );

    const totais = await query(
      `SELECT
         ISNULL(SUM(CASE WHEN p.status='succeeded' AND j.reserva_estado='confirmada'
                         THEN p.valor_cents - p.application_fee_cents ELSE 0 END), 0) AS liquido_total_cents,
         ISNULL(SUM(CASE WHEN p.status='succeeded' AND j.reserva_estado='pendente'
                         THEN p.valor_cents - p.application_fee_cents ELSE 0 END), 0) AS pendente_total_cents,
         COUNT(DISTINCT CASE WHEN j.reserva_estado='confirmada' THEN j.id END) AS jogos_confirmados,
         COUNT(DISTINCT CASE WHEN j.reserva_estado='pendente'   THEN j.id END) AS jogos_pendentes
       FROM pagamentos p
       JOIN jogos j  ON j.id = p.jogo_id
       JOIN campos c ON c.id = j.campo_id
       WHERE c.dono_id = @uid`,
      { uid }
    );

    res.json({
      sucesso: true,
      saldo: totais.recordset[0],
      historico: historico.recordset,
    });
  } catch (err) {
    console.error('[Campos] wallet:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── ADMIN ──────────────────────────────────────────────────

// DELETE /api/admin/campos/:id  (hard delete se possível; senão soft-delete)
async function adminEliminarCampo(req, res) {
  try {
    if (req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Apenas admins.' });
    const id = parseInt(req.params.id);
    const campoR = await query(`SELECT dono_id, nome FROM campos WHERE id=@id`, { id });
    if (!campoR.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Campo não encontrado.' });
    const campo = campoR.recordset[0];

    // ── Limpar referências conhecidas. Cada query é tolerada (tabela pode não existir
    //    em todas as instâncias) mas registamos qualquer erro inesperado.
    const tentativa = async (sql) => {
      try { await query(sql, { id }); }
      catch (e) {
        // Ignorar "Invalid object name" (tabela não existe nesta BD).
        if (!/Invalid object name/i.test(e.message || '')) {
          console.warn('[Admin] eliminarCampo cleanup:', e.message);
        }
      }
    };
    await tentativa(`DELETE FROM campo_bloqueios       WHERE campo_id=@id`);
    await tentativa(`DELETE FROM campos_favoritos      WHERE campo_id=@id`);
    await tentativa(`DELETE FROM avaliacoes_campo      WHERE campo_id=@id`);
    // Tabela real chama-se "campo_candidaturas" (estava errado em versão anterior).
    // Removemos o vínculo (campo_id NULL) e marcamos como rejeitada para sair das listagens.
    await tentativa(
      `UPDATE campo_candidaturas
          SET campo_id = NULL,
              estado = 'rejeitada',
              nota_admin = ISNULL(nota_admin, '') + ' [Campo eliminado pela administração]'
        WHERE campo_id = @id`
    );
    await tentativa(`UPDATE jogos SET campo_id=NULL    WHERE campo_id=@id`);

    // Tentar HARD delete
    let hardOk = false;
    let ultimoErro = null;
    try {
      await query(`DELETE FROM campos WHERE id=@id`, { id });
      const ainda = await query(`SELECT 1 AS x FROM campos WHERE id=@id`, { id });
      hardOk = ainda.recordset.length === 0;
    } catch (e) {
      ultimoErro = e;
      console.warn('[Admin] eliminarCampo hard delete falhou:', e.message);
    }

    // Fallback: SOFT delete (marcar inativo + estado removido)
    if (!hardOk) {
      try {
        await query(
          `UPDATE campos
              SET ativo = 0,
                  estado = CASE WHEN COL_LENGTH('dbo.campos','estado') IS NULL
                                THEN estado ELSE 'removido' END,
                  updated_at = GETUTCDATE()
            WHERE id = @id`,
          { id }
        );
      } catch (e) {
        console.error('[Admin] eliminarCampo soft delete falhou:', e);
        return res.status(500).json({
          sucesso: false,
          mensagem: 'Não foi possível remover o campo. ' + (ultimoErro?.message || e.message),
        });
      }
    }

    // Notificar o dono (best-effort)
    try {
      await criarNotificacao({
        utilizadorId: campo.dono_id,
        tipo: 'sistema',
        titulo: 'Campo removido',
        mensagem: `O campo "${campo.nome}" foi removido pela administração.`,
        acaoUrl: '/dono-campo',
      });
    } catch {}

    res.json({
      sucesso: true,
      hardDelete: hardOk,
      mensagem: hardOk
        ? 'Campo eliminado definitivamente.'
        : 'Campo desativado (tinha registos associados, ficou marcado como removido).',
    });
  } catch (err) {
    console.error('[Admin] eliminarCampo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao eliminar campo: ' + err.message });
  }
}

// POST /api/admin/campos/:id/pedir-info  { mensagem }
async function adminPedirInfoCampo(req, res) {
  try {
    if (req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Apenas admins.' });
    const id = parseInt(req.params.id);
    const { mensagem } = req.body || {};
    if (!mensagem || !mensagem.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'Mensagem obrigatória.' });

    const campoR = await query(`SELECT dono_id, nome FROM campos WHERE id=@id`, { id });
    if (!campoR.recordset.length)
      return res.status(404).json({ sucesso: false, mensagem: 'Campo não encontrado.' });
    const campo = campoR.recordset[0];

    await criarNotificacao({
      utilizadorId: campo.dono_id,
      tipo: 'sistema',
      titulo: `Admin pediu mais informações sobre "${campo.nome}"`,
      mensagem: mensagem.trim(),
      acaoUrl: '/dono-campo',
    });

    res.json({ sucesso: true });
  } catch (err) {
    console.error('[Admin] pedirInfoCampo:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ─────────────────────────────────────────────────────────
// Favoritos
// POST /api/campos/:id/favorito   → adiciona (idempotente)
// DELETE /api/campos/:id/favorito → remove
// GET /api/meus/campos-favoritos  → lista
// ─────────────────────────────────────────────────────────
async function favoritar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const uid = req.utilizador.id;
    await query(
      `IF NOT EXISTS (SELECT 1 FROM campos_favoritos WHERE utilizador_id=@u AND campo_id=@c)
         INSERT INTO campos_favoritos (utilizador_id, campo_id) VALUES (@u, @c)`,
      { u: uid, c: id }
    );
    res.json({ sucesso: true, favorito: true });
  } catch (err) {
    console.error('[Campos] favoritar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

async function desfavoritar(req, res) {
  try {
    const id = parseInt(req.params.id);
    const uid = req.utilizador.id;
    await query(
      `DELETE FROM campos_favoritos WHERE utilizador_id=@u AND campo_id=@c`,
      { u: uid, c: id }
    );
    res.json({ sucesso: true, favorito: false });
  } catch (err) {
    console.error('[Campos] desfavoritar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

async function listarFavoritos(req, res) {
  try {
    const uid = req.utilizador.id;
    const r = await query(
      `SELECT c.*, u.nome AS dono_nome
         FROM campos_favoritos f
         JOIN campos c ON c.id = f.campo_id
         JOIN utilizadores u ON u.id = c.dono_id
        WHERE f.utilizador_id = @uid AND c.ativo = 1
        ORDER BY f.created_at DESC`,
      { uid }
    );
    res.json({ sucesso: true, campos: r.recordset });
  } catch (err) {
    console.error('[Campos] favoritos:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = {
  listarCampos, obterCampo, criarCampo, editarCampo, eliminarCampo,
  listarBloqueios, criarBloqueio, eliminarBloqueio,
  getDisponibilidade,
  agendaDono, wallet,
  adminEliminarCampo, adminPedirInfoCampo,
  favoritar, desfavoritar, listarFavoritos,
};
