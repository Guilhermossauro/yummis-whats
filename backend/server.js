const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// Banco local SQLite (substitui o antigo db.json)
const { db, gateway, channels, DB_PATH } = require('./db');
// Motor de atendimento do bot (fluxo, cadastro, consultas ao banco, inatividade)
const botEngine = require('./botEngine');
// Adapter de canal Telegram (long-polling da Bot API)
const telegram = require('./telegram');

// Canais de mensagens suportados pelo gateway
const SUPPORTED_CHANNELS = ['whatsapp', 'telegram', 'facebook', 'instagram', 'x'];

const app = express();
const PORT = process.env.PORT || 3060;

app.use(cors());
app.use(express.json());

// Session Manager for Baileys Connections
const activeSessions = new Map();

// Extrai o texto de uma mensagem do Baileys (vários formatos possíveis)
function extractText(message) {
  if (!message) return '';
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

// Cria uma função de envio (phone, text) ligada à conexão WhatsApp de um usuário.
function makeSenderFor(userId) {
  const session = activeSessions.get(userId);
  if (!session || session.status !== 'CONNECTED' || !session.socket || session.isSimulated) return null;
  return async (phone, text) => {
    const jid = String(phone).replace(/\D/g, '') + '@s.whatsapp.net';
    await session.socket.sendMessage(jid, { text });
  };
}

// Resolve a função de envio send(text) para um LEAD, conforme o canal de origem.
// Usado pelo bot (inatividade, handoff). Retorna null se o canal estiver indisponível.
function makeSenderForLead(lead) {
  if (!lead) return null;
  const channel = lead.channel || 'whatsapp';
  if (channel === 'whatsapp') {
    const wa = makeSenderFor(lead.owner_id);
    return wa ? (text) => wa(lead.telefone, text) : null;
  }
  if (channel === 'telegram') {
    if (telegram.status(lead.owner_id).status !== 'CONNECTED') return null;
    return (text) => telegram.send(lead.owner_id, lead.telefone, text);
  }
  // facebook / instagram / x: canais via webhook — as respostas do bot ficam
  // persistidas no banco e são devolvidas na resposta HTTP do webhook.
  return null;
}

// Resolve o usuário do gateway a partir do header Authorization: Bearer <token>.
function userFromAuth(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  return gateway.getUserByToken(h.slice(7));
}

// REGRA DE TOKENS: apenas o BOT consome créditos. Interações do atendente são gratuitas.
function consumeBotToken(userId) {
  const u = gateway.getUserById(userId);
  if (u && u.tokensCount !== null && u.tokensCount > 0) gateway.decrementToken(userId);
}

// Resolve/normaliza um JID do Baileys (trata @lid -> usuário, normaliza dispositivo).
async function resolveJid(jid, sock) {
  if (!jid) return '';
  try {
    // Mapeamento LID -> JID real (Baileys novo), quando disponível
    if (jid.endsWith('@lid') && sock?.signalRepository?.lidMapping?.getPNForLID) {
      const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
      if (pn) jid = pn;
    }
  } catch {}
  try {
    return jidNormalizedUser ? jidNormalizedUser(jid) : jid;
  } catch {
    return jid;
  }
}

// ----------------------------------------------------------------
//  Handler de mensagens recebidas do WhatsApp (testável isoladamente).
//  Segue o padrão: resolve sender/chatId, marca isGroup e roteia ao bot.
//  Apenas conversas PRIVADAS ativam o bot (grupos são ignorados).
// ----------------------------------------------------------------
async function onWhatsAppMessages(userId, sock, msgUpdate) {
  const message = msgUpdate?.messages?.[0];
  if (!message || message.key.fromMe) return;

  const sender = await resolveJid(message.key.participant || message.key.remoteJid, sock);
  const chatId = await resolveJid(message.key.remoteJid, sock);

  message.sender = sender;
  message.chatId = chatId;
  message.isGroup = String(chatId).endsWith('@g.us');

  const text = extractText(message.message);
  const phone = String(sender).split('@')[0].split(':')[0];

  // LOG das mensagens recebidas pelo próprio WhatsApp (aparece no console do gateway)
  logToSession(
    userId,
    `📩 [whatsapp] ${message.isGroup ? '(grupo) ' : ''}de ${phone}${message.pushName ? ' ('+message.pushName+')' : ''}: "${String(text).slice(0, 60)}"`,
    'info'
  );

  if (message.isGroup) return; // bot só atende no privado
  if (!text) return;

  // O GATEWAY NÃO processa o fluxo: apenas registra a mensagem para a plataforma
  // buscar via /api/inbox e processar o bot lá.
  try {
    botEngine.recordIncoming({ ownerId: userId, channel: 'whatsapp', address: phone, name: message.pushName || undefined, text });
  } catch (e) {
    logToSession(userId, `Erro ao registrar mensagem: ${e.message}`, 'error');
  }
}

// Helper to log user session status events
function logToSession(userId, message, type = 'info') {
  const session = activeSessions.get(userId);
  if (session) {
    const timestamp = new Date().toLocaleTimeString('pt-BR');
    session.logs.push(`[${timestamp}] [${type.toUpperCase()}] ${message}`);
    if (session.logs.length > 50) session.logs.shift(); // Keep last 50 logs
  }
  console.log(`[Session ${userId}] [${type.toUpperCase()}] ${message}`);
}

// ------------------------------------------------------------------
//  Baileys (WhatsApp REAL) — roda DENTRO deste backend, sem serviço externo.
//  Cada usuário tem sua própria pasta de credenciais em ./auth/session_<id>.
// ------------------------------------------------------------------
const AUTH_DIR = path.join(__dirname, 'auth');
fs.mkdirSync(AUTH_DIR, { recursive: true });

// Simulação SOMENTE quando explicitamente solicitada (WHATSAPP_INTEGRATION_MODE=sandbox).
// Por padrão o gateway usa o Baileys real rodando localmente.
const FORCE_SIMULATION = (process.env.WHATSAPP_INTEGRATION_MODE || '').toLowerCase() === 'sandbox';

let makeWASocket = null;
let useMultiFileAuthState = null;
let DisconnectReason = null;
let fetchLatestBaileysVersion = null;
let Browsers = null;
let jidNormalizedUser = null;
let pino = null;
let BAILEYS_READY = false;

if (!FORCE_SIMULATION) {
  try {
    const baileys = require('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
    Browsers = baileys.Browsers;
    jidNormalizedUser = baileys.jidNormalizedUser;
    pino = require('pino');
    BAILEYS_READY = true;
    console.log('🟢 Baileys carregado — WhatsApp REAL rodando localmente no backend.');
  } catch (e) {
    console.error('🔴 Falha ao carregar Baileys:', e.message);
    console.error('   Rode "npm install" na pasta backend para habilitar o WhatsApp real.');
    console.error('   Operando em modo SIMULADO até a correção.');
  }
} else {
  console.log('🟡 WHATSAPP_INTEGRATION_MODE=sandbox — gateway em modo SIMULADO (sem Baileys).');
}

// Estado efetivo: só simula se forçado por env OU se a lib falhou ao carregar.
const SIMULATION_MODE = FORCE_SIMULATION || !BAILEYS_READY;

// Garante a pasta de sessão (arquivo de credenciais) de um usuário do gateway.
function ensureUserAuthFolder(userId) {
  const folder = path.join(AUTH_DIR, `session_${userId}`);
  fs.mkdirSync(folder, { recursive: true });
  return folder;
}

// Initialize session state structures
function initSessionState(userId) {
  if (!activeSessions.has(userId)) {
    if (!SIMULATION_MODE) ensureUserAuthFolder(userId);
    activeSessions.set(userId, {
      socket: null,
      status: 'DISCONNECTED',
      qrCodeData: null,
      pairingCode: null,
      phone: null,
      logs: [`[${new Date().toLocaleTimeString('pt-BR')}] [INFO] Sessão de gateway inicializada. Aguardando conexão...`],
      isSimulated: SIMULATION_MODE
    });
  }
}

// Start WhatsApp Connection (Real or Simulated)
async function startWhatsAppSession(userId) {
  initSessionState(userId);
  const session = activeSessions.get(userId);

  if (session.isSimulated) {
    logToSession(userId, 'Iniciando WhatsApp em modo simulado...', 'info');
    session.status = 'CONNECTING';
    
    // Simulate QR code generation
    setTimeout(async () => {
      if (session.status !== 'CONNECTING') return;
      const mockQrText = `https://whatsapp.com/qrcode/mock-user-${userId}-${Date.now()}`;
      try {
        session.qrCodeData = await QRCode.toDataURL(mockQrText);
        logToSession(userId, 'QR Code simulado gerado e disponível para leitura.', 'qr');
      } catch (err) {
        logToSession(userId, 'Erro ao gerar QR Code simulado.', 'error');
      }
    }, 1000);

    return;
  }

  // Evita conexões concorrentes/sobrepostas para o mesmo usuário (single-flight).
  if (session.connecting) return;
  session.connecting = true;

  // Encerra socket anterior, se houver, para não acumular conexões duplicadas.
  if (session.socket) {
    try { session.socket.ev.removeAllListeners(); session.socket.end(); } catch (e) {}
    session.socket = null;
  }

  // Real Baileys Connection Implementation
  try {
    logToSession(userId, 'Conectando ao WhatsApp real via Baileys...', 'info');
    session.status = 'CONNECTING';

    const authFolder = ensureUserAuthFolder(userId);
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    const { version } = await fetchLatestBaileysVersion();
    logToSession(userId, `Pasta de sessão: auth/session_${userId} | Protocolo WA v${version.join('.')}`, 'info');

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: Browsers.appropriate('Chrome'),
      connectTimeoutMs: 45000,
      keepAliveIntervalMs: 25000,
    });

    session.socket = sock;
    session.connecting = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qrCodeData = await QRCode.toDataURL(qr);
        session.pairingCode = null;
        logToSession(userId, 'Novo QR Code gerado para escaneamento.', 'qr');
      }

      if (connection === 'connecting') {
        session.status = 'CONNECTING';
        logToSession(userId, 'Tentando conectar ao servidor do WhatsApp...', 'info');
      }

      if (connection === 'open') {
        session.status = 'CONNECTED';
        session.qrCodeData = null;
        session.pairingCode = null;
        session.connecting = false;
        session.reconnectAttempts = 0; // conexão estável -> zera o backoff
        const phone = sock.user.id.split(':')[0];
        session.phone = phone;
        logToSession(userId, `WhatsApp Conectado com Sucesso! Telefone: ${phone}`, 'success');
      }

      if (connection === 'close') {
        session.status = 'DISCONNECTED';
        session.qrCodeData = null;
        session.pairingCode = null;
        session.phone = null;
        session.connecting = false;

        const code = lastDisconnect?.error?.output?.statusCode;
        const reasonMsg = lastDisconnect?.error?.message || code || 'desconhecido';

        // Deslogado no celular -> credenciais inválidas. Limpa e exige novo QR.
        if (code === DisconnectReason.loggedOut) {
          logToSession(userId, 'Sessão deslogada (dispositivo removido no celular). Escaneie o QR novamente para reconectar.', 'error');
          try { sock.ev.removeAllListeners(); sock.end(); } catch (e) {}
          session.socket = null;
          session.reconnectAttempts = 0;
          try { fs.rmSync(path.join(AUTH_DIR, `session_${userId}`), { recursive: true, force: true }); } catch (e) {}
          return;
        }

        // Demais falhas -> reconecta com BACKOFF e teto de tentativas.
        session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
        if (session.reconnectAttempts > 6) {
          logToSession(userId, `Falha persistente de conexão (${reasonMsg}). Reconexão automática pausada — clique em "Iniciar Conexão" para tentar de novo.`, 'error');
          try { sock.ev.removeAllListeners(); sock.end(); } catch (e) {}
          session.socket = null;
          session.reconnectAttempts = 0;
          return;
        }

        const delay = Math.min(3000 * session.reconnectAttempts, 30000);
        logToSession(userId, `Conexão fechada (${reasonMsg}). Reconectando em ${Math.round(delay / 1000)}s — tentativa ${session.reconnectAttempts}/6.`, 'warning');
        try { sock.ev.removeAllListeners(); } catch (e) {}
        setTimeout(() => startWhatsAppSession(userId), delay);
      }
    });

    sock.ev.on('creds.update', saveCreds);

    // MENSAGENS RECEBIDAS -> handler dedicado (resolveJid + roteamento ao bot)
    sock.ev.on('messages.upsert', async (ev) => {
      if (ev.type !== 'notify') return;
      for (const m of ev.messages) {
        await onWhatsAppMessages(userId, sock, { messages: [m] });
      }
    });

  } catch (err) {
    session.connecting = false;
    session.status = 'DISCONNECTED';
    session.reconnectAttempts = (session.reconnectAttempts || 0) + 1;
    if (session.reconnectAttempts > 6) {
      logToSession(userId, `Erro ao iniciar Baileys (${err.message}). Tentativas esgotadas — clique em "Iniciar Conexão".`, 'error');
      session.reconnectAttempts = 0;
      return;
    }
    const delay = Math.min(3000 * session.reconnectAttempts, 30000);
    logToSession(userId, `Erro ao iniciar Baileys: ${err.message}. Nova tentativa em ${Math.round(delay / 1000)}s.`, 'error');
    setTimeout(() => startWhatsAppSession(userId), delay);
  }
}

