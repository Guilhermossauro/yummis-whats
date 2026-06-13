import type { FlowBlock } from '../types';

/**
 * botProcessor.ts — Fluxo de atendimento guiado, processado NA PLATAFORMA.
 *
 * Fluxo:
 *  1. Cliente demonstra interesse num produto (link wa.me com palavra-passe
 *     #YMS:CODIGO, ou digitando o código/nome).
 *  2. Se NÃO cadastrado → faz o cadastro (nome + e-mail) e confirma os dados.
 *     - Se confirmar "não", volta ao início para editar as informações.
 *  3. Se cadastrado → confirma o produto enviando a FOTO + detalhes.
 *  4. Após 3 erros em qualquer etapa → encaminha para atendente humano.
 *     Áudio e imagem contam como erro.
 *
 * É uma função pura: (texto, estado, contexto) -> { replies, nextState, action }.
 */
export interface BotProduct {
  codigo: string;
  nome: string;
  preco: number;
  estoque: number;
  descricao?: string;
  foto_path?: string;
}

export interface BotContext {
  products?: BotProduct[];
  leadName?: string;
  registered?: boolean;
  flowBlocks?: FlowBlock[];
}

export type BotReply =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; caption: string };

export interface BotState {
  step: 'start' | 'reg_nome' | 'reg_email' | 'reg_confirm' | 'confirm_product' | 'menu' | 'handoff';
  data: { nome?: string; email?: string };
  errors: number;
  registered: boolean;
  pendingProduct?: string | null;
  flowBlockId?: string | null;
}

export interface BotResult {
  replies: BotReply[];
  nextState: BotState;
  action?: 'pause_bot';
  effects?: Array<{ type: 'register_lead'; data: { nome: string; email: string } }>;
}

export const PASSPHRASE_PREFIX = '#YMS:'; // marca o produto no link compartilhável
const MAX_ERRORS = 3;

const t = (text: string): BotReply => ({ type: 'text', text });
const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isYes = (s: string) => /\b(sim|s|isso|confirmo|confirmar|ok|certo|correto|pode|claro|positivo|yes)\b/.test(norm(s));
const isNo = (s: string) => /\b(nao|n|negativo|errado|incorreto|editar|corrigir|mudar|alterar)\b/.test(norm(s));
const isMedia = (s: string) => /^\s*\[(áudio|audio|imagem|image|foto|sticker|figurinha|vídeo|video|mídia|midia|documento)\]/i.test(s || '');

function initial(registered = false): BotState {
  return { step: 'start', data: {}, errors: 0, registered, pendingProduct: null };
}

