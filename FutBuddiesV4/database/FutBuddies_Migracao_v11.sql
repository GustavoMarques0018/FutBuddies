-- ============================================================
--  FutBuddies - Migração v11
--  ★ Horários dinâmicos de campos + lotação configurável
--  ★ Reservas com slot fixo por campo
--  ★ Pagamento por equipa (50/50) em jogos
-- ============================================================
SET NOCOUNT ON;

-- ── 1. CAMPOS: horários + lotações ───────────────────────────
-- hora_abertura / hora_fecho: minutos desde 00:00 (ex: 600 = 10:00)
-- dias_semana_json: array ISO (1=segunda..7=domingo), ex: [1,2,3,4,5,6,7]
-- slot_min: granularidade dos horários (ex: 60 = slots de hora a hora)
-- lotacoes_json: lotações permitidas (ex: [5,6,7] → 5x5/6x6/7x7)
--              define o MÁX de jogadores = max(lotacao)*2

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='hora_abertura')
  ALTER TABLE campos ADD hora_abertura INT NOT NULL DEFAULT 480;   -- 08:00
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='hora_fecho')
  ALTER TABLE campos ADD hora_fecho INT NOT NULL DEFAULT 1380;     -- 23:00
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='dias_semana_json')
  ALTER TABLE campos ADD dias_semana_json NVARCHAR(100) NOT NULL DEFAULT '[1,2,3,4,5,6,7]';
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='slot_min')
  ALTER TABLE campos ADD slot_min INT NOT NULL DEFAULT 60;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campos') AND name='lotacoes_json')
  ALTER TABLE campos ADD lotacoes_json NVARCHAR(100) NOT NULL DEFAULT '[5,7]';
GO
PRINT '✅ campos: horário + lotação adicionados.';

-- ── 2. CANDIDATURAS: mesmos campos para o dono indicar à partida
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='hora_abertura')
  ALTER TABLE campo_candidaturas ADD hora_abertura INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='hora_fecho')
  ALTER TABLE campo_candidaturas ADD hora_fecho INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='dias_semana_json')
  ALTER TABLE campo_candidaturas ADD dias_semana_json NVARCHAR(100) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('campo_candidaturas') AND name='lotacoes_json')
  ALTER TABLE campo_candidaturas ADD lotacoes_json NVARCHAR(100) NULL;
GO

-- ── 3. JOGOS: lotação escolhida + modo 'por_equipa'
-- formato_lotacao: ex 5, 6, 7 (lado do jogo). Jogadores totais = formato*2
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('jogos') AND name='formato_lotacao')
  ALTER TABLE jogos ADD formato_lotacao INT NULL;
GO

-- Nota: modelo_pagamento aceita agora também 'por_equipa' (além de 'total' / 'dividido')
-- SQL Server não tem ENUM — não é preciso alterar a coluna, só permitir o novo valor no backend.

-- ── 4. Inscrição em equipa (para modo por_equipa)
-- equipa_escolha: 'A' ou 'B' na tabela inscricoes (ou similar). Criamos se não existir.
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name='inscricoes')
BEGIN
  PRINT '⚠️  tabela inscricoes não encontrada — salta equipa_escolha.';
END
ELSE
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('inscricoes') AND name='equipa_escolha')
    EXEC('ALTER TABLE inscricoes ADD equipa_escolha CHAR(1) NULL;');  -- ''A'' | ''B'' | NULL
END
GO
PRINT '✅ inscricoes: coluna equipa_escolha.';

-- ── 5. Pagamentos: marcar a equipa a que pertence (para modo por_equipa)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('pagamentos') AND name='equipa_escolha')
  ALTER TABLE pagamentos ADD equipa_escolha CHAR(1) NULL;
GO
PRINT '✅ pagamentos: coluna equipa_escolha.';

PRINT '🎉 Migração v11 concluída.';
GO