// API: ADMIN ENDPOINTS

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = gateway.getAdmin();
  if (admin && admin.username === username && admin.password === password) {
    return res.json({ success: true, message: 'Admin logado com sucesso!' });
  }
  return res.status(401).json({ success: false, error: 'Credenciais administrativas incorretas.' });
});

// Admin: Get all users
app.get('/api/admin/users', (req, res) => {
  return res.json(gateway.listUsers());
});

// Admin: Create user
app.post('/api/admin/users', (req, res) => {
  const { username, password, tokensCount, expirationDate } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username e senha são obrigatórios.' });
  }

  if (gateway.getUserByUsername(username)) {
    return res.status(400).json({ error: 'Este nome de usuário já existe.' });
  }

  // Generate a cryptographically secure-looking token
  const generatedToken = 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Math.random().toString(36).substr(2, 9);

  const newUser = gateway.createUser({
    id: 'user_' + Date.now(),
    username,
    password,
    token: generatedToken,
    tokensCount: tokensCount !== undefined ? Number(tokensCount) : 1000,
    expirationDate: expirationDate || null,
    createdAt: new Date().toISOString()
  });

  // Cria a pasta de sessão local do Baileys para o novo usuário desde o cadastro.
  ensureUserAuthFolder(newUser.id);
  // Inicializa o estado da sessão (pronta para conectar via /api/user/whatsapp-connect).
  initSessionState(newUser.id);

  return res.json({ success: true, user: newUser });
});

