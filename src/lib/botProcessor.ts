/**
 * botProcessor.ts — Motor de fluxo do bot que roda NA PLATAFORMA (frontend).
 *
 * O gateway NÃO processa nada: ele entrega a mensagem recebida e a plataforma
 * decide a resposta com base no fluxo configurado (BotFlowBuilder → localStorage
 * 'sql_bot_flow', ou DEFAULT_FLOW).
 *
 * Recursos:
 *  - Respostas de texto OU de imagem (card de produto com foto).
 *  - Opções casáveis por NÚMERO e/ou PALAVRA (ambos ao mesmo tempo).
 *  - Detecção de produto por código/nome → envia foto + ficha formatada.
 */
import { FlowBlock } from '../types';
import { DEFAULT_FLOW } from '../data/flows';

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
}

/** Resposta do bot: texto simples ou imagem com legenda. */
export type BotReply =
  | { type: 'text'; text: string }
  | { type: 'image'; image: string; caption: string };

export interface BotResult {
  replies: BotReply[];
  nextBlockId: string;
  /** Ação do bloco (ex.: 'pause_bot' para handoff humano). */
  action?: string;
  fallback?: boolean;
}

export function loadBotFlow(): FlowBlock[] {
  try {
    const saved = localStorage.getItem('sql_bot_flow');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* usa o padrão */
  }
  return DEFAULT_FLOW;
}

const GREETINGS = ['oi', 'ola', 'olá', 'começar', 'comecar', 'menu', 'ajuda', 'inicio', 'início', 'bom dia', 'boa tarde', 'boa noite'];

// Normaliza para comparação: minúsculas + remove acentos (catálogo -> catalogo).
const normalize = (t: string) =>
  (t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const text = (t: string): BotReply => ({ type: 'text', text: t });

function startBlock(flow: FlowBlock[]): FlowBlock {
  return flow.find((b) => b.isStarting) || flow.find((b) => b.id === 'boas_vindas') || flow[0];
}

/**
 * Casa a opção digitada com um destino — aceitando NÚMERO e/ou PALAVRA-CHAVE
 * ao mesmo tempo, independente do optionType. Assim o cliente pode responder
 * "2" ou "catálogo" — o que preferir.
 */
function matchOption(block: FlowBlock, norm: string): string | null {
  if (block.type !== 'options' || !block.options?.length) return null;

  // 1) Por número (índice da opção)
  const n = parseInt(norm, 10);
  if (!isNaN(n) && String(n) === norm && n >= 1 && n <= block.options.length) {
    return block.options[n - 1].destinationBlockId;
  }

  // 2) Por palavra-chave / trigger (exato ou contém)
  const matchType = block.keywordMatchType || 'exact';
  const opt = block.options.find((o) =>
    (o.trigger || '')
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .some((trig) => (matchType === 'contains' ? norm.includes(trig) || trig.includes(norm) : norm === trig))
  );
  return opt ? opt.destinationBlockId : null;
}

/** Monta a mensagem de um bloco (texto + lista de opções + catálogo dinâmico). */
function renderBlock(block: FlowBlock, ctx: BotContext): string {
  let msg = (block.message || '').replace(/\{nome\}/g, ctx.leadName || 'cliente');

  if (block.id === 'catalogo' && ctx.products && ctx.products.length) {
    const list = ctx.products
      .map((p) => `• *[${p.codigo}]* ${p.nome} — R$ ${Number(p.preco).toFixed(2)}${p.estoque > 0 ? '' : ' (esgotado)'}`)
      .join('\n');
    msg += `\n\n${list}\n\n📷 Envie o *código* (ex: ${ctx.products[0].codigo}) ou o *nome* de uma peça para ver a foto e os detalhes.`;
  }

  if (block.type === 'options' && block.options?.length) {
    if (block.optionType === 'keyword') {
      msg += '\n\n' + block.options.map((o) => `👉 *${o.trigger.split(',')[0]}* — ${o.label}`).join('\n');
    } else {
      msg += '\n\n' + block.options.map((o, i) => `*${i + 1}.* ${o.label}`).join('\n');
    }
  }
  return msg;
}

/** Procura um produto pelo código (exato) ou nome (contém). */
function findProduct(norm: string, products?: BotProduct[]): BotProduct | null {
  if (!products?.length) return null;
  const cleaned = norm.replace(/^c[oó]digo:?\s*/i, '').replace(/^comprar\s+/i, '').trim();
  return (
    products.find((p) => p.codigo.toLowerCase() === cleaned) ||
    products.find((p) => cleaned.length >= 3 && p.codigo.toLowerCase().includes(cleaned)) ||
    products.find((p) => p.nome.toLowerCase() === cleaned) ||
    products.find((p) => cleaned.length >= 4 && p.nome.toLowerCase().includes(cleaned)) ||
    null
  );
}

/** Card de produto: foto + ficha na estrutura solicitada. */
function productReply(p: BotProduct): BotReply {
  const caption =
    `*${p.nome}*\n` +
    `_codigo: ${p.codigo}_\n` +
    `*R$ ${Number(p.preco).toFixed(2)}*` +
    (p.descricao ? `\n\n${p.descricao}` : '');
  if (p.foto_path) return { type: 'image', image: p.foto_path, caption };
  return text(caption);
}

export function processBotMessage(input: string, stateBlockId: string | undefined, ctx: BotContext = {}): BotResult {
  const flow = loadBotFlow();
  const norm = normalize(input);
  const start = startBlock(flow);

  // Saudação / comando de menu -> reinicia no bloco inicial
  if (GREETINGS.includes(norm)) {
    return {
      replies: [text(renderBlock(start, ctx))],
      nextBlockId: start.id,
      action: start.actionType && start.actionType !== 'none' ? start.actionType : undefined,
    };
  }

  const active = flow.find((b) => b.id === (stateBlockId || start.id)) || start;

  // 1) Casa uma opção do bloco atual (número OU palavra)
  let targetId = matchOption(active, norm);

  // 2) Gatilho global: o texto bate com o id de um bloco
  if (!targetId) {
    const global = flow.find((b) => b.id === norm);
    if (global) targetId = global.id;
  }

  if (targetId) {
    const target = flow.find((b) => b.id === targetId) || active;
    return {
      replies: [text(renderBlock(target, ctx))],
      nextBlockId: target.id,
      action: target.actionType && target.actionType !== 'none' ? target.actionType : undefined,
    };
  }

  // 3) Pedido de produto (código/nome) -> envia FOTO + ficha
  const product = findProduct(norm, ctx.products);
  if (product) {
    return { replies: [productReply(product)], nextBlockId: active.id };
  }

  // 4) Não entendeu -> re-exibe o bloco atual
  return {
    replies: [text(`Desculpe, não entendi 🙈.\n\n${renderBlock(active, ctx)}`)],
    nextBlockId: active.id,
    fallback: true,
  };
}
