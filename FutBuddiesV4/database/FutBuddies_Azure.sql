-- ==============================================
-- FutBuddies - Schema consolidado para Azure SQL
-- Gerado por build_azure.ps1
-- ==============================================


-- ==============================================
-- Ficheiro: FutBuddies_SQL_Server.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Script SQL Server Completo
--  Servidor: GUSTALAP\SQLEXPRESS
--  Como usar: Abre no SSMS > Nova Consulta > Executar (F5)
--  Autor: Gustavo Marques - Projeto PAP 2026
-- ============================================================

-- ── 1. Criar Base de Dados ──────────────────────────────────

GO

-- ── 2. Tabela: utilizadores ─────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utilizadores')
BEGIN
    CREATE TABLE utilizadores (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        nome                NVARCHAR(100)   NOT NULL,
        email               NVARCHAR(320)   NOT NULL UNIQUE,
        password_hash       NVARCHAR(255)   NOT NULL,
        role                NVARCHAR(20)    NOT NULL DEFAULT 'user'
                            CHECK (role IN ('user', 'admin')),
        posicao             NVARCHAR(50)    NULL,
        cidade              NVARCHAR(100)   NULL,
        bio                 NVARCHAR(500)   NULL,
        foto_perfil         NVARCHAR(500)   NULL,
        total_jogos         INT             NOT NULL DEFAULT 0,
        total_golos         INT             NOT NULL DEFAULT 0,
        total_assistencias  INT             NOT NULL DEFAULT 0,
        ativo               BIT             NOT NULL DEFAULT 1,
        ultimo_login        DATETIME2       NULL,
        created_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at          DATETIME2       NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT '✅ Tabela utilizadores criada.';
END
GO

-- ── 3. Tabela: jogos ────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'jogos')
BEGIN
    CREATE TABLE jogos (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        titulo          NVARCHAR(150)   NOT NULL,
        descricao       NVARCHAR(1000)  NULL,
        data_jogo       DATETIME2       NOT NULL,
        local           NVARCHAR(200)   NULL,
        tipo_jogo       NVARCHAR(20)    NOT NULL DEFAULT '5x5'
                        CHECK (tipo_jogo IN ('5x5', '7x7', '11x11', 'personalizado')),
        max_jogadores   INT             NOT NULL DEFAULT 10,
        estado          NVARCHAR(20)    NOT NULL DEFAULT 'aberto'
                        CHECK (estado IN ('aberto', 'cheio', 'cancelado', 'concluido')),
        criador_id      INT             NOT NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_jogos_criador FOREIGN KEY (criador_id)
            REFERENCES utilizadores(id) ON DELETE CASCADE
    );
    PRINT '✅ Tabela jogos criada.';
END
GO

-- ── 4. Tabela: inscricoes ───────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'inscricoes')
BEGIN
    CREATE TABLE inscricoes (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id         INT             NOT NULL,
        utilizador_id   INT             NOT NULL,
        equipa          CHAR(1)         NOT NULL DEFAULT 'A'
                        CHECK (equipa IN ('A', 'B')),
        estado          NVARCHAR(20)    NOT NULL DEFAULT 'confirmado'
                        CHECK (estado IN ('confirmado', 'cancelado', 'pendente')),
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_inscricoes_jogo FOREIGN KEY (jogo_id)
            REFERENCES jogos(id) ON DELETE CASCADE,
        CONSTRAINT FK_inscricoes_utilizador FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id),
        CONSTRAINT UQ_inscricao UNIQUE (jogo_id, utilizador_id)
    );
    PRINT '✅ Tabela inscricoes criada.';
END
GO

-- ── 5. Tabela: mensagens_chat ───────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'mensagens_chat')
BEGIN
    CREATE TABLE mensagens_chat (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id         INT             NOT NULL,
        utilizador_id   INT             NOT NULL,
        mensagem        NVARCHAR(500)   NOT NULL,
        tipo            NVARCHAR(20)    NOT NULL DEFAULT 'texto'
                        CHECK (tipo IN ('texto', 'sistema')),
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_chat_jogo FOREIGN KEY (jogo_id)
            REFERENCES jogos(id) ON DELETE CASCADE,
        CONSTRAINT FK_chat_utilizador FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id)
    );
    PRINT '✅ Tabela mensagens_chat criada.';
END
GO

-- ── 6. Tabela: refresh_tokens ───────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'refresh_tokens')
BEGIN
    CREATE TABLE refresh_tokens (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        utilizador_id   INT             NOT NULL,
        token           NVARCHAR(500)   NOT NULL UNIQUE,
        revogado        BIT             NOT NULL DEFAULT 0,
        expires_at      DATETIME2       NOT NULL,
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_tokens_utilizador FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id) ON DELETE CASCADE
    );
    PRINT '✅ Tabela refresh_tokens criada.';
END
GO

