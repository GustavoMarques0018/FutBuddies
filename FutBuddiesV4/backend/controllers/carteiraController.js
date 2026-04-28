// ============================================================
//  FutBuddies - Carteira (saldo interno em cêntimos)
//  - Saldo calculado em tempo-real a partir de carteira_movimentos
//  - Tipos: 'credito_manual' | 'credito_reembolso' | 'debito_pagamento' | 'credito_promo'
//  - Idempotência via (utilizador_id, referencia) quando aplicável
// ============================================================

const { query } = require('../config/database');

async function saldoDe(uid) {
  const r = await query(
    `SELECT ISNULL(SUM(valor_cents), 0) AS saldo FROM carteira_movimentos WHERE utilizador_id=@uid`,
    { uid }
  );
  return r.recordset[0].saldo || 0;
}

// GET /api/carteira
async function obter(req, res) {
  try {
    const uid = req.utilizador.id;
    const saldo = await saldoDe(uid);
    const movs = await query(
      `SELECT TOP 50 id, tipo, valor_cents, descricao, referencia, jogo_id, created_at
         FROM carteira_movimentos
        WHERE utilizador_id=@uid
        ORDER BY id DESC`,
      { uid }
    );
    res.json({ sucesso: true, saldo_cents: saldo, movimentos: movs.recordset });
  } catch (err) {
    console.error('[Carteira] obter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// POST /api/carteira/usar  { jogoId }
// Gera um "voucher" interno — cria um crédito reservado para uso no próximo pagamento.
// Para simplificar nesta fase, apenas confirma que há saldo e devolve-o;
// o débito real é criado quando o pagamento é processado via syncPagamento.
async function simularUso(req, res) {
  try {
    const uid = req.utilizador.id;
    const saldo = await saldoDe(uid);
    res.json({ sucesso: true, saldo_cents: saldo });
  } catch (err) {
    console.error('[Carteira] simularUso:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// ── Helpers internos (usados por outros controllers) ─────────
async function creditar({ utilizadorId, valorCents, descricao, referencia = null, jogoId = null, tipo = 'credito_manual' }) {
  if (!utilizadorId || !valorCents || valorCents <= 0) throw new Error('Parâmetros inválidos para creditar.');
  if (referencia) {
    const dup = await query(
      `SELECT 1 FROM carteira_movimentos WHERE utilizador_id=@uid AND referencia=@ref`,
      { uid: utilizadorId, ref: referencia }
    );
    if (dup.recordset.length) return { duplicado: true };
  }
  await query(
    `INSERT INTO carteira_movimentos (utilizador_id, tipo, valor_cents, descricao, referencia, jogo_id, created_at)
     VALUES (@uid, @tipo, @val, @desc, @ref, @jid, GETUTCDATE())`,
    { uid: utilizadorId, tipo, val: Math.abs(parseInt(valorCents)), desc: descricao || null, ref: referencia, jid: jogoId }
  );
  return { duplicado: false };
}

async function debitar({ utilizadorId, valorCents, descricao, referencia = null, jogoId = null, tipo = 'debito_pagamento' }) {
  if (!utilizadorId || !valorCents || valorCents <= 0) throw new Error('Parâmetros inválidos para debitar.');
  const saldo = await saldoDe(utilizadorId);
  if (saldo < valorCents) throw new Error('Saldo insuficiente.');
  await query(
    `INSERT INTO carteira_movimentos (utilizador_id, tipo, valor_cents, descricao, referencia, jogo_id, created_at)
     VALUES (@uid, @tipo, @val, @desc, @ref, @jid, GETUTCDATE())`,
    { uid: utilizadorId, tipo, val: -Math.abs(parseInt(valorCents)), desc: descricao || null, ref: referencia, jid: jogoId }
  );
  return { saldoAntes: saldo, saldoDepois: saldo - valorCents };
}

// POST /api/admin/carteira/:userId/creditar  { valorCents, descricao }
async function adminCreditar(req, res) {
  try {
    if (req.utilizador.role !== 'admin')
      return res.status(403).json({ sucesso: false, mensagem: 'Apenas admins.' });
    const uid = parseInt(req.params.userId);
    const { valorCents, descricao } = req.body || {};
    if (!valorCents || valorCents <= 0)
      return res.status(400).json({ sucesso: false, mensagem: 'Valor inválido.' });
    await creditar({ utilizadorId: uid, valorCents, descricao: descricao || 'Crédito manual (admin)', tipo: 'credito_manual' });
    const saldo = await saldoDe(uid);
    res.json({ sucesso: true, saldo_cents: saldo });
  } catch (err) {
    console.error('[Carteira] adminCreditar:', err);
    res.status(500).json({ sucesso: false, mensagem: err.message });
  }
}

module.exports = { obter, simularUso, creditar, debitar, saldoDe, adminCreditar };
