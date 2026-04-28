-- ============================================================
--  FutBuddies — Migração v5
--  Adiciona: notificacoes, notas_admin
--  (resultado_jogo / resultado_pessoal ficam para Fase C)
-- ============================================================

USE FutBuddies;
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
