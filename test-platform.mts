// Teste do FLUXO GUIADO (rodando o processador REAL do front).
//   interesse no produto -> cadastro -> confirmar dados -> dizer "não" (corrigir)
//   -> refazer -> confirmar -> confirmar produto (foto) -> handoff.
//   + teste de 3 erros / áudio -> atendente humano.
// Rode: npx tsx test-platform.mts   (backend na 3060)

(globalThis as any).localStorage = {
  _d: {} as Record<string, string>,
  getItem(k: string) { return this._d[k] ?? null; },
  setItem(k: string, v: string) { this._d[k] = v; },
  removeItem(k: string) { delete this._d[k]; },
};

import { processBotMessage, BotState } from './src/lib/botProcessor';

const products = [
  { codigo: 'VST001', nome: 'Vestido Floral Verão', preco: 159.9, estoque: 10, descricao: 'Vestido leve estampa floral.', foto_path: 'https://picsum.photos/seed/vst001/400' },
];
const ctx = { products };

function showReplies(replies: any[]) {
  for (const r of replies) {
    if (r.type === 'image') console.log('   🤖📷 [FOTO] ' + r.caption.split('\n').join(' / ').slice(0, 70));
    else console.log('   🤖 ' + r.text.split('\n')[0].slice(0, 78));
  }
}

function run(label: string, msgs: string[]) {
  console.log('\n================ ' + label + ' ================');
  let state: BotState | undefined;
  for (const m of msgs) {
    const res = processBotMessage(m, state, ctx);
    state = res.nextState;
    console.log(`👤 "${m}"`);
    showReplies(res.replies);
    if (res.action) console.log('   ⚙️  AÇÃO: ' + res.action + '  | step=' + state.step + ' | erros=' + state.errors + ' | cadastrado=' + state.registered);
    else console.log('   · step=' + state.step + ' | erros=' + state.errors + ' | cadastrado=' + state.registered);
  }
  return state;
}

// FLUXO PRINCIPAL: interesse -> cadastro -> CORREÇÃO -> confirma -> produto -> handoff
const s1 = run('Interesse → cadastro → correção → confirma produto', [
  '#YMS:VST001',              // interesse via link (não cadastrado) -> pede nome
  'Maria',                    // nome -> pede email
  'maria@email',              // email inválido -> erro
  'maria@email.com',          // email -> confirma dados
  'não',                      // CORRIGIR -> volta ao nome
  'Maria Silva',              // nome de novo -> email
  'maria.silva@email.com',    // email -> confirma
  'sim',                      // confirma cadastro -> mostra produto (foto) -> pede confirmação
  'sim',                      // confirma produto -> handoff
]);
console.log('\n>>> Esperado: step=handoff, cadastrado=true. Obtido: step=' + s1?.step + ', cadastrado=' + s1?.registered);

// 3 ERROS / ÁUDIO -> atendente humano
const s2 = run('3 erros (incluindo áudio) → atendente humano', [
  'oi',          // menu
  'xpto123',     // erro 1
  '[áudio]',     // erro 2 (mídia)
  'asdf',        // erro 3 -> handoff
]);
console.log('\n>>> Esperado: step=handoff por 3 erros. Obtido: step=' + s2?.step);