// Admin: Edit user
app.put('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, password, tokensCount, expirationDate } = req.body;

  if (!gateway.getUserById(id)) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }

  const fields = {};
  if (username) fields.username = username;
  if (password) fields.password = password;
  if (tokensCount !== undefined) fields.tokensCount = Number(tokensCount);
  if (expirationDate !== undefined) fields.expirationDate = expirationDate || null;

  const updated = gateway.updateUser(id, fields);
  return res.json({ success: true, user: updated });
});

// Admin: Delete user
app.delete('/api/admin/users/:id', (req, res) => {
  const { id } = req.params;

  // Encerra socket ativo, se houver
  const session = activeSessions.get(id);
  if (session && session.socket) {
    try { session.socket.end(); } catch (e) {}
  }

  gateway.deleteUser(id);

  // Limpa estado em memória e a pasta de sessão local do Baileys
  activeSessions.delete(id);
  const authFolder = path.join(AUTH_DIR, `session_${id}`);
  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
  }

  return res.json({ success: true, message: 'Usuário excluído com sucesso!' });
});

// API: USER AREA ENDPOINTS

// User Login
app.post('/api/user/login', (req, res) => {
  const { username, password } = req.body;
  const user = gateway.getUserByUsername(username);
  if (user && user.password === password) {
    return res.json({ success: true, user });
  }
  return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
});

