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
  cartSummaryText?: string;
  cartItems?: Array<{ codigo: string; quantidade: number }>;
  storeLink?: string;
}

export type BotReply =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; caption: string };

export interface BotState {
  step: 'start' | 'reg_nome' | 'reg_email' | 'reg_confirm' | 'confirm_product' | 'confirm_cart' | 'menu' | 'handoff';
  data: { nome?: string; email?: string };
  errors: number;
  registered: boolean;
  pendingProduct?: string | null;
  pendingCart?: Array<{ codigo: string; quantidade: number }> | null;
  flowBlockId?: string | null;
}

export interface BotResult {
  replies: BotReply[];
  nextState: BotState;
  action?: 'pause_bot';
  effects?: Array<
    | { type: 'register_lead'; data: { nome: string; email: string } }
    | { type: 'add_to_cart'; data: { codigo: string; quantidade: number } }
    | { type: 'clear_cart'; data: {} }
    | { type: 'set_lead_status'; data: { status: 'CARRINHO_ABERTO' | 'AGUARDANDO_PIX' | 'PAGO' | 'CONCLUIDO' } }
  >;
}

export const PASSPHRASE_PREFIX = '#YMS:'; // marca o produto no link compartilhável
export const CART_PASSPHRASE_PREFIX = '#YMS_CART:'; // marca uma lista vinda da vitrine pública
const MAX_ERRORS = 3;

const t = (text: string): BotReply => ({ type: 'text', text });
const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const isYes = (s: string) => /\b(sim|s|isso|confirmo|confirmar|ok|certo|correto|pode|claro|positivo|yes)\b/.test(norm(s));
const isNo = (s: string) => /\b(nao|n|negativo|errado|incorreto|editar|corrigir|mudar|alterar)\b/.test(norm(s));
const isMedia = (s: string) => /^\s*\[(áudio|audio|imagem|image|foto|sticker|figurinha|vídeo|video|mídia|midia|documento)\]/i.test(s || '');