function findProduct(input: string, products?: BotProduct[]): BotProduct | null {
  if (!products?.length) return null;
  // palavra-passe do link: #YMS:CODIGO
  const pass = input.match(/#YMS:([A-Za-z0-9_-]+)/i);
  const wanted = pass ? pass[1] : null;
  if (wanted) {
    const byPass = products.find((p) => p.codigo.toLowerCase() === wanted.toLowerCase());
    if (byPass) return byPass;
  }
  // código/nome digitado
  const cleaned = norm(input).replace(/^c[oó]digo:?\s*/i, '').replace(/^comprar\s+/i, '').trim();
  return (
    products.find((p) => norm(p.codigo) === cleaned) ||
    products.find((p) => cleaned.length >= 3 && norm(p.codigo).includes(cleaned)) ||
    products.find((p) => norm(p.nome) === cleaned) ||
    products.find((p) => cleaned.length >= 4 && norm(p.nome).includes(cleaned)) ||
    null
  );
}

/** Card de produto: foto + ficha na estrutura solicitada. */
function productCard(p: BotProduct): BotReply {
  const caption =
    `*${p.nome}*\n` +
    `_codigo: ${p.codigo}_\n` +
    `*R$ ${Number(p.preco).toFixed(2)}*` +
    (p.descricao ? `\n\n${p.descricao}` : '');
  return p.foto_path ? { type: 'image', image: p.foto_path, caption } : t(caption);
}

function findByCode(code: string | null | undefined, products?: BotProduct[]): BotProduct | null {
  if (!code) return null;
  return products?.find((p) => p.codigo.toLowerCase() === code.toLowerCase()) || null;
}

function isGreeting(input: string) {
  const n = norm(input);
  return ['oi', 'ola', 'menu', 'inicio', 'bom dia', 'boa tarde', 'boa noite', 'comecar', 'ajuda'].some((g) => n.includes(g));
}

function optionMatches(input: string, block: FlowBlock) {
  const n = norm(input);
  if (block.optionType === 'numeric') {
    const num = Number.parseInt(n, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= block.options.length) {
      return block.options[num - 1];
    }
  }

  const matchType = block.keywordMatchType || 'exact';
  return block.options.find((option) => {
    const triggers = option.trigger.split(',').map(norm).filter(Boolean);
    const labels = option.label
      .split(/\s+/)
      .map((word) => norm(word.replace(/[^a-zA-Z0-9]/g, '')))
      .filter((word) => word.length >= 3);
    const candidates = [...triggers, ...labels];
    return candidates.some((candidate) => matchType === 'contains'
      ? n.includes(candidate) || candidate.includes(n)
      : n === candidate);
  }) || null;
}

function globalFlowBlock(input: string, flowBlocks: FlowBlock[]) {
  const n = norm(input);
  return flowBlocks.find((block) => {
    const id = norm(block.id);
    const title = norm(block.title);
    if (n === id || (id.length > 3 && n.includes(id)) || (title.length > 3 && title.includes(n))) return true;
    if (block.id === 'catalogo' && ['catalogo', 'produtos', 'colecao', 'ver produtos'].some((word) => n.includes(word))) return true;
    if (block.id === 'carrinho' && ['carrinho', 'sacola', 'itens'].some((word) => n.includes(word))) return true;
    if (block.id === 'faturamento' && ['finalizar', 'fechar', 'faturamento', 'pagar', 'checkout', 'concluir'].some((word) => n.includes(word))) return true;
    if (block.id === 'suporte' && ['suporte', 'humano', 'atendente'].some((word) => n.includes(word))) return true;
    return false;
  }) || null;
}

function flowReply(block: FlowBlock, products: BotProduct[]): BotReply {
  let text = block.message || '';
  if (block.type === 'options' && block.options.length) {
    const list = block.optionType === 'numeric'
      ? block.options.map((option, index) => `*${index + 1}.* ${option.label}`).join('\n')
      : block.options.map((option) => `👉 Digite *"${option.trigger.split(',')[0]}"* para: ${option.label}`).join('\n');
    text += `\n\n${list}`;
  }
  if (block.id === 'catalogo') {
    if (!products.length) return t(`${text}\n\nNosso catálogo está sendo atualizado, volte em breve! 😉`);
    const list = products
      .map((p) => `• *[${p.codigo}]* ${p.nome} — R$ ${Number(p.preco).toFixed(2)}${p.estoque > 0 ? '' : ' (esgotado)'}`)
      .join('\n');
    text += `\n\n${list}\n\n📷 Envie o *código* de um produto para ver foto e detalhes.`;
  }
  return t(text);
}

function processConfiguredFlow(input: string, state: BotState, flowBlocks: FlowBlock[], products: BotProduct[]): BotResult | null {
  if (!flowBlocks.length) return null;
  const start = flowBlocks.find((block) => block.isStarting) || flowBlocks.find((block) => block.id === 'boas_vindas') || flowBlocks[0];
  const current = flowBlocks.find((block) => block.id === state.flowBlockId) || start;
  let target: FlowBlock | null = null;

  if (isGreeting(input)) {
    target = start;
  } else if (current.type === 'options') {
    const matched = optionMatches(input, current);
    if (matched) target = flowBlocks.find((block) => block.id === matched.destinationBlockId) || null;
  }

  if (!target) target = globalFlowBlock(input, flowBlocks);
  if (!target) return null;

  return {
    replies: [flowReply(target, products)],
    nextState: { ...state, step: 'menu', flowBlockId: target.id, errors: 0 },
    action: target.actionType === 'pause_bot' ? 'pause_bot' : undefined,
  };
}

export function processBotMessage(input: string, prev: BotState | undefined, ctx: BotContext = {}): BotResult {
  let state: BotState = prev ? { ...prev } : initial(!!ctx.registered);
  if (ctx.registered && !state.registered) {
    state = { ...state, registered: true };
  }
  const products = ctx.products || [];

  // Helper: registra erro -> após 3, encaminha para humano
  const fail = (msg: string): BotResult => {
    const errors = (state.errors || 0) + 1;
    if (errors >= MAX_ERRORS) {
      return {
        replies: [t('Tive dificuldade em entender 😕. Vou te transferir para um *atendente humano*, um momento! 👨‍💻')],
        nextState: { ...state, step: 'handoff', errors: 0 },
        action: 'pause_bot',
      };
    }
    return { replies: [t(msg)], nextState: { ...state, errors } };
  };

  // Mídia (áudio/imagem) conta como erro em qualquer etapa
  if (isMedia(input)) {
    return fail('Por enquanto só consigo ler *mensagens de texto* 🙈. Pode escrever, por favor?');
  }

  // ------ Interesse em produto (link com palavra-passe, ou código/nome) ------
  const product = findProduct(input, products);
  if (product) {
    state = { ...state, pendingProduct: product.codigo, errors: 0 };
    if (!state.registered) {
      return {
        replies: [t(
          `Que ótima escolha! 😍 Para seguir com *${product.nome}*, antes preciso realizar seu *cadastro* no sistema.\n\n` +
          `Qual é o seu *nome completo*?`
        )],
        nextState: { ...state, step: 'reg_nome' },
      };
    }
    return {
      replies: [productCard(product), t(`Você *confirma* o interesse em *${product.nome}*? (responda *sim* ou *não*)`)],
      nextState: { ...state, step: 'confirm_product' },
    };
  }

  if (state.step === 'start' || state.step === 'menu') {
    const configured = processConfiguredFlow(input, state, ctx.flowBlocks || [], products);
    if (configured) return configured;
  }

  // ------ Máquina de estados ------
  switch (state.step) {
    case 'reg_nome': {
      const nome = input.trim();
      if (nome.length < 2) return fail('Não entendi seu nome. Pode digitar seu *nome completo*?');
      return {
        replies: [t(`Prazer, ${nome.split(' ')[0]}! Agora me informe o seu *melhor e-mail*:`)],
        nextState: { ...state, step: 'reg_email', data: { ...state.data, nome }, errors: 0 },
      };
    }

    case 'reg_email': {
      const email = input.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Esse e-mail não parece válido 🤔. Pode digitar um *e-mail* completo? (ex: nome@email.com)');
      return {
        replies: [t(
          `Confira seus dados:\n\n` +
          `👤 *Nome:* ${state.data.nome}\n` +
          `📧 *E-mail:* ${email}\n\n` +
          `Está tudo certo? Responda *sim* para confirmar ou *não* para corrigir.`
        )],
        nextState: { ...state, step: 'reg_confirm', data: { ...state.data, email }, errors: 0 },
      };
    }

    case 'reg_confirm': {
      if (isYes(input)) {
        const prod = findByCode(state.pendingProduct, products);
        const base: BotReply[] = [t('✅ Cadastro confirmado com sucesso! Seus dados foram salvos.')];
        if (prod) {
          return {
            replies: [...base, productCard(prod), t(`Você *confirma* o interesse em *${prod.nome}*? (*sim* / *não*)`)],
            nextState: { ...state, step: 'confirm_product', registered: true, errors: 0 },
            effects: [{ type: 'register_lead', data: { nome: state.data.nome || '', email: state.data.email || '' } }],
          };
        }
        return {
          replies: [...base, t('Como posso te ajudar? Envie o *código* de um produto ou *catálogo*.')],
          nextState: { ...state, step: 'menu', registered: true, errors: 0 },
          effects: [{ type: 'register_lead', data: { nome: state.data.nome || '', email: state.data.email || '' } }],
        };
      }
      if (isNo(input)) {
        return {
          replies: [t('Sem problema! Vamos corrigir do começo. Qual é o seu *nome completo*?')],
          nextState: { ...state, step: 'reg_nome', data: {}, errors: 0 },
        };
      }
      return fail('Por favor, responda *sim* para confirmar os dados ou *não* para corrigir.');
    }

    case 'confirm_product': {
      const prod = findByCode(state.pendingProduct, products);
      if (isYes(input)) {
        return {
          replies: [t(`🎉 Interesse em *${prod?.nome || 'seu produto'}* registrado! Um *atendente* vai falar com você para finalizar. Obrigado! 🙌`)],
          nextState: { ...state, step: 'handoff', pendingProduct: null, errors: 0 },
          action: 'pause_bot',
        };
      }
      if (isNo(input)) {
        return {
          replies: [t('Tudo bem! Quer ver outra peça? Envie o *código* de outro produto ou *catálogo*.')],
          nextState: { ...state, step: 'menu', pendingProduct: null, errors: 0 },
        };
      }
      return fail('Responda *sim* para confirmar o produto ou *não* para escolher outro.');
    }

    default: {
      // start / menu — saudação e ajuda
      const n = norm(input);
      if (isGreeting(input)) {
        return {
          replies: [t(
            `Olá! 👋 Bem-vindo à *Moda Express*!\n\n` +
            `Envie o *código* de um produto que viu, ou digite *catálogo* para ver as peças disponíveis. 🛍️`
          )],
          nextState: { ...state, step: 'menu', errors: 0 },
        };
      }
      if (n.includes('catalogo') || n.includes('produtos') || n.includes('colecao')) {
        if (!products.length) return { replies: [t('Nosso catálogo está sendo atualizado, volte em breve! 😉')], nextState: { ...state, step: 'menu' } };
        const list = products
          .map((p) => `• *[${p.codigo}]* ${p.nome} — R$ ${Number(p.preco).toFixed(2)}${p.estoque > 0 ? '' : ' (esgotado)'}`)
          .join('\n');
        return {
          replies: [t(`🛍️ *NOSSA COLEÇÃO*\n\n${list}\n\n📷 Envie o *código* (ex: ${products[0].codigo}) para ver a foto e os detalhes.`)],
          nextState: { ...state, step: 'menu', errors: 0 },
        };
      }
      return fail('Não entendi 🙈. Envie o *código* de um produto ou digite *catálogo*.');
    }
  }
}
