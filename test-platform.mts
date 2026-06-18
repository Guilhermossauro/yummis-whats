import assert from 'node:assert/strict';
import { processBotMessage, BotState } from './src/lib/botProcessor';
import { FlowBlock } from './src/types';
import { resolveOrderPaymentTransition } from './src/lib/orderPayment';
import { buildProductInterestText, buildStoreCartInterestText, buildWhatsAppProductLink } from './src/lib/productShare';

const products = [
  {
    codigo: 'VST001',
    nome: 'Vestido Floral Verão',
    preco: 159.9,
    estoque: 10,
    descricao: 'Vestido leve estampa floral.',
    foto_path: 'https://picsum.photos/seed/vst001/400',
  },
];

const ctx = { products };

function step(input: string, state?: BotState, registered = false, flowBlocks: FlowBlock[] = []) {
  return processBotMessage(input, state, { ...ctx, registered, flowBlocks });
}

function runCorrectionFlow() {
  let state: BotState | undefined;

  let result = step('#YMS:VST001', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_nome');
  assert.match(result.replies[0].type === 'text' ? result.replies[0].text : '', /cadastro/i);

  result = step('Maria', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_email');

  result = step('maria@email', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_email');
  assert.equal(state.errors, 1);

  result = step('maria@email.com', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_confirm');

  result = step('não', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_nome');
  assert.deepEqual(state.data, {});

  result = step('Maria Silva', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_email');

  result = step('maria.silva@email.com', state);
  state = result.nextState;
  assert.equal(state.step, 'reg_confirm');

  result = step('sim', state);
  state = result.nextState;
  assert.equal(state.step, 'confirm_product');
  assert.equal(state.registered, true);
  assert.equal(result.effects?.[0]?.type, 'register_lead');
  assert.equal(result.replies.some(reply => reply.type === 'image'), true);

  result = step('sim', state);
  state = result.nextState;
  assert.equal(state.step, 'menu');
  assert.equal(state.flowBlockId, 'adicionar_carrinho');
  assert.equal(result.action, undefined);
  assert.equal(result.effects?.some(effect => effect.type === 'add_to_cart'), true);
  assert.equal(result.effects?.some((effect: any) => effect.type === 'decrement_stock'), false);
}

function runRegisteredLeadFlow() {
  const result = step('Olá! Tenho interesse no produto Vestido Floral Verão. #YMS:VST001', undefined, true);
  assert.equal(result.nextState.step, 'confirm_product');
  assert.equal(result.nextState.registered, true);
  assert.equal(result.replies[0].type, 'image');
  assert.match(result.replies[1].type === 'text' ? result.replies[1].text : '', /confirma/i);
}

function runThreeErrorsFlow() {
  let state: BotState | undefined;
  for (const input of ['xpto123', '[áudio]', 'asdf']) {
    const result = step(input, state);
    state = result.nextState;
  }
  assert.equal(state?.step, 'handoff');
}

function runShareLinkTest() {
  const text = buildProductInterestText(products[0]);
  assert.match(text, /#YMS:VST001/);
  assert.match(text, /Tenho interesse/);

  const link = buildWhatsAppProductLink(products[0], '+55 (11) 99999-9999');
  assert.ok(link.startsWith('https://wa.me/5511999999999?text='));
  assert.match(decodeURIComponent(link), /#YMS:VST001/);

  const cartText = buildStoreCartInterestText([{ product: products[0], quantity: 2 }], 'Moda Express');
  assert.match(cartText, /#YMS_CART:VST001x2/);
}

function runStoreCartFlow() {
  let result = step('Olá! Quero comprar:\n#YMS_CART:VST001x2', undefined, true);
  assert.equal(result.nextState.step, 'confirm_cart');
  assert.match(result.replies[0].type === 'text' ? result.replies[0].text : '', /Total estimado/i);

  result = step('sim', result.nextState, true);
  assert.equal(result.nextState.step, 'menu');
  const effect = result.effects?.find(item => item.type === 'add_to_cart');
  assert.equal(effect?.type, 'add_to_cart');
  assert.equal(effect?.data.quantidade, 2);
}

function runOrderPaymentFlow() {
  const leads = [
    {
      id: 'lead_1',
      telefone: '5511999999999',
      nome: 'Maria',
      status_funil: 'AGUARDANDO_PIX' as const,
      ultimo_gatilho: '2026-06-18T10:00:00.000Z',
      bot_pausado: 0,
    },
  ];
  const orders = [
    {
      id: '501',
      lead_id: 'lead_1',
      total: 159.9,
      status_pagamento: 'PENDENTE' as const,
      pix_copia_cola: 'pix',
      transaction_id: 'TX-501',
      data_criacao: '2026-06-18T10:00:00.000Z',
    },
  ];
  const carts = [
    {
      id: 'cart_1',
      lead_id: 'lead_1',
      product_id: '101',
      quantidade: 1,
      size: 'M',
      atualizado_em: '2026-06-18T10:00:00.000Z',
    },
  ];

  const firstPayment = resolveOrderPaymentTransition('lead_1', orders, leads as any, carts, '2026-06-18T11:00:00.000Z');
  assert.equal(firstPayment.shouldDecrementStock, true);
  assert.equal(firstPayment.paidItems.length, 1);
  assert.equal(firstPayment.nextOrders[0].status_pagamento, 'PAGO');
  assert.equal(firstPayment.nextLeads[0].status_funil, 'PAGO');
  assert.equal(firstPayment.nextCarts.length, 0);

  const secondPayment = resolveOrderPaymentTransition(
    'lead_1',
    firstPayment.nextOrders,
    firstPayment.nextLeads as any,
    firstPayment.nextCarts,
    '2026-06-18T11:05:00.000Z',
  );
  assert.equal(secondPayment.shouldDecrementStock, false);
  assert.equal(secondPayment.paidItems.length, 0);
}

function runConfiguredCrmFlowTest() {
  const flowBlocks: FlowBlock[] = [
    {
      id: 'boas_vindas',
      title: 'Boas vindas customizada',
      message: 'Mensagem editada no CRM para o cliente.',
      type: 'options',
      optionType: 'numeric',
      actionType: 'none',
      options: [{ trigger: '1', label: 'Ver catálogo customizado', destinationBlockId: 'catalogo' }],
      isStarting: true,
    },
    {
      id: 'catalogo',
      title: 'Catálogo customizado',
      message: 'Catálogo vindo do fluxo configurado.',
      type: 'message_only',
      optionType: 'numeric',
      actionType: 'none',
      options: [],
    },
  ];

  let result = step('oi', undefined, false, flowBlocks);
  assert.match(result.replies[0].type === 'text' ? result.replies[0].text : '', /Mensagem editada no CRM/);

  result = step('1', result.nextState, false, flowBlocks);
  assert.match(result.replies[0].type === 'text' ? result.replies[0].text : '', /Catálogo vindo do fluxo configurado/);
  assert.match(result.replies[0].type === 'text' ? result.replies[0].text : '', /VST001/);
}

runCorrectionFlow();
runRegisteredLeadFlow();
runThreeErrorsFlow();
runShareLinkTest();
runStoreCartFlow();
runOrderPaymentFlow();
runConfiguredCrmFlowTest();

console.log('✅ Fluxo guiado, carrinho da vitrine, fluxo CRM, correção de dados, handoff por erro e links WhatsApp validados.');
