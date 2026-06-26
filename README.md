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
- Resumo de chat por **IA** — opcional.

---

## 🛠️ Stack tecnológica

| Camada | Tecnologias |
|--------|-------------|
| **Frontend** | React 18 (Create React App), React Router 6, Axios, Socket.IO Client, Recharts, Leaflet, Stripe.js |
| **Backend** | Node.js, Express 4, Socket.IO, JSON Web Tokens, bcryptjs |
| **Base de dados** | SQL Server / Azure SQL (driver `mssql`, *queries* parametrizadas) |
| **Pagamentos** | Stripe Connect |
| **Tempo real** | Socket.IO (chat de jogos, equipas e mensagens privadas) |
| **Serviços externos** | Cloudinary (uploads), Web Push (VAPID), Nominatim/OpenStreetMap (geocodificação), GIPHY |

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

## 👤 Autor

Projeto desenvolvido por **Gustavo Marques** no âmbito da **Prova de Aptidão Profissional (PAP)**.

---

📅 *FutBuddies — Simplifying the game.*
