const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const testDb = path.join(__dirname, 'db', `test-flow-${Date.now()}.db`);
process.env.DATABASE_PATH = testDb;

const { db } = require('./db');
const botEngine = require('./botEngine');
const { decrementStockForItems } = require('./stock');

const phone = '5511988887777';

const lead = botEngine.recordIncoming({
  ownerId: 'user_1',
  channel: 'whatsapp',
  address: phone,
  name: 'Cliente Teste',
  text: '[áudio]',
});

assert.ok(lead.id);
assert.equal(lead.cadastrado, 0);

const savedMessage = db.prepare('SELECT texto FROM messages_log WHERE lead_id = ?').get(lead.id);
assert.equal(savedMessage.texto, '[áudio]');

const registered = botEngine.registerLead(phone, 'whatsapp', {
  name: 'Maria Silva',
  email: 'maria.silva@email.com',
});

assert.equal(registered.cadastrado, 1);
assert.equal(registered.nome, 'Maria Silva');
assert.equal(registered.email, 'maria.silva@email.com');

const paused = botEngine.handoff(phone, 'whatsapp');
const afterPause = botEngine.findLead(phone, 'whatsapp');
assert.equal(paused.id, lead.id);
assert.equal(afterPause.bot_pausado, 1);

const sent = [];
const operatorResultPromise = botEngine.operatorSend(
  phone,
  'Mensagem do operador',
  async (text) => sent.push(text),
  'whatsapp',
  'Ana Operadora'
);

operatorResultPromise.then(async (operatorResult) => {
  assert.equal(sent[0], '*Ana Operadora*\nMensagem do operador');
  assert.equal(operatorResult.message.texto, '*Ana Operadora*\nMensagem do operador');
  assert.equal(operatorResult.lead.id, lead.id);

  const lidLead = botEngine.recordIncoming({
    ownerId: 'user_1',
    channel: 'whatsapp',
    address: '184572008489207@lid',
    name: 'Cliente LID',
    text: 'Oi',
  });
  assert.equal(lidLead.telefone, '184572008489207@lid');

  const lidSent = [];
  const lidOperatorResult = await botEngine.operatorSend(
    '184572008489207',
    'Resposta para LID legado',
    async (text) => lidSent.push(text),
    'whatsapp',
    'Ana Operadora'
  );
  assert.equal(lidSent[0], '*Ana Operadora*\nResposta para LID legado');
  assert.equal(lidOperatorResult.lead.id, lidLead.id);

  db.prepare(
    'INSERT INTO products (owner_id, codigo, nome, descricao, preco, estoque) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('user_1', 'TST001', 'Produto Teste', 'Teste', 10, 5);

  const firstDecrement = decrementStockForItems({
    db,
    userId: 'user_1',
    items: [{ codigo: 'TST001', quantidade: 2 }],
    operationKey: 'order-paid:test-501',
  });
  assert.equal(firstDecrement.applied, true);
  assert.equal(firstDecrement.products[0].estoque, 3);

  const secondDecrement = decrementStockForItems({
    db,
    userId: 'user_1',
    items: [{ codigo: 'TST001', quantidade: 2 }],
    operationKey: 'order-paid:test-501',
  });
  assert.equal(secondDecrement.applied, false);

  const productAfterDuplicate = db.prepare(
    'SELECT estoque FROM products WHERE owner_id = ? AND codigo = ?'
  ).get('user_1', 'TST001');
  assert.equal(productAfterDuplicate.estoque, 3);

  db.close();
  for (const suffix of ['', '-shm', '-wal']) {
    const file = testDb + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  console.log('✅ Gateway validado: entrada, cadastro persistido, handoff humano, envio do operador e idempotência de estoque.');
}).catch((err) => {
  db.close();
  throw err;
});
