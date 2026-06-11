# Guia de Setup & Deploy de Produção

Este guia detalha o processo passo a passo para implantar o **Painel Administrativo + Robô de Atendimento WhatsApp** em ambientes de hospedagem compartilhada ou VPS (como **Hostinger Cloud Startup**, cPanel, VPS Apache/Nginx).

---

## 1. Requisitos do Sistema & Estrutura
O sistema foi concebido para ser leve, rápido e de baixíssima depêndencia tecnológica. Pode rodar tanto em **Node.js** quanto em servidores **PHP (Apache/cPanel/Hostinger)** integrados com **SQLite** local.

### Estrutura de Pastas de Produção Recomendada
```text
/public_html
  ├── /uploads            <-- [Permissão Escrita 775/777] Caminho para fotos de produtos cadastrados
  ├── /db                 <-- [Permissão Escrita 775/777] Pasta onde reside o arquivo SQLite
  │    └── database.db    <-- [Permissão Escrita 664/666] Arquivo físico SQLite
  ├── index.php / config.php (Se usando PHP) ou server.js (Se usando Node.js)
  └── assets/             <-- Arquivos estáticos do painel (CSS, JS)
```

---

## 2. Permissões de Leitura e Escrita (Crucial para SQLite)

Como o SQLite é um banco de dados em arquivo físico, o servidor web (Apache, Nginx, PHP-FPM, ou Node process) precisa de **permissão de escrita tanto no arquivo de banco quanto na pasta em que o arquivo se localiza** para conseguir criar os arquivos de journal temporários (`.db-journal`, `.db-shm`, `.db-wal`) que gerenciam transações concorrentes.

### Passo a Passo via SSH (Linha de Comando):
Se você tiver acesso terminal à Hospedagem (Ex: Hostinger VPS ou plano Pro SSH):
```bash
# 1. Navegue até o diretório do seu site
cd /home/usuario/public_html

# 2. Crie as pastas necessárias se não existirem
mkdir -p uploads db

# 3. Defina o proprietário para o usuário do servidor web (ex: www-data, apache ou similar)
chown -R www-data:www-data db uploads

# 4. Configure permissão de leitura, escrita e execução nas pastas de dados
chmod 775 db uploads

# 5. Se o arquivo database.db já existir, dê permissão direta nele
chmod 664 db/database.db
```

### Alternativa via Painel Hostinger (Gerenciador de Arquivos):
1. Acesse o **hPanel** da Hostinger ➔ **Gerenciador de Arquivos**.
2. Clique com o botão direito nas pastas `db` e `uploads`.
3. Escolha **Permissões** (Permissions).
4. Marque a permissão de **Gravação** (Write) para o Proprietário, Grupo e Outros (Ajuste para `775` ou, se o provedor exigir, `777` em ambientes controlados).
5. Clique em salvar.

---

## 3. Configurações de Ambiente (`.env` ou `config.php`)

Centralize as chaves do seu webhook e APIs do WhatsApp para não expor segredos no repositório.

### Exemplo de `.env` (Para Node.js/Full-stack):
```env
# Porta do Servidor Web
PORT=3000

# Tipo de Conector de Mensagens (sandbox, baileys, apibrasil)
WHATSAPP_INTEGRATION_MODE=sandbox

# API Key da apiBrasil (Se aplicável)
APIBRASIL_W_API_KEY=seu_token_api_brasil_aqui
APIBRASIL_INSTANC_NAME=sua_instancia_aqui

# Caminho de persistência SQLite
DATABASE_PATH=./db/database.db
```

### Exemplo de `config.php` (Para PHP puro):
```php
<?php
// Central de Configurações Globais
define('DB_PATH', __DIR__ . '/db/database.db');
define('WHATSAPP_MODE', 'sandbox'); // sandbox, baileys, apibrasil
define('APIBRASIL_KEY', 'sua_token_aqui');
define('APIBRASIL_INSTANCE', 'sua_instancia_aqui');

// Função de Conexão SQLite PDO
function getDB() {
    $db = new PDO("sqlite:" . DB_PATH);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    return $db;
}
?>
```

---

## 4. Integração Prática com apiBrasil (WhatsApp Real)

Para habilitar disparos síncronos reais para o celular do cliente pelo WhatsApp via **apiBrasil**, o sistema executa requisições de API POST estruturadas exatamente assim:

### URL do Endpoint da apiBrasil:
`https://api.apibrasil.com.br/v2/whatsapp/sendMessage` (ou URL oficial atualizada do seu plano)

### Cabeçalhos Exigidos (Headers):
```http
Authorization: Bearer [Seu_Token_De_Usuario_apiBrasil]
w-api-key: [Chave_Do_Dispositivo_WhatsApp]
nome: [Nome_Da_Sua_Instancia]
Content-Type: application/json
```

### Payload do JSON Enviado:
```json
{
  "number": "5511999999999",
  "message": "Olá! Seu pedido de número #105 foi gerado com sucesso.\nUse o Pix abaixo para finalizar a compra..."
}
```

---

## 5. Script de Segundo Plano para Recuperação de Abandono

A recuperação automática funciona inspecionando o banco de dados por carrinhos modificados que não completaram a compra.

### Configurar Cronjob no painel da Hostinger:
1. No painel da Hostinger, role até **Avançado** ➔ **Tarefas Cron** (Cron Jobs).
2. Adicione uma nova tarefa para executar a cada 1 hora.
3. Insira o comando de execução de ambiente:
   - **Para PHP:**
     ```bash
     php /home/usuario/public_html/engine_recuperacao.php > /dev/null 2>&1
     ```
   - **Para Node.js (se usando PM2 ou VPS):**
     ```bash
     node /home/usuario/public_html/cron_abandonment.js >> /home/usuario/public_html/db/cron.log 2>&1
     ```

### Lógica Interna de Disparos de Lembretes:
- **Elegibilidade 24h:** Seleciona leads cujo `status_funil` seja `CARRINHO_ABERTO`, que possuam itens na tabela `carts` modificados há mais de 24 horas, e cujo `ultimo_gatilho` de notificação de abandono ainda esteja como `0` (nenhum).
- **Elegibilidade 48h:** Seleciona leads com abandono igual a `1` (que já receberam o primeiro aviso) modificados há mais de 48 horas, aplicando um gatilho de Cupom de Desconto ("Cupom DESCONTO10") para otimizar conversões, e atualiza o marcador técnico de abandono para `2`.

---

## 6. Tratamento de Erros Comuns em Produção

1. Erro: `SQLITE_BUSY: database is locked`
   - **Causa:** O SQLite não suporta múltiplos processos escrevendo simultaneamente se não estiver em alta performance.
   - **Solução:** Ative o modo WAL (Write-Ahead Logging) no SQLite executando a query `PRAGMA journal_mode=WAL;` assim que abrir a conexão. Isso reduz drasticamente conflitos de lock permitindo leituras concomitantes ilimitadas paralelizadas.

2. Erro: `Temporary Folder / Permission Denied on Upload`
   - **Causa:** A pasta `uploads` não possui permissão de leitura pela conta do servidor Apache/Nginx.
   - **Solução:** Defina a permissão da pasta de fotos de produtos como `775` (ou no pior dos casos `777`).

3. Erro: `SSL Certificate / cURL Failure`
   - **Causa:** Sua hospedagem barrou a saída HTTPS do cURL.
   - **Solução:** Garanta que a extensão OpenSSL está ativa no painel do seletor PHP da Hostinger ou que o Node.js possui acesso irrestrito às portas HTTPS de saída.
