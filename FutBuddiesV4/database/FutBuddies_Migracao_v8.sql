-- ============================================================
--  FutBuddies — Migração v8 (Fase D)
--  Campos parceiros · Stripe Connect · Pagamentos · Crowdfunding
-- ============================================================

USE FutBuddies;
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
