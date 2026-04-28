// ============================================================
//  FutBuddies - Controlador de Jogos (v2 — público/privado)
// ============================================================

const { query } = require('../config/database');
const { criarNotificacao } = require('./notificacoesController');

// GET /api/jogos
async function listarJogos(req, res) {
  try {
    // Auto-close expired games (60 min past start)
    await query(
      `UPDATE jogos SET estado='concluido', updated_at=GETUTCDATE()
       WHERE estado IN ('aberto', 'cheio') AND data_jogo IS NOT NULL
       AND DATEADD(MINUTE, 60, data_jogo) < GETUTCDATE()`
    );

    const { estado, tipo, pesquisa, visibilidade, regiao, nivel, futuro, meusJogos, pagina = 1, limite = 50 } = req.query;
    const utilizadorId = req.utilizador?.id || null;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);
    let where = 'WHERE 1=1';
    const params = { limite: parseInt(limite), offset };

    // Excluir jogos antigos (passados 1h apos inicio) e encerrados/cancelados/concluidos por defeito
    if (!estado && !meusJogos) {
      where += ` AND j.estado NOT IN ('cancelado','concluido')`;
      where += ' AND (j.data_jogo IS NULL OR DATEADD(MINUTE, 60, j.data_jogo) >= GETUTCDATE())';
    }

    if (estado)      { where += ' AND j.estado=@estado'; params.estado = estado; }
    if (tipo)        { where += ' AND j.tipo_jogo=@tipo'; params.tipo = tipo; }
    if (visibilidade){ where += ' AND j.visibilidade=@visibilidade'; params.visibilidade = visibilidade; }
    if (regiao)      { where += ' AND j.regiao=@regiao'; params.regiao = regiao; }
    if (nivel)       { where += ' AND j.nivel=@nivel'; params.nivel = nivel; }
    if (pesquisa)    { where += ' AND (j.titulo LIKE @pesquisa OR j.regiao LIKE @pesquisa)'; params.pesquisa = `%${pesquisa}%`; }
    if (futuro === 'true') { where += ' AND j.data_jogo > GETUTCDATE()'; }

    // Filtro "Os Meus Jogos" (apenas se autenticado)
    if (meusJogos && utilizadorId) {
      where += ` AND (
        j.criador_id = @userId
        OR EXISTS (SELECT 1 FROM inscricoes ii WHERE ii.jogo_id = j.id AND ii.utilizador_id = @userId AND ii.estado = 'confirmado')
        OR EXISTS (
          SELECT 1 FROM inscricoes_equipa ie3
          JOIN equipa_membros em ON em.equipa_id = ie3.equipa_id
          WHERE ie3.jogo_id = j.id AND em.utilizador_id = @userId AND ie3.estado = 'confirmado'
        )
      )`;
      params.userId = utilizadorId;
    }

    const resultado = await query(
      `SELECT j.id, j.titulo, j.descricao, j.data_jogo, j.regiao, j.tipo_jogo, j.nivel,
              j.max_jogadores, j.estado, j.visibilidade, j.modo_jogo, j.created_at,
              -- Local só exposto em jogos públicos
              CASE WHEN j.visibilidade='publico' THEN j.local ELSE NULL END AS local,
              u.nome AS criador_nome,
              CASE WHEN j.modo_jogo = 'equipa'
                THEN ISNULL((SELECT COUNT(*) FROM inscricoes_equipa ie2 WHERE ie2.jogo_id = j.id AND ie2.estado = 'confirmado'), 0) * (j.max_jogadores / 2)
                ELSE COUNT(CASE WHEN i.estado='confirmado' THEN 1 END)
              END AS total_inscritos,
              j.max_jogadores - CASE WHEN j.modo_jogo = 'equipa'
                THEN ISNULL((SELECT COUNT(*) FROM inscricoes_equipa ie2 WHERE ie2.jogo_id = j.id AND ie2.estado = 'confirmado'), 0) * (j.max_jogadores / 2)
                ELSE COUNT(CASE WHEN i.estado='confirmado' THEN 1 END)
              END AS vagas_disponiveis
       FROM jogos j
       LEFT JOIN utilizadores u ON j.criador_id=u.id
       LEFT JOIN inscricoes i ON j.id=i.jogo_id
       ${where}
       GROUP BY j.id, j.titulo, j.descricao, j.data_jogo, j.local, j.regiao, j.tipo_jogo, j.nivel,
                j.max_jogadores, j.estado, j.visibilidade, j.modo_jogo, j.created_at, u.nome
       ORDER BY j.data_jogo ASC
       OFFSET @offset ROWS FETCH NEXT @limite ROWS ONLY`, params
    );

    const total = await query(`SELECT COUNT(*) AS total FROM jogos j ${where}`, params);
    res.json({ sucesso: true, jogos: resultado.recordset, total: total.recordset[0].total,
      pagina: parseInt(pagina), totalPaginas: Math.ceil(total.recordset[0].total / parseInt(limite)) });
  } catch (err) {
    console.error('[Jogos] Listar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogos/:id
async function obterJogo(req, res) {
  try {
    const { id } = req.params;
    const utilizadorId = req.utilizador?.id || null;

    const resultado = await query(
      `SELECT j.id, j.titulo, j.descricao, j.data_jogo, j.local, j.regiao, j.tipo_jogo, j.nivel,
              j.max_jogadores, j.estado, j.visibilidade, j.codigo_acesso, j.modo_jogo, j.criador_id, j.created_at,
              j.tipo_local, j.campo_id, j.modelo_pagamento, j.preco_total_cents,
              j.preco_por_jogador_cents, j.reserva_estado, j.deadline_pagamento,
              u.nome AS criador_nome,
              c.nome AS campo_nome, c.foto_url AS campo_foto, c.tipo_piso AS campo_piso,
              c.dono_id AS campo_dono_id,
              ISNULL((SELECT SUM(valor_cents) FROM pagamentos
                      WHERE jogo_id = j.id AND status='succeeded'), 0) AS pago_cents
       FROM jogos j
       LEFT JOIN utilizadores u ON j.criador_id=u.id
       LEFT JOIN campos c ON c.id = j.campo_id
       WHERE j.id=@id`, { id: parseInt(id) }
    );
    if (resultado.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jogo = resultado.recordset[0];

    // Jogo privado: ocultar local se não for inscrito/criador, e ocultar código a quem não é criador
    if (jogo.visibilidade === 'privado') {
      const isInscrito = utilizadorId ? await query(
        `SELECT id FROM inscricoes WHERE jogo_id=@id AND utilizador_id=@uid AND estado='confirmado'`,
        { id: parseInt(id), uid: utilizadorId }
      ) : { recordset: [] };
      const isCriador = utilizadorId === jogo.criador_id;
      if (!isCriador && isInscrito.recordset.length === 0) {
        jogo.local = null; // ocultar morada
      }
      if (!isCriador) {
        jogo.codigo_acesso = null; // só o criador vê o código
      }
    } else {
      jogo.codigo_acesso = null; // jogos públicos não têm código
    }

    const inscritos = await query(
      `SELECT i.id, i.equipa, i.estado, i.created_at,
              u.id AS utilizador_id, u.nome, u.nickname, u.posicao, u.foto_url
       FROM inscricoes i JOIN utilizadores u ON i.utilizador_id=u.id
       WHERE i.jogo_id=@id AND i.estado='confirmado' ORDER BY i.created_at ASC`, { id: parseInt(id) }
    );

    jogo.inscritos = inscritos.recordset;

    // Meu check-in?
    if (utilizadorId) {
      try {
        const ci = await query(
          `SELECT checkin_at FROM inscricoes
            WHERE jogo_id=@id AND utilizador_id=@uid AND estado='confirmado'`,
          { id: parseInt(id), uid: utilizadorId }
        );
        jogo.meu_checkin = !!(ci.recordset[0]?.checkin_at);
      } catch { jogo.meu_checkin = false; }
    }

    // Lista de espera (visível a todos os inscritos/criador)
    try {
      const espera = await query(
        `SELECT i.id, i.created_at,
                u.id AS utilizador_id, u.nome, u.nickname, u.foto_url
           FROM inscricoes i JOIN utilizadores u ON i.utilizador_id=u.id
          WHERE i.jogo_id=@id AND i.estado='espera'
          ORDER BY i.created_at ASC`, { id: parseInt(id) }
      );
      jogo.lista_espera = espera.recordset;
      if (utilizadorId) {
        const idxMe = espera.recordset.findIndex(e => e.utilizador_id === utilizadorId);
        jogo.minha_posicao_espera = idxMe === -1 ? null : idxMe + 1;
      }
    } catch { jogo.lista_espera = []; }
    const maxPorEquipa = Math.floor(jogo.max_jogadores / 2);
    jogo.vagas_equipa_a = maxPorEquipa - inscritos.recordset.filter(i => i.equipa === 'A').length;
    jogo.vagas_equipa_b = maxPorEquipa - inscritos.recordset.filter(i => i.equipa === 'B').length;

    // Equipas inscritas (jogos de equipa)
    if (jogo.modo_jogo === 'equipa') {
      const equipasInscritas = await query(
        `SELECT ie.id, ie.lado, ie.estado, ie.created_at,
                e.id AS equipa_id, e.nome, e.emblema, e.nivel,
                (SELECT COUNT(*) FROM equipa_membros WHERE equipa_id = e.id) AS total_membros
         FROM inscricoes_equipa ie
         JOIN equipas e ON ie.equipa_id = e.id
         WHERE ie.jogo_id = @id ORDER BY ie.lado ASC`, { id: parseInt(id) }
      );
      jogo.equipas_inscritas = equipasInscritas.recordset;
      // For team games, each inscribed team fills half the slots
      const numEquipas = equipasInscritas.recordset.length;
      jogo.total_inscritos = numEquipas * maxPorEquipa;
      jogo.vagas_disponiveis = jogo.max_jogadores - jogo.total_inscritos;
    } else {
      jogo.total_inscritos = inscritos.recordset.length;
      jogo.vagas_disponiveis = jogo.max_jogadores - inscritos.recordset.length;
    }

    res.json({ sucesso: true, jogo });
  } catch (err) {
    console.error('[Jogos] Obter:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos
async function criarJogo(req, res) {
  try {
    let { titulo, descricao, dataJogo, local, regiao, tipoJogo='5x5', maxJogadores=10,
            visibilidade='publico', nivel='Descontraído', modoJogo='individual',
            tipoLocal='publico', campoId=null,
            modeloPagamento=null, precoTotalCents=null,
            formatoLotacao=null,
            recorrencia=null, recorrenciaOcorrencias=0 } = req.body;

    if (!titulo || !dataJogo)
      return res.status(400).json({ sucesso: false, mensagem: 'Título e data são obrigatórios.' });

    // Validar campo parceiro
    let campoInfo = null, precoPorJogador = null, reservaEstado = null, deadline = null;
    if (tipoLocal === 'parceiro') {
      if (!campoId) return res.status(400).json({ sucesso: false, mensagem: 'Campo obrigatório para local parceiro.' });
      const cR = await query(
        `SELECT c.id, c.nome, c.dono_id, c.preco_hora_cents, c.morada, c.regiao,
                c.lotacoes_json, c.hora_abertura, c.hora_fecho, c.dias_semana_json,
                sca.charges_enabled
         FROM campos c
         LEFT JOIN stripe_connect_accounts sca ON sca.utilizador_id = c.dono_id
         WHERE c.id = @id AND c.ativo = 1`, { id: parseInt(campoId) }
      );
      if (!cR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Campo não encontrado.' });
      campoInfo = cR.recordset[0];
      if (!campoInfo.charges_enabled)
        return res.status(400).json({ sucesso: false, mensagem: 'Dono do campo ainda sem pagamentos ativos.' });

      // Validar lotação escolhida contra o que o dono permite
      let lotacoesPermitidas = [5, 7];
      try { lotacoesPermitidas = JSON.parse(campoInfo.lotacoes_json || '[5,7]'); } catch (_) {}
      const lot = parseInt(formatoLotacao);
      if (!lot || !lotacoesPermitidas.includes(lot))
        return res.status(400).json({
          sucesso: false,
          mensagem: `Formato inválido. Este campo só permite: ${lotacoesPermitidas.map(l => `${l}x${l}`).join(', ')}.`,
        });
      // Forçar max_jogadores = lotação * 2 e tipoJogo coerente
      maxJogadores = lot * 2;
      tipoJogo = `${lot}x${lot}`;

      // Confirmar que o slot está livre (mesma validação do /disponibilidade)
      const inicio = new Date(dataJogo);
      const colisao = await query(
        `SELECT TOP 1 id FROM jogos
         WHERE campo_id = @cid
           AND (reserva_estado IS NULL OR reserva_estado NOT IN ('cancelada','expirada'))
           AND estado <> 'cancelado'
           AND data_jogo = @dt`,
        { cid: parseInt(campoId), dt: inicio }
      );
      if (colisao.recordset.length)
        return res.status(409).json({ sucesso: false, mensagem: 'Esse horário já foi reservado. Escolhe outro slot.' });

      if (!['total', 'dividido'].includes(modeloPagamento))
        return res.status(400).json({ sucesso: false, mensagem: 'Modelo de pagamento inválido.' });

      const total = parseInt(precoTotalCents || campoInfo.preco_hora_cents);
      if (!total || total < 100) return res.status(400).json({ sucesso: false, mensagem: 'Preço total inválido.' });

      reservaEstado = 'pendente';
      // Deadline: 30 min antes do início do jogo
      deadline = new Date(new Date(dataJogo).getTime() - 30 * 60 * 1000);
      if (modeloPagamento === 'dividido') {
        precoPorJogador = Math.ceil(total / parseInt(maxJogadores));
      }
    }

    // Gerar código de acesso para jogos privados
    let codigoAcesso = null;
    if (visibilidade === 'privado') {
      codigoAcesso = Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const localFinal = tipoLocal === 'parceiro' ? (campoInfo.morada || campoInfo.nome) : (local || null);
    const regiaoFinal = tipoLocal === 'parceiro' && !regiao ? campoInfo.regiao : (regiao || null);

    const resultado = await query(
      `INSERT INTO jogos (titulo, descricao, data_jogo, local, regiao, tipo_jogo, max_jogadores, estado,
                          visibilidade, nivel, codigo_acesso, modo_jogo, criador_id,
                          tipo_local, campo_id, modelo_pagamento, preco_total_cents,
                          preco_por_jogador_cents, reserva_estado, deadline_pagamento,
                          formato_lotacao,
                          created_at, updated_at)
       OUTPUT INSERTED.id
       VALUES (@titulo, @descricao, @dataJogo, @local, @regiao, @tipoJogo, @maxJogadores, 'aberto',
               @visibilidade, @nivel, @codigoAcesso, @modoJogo, @criadorId,
               @tipoLocal, @campoId, @modeloPag, @precoTot, @precoJog, @resEstado, @deadline,
               @formatoLot,
               GETUTCDATE(), GETUTCDATE())`,
      { titulo, descricao: descricao||null, dataJogo: new Date(dataJogo), local: localFinal,
        regiao: regiaoFinal, tipoJogo, maxJogadores: parseInt(maxJogadores),
        visibilidade, nivel, codigoAcesso, modoJogo, criadorId: req.utilizador.id,
        tipoLocal, campoId: tipoLocal === 'parceiro' ? parseInt(campoId) : null,
        modeloPag: tipoLocal === 'parceiro' ? modeloPagamento : null,
        precoTot: tipoLocal === 'parceiro' ? parseInt(precoTotalCents || campoInfo.preco_hora_cents) : null,
        precoJog: precoPorJogador,
        resEstado: reservaEstado, deadline,
        formatoLot: tipoLocal === 'parceiro' ? parseInt(formatoLotacao) : null }
    );

    const jogoId = resultado.recordset[0].id;

    // Jogos individuais: inscrever criador automaticamente
    if (modoJogo !== 'equipa') {
      await query(
        `INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado, created_at)
         VALUES (@jogoId, @utilizadorId, 'A', 'confirmado', GETUTCDATE())`,
        { jogoId, utilizadorId: req.utilizador.id }
      );
    } else {
      // Jogos de equipa: inscrever automaticamente a equipa do criador (se for capitao)
      const equipaCriador = await query(
        `SELECT e.id FROM equipas e WHERE e.capitao_id = @uid`,
        { uid: req.utilizador.id }
      );
      if (equipaCriador.recordset.length > 0) {
        const eqId = equipaCriador.recordset[0].id;
        await query(
          `INSERT INTO inscricoes_equipa (jogo_id, equipa_id, lado, estado, created_at)
           VALUES (@jogoId, @eqId, 'A', 'confirmado', GETUTCDATE())`,
          { jogoId, eqId }
        );
      }
    }

    // ── Recorrência (apenas para jogos NÃO-parceiro) ─────────
    // Cria até 8 ocorrências futuras com jogo_pai_id = jogoId
    let recorrenciaCriados = 0;
    try {
      const intervaloDias = recorrencia === 'semanal' ? 7
                          : recorrencia === 'quinzenal' ? 14
                          : recorrencia === 'mensal' ? 30 : 0;
      const n = Math.max(0, Math.min(8, parseInt(recorrenciaOcorrencias) || 0));
      if (intervaloDias > 0 && n > 0 && tipoLocal !== 'parceiro') {
        const baseDate = new Date(dataJogo);
        for (let i = 1; i <= n; i++) {
          const nd = new Date(baseDate.getTime() + i * intervaloDias * 24 * 60 * 60 * 1000);
          const novoCodigo = visibilidade === 'privado'
            ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
          const r2 = await query(
            `INSERT INTO jogos (titulo, descricao, data_jogo, local, regiao, tipo_jogo, max_jogadores, estado,
                                visibilidade, nivel, codigo_acesso, modo_jogo, criador_id,
                                tipo_local, campo_id, jogo_pai_id,
                                created_at, updated_at)
             OUTPUT INSERTED.id
             VALUES (@titulo, @descricao, @dt, @local, @regiao, @tipoJogo, @maxJogadores, 'aberto',
                     @visibilidade, @nivel, @codigo, @modoJogo, @criadorId,
                     @tipoLocal, NULL, @pai,
                     GETUTCDATE(), GETUTCDATE())`,
            { titulo, descricao: descricao||null, dt: nd, local: localFinal,
              regiao: regiaoFinal, tipoJogo, maxJogadores: parseInt(maxJogadores),
              visibilidade, nivel, codigo: novoCodigo, modoJogo,
              criadorId: req.utilizador.id, tipoLocal, pai: jogoId }
          );
          const novoId = r2.recordset[0].id;
          if (modoJogo !== 'equipa') {
            await query(
              `INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado, created_at)
               VALUES (@jogoId, @utilizadorId, 'A', 'confirmado', GETUTCDATE())`,
              { jogoId: novoId, utilizadorId: req.utilizador.id }
            );
          }
          recorrenciaCriados++;
        }
      }
    } catch (e) {
      console.warn('[Jogos] recorrência falhou:', e.message);
    }

    res.status(201).json({ sucesso: true, mensagem: 'Jogo criado!', jogoId, codigoAcesso, recorrenciaCriados });
  } catch (err) {
    console.error('[Jogos] Criar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/inscrever
async function inscreverJogo(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const { equipa: equipaEscolhida, codigoAcesso } = req.body;

    const jogo = await query(
      `SELECT j.id, j.max_jogadores, j.estado, j.visibilidade, j.codigo_acesso,
              COUNT(CASE WHEN i.estado='confirmado' THEN 1 END) AS total_inscritos
       FROM jogos j LEFT JOIN inscricoes i ON j.id=i.jogo_id
       WHERE j.id=@jogoId GROUP BY j.id, j.max_jogadores, j.estado, j.visibilidade, j.codigo_acesso`,
      { jogoId }
    );

    if (jogo.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jd = jogo.recordset[0];
    if (jd.estado === 'cancelado')
      return res.status(400).json({ sucesso: false, mensagem: 'Jogo cancelado.' });
    const cheio = jd.total_inscritos >= jd.max_jogadores;

    // Validar código de acesso para jogos privados
    if (jd.visibilidade === 'privado') {
      if (!codigoAcesso || codigoAcesso.toUpperCase() !== jd.codigo_acesso)
        return res.status(403).json({ sucesso: false, mensagem: 'Código de acesso inválido.' });
    }

    const jaInscrito = await query(
      `SELECT id, estado FROM inscricoes
        WHERE jogo_id=@jogoId AND utilizador_id=@utilizadorId AND estado IN ('confirmado','espera')`,
      { jogoId, utilizadorId }
    );
    if (jaInscrito.recordset.length > 0) {
      const est = jaInscrito.recordset[0].estado;
      return res.status(409).json({ sucesso: false, mensagem: est === 'espera' ? 'Já estás na lista de espera.' : 'Já estás inscrito.' });
    }

    // Lista de espera: jogo cheio mas ainda permite inscrição em espera
    if (cheio) {
      await query(`DELETE FROM inscricoes WHERE jogo_id=@jogoId AND utilizador_id=@utilizadorId AND estado IN ('cancelado')`, { jogoId, utilizadorId });
      await query(
        `INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado, created_at)
         VALUES (@jogoId, @utilizadorId, 'A', 'espera', GETUTCDATE())`,
        { jogoId, utilizadorId }
      );
      return res.json({ sucesso: true, mensagem: 'Sem vagas — ficaste na lista de espera. Serás notificado se houver lugar.', espera: true });
    }

    await query(`DELETE FROM inscricoes WHERE jogo_id=@jogoId AND utilizador_id=@utilizadorId AND estado='cancelado'`, { jogoId, utilizadorId });

    const maxPorEquipa = Math.floor(jd.max_jogadores / 2);
    const eqA = await query(`SELECT COUNT(*) AS t FROM inscricoes WHERE jogo_id=@jogoId AND equipa='A' AND estado='confirmado'`, { jogoId });
    const eqB = await query(`SELECT COUNT(*) AS t FROM inscricoes WHERE jogo_id=@jogoId AND equipa='B' AND estado='confirmado'`, { jogoId });
    const totalA = eqA.recordset[0].t, totalB = eqB.recordset[0].t;

    let equipa;
    if (equipaEscolhida === 'A' || equipaEscolhida === 'B') {
      if (equipaEscolhida === 'A' && totalA >= maxPorEquipa)
        return res.status(400).json({ sucesso: false, mensagem: 'Equipa A cheia.' });
      if (equipaEscolhida === 'B' && totalB >= maxPorEquipa)
        return res.status(400).json({ sucesso: false, mensagem: 'Equipa B cheia.' });
      equipa = equipaEscolhida;
    } else {
      equipa = totalA <= totalB ? 'A' : 'B';
    }

    await query(
      `INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado, created_at)
       VALUES (@jogoId, @utilizadorId, @equipa, 'confirmado', GETUTCDATE())`,
      { jogoId, utilizadorId, equipa }
    );

    if (jd.total_inscritos + 1 >= jd.max_jogadores)
      await query("UPDATE jogos SET estado='cheio' WHERE id=@jogoId", { jogoId });

    await query('UPDATE utilizadores SET total_jogos=total_jogos+1 WHERE id=@utilizadorId', { utilizadorId });
    res.json({ sucesso: true, mensagem: `Inscrito na Equipa ${equipa}!`, equipa });
  } catch (err) {
    console.error('[Jogos] Inscrever:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/jogos/:id/inscrever
async function cancelarInscricao(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const utilizadorId = req.utilizador.id;
    const inscricao = await query(
      `SELECT id, estado, equipa FROM inscricoes
        WHERE jogo_id=@jogoId AND utilizador_id=@utilizadorId AND estado IN ('confirmado','espera')`,
      { jogoId, utilizadorId }
    );
    if (inscricao.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Inscrição não encontrada.' });

    const erainscrito = inscricao.recordset[0].estado === 'confirmado';
    const equipaLiberta = inscricao.recordset[0].equipa || 'A';

    await query(
      `UPDATE inscricoes SET estado='cancelado'
        WHERE jogo_id=@jogoId AND utilizador_id=@utilizadorId AND estado IN ('confirmado','espera')`,
      { jogoId, utilizadorId }
    );

    if (erainscrito) {
      // Reabrir jogo se estava cheio
      await query("UPDATE jogos SET estado='aberto' WHERE id=@jogoId AND estado='cheio'", { jogoId });
      await query(`UPDATE utilizadores SET total_jogos=CASE WHEN total_jogos>0 THEN total_jogos-1 ELSE 0 END WHERE id=@utilizadorId`, { utilizadorId });

      // Promover primeiro da lista de espera (se existir)
      try {
        const prox = await query(
          `SELECT TOP 1 id, utilizador_id FROM inscricoes
            WHERE jogo_id=@jogoId AND estado='espera'
            ORDER BY created_at ASC`,
          { jogoId }
        );
        if (prox.recordset.length) {
          const promoId = prox.recordset[0].id;
          const promoUid = prox.recordset[0].utilizador_id;
          await query(
            `UPDATE inscricoes SET estado='confirmado', equipa=@eq WHERE id=@id`,
            { id: promoId, eq: equipaLiberta }
          );
          await query('UPDATE utilizadores SET total_jogos=total_jogos+1 WHERE id=@uid', { uid: promoUid });
          const jR = await query(`SELECT titulo FROM jogos WHERE id=@jogoId`, { jogoId });
          const titulo = jR.recordset[0]?.titulo || 'jogo';
          try {
            await criarNotificacao({
              utilizadorId: promoUid,
              tipo: 'jogo_confirmado',
              titulo: '🎉 Subiste da lista de espera!',
              mensagem: `Abriu vaga em "${titulo}". Já estás confirmado na Equipa ${equipaLiberta}.`,
              jogoId,
              acaoUrl: `/jogos/${jogoId}`,
            });
          } catch {}
        }
      } catch (e) { console.warn('[Jogos] promo espera falhou:', e.message); }
    }

    res.json({ sucesso: true, mensagem: 'Inscrição cancelada.' });
  } catch (err) {
    console.error('[Jogos] Cancelar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// POST /api/jogos/:id/checkin — só participantes, janela [-60min, +30min]
async function checkin(req, res) {
  try {
    const jogoId = parseInt(req.params.id);
    const uid = req.utilizador.id;
    const jR = await query(`SELECT data_jogo FROM jogos WHERE id=@id AND estado <> 'cancelado'`, { id: jogoId });
    if (!jR.recordset.length) return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const dt = new Date(jR.recordset[0].data_jogo).getTime();
    const agora = Date.now();
    if (agora < dt - 60 * 60 * 1000)
      return res.status(400).json({ sucesso: false, mensagem: 'Check-in abre 1h antes do jogo.' });
    if (agora > dt + 30 * 60 * 1000)
      return res.status(400).json({ sucesso: false, mensagem: 'Janela de check-in já fechou.' });

    const ins = await query(
      `SELECT id FROM inscricoes WHERE jogo_id=@jid AND utilizador_id=@uid AND estado='confirmado'`,
      { jid: jogoId, uid }
    );
    if (!ins.recordset.length)
      return res.status(403).json({ sucesso: false, mensagem: 'Só participantes confirmados podem fazer check-in.' });

    await query(
      `UPDATE inscricoes SET checkin_at = GETUTCDATE()
        WHERE jogo_id=@jid AND utilizador_id=@uid AND estado='confirmado' AND checkin_at IS NULL`,
      { jid: jogoId, uid }
    );
    res.json({ sucesso: true, mensagem: 'Check-in feito!' });
  } catch (err) {
    console.error('[Jogos] checkin:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

// PUT /api/jogos/:id
async function editarJogo(req, res) {
  try {
    const { id } = req.params;
    const utilizadorId = req.utilizador.id;
    const isAdmin = req.utilizador.role === 'admin';

    // Verificar se o jogo existe e obter criador
    const jogoResult = await query(
      'SELECT id, criador_id FROM jogos WHERE id=@id', { id: parseInt(id) }
    );
    if (jogoResult.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });

    const jogo = jogoResult.recordset[0];

    // Só o criador ou admin pode editar
    if (jogo.criador_id !== utilizadorId && !isAdmin)
      return res.status(403).json({ sucesso: false, mensagem: 'Sem permissão para editar este jogo.' });

    const { titulo, descricao, dataJogo, local, regiao, tipoJogo, maxJogadores, nivel } = req.body;

    if (!titulo || !titulo.trim())
      return res.status(400).json({ sucesso: false, mensagem: 'O título é obrigatório.' });

    await query(
      `UPDATE jogos
       SET titulo=@titulo, descricao=@descricao, data_jogo=@dataJogo, local=@local,
           regiao=@regiao, tipo_jogo=@tipoJogo, max_jogadores=@maxJogadores, nivel=@nivel,
           updated_at=GETUTCDATE()
       WHERE id=@id`,
      {
        id: parseInt(id),
        titulo: titulo.trim(),
        descricao: descricao || null,
        dataJogo: dataJogo ? new Date(dataJogo) : null,
        local: local || null,
        regiao: regiao || null,
        tipoJogo: tipoJogo || '5x5',
        maxJogadores: parseInt(maxJogadores) || 10,
        nivel: nivel || 'Descontraído'
      }
    );

    res.json({ sucesso: true, mensagem: 'Jogo atualizado com sucesso.' });
  } catch (err) {
    console.error('[Jogos] Editar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/jogos/:id
async function eliminarJogo(req, res) {
  try {
    const { id } = req.params;
    const jogo = await query('SELECT id FROM jogos WHERE id=@id', { id: parseInt(id) });
    if (jogo.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogo não encontrado.' });
    const p = { id: parseInt(id) };
    const tentativa = async (sql) => { try { await query(sql, p); } catch (e) { /* ignora se tabela não existir */ } };
    await tentativa('DELETE FROM mensagens_chat WHERE jogo_id=@id');
    await tentativa('DELETE FROM inscricoes WHERE jogo_id=@id');
    await tentativa('DELETE FROM inscricoes_equipa WHERE jogo_id=@id');
    await tentativa('DELETE FROM pagamentos WHERE jogo_id=@id');
    await tentativa('DELETE FROM resultado_jogo WHERE jogo_id=@id');
    await tentativa('DELETE FROM notificacoes WHERE jogo_id=@id');
    await tentativa('DELETE FROM avaliacoes WHERE jogo_id=@id');
    await tentativa('DELETE FROM reports WHERE jogo_id=@id');
    await query('DELETE FROM jogos WHERE id=@id', p);
    res.json({ sucesso: true, mensagem: 'Jogo eliminado.' });
  } catch (err) {
    console.error('[Jogos] Eliminar:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

module.exports = { listarJogos, obterJogo, criarJogo, editarJogo, inscreverJogo, cancelarInscricao, eliminarJogo, checkin };