-- ── 7. Índices de performance ───────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_jogos_estado_data')
    CREATE INDEX IX_jogos_estado_data ON jogos(estado, data_jogo);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_inscricoes_jogo')
    CREATE INDEX IX_inscricoes_jogo ON inscricoes(jogo_id, estado);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_chat_jogo')
    CREATE INDEX IX_chat_jogo ON mensagens_chat(jogo_id, created_at DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_tokens_utilizador')
    CREATE INDEX IX_tokens_utilizador ON refresh_tokens(utilizador_id, revogado);

PRINT '✅ Índices criados.';
GO

-- ── 8. Stored Procedures ────────────────────────────────────

-- SP: Inscrever jogador num jogo
CREATE OR ALTER PROCEDURE sp_InscreverJogador
    @jogoId         INT,
    @utilizadorId   INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @maxJogadores INT, @totalInscritos INT, @estado NVARCHAR(20);
    DECLARE @equipaA INT, @equipaB INT, @equipa CHAR(1);

    -- Verificar jogo
    SELECT @maxJogadores = max_jogadores, @estado = estado
    FROM jogos WHERE id = @jogoId;

    IF @maxJogadores IS NULL
    BEGIN
        SELECT 0 AS sucesso, 'Jogo não encontrado.' AS mensagem;
        RETURN;
    END

    IF @estado <> 'aberto'
    BEGIN
        SELECT 0 AS sucesso, 'Jogo não está aberto para inscrições.' AS mensagem;
        RETURN;
    END

    -- Contar inscritos
    SELECT @totalInscritos = COUNT(*) FROM inscricoes
    WHERE jogo_id = @jogoId AND estado = 'confirmado';

    IF @totalInscritos >= @maxJogadores
    BEGIN
        SELECT 0 AS sucesso, 'Jogo sem vagas disponíveis.' AS mensagem;
        RETURN;
    END

    -- Verificar se já inscrito
    IF EXISTS (SELECT 1 FROM inscricoes WHERE jogo_id = @jogoId AND utilizador_id = @utilizadorId)
    BEGIN
        SELECT 0 AS sucesso, 'Já estás inscrito neste jogo.' AS mensagem;
        RETURN;
    END

    -- Determinar equipa
    SELECT @equipaA = COUNT(*) FROM inscricoes WHERE jogo_id = @jogoId AND equipa = 'A' AND estado = 'confirmado';
    SELECT @equipaB = COUNT(*) FROM inscricoes WHERE jogo_id = @jogoId AND equipa = 'B' AND estado = 'confirmado';

    SET @equipa = CASE WHEN @equipaA <= @equipaB THEN 'A' ELSE 'B' END;

    -- Inserir inscrição
    INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado, created_at)
    VALUES (@jogoId, @utilizadorId, @equipa, 'confirmado', GETUTCDATE());

    -- Verificar se ficou cheio
    IF (@totalInscritos + 1) >= @maxJogadores
        UPDATE jogos SET estado = 'cheio', updated_at = GETUTCDATE() WHERE id = @jogoId;

    -- Atualizar estatísticas
    UPDATE utilizadores SET total_jogos = total_jogos + 1 WHERE id = @utilizadorId;

    SELECT 1 AS sucesso, 'Inscrito na Equipa ' + @equipa + '!' AS mensagem, @equipa AS equipa;
END
GO

-- SP: Estatísticas do dashboard admin
CREATE OR ALTER PROCEDURE sp_DashboardStats
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        (SELECT COUNT(*) FROM utilizadores)                                 AS total_utilizadores,
        (SELECT COUNT(*) FROM utilizadores WHERE ativo = 1)                 AS utilizadores_ativos,
        (SELECT COUNT(*) FROM jogos)                                        AS total_jogos,
        (SELECT COUNT(*) FROM jogos WHERE estado = 'aberto')                AS jogos_abertos,
        (SELECT COUNT(*) FROM jogos WHERE estado = 'cheio')                 AS jogos_cheios,
        (SELECT COUNT(*) FROM inscricoes WHERE estado = 'confirmado')       AS total_inscricoes,
        (SELECT COUNT(*) FROM mensagens_chat)                               AS total_mensagens,
        (SELECT COUNT(*) FROM utilizadores WHERE created_at >= DATEADD(DAY, -7, GETUTCDATE())) AS novos_esta_semana;
END
GO

PRINT '✅ Stored Procedures criadas.';
GO

-- ── 9. Dados de Exemplo ─────────────────────────────────────
-- Password para todos: FutBuddies2026! (hash bcrypt)
DECLARE @hashAdmin NVARCHAR(255) = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMqJqhcanFp8RFjXHPelkth3Oe';

-- Utilizador Admin
IF NOT EXISTS (SELECT 1 FROM utilizadores WHERE email = 'admin@futbuddies.pt')
BEGIN
    INSERT INTO utilizadores (nome, email, password_hash, role, posicao, cidade, bio, total_jogos, total_golos)
    VALUES (
        'Admin FutBuddies',
        'admin@futbuddies.pt',
        @hashAdmin,
        'admin',
        'Médio',
        'Lisboa',
        'Administrador da plataforma FutBuddies.',
        15, 8
    );
    PRINT '✅ Utilizador admin criado: admin@futbuddies.pt / FutBuddies2026!';
END

-- Utilizador de teste 1
IF NOT EXISTS (SELECT 1 FROM utilizadores WHERE email = 'joao@futbuddies.pt')
BEGIN
    INSERT INTO utilizadores (nome, email, password_hash, role, posicao, cidade, total_jogos, total_golos)
    VALUES ('João Silva', 'joao@futbuddies.pt', @hashAdmin, 'user', 'Avançado', 'Porto', 12, 7);
    PRINT '✅ Utilizador joao@futbuddies.pt criado.';
END

-- Utilizador de teste 2
IF NOT EXISTS (SELECT 1 FROM utilizadores WHERE email = 'maria@futbuddies.pt')
BEGIN
    INSERT INTO utilizadores (nome, email, password_hash, role, posicao, cidade, total_jogos, total_golos)
    VALUES ('Maria Santos', 'maria@futbuddies.pt', @hashAdmin, 'user', 'Defesa', 'Braga', 8, 2);
    PRINT '✅ Utilizador maria@futbuddies.pt criado.';
END
GO

