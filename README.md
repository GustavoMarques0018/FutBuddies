# ⚽ FutBuddies

> A solução inteligente para organizar jogos de futebol amador, formar equipas, gerir ligas e dividir os custos do campo — tudo num só lugar.

**FutBuddies** é uma aplicação web *full-stack* desenvolvida no âmbito da **Prova de Aptidão Profissional (PAP)**. O objetivo é transformar a logística complicada de organizar um "racha" — combinar jogadores, reservar campo, fazer equipas e pagar a conta — num processo de poucos cliques.

---

## 📑 Índice

- [Sobre a aplicação](#-sobre-a-aplicação)
- [Funcionalidades](#-funcionalidades)
- [Stack tecnológica](#️-stack-tecnológica)
- [Arquitetura do projeto](#-arquitetura-do-projeto)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e execução](#-instalação-e-execução)
- [Variáveis de ambiente](#-variáveis-de-ambiente)
- [Base de dados](#-base-de-dados)
- [Compilar para produção](#-compilar-para-produção)
- [Segurança](#-segurança)
- [Autor](#-autor)

---

## 📱 Sobre a aplicação

O FutBuddies é uma plataforma focada na experiência do jogador de futebol amador. Permite a qualquer pessoa criar um jogo público ou privado, gerir as inscrições em tempo real, comunicar com os participantes, registar resultados e estatísticas, e até dividir o custo do campo automaticamente através de pagamentos online.

A aplicação inclui também um ecossistema completo: **equipas**, **ligas entre amigos**, **sistema de amizades com chat privado**, **conquistas**, **feed de atividade**, **gestão de campos para donos** e um **painel de administração**.

---

## ✨ Funcionalidades

### Jogos
- Criação de jogos com local (mapa interativo), data/hora, tipo (5x5, 7x7, 11x11), número de vagas e visibilidade (público/privado com código de acesso).
- Inscrição e gestão de vagas em **tempo real** (lista de espera automática).
- **Chat de jogo** com reações, imagens, GIFs e menções (via WebSocket).
- Sorteio e **balanceamento automático de equipas** por nível.
- Registo de **resultado oficial** e **estatísticas pessoais** (golos, assistências).
- Votação de **MVP**, avaliação de jogadores e do estado do campo/relva.
- **Check-in por QR Code**, galeria de fotos, previsão meteorológica e gerador de poster.

### Equipas e Ligas
- Criação e gestão de equipas (emblema, membros, capitão, calendário, chat de equipa).
- **Ligas entre amigos** com tabela classificativa, regras e prémio do campeão.
- Inscrição de equipas completas em jogos.

### Social
- Sistema de **amizades** com pedidos, sugestões e **chat privado**.
- **Feed de atividade** dos amigos (jogos criados, golos, conquistas).
- **Desafios** mensais head-to-head entre amigos.
- Perfis públicos com estatísticas, gráfico de forma, mapa de calor de presenças e troféus de época.

### Pagamentos (Stripe Connect)
- Divisão automática do custo do campo por jogador.
- Onboarding de **donos de campo** com recebimento direto e comissão da plataforma.
- Carteira interna e histórico de pagamentos.

### Outros
- **PWA** instalável no telemóvel, com notificações **Web Push**.
- **Modo claro/escuro** e design totalmente responsivo (mobile-first).
- Painel de **administração** (utilizadores, jogos, equipas, denúncias, candidaturas, suporte).
- Resumo de chat por **IA** (Anthropic Claude) — opcional.

---

## 🛠️ Stack tecnológica

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18 (Create React App), React Router 6, Axios, Socket.IO Client, Recharts, Leaflet, Stripe.js |
| **Backend** | Node.js, Express 4, Socket.IO, JSON Web Tokens, bcryptjs |
| **Base de dados** | SQL Server / Azure SQL (driver `mssql`, *queries* parametrizadas) |
| **Pagamentos** | Stripe Connect |
| **Tempo real** | Socket.IO (chat de jogos, equipas e mensagens privadas) |
| **Serviços externos** | Cloudinary (uploads), Web Push (VAPID), Nominatim/OpenStreetMap (geocodificação), GIPHY, Anthropic (IA) |

> ℹ️ O frontend usa **Create React App** (`react-scripts`), não Vite.

---

## 📂 Arquitetura do projeto

```
FutBuddiesV4/
├── backend/                # API REST + WebSocket (Node.js / Express)
│   ├── config/             # Ligação à base de dados e Stripe
│   ├── controllers/        # Lógica de negócio (33 controllers)
│   ├── middleware/         # Autenticação JWT, permissões de admin
│   ├── routes/             # Definição de todas as rotas da API
│   ├── jobs/               # Tarefas agendadas (lembretes, no-shows, totais)
│   ├── utils/              # Funções auxiliares
│   └── server.js           # Ponto de entrada do servidor
│
├── frontend/               # Aplicação React
│   └── src/
│       ├── pages/          # Páginas/ecrãs (23)
│       ├── components/     # Componentes reutilizáveis (~45)
│       ├── context/        # Estado global (Auth, Tema, Toast, Confirmação)
│       └── utils/          # Cliente API, Stripe, Web Push
│
└── database/               # Scripts SQL (schema + migrações)
```

---

## 📋 Pré-requisitos

- **Node.js** 18 ou superior ([nodejs.org](https://nodejs.org))
- **SQL Server** 2019+ (ou Azure SQL Database) — o [SQL Server Express](https://www.microsoft.com/sql-server/sql-server-downloads) é gratuito e suficiente
- **npm** (incluído no Node.js)

---

## 🚀 Instalação e execução

### 1. Clonar o repositório

```bash
git clone https://github.com/GustavoMarques0018/FutBuddies.git
cd FutBuddies/FutBuddiesV4
```

### 2. Criar a base de dados

Abre o **SQL Server Management Studio** (SSMS) ou o **Azure Data Studio** e executa o script de criação:

```
database/FutBuddiesDB_Completo.sql
```

Isto cria a base de dados `FutBuddiesDB` com todas as tabelas.

### 3. Configurar e arrancar o backend

```bash
cd backend
npm install
copy .env.example .env      # (Linux/Mac: cp .env.example .env)
# Edita o .env com as tuas credenciais (ver secção abaixo)
npm start
```

O servidor fica disponível em `http://localhost:5000`.

### 4. Configurar e arrancar o frontend

Numa **segunda janela do terminal**:

```bash
cd frontend
npm install
copy .env.example .env      # (Linux/Mac: cp .env.example .env)
npm start
```

A aplicação abre automaticamente em `http://localhost:3000`.

---

## 🔐 Variáveis de ambiente

Cada parte tem um ficheiro `.env.example` que serve de modelo. **Nunca commitar o `.env` real** (já está protegido pelo `.gitignore`).

### Backend (`backend/.env`) — essenciais para correr localmente

| Variável | Descrição |
|----------|-----------|
| `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Ligação ao SQL Server |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Chaves de assinatura dos tokens (gerar com `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`) |
| `CORS_ORIGIN` | Origens permitidas (obrigatório em produção) |

As variáveis de Stripe, Web Push, Cloudinary e Email são **opcionais** — a app arranca sem elas (essas funcionalidades degradam graciosamente).

### Frontend (`frontend/.env`)

| Variável | Descrição |
|----------|-----------|
| `REACT_APP_API_URL` | URL da API (ex.: `http://localhost:5000/api`) |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY` | Chave pública do Stripe (opcional) |
| `REACT_APP_VAPID_PUBLIC_KEY` | Chave pública para Web Push (opcional) |

---

## 🗄️ Base de dados

A base de dados chama-se **`FutBuddiesDB`** e corre em **SQL Server / Azure SQL**.

- **`database/FutBuddiesDB_Completo.sql`** — script consolidado que cria a base de dados completa do zero (todas as tabelas). **É este que deves correr.**
- **`database/dados_demo.sql`** — dados fictícios opcionais para demonstração.
- Os ficheiros `FutBuddies_Migracao_v*.sql` são o histórico de migrações incrementais (não é preciso correr se usares o script consolidado).

Todas as interações com a base de dados usam **queries parametrizadas**, prevenindo *SQL injection*.

---

## 📦 Compilar para produção

```bash
cd frontend
npm run build
```

Gera a pasta `frontend/build/` com os ficheiros estáticos otimizados, prontos a servir.

---

## 🛡️ Segurança

- Autenticação por **JWT** (access token + refresh token).
- Passwords protegidas com **bcrypt** (salt de 12 rondas).
- **Queries parametrizadas** em todas as operações de base de dados.
- **Rate limiting**, cabeçalhos de segurança via **Helmet** e **CORS** restrito em produção.
- Segredos isolados em `.env` (excluídos do controlo de versões).

---

## 👤 Autor

Projeto desenvolvido por **Gustavo Marques** no âmbito da **Prova de Aptidão Profissional (PAP)**.

---

📅 *FutBuddies — Simplifying the game.*
