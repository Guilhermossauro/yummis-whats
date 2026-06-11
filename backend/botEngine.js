/**
 * botEngine.js — Motor de atendimento do bot (lado servidor / Baileys).
 *
 * Responsabilidades:
 *  - Receber mensagens privadas reais e executar o fluxo (botConfig.FLOW).
 *  - Cadastrar leads novos e persistir tudo no SQLite.
 *  - Consultar o banco (catálogo, pedidos, sacola) dentro do fluxo.
 *  - Handoff humano: ao operador assumir, o bot fica pausado até "encerrar".
 *  - Timers de inatividade configuráveis (lembrete e reset).
 */
const { db } = require('./db');
const { CONFIG, FLOW, START_REGISTERED, START_UNREGISTERED } = require('./botConfig');

const nowISO = () => new Date().toISOString();

// Normaliza o endereço do contato por canal:
//  - whatsapp: somente dígitos (telefone)
//  - demais canais (telegram, facebook, instagram, x): id bruto do canal
function normalizeAddress(address, channel = 'whatsapp') {
  return channel === 'whatsapp' ? String(address).replace(/\D/g, '') : String(address).trim();
}

// ------------------------------------------------------------------
//  Repositório de leads (estado da conversa)
// ------------------------------------------------------------------
const leadRepo = {
  byAddress(address, channel = 'whatsapp') {
    return db.prepare('SELECT * FROM leads WHERE telefone = ? AND channel = ?').get(address, channel);
  },
  byAddressAnyChannel(address) {
    return db.prepare('SELECT * FROM leads WHERE telefone = ?').get(address);
  },
  create(address, ownerId, channel = 'whatsapp', name) {
    const info = db
      .prepare(
        `INSERT INTO leads (telefone, nome, status_funil, bot_pausado, cadastrado, bot_step, reminded, owner_id, channel, last_activity, ultimo_gatilho)
         VALUES (?, ?, 'CARRINHO_ABERTO', 0, 0, NULL, 0, ?, ?, ?, ?)`
      )
      .run(address, name || 'Novo contato', ownerId, channel, nowISO(), nowISO());
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(info.lastInsertRowid);
  },
  update(id, fields) {
    const keys = Object.keys(fields);
    if (!keys.length) return;
    db.prepare(`UPDATE leads SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...keys.map((k) => fields[k]), id);
  },
};

function persistMessage(leadId, direcao, texto, channel = 'whatsapp') {
  db.prepare('INSERT INTO messages_log (lead_id, direcao, texto, channel) VALUES (?, ?, ?, ?)')
    .run(leadId, direcao, texto, channel);
}

function interpolate(text, lead) {
  return String(text).replace(/\{nome\}/g, (lead.nome && lead.nome !== 'Novo contato') ? lead.nome : 'cliente');
}

// ------------------------------------------------------------------
//  Resolvers dinâmicos — LEEM O BANCO DE DADOS
// ------------------------------------------------------------------
const DYNAMIC = {
  listarProdutos() {
    const rows = db.prepare('SELECT codigo, nome, preco, estoque FROM products ORDER BY id LIMIT 8').all();
    if (!rows.length) return '👗 Nosso catálogo está sendo atualizado. Volte em breve!';
    const linhas = rows
      .map((p) => `• *${p.nome}* (cód ${p.codigo}) — R$ ${Number(p.preco).toFixed(2)} ${p.estoque > 0 ? '' : '(esgotado)'}`)
      .join('\n');
    return `👗 *CATÁLOGO* (consulta ao banco \`products\`)\n\n${linhas}\n\nDigite o número de uma opção do menu para continuar.`;
  },
  listarPedidos(lead) {
    const rows = db
      .prepare('SELECT id, total, status_pagamento, data_criacao FROM orders WHERE lead_id = ? ORDER BY id DESC LIMIT 5')
      .all(lead.id);
    if (!rows.length) return '📦 Você ainda não possui pedidos registrados no nosso banco.';
    const linhas = rows
      .map((o) => `• Pedido #${o.id} — R$ ${Number(o.total).toFixed(2)} — *${o.status_pagamento}*`)
      .join('\n');
    return `📦 *SEUS PEDIDOS* (consulta ao banco \`orders\`)\n\n${linhas}`;
  },
  listarSacola(lead) {
    const rows = db
      .prepare(
        `SELECT c.quantidade, c.size, p.nome, p.preco
           FROM carts c JOIN products p ON p.id = c.product_id
          WHERE c.lead_id = ?`
      )
      .all(lead.id);
    if (!rows.length) return '🛒 Sua sacola está vazia no momento.';
    let total = 0;
    const linhas = rows
      .map((i) => {
        total += Number(i.preco) * i.quantidade;
        return `• ${i.quantidade}x ${i.nome} (${i.size}) — R$ ${(Number(i.preco) * i.quantidade).toFixed(2)}`;
      })
      .join('\n');
    return `🛒 *SUA SACOLA* (consulta ao banco \`carts\`)\n\n${linhas}\n\n*Total:* R$ ${total.toFixed(2)}`;
  },
};

// ------------------------------------------------------------------
//  Execução do fluxo
// ------------------------------------------------------------------
async function enter(lead, blockId, send) {
  let safety = 0;
  while (blockId && safety++ < 25) {
    const block = FLOW[blockId];
    if (!block) {
      leadRepo.update(lead.id, { bot_step: null });
      return;
    }

    // 1) Mensagem (fixa ou dinâmica do banco)
    let msg = null;
    if (block.text) msg = interpolate(block.text, lead);
    else if (block.dynamic && DYNAMIC[block.dynamic]) msg = DYNAMIC[block.dynamic](lead);
    if (msg) {
      await send(msg);
      persistMessage(lead.id, 'out', msg, lead.channel);
    }

    // 2) Efeitos colaterais
    if (block.action === 'register') {
      lead.cadastrado = 1;
      leadRepo.update(lead.id, { cadastrado: 1, nome: lead.nome, email: lead.email || null });
    }
    if (block.action === 'pause_bot') {
      leadRepo.update(lead.id, { bot_pausado: 1, bot_step: null });
      return;
    }

    // 3) O que aguardar
    if (block.options) {
      leadRepo.update(lead.id, { bot_step: blockId });
      return;
    }
    if (block.expects === 'text') {
      leadRepo.update(lead.id, { bot_step: blockId });
      return;
    }
    if (block.next) {
      blockId = block.next; // auto-avança (encadeado)
      continue;
    }
    leadRepo.update(lead.id, { bot_step: null });
    return;
  }
}

async function process(lead, step, text, send) {
  const block = FLOW[step];
  if (!block) {
    return enter(lead, lead.cadastrado ? START_REGISTERED : START_UNREGISTERED, send);
  }

  if (block.expects === 'text') {
    const value = text.trim();
    if (block.capture) {
      lead[block.capture] = value;
      leadRepo.update(lead.id, { [block.capture]: value });
    }
    return enter(lead, block.next, send);
  }

  if (block.options) {
    const target = block.options[text.trim()];
    if (target) return enter(lead, target, send);
    await send('❌ Opção inválida. Por favor, digite apenas o número de uma das opções.');
    persistMessage(lead.id, 'out', '❌ Opção inválida.', lead.channel);
    return enter(lead, step, send); // re-renderiza o menu atual
  }

  return enter(lead, lead.cadastrado ? START_REGISTERED : START_UNREGISTERED, send);
}

// ------------------------------------------------------------------
//  Entrada principal: mensagem privada recebida de QUALQUER canal.
//  { ownerId, channel, address, name?, text, send }
//  send(text) envia pela conexão do canal de origem.
// ------------------------------------------------------------------
async function handleIncoming({ ownerId, channel = 'whatsapp', address, phone, name, text, send }) {
  const addr = normalizeAddress(address ?? phone, channel);
  if (!addr || !text) return;

  let lead = leadRepo.byAddress(addr, channel);
  if (!lead) lead = leadRepo.create(addr, ownerId, channel, name);

  // Persistir mensagem recebida (com canal de origem) e marcar atividade
  persistMessage(lead.id, 'in', text, channel);
  leadRepo.update(lead.id, { last_activity: nowISO(), ultimo_gatilho: nowISO(), reminded: 0, owner_id: ownerId });
  lead.last_activity = nowISO();
  lead.channel = channel;

  // Handoff humano: bot desligado até o operador encerrar
  if (lead.bot_pausado) return;

  // Primeira interação inicia o fluxo (a mensagem é só o gatilho)
  if (!lead.bot_step) {
    const start = lead.cadastrado ? START_REGISTERED : START_UNREGISTERED;
    return enter(lead, start, send);
  }
  return process(lead, lead.bot_step, text, send);
}

// ------------------------------------------------------------------
//  Handoff humano (channel-aware; default whatsapp)
// ------------------------------------------------------------------
function findLead(address, channel) {
  if (channel) return leadRepo.byAddress(normalizeAddress(address, channel), channel);
  // sem canal informado: tenta whatsapp normalizado, depois endereço bruto
  return leadRepo.byAddress(normalizeAddress(address, 'whatsapp'), 'whatsapp')
    || leadRepo.byAddressAnyChannel(String(address).trim());
}

function handoff(address, channel) {
  const lead = findLead(address, channel);
  if (lead) leadRepo.update(lead.id, { bot_pausado: 1, bot_step: null });
  return lead;
}

async function closeService(address, send, channel) {
  const lead = findLead(address, channel);
  if (!lead) return null;
  leadRepo.update(lead.id, { bot_pausado: 0, bot_step: null, reminded: 0, last_activity: nowISO() });
  if (send) {
    const msg = '✅ Atendimento encerrado pelo nosso time. O assistente virtual voltou a responder. Envie *oi* quando precisar! 🙌';
    await send(msg);
    persistMessage(lead.id, 'out', msg, lead.channel);
  }
  return lead;
}

// Operador envia mensagem manual -> pausa o bot automaticamente (assume atendimento)
async function operatorSend(address, text, send, channel = 'whatsapp') {
  const addr = normalizeAddress(address, channel);
  let lead = leadRepo.byAddress(addr, channel);
  if (!lead) lead = leadRepo.create(addr, null, channel);
  leadRepo.update(lead.id, { bot_pausado: 1, bot_step: null, last_activity: nowISO() });
  await send(text);
  persistMessage(lead.id, 'out', `[operador] ${text}`, lead.channel);
  return lead;
}

// ------------------------------------------------------------------
//  Timers de inatividade (lembrete + reset) — configuráveis
//  resolveSendForLead(lead) -> send(text) pela conexão do canal do lead
//  (ou null se aquele canal/usuário estiver desconectado)
// ------------------------------------------------------------------
let scannerHandle = null;
function startInactivityScanner(resolveSendForLead) {
  if (scannerHandle) clearInterval(scannerHandle);
  scannerHandle = setInterval(async () => {
    try {
      // Apenas conversas ativas e NÃO sob atendimento humano
      const leads = db
        .prepare('SELECT * FROM leads WHERE bot_step IS NOT NULL AND bot_pausado = 0 AND last_activity IS NOT NULL')
        .all();
      const now = Date.now();
      for (const lead of leads) {
        const diffMin = (now - new Date(lead.last_activity).getTime()) / 60000;
        const send = resolveSendForLead(lead);
        if (!send) continue;

        if (diffMin >= CONFIG.resetMinutes) {
          const msg = '⌛ Encerrei este atendimento por inatividade. Quando quiser retomar, é só me enviar *oi*! 👋';
          await send(msg);
          persistMessage(lead.id, 'out', msg, lead.channel);
          leadRepo.update(lead.id, { bot_step: null, reminded: 0 });
        } else if (diffMin >= CONFIG.reminderMinutes && !lead.reminded) {
          const nome = lead.nome && lead.nome !== 'Novo contato' ? lead.nome : 'cliente';
          const msg = `👋 Oi, ${nome}! Você ainda está por aí? Continuo à disposição para concluir seu atendimento. 😊`;
          await send(msg);
          persistMessage(lead.id, 'out', msg, lead.channel);
          leadRepo.update(lead.id, { reminded: 1 });
        }
      }
    } catch (err) {
      console.error('[botEngine] erro no scanner de inatividade:', err.message);
    }
  }, 60 * 1000);
  console.log(`🤖 Bot ativo — lembrete em ${CONFIG.reminderMinutes}min, reset em ${CONFIG.resetMinutes}min (configurável).`);
}

module.exports = {
  handleIncoming,
  handoff,
  closeService,
  operatorSend,
  findLead,
  startInactivityScanner,
  CONFIG,
};
