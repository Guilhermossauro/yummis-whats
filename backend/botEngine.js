/**
 * botEngine.js — Registro de mensagens e estado de atendimento.
 *
 * IMPORTANTE: o GATEWAY NÃO processa fluxo de bot. Ele apenas:
 *   - registra as mensagens recebidas (para a plataforma buscar via /api/inbox);
 *   - registra as mensagens enviadas (o que a plataforma mandar enviar);
 *   - controla o estado de atendimento humano (handoff / encerrar).
 *
 * Todo o processamento do fluxo do bot é feito na PLATAFORMA (frontend :3050).
 */
const { db } = require('./db');

const nowISO = () => new Date().toISOString();

function normalizeAddress(address, channel = 'whatsapp') {
  return channel === 'whatsapp' ? String(address).replace(/\D/g, '') : String(address).trim();
}

// ------------------------------------------------------------------
//  Leads + mensagens (somente armazenamento; sem lógica de fluxo)
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

function findLead(address, channel) {
  if (channel) return leadRepo.byAddress(normalizeAddress(address, channel), channel);
  return leadRepo.byAddress(normalizeAddress(address, 'whatsapp'), 'whatsapp')
    || leadRepo.byAddressAnyChannel(String(address).trim());
}

// ------------------------------------------------------------------
//  ENTRADA: registra uma mensagem recebida (sem processar fluxo).
//  A plataforma (frontend) busca via /api/inbox e decide a resposta.
// ------------------------------------------------------------------
function recordIncoming({ ownerId, channel = 'whatsapp', address, name, text }) {
  const addr = normalizeAddress(address, channel);
  if (!addr || !text) return null;

  let lead = leadRepo.byAddress(addr, channel);
  if (!lead) lead = leadRepo.create(addr, ownerId, channel, name);

  persistMessage(lead.id, 'in', text, channel);
  leadRepo.update(lead.id, {
    last_activity: nowISO(),
    ultimo_gatilho: nowISO(),
    owner_id: ownerId,
    // atualiza o nome do contato se ainda for o placeholder
    ...(name && lead.nome === 'Novo contato' ? { nome: name } : {}),
  });
  return lead;
}

// ------------------------------------------------------------------
//  SAÍDA: registra uma mensagem enviada (o que a plataforma mandou).
// ------------------------------------------------------------------
function recordOutgoing(address, channel, text, ownerId, prefix = '') {
  const addr = normalizeAddress(address, channel);
  let lead = leadRepo.byAddress(addr, channel);
  if (!lead) lead = leadRepo.create(addr, ownerId, channel);
  persistMessage(lead.id, 'out', prefix + text, channel);
  leadRepo.update(lead.id, { last_activity: nowISO() });
  return lead;
}

// ------------------------------------------------------------------
//  Estado de atendimento humano (handoff / encerrar)
// ------------------------------------------------------------------
function handoff(address, channel) {
  const lead = findLead(address, channel);
  if (lead) leadRepo.update(lead.id, { bot_pausado: 1 });
  return lead;
}

async function closeService(address, send, channel) {
  const lead = findLead(address, channel);
  if (!lead) return null;
  leadRepo.update(lead.id, { bot_pausado: 0, last_activity: nowISO() });
  if (send) {
    const msg = '✅ Atendimento encerrado pelo nosso time. Você voltou a falar com o assistente. 🙌';
    await send(msg);
    persistMessage(lead.id, 'out', msg, lead.channel);
  }
  return lead;
}

// Operador envia mensagem manual -> pausa o bot (assume atendimento). GRATUITO.
async function operatorSend(address, text, send, channel = 'whatsapp') {
  const addr = normalizeAddress(address, channel);
  let lead = leadRepo.byAddress(addr, channel);
  if (!lead) lead = leadRepo.create(addr, null, channel);
  leadRepo.update(lead.id, { bot_pausado: 1, last_activity: nowISO() });
  await send(text);
  persistMessage(lead.id, 'out', `[operador] ${text}`, lead.channel);
  return lead;
}

module.exports = {
  recordIncoming,
  recordOutgoing,
  handoff,
  closeService,
  operatorSend,
  findLead,
};
