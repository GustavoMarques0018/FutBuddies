-- ============================================================
--  FutBuddies - Migração v12
--  ★ Chat v2: imagens, GIFs, menções, reações
--  ★ Galeria de fotos por jogo
-- ============================================================
SET NOCOUNT ON;

-- ── 1. mensagens_chat: coluna media_url ──────────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('mensagens_chat') AND name = 'media_url'
)
BEGIN
  ALTER TABLE mensagens_chat ADD media_url NVARCHAR(500) NULL;
  PRINT '✅ mensagens_chat: coluna media_url adicionada.';
END
ELSE PRINT '⚠️  media_url já existia.';
GO

-- ── 2. mensagens_chat: coluna mencoes_json ───────────────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('mensagens_chat') AND name = 'mencoes_json'
)
BEGIN
  ALTER TABLE mensagens_chat ADD mencoes_json NVARCHAR(MAX) NULL;
  PRINT '✅ mensagens_chat: coluna mencoes_json adicionada.';
END
ELSE PRINT '⚠️  mencoes_json já existia.';
GO

-- ── 3. mensagens_chat: alargar CHECK de tipo ─────────────────
-- O CHECK foi criado inline sem nome → SQL Server gerou nome automático.
-- Encontramos e apagamos dinamicamente, depois criamos o novo.
DECLARE @ckName NVARCHAR(256);
SELECT @ckName = cc.name
FROM   sys.check_constraints cc
JOIN   sys.columns           col ON col.object_id = cc.parent_object_id
                                AND col.column_id  = cc.parent_column_id
WHERE  cc.parent_object_id = OBJECT_ID('mensagens_chat')
AND    col.name = 'tipo';

IF @ckName IS NOT NULL
BEGIN
  EXEC('ALTER TABLE mensagens_chat DROP CONSTRAINT [' + @ckName + ']');
  PRINT '✅ mensagens_chat: CHECK antigo de tipo removido.';
END

IF NOT EXISTS (
  SELECT 1 FROM sys.check_constraints
  WHERE parent_object_id = OBJECT_ID('mensagens_chat')
    AND name = 'CK_chat_tipo'
)
BEGIN
  ALTER TABLE mensagens_chat
    ADD CONSTRAINT CK_chat_tipo
    CHECK (tipo IN ('texto', 'sistema', 'imagem', 'gif'));
  PRINT '✅ mensagens_chat: novo CHECK de tipo criado (texto/sistema/imagem/gif).';
END
ELSE PRINT '⚠️  CK_chat_tipo já existia.';
GO

-- ── 4. mensagens_chat: mensagem pode ser vazia (imagens/GIFs) ─
-- A coluna original é NOT NULL mas para imagens/GIFs o texto é ''.
-- String vazia já é permitida por NOT NULL; não é preciso alterar.
-- No entanto, garantimos que o DEFAULT está definido.
IF NOT EXISTS (
  SELECT 1 FROM sys.default_constraints
  WHERE parent_object_id = OBJECT_ID('mensagens_chat')
    AND name = 'DF_chat_mensagem'
)
BEGIN
  ALTER TABLE mensagens_chat
    ADD CONSTRAINT DF_chat_mensagem DEFAULT '' FOR mensagem;
  PRINT '✅ mensagens_chat: DEFAULT vazio em mensagem adicionado.';
END
GO

-- ── 5. Tabela reacoes_chat ────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'reacoes_chat')
BEGIN
  CREATE TABLE reacoes_chat (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    mensagem_id   INT           NOT NULL,
    utilizador_id INT           NOT NULL,
    emoji         NVARCHAR(10)  NOT NULL,
    created_at    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_reacao_msg  FOREIGN KEY (mensagem_id)   REFERENCES mensagens_chat(id) ON DELETE CASCADE,
    CONSTRAINT FK_reacao_user FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id),
    CONSTRAINT UQ_reacao      UNIQUE (mensagem_id, utilizador_id, emoji)
  );
  CREATE INDEX IX_reacoes_msg ON reacoes_chat(mensagem_id);
  PRINT '✅ Tabela reacoes_chat criada.';
END
ELSE PRINT '⚠️  reacoes_chat já existia.';
GO

-- ── 6. Tabela fotos_jogo ─────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'fotos_jogo')
BEGIN
  CREATE TABLE fotos_jogo (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    jogo_id       INT            NOT NULL,
    utilizador_id INT            NOT NULL,
    url           NVARCHAR(500)  NOT NULL,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_foto_jogo  FOREIGN KEY (jogo_id)       REFERENCES jogos(id) ON DELETE CASCADE,
    CONSTRAINT FK_foto_user  FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
  );
  CREATE INDEX IX_fotos_jogo ON fotos_jogo(jogo_id, created_at DESC);
  PRINT '✅ Tabela fotos_jogo criada.';
END
ELSE PRINT '⚠️  fotos_jogo já existia.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v12 concluída com sucesso!';
PRINT '============================================';
GO
