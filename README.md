# ⚽ FutBuddies

> A solução inteligente para organizar os teus jogos de futebol, gerir equipas e dividir custos sem chatices.

## 📱 Sobre a App
O **FutBuddies** é uma plataforma focada na experiência do jogador. O objetivo é transformar a logística complicada de organizar um "racha" ou um jogo amador num processo de poucos cliques. A app gere tudo: desde a reserva do campo até ao momento em que a conta é paga.

## ✨ Funcionalidades Principais

* **Organização de Jogos:** Cria jogos personalizados definindo o local, o dia, a hora e o número de jogadores necessários.
* **Sistema de Vagas Dinâmico (REQ001-005):** Inscrição em tempo real. A app controla o preenchimento das vagas e avisa quando as equipas estão fechadas.
* **Racha-Conta Automático (Stripe):** Integração nativa com a API do Stripe. O sistema calcula o valor por pessoa e processa o pagamento de forma segura, garantindo que o campo é pago sem que ninguém fique a dever.
* **Chat de Jogo (Real-time):** Cada jogo tem o seu próprio canal de comunicação para combinar cores de equipamentos ou táticas de última hora.
* **Gestão de Perfil:** Histórico de jogos, estatísticas e autenticação segura de utilizador.

## 🛠️ Stack Tecnológica
* **Interface:** React.js + Vite (UI fluida e rápida).
* **Cérebro (Backend):** Node.js & Express.
* **Base de Dados:** SQL Server (MSSQL) para gestão robusta de dados.
* **Pagamentos:** Stripe Connect.

## 🚀 Como colocar a App a correr

Para testares a app localmente, precisas de configurar as chaves de API num ficheiro `.env` na pasta do servidor:

1.  **Clone o projeto:**
    ```bash
    git clone [https://github.com/GustavoMarques0018/FutBuddies.git](https://github.com/GustavoMarques0018/FutBuddies.git)
    ```
2.  **Variáveis de Ambiente (.env):**
    ```env
    STRIPE_SECRET_KEY=as_tuas_chaves
    DB_URL=ligacao_mssql
    ```
3.  **Instalação:**
    ```bash
    # No Frontend e no Backend
    npm install
    ```
4.  **Execução:**
    ```bash
    npm run dev
    ```

---
📅 *FutBuddies - Simplifying the game.*
