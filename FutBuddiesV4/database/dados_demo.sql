-- ============================================================
--  FutBuddies - DADOS DE DEMONSTRAÇÃO
--  Popula a base de dados com jogadores, equipas, jogos, ligas
--  e resultados fictícios para a apresentação da PAP.
--
--  PRÉ-REQUISITO: correr primeiro o FutBuddiesDB_Completo.sql
--  Como usar: abrir no SSMS > Nova Consulta > Executar (F5)
--
--  Datas dos jogos são RELATIVAS a hoje (DATEADD) — os jogos
--  abertos estarão sempre no futuro, qualquer que seja o dia.
--
--  Contas de acesso (para login / botões de acesso rápido):
--    admin@futbuddies.pt    / FutBuddies2026!   (administrador)
--    cadera@futbuddies.com  / 123456            (dono de campo)
--    gustavo@futbuddies.com / 123456            (jogador)
--  (todas as restantes contas de demo usam a password 123456)
-- ============================================================
SET NOCOUNT ON;
USE FutBuddiesDB;
GO

-- Hashes bcrypt reais (salt 12)
DECLARE @p123   NVARCHAR(255) = '$2a$12$0f7nmmf9T1bAnnuO1ImVz.HCj21kGuCI.DMQ6/bj4e0yrDVnRwSQ.';   -- 123456
DECLARE @padmin NVARCHAR(255) = '$2a$12$yOtqxxRHDhGTztHdeNU9e.N6yjQes1o4rF5kU1GbhCy2E1QhHFUci';   -- FutBuddies2026!

-- ── 1. JOGADORES ─────────────────────────────────────────────
INSERT INTO utilizadores (nome, email, password_hash, posicao, regiao, cidade, bio,
                          total_jogos, total_golos, total_assistencias)
SELECT v.nome, v.email, v.ph, v.pos, v.reg, v.cid, v.bio, v.tj, v.tg, v.ta
FROM (VALUES
  ('Gustavo Marques',  'gustavo@futbuddies.com',       @p123,   'Médio',        'Lisboa',  'Lisboa',  'Organizo peladas todas as semanas. Bola ao chão!', 24, 18, 12),
  ('Ricardo Cadera',   'cadera@futbuddies.com',        @p123,   'Defesa',       'Porto',   'Porto',   'Dono do campo Cadera Arena. Vê os meus campos!',   30, 5,  9),
  ('Admin FutBuddies', 'admin@futbuddies.pt',          @padmin, 'Médio',        'Lisboa',  'Lisboa',  'Conta de administração da plataforma.',            0,  0,  0),
  ('João Silva',       'joao.silva@futbuddies.com',    @p123,   'Avançado',     'Lisboa',  'Lisboa',  'Avançado nato, vivo do golo.',                     22, 27, 6),
  ('Miguel Santos',    'miguel.santos@futbuddies.com', @p123,   'Guarda-Redes', 'Porto',   'Porto',   'Debaixo dos paus desde sempre.',                   19, 0,  3),
  ('Pedro Costa',      'pedro.costa@futbuddies.com',   @p123,   'Médio',        'Braga',   'Braga',   'O motor do meio-campo.',                           21, 9,  15),
  ('Tiago Ferreira',   'tiago.ferreira@futbuddies.com',@p123,   'Extremo',      'Lisboa',  'Lisboa',  'Velocidade e dribles pela linha.',                 18, 14, 11),
  ('André Sousa',      'andre.sousa@futbuddies.com',   @p123,   'Defesa',       'Coimbra', 'Coimbra', 'Defesa sólido, não passa ninguém.',                20, 2,  4),
  ('Rui Oliveira',     'rui.oliveira@futbuddies.com',  @p123,   'Avançado',     'Porto',   'Porto',   'Faro de golo afinado.',                            23, 21, 7),
  ('Nuno Almeida',     'nuno.almeida@futbuddies.com',  @p123,   'Médio',        'Lisboa',  'Lisboa',  'Passe certo e visão de jogo.',                     17, 6,  13),
  ('Diogo Pinto',      'diogo.pinto@futbuddies.com',   @p123,   'Extremo',      'Setúbal', 'Setúbal', 'Rápido e trabalhador.',                            16, 11, 9),
  ('Bruno Carvalho',   'bruno.carvalho@futbuddies.com',@p123,   'Defesa',       'Faro',    'Faro',    'Líder defensivo da equipa.',                       20, 3,  5)
) AS v(nome, email, ph, pos, reg, cid, bio, tj, tg, ta)
WHERE NOT EXISTS (SELECT 1 FROM utilizadores u WHERE u.email = v.email);
GO