function initial(registered = false): BotState {
  return { step: 'start', data: {}, errors: 0, registered, pendingProduct: null, pendingCart: null };
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

function parseCartRequest(input: string, products?: BotProduct[]) {
  if (!products?.length) return null;
  const match = input.match(/#YMS_CART:([A-Za-z0-9_.,xX-]+)/i);
  if (!match) return null;
  const items = match[1]
    .split(',')
    .map((piece) => {
      const [rawCode, rawQty] = piece.split(/[xX]/);
      const codigo = (rawCode || '').trim();
      const quantidade = Math.max(1, Number.parseInt(rawQty || '1', 10) || 1);
      const product = products.find((p) => p.codigo.toLowerCase() === codigo.toLowerCase());
      return product ? { codigo: product.codigo, quantidade } : null;
    })
    .filter(Boolean) as Array<{ codigo: string; quantidade: number }>;
  return items.length ? items : null;
}

function cartSummary(items: Array<{ codigo: string; quantidade: number }>, products?: BotProduct[]) {
  const lines = items.map((item) => {
    const product = findByCode(item.codigo, products);
    const price = product ? Number(product.preco) * item.quantidade : 0;
    return `• ${item.quantidade}x *${product?.nome || item.codigo}* (${item.codigo})${product ? ` — R$ ${price.toFixed(2)}` : ''}`;
  });
  const total = items.reduce((sum, item) => {
    const product = findByCode(item.codigo, products);
    return sum + (product ? Number(product.preco) * item.quantidade : 0);
  }, 0);
  return `${lines.join('\n')}\n\n*Total estimado:* R$ ${total.toFixed(2)}`;
}

function mergeCartItems(
  current: Array<{ codigo: string; quantidade: number }> = [],
  additions: Array<{ codigo: string; quantidade: number }> = [],
) {
  const merged = new Map<string, number>();
  for (const item of [...current, ...additions]) {
    const key = item.codigo.toLowerCase();
    merged.set(key, (merged.get(key) || 0) + Math.max(1, item.quantidade || 1));
  }
  return Array.from(merged.entries()).map(([codigoLower, quantidade]) => ({
    codigo: [...current, ...additions].find(item => item.codigo.toLowerCase() === codigoLower)?.codigo || codigoLower.toUpperCase(),
    quantidade,
  }));
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
  for (const block of flowBlocks) {
    const id = norm(block.id);
    const title = norm(block.title);
    const builtInGlobal =
      (block.id === 'catalogo' && ['catalogo', 'produtos', 'colecao', 'ver produtos'].some((word) => n.includes(word))) ||
      (block.id === 'vitrine_publica' && ['loja', 'vitrine', 'site'].some((word) => n.includes(word))) ||
      (block.id === 'carrinho' && ['carrinho', 'sacola', 'itens'].some((word) => n.includes(word))) ||
      (block.id === 'faturamento' && ['finalizar', 'fechar', 'faturamento', 'pagar', 'checkout', 'concluir'].some((word) => n.includes(word))) ||
      (block.id === 'suporte' && ['suporte', 'humano', 'atendente'].some((word) => n.includes(word)));
    if (builtInGlobal) return block;
    if (!block.isGlobalTrigger) continue;
    const matched = block.type === 'options' ? optionMatches(input, block) : null;
    if (matched) return flowBlocks.find((target) => target.id === matched.destinationBlockId) || block;
    if (n === id || (id.length > 3 && n.includes(id)) || (title.length > 3 && title.includes(n))) return block;
  }
  return null;
}

function flowReply(
  block: FlowBlock,
  products: BotProduct[],
  ctx: Pick<BotContext, 'cartSummaryText' | 'storeLink'> = {},
): BotReply {
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
  if (block.id === 'carrinho') {
    text += `\n\n${ctx.cartSummaryText || 'Sua sacola ainda está vazia. Digite *catálogo* para escolher produtos.'}`;
  }
  if (block.id === 'vitrine_publica') {
    text += ctx.storeLink
      ? `\n\n🛍️ Acesse sua vitrine online aqui:\n${ctx.storeLink}\n\nMonte sua seleção e continue o pedido comigo aqui no WhatsApp quando quiser.`
      : '\n\n🛍️ Sua vitrine online está pronta para receber pedidos.';
  }
  return t(text);
}

function processConfiguredFlow(input: string, state: BotState, flowBlocks: FlowBlock[], products: BotProduct[], ctx: Pick<BotContext, 'cartSummaryText' | 'storeLink'> = {}): BotResult | null {
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
  const effects: BotResult['effects'] = [];
  if (target.actionType === 'clear_cart') effects.push({ type: 'clear_cart', data: {} });
  if (target.actionType === 'show_catalog' || target.actionType === 'set_status_carrinho') {
    effects.push({ type: 'set_lead_status', data: { status: 'CARRINHO_ABERTO' } });
  }
  if (target.actionType === 'create_pix' || target.actionType === 'set_status_aguardando') {
    effects.push({ type: 'set_lead_status', data: { status: 'AGUARDANDO_PIX' } });
  }
  if (target.actionType === 'set_status_pago') effects.push({ type: 'set_lead_status', data: { status: 'PAGO' } });
  if (target.actionType === 'set_status_concluido') effects.push({ type: 'set_lead_status', data: { status: 'CONCLUIDO' } });

  return {
    replies: [flowReply(target, products, ctx)],
    nextState: { ...state, step: 'menu', flowBlockId: target.id, errors: 0 },
    action: target.actionType === 'pause_bot' ? 'pause_bot' : undefined,
    effects: effects.length ? effects : undefined,
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

  // ------ Carrinho vindo da vitrine pública (/store) ------
  const cartRequest = parseCartRequest(input, products);
  if (cartRequest) {
    state = { ...state, pendingCart: cartRequest, pendingProduct: null, errors: 0 };
    if (!state.registered) {
      return {
        replies: [t(
          `Recebi sua lista de compra da nossa vitrine online 🛍️\n\n${cartSummary(cartRequest, products)}\n\n` +
          `Antes de adicionar tudo à sacola, preciso realizar seu *cadastro* no sistema.\n\nQual é o seu *nome completo*?`
        )],
        nextState: { ...state, step: 'reg_nome', flowBlockId: 'cadastro_cliente' },
      };
    }
    return {
      replies: [t(
        `Recebi sua lista da vitrine online 🛍️\n\n${cartSummary(cartRequest, products)}\n\n` +
        `Confirma adicionar esses itens ao carrinho? Responda *sim* ou *não*.`
      )],
      nextState: { ...state, step: 'confirm_cart', flowBlockId: 'link_carrinho_loja' },
    };
  }

  // ------ Interesse em produto (link com palavra-passe, ou código/nome) ------
  const product = findProduct(input, products);
  if (product) {
    state = { ...state, pendingProduct: product.codigo, pendingCart: null, errors: 0 };
    if (!state.registered) {
      return {
        replies: [t(
          `Que ótima escolha! 😍 Para seguir com *${product.nome}*, antes preciso realizar seu *cadastro* no sistema.\n\n` +
          `Qual é o seu *nome completo*?`
        )],
        nextState: { ...state, step: 'reg_nome', flowBlockId: 'cadastro_cliente' },
      };
    }
    return {
      replies: [productCard(product), t(`Você *confirma* o interesse em *${product.nome}*? (responda *sim* ou *não*)`)],
      nextState: { ...state, step: 'confirm_product', flowBlockId: 'confirmar_produto' },
    };
  }

  if (state.step === 'start' || state.step === 'menu') {
    const configured = processConfiguredFlow(input, state, ctx.flowBlocks || [], products, {
      cartSummaryText: ctx.cartSummaryText,
      storeLink: ctx.storeLink,
    });
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
        if (state.pendingCart?.length) {
          return {
            replies: [
              t('✅ Cadastro confirmado com sucesso! Seus dados foram salvos.'),
              t(
                `Vamos conferir sua sacola vinda da vitrine:\n\n${cartSummary(state.pendingCart, products)}\n\n` +
                `Confirma adicionar esses itens ao carrinho? Responda *sim* ou *não*.`
              ),
            ],
            nextState: { ...state, step: 'confirm_cart', registered: true, errors: 0, flowBlockId: 'link_carrinho_loja' },
            effects: [{ type: 'register_lead', data: { nome: state.data.nome || '', email: state.data.email || '' } }],
          };
        }
        const prod = findByCode(state.pendingProduct, products);
        const base: BotReply[] = [t('✅ Cadastro confirmado com sucesso! Seus dados foram salvos.')];
        if (prod) {
          return {
            replies: [...base, productCard(prod), t(`Você *confirma* o interesse em *${prod.nome}*? (*sim* / *não*)`)],
            nextState: { ...state, step: 'confirm_product', registered: true, errors: 0, flowBlockId: 'confirmar_produto' },
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
        if (prod && prod.estoque <= 0) {
          return {
            replies: [t(`⚠️ *${prod.nome}* está sem estoque no momento.\n\nDigite *catálogo* para ver outras opções ou *carrinho* para conferir sua sacola.`)],
            nextState: { ...state, step: 'menu', pendingProduct: null, errors: 0, flowBlockId: 'catalogo' },
          };
        }
        const nextCart = prod ? mergeCartItems(ctx.cartItems, [{ codigo: prod.codigo, quantidade: 1 }]) : ctx.cartItems || [];
        return {
          replies: [t(
            `✅ *${prod?.nome || 'Produto'}* adicionado ao carrinho!\n\n` +
            `${nextCart.length ? `${cartSummary(nextCart, products)}\n\n` : ''}` +
            `1. 🛒 Ver carrinho / sacola\n` +
            `2. 👗 Continuar vendo catálogo`
          )],
          nextState: { ...state, step: 'menu', pendingProduct: null, errors: 0, flowBlockId: 'adicionar_carrinho' },
          effects: prod ? [{ type: 'add_to_cart', data: { codigo: prod.codigo, quantidade: 1 } }] : undefined,
        };
      }
      if (isNo(input)) {
        return {
          replies: [t('Tudo bem! Quer ver outra peça? Envie o *código* de outro produto ou *catálogo*.')],
          nextState: { ...state, step: 'menu', pendingProduct: null, errors: 0, flowBlockId: 'catalogo' },
        };
      }
      return fail('Responda *sim* para confirmar o produto ou *não* para escolher outro.');
    }

    case 'confirm_cart': {
      if (isYes(input)) {
        const items = state.pendingCart || [];
        const effects = items.map((item) => ({ type: 'add_to_cart' as const, data: item }));
        const nextCart = mergeCartItems(ctx.cartItems, items);
        return {
          replies: [t(
            `✅ Itens adicionados ao carrinho!\n\n` +
            `${nextCart.length ? `${cartSummary(nextCart, products)}\n\n` : ''}` +
            `1. 🛒 Ver carrinho / sacola\n` +
            `2. 👗 Continuar vendo catálogo`
          )],
          nextState: { ...state, step: 'menu', pendingCart: null, errors: 0, flowBlockId: 'adicionar_carrinho' },
          effects,
        };
      }
      if (isNo(input)) {
        return {
          replies: [t('Sem problema! Digite *catálogo* para escolher outros produtos ou volte à vitrine para ajustar a sacola.')],
          nextState: { ...state, step: 'menu', pendingCart: null, errors: 0, flowBlockId: 'catalogo' },
        };
      }
      return fail('Responda *sim* para adicionar a lista ao carrinho ou *não* para ajustar.');
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