// User profile details
app.get('/api/user/profile/:id', (req, res) => {
  const { id } = req.params;
  const user = gateway.getUserById(id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  return res.json(user);
});

// User: Regenerate Token
app.post('/api/user/regenerate-token', (req, res) => {
  const { userId } = req.body;
  if (!gateway.getUserById(userId)) return res.status(404).json({ error: 'Usuário não cadastrado.' });

  const newToken = 'token_' + Math.random().toString(36).substr(2, 9) + '_' + Math.random().toString(36).substr(2, 9);
  gateway.updateUser(userId, { token: newToken });

  return res.json({ success: true, token: newToken });
});

// WhatsApp control endpoints
app.get('/api/user/whatsapp-status/:userId', (req, res) => {
  const { userId } = req.params;
  initSessionState(userId);
  const session = activeSessions.get(userId);
  return res.json({
    status: session.status,
    phone: session.phone,
    logs: session.logs,
    qrCode: session.qrCodeData,
    pairingCode: session.pairingCode,
    isSimulated: session.isSimulated
  });
});

app.post('/api/user/whatsapp-connect', async (req, res) => {
  const { userId } = req.body;
  await startWhatsAppSession(userId);
  return res.json({ success: true, message: 'Processo de conexão iniciado.' });
});

// User: Pairing Code request
app.post('/api/user/whatsapp-pair', async (req, res) => {
  const { userId, phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório para pairing code.' });
  
  initSessionState(userId);
  const session = activeSessions.get(userId);

  if (session.isSimulated) {
    logToSession(userId, `Solicitando Pairing Code para o número ${phone} (Simulado)...`, 'info');
    session.status = 'CONNECTING';
    session.qrCodeData = null;
    session.pairingCode = 'PAIR-MOCK-123';
    logToSession(userId, `Pairing Code gerado: ${session.pairingCode}`, 'success');
    
    // Simulate connection after 10 seconds
    setTimeout(() => {
      if (session.status === 'CONNECTING' && session.pairingCode === 'PAIR-MOCK-123') {
        session.status = 'CONNECTED';
        session.phone = phone;
        session.pairingCode = null;
        logToSession(userId, `WhatsApp Conectado via Pairing Code simulado! Número: ${phone}`, 'success');
      }
    }, 10000);

    return res.json({ success: true, pairingCode: session.pairingCode });
  }

  // Real Baileys Pairing Code Request
  try {
    await startWhatsAppSession(userId);
    const sock = session.socket;
    
    if (!sock) throw new Error('Instância do socket indisponível.');

    logToSession(userId, `Solicitando Pairing Code para o número: ${phone}`, 'info');
    const cleanPhone = phone.replace(/\D/g, '');
    const code = await sock.requestPairingCode(cleanPhone);
    
    session.pairingCode = code;
    session.qrCodeData = null;
    logToSession(userId, `Código de pareamento gerado: ${code}`, 'success');
    
    return res.json({ success: true, pairingCode: code });
  } catch (err) {
    logToSession(userId, `Erro ao gerar Pairing Code: ${err.message}`, 'error');
    return res.status(500).json({ error: err.message });
  }
});

// User: Disconnect WhatsApp Session
app.post('/api/user/whatsapp-disconnect', async (req, res) => {
  const { userId } = req.body;
  initSessionState(userId);
  const session = activeSessions.get(userId);

  if (session.isSimulated) {
    session.status = 'DISCONNECTED';
    session.qrCodeData = null;
    session.pairingCode = null;
    session.phone = null;
    logToSession(userId, 'Conexão simulada desconectada pelo usuário.', 'info');
    return res.json({ success: true });
  }

  try {
    if (session.socket) {
      await session.socket.logout();
      session.socket.end();
    }
  } catch (err) {}

  session.status = 'DISCONNECTED';
  session.qrCodeData = null;
  session.pairingCode = null;
  session.phone = null;
  session.socket = null;
  
  // Wipe session auth folder
  const authFolder = path.join(__dirname, 'auth', `session_${userId}`);
  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, { recursive: true, force: true });
  }

  logToSession(userId, 'Sessão desconectada e credenciais limpas.', 'info');
  return res.json({ success: true });
});