-- Jogos de exemplo
DECLARE @adminId INT = (SELECT id FROM utilizadores WHERE email = 'admin@futbuddies.pt');
DECLARE @joaoId  INT = (SELECT id FROM utilizadores WHERE email = 'joao@futbuddies.pt');

IF NOT EXISTS (SELECT 1 FROM jogos WHERE titulo = 'Jogo de Quinta-feira')
BEGIN
    INSERT INTO jogos (titulo, descricao, data_jogo, local, tipo_jogo, max_jogadores, estado, criador_id)
    VALUES (
        'Jogo de Quinta-feira',
        'Jogo amigável semanal. Todos os níveis bem-vindos!',
        DATEADD(DAY, 3, CAST(GETUTCDATE() AS DATE)),
        'Campo Municipal de Lisboa',
        '5x5', 10, 'aberto', @adminId
    );

    INSERT INTO jogos (titulo, descricao, data_jogo, local, tipo_jogo, max_jogadores, estado, criador_id)
    VALUES (
        'Torneio de Sábado',
        'Torneio 7x7 com prémios para a equipa vencedora.',
        DATEADD(DAY, 5, CAST(GETUTCDATE() AS DATE)),
        'Estádio Municipal do Porto',
        '7x7', 14, 'aberto', @joaoId
    );

    INSERT INTO jogos (titulo, descricao, data_jogo, local, tipo_jogo, max_jogadores, estado, criador_id)
    VALUES (
        'Pelada de Domingo',
        'Jogo casual para relaxar ao fim de semana.',
        DATEADD(DAY, 7, CAST(GETUTCDATE() AS DATE)),
        'Parque da Cidade, Porto',
        '5x5', 10, 'aberto', @joaoId
    );

    PRINT '✅ Jogos de exemplo criados.';
END
GO

-- Inscrições de exemplo
DECLARE @jogo1 INT = (SELECT TOP 1 id FROM jogos WHERE titulo = 'Jogo de Quinta-feira');
DECLARE @jogo2 INT = (SELECT TOP 1 id FROM jogos WHERE titulo = 'Torneio de Sábado');
DECLARE @adminId2 INT = (SELECT id FROM utilizadores WHERE email = 'admin@futbuddies.pt');
DECLARE @joaoId2  INT = (SELECT id FROM utilizadores WHERE email = 'joao@futbuddies.pt');
DECLARE @mariaId  INT = (SELECT id FROM utilizadores WHERE email = 'maria@futbuddies.pt');

IF @jogo1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM inscricoes WHERE jogo_id = @jogo1 AND utilizador_id = @adminId2)
BEGIN
    INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado) VALUES (@jogo1, @adminId2, 'A', 'confirmado');
    INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado) VALUES (@jogo1, @joaoId2, 'B', 'confirmado');
    INSERT INTO inscricoes (jogo_id, utilizador_id, equipa, estado) VALUES (@jogo1, @mariaId, 'A', 'confirmado');

    INSERT INTO mensagens_chat (jogo_id, utilizador_id, mensagem, tipo)
    VALUES (@jogo1, @adminId2, 'Olá pessoal! Alguém traz bola?', 'texto');
    INSERT INTO mensagens_chat (jogo_id, utilizador_id, mensagem, tipo)
    VALUES (@jogo1, @joaoId2, 'Eu trago! Até quinta 💪', 'texto');

    PRINT '✅ Inscrições e mensagens de exemplo criadas.';
END
GO

-- ── 10. Verificação final ────────────────────────────────────
PRINT '';
PRINT '============================================';
PRINT '  FutBuddies - Base de dados configurada!';
PRINT '============================================';
PRINT '';
PRINT 'Tabelas criadas:';
SELECT TABLE_NAME AS Tabela FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME;

PRINT '';
PRINT 'Credenciais de teste:';
PRINT '  admin@futbuddies.pt  / FutBuddies2026!  (Admin)';
PRINT '  joao@futbuddies.pt   / FutBuddies2026!  (User)';
PRINT '  maria@futbuddies.pt  / FutBuddies2026!  (User)';
PRINT '';
PRINT 'String de ligação para o .env do backend:';
PRINT '  DB_SERVER=GUSTALAP\SQLEXPRESS';
PRINT '  DB_NAME=FutBuddies';
PRINT '  DB_WINDOWS_AUTH=true';
GO

GO
GO
-- (CREATE USER/ALTER ROLE removidos — Azure SQL: futadmin já tem db_owner)

INSERT INTO utilizadores (
    nome,
    email,
    password_hash,
    role,
    ativo,
    posicao,
    cidade,
    bio,
    total_jogos,
    total_golos,
    total_assistencias,
    created_at,
    updated_at
)
VALUES (
    'Administrador',
    'admin@futbuddies.com',
    '$2a$12$D6K9R3z5Q9vXfL8J7n6E7e0pG2O7m5S4u5Y6y7z8A9B1C2D3E4F5G',
    'admin',
    1,
    'Admin',
    'Lisboa',
    'Conta mestre de administração.',
    0,
    0,
    0,
    GETUTCDATE(),
    GETUTCDATE()
);
GO


-- ==============================================
-- Ficheiro: FutBuddies_Amigos.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Sistema de Amigos e Mensagens Privadas
--  Migração para SQL Server
-- ============================================================

