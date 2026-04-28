-- ============================================================
--  FutBuddies - Sistema de Amigos e Mensagens Privadas
--  Migração para SQL Server
-- ============================================================

-- Amizades (friendships)
CREATE TABLE amizades (
  id INT IDENTITY(1,1) PRIMARY KEY,
  remetente_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  destinatario_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  estado VARCHAR(20) DEFAULT 'pendente', -- pendente, aceite, rejeitado
  created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Mensagens privadas
CREATE TABLE mensagens_privadas (
  id INT IDENTITY(1,1) PRIMARY KEY,
  remetente_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  destinatario_id INT NOT NULL FOREIGN KEY REFERENCES utilizadores(id),
  mensagem NVARCHAR(1000) NOT NULL,
  lida BIT DEFAULT 0,
  created_at DATETIME2 DEFAULT GETUTCDATE()
);
