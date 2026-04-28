-- ============================================================
--  FutBuddies - Migração Equipas v3
--  Adiciona: visibilidade, código de acesso, pedidos de entrada
-- ============================================================

USE FutBuddies;
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
