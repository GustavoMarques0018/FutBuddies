-- ============================================================
--  FutBuddies - Script de Migração v2
--  Executa este script DEPOIS do script original
--  Adiciona: jogos privados, regiões, equipas, perfil melhorado
-- ============================================================

USE FutBuddies;
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