-- Amizades (friendships)
CREATE TABLE amizades (
  id INT IDENTITY(1,1) PRIMARY KEY,
  remetente_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  destinatario_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  estado VARCHAR(20) DEFAULT 'pendente', -- pendente, aceite, rejeitado
  created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Mensagens privadas
CREATE TABLE mensagens_privadas (
  id INT IDENTITY(1,1) PRIMARY KEY,
  remetente_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  destinatario_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  mensagem NVARCHAR(1000) NOT NULL,
  lida BIT DEFAULT 0,
  created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v2.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Script de Migração v2
--  Executa este script DEPOIS do script original
--  Adiciona: jogos privados, regiões, equipas, perfil melhorado
-- ============================================================

GO

-- ── 1. Colunas novas na tabela utilizadores ──────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'nickname')
    ALTER TABLE utilizadores ADD nickname NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'pe_preferido')
    ALTER TABLE utilizadores ADD pe_preferido NVARCHAR(20) NULL
        CONSTRAINT CHK_pe CHECK (pe_preferido IN ('Destro', 'Canhoto', 'Ambidiestro') OR pe_preferido IS NULL);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'regiao')
    ALTER TABLE utilizadores ADD regiao NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('utilizadores') AND name = 'foto_url')
    ALTER TABLE utilizadores ADD foto_url NVARCHAR(500) NULL;

PRINT '✅ Colunas adicionadas a utilizadores.';
GO

-- ── 2. Colunas novas na tabela jogos ────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'visibilidade')
    ALTER TABLE jogos ADD visibilidade NVARCHAR(10) NOT NULL DEFAULT 'publico'
        CONSTRAINT CHK_visibilidade CHECK (visibilidade IN ('publico', 'privado'));

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'regiao')
    ALTER TABLE jogos ADD regiao NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'nivel')
    ALTER TABLE jogos ADD nivel NVARCHAR(20) NULL
        CONSTRAINT CHK_nivel CHECK (nivel IN ('Descontraído', 'Intermédio', 'Competitivo') OR nivel IS NULL);

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'codigo_acesso')
    ALTER TABLE jogos ADD codigo_acesso NVARCHAR(20) NULL;

PRINT '✅ Colunas adicionadas a jogos.';
GO

-- ── 3. Tabela: equipas ───────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'equipas')
BEGIN
    CREATE TABLE equipas (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        nome            NVARCHAR(100)   NOT NULL,
        emblema         NVARCHAR(10)    NOT NULL DEFAULT '⚽',
        descricao       NVARCHAR(500)   NULL,
        nivel           NVARCHAR(20)    NOT NULL DEFAULT 'Descontraído'
                        CHECK (nivel IN ('Descontraído', 'Intermédio', 'Competitivo')),
        regiao          NVARCHAR(100)   NULL,
        capitao_id      INT             NOT NULL,
        a_recrutar      BIT             NOT NULL DEFAULT 0,
        total_jogos     INT             NOT NULL DEFAULT 0,
        vitorias        INT             NOT NULL DEFAULT 0,
        derrotas        INT             NOT NULL DEFAULT 0,
        empates         INT             NOT NULL DEFAULT 0,
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_equipas_capitao FOREIGN KEY (capitao_id)
            REFERENCES utilizadores(id)
    );
    PRINT '✅ Tabela equipas criada.';
END
GO

-- ── 4. Tabela: equipa_membros ────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'equipa_membros')
BEGIN
    CREATE TABLE equipa_membros (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        equipa_id       INT             NOT NULL,
        utilizador_id   INT             NOT NULL,
        papel           NVARCHAR(20)    NOT NULL DEFAULT 'membro'
                        CHECK (papel IN ('capitao', 'membro')),
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_membros_equipa FOREIGN KEY (equipa_id)
            REFERENCES equipas(id) ON DELETE CASCADE,
        CONSTRAINT FK_membros_utilizador FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id),
        CONSTRAINT UQ_membro UNIQUE (equipa_id, utilizador_id)
    );
    PRINT '✅ Tabela equipa_membros criada.';
END
GO

-- ── 5. Índices novos ─────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_jogos_visibilidade')
    CREATE INDEX IX_jogos_visibilidade ON jogos(visibilidade, estado, data_jogo);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_jogos_regiao')
    CREATE INDEX IX_jogos_regiao ON jogos(regiao);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_equipas_regiao')
    CREATE INDEX IX_equipas_regiao ON equipas(regiao);

PRINT '✅ Índices criados.';
GO

-- ── 6. Regiões de Portugal ────────────────────────────────────
-- (Usadas nos filtros de jogos e equipas)
-- Não precisam de tabela própria — são usadas como NVARCHAR

PRINT '';
PRINT '============================================';
PRINT '  FutBuddies - Migração v2 concluída!';
PRINT '============================================';
PRINT 'Novas colunas: visibilidade, regiao, nivel, codigo_acesso (jogos)';
PRINT 'Novas colunas: nickname, pe_preferido, regiao, foto_url (utilizadores)';
PRINT 'Novas tabelas: equipas, equipa_membros';
GO
-- ── Aumentar coluna emblema para suportar URLs de imagem ──
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'equipas')
BEGIN
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('equipas') AND name='emblema')
    BEGIN
        ALTER TABLE equipas ALTER COLUMN emblema NVARCHAR(500) NOT NULL;
        PRINT '✅ Coluna emblema atualizada para NVARCHAR(500).';
    END
END
GO

-- ==============================================
-- Ficheiro: FutBuddies_Equipas_v3.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Migração Equipas v3
--  Adiciona: visibilidade, código de acesso, pedidos de entrada
-- ============================================================

GO

