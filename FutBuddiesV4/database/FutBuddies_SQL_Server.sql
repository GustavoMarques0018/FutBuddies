-- ============================================================
--  FutBuddies - Script SQL Server Completo
--  Servidor: GUSTALAP\SQLEXPRESS
--  Como usar: Abre no SSMS > Nova Consulta > Executar (F5)
--  Autor: Gustavo Marques - Projeto PAP 2026
-- ============================================================

-- ── 1. Criar Base de Dados ──────────────────────────────────
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'FutBuddies')
BEGIN
    CREATE DATABASE FutBuddies
    COLLATE Latin1_General_CI_AI;
    PRINT '✅ Base de dados FutBuddies criada.';
END
ELSE
    PRINT '⚠️  Base de dados FutBuddies já existe.';
GO

USE FutBuddies;
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

USE master;
GO
CREATE LOGIN futbuddies_user WITH PASSWORD = 'FutBuddies2026!';
GO
USE FutBuddies;
GO
CREATE USER futbuddies_user FOR LOGIN futbuddies_user;
ALTER ROLE db_owner ADD MEMBER futbuddies_user;
GO

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

