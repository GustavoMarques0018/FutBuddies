-- ============================================================
--  FutBuddies — Migração v6 (Fase C)
--  Adiciona: resultado_jogo, resultado_pessoal
-- ============================================================

USE FutBuddies;
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