-- ── 1. Novas colunas na tabela equipas ──────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('equipas') AND name = 'visibilidade')
    ALTER TABLE equipas ADD visibilidade NVARCHAR(10) NOT NULL DEFAULT 'publica';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('equipas') AND name = 'codigo_acesso')
    ALTER TABLE equipas ADD codigo_acesso NVARCHAR(20) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('equipas') AND name = 'aceitar_pedidos')
    ALTER TABLE equipas ADD aceitar_pedidos BIT NOT NULL DEFAULT 0;

PRINT '  Colunas adicionadas a equipas.';
GO

-- ── 2. Tabela: pedidos_equipa ────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'pedidos_equipa')
BEGIN
    CREATE TABLE pedidos_equipa (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        equipa_id       INT NOT NULL FOREIGN KEY REFERENCES equipas(id) ON DELETE CASCADE,
        utilizador_id   INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
        estado          NVARCHAR(20) NOT NULL DEFAULT 'pendente',
        created_at      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_pedido_equipa UNIQUE (equipa_id, utilizador_id)
    );
    PRINT '  Tabela pedidos_equipa criada.';
END
GO

PRINT '';
PRINT '============================================';
PRINT '  FutBuddies - Migração Equipas v3 concluída!';
PRINT '============================================';
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v4.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Migra o v4
--  Chat de Equipa + Jogos de Equipa + Admin de Equipa
-- ============================================================

GO

-- ── 1. Chat de Equipa ────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'mensagens_equipa')
BEGIN
    CREATE TABLE mensagens_equipa (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        equipa_id       INT NOT NULL REFERENCES equipas(id),
        utilizador_id   INT NOT NULL REFERENCES utilizadores(id),
        mensagem        NVARCHAR(500) NOT NULL,
        tipo            NVARCHAR(20) DEFAULT 'texto',
        created_at      DATETIME2 DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_mensagens_equipa_sala ON mensagens_equipa(equipa_id, created_at DESC);
    PRINT 'Tabela mensagens_equipa criada.';
END
GO

-- ── 2. Jogos de Equipa ───────────────────────────────────────
-- Adicionar modo_jogo  jogos (individual ou equipa)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'modo_jogo')
BEGIN
    ALTER TABLE jogos ADD modo_jogo NVARCHAR(20) DEFAULT 'individual';
    PRINT 'Coluna modo_jogo adicionada a jogos.';
END
GO

-- Tabela de inscri es de equipas em jogos de equipa
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'inscricoes_equipa')
BEGIN
    CREATE TABLE inscricoes_equipa (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id     INT NOT NULL REFERENCES jogos(id),
        equipa_id   INT NOT NULL REFERENCES equipas(id),
        lado        NVARCHAR(1) NOT NULL CHECK (lado IN ('A', 'B')),
        estado      NVARCHAR(20) DEFAULT 'confirmado',
        created_at  DATETIME2 DEFAULT GETUTCDATE(),
        CONSTRAINT UQ_inscricao_equipa UNIQUE (jogo_id, equipa_id)
    );
    PRINT 'Tabela inscricoes_equipa criada.';
END
GO

PRINT '========================================';
PRINT '  Migracao v4 concluida com sucesso!';
PRINT '========================================';

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v5.sql
-- ==============================================
-- ============================================================
--  FutBuddies — Migração v5
--  Adiciona: notificacoes, notas_admin
--  (resultado_jogo / resultado_pessoal ficam para Fase C)
-- ============================================================

GO

-- ── 1. Tabela: notificacoes ─────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notificacoes')
BEGIN
    CREATE TABLE notificacoes (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        utilizador_id   INT             NOT NULL,
        tipo            NVARCHAR(30)    NOT NULL
                        CHECK (tipo IN ('resultado_jogo', 'resultado_pessoal', 'nota_admin', 'sistema')),
        titulo          NVARCHAR(120)   NOT NULL,
        mensagem        NVARCHAR(500)   NULL,
        jogo_id         INT             NULL,
        equipa_id       INT             NULL,
        acao_url        NVARCHAR(200)   NULL,
        lida            BIT             NOT NULL DEFAULT 0,
        respondida      BIT             NOT NULL DEFAULT 0,
        created_at      DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        expira_em       DATETIME2       NULL,
        CONSTRAINT FK_notif_utilizador FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id) ON DELETE CASCADE,
        CONSTRAINT FK_notif_jogo FOREIGN KEY (jogo_id)
            REFERENCES jogos(id),
        CONSTRAINT FK_notif_equipa FOREIGN KEY (equipa_id)
            REFERENCES equipas(id)
    );
    PRINT '✅ Tabela notificacoes criada.';
END
ELSE
    PRINT '⚠️  Tabela notificacoes já existia — ignorada.';
GO

-- ── 2. Índices úteis para a caixa de notificações ───────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notif_utilizador_lida')
    CREATE INDEX IX_notif_utilizador_lida
        ON notificacoes(utilizador_id, lida, created_at DESC);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_notif_jogo')
    CREATE INDEX IX_notif_jogo ON notificacoes(jogo_id);

PRINT '✅ Índices de notificacoes criados.';
GO

-- ── 3. Tabela: notas_admin ──────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'notas_admin')
BEGIN
    CREATE TABLE notas_admin (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        admin_id    INT             NOT NULL,
        titulo      NVARCHAR(120)   NOT NULL,
        mensagem    NVARCHAR(1000)  NOT NULL,
        expira_em   DATETIME2       NULL,
        created_at  DATETIME2       NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_notas_admin_autor FOREIGN KEY (admin_id)
            REFERENCES utilizadores(id)
    );
    PRINT '✅ Tabela notas_admin criada.';
END
ELSE
    PRINT '⚠️  Tabela notas_admin já existia — ignorada.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v5 concluída com sucesso!';
