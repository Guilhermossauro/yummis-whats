-- ==========================================
--  SCHEMA DO BANCO LOCAL (SQLite)
--  Painel Moda Express + Gateway WhatsApp
--  Executado automaticamente por db.js na 1a inicializacao.
-- ==========================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ------------------------------------------------------------------
--  PARTE 1 — Tabelas do bot/e-commerce (originais do schema.sql)
-- ------------------------------------------------------------------

-- 1. Lojistas / Administradores
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    whatsapp_config_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Produtos
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT NULL,
    preco DECIMAL(10, 2) NOT NULL,
    foto_path VARCHAR(255) NULL,
    estoque INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Leads / Prospects no WhatsApp
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone VARCHAR(30) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    status_funil VARCHAR(50) DEFAULT 'CARRINHO_ABERTO',
    ultimo_gatilho TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bot_pausado INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Itens persistentes de carrinho
CREATE TABLE IF NOT EXISTS carts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantidade INTEGER DEFAULT 1,
    size VARCHAR(10) DEFAULT 'U',
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 5. Pedidos / Faturamento Pix
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status_pagamento VARCHAR(30) DEFAULT 'PENDENTE',
    pix_copia_cola TEXT NULL,
    transaction_id VARCHAR(100) NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 6. Histórico Omnichannel de mensagens
CREATE TABLE IF NOT EXISTS messages_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    direcao VARCHAR(10) NOT NULL,
    texto TEXT NOT NULL,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_products_codigo ON products(codigo);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_status_funil ON leads(status_funil);
CREATE INDEX IF NOT EXISTS idx_carts_lead_id ON carts(lead_id);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_log_lead_id ON messages_log(lead_id);

-- ------------------------------------------------------------------
--  PARTE 2 — Tabelas do Gateway WhatsApp (substituem o db.json)
-- ------------------------------------------------------------------

-- Conta administrativa do gateway (linha unica id=1)
CREATE TABLE IF NOT EXISTS gateway_admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL
);

-- Usuarios/lojistas do gateway com seus tokens de API de disparo
CREATE TABLE IF NOT EXISTS gateway_users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    token VARCHAR(120) UNIQUE NOT NULL,
    tokens_count INTEGER,
    expiration_date VARCHAR(40),
    created_at VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_gateway_users_token ON gateway_users(token);
