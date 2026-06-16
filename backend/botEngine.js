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
  const raw = String(address || '').trim();
  if (channel !== 'whatsapp') return raw;
  if (raw.includes('@')) return raw;
  return raw.replace(/\D/g, '');
}

function whatsappAddressCandidates(address, channel = 'whatsapp') {
  const primary = normalizeAddress(address, channel);
  if (channel !== 'whatsapp') return primary ? [primary] : [];

  const raw = String(address || '').trim();
  const candidates = [];
  const push = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  push(primary);
  if (raw.includes('@')) {
    const bare = raw.split('@')[0].split(':')[0].replace(/\D/g, '');
    push(bare);
  } else {
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 14) push(`${digits}@lid`);
  }
  return candidates;
}

// ------------------------------------------------------------------
//  Leads + mensagens (somente armazenamento; sem lógica de fluxo)
// ------------------------------------------------------------------
const leadRepo = {
  byAddress(address, channel = 'whatsapp', ownerId = null) {
    for (const candidate of whatsappAddressCandidates(address, channel)) {
      const found = ownerId
        ? db.prepare('SELECT * FROM leads WHERE telefone = ? AND channel = ? AND owner_id = ?').get(candidate, channel, ownerId)
        : db.prepare('SELECT * FROM leads WHERE telefone = ? AND channel = ?').get(candidate, channel);
      if (found) return found;

      if (ownerId) {
        const legacy = db.prepare('SELECT * FROM leads WHERE telefone = ? AND channel = ? AND owner_id IS NULL').get(candidate, channel);
        if (legacy) return legacy;
      }
    }
    return null;
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
  const info = db.prepare('INSERT INTO messages_log (lead_id, direcao, texto, channel) VALUES (?, ?, ?, ?)')
    .run(leadId, direcao, texto, channel);
  return db.prepare('SELECT * FROM messages_log WHERE id = ?').get(info.lastInsertRowid);
}

function findLead(address, channel, ownerId = null) {
  if (channel) return leadRepo.byAddress(normalizeAddress(address, channel), channel, ownerId);
  return leadRepo.byAddress(normalizeAddress(address, 'whatsapp'), 'whatsapp', ownerId)
    || leadRepo.byAddressAnyChannel(String(address).trim());
}

// ------------------------------------------------------------------
//  ENTRADA: registra uma mensagem recebida (sem processar fluxo).
//  A plataforma (frontend) busca via /api/inbox e decide a resposta.
// ------------------------------------------------------------------
function recordIncoming({ ownerId, channel = 'whatsapp', address, name, text }) {
  const addr = normalizeAddress(address, channel);
  if (!addr || !text) return null;

  let lead = leadRepo.byAddress(addr, channel, ownerId);
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
  let lead = leadRepo.byAddress(addr, channel, ownerId);
  if (!lead) lead = leadRepo.create(addr, ownerId, channel);
  const message = persistMessage(lead.id, 'out', prefix + text, channel);
  leadRepo.update(lead.id, { last_activity: nowISO() });
  return { lead, message };
}

// ------------------------------------------------------------------
//  Estado de atendimento humano (handoff / encerrar)
// ------------------------------------------------------------------
function handoff(address, channel, ownerId = null) {
  const lead = findLead(address, channel, ownerId);
  if (lead) leadRepo.update(lead.id, { bot_pausado: 1 });
  return lead;
}

function registerLead(address, channel, data = {}, ownerId = null) {
  const lead = findLead(address, channel, ownerId);
  if (!lead) return null;
  leadRepo.update(lead.id, {
    cadastrado: 1,
    nome: data.name || data.nome || lead.nome,
    email: data.email || lead.email || null,
    last_activity: nowISO(),
  });
  return findLead(address, channel, ownerId);
}

async function closeService(address, send, channel, ownerId = null) {
  const lead = findLead(address, channel, ownerId);
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
async function operatorSend(address, text, send, channel = 'whatsapp', operatorName = 'Atendente', ownerId = null) {
  const addr = normalizeAddress(address, channel);
  let lead = leadRepo.byAddress(addr, channel, ownerId);
  if (!lead) lead = leadRepo.create(addr, ownerId, channel);
  leadRepo.update(lead.id, { bot_pausado: 1, last_activity: nowISO() });
  const operatorText = `*${operatorName}*\n${text}`;
  const sendResult = await send(operatorText);
  const message = persistMessage(lead.id, 'out', operatorText, lead.channel);
  return { lead, message, operatorName, sendResult };
}

module.exports = {
  recordIncoming,
  recordOutgoing,
  registerLead,
  handoff,
  closeService,
  operatorSend,
  findLead,
};