PRINT '============================================';
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v6.sql
-- ==============================================
-- ============================================================
--  FutBuddies — Migração v6 (Fase C)
--  Adiciona: resultado_jogo, resultado_pessoal
-- ============================================================

GO

-- ── 1. Tabela: resultado_jogo ───────────────────────────────
-- Resultado oficial do jogo (um por jogo, reportado pelo criador).
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'resultado_jogo')
BEGIN
    CREATE TABLE resultado_jogo (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id         INT         NOT NULL UNIQUE,
        golos_equipa_a  INT         NOT NULL CHECK (golos_equipa_a >= 0),
        golos_equipa_b  INT         NOT NULL CHECK (golos_equipa_b >= 0),
        reportado_por   INT         NOT NULL,
        created_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_resjogo_jogo FOREIGN KEY (jogo_id)
            REFERENCES jogos(id) ON DELETE CASCADE,
        CONSTRAINT FK_resjogo_user FOREIGN KEY (reportado_por)
            REFERENCES utilizadores(id)
    );
    PRINT '✅ Tabela resultado_jogo criada.';
END
ELSE
    PRINT '⚠️  Tabela resultado_jogo já existia — ignorada.';
GO

-- ── 2. Tabela: resultado_pessoal ────────────────────────────
-- Golos/assistências auto-reportados pelos participantes.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'resultado_pessoal')
BEGIN
    CREATE TABLE resultado_pessoal (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id         INT         NOT NULL,
        utilizador_id   INT         NOT NULL,
        golos           INT         NOT NULL DEFAULT 0 CHECK (golos >= 0),
        assistencias    INT         NOT NULL DEFAULT 0 CHECK (assistencias >= 0),
        created_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_respess_jogo FOREIGN KEY (jogo_id)
            REFERENCES jogos(id) ON DELETE CASCADE,
        CONSTRAINT FK_respess_user FOREIGN KEY (utilizador_id)
            REFERENCES utilizadores(id),
        CONSTRAINT UQ_respess UNIQUE (jogo_id, utilizador_id)
    );
    PRINT '✅ Tabela resultado_pessoal criada.';
END
ELSE
    PRINT '⚠️  Tabela resultado_pessoal já existia — ignorada.';
GO

-- ── 3. Índices ──────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_respess_utilizador')
    CREATE INDEX IX_respess_utilizador
        ON resultado_pessoal(utilizador_id, jogo_id);

PRINT '✅ Índices de resultados criados.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v6 concluída com sucesso!';
PRINT '============================================';
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v7.sql
-- ==============================================
-- ============================================================
--  FutBuddies — Migração v7
--  Adiciona: perfil_publico (privacidade do perfil)
-- ============================================================

GO

IF NOT EXISTS (SELECT * FROM sys.columns
               WHERE object_id = OBJECT_ID('utilizadores') AND name = 'perfil_publico')
BEGIN
    ALTER TABLE utilizadores
        ADD perfil_publico BIT NOT NULL CONSTRAINT DF_util_perfil_publico DEFAULT 1;
    PRINT '✅ Coluna perfil_publico adicionada em utilizadores.';
END
ELSE
    PRINT '⚠️  Coluna perfil_publico já existia — ignorada.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v7 concluída com sucesso!';
PRINT '============================================';
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v8.sql
-- ==============================================
-- ============================================================
--  FutBuddies — Migração v8 (Fase D)
--  Campos parceiros · Stripe Connect · Pagamentos · Crowdfunding
-- ============================================================

GO

-- ── 1. Contas Stripe Connect (donos de campo) ───────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stripe_connect_accounts')
BEGIN
    CREATE TABLE stripe_connect_accounts (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        utilizador_id       INT         NOT NULL UNIQUE,
        stripe_account_id   VARCHAR(64) NOT NULL,
        status              VARCHAR(40) NOT NULL DEFAULT 'pendente',
                            -- 'pendente' | 'ativo' | 'acao_necessaria' | 'rejeitado'
        details_submitted   BIT         NOT NULL DEFAULT 0,
        charges_enabled     BIT         NOT NULL DEFAULT 0,
        payouts_enabled     BIT         NOT NULL DEFAULT 0,
        requirements_json   NVARCHAR(MAX) NULL,
        created_at          DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        updated_at          DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_sca_user FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
    );
    PRINT '✅ Tabela stripe_connect_accounts criada.';
END ELSE PRINT '⚠️  stripe_connect_accounts já existia.';
GO

-- ── 2. Campos (recintos dos donos) ──────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'campos')
BEGIN
    CREATE TABLE campos (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        dono_id         INT         NOT NULL,
        nome            NVARCHAR(120) NOT NULL,
        foto_url        NVARCHAR(500) NULL,
        tipo_piso       VARCHAR(40) NULL,         -- 'relvado', 'sintetico', 'pavilhao', etc.
        morada          NVARCHAR(250) NULL,
        regiao          NVARCHAR(100) NULL,
        preco_hora_cents INT         NOT NULL DEFAULT 0, -- Preço total /hora em cêntimos
        duracao_min     INT         NOT NULL DEFAULT 60, -- Duração padrão da reserva
        ativo           BIT         NOT NULL DEFAULT 1,
        created_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        updated_at      DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_campos_dono FOREIGN KEY (dono_id) REFERENCES utilizadores(id)
    );
    CREATE INDEX IX_campos_dono ON campos(dono_id);
    CREATE INDEX IX_campos_regiao ON campos(regiao);
    PRINT '✅ Tabela campos criada.';
END ELSE PRINT '⚠️  campos já existia.';
GO