-- Papéis especiais
UPDATE utilizadores SET role = 'admin'        WHERE email = 'admin@futbuddies.pt';
IF COL_LENGTH('dbo.utilizadores','user_role') IS NOT NULL
  UPDATE utilizadores SET user_role = 'FIELD_OWNER' WHERE email = 'cadera@futbuddies.com';
GO

-- ── 2. EQUIPAS ───────────────────────────────────────────────
INSERT INTO equipas (nome, emblema, descricao, nivel, regiao, capitao_id, a_recrutar)
SELECT v.nome, v.emblema, v.descricao, v.nivel, v.regiao,
       (SELECT id FROM utilizadores WHERE email = v.capitao_email), v.recrutar
FROM (VALUES
  ('Os Galácticos',  '⚽', 'A equipa mais descontraída de Lisboa.',  'Descontraído', 'Lisboa', 'gustavo@futbuddies.com',     1),
  ('FC Bairro',      '🔥', 'Tradição e raça no Porto.',              'Intermédio',   'Porto',  'rui.oliveira@futbuddies.com',1),
  ('Minho United',   '🛡️', 'Competitivos e organizados.',            'Competitivo',  'Braga',  'pedro.costa@futbuddies.com', 0)
) AS v(nome, emblema, descricao, nivel, regiao, capitao_email, recrutar)
WHERE NOT EXISTS (SELECT 1 FROM equipas e WHERE e.nome = v.nome);
GO

-- Membros das equipas (capitão + alguns jogadores)
INSERT INTO equipa_membros (equipa_id, utilizador_id, papel)
SELECT v.eid, v.uid, v.papel FROM (
  SELECT (SELECT id FROM equipas WHERE nome='Os Galácticos') eid, (SELECT id FROM utilizadores WHERE email='gustavo@futbuddies.com') uid, 'capitao' papel
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='Os Galácticos'), (SELECT id FROM utilizadores WHERE email='joao.silva@futbuddies.com'),  'membro'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='Os Galácticos'), (SELECT id FROM utilizadores WHERE email='tiago.ferreira@futbuddies.com'),'membro'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='Os Galácticos'), (SELECT id FROM utilizadores WHERE email='nuno.almeida@futbuddies.com'), 'membro'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='FC Bairro'),     (SELECT id FROM utilizadores WHERE email='rui.oliveira@futbuddies.com'),  'capitao'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='FC Bairro'),     (SELECT id FROM utilizadores WHERE email='miguel.santos@futbuddies.com'), 'membro'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='Minho United'),  (SELECT id FROM utilizadores WHERE email='pedro.costa@futbuddies.com'),   'capitao'
  UNION ALL SELECT (SELECT id FROM equipas WHERE nome='Minho United'),  (SELECT id FROM utilizadores WHERE email='andre.sousa@futbuddies.com'),   'membro'
) AS v
WHERE v.uid IS NOT NULL AND v.eid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM equipa_membros m WHERE m.equipa_id=v.eid AND m.utilizador_id=v.uid);
GO

-- ── 3. JOGOS ─────────────────────────────────────────────────
-- Abertos (datas no futuro) — aparecem em "Jogos em Destaque"
INSERT INTO jogos (titulo, descricao, data_jogo, local, tipo_jogo, max_jogadores, estado, criador_id, regiao)
SELECT v.titulo, v.descr, v.data_jogo, v.local, v.tipo, v.maxj, v.estado,
       (SELECT id FROM utilizadores WHERE email = v.criador), v.regiao
