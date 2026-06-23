# 🛠️ Guia de Instalação — FutBuddies

Guia para instalar e executar o projeto **FutBuddies** (PAP de Gustavo Marques, nº 2223244).

O projeto é uma aplicação web *full-stack*:
- **Frontend:** React (Create React App)
- **Backend:** Node.js + Express (API REST)
- **Base de dados:** SQL Server / Azure SQL

---

## ✅ Opção 1 — Ver a aplicação online (sem instalar nada)

A aplicação está publicada e pode ser usada diretamente no navegador:

**🔗 https://futbuddies.vercel.app**

**Contas de demonstração:**

| Tipo | Email | Password |
|------|-------|----------|
| Administrador | `admin@futbuddies.pt` | `FutBuddies2026!` |
| Jogador | `gustavo@futbuddies.com` | `123456` |

> No ecrã de login existem também botões de **acesso rápido** para entrar com estas contas.

---

## 💻 Opção 2 — Instalar e correr localmente

### Pré-requisitos
Instalar previamente:
- **[Node.js 18 ou superior](https://nodejs.org)** (inclui o `npm`)
- **[SQL Server](https://www.microsoft.com/sql-server/sql-server-downloads)** — o *SQL Server Express* (gratuito) é suficiente
- **[Git](https://git-scm.com/download/win)** (opcional — pode também transferir o código em ZIP)
- *(Recomendado)* **[SQL Server Management Studio (SSMS)](https://learn.microsoft.com/sql/ssms/download-sql-server-management-studio-ssms)** ou **[Azure Data Studio](https://learn.microsoft.com/azure-data-studio/download)** para gerir a base de dados

---

### Passo 1 — Obter o código

```bash
git clone https://github.com/GustavoMarques0018/FutBuddies.git
cd FutBuddies/FutBuddiesV4
```

*(Ou descarregar o ZIP do GitHub em **Code → Download ZIP** e extrair.)*

A pasta `FutBuddiesV4` contém três subpastas: `backend`, `frontend` e `database`.

---

### Passo 2 — Criar a base de dados

1. Abrir o **SSMS** (ou Azure Data Studio) e ligar ao SQL Server local.
2. Abrir o ficheiro **`database/FutBuddiesDB_Completo.sql`** e **executar** (F5).
   → Cria a base de dados **`FutBuddiesDB`** com todas as tabelas.
3. *(Opcional, recomendado)* Abrir e executar **`database/dados_demo.sql`** para inserir dados de demonstração (jogadores, equipas, jogos, ligas).

---

### Passo 3 — Configurar e arrancar o BACKEND

```bash
cd backend
npm install
```

Criar um ficheiro **`.env`** dentro de `backend/` (pode copiar o `.env.example`) com, no mínimo:

```env
NODE_ENV=development
PORT=5000

# Base de dados
DB_SERVER=localhost\SQLEXPRESS
DB_PORT=1433
DB_NAME=FutBuddiesDB
DB_USER=sa
DB_PASSWORD=a_tua_password_do_sql
DB_ENCRYPT=false
DB_TRUST_CERT=true

# JWT (gerar com o comando abaixo)
JWT_SECRET=cola_aqui_uma_chave
JWT_REFRESH_SECRET=cola_aqui_outra_chave
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
```

Para gerar as chaves JWT, correr este comando duas vezes e colar os resultados:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Arrancar o servidor:

```bash
npm start
```

→ A API fica em **http://localhost:5000**

> As variáveis de Stripe, Cloudinary, Web Push e Email são **opcionais** — a aplicação arranca sem elas (essas funcionalidades ficam apenas desativadas).

---

### Passo 4 — Configurar e arrancar o FRONTEND

Numa **segunda janela** de terminal:

```bash
cd frontend
npm install
```

Criar um ficheiro **`.env`** dentro de `frontend/`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Arrancar:

```bash
npm start
```

→ A aplicação abre automaticamente em **http://localhost:3000**

---

## 🧩 Estrutura do projeto

```
FutBuddiesV4/
├── backend/      → API REST (Node.js + Express)
├── frontend/     → Aplicação React
└── database/     → Scripts SQL
      ├── FutBuddiesDB_Completo.sql   (cria a BD completa)
      └── dados_demo.sql              (dados de demonstração)
```

---

## 🆘 Resolução de problemas

| Problema | Solução |
|----------|---------|
| **`npm start` falha no backend** | Verificar o `.env` (sobretudo a ligação à base de dados) e se o SQL Server está a correr. |
| **Erro de ligação à BD** | Confirmar `DB_SERVER` (ex.: `localhost\SQLEXPRESS`), utilizador e password. Em SQL Express, ativar a *SQL Server Authentication* ou usar autenticação do Windows. |
| **Porta 3000 ou 5000 ocupada** | Fechar a aplicação que a usa, ou mudar a `PORT` no `.env` do backend. |
| **Página em branco / erros no frontend** | Confirmar que o backend está a correr e que `REACT_APP_API_URL` aponta para `http://localhost:5000/api`. |
| **`node` não reconhecido** | Reinstalar o Node.js e reabrir o terminal. |

---

## 📎 Notas

- O código-fonte completo está em: **https://github.com/GustavoMarques0018/FutBuddies**
- A base de dados chama-se **`FutBuddiesDB`** (nome próprio do projeto, conforme indicado).
- Não é necessário copiar a pasta `node_modules` — o `npm install` recria-a.

---

*FutBuddies — Prova de Aptidão Profissional · Técnico de Gestão e Programação de Sistemas Informáticos · 2023/2026*
