<div align="center">

# 🟢 Yummis Gateway

**Plataforma omnichannel de atendimento e disparo de mensagens** — WhatsApp, Telegram, Facebook, Instagram e X (Twitter) — com **bot de atendimento**, **CRM** e **painel SaaS**, tudo rodando localmente.

![Node](https://img.shields.io/badge/Node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite&logoColor=white)
![Baileys](https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&logoColor=white)

</div>

---

## 📖 Sobre o projeto

O **Yummis Gateway** é um sistema completo de atendimento automatizado que:

- **Recebe e envia mensagens** de vários canais (WhatsApp via Baileys, Telegram via Bot API, e webhooks para Facebook/Instagram/X).
- **Processa automaticamente** cada mensagem com um **bot de atendimento** (cadastro de cliente, consultas ao banco de dados, fluxo de menu) — ou entrega para um **atendente humano**.
- Mostra tudo num **CRM omnichannel** e num **painel administrativo estilo SaaS**, com a **origem de cada mensagem**.
- Cobra **tokens apenas das respostas do bot** — interações do atendente são gratuitas.

---

## 🏗️ Arquitetura

O projeto tem **3 partes independentes**:

> **Arquitetura desacoplada:** o **gateway é só um canal de entrega** (recebe e envia mensagens) — ele **não processa o fluxo do bot**. Todo o processamento e a configuração do fluxo acontecem na **plataforma (CRM em :3050)**, que lê as mensagens, executa o bot e devolve a resposta para o gateway entregar.

| Parte | Pasta | Porta | O que faz |
|-------|-------|-------|-----------|
| **Backend (Gateway)** | `backend/` | `3060` | Recebe/encaminha/envia mensagens, banco SQLite e painel do gateway (**não processa fluxo**) |
| **Frontend (CRM)** | `src/` → `dist/` | `3050` (dev) | Painel CRM omnichannel "Moda Express" (React + Vite) |
| **Centralizador** | `centralizer/` | `8080` | Junta tudo numa única URL (`/sales` + `/connection`) — ideal para **ngrok** |

```
                          ┌─────────────────────────────┐
   WhatsApp / Telegram    │        CENTRALIZADOR         │
   Facebook / IG / X  ──► │  :8080                       │
                          │   /sales      → Frontend CRM │
                          │   /connection → Gateway      │
                          └───────┬──────────────┬───────┘
                                  │              │
                       ┌──────────▼───┐   ┌──────▼─────────┐
                       │  Frontend    │   │  Backend       │
                       │  CRM (React) │◄─►│  Gateway       │
                       │  :3050/dist  │   │  :3060         │
                       └──────────────┘   │  Bot + SQLite  │
                                          │  + Baileys     │
                                          └────────────────┘
```

---

## 🧰 Tecnologias

- **Backend:** Node.js, Express, [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp), better-sqlite3, qrcode, pino
- **Frontend:** React 19, Vite 6, TailwindCSS 4, lucide-react
- **Centralizador:** Express + http-proxy-middleware
- **Banco:** SQLite (arquivo local, criado automaticamente)

---

## ✅ Pré-requisitos

- **Node.js 18 ou superior** (recomendado 20/22) e **npm**
- Git
- Um celular com WhatsApp (para parear via QR Code)

> O banco de dados é criado **automaticamente** na primeira execução — você **não** precisa instalar MySQL/Postgres.

---

## 🚀 Como rodar (passo a passo)

### 1. Clonar o repositório
```bash
git clone git@github.com:Guilhermossauro/yummis-whats.git
cd yummis-whats
```

### 2. Subir o **Backend (Gateway)** — é o coração do sistema
```bash
cd backend
npm install
node server.js
```
✔️ Sobe em **http://localhost:3060**. Na primeira vez ele cria o banco (`backend/db/database.db`), o admin e um usuário lojista. Você verá no console:
```
🟢 Baileys carregado — WhatsApp REAL rodando localmente no backend.
🟢 WhatsApp Gateway API Backend ativa na porta 3060
🤖 Bot ativo — lembrete em 15min, reset em 30min (configurável).
```

### 3. Subir o **Frontend (CRM)** — em outro terminal
```bash
# (na raiz do projeto)
npm install
npm run dev
```
✔️ Abre em **http://localhost:3050**.

### 4. (Opcional) Subir o **Centralizador** — para uma URL única / ngrok
```bash
# 1) gere o build do frontend com base /sales/
npm run build:sales

# 2) suba o centralizador (em outro terminal)
cd centralizer
npm install
node index.js
```
✔️ Sobe em **http://localhost:8080**:
- **http://localhost:8080/sales/** → CRM
- **http://localhost:8080/connection/** → Painel do Gateway

---

## 🔑 Acessos padrão

| Onde | Usuário | Senha |
|------|---------|-------|
| Painel do Gateway (admin) | `admin` | `123` |
| Painel do Gateway (lojista/cliente) | `lojista` | `123` |

> O login do gateway é **unificado**: o sistema detecta automaticamente se você é admin ou cliente.
> **Altere essas senhas** antes de colocar em produção.

---

## 📲 Conectando os canais

### WhatsApp (real, via Baileys)
1. Acesse o painel do gateway → entre como **lojista**.
2. Vá em **Canais → WhatsApp → Iniciar Conexão**.
3. Escaneie o **QR Code** no celular: WhatsApp → **Aparelhos conectados → Conectar um aparelho**.
4. Pronto! A sessão fica salva e **reconecta sozinha** nos próximos boots.

### Telegram
1. Crie um bot no **@BotFather** e copie o token.
2. Painel → **Canais → Telegram** → cole o token → **Conectar**.

### Facebook / Instagram / X
São integrados por **webhook**. No painel → **Canais**, copie a URL exibida
(`/api/webhook/<canal>`) e configure-a na plataforma. Entregue mensagens com:
```bash
curl -X POST http://localhost:3060/api/webhook/facebook \
  -H "Authorization: Bearer <SEU_TOKEN_DE_USUARIO>" \
  -H "Content-Type: application/json" \
  -d '{"from":"id_do_cliente","name":"Fulano","text":"oi"}'
```

---

## 🤖 Como o bot funciona

O fluxo do bot é **configurado e processado na plataforma (CRM em :3050)** — o gateway
apenas entrega as mensagens. O ciclo é:

1. **Cliente envia** uma mensagem (WhatsApp/Telegram/…) → o **gateway registra** e disponibiliza no `/api/inbox`.
2. **A plataforma lê** a mensagem (polling), **executa o fluxo do bot** (`src/lib/botProcessor.ts`, fluxo configurável) e monta a resposta.
3. **A plataforma envia** a resposta para o gateway (`/api/gateway/send`), que **entrega** ao cliente.
4. **"Falar com humano"** → o bot dispara o handoff: o **atendente assume** e o bot é pausado.
5. **Encerrar atendimento** → o bot volta a responder.

💰 **Tokens:** apenas as respostas do **bot** (`actor: 'bot'`) consomem créditos. Mensagens do **atendente** (`actor: 'operator'`) são gratuitas.

> Como o bot roda no navegador, mantenha a página do CRM (:3050 ou `/sales`) **aberta** para o atendimento automático funcionar.

---

## ⚙️ Configuração (variáveis de ambiente)

Copie `backend/.env.example` para `backend/.env` e ajuste se necessário:

```env
PORT=3060                     # porta do gateway
# DATABASE_PATH=/caminho/db/database.db
BOT_REMINDER_MINUTES=15       # lembrete de inatividade
BOT_RESET_MINUTES=30          # reset da conversa por inatividade
# WHATSAPP_INTEGRATION_MODE=sandbox   # use 'sandbox' para simular sem Baileys
```

Centralizador (`centralizer/`):
```env
PORT=8080
GATEWAY_URL=http://localhost:3060
```

---

## 🌐 Expor online com ngrok

```bash
ngrok http 8080
```
Abra a URL pública do ngrok:
- `https://SEU-TUNEL.ngrok-free.app/sales/` → CRM
- `https://SEU-TUNEL.ngrok-free.app/connection/` → Painel do Gateway

Tudo resolve a URL da API **dinamicamente** pelo endereço atual — funciona sem configurar IP/porta.

---

## 🧪 Testando o bot (sem precisar de WhatsApp real)

Há um endpoint de teste que injeta uma mensagem no **mesmo handler** do WhatsApp:
```bash
curl -X POST http://localhost:3060/api/dev/sim-wa \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_1","from":"5531998877665","name":"Joana","text":"oi"}'
```
A resposta mostra `botReplied: true` e o texto que o bot enviaria. O contato aparece em **Contatos Recentes**.

---

## 📡 Principais endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Login unificado (detecta admin/cliente) |
| `POST` | `/api/send-message` | Disparo de mensagem (Bearer token) |
| `GET`  | `/api/inbox?since=<id>` | Feed de mensagens para o front (com origem) |
| `GET`  | `/api/contacts/:userId` | Contatos recentes do vendedor |
| `GET`  | `/api/stats/:userId` | Estatísticas de uso (gráfico) |
| `GET/POST` | `/api/channels/:userId` | Lista / conecta canais |
| `POST` | `/api/webhook/:channel` | Entrada de FB/IG/X |
| `POST` | `/api/bot/operator-send` | Atendente responde (gratuito) |
| `POST` | `/api/bot/close` | Encerra atendimento e reativa o bot |
| `GET/POST` | `/api/bot/config` | Tempos de inatividade |

> Autenticação: `Authorization: Bearer <token>` (o token de cada usuário aparece no painel → **Configurações → Avançado → API**).

---

## 📁 Estrutura do projeto

```
yummis-whats/
├── src/                  # Frontend CRM (React + Vite)
│   ├── components/       # Telas: AdminChat (omnichannel), CRM, catálogo, etc.
│   ├── lib/gateway.ts    # Resolve a URL do gateway dinamicamente
│   └── App.tsx
├── backend/              # Gateway
│   ├── server.js         # API, Baileys, endpoints
│   ├── botEngine.js      # Motor do bot (fluxo, cadastro, inatividade, handoff)
│   ├── botConfig.js      # Fluxo declarativo + tempos configuráveis
│   ├── telegram.js       # Adapter Telegram (Bot API)
│   ├── db.js             # Conexão SQLite + migrações + seed
│   └── schema.sql        # Schema do banco
├── centralizer/          # Reverse proxy (/sales + /connection)
├── package.json          # Frontend
└── README.md
```

---

## 🛠️ Solução de problemas

- **WhatsApp em loop "Connection Failure"** → a sessão foi deslogada no celular. O sistema limpa as credenciais; basta **re-escanear o QR** em Canais → WhatsApp. Evite parear o mesmo número em duas instâncias ao mesmo tempo.
- **`better-sqlite3` falhou ao instalar** → garanta Node 18+. Em alguns ambientes é preciso ter ferramentas de build (`windows-build-tools` / `build-essential`).
- **Tela branca no `/sales`** → gere o build com `npm run build:sales` (base `/sales/`).

---

## 📜 Licença

Projeto privado. Uso interno — © Guilhermossauro.
