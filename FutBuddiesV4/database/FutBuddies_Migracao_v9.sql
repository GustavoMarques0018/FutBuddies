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
