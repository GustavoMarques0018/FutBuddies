// ============================================================
//  FutBuddies - Controlador de Utilizadores e Admin
// ============================================================

const { query } = require('../config/database');

// Helper: verifica se a coluna perfil_publico existe (migration v7 aplicada?)
let _perfilPublicoCache = null;
async function temColunaPerfilPublico() {
  if (_perfilPublicoCache !== null) return _perfilPublicoCache;
  try {
    const r = await query(
      `SELECT 1 AS ok FROM sys.columns
        WHERE object_id = OBJECT_ID('utilizadores') AND name = 'perfil_publico'`
    );
    _perfilPublicoCache = r.recordset.length > 0;
  } catch {
    _perfilPublicoCache = false;
  }
  return _perfilPublicoCache;
}

// Helper: user_role (migration v9 aplicada?)
let _userRoleCache = null;
async function temColunaUserRole() {
  if (_userRoleCache !== null) return _userRoleCache;
  try {
    const r = await query(
      `SELECT 1 AS ok FROM sys.columns
        WHERE object_id = OBJECT_ID('utilizadores') AND name = 'user_role'`
    );
    _userRoleCache = r.recordset.length > 0;
  } catch {
    _userRoleCache = false;
  }
  return _userRoleCache;
}

// GET /api/utilizadores/perfil
async function getPerfil(req, res) {
  try {
    const temPP = await temColunaPerfilPublico();
    const temUR = await temColunaUserRole();
    const cols = `id, nome, email, role, ${temUR ? 'user_role,' : ''} nickname, posicao, pe_preferido, regiao, cidade, bio, foto_url,
                  total_jogos, total_golos, total_assistencias, ${temPP ? 'perfil_publico,' : ''}
                  COALESCE(receber_emails, 1) AS receber_emails,
                  created_at, ultimo_login`;
    const resultado = await query(
      `SELECT ${cols} FROM utilizadores WHERE id = @id`,
      { id: req.utilizador.id }
    );
    if (resultado.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Utilizador não encontrado.' });
    const u = resultado.recordset[0];
    if (!temPP) u.perfil_publico = 1; // default
    if (!temUR) u.user_role = 'PLAYER'; // default
    res.json({ sucesso: true, utilizador: u });
  } catch (err) {
    console.error('[Perfil] getPerfil erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/utilizadores/perfil
async function updatePerfil(req, res) {
  try {
    const { posicao, cidade, bio, nickname, pePreferido, regiao, fotoUrl, perfilPublico, receberEmails } = req.body;
    const temPP = await temColunaPerfilPublico();
    const perfilPubBit = (perfilPublico === undefined || perfilPublico === null) ? null : (perfilPublico ? 1 : 0);
    const receberBit  = (receberEmails  === undefined || receberEmails  === null) ? null : (receberEmails  ? 1 : 0);
    const setPP = temPP ? `, perfil_publico = COALESCE(@perfilPub, perfil_publico)` : '';
    const params = { posicao: posicao||null, cidade: cidade||null, bio: bio||null,
        nickname: nickname||null, pePreferido: pePreferido||null,
        regiao: regiao||null, fotoUrl: fotoUrl||null, id: req.utilizador.id };
    if (temPP) params.perfilPub = perfilPubBit;
    params.receber = receberBit;
    await query(
      `UPDATE utilizadores
       SET posicao=@posicao, cidade=@cidade, bio=@bio, nickname=@nickname,
           pe_preferido=@pePreferido, regiao=@regiao, foto_url=@fotoUrl,
           receber_emails = COALESCE(@receber, receber_emails)
           ${setPP},
           updated_at=GETUTCDATE()
       WHERE id=@id`,
      params
    );
    res.json({ sucesso: true, mensagem: 'Perfil atualizado!' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// PUT /api/utilizadores/password
async function alterarPassword(req, res) {
  try {
    const bcrypt = require('bcryptjs');
    const { passwordAtual, novaPassword } = req.body;

    if (!passwordAtual || !novaPassword)
      return res.status(400).json({ sucesso: false, mensagem: 'Preenche todos os campos.' });
    if (novaPassword.length < 6)
      return res.status(400).json({ sucesso: false, mensagem: 'A nova password deve ter pelo menos 6 caracteres.' });

    const resultado = await query(
      'SELECT password_hash FROM utilizadores WHERE id = @id', { id: req.utilizador.id }
    );
    const valida = await bcrypt.compare(passwordAtual, resultado.recordset[0].password_hash);
    if (!valida)
      return res.status(400).json({ sucesso: false, mensagem: 'Password atual incorreta.' });

    const novoHash = await bcrypt.hash(novaPassword, 12);
    await query('UPDATE utilizadores SET password_hash=@hash WHERE id=@id', { hash: novoHash, id: req.utilizador.id });
    res.json({ sucesso: true, mensagem: 'Password alterada com sucesso!' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// DELETE /api/utilizadores/conta
async function eliminarConta(req, res) {
  try {
    const bcrypt = require('bcryptjs');
    const { password } = req.body;

    const resultado = await query('SELECT password_hash FROM utilizadores WHERE id = @id', { id: req.utilizador.id });
    const valida = await bcrypt.compare(password, resultado.recordset[0].password_hash);
    if (!valida)
      return res.status(400).json({ sucesso: false, mensagem: 'Password incorreta.' });

    // Remover de equipas
    await query('DELETE FROM equipa_membros WHERE utilizador_id = @id', { id: req.utilizador.id });
    // Transferir equipas se for capitão (ou eliminar)
    const equipasCapitao = await query('SELECT id FROM equipas WHERE capitao_id = @id', { id: req.utilizador.id });
    for (const eq of equipasCapitao.recordset) {
      await query('DELETE FROM equipa_membros WHERE equipa_id = @eqId', { eqId: eq.id });
      await query('DELETE FROM equipas WHERE id = @eqId', { eqId: eq.id });
    }
    await query('DELETE FROM refresh_tokens WHERE utilizador_id = @id', { id: req.utilizador.id });
    await query('UPDATE utilizadores SET ativo=0, email=@emailAnon, updated_at=GETUTCDATE() WHERE id=@id',
      { emailAnon: `deleted_${req.utilizador.id}@futbuddies.pt`, id: req.utilizador.id });

    res.json({ sucesso: true, mensagem: 'Conta eliminada.' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/jogadores/:id
async function getPerfilPublico(req, res) {
  try {
    const { id } = req.params;
    const alvoId = parseInt(id);
    const viewerId = req.utilizador?.id || null;

    const temPP = await temColunaPerfilPublico();
    const ppCol = temPP ? 'perfil_publico,' : '';
    const resultado = await query(
      `SELECT id, nome, nickname, posicao, pe_preferido, regiao, cidade, bio, foto_url,
              total_jogos, total_golos, total_assistencias, ${ppCol} created_at
       FROM utilizadores WHERE id=@id AND ativo=1`, { id: alvoId }
    );
    if (resultado.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Jogador não encontrado.' });

    const utilizador = resultado.recordset[0];
    if (!temPP) utilizador.perfil_publico = 1;

    const equipaRes = await query(
      `SELECT e.id, e.nome, e.emblema, e.nivel, m.papel
       FROM equipa_membros m JOIN equipas e ON m.equipa_id = e.id
       WHERE m.utilizador_id = @id`, { id: alvoId }
    );

    // Privacidade: se perfil_publico = 0 e viewer não é o próprio nem amigo → devolver versão mínima
    const isOwner = viewerId === alvoId;
    let isAmigo = false;
    if (viewerId && !isOwner) {
      const amigoR = await query(
        `SELECT id FROM amizades
          WHERE estado='aceite' AND (
            (remetente_id=@me AND destinatario_id=@alvo)
            OR (remetente_id=@alvo AND destinatario_id=@me)
          )`,
        { me: viewerId, alvo: alvoId }
      ).catch(() => ({ recordset: [] }));
      isAmigo = amigoR.recordset.length > 0;
    }
    const privado = !utilizador.perfil_publico && !isOwner && !isAmigo;

    if (privado) {
      return res.json({
        sucesso: true,
        privado: true,
        utilizador: {
          id: utilizador.id,
          nome: utilizador.nome,
          nickname: utilizador.nickname,
          foto_url: utilizador.foto_url,
          perfil_publico: 0,
        },
        jogosRecentes: [],
        equipa: equipaRes.recordset[0] || null,
      });
    }

    const jogosRecentes = await query(
      `SELECT TOP 5 j.id, j.titulo, j.local, j.regiao, j.data_jogo, j.tipo_jogo, j.estado, i.equipa
       FROM inscricoes i INNER JOIN jogos j ON j.id = i.jogo_id
       WHERE i.utilizador_id=@id AND i.estado='confirmado'
       ORDER BY j.data_jogo DESC`, { id: alvoId }
    );

    res.json({ sucesso: true, privado: false, utilizador,
      jogosRecentes: jogosRecentes.recordset,
      equipa: equipaRes.recordset[0] || null });
  } catch (err) {
    console.error('[PerfilPublico] Erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// ── ADMIN ──────────────────────────────────────────────────

async function getDashboard(req, res) {
  try {
    const stats = await query(
      `SELECT
         (SELECT COUNT(*) FROM utilizadores)                                          AS total_utilizadores,
         (SELECT COUNT(*) FROM utilizadores WHERE ativo=1)                           AS utilizadores_ativos,
         (SELECT COUNT(*) FROM utilizadores WHERE created_at >= DATEADD(DAY,-7,GETUTCDATE())) AS novos_semana,
         (SELECT COUNT(*) FROM jogos)                                                AS total_jogos,
         (SELECT COUNT(*) FROM jogos WHERE estado='aberto')                          AS jogos_abertos,
         (SELECT COUNT(*) FROM jogos WHERE estado='cheio')                           AS jogos_cheios,
         (SELECT COUNT(*) FROM jogos WHERE estado='concluido')                       AS jogos_concluidos,
         (SELECT COUNT(*) FROM jogos WHERE data_jogo >= GETUTCDATE())                AS jogos_futuros,
         (SELECT COUNT(*) FROM jogos WHERE visibilidade='privado')                   AS jogos_privados,
         (SELECT COUNT(*) FROM equipas)                                              AS total_equipas,
         (SELECT COUNT(*) FROM inscricoes WHERE estado='confirmado')                 AS total_inscricoes,
         (SELECT COUNT(*) FROM mensagens_chat)                                       AS total_mensagens`
    );
    const topJogadores = await query(
      `SELECT TOP 5 nome, nickname, total_jogos, total_golos, posicao, regiao
       FROM utilizadores WHERE ativo=1 ORDER BY total_jogos DESC, total_golos DESC`
    );
    const jogosRecentes = await query(
      `SELECT TOP 5 j.id, j.titulo, j.regiao, j.data_jogo, j.estado, j.tipo_jogo, j.visibilidade,
              j.max_jogadores, j.modo_jogo,
              u.nome AS criador_nome,
              CASE WHEN j.modo_jogo = 'equipa'
                THEN ISNULL((SELECT COUNT(*) FROM inscricoes_equipa ie2 WHERE ie2.jogo_id = j.id AND ie2.estado = 'confirmado'), 0) * (j.max_jogadores / 2)
                ELSE COUNT(CASE WHEN i.estado='confirmado' THEN 1 END)
              END AS total_inscritos
       FROM jogos j LEFT JOIN utilizadores u ON j.criador_id=u.id LEFT JOIN inscricoes i ON j.id=i.jogo_id
       GROUP BY j.id, j.titulo, j.regiao, j.data_jogo, j.estado, j.tipo_jogo, j.visibilidade,
                j.max_jogadores, j.modo_jogo, u.nome, j.created_at
       ORDER BY j.created_at DESC`
    );
    res.json({ sucesso: true, stats: stats.recordset[0], topJogadores: topJogadores.recordset, jogosRecentes: jogosRecentes.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

async function getUtilizadores(req, res) {
  try {
    const resultado = await query(
      `SELECT id, nome, nickname, email, role, posicao, regiao, total_jogos, total_golos, ativo, created_at, ultimo_login
       FROM utilizadores ORDER BY created_at DESC`
    );
    res.json({ sucesso: true, utilizadores: resultado.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

async function getTodosJogos(req, res) {
  try {
    const { estado, pesquisa } = req.query;
    let where = 'WHERE 1=1';
    const params = {};
    if (estado)   { where += ' AND j.estado=@estado'; params.estado = estado; }
    if (pesquisa) { where += ' AND (j.titulo LIKE @pesquisa OR j.local LIKE @pesquisa OR j.regiao LIKE @pesquisa)'; params.pesquisa = `%${pesquisa}%`; }

    const resultado = await query(
      `SELECT j.id, j.titulo, j.local, j.regiao, j.data_jogo, j.estado, j.tipo_jogo, j.visibilidade,
              j.max_jogadores, j.modo_jogo, j.created_at,
              u.nome AS criador_nome,
              CASE WHEN j.modo_jogo = 'equipa'
                THEN ISNULL((SELECT COUNT(*) FROM inscricoes_equipa ie2 WHERE ie2.jogo_id = j.id AND ie2.estado = 'confirmado'), 0) * (j.max_jogadores / 2)
                ELSE COUNT(CASE WHEN i.estado='confirmado' THEN 1 END)
              END AS total_inscritos
       FROM jogos j LEFT JOIN utilizadores u ON j.criador_id=u.id LEFT JOIN inscricoes i ON j.id=i.jogo_id
       ${where}
       GROUP BY j.id, j.titulo, j.local, j.regiao, j.data_jogo, j.estado, j.tipo_jogo, j.visibilidade,
                j.max_jogadores, j.modo_jogo, j.created_at, u.nome
       ORDER BY j.data_jogo DESC`, params
    );
    res.json({ sucesso: true, jogos: resultado.recordset });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user','admin'].includes(role))
      return res.status(400).json({ sucesso: false, mensagem: 'Role inválido.' });
    if (parseInt(id) === req.utilizador.id)
      return res.status(400).json({ sucesso: false, mensagem: 'Não podes alterar o teu próprio role.' });
    await query('UPDATE utilizadores SET role=@role, updated_at=GETUTCDATE() WHERE id=@id', { role, id: parseInt(id) });
    res.json({ sucesso: true, mensagem: 'Role atualizado.' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

async function toggleAtivo(req, res) {
  try {
    const { id } = req.params;
    const resultado = await query('SELECT ativo FROM utilizadores WHERE id=@id', { id: parseInt(id) });
    if (resultado.recordset.length === 0)
      return res.status(404).json({ sucesso: false, mensagem: 'Utilizador não encontrado.' });
    const novoEstado = !resultado.recordset[0].ativo;
    await query('UPDATE utilizadores SET ativo=@ativo, updated_at=GETUTCDATE() WHERE id=@id', { ativo: novoEstado, id: parseInt(id) });
    res.json({ sucesso: true, mensagem: novoEstado ? 'Conta ativada.' : 'Conta desativada.' });
  } catch (err) {
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/utilizadores/me/meus-jogos
// Lista jogos do utilizador separados em "futuros" e "passados", com stats pessoais nos passados
async function getMeusJogos(req, res) {
  try {
    const uid = req.utilizador.id;

    const r = await query(
      `SELECT j.id, j.titulo, j.data_jogo, j.local, j.regiao, j.tipo_jogo, j.modo_jogo,
              j.max_jogadores, j.estado, j.visibilidade, j.criador_id,
              u.nome AS criador_nome,
              -- Lado em que joga/jogou (A/B) — pick-up ou equipa
              COALESCE(
                (SELECT TOP 1 ins.equipa FROM inscricoes ins
                    WHERE ins.jogo_id = j.id AND ins.utilizador_id = @uid AND ins.estado = 'confirmado'),
                (SELECT TOP 1 ie.lado FROM inscricoes_equipa ie
                    JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
                    WHERE ie.jogo_id = j.id AND em.utilizador_id = @uid AND ie.estado = 'confirmado')
              ) AS lado,
              -- Stats pessoais reportadas (passados)
              rp.golos AS meus_golos,
              rp.assistencias AS minhas_assistencias,
              -- Placard oficial
              rjo.golos_equipa_a, rjo.golos_equipa_b
         FROM jogos j
         LEFT JOIN utilizadores u ON u.id = j.criador_id
         LEFT JOIN resultado_pessoal rp ON rp.jogo_id = j.id AND rp.utilizador_id = @uid
         LEFT JOIN resultado_jogo rjo ON rjo.jogo_id = j.id
         WHERE (
           j.criador_id = @uid
           OR EXISTS (SELECT 1 FROM inscricoes ii WHERE ii.jogo_id = j.id AND ii.utilizador_id = @uid AND ii.estado = 'confirmado')
           OR EXISTS (
             SELECT 1 FROM inscricoes_equipa ie3
             JOIN equipa_membros em ON em.equipa_id = ie3.equipa_id
             WHERE ie3.jogo_id = j.id AND em.utilizador_id = @uid AND ie3.estado = 'confirmado'
           )
         )
         ORDER BY j.data_jogo DESC`,
      { uid }
    );

    const agora = new Date();
    const futuros = [];
    const passados = [];
    for (const j of r.recordset) {
      const dataJ = j.data_jogo ? new Date(j.data_jogo) : null;
      const isPassado = j.estado === 'concluido' || (dataJ && dataJ < agora && (agora - dataJ) > 60 * 60 * 1000);
      if (isPassado) passados.push(j); else futuros.push(j);
    }
    futuros.sort((a, b) => new Date(a.data_jogo || 0) - new Date(b.data_jogo || 0));

    res.json({ sucesso: true, futuros, passados });
  } catch (err) {
    console.error('[MeusJogos] Erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno.' });
  }
}

// GET /api/meu/historico — últimos N jogos + stats mensais
async function getHistorico(req, res) {
  try {
    const uid = req.utilizador.id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const ultimos = await query(
      `SELECT TOP (${limit}) j.id, j.titulo, j.data_jogo, j.regiao, j.local,
              rp.golos, rp.assistencias,
              r.golos_equipa_a, r.golos_equipa_b,
              CASE
                WHEN r.golos_equipa_a IS NULL OR r.golos_equipa_b IS NULL THEN NULL
                WHEN r.golos_equipa_a > r.golos_equipa_b THEN 'A'
                WHEN r.golos_equipa_b > r.golos_equipa_a THEN 'B'
                ELSE 'E'
              END AS equipa_vencedora
         FROM jogos j
         JOIN (
            SELECT jogo_id FROM inscricoes WHERE utilizador_id=@uid AND estado='confirmado'
            UNION
            SELECT ie.jogo_id FROM inscricoes_equipa ie
              JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
             WHERE em.utilizador_id=@uid AND ie.estado='confirmado'
         ) p ON p.jogo_id = j.id
         LEFT JOIN resultado_pessoal rp ON rp.jogo_id = j.id AND rp.utilizador_id = @uid
         LEFT JOIN resultado_jogo r ON r.jogo_id = j.id
        WHERE DATEADD(HOUR, 1, j.data_jogo) < GETUTCDATE()
          AND j.estado <> 'cancelado'
        ORDER BY j.data_jogo DESC`,
      { uid }
    );

    const porMes = await query(
      `SELECT
         FORMAT(j.data_jogo, 'yyyy-MM') AS mes,
         COUNT(DISTINCT j.id)         AS jogos,
         ISNULL(SUM(rp.golos), 0)     AS golos,
         ISNULL(SUM(rp.assistencias), 0) AS assistencias
       FROM jogos j
       JOIN (
          SELECT jogo_id FROM inscricoes WHERE utilizador_id=@uid AND estado='confirmado'
          UNION
          SELECT ie.jogo_id FROM inscricoes_equipa ie
            JOIN equipa_membros em ON em.equipa_id = ie.equipa_id
           WHERE em.utilizador_id=@uid AND ie.estado='confirmado'
       ) p ON p.jogo_id = j.id
       LEFT JOIN resultado_pessoal rp ON rp.jogo_id = j.id AND rp.utilizador_id = @uid
       WHERE j.data_jogo >= DATEADD(MONTH, -6, GETUTCDATE())
         AND DATEADD(HOUR, 1, j.data_jogo) < GETUTCDATE()
         AND j.estado <> 'cancelado'
       GROUP BY FORMAT(j.data_jogo, 'yyyy-MM')
       ORDER BY mes ASC`,
      { uid }
    );

    const totais = await query(
      `SELECT total_golos, total_assistencias,
              ISNULL(total_mvp, 0) AS total_mvp,
              ISNULL(no_show_count, 0) AS no_show_count
         FROM utilizadores WHERE id=@uid`,
      { uid }
    );

    res.json({
      sucesso: true,
      ultimos: ultimos.recordset,
      porMes: porMes.recordset,
      totais: totais.recordset[0] || {},
    });
  } catch (err) {
    console.error('[Perfil] historico erro:', err);
    res.status(500).json({ sucesso: false, mensagem: 'Erro.' });
  }
}

module.exports = { getPerfil, updatePerfil, alterarPassword, eliminarConta, getPerfilPublico, getDashboard, getUtilizadores, getTodosJogos, updateRole, toggleAtivo, getMeusJogos, getHistorico };
