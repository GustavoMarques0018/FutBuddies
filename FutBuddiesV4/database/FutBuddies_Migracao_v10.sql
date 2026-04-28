-- ============================================================
--  FutBuddies - Migração v10
--  - Tabela de mensagens de suporte (inbox admin)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'suporte_mensagens')
BEGIN
  CREATE TABLE suporte_mensagens (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    utilizador_id   INT NULL,          -- NULL se anónimo
    nome            NVARCHAR(120) NULL,
    email           NVARCHAR(180) NULL,
    assunto         NVARCHAR(200) NOT NULL,
    mensagem        NVARCHAR(MAX) NOT NULL,
    estado          VARCHAR(20) NOT NULL DEFAULT 'aberta', -- aberta|em_analise|resolvida|arquivada
    resposta_admin  NVARCHAR(MAX) NULL,
    respondida_por  INT NULL,
    respondida_em   DATETIME2 NULL,
    created_at      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    updated_at      DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_SupMsg_User  FOREIGN KEY (utilizador_id)  REFERENCES utilizadores(id) ON DELETE SET NULL,
    CONSTRAINT FK_SupMsg_Admin FOREIGN KEY (respondida_por) REFERENCES utilizadores(id) ON DELETE NO ACTION
  );
  CREATE INDEX IX_suporte_estado   ON suporte_mensagens(estado, created_at DESC);
  CREATE INDEX IX_suporte_user     ON suporte_mensagens(utilizador_id);
END
GO
