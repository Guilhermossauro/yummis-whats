// Teste de integração da NOVA arquitetura:
//  - cliente envia mensagem -> gateway só REGISTRA (não responde)
//  - "plataforma" (este script, usando o processador REAL do front) lê o inbox,
//    processa o fluxo e ENVIA a resposta pelo gateway (/api/gateway/send)
// Rode: npx tsx test-platform.mts   (com o backend na porta 3060)

// shim de localStorage para o processador rodar fora do navegador
(globalThis as any).localStorage = {
  _d: {} as Record<string, string>,
  getItem(k: string) { return this._d[k] ?? null; },
  setItem(k: string, v: string) { this._d[k] = v; },
  removeItem(k: string) { delete this._d[k]; },
};

import { processBotMessage } from './src/lib/botProcessor';

const BASE = 'http://localhost:3060';
const TOKEN = 'api_token_lojista_3050_default';
const USER = 'user_1';
const FROM = '5544900112233';
const FROM_N = FROM.replace(/\D/g, '');

const post = (url: string, body: any, auth = false) =>
  fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + TOKEN } : {}) },
    body: JSON.stringify(body),
  }).then((r) => r.json());

const inbox = (since: number) =>
  fetch(`${BASE}/api/inbox?since=${since}`, { headers: { Authorization: 'Bearer ' + TOKEN } }).then((r) => r.json());

const creditos = () =>
  fetch(`${BASE}/api/stats/${USER}`).then((r) => r.json()).then((s) => s.credits);

const products = [
  { codigo: 'VST001', nome: 'Vestido Floral Verão', preco: 159.9, estoque: 10 },
  { codigo: 'BLS002', nome: 'Blusa Cropped', preco: 79.9, estoque: 5 },
];

let since = 0;
let state: string | undefined;

async function customerSays(text: string) {
  // 1) cliente envia (gateway só registra)
  await post('/api/dev/sim-wa', { userId: USER, from: FROM, text, name: 'Cliente Teste' });
  // 2) plataforma lê o inbox
  const data = await inbox(since);
  since = data.lastId;
  // 3) processa cada mensagem 'in' deste cliente com o fluxo do front
  const incoming = data.messages.filter((m: any) => m.direcao === 'in' && m.telefone === FROM_N);
  for (const m of incoming) {
    const res = processBotMessage(m.texto, state, { products, leadName: 'Cliente' });
    state = res.nextBlockId;
    // handoff: bot pediu atendente humano -> pausa o bot no gateway
    if (res.action === 'pause_bot') {
      await post('/api/bot/handoff', { phone: FROM, channel: 'whatsapp' }, true);
    }
    // 4) envia a resposta que o BOT montou pelo gateway
    for (const reply of res.replies) {
      await post('/api/gateway/send', { to: FROM, channel: 'whatsapp', message: reply, actor: 'bot' }, true);
    }
    console.log(`\nCLIENTE: "${text}"`);
    console.log('  BOT ->', res.replies[0].split('\n').slice(0, 3).join(' / ').slice(0, 90));
    if (res.action) console.log('  AÇÃO ->', res.action);
  }
}

(async () => {
  // sessão WhatsApp fake conectada (para o envio funcionar sem celular)
  await post('/api/dev/fake-wa-connect', { userId: USER });
  // baseline: ignora histórico
  since = (await inbox(0)).lastId;
  const c0 = await creditos();

  await customerSays('oi');
  await customerSays('1'); // catálogo
  await customerSays('oi'); // volta ao menu
  await customerSays('4'); // falar com humano (deve disparar pause_bot)

  // Verificações finais
  const final = await inbox(since - 50);
  const lead = (await fetch(`${BASE}/api/contacts/${USER}`).then((r) => r.json())).find((x: any) => x.telefone === FROM_N);
  const c1 = await creditos();
  console.log('\n========== VERIFICAÇÕES ==========');
  console.log('Mensagens do bot entregues (out) no inbox:', final.messages.filter((m: any) => m.telefone === FROM_N && m.direcao === 'out').length);
  console.log('bot_pausado após "falar com humano":', lead?.bot_pausado, '(esperado 1)');
  console.log('Créditos: antes', c0, '-> depois', c1, '| debitados:', (c0 ?? 0) - (c1 ?? 0), '(só o bot)');
})();
