-- ==========================================
-- SCHEMA DEFINITION (schema.sql)
-- Complete and compliant for SQLite or PostgreSQL
-- Built for Moda Express Premium E-commerce Bot
-- ==========================================

-- 1. Table for Lojistas / Administrators
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha_hash VARCHAR(255) NOT NULL,
    whatsapp_config_json TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Table for Products
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

-- 3. Table for Leads / Prospects on WhatsApp
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone VARCHAR(30) UNIQUE NOT NULL,
    nome VARCHAR(100) NOT NULL,
    status_funil VARCHAR(50) DEFAULT 'CARRINHO_ABERTO', -- CARRINHO_ABERTO, AGUARDANDO_PIX, PAGO, CONCLUIDO
    ultimo_gatilho TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    bot_pausado INTEGER DEFAULT 0, -- 0 = Bot respondendo automático, 1 = Pausado para suporte humano
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table for Persistent Cart items
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

-- 5. Table for Orders / Faturamento Pix
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    status_pagamento VARCHAR(30) DEFAULT 'PENDENTE', -- PENDENTE, PAGO, CANCELADO
    pix_copia_cola TEXT NULL,
    transaction_id VARCHAR(100) NULL,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- 6. Table for Message Log Omnichannel History
CREATE TABLE IF NOT EXISTS messages_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    direcao VARCHAR(10) NOT NULL, -- 'in' (recebida), 'out' (enviada)
    texto TEXT NOT NULL,
    data_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Strategical Performance Indexes
CREATE INDEX IF NOT EXISTS idx_products_codigo ON products(codigo);
CREATE INDEX IF NOT EXISTS idx_leads_telefone ON leads(telefone);
CREATE INDEX IF NOT EXISTS idx_leads_status_funil ON leads(status_funil);
CREATE INDEX IF NOT EXISTS idx_carts_lead_id ON carts(lead_id);
CREATE INDEX IF NOT EXISTS idx_orders_lead_id ON orders(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_log_lead_id ON messages_log(lead_id);
