-- ============================================================
--  FutBuddies - Migra o v4
--  Chat de Equipa + Jogos de Equipa + Admin de Equipa
-- ============================================================

USE FutBuddies;
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