-- ── 3. Bloqueios manuais do dono ────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'campo_bloqueios')
BEGIN
    CREATE TABLE campo_bloqueios (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        campo_id    INT         NOT NULL,
        inicio      DATETIME2   NOT NULL,
        fim         DATETIME2   NOT NULL,
        motivo      NVARCHAR(200) NULL,
        created_at  DATETIME2   NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_bloq_campo FOREIGN KEY (campo_id) REFERENCES campos(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_bloq_campo ON campo_bloqueios(campo_id, inicio);
    PRINT '✅ Tabela campo_bloqueios criada.';
END ELSE PRINT '⚠️  campo_bloqueios já existia.';
GO

-- ── 4. Extensão à tabela jogos ──────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('jogos') AND name = 'tipo_local')
BEGIN
    ALTER TABLE jogos ADD
        tipo_local           VARCHAR(20) NOT NULL CONSTRAINT DF_jogos_tipo_local DEFAULT 'publico',
                             -- 'publico' | 'parceiro'
        campo_id             INT NULL,
        modelo_pagamento     VARCHAR(20) NULL,
                             -- NULL (gratuito) | 'total' | 'dividido'
        preco_total_cents    INT NULL,
        preco_por_jogador_cents INT NULL,
        reserva_estado       VARCHAR(20) NULL,
                             -- NULL | 'pendente' | 'confirmada' | 'cancelada' | 'expirada'
        deadline_pagamento   DATETIME2 NULL;
    PRINT '✅ Colunas de reserva/pagamento adicionadas em jogos.';
END ELSE PRINT '⚠️  Colunas de jogos já existiam.';
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_jogos_campo')
    ALTER TABLE jogos ADD CONSTRAINT FK_jogos_campo
        FOREIGN KEY (campo_id) REFERENCES campos(id);
GO

-- ── 5. Pagamentos ───────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'pagamentos')
BEGIN
    CREATE TABLE pagamentos (
        id                       INT IDENTITY(1,1) PRIMARY KEY,
        jogo_id                  INT         NOT NULL,
        utilizador_id            INT         NOT NULL,
        valor_cents              INT         NOT NULL,        -- Valor cobrado ao jogador
        application_fee_cents    INT         NOT NULL DEFAULT 0, -- Comissão FutBuddies
        stripe_payment_intent_id VARCHAR(120) NULL,
        stripe_charge_id         VARCHAR(120) NULL,
        stripe_account_destino   VARCHAR(64)  NULL,           -- acct_xxx do dono
        status                   VARCHAR(30)  NOT NULL DEFAULT 'pending',
                                -- 'pending' | 'succeeded' | 'refunded' | 'failed' | 'canceled'
        refund_id                VARCHAR(120) NULL,
        metadata_json            NVARCHAR(MAX) NULL,
        created_at               DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
        updated_at               DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_pag_jogo  FOREIGN KEY (jogo_id)       REFERENCES jogos(id) ON DELETE CASCADE,
        CONSTRAINT FK_pag_user  FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
    );
    CREATE INDEX IX_pag_jogo ON pagamentos(jogo_id, status);
    CREATE INDEX IX_pag_user ON pagamentos(utilizador_id, created_at DESC);
    CREATE INDEX IX_pag_pi   ON pagamentos(stripe_payment_intent_id);
    PRINT '✅ Tabela pagamentos criada.';
END ELSE PRINT '⚠️  pagamentos já existia.';
GO

-- ── 6. Webhook events (idempotência) ────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'stripe_events')
BEGIN
    CREATE TABLE stripe_events (
        id              VARCHAR(80) PRIMARY KEY,  -- evt_xxx
        tipo            VARCHAR(80) NOT NULL,
        processado_em   DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    PRINT '✅ Tabela stripe_events criada.';
END ELSE PRINT '⚠️  stripe_events já existia.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v8 concluída com sucesso!';
PRINT '============================================';
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v9.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Migração v9
--  • user_role (PLAYER | FIELD_OWNER) na tabela utilizadores
--  • Tabela campo_candidaturas (processo de verificação)
--  • Coluna campos.estado (pendente_aprovacao | ativo | rejeitado)
-- ============================================================

-- 1. user_role em utilizadores ------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('utilizadores') AND name='user_role')
BEGIN
    ALTER TABLE utilizadores ADD user_role VARCHAR(20) NOT NULL DEFAULT 'PLAYER';
END
GO

-- 2. campos.estado ------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='estado')
BEGIN
    ALTER TABLE campos ADD estado VARCHAR(30) NOT NULL DEFAULT 'ativo';
END
GO
-- Campos já existentes ficam 'ativo' (não partir dados)

-- 3. Tabela de candidaturas ---------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='campo_candidaturas')
BEGIN
    CREATE TABLE campo_candidaturas (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        utilizador_id  INT NOT NULL,
        nome           NVARCHAR(120) NOT NULL,
        tipo_piso      VARCHAR(40)   NULL,
        morada         NVARCHAR(200) NULL,
        regiao         NVARCHAR(80)  NULL,
        telefone       VARCHAR(40)   NULL,
        preco_hora_cents INT NULL,
        duracao_min      INT NULL DEFAULT 60,
        fotos_json     NVARCHAR(MAX) NULL,    -- JSON array de URLs
        prova_url      NVARCHAR(400) NULL,    -- fatura / licença / foto do local
        nota_candidato NVARCHAR(MAX) NULL,
        estado         VARCHAR(30) NOT NULL DEFAULT 'pendente',
                       -- pendente | aprovada | rejeitada | info_requerida
        nota_admin     NVARCHAR(MAX) NULL,
        campo_id       INT NULL,              -- preenchido quando aprovada
        revisto_por    INT NULL,
        revisto_em     DATETIME2 NULL,
        created_at     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updated_at     DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_cand_user  FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id),
        CONSTRAINT FK_cand_campo FOREIGN KEY (campo_id) REFERENCES campos(id),
        CONSTRAINT FK_cand_admin FOREIGN KEY (revisto_por) REFERENCES utilizadores(id)
    );
    CREATE INDEX IX_cand_estado ON campo_candidaturas(estado);
    CREATE INDEX IX_cand_user   ON campo_candidaturas(utilizador_id);
