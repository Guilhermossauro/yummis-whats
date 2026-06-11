/**
 * telegram.js — Adapter de canal Telegram (Bot API, long-polling).
 *
 * Roda DENTRO do backend, sem dependências externas (usa fetch nativo do Node).
 * Cada usuário do gateway pode vincular o próprio bot do Telegram informando o
 * token do @BotFather. Mensagens privadas recebidas são roteadas ao botEngine
 * com channel='telegram'.
 */

const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

// userId -> { token, running, offset, lastError, botName }
const sessions = new Map();

function status(userId) {
  const s = sessions.get(userId);
  if (!s) return { status: 'DISCONNECTED' };
  return {
    status: s.running ? 'CONNECTED' : 'DISCONNECTED',
    botName: s.botName || null,
    lastError: s.lastError || null,
  };
}

async function start(userId, token, onMessage, log = console.log) {
  stop(userId);
  const session = { token, running: true, offset: 0, lastError: null, botName: null };
  sessions.set(userId, session);

  // Valida o token
  try {
    const me = await (await fetch(API(token, 'getMe'))).json();
    if (!me.ok) throw new Error(me.description || 'Token inválido');
    session.botName = '@' + me.result.username;
    log(`[telegram:${userId}] conectado como ${session.botName}`);
  } catch (err) {
    session.running = false;
    session.lastError = err.message;
    throw new Error(`Telegram: ${err.message}`);
  }

  // Loop de long-polling (não bloqueia; roda em background)
  (async () => {
    while (session.running && sessions.get(userId) === session) {
      try {
        const res = await fetch(API(token, 'getUpdates') + `?timeout=25&offset=${session.offset}`, {
          signal: AbortSignal.timeout(35000),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.description || 'getUpdates falhou');
        for (const upd of data.result) {
          session.offset = upd.update_id + 1;
          const msg = upd.message;
          // Somente mensagens privadas de texto
          if (!msg || msg.chat?.type !== 'private' || !msg.text) continue;
          const chatId = String(msg.chat.id);
          const name = [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') || msg.from?.username;
          try {
            await onMessage({ chatId, name, text: msg.text });
          } catch (e) {
            log(`[telegram:${userId}] erro no bot: ${e.message}`);
          }
        }
      } catch (err) {
        if (!session.running) break;
        session.lastError = err.message;
        await new Promise((r) => setTimeout(r, 4000)); // backoff
      }
    }
  })();

  return session.botName;
}

function stop(userId) {
  const s = sessions.get(userId);
  if (s) {
    s.running = false;
    sessions.delete(userId);
  }
}

async function send(userId, chatId, text) {
  const s = sessions.get(userId);
  if (!s || !s.running) throw new Error('Telegram desconectado para este usuário.');
  const res = await fetch(API(s.token, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'sendMessage falhou');
  return data.result;
}

// Envia foto (URL pública). Para base64, cai de volta para texto com a legenda.
async function sendPhoto(userId, chatId, photo, caption) {
  const s = sessions.get(userId);
  if (!s || !s.running) throw new Error('Telegram desconectado para este usuário.');
  if (!/^https?:\/\//i.test(photo)) return send(userId, chatId, caption || '');
  const res = await fetch(API(s.token, 'sendPhoto'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, photo, caption: caption || '', parse_mode: 'Markdown' }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'sendPhoto falhou');
  return data.result;
}

module.exports = { start, stop, send, sendPhoto, status };
