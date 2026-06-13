import assert from 'node:assert/strict';
import { processBotMessage, BotState } from './src/lib/botProcessor';
import { FlowBlock } from './src/types';
import { buildProductInterestText, buildWhatsAppProductLink } from './src/lib/productShare';

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
  assert.equal(state.step, 'handoff');
  assert.equal(result.action, 'pause_bot');
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
runConfiguredCrmFlowTest();

console.log('✅ Fluxo guiado, fluxo configurado no CRM, correção de dados, handoff e link WhatsApp validados.');