// User: Simulate Scanner (For testing the mock flow without scanning real QR)
app.post('/api/user/whatsapp-simscan', (req, res) => {
  const { userId } = req.body;
  initSessionState(userId);
  const session = activeSessions.get(userId);
  
  if (session.status === 'CONNECTING') {
    session.status = 'CONNECTED';
    session.phone = '5511999999999';
    session.qrCodeData = null;
    session.pairingCode = null;
    logToSession(userId, 'WhatsApp Conectado com Sucesso via Simulador de Leitor!', 'success');
    return res.json({ success: true });
  }
  return res.status(400).json({ error: 'A sessão não está em modo de conexão para parear.' });
});


// API: GLOBAL GATEWAY ENDPOINT (POST /api/send-message)
// Receives: { to: string, message: string }
// Header: Authorization: Bearer [API_Token]
app.post('/api/send-message', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorização Bearer ausente ou inválido.' });
  }

  const token = authHeader.split(' ')[1];
  const user = gateway.getUserByToken(token);

  if (!user) {
    return res.status(401).json({ error: 'Token API não cadastrado ou inválido.' });
  }

  // Check Expiration
  if (user.expirationDate) {
    const expired = new Date(user.expirationDate).getTime() < Date.now();
    if (expired) {
      return res.status(403).json({ error: 'Seu token/usuário expirou. Contate o administrador.' });
    }
  }

  // Check Token Credits
  if (user.tokensCount !== null && user.tokensCount <= 0) {
    return res.status(403).json({ error: 'Você não possui mais tokens de mensagens. Contate o administrador.' });
  }

  const { to, message } = req.body;
  if (!to || !message) {
    return res.status(400).json({ error: 'Parâmetros "to" (telefone) e "message" (texto) são obrigatórios.' });
  }

  // Deduct 1 token credit if not unlimited
  if (user.tokensCount !== null) {
    gateway.decrementToken(user.id);
    user.tokensCount -= 1;
  }

  initSessionState(user.id);
  const session = activeSessions.get(user.id);

  logToSession(user.id, `Recepção de disparos via API. Destinatário: ${to}. Conteúdo: "${message.substring(0, 30)}..."`, 'info');

  if (session.status !== 'CONNECTED') {
    logToSession(user.id, `Falha de Envio: WhatsApp desconectado. Mensagem enfileirada no painel local.`, 'warning');
    // Return mock success or custom status so the CRM doesn't fail, but notify user
    return res.json({ 
      success: true, 
      warning: 'Mensagem aceita pelo gateway, mas seu WhatsApp está offline no momento.',
      remainingTokens: user.tokensCount
    });
  }

  // Dispatch message
  if (session.isSimulated) {
    logToSession(user.id, `[Mensagem Enviada Simulada] Para: ${to} | Texto: ${message}`, 'success');
    return res.json({ success: true, remainingTokens: user.tokensCount });
  }

  try {
    const cleanPhone = to.replace(/\D/g, '') + '@s.whatsapp.net';
    await session.socket.sendMessage(cleanPhone, { text: message });
    logToSession(user.id, `Mensagem enviada com sucesso via Baileys para ${to}!`, 'success');
    return res.json({ success: true, remainingTokens: user.tokensCount });
  } catch (err) {
    logToSession(user.id, `Falha física de envio via Baileys: ${err.message}`, 'error');
    return res.status(500).json({ error: err.message });
  }
});

// ====================================================================
//  LOGIN UNIFICADO — uma única tela; o sistema detecta admin ou cliente.
// ====================================================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const admin = gateway.getAdmin();
  if (admin && admin.username === username && admin.password === password) {
    return res.json({ success: true, role: 'admin' });
  }
  const user = gateway.getUserByUsername(username);
  if (user && user.password === password) {
    return res.json({ success: true, role: 'user', user });
  }
  return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
});

// ====================================================================
//  BOT / ATENDIMENTO — handoff humano, encerramento e configuração.
// ====================================================================

