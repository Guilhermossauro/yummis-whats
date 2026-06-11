# Build & Deploy — Painel Moda Express + Gateway WhatsApp

Este projeto tem **2 partes independentes** prontas para subir num servidor:

| Parte | O que é | Pasta | Como roda |
|-------|---------|-------|-----------|
| **Frontend** | Painel React (estático) | `dist/` | Servido por qualquer hospedagem estática (Nginx, Apache, hPanel, Vercel…) |
| **Backend** | Gateway WhatsApp + API + banco SQLite | `backend/` | `node server.js` (Node 18+) |

---

## 1. Frontend (build estático já pronto)

O build de produção já foi gerado em **`dist/`**:

```
dist/
  index.html
  assets/index-*.js
  assets/index-*.css
```

Basta copiar o conteúdo da pasta `dist/` para a raiz pública do seu servidor
(ex.: `public_html/`). É um SPA: configure o servidor para devolver `index.html`
em rotas não encontradas (fallback), se necessário.

Para regerar o build a qualquer momento:

```bash
npm install
npm run build                      # base "/" (frontend isolado)
# ou, para servir sob o centralizador (/sales):
VITE_BASE=/sales/ npm run build    # bash
$env:VITE_BASE="/sales/"; npm run build   # PowerShell
```

> O painel guarda os dados de catálogo/CRM no `localStorage` do navegador.
> A integração de **disparo real** de WhatsApp é feita pelo backend abaixo
> (aba **Conexões & Conta** → modo `baileys_api`, apontando para a URL do backend).

---

## 2. Backend + Banco de dados local (SQLite)

### Estrutura
- `backend/server.js` — API Express + gateway WhatsApp (Baileys).
- `backend/db.js` — conexão com o banco SQLite (cria pasta/arquivo automaticamente).
- `backend/schema.sql` — schema do banco (tabelas do e-commerce + do gateway).
- `backend/db/database.db` — **arquivo do banco** (criado na 1ª execução).

### Rodar localmente / no servidor

```bash
cd backend
npm install          # instala express, better-sqlite3, baileys, etc.
node server.js       # sobe na porta 3060 (ou process.env.PORT)
```

Na **primeira execução** o `db.js`:
1. cria a pasta `db/` e o arquivo `database.db`;
2. executa o `schema.sql` (todas as tabelas);
3. cria o admin padrão e um usuário lojista;
4. se existir um `db.json` legado, **migra** os usuários para o SQLite e arquiva
   o arquivo como `db.json.migrated`.

### Configuração (opcional) — `backend/.env`
Copie `backend/.env.example` para `backend/.env`:

```env
PORT=3060
# DATABASE_PATH=/caminho/absoluto/db/database.db
```

> Em produção (Hostinger/cPanel/VPS) garanta **permissão de escrita** na pasta
> `db/` — o SQLite precisa criar os arquivos `.db-wal` e `.db-shm`.

### Credenciais padrão
- **Admin do gateway:** `admin` / `123`
- **Usuário lojista:** `lojista` / `123` (token de API `api_token_lojista_3050_default`)

Altere-as após o primeiro acesso.

---

## 3. Centralizador (uma só origem) + ngrok  ⭐

Para expor **tudo por um único endereço público** (ideal para ngrok), use o
**servidor centralizador** em `centralizer/`. Ele roteia, na mesma origem:

| Rota | Destino |
|------|---------|
| `/` | redireciona para `/sales/` |
| `/sales/*` | frontend (painel CRM) servido do `dist/` |
| `/connection/*` | gateway WhatsApp (proxy para o backend na 3060) |

### Subir tudo localmente
```bash
# 1. Backend (gateway + banco + Baileys)
cd backend && npm install && node server.js        # porta 3060

# 2. Build do frontend com base /sales/
cd .. && VITE_BASE=/sales/ npm run build            # gera dist/

# 3. Centralizador
cd centralizer && npm install && node index.js      # porta 8080
```

### Expor via ngrok
```bash
ngrok http 8080
```
Abra a URL pública do ngrok:
- `https://SEU-TUNEL.ngrok-free.app/sales/` → painel CRM
- `https://SEU-TUNEL.ngrok-free.app/connection/` → painel do Gateway (QR, token)

**Por que funciona sem configurar IP/porta:** tanto o painel CRM quanto o painel
do Gateway resolvem a URL da API **dinamicamente a partir de `window.location`**.
Sob o centralizador/ngrok o gateway fica em `/connection`, então todas as chamadas
apontam automaticamente para a mesma origem pública.

### Configuração opcional do centralizador (`centralizer`)
- `PORT` — porta do centralizador (padrão `8080`).
- `GATEWAY_URL` — alvo do gateway (padrão `http://localhost:3060`).

---

## 4. Conexão por API no painel — "Yummis API"

Na aba **Conexões & Conta** do painel CRM, a opção de disparo por API agora se
chama **Yummis API** e é o **nosso próprio gateway** (não há mais apiBrasil externo):

1. No painel do Gateway (`/connection`), copie seu **Token de Acesso** e o
   **Endpoint da API** (ambos exibidos automaticamente com a URL atual).
2. No painel CRM → **Conexões & Conta** → **Yummis API**, cole o token. O endpoint
   é preenchido sozinho (deixe em branco para usar a URL dinâmica).

---

## 5. Como as duas partes conversam
O painel (frontend) envia mensagens reais via `POST {URL_DO_BACKEND}/api/send-message`
com header `Authorization: Bearer <token do usuário>`. Configure essa URL e o token
na aba **Conexões & Conta** do painel. Em desenvolvimento o padrão é
`http://localhost:3060/api/send-message`.