FROM (VALUES
  ('Pelada de 5ª à noite',       'Jogo descontraído a meio da semana. Traz caneleiras!', DATEADD(hour, 21, CAST(DATEADD(day, 2, CAST(GETDATE() AS DATE)) AS DATETIME2)), 'Pavilhão da Luz, Lisboa',     '5x5',   10, 'aberto',    'gustavo@futbuddies.com',     'Lisboa'),
  ('Jogo de Domingo no Restelo', 'Manhã de domingo, futebol e convívio.',                 DATEADD(hour, 10, CAST(DATEADD(day, 4, CAST(GETDATE() AS DATE)) AS DATETIME2)), 'Campo do Restelo, Lisboa',    '7x7',   14, 'aberto',    'joao.silva@futbuddies.com',  'Lisboa'),
  ('Racha do Porto',             'Clássico racha portuense. Nível intermédio.',           DATEADD(hour, 20, CAST(DATEADD(day, 3, CAST(GETDATE() AS DATE)) AS DATETIME2)), 'Cadera Arena, Porto',         '5x5',   10, 'aberto',    'rui.oliveira@futbuddies.com','Porto'),
  ('Clássico dos Amigos',        'Jogo de 11 a sério. Vem cedo para aquecer.',            DATEADD(hour, 18, CAST(DATEADD(day, 6, CAST(GETDATE() AS DATE)) AS DATETIME2)), 'Estádio Municipal, Braga',    '11x11', 22, 'aberto',    'pedro.costa@futbuddies.com', 'Braga'),
  -- Concluídos (no passado) — para estatísticas e histórico
  ('Pelada de Sábado passado',   'Já foi! Grande jogo.',                                  DATEADD(hour, 16, CAST(DATEADD(day, -5,  CAST(GETDATE() AS DATE)) AS DATETIME2)),'Pavilhão da Luz, Lisboa',     '5x5',   10, 'concluido', 'gustavo@futbuddies.com',     'Lisboa'),
  ('Torneio relâmpago',          'Torneio rápido entre amigos.',                          DATEADD(hour, 11, CAST(DATEADD(day, -10, CAST(GETDATE() AS DATE)) AS DATETIME2)),'Cadera Arena, Porto',         '7x7',   14, 'concluido', 'rui.oliveira@futbuddies.com','Porto')
) AS v(titulo, descr, data_jogo, local, tipo, maxj, estado, criador, regiao)
WHERE NOT EXISTS (SELECT 1 FROM jogos j WHERE j.titulo = v.titulo);
GO

-- ── 4. INSCRIÇÕES ────────────────────────────────────────────
-- Inscreve 8 jogadores de demo em cada jogo, alternando equipa A/B.
;WITH demo_users AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM utilizadores
   WHERE email LIKE '%@futbuddies%' AND email <> 'admin@futbuddies.pt'
)
INSERT INTO inscricoes (jogo_id, utilizador_id, equipa)
SELECT j.id, du.id, CASE WHEN du.rn % 2 = 0 THEN 'A' ELSE 'B' END
FROM jogos j
CROSS JOIN demo_users du
WHERE j.titulo IN ('Pelada de 5ª à noite','Jogo de Domingo no Restelo','Racha do Porto',
                   'Clássico dos Amigos','Pelada de Sábado passado','Torneio relâmpago')
  AND du.rn <= 8
  AND NOT EXISTS (SELECT 1 FROM inscricoes i WHERE i.jogo_id = j.id AND i.utilizador_id = du.id);
GO

-- ── 5. RESULTADOS (jogos concluídos) ─────────────────────────
INSERT INTO resultado_jogo (jogo_id, golos_equipa_a, golos_equipa_b, reportado_por)
SELECT v.jid, v.ga, v.gb, v.rep FROM (
  SELECT (SELECT id FROM jogos WHERE titulo='Pelada de Sábado passado') jid, 4 ga, 3 gb, (SELECT id FROM utilizadores WHERE email='gustavo@futbuddies.com') rep
  UNION ALL
  SELECT (SELECT id FROM jogos WHERE titulo='Torneio relâmpago'),       6,    2,    (SELECT id FROM utilizadores WHERE email='rui.oliveira@futbuddies.com')
) AS v
WHERE v.jid IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM resultado_jogo r WHERE r.jogo_id = v.jid);
GO

-- ── 6. LIGA ENTRE AMIGOS ─────────────────────────────────────
INSERT INTO ligas (nome, criador_id, codigo, tipo, estado, equipa_id, regras, premio)
SELECT 'Liga dos Amigos 2026',
       (SELECT id FROM utilizadores WHERE email='gustavo@futbuddies.com'),
       'AMIGOS', 'mensal', 'ativa',
       (SELECT id FROM equipas WHERE nome='Os Galácticos'),
       '3 pontos por vitória, 1 por empate. Joga-se todas as semanas.',
       'O campeão tem o jantar pago pelos restantes! 🍕'
WHERE NOT EXISTS (SELECT 1 FROM ligas WHERE codigo = 'AMIGOS');
GO

-- Membros da liga
INSERT INTO liga_membros (liga_id, utilizador_id)
SELECT (SELECT id FROM ligas WHERE codigo='AMIGOS'), u.id
FROM utilizadores u
WHERE u.email IN ('gustavo@futbuddies.com','joao.silva@futbuddies.com',
                  'tiago.ferreira@futbuddies.com','nuno.almeida@futbuddies.com')
  AND NOT EXISTS (
    SELECT 1 FROM liga_membros m
     WHERE m.liga_id = (SELECT id FROM ligas WHERE codigo='AMIGOS')
       AND m.utilizador_id = u.id);
GO

PRINT '';
PRINT '============================================';
PRINT '  Dados de demonstracao inseridos!';
PRINT '  Login: gustavo@futbuddies.com / 123456';
PRINT '============================================';
GO
