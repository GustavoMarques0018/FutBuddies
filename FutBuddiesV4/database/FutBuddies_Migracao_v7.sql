-- ============================================================
--  FutBuddies — Migração v7
--  Adiciona: perfil_publico (privacidade do perfil)
-- ============================================================

USE FutBuddies;
GO

IF NOT EXISTS (SELECT * FROM sys.columns
               WHERE object_id = OBJECT_ID('utilizadores') AND name = 'perfil_publico')
BEGIN
    ALTER TABLE utilizadores
        ADD perfil_publico BIT NOT NULL CONSTRAINT DF_util_perfil_publico DEFAULT 1;
    PRINT '✅ Coluna perfil_publico adicionada em utilizadores.';
END
ELSE
    PRINT '⚠️  Coluna perfil_publico já existia — ignorada.';
GO

PRINT '';
PRINT '============================================';
PRINT '  Migração v7 concluída com sucesso!';
PRINT '============================================';
GO
