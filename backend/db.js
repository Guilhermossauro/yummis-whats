/**
 * db.js — Camada de conexao com o banco local SQLite.
 *
 * - Cria a pasta ./db e o arquivo database.db automaticamente.
 * - Executa schema.sql na primeira inicializacao.
 * - Faz seed do admin e de um usuario lojista padrao.
 * - Migra um db.json legado (se existir) para a tabela gateway_users.
 *
 * Caminho do banco configuravel via variavel de ambiente DATABASE_PATH.
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'db');
const DB_PATH = process.env.DATABASE_PATH || path.join(DB_DIR, 'database.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Garante a pasta do banco
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Executa o schema (idempotente — todas as tabelas usam IF NOT EXISTS)
db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Migração idempotente: colunas de estado do bot na tabela leads.
// (SQLite não tem ADD COLUMN IF NOT EXISTS, então checamos antes.)
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn('leads', 'cadastrado', 'cadastrado INTEGER DEFAULT 0');   // 0 = lead novo, 1 = cadastrado
ensureColumn('leads', 'bot_step', 'bot_step VARCHAR(60)');             // bloco atual do fluxo
ensureColumn('leads', 'reminded', 'reminded INTEGER DEFAULT 0');       // lembrete de inatividade já enviado
ensureColumn('leads', 'owner_id', 'owner_id VARCHAR(64)');            // usuário/gateway dono da conexão
ensureColumn('leads', 'email', 'email VARCHAR(160)');                 // capturado no cadastro
ensureColumn('leads', 'last_activity', 'last_activity VARCHAR(40)');  // ISO da última interação
ensureColumn('leads', 'channel', "channel VARCHAR(20) DEFAULT 'whatsapp'");        // canal de origem do lead
ensureColumn('messages_log', 'channel', "channel VARCHAR(20) DEFAULT 'whatsapp'"); // canal de origem da mensagem
ensureColumn('messages_log', 'bot_processed', 'bot_processed INTEGER DEFAULT 0');  // trava anti-resposta duplicada entre abas
// Cadastro de loja com aprovação do administrador (status active = liberado)
ensureColumn('gateway_users', 'status', "status VARCHAR(20) DEFAULT 'active'");    // active | pending | blocked
ensureColumn('gateway_users', 'store_name', 'store_name VARCHAR(150)');            // nome da loja
ensureColumn('gateway_users', 'store_banner_url', 'store_banner_url TEXT');        // banner público da vitrine
ensureColumn('gateway_users', 'store_logo_url', 'store_logo_url TEXT');            // logo pública da vitrine
ensureColumn('products', 'owner_id', "owner_id VARCHAR(64) DEFAULT 'user_1'");     // loja dona do catálogo
ensureColumn('products', 'categories', "categories TEXT DEFAULT '[]'");
ensureColumn('products', 'has_shipping', 'has_shipping INTEGER DEFAULT 0');
ensureColumn('products', 'shipping_type', "shipping_type VARCHAR(20) DEFAULT 'paid'");
ensureColumn('products', 'shipping_cost', 'shipping_cost DECIMAL(10, 2) DEFAULT 0');
ensureColumn('gateway_users', 'store_layout', "store_layout VARCHAR(40) DEFAULT 'ecommerce'");
ensureColumn('gateway_users', 'storefront_config', "storefront_config TEXT DEFAULT '{}'");

function migrateLeadsOwnership() {
  const indexes = db.prepare("PRAGMA index_list('leads')").all();
  const hasGlobalPhoneUnique = indexes.some((idx) => idx.unique && String(idx.name || '').includes('autoindex'));
  if (!hasGlobalPhoneUnique) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_leads_owner_channel_phone ON leads(owner_id, channel, telefone)');
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS leads_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telefone VARCHAR(80) NOT NULL,
        nome VARCHAR(100) NOT NULL,
        status_funil VARCHAR(50) DEFAULT 'CARRINHO_ABERTO',
        ultimo_gatilho TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        bot_pausado INTEGER DEFAULT 0,
        cadastrado INTEGER DEFAULT 0,
        bot_step VARCHAR(60),
        reminded INTEGER DEFAULT 0,
        owner_id VARCHAR(64),
        email VARCHAR(160),
        last_activity VARCHAR(40),
        channel VARCHAR(20) DEFAULT 'whatsapp',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO leads_new
        (id, telefone, nome, status_funil, ultimo_gatilho, bot_pausado, cadastrado, bot_step,
         reminded, owner_id, email, last_activity, channel, created_at)
      SELECT id, telefone, nome, status_funil, ultimo_gatilho, bot_pausado, COALESCE(cadastrado, 0), bot_step,
             COALESCE(reminded, 0), owner_id, email, last_activity, COALESCE(channel, 'whatsapp'), created_at
        FROM leads;
      DROP TABLE leads;
      ALTER TABLE leads_new RENAME TO leads;
      CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
      CREATE INDEX IF NOT EXISTS idx_leads_owner_channel_phone ON leads(owner_id, channel, telefone);
    `);
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateLeadsOwnership();

// Versões antigas criavam products.codigo como UNIQUE global. Para multi-loja,
// o mesmo código pode existir em lojas diferentes, então reconstruímos a tabela
// sem UNIQUE global e adicionamos UNIQUE(owner_id, codigo).
function migrateProductsOwnership() {
  const indexes = db.prepare("PRAGMA index_list('products')").all();
  const hasGlobalCodigoUnique = indexes.some((idx) => idx.unique && String(idx.name || '').includes('autoindex'));
  if (!hasGlobalCodigoUnique) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_owner_codigo ON products(owner_id, codigo)');
    return;
  }

  db.exec('PRAGMA foreign_keys = OFF');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS products_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id VARCHAR(64) DEFAULT 'user_1',
        codigo VARCHAR(50) NOT NULL,
        nome VARCHAR(150) NOT NULL,
        descricao TEXT NULL,
        preco DECIMAL(10, 2) NOT NULL,
        foto_path VARCHAR(255) NULL,
        categories TEXT DEFAULT '[]',
        estoque INTEGER DEFAULT 0,
        has_shipping INTEGER DEFAULT 0,
        shipping_type VARCHAR(20) DEFAULT 'paid',
        shipping_cost DECIMAL(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO products_new
        (id, owner_id, codigo, nome, descricao, preco, foto_path, categories, estoque, has_shipping, shipping_type, shipping_cost, created_at)
      SELECT id, COALESCE(owner_id, 'user_1'), codigo, nome, descricao, preco, foto_path, COALESCE(categories, '[]'), estoque,
             COALESCE(has_shipping, 0), COALESCE(shipping_type, 'paid'), COALESCE(shipping_cost, 0), created_at
        FROM products;
      DROP TABLE products;
      ALTER TABLE products_new RENAME TO products;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_products_owner_codigo ON products(owner_id, codigo);
      CREATE INDEX IF NOT EXISTS idx_products_owner ON products(owner_id);
    `);
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateProductsOwnership();

// Conexões de canais de mensagem por usuário (WhatsApp, Telegram, Facebook, Instagram, X)
db.exec(`
  CREATE TABLE IF NOT EXISTS channel_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(64) NOT NULL,
    channel VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    config TEXT NOT NULL DEFAULT '{}',
    updated_at VARCHAR(40),
    UNIQUE(user_id, channel)
  );
`);

// ------------------------------------------------------------------
//  Seed / migracao inicial do Gateway
// ------------------------------------------------------------------
function seedGateway() {
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM gateway_admin').get().c;
  if (adminCount === 0) {
    db.prepare('INSERT INTO gateway_admin (id, username, password) VALUES (1, ?, ?)')
      .run('admin', '123');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM gateway_users').get().c;
  if (userCount === 0) {
    // Tenta migrar de um db.json legado antes de criar o usuario padrao
    const legacyPath = path.join(__dirname, 'db.json');
    let migrated = false;
    if (fs.existsSync(legacyPath)) {
      try {
        const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
        if (legacy.admin) {
          db.prepare('UPDATE gateway_admin SET username = ?, password = ? WHERE id = 1')
            .run(legacy.admin.username, legacy.admin.password);
        }
        const insert = db.prepare(
          `INSERT OR IGNORE INTO gateway_users
             (id, username, password, token, tokens_count, expiration_date, created_at)
           VALUES (@id, @username, @password, @token, @tokens_count, @expiration_date, @created_at)`
        );
        const insertMany = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
        insertMany((legacy.users || []).map((u) => ({
          id: u.id,
          username: u.username,
          password: u.password,
          token: u.token,
          tokens_count: u.tokensCount ?? null,
          expiration_date: u.expirationDate ?? null,
          created_at: u.createdAt ?? new Date().toISOString(),
        })));
        migrated = (legacy.users || []).length > 0;
        // Arquiva o db.json legado para nao re-migrar
        fs.renameSync(legacyPath, legacyPath + '.migrated');
        console.log('🔄 db.json legado migrado para SQLite e arquivado como db.json.migrated');
      } catch (err) {
        console.warn('⚠️ Falha ao migrar db.json legado:', err.message);
      }
    }

    if (!migrated) {
      db.prepare(
        `INSERT INTO gateway_users
           (id, username, password, token, tokens_count, expiration_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('user_1', 'lojista', '123', 'api_token_lojista_3050_default', 5000, null, new Date().toISOString());
    }
  }
}
seedGateway();

// Seed de catálogo (apenas se a tabela products estiver vazia) para que as
// consultas do bot ao banco tenham dados reais já de início.
function seedCatalog() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM products WHERE owner_id = 'user_1'").get().c;
  if (count > 0) return;
  const insert = db.prepare(
    'INSERT INTO products (owner_id, codigo, nome, descricao, preco, estoque) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const seed = db.transaction((rows) => rows.forEach((r) => insert.run(...r)));
  seed([
    ['user_1', 'VST001', 'Vestido Floral Verão', 'Vestido leve estampa floral', 159.9, 25],
    ['user_1', 'BLS002', 'Blusa Cropped Canelada', 'Blusa cropped básica', 79.9, 40],
    ['user_1', 'CAL003', 'Calça Pantalona Alfaiataria', 'Calça pantalona cintura alta', 199.9, 15],
    ['user_1', 'SAI004', 'Saia Midi Plissada', 'Saia midi plissada elegante', 129.9, 0],
    ['user_1', 'CON005', 'Conjunto Tricot Premium', 'Conjunto tricot duas peças', 249.9, 12],
  ]);
}
seedCatalog();

// ------------------------------------------------------------------
//  Repositorio do Gateway (usado pelo server.js)
//  Converte snake_case do banco -> camelCase usado pela API.
// ------------------------------------------------------------------
function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    token: row.token,
    tokensCount: row.tokens_count,
    expirationDate: row.expiration_date,
    createdAt: row.created_at,
    status: row.status || 'active',
    storeName: row.store_name || null,
    storeBannerUrl: row.store_banner_url || null,
    storeLogoUrl: row.store_logo_url || null,
    storeLayout: row.store_layout || 'ecommerce',
    storefrontConfig: safeParse(row.storefront_config),
  };
}

const gateway = {
  getAdmin() {
    return db.prepare('SELECT username, password FROM gateway_admin WHERE id = 1').get();
  },
  listUsers() {
    return db.prepare('SELECT * FROM gateway_users ORDER BY created_at').all().map(mapUser);
  },
  getUserById(id) {
    return mapUser(db.prepare('SELECT * FROM gateway_users WHERE id = ?').get(id));
  },
  getUserByUsername(username) {
    return mapUser(
      db.prepare('SELECT * FROM gateway_users WHERE lower(username) = lower(?)').get(username)
    );
  },
  getUserByToken(token) {
    return mapUser(db.prepare('SELECT * FROM gateway_users WHERE token = ?').get(token));
  },
  createUser(u) {
    db.prepare(
      `INSERT INTO gateway_users
         (id, username, password, token, tokens_count, expiration_date, created_at, status, store_name, store_banner_url, store_logo_url, store_layout, storefront_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(u.id, u.username, u.password, u.token, u.tokensCount, u.expirationDate, u.createdAt, u.status || 'active', u.storeName || null, u.storeBannerUrl || null, u.storeLogoUrl || null, u.storeLayout || 'ecommerce', JSON.stringify(u.storefrontConfig || {}));
    return this.getUserById(u.id);
  },
  setStatus(id, status) {
    db.prepare('UPDATE gateway_users SET status = ? WHERE id = ?').run(status, id);
    return this.getUserById(id);
  },
  updateUser(id, fields) {
    const current = this.getUserById(id);
    if (!current) return null;
    const merged = { ...current, ...fields };
    db.prepare(
      `UPDATE gateway_users
         SET username = ?, password = ?, token = ?, tokens_count = ?, expiration_date = ?, status = ?, store_name = ?, store_banner_url = ?, store_logo_url = ?, store_layout = ?, storefront_config = ?
       WHERE id = ?`
    ).run(merged.username, merged.password, merged.token, merged.tokensCount, merged.expirationDate, merged.status, merged.storeName, merged.storeBannerUrl, merged.storeLogoUrl, merged.storeLayout || 'ecommerce', JSON.stringify(merged.storefrontConfig || {}), id);
    return this.getUserById(id);
  },
  deleteUser(id) {
    db.prepare('DELETE FROM gateway_users WHERE id = ?').run(id);
  },
  decrementToken(id) {
    db.prepare('UPDATE gateway_users SET tokens_count = tokens_count - 1 WHERE id = ? AND tokens_count IS NOT NULL').run(id);
  },
};

// ------------------------------------------------------------------
//  Repositorio de conexoes de canais (Telegram, Facebook, Instagram, X...)
//  O WhatsApp tem status "vivo" (sessao Baileys); os demais ficam aqui.
// ------------------------------------------------------------------
const channels = {
  list(userId) {
    return db.prepare('SELECT channel, status, config, updated_at FROM channel_connections WHERE user_id = ?')
      .all(userId)
      .map((r) => ({ ...r, config: safeParse(r.config) }));
  },
  get(userId, channel) {
    const r = db.prepare('SELECT channel, status, config FROM channel_connections WHERE user_id = ? AND channel = ?')
      .get(userId, channel);
    return r ? { ...r, config: safeParse(r.config) } : null;
  },
  upsert(userId, channel, status, config) {
    db.prepare(
      `INSERT INTO channel_connections (user_id, channel, status, config, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, channel) DO UPDATE SET status = excluded.status, config = excluded.config, updated_at = excluded.updated_at`
    ).run(userId, channel, status, JSON.stringify(config || {}), new Date().toISOString());
  },
  setStatus(userId, channel, status) {
    db.prepare('UPDATE channel_connections SET status = ?, updated_at = ? WHERE user_id = ? AND channel = ?')
      .run(status, new Date().toISOString(), userId, channel);
  },
};

function safeParse(s) {
  try { return JSON.parse(s || '{}'); } catch { return {}; }
}

module.exports = { db, gateway, channels, DB_PATH };