END
GO

PRINT '✅ Migração v9 aplicada.';

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v10.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Migração v10
--  - Tabela de mensagens de suporte (inbox admin)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'suporte_mensagens')
BEGIN
  CREATE TABLE suporte_mensagens (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    utilizador_id   INT NULL,          -- NULL se anónimo
    nome            NVARCHAR(120) NULL,
    email           NVARCHAR(180) NULL,
    assunto         NVARCHAR(200) NOT NULL,
    mensagem        NVARCHAR(MAX) NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'aberta', -- aberta|em_analise|resolvida|arquivada
    resposta_admin  NVARCHAR(MAX) NULL,
    respondida_por  INT NULL,
    respondida_em   DATETIME2 NULL,
    created_at      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupMsg_User  FOREIGN KEY (utilizador_id)  REFERENCES utilizadores(id) ON DELETE SET NULL,
    CONSTRAINT FK_SupMsg_Admin FOREIGN KEY (respondida_por) REFERENCES utilizadores(id) ON DELETE NO ACTION
  );
  CREATE INDEX IX_suporte_estado   ON suporte_mensagens(estado, created_at DESC);
  CREATE INDEX IX_suporte_user     ON suporte_mensagens(utilizador_id);
END
GO

-- ==============================================
-- Ficheiro: FutBuddies_Migracao_v11.sql
-- ==============================================
-- ============================================================
--  FutBuddies - Migração v11
--  ★ Horários dinâmicos de campos + lotação configurável
--  ★ Reservas com slot fixo por campo
--  ★ Pagamento por equipa (50/50) em jogos
-- ============================================================
SET NOCOUNT ON;

-- ── 1. CAMPOS: horários + lotações ───────────────────────────
-- hora_abertura / hora_fecho: minutos desde 00:00 (ex: 600 = 10:00)
-- dias_semana_json: array ISO (1=segunda..7=domingo), ex: [1,2,3,4,5,6,7]
-- slot_min: granularidade dos horários (ex: 60 = slots de hora a hora)
-- lotacoes_json: lotações permitidas (ex: [5,6,7] → 5x5/6x6/7x7)
--              define o MÁX de jogadores = max(lotacao)*2

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='hora_abertura')
  ALTER TABLE campos ADD hora_abertura INT NOT NULL DEFAULT 480;   -- 08:00
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='hora_fecho')
  ALTER TABLE campos ADD hora_fecho INT NOT NULL DEFAULT 1380;     -- 23:00
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='dias_semana_json')
  ALTER TABLE campos ADD dias_semana_json NVARCHAR(100) NOT NULL DEFAULT '[1,2,3,4,5,6,7]';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='slot_min')
  ALTER TABLE campos ADD slot_min INT NOT NULL DEFAULT 60;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='lotacoes_json')
  ALTER TABLE campos ADD lotacoes_json NVARCHAR(100) NOT NULL DEFAULT '[5,7]';
GO
PRINT '✅ campos: horário + lotação adicionados.';

-- ── 2. CANDIDATURAS: mesmos campos para o dono indicar à partida
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='hora_abertura')
  ALTER TABLE campo_candidaturas ADD hora_abertura INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='hora_fecho')
  ALTER TABLE campo_candidaturas ADD hora_fecho INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='dias_semana_json')
  ALTER TABLE campo_candidaturas ADD dias_semana_json NVARCHAR(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='lotacoes_json')
  ALTER TABLE campo_candidaturas ADD lotacoes_json NVARCHAR(100) NULL;
GO

-- ── 3. JOGOS: lotação escolhida + modo 'por_equipa'
-- formato_lotacao: ex 5, 6, 7 (lado do jogo). Jogadores totais = formato*2
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('jogos') AND name='formato_lotacao')
  ALTER TABLE jogos ADD formato_lotacao INT NULL;
GO

-- Nota: modelo_pagamento aceita agora também 'por_equipa' (além de 'total' / 'dividido')
-- SQL Server não tem ENUM — não é preciso alterar a coluna, só permitir o novo valor no backend.

-- ── 4. Inscrição em equipa (para modo por_equipa)
-- equipa_escolha: 'A' ou 'B' na tabela inscricoes (ou similar). Criamos se não existir.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='inscricoes')
BEGIN
  PRINT '⚠️  tabela inscricoes não encontrada — salta equipa_escolha.';
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('inscricoes') AND name='equipa_escolha')
    EXEC('ALTER TABLE inscricoes ADD equipa_escolha CHAR(1) NULL;');  -- ''A'' | ''B'' | NULL
END
GO
PRINT '✅ inscricoes: coluna equipa_escolha.';

-- ── 5. Pagamentos: marcar a equipa a que pertence (para modo por_equipa)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('pagamentos') AND name='equipa_escolha')
  ALTER TABLE pagamentos ADD equipa_escolha CHAR(1) NULL;
GO
PRINT '✅ pagamentos: coluna equipa_escolha.';

PRINT '🎉 Migração v11 concluída.';
GO
