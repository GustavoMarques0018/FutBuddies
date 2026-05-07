-- ============================================================
--  FutBuddies - Migração v13
--  ★ Capa do jogo
--  ★ Anúncios do criador (chat pinned)
--  ★ Posição por jogo em inscrições
--  ★ Streaks de jogador
--  ★ Feed de atividade
--  ★ Avaliação do piso do campo
--  ★ Desafios entre amigos
-- ============================================================
SET NOCOUNT ON;

-- ── 1. jogos: capa_url ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('jogos') AND name='capa_url')
  ALTER TABLE jogos ADD capa_url NVARCHAR(500) NULL;
GO
PRINT '✅ jogos.capa_url';

-- ── 2. jogos: anuncio ────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('jogos') AND name='anuncio')
  ALTER TABLE jogos ADD anuncio NVARCHAR(500) NULL;
GO
PRINT '✅ jogos.anuncio';

-- ── 3. inscricoes: posicao_jogo ──────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('inscricoes') AND name='posicao_jogo')
  ALTER TABLE inscricoes ADD posicao_jogo NVARCHAR(50) NULL;
GO
PRINT '✅ inscricoes.posicao_jogo';

-- ── 4. utilizadores: streak ──────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('utilizadores') AND name='streak_atual')
  ALTER TABLE utilizadores ADD streak_atual INT NOT NULL DEFAULT 0;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('utilizadores') AND name='streak_max')
  ALTER TABLE utilizadores ADD streak_max INT NOT NULL DEFAULT 0;
GO
PRINT '✅ utilizadores.streak_atual/max';

-- ── 5. Tabela atividade_feed ─────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='atividade_feed')
BEGIN
  CREATE TABLE atividade_feed (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    utilizador_id INT           NOT NULL,
    tipo          NVARCHAR(50)  NOT NULL,
    -- jogo_criado | golo_marcado | conquista | inscricao | conquista_nova
    dados_json    NVARCHAR(MAX) NULL,
    created_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_af_user FOREIGN KEY (utilizador_id)
      REFERENCES utilizadores(id) ON DELETE CASCADE
  );
  CREATE INDEX IX_af_user_date ON atividade_feed(utilizador_id, created_at DESC);
  PRINT '✅ Tabela atividade_feed criada.';
END
ELSE PRINT '⚠️  atividade_feed já existia.';
GO

-- ── 6. Tabela avaliacoes_campo_piso ──────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='avaliacoes_campo_piso')
BEGIN
  CREATE TABLE avaliacoes_campo_piso (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    campo_id      INT           NOT NULL,
    utilizador_id INT           NOT NULL,
    jogo_id       INT           NOT NULL,
    nota          INT           NOT NULL CHECK (nota BETWEEN 1 AND 5),
    comentario    NVARCHAR(500) NULL,
    created_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_acp_campo  FOREIGN KEY (campo_id)      REFERENCES campos(id) ON DELETE CASCADE,
    CONSTRAINT FK_acp_user   FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id),
    CONSTRAINT FK_acp_jogo   FOREIGN KEY (jogo_id)       REFERENCES jogos(id),
    CONSTRAINT UQ_acp        UNIQUE (campo_id, utilizador_id, jogo_id)
  );
  CREATE INDEX IX_acp_campo ON avaliacoes_campo_piso(campo_id);
  PRINT '✅ Tabela avaliacoes_campo_piso criada.';
END
ELSE PRINT '⚠️  avaliacoes_campo_piso já existia.';
GO

-- ── 7. Tabela desafios ───────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='desafios')
BEGIN
  CREATE TABLE desafios (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    criador_id       INT           NOT NULL,
    participante_id  INT           NOT NULL,
    tipo             NVARCHAR(30)  NOT NULL
                     CHECK (tipo IN ('gols_mes','assistencias_mes','jogos_mes')),
    mes              INT           NOT NULL,
    ano              INT           NOT NULL,
    estado           NVARCHAR(20)  NOT NULL DEFAULT 'pending'
                     CHECK (estado IN ('pending','aceite','recusado')),
    created_at       DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_desafio_criador FOREIGN KEY (criador_id)
      REFERENCES utilizadores(id),
    CONSTRAINT FK_desafio_part    FOREIGN KEY (participante_id)
      REFERENCES utilizadores(id),
    CONSTRAINT UQ_desafio UNIQUE (criador_id, participante_id, tipo, mes, ano)
  );
  CREATE INDEX IX_desafios_criador ON desafios(criador_id);
  CREATE INDEX IX_desafios_part    ON desafios(participante_id);
  PRINT '✅ Tabela desafios criada.';
END
ELSE PRINT '⚠️  desafios já existia.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v13 concluída com sucesso!';
PRINT '============================================';
GO
