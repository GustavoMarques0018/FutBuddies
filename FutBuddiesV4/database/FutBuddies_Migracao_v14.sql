-- ============================================================
--  FutBuddies - Migração v14
--  ★ Lembrete personalizável (horas antes do jogo)
--  ★ Troféus de época mensal
--  ★ Liga entre amigos
-- ============================================================
SET NOCOUNT ON;

-- ── 1. utilizadores: lembrete_jogo_horas ────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('utilizadores') AND name='lembrete_jogo_horas')
  ALTER TABLE utilizadores ADD lembrete_jogo_horas INT NULL;
GO
PRINT '✅ utilizadores.lembrete_jogo_horas';

-- ── 2. Tabela trofeus_epoca ──────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='trofeus_epoca')
BEGIN
  CREATE TABLE trofeus_epoca (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    utilizador_id INT          NOT NULL,
    tipo          NVARCHAR(30) NOT NULL,
    -- goleador_mes | presenca_mes | mvp_mes
    mes           INT          NOT NULL,
    ano           INT          NOT NULL,
    valor         INT          NOT NULL DEFAULT 0,
    created_at    DATETIME2    NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_te_user FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
    CONSTRAINT UQ_trofeu  UNIQUE (utilizador_id, tipo, mes, ano)
  );
  CREATE INDEX IX_trofeus_user ON trofeus_epoca(utilizador_id);
  PRINT '✅ Tabela trofeus_epoca criada.';
END
ELSE PRINT '⚠️  trofeus_epoca já existia.';
GO

-- ── 3. Tabela ligas ──────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='ligas')
BEGIN
  CREATE TABLE ligas (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    nome        NVARCHAR(100)  NOT NULL,
    criador_id  INT            NOT NULL,
    codigo      NVARCHAR(10)   NOT NULL UNIQUE,
    tipo        NVARCHAR(20)   NOT NULL DEFAULT 'mensal'
                CHECK (tipo IN ('semanal','mensal','epoca')),
    estado      NVARCHAR(20)   NOT NULL DEFAULT 'ativa'
                CHECK (estado IN ('ativa','encerrada')),
    equipa_id   INT            NULL,
    regras      NVARCHAR(1000) NULL,
    premio      NVARCHAR(500)  NULL,
    created_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_liga_criador FOREIGN KEY (criador_id) REFERENCES utilizadores(id),
    CONSTRAINT FK_liga_equipa  FOREIGN KEY (equipa_id)  REFERENCES equipas(id)
  );
  PRINT '✅ Tabela ligas criada.';
END
ELSE BEGIN
  -- Adicionar colunas se a tabela já existir (upgrade seguro)
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('ligas') AND name='equipa_id')
    ALTER TABLE ligas ADD equipa_id INT NULL CONSTRAINT FK_liga_equipa FOREIGN KEY REFERENCES equipas(id);
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('ligas') AND name='regras')
    ALTER TABLE ligas ADD regras NVARCHAR(1000) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('ligas') AND name='premio')
    ALTER TABLE ligas ADD premio NVARCHAR(500) NULL;
  PRINT '⚠️  ligas já existia — colunas verificadas/adicionadas.';
END
GO

-- ── 4. Tabela liga_membros ───────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='liga_membros')
BEGIN
  CREATE TABLE liga_membros (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    liga_id       INT NOT NULL,
    utilizador_id INT NOT NULL,
    pontos        INT NOT NULL DEFAULT 0,
    vitorias      INT NOT NULL DEFAULT 0,
    empates       INT NOT NULL DEFAULT 0,
    derrotas      INT NOT NULL DEFAULT 0,
    golos_marcados INT NOT NULL DEFAULT 0,
    golos_sofridos INT NOT NULL DEFAULT 0,
    created_at    DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_lm_liga FOREIGN KEY (liga_id) REFERENCES ligas(id) ON DELETE CASCADE,
    CONSTRAINT FK_lm_user FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id),
    CONSTRAINT UQ_lm      UNIQUE (liga_id, utilizador_id)
  );
  CREATE INDEX IX_lm_liga ON liga_membros(liga_id);
  PRINT '✅ Tabela liga_membros criada.';
END
ELSE PRINT '⚠️  liga_membros já existia.';
GO

-- ── 5. Tabela liga_jogos ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='liga_jogos')
BEGIN
  CREATE TABLE liga_jogos (
    liga_id  INT NOT NULL,
    jogo_id  INT NOT NULL,
    added_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT PK_lj PRIMARY KEY (liga_id, jogo_id),
    CONSTRAINT FK_lj_liga FOREIGN KEY (liga_id) REFERENCES ligas(id) ON DELETE CASCADE,
    CONSTRAINT FK_lj_jogo FOREIGN KEY (jogo_id) REFERENCES jogos(id)
  );
  PRINT '✅ Tabela liga_jogos criada.';
END
ELSE PRINT '⚠️  liga_jogos já existia.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v14 concluída com sucesso!';
PRINT '============================================';
GO