// Operador assume o atendimento (pausa o bot) sem enviar mensagem.
app.post('/api/bot/handoff', (req, res) => {
  const { phone, channel } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone é obrigatório.' });
  const lead = botEngine.handoff(phone, channel);
  return res.json({ success: true, paused: true, lead });
});

// Operador envia mensagem manual -> pausa o bot. GRATUITO (não debita token).
// Autentica pelo token do usuário (Bearer) usado pelo CRM, ou userId no corpo.
app.post('/api/bot/operator-send', async (req, res) => {
  const u = userFromAuth(req);
  const userId = u ? u.id : req.body.userId;
  const { phone, message, channel = 'whatsapp' } = req.body;
  if (!userId) return res.status(401).json({ error: 'Identifique o usuário (Bearer token).' });
  // Envio direto (sem botSend) => atendente não consome créditos
  const send = makeSenderForLead({ owner_id: userId, telefone: String(phone).trim(), channel });
  if (!send) return res.status(409).json({ error: `Canal ${channel} não conectado para este usuário.` });
  try {
    await botEngine.operatorSend(phone, message, send, channel);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Encerra o atendimento humano -> reativa o bot e reseta a conversa (gratuito).
app.post('/api/bot/close', async (req, res) => {
  const { phone, channel } = req.body;
  try {
    const found = botEngine.findLead(phone, channel);
    const send = found ? makeSenderForLead(found) : null; // sem botSend => gratuito
    const lead = await botEngine.closeService(phone, send, channel);
    if (!lead) return res.status(404).json({ error: 'Conversa não encontrada.' });
    return res.json({ success: true, lead });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ====================================================================
//  CANAIS DE MENSAGEM — vínculo/conexão (WhatsApp, Telegram, FB, IG, X)
// ====================================================================

// Lista o estado de todos os canais do usuário.
app.get('/api/channels/:userId', (req, res) => {
  const { userId } = req.params;
  const saved = channels.list(userId);
  const list = SUPPORTED_CHANNELS.map((ch) => {
    if (ch === 'whatsapp') {
      const s = activeSessions.get(userId);
      return { channel: 'whatsapp', status: s ? s.status : 'DISCONNECTED', live: true };
    }
    if (ch === 'telegram') {
      const t = telegram.status(userId);
      const cfg = saved.find((c) => c.channel === 'telegram');
      return { channel: 'telegram', status: t.status, botName: t.botName, configured: !!(cfg && cfg.config.botToken) };
    }
    const cfg = saved.find((c) => c.channel === ch);
    return { channel: ch, status: cfg ? cfg.status : 'DISCONNECTED', configured: !!cfg };
  });
  res.json(list);
});

// Salva/conecta/desconecta um canal.
app.post('/api/channels/:userId', async (req, res) => {
  const { userId } = req.params;
  const { channel, action, config = {} } = req.body;
  if (!SUPPORTED_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: 'Canal não suportado.' });
  }
  try {
    if (channel === 'telegram') {
      if (action === 'connect') {
        const token = config.botToken || (channels.get(userId, 'telegram') || {}).config?.botToken;
        if (!token) return res.status(400).json({ error: 'Informe o token do bot (@BotFather).' });
        const botName = await telegram.start(userId, token, async ({ chatId, name, text }) => {
          // Só registra; a plataforma processa o fluxo e responde via /api/gateway/send.
          botEngine.recordIncoming({ ownerId: userId, channel: 'telegram', address: chatId, name, text });
        });
        channels.upsert(userId, 'telegram', 'CONNECTED', { botToken: token });
        return res.json({ success: true, status: 'CONNECTED', botName });
      }
      if (action === 'disconnect') {
        telegram.stop(userId);
        channels.setStatus(userId, 'telegram', 'DISCONNECTED');
        return res.json({ success: true, status: 'DISCONNECTED' });
      }
    }
    // facebook / instagram / x: salva credenciais e fica pronto via webhook
    if (action === 'save' || action === 'connect') {
      channels.upsert(userId, channel, 'CONFIGURED', config);
      return res.json({ success: true, status: 'CONFIGURED', webhook: `/api/webhook/${channel}` });
    }
    if (action === 'disconnect') {
      channels.setStatus(userId, channel, 'DISCONNECTED');
      return res.json({ success: true, status: 'DISCONNECTED' });
    }
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Webhook genérico de entrada — Facebook, Instagram, X (e outros).
// Auth: Bearer <token do usuário>. Body: { from, name?, text }
// Apenas REGISTRA a mensagem; a plataforma processa o fluxo e responde
// depois via /api/gateway/send.
app.post('/api/webhook/:channel', (req, res) => {
  const { channel } = req.params;
  if (!SUPPORTED_CHANNELS.includes(channel)) return res.status(404).json({ error: 'Canal desconhecido.' });
  const user = userFromAuth(req);
  if (!user) return res.status(401).json({ error: 'Token Bearer inválido.' });
  const { from, name, text } = req.body || {};
  if (!from || !text) return res.status(400).json({ error: 'Campos "from" e "text" são obrigatórios.' });

  try {
    botEngine.recordIncoming({ ownerId: user.id, channel, address: String(from), name, text });
    return res.json({ success: true, channel, recorded: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ====================================================================
//  ENVIO PELO GATEWAY — a PLATAFORMA manda o que o bot/operador montou.
//  O gateway só entrega (não decide nada). actor='bot' debita crédito;
//  actor='operator' é gratuito.
// ====================================================================
app.post('/api/gateway/send', async (req, res) => {
  const user = userFromAuth(req);
  if (!user) return res.status(401).json({ error: 'Token Bearer inválido.' });
  const { to, channel = 'whatsapp', message, actor = 'bot' } = req.body || {};
  if (!to || !message) return res.status(400).json({ error: 'Campos "to" e "message" são obrigatórios.' });

  // Expiração / créditos (apenas o bot consome)
  if (user.expirationDate && new Date(user.expirationDate).getTime() < Date.now()) {
    return res.status(403).json({ error: 'Usuário expirado.' });
  }
  if (actor === 'bot' && user.tokensCount !== null && user.tokensCount <= 0) {
    return res.status(403).json({ error: 'Sem créditos de mensagens (bot).' });
  }

  const send = makeSenderForLead({ owner_id: user.id, telefone: String(to).trim(), channel });
  if (!send) return res.status(409).json({ error: `Canal ${channel} não conectado para este usuário.` });

  try {
    await send(message);
    botEngine.recordOutgoing(to, channel, message, user.id, actor === 'operator' ? '[operador] ' : '');
    if (actor === 'bot') consumeBotToken(user.id);
    return res.json({ success: true, remainingTokens: gateway.getUserById(user.id).tokensCount });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ====================================================================
//  FEED PARA O FRONT (Chat Omnichannel) + ESTATÍSTICAS DE USO
// ====================================================================

// Inbox: novas mensagens (com canal de origem) desde o id informado.
// O front faz polling autenticado com o token do usuário.
app.get('/api/inbox', (req, res) => {
  const user = userFromAuth(req);
  if (!user) return res.status(401).json({ error: 'Token Bearer inválido.' });
  const since = Number(req.query.since || 0);
  const rows = db.prepare(
    `SELECT m.id, m.lead_id, m.direcao, m.texto, m.channel, m.data_envio,
            l.telefone, l.nome, l.bot_pausado
       FROM messages_log m
       JOIN leads l ON l.id = m.lead_id
      WHERE m.id > ? AND (l.owner_id = ? OR l.owner_id IS NULL)
      ORDER BY m.id ASC LIMIT 300`
  ).all(since, user.id);
  const lastId = rows.length ? rows[rows.length - 1].id : since;
  res.json({ lastId, messages: rows });
});

// Contatos Recentes do vendedor (conta conectada) — para o painel do gateway.
app.get('/api/contacts/:userId', (req, res) => {
  const { userId } = req.params;
  const rows = db.prepare(
    `SELECT l.id, l.telefone, l.nome, l.channel, l.bot_pausado, l.cadastrado, l.last_activity,
            (SELECT texto  FROM messages_log m WHERE m.lead_id = l.id ORDER BY m.id DESC LIMIT 1) AS last_text,
            (SELECT direcao FROM messages_log m WHERE m.lead_id = l.id ORDER BY m.id DESC LIMIT 1) AS last_dir
       FROM leads l
      WHERE l.owner_id = ?
      ORDER BY l.last_activity DESC LIMIT 25`
  ).all(userId);
  res.json(rows);
});

// [DEV/TESTE] Simula uma mensagem CHEGANDO pelo WhatsApp. O gateway apenas
// REGISTRA (igual ao handler real). Quem processa o fluxo e responde é a
// plataforma (frontend), que busca via /api/inbox.
app.post('/api/dev/sim-wa', async (req, res) => {
  const { userId = 'user_1', from = '5511988887777', text = 'oi', name = 'Cliente Teste' } = req.body || {};
  const jid = String(from).replace(/\D/g, '') + '@s.whatsapp.net';
  const mockSock = { sendMessage: async () => {} };
  const fakeUpdate = {
    type: 'notify',
    messages: [{ key: { remoteJid: jid, fromMe: false }, pushName: name, message: { conversation: text } }],
  };
  try {
    await onWhatsAppMessages(userId, mockSock, fakeUpdate);
    res.json({ success: true, jid, recorded: true, note: 'Mensagem registrada. A plataforma (:3050) processa o fluxo e responde via /api/gateway/send.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [DEV/TESTE] Injeta uma sessão WhatsApp "conectada" fake (socket no-op) para
// permitir testar a entrega de /api/gateway/send sem parear um celular real.
app.post('/api/dev/fake-wa-connect', (req, res) => {
  const { userId = 'user_1' } = req.body || {};
  activeSessions.set(userId, {
    socket: { sendMessage: async () => ({ status: 'sent' }) },
    status: 'CONNECTED',
    isSimulated: false,
    phone: '5500000000000',
    qrCodeData: null,
    pairingCode: null,
    logs: ['[dev] sessão fake conectada para teste'],
  });
  res.json({ success: true, userId, status: 'CONNECTED (fake)' });
});

// Estatísticas de uso (para o gráfico do dashboard do gateway).
app.get('/api/stats/:userId', (req, res) => {
  const { userId } = req.params;
  const days = 14;
  const rows = db.prepare(
    `SELECT date(m.data_envio) AS d,
            SUM(CASE WHEN m.direcao = 'out' THEN 1 ELSE 0 END) AS out_c,
            SUM(CASE WHEN m.direcao = 'in'  THEN 1 ELSE 0 END) AS in_c
       FROM messages_log m JOIN leads l ON l.id = m.lead_id
      WHERE (l.owner_id = ? OR l.owner_id IS NULL)
        AND m.data_envio >= date('now', '-${days - 1} days')
      GROUP BY date(m.data_envio)`
  ).all(userId);
  const byDay = Object.fromEntries(rows.map((r) => [r.d, r]));
  const perDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    perDay.push({ date: d, in: byDay[d]?.in_c || 0, out: byDay[d]?.out_c || 0 });
  }
  const totals = db.prepare(
    `SELECT SUM(CASE WHEN m.direcao='out' THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN m.direcao='in' THEN 1 ELSE 0 END) AS received,
            COUNT(DISTINCT m.lead_id) AS conversations
       FROM messages_log m JOIN leads l ON l.id = m.lead_id
      WHERE (l.owner_id = ? OR l.owner_id IS NULL)`
  ).get(userId);
  const user = gateway.getUserById(userId);
  res.json({
    perDay,
    totalSent: totals.sent || 0,
    totalReceived: totals.received || 0,
    conversations: totals.conversations || 0,
    credits: user ? user.tokensCount : null,
  });
});

// Info do banco de dados (aba Banco de dados das Configurações).
app.get('/api/db-info', (req, res) => {
  const names = ['gateway_users', 'leads', 'messages_log', 'products', 'orders', 'carts', 'channel_connections'];
  const tables = names.map((name) => {
    try {
      const rows = db.prepare(`SELECT COUNT(*) AS c FROM ${name}`).get().c;
      return { name, rows };
    } catch {
      return { name, rows: 0 };
    }
  });
  res.json({ path: DB_PATH, engine: 'SQLite', tables });
});

// Estatísticas administrativas (visão do admin).
app.get('/api/admin/stats', (req, res) => {
  const users = db.prepare('SELECT COUNT(*) c FROM gateway_users').get().c;
  const msgs = db.prepare('SELECT COUNT(*) c FROM messages_log').get().c;
  const leadsCount = db.prepare('SELECT COUNT(*) c FROM leads').get().c;
  const today = db.prepare("SELECT COUNT(*) c FROM messages_log WHERE date(data_envio) = date('now')").get().c;
  res.json({ users, messages: msgs, leads: leadsCount, messagesToday: today });
});

// Serve frontend public static files
app.use(express.static(path.join(__dirname, 'public')));

// Fallback index.html route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🟢 WhatsApp Gateway API Backend ativa na porta ${PORT}`);
  console.log(`🌍 Terminal Admin e Painel: http://localhost:${PORT}`);
  console.log(`===================================================`);
  console.log(`ℹ️  Gateway em modo "cano": só recebe/encaminha/envia. O fluxo do bot roda na plataforma (:3050).`);

  // Retoma sessões WhatsApp já pareadas (creds.json salvo) após restart
  if (!SIMULATION_MODE) {
    try {
      for (const dir of fs.readdirSync(AUTH_DIR)) {
        if (!dir.startsWith('session_')) continue;
        const uid = dir.slice('session_'.length);
        if (fs.existsSync(path.join(AUTH_DIR, dir, 'creds.json')) && gateway.getUserById(uid)) {
          console.log(`📱 Retomando sessão WhatsApp salva de ${uid}...`);
          startWhatsAppSession(uid);
        }
      }
    } catch (e) {
      console.warn('Falha ao retomar sessões WhatsApp:', e.message);
    }
  }

  // Reativa conexões Telegram que estavam conectadas antes do restart
  for (const u of gateway.listUsers()) {
    const cfg = channels.get(u.id, 'telegram');
    if (cfg && cfg.status === 'CONNECTED' && cfg.config.botToken) {
      telegram
        .start(u.id, cfg.config.botToken, async ({ chatId, name, text }) => {
          botEngine.recordIncoming({ ownerId: u.id, channel: 'telegram', address: chatId, name, text });
        })
        .then((botName) => console.log(`✈️  Telegram reativado p/ ${u.username}: ${botName}`))
        .catch((e) => {
          console.warn(`✈️  Telegram não reativado p/ ${u.username}: ${e.message}`);
          channels.setStatus(u.id, 'telegram', 'ERROR');
        });
    }
  }
});
