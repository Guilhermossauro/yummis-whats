/**
 * botProcessor.ts — Motor de fluxo do bot que roda NA PLATAFORMA (frontend).
 *
 * O gateway NÃO processa nada: ele entrega a mensagem recebida e a plataforma
 * decide a resposta com base no fluxo configurado (BotFlowBuilder → localStorage
 * 'sql_bot_flow', ou DEFAULT_FLOW).
 *
 * É uma função pura: (texto, estado, contexto) -> { replies, nextBlockId, action }.
 */
import { FlowBlock } from '../types';
import { DEFAULT_FLOW } from '../data/flows';

export interface BotProduct {
  codigo: string;
  nome: string;
  preco: number;
  estoque: number;
}

export interface BotContext {
  products?: BotProduct[];
  leadName?: string;
}

export interface BotResult {
  replies: string[];
  nextBlockId: string;
  /** Ação do bloco (ex.: 'pause_bot' para handoff humano). */
  action?: string;
  /** True quando a mensagem não casou com nenhuma opção. */
  fallback?: boolean;
}

/** Carrega o fluxo configurado na plataforma (ou o padrão). */
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

function normalize(t: string): string {
  return (t || '').trim().toLowerCase();
}

function startBlock(flow: FlowBlock[]): FlowBlock {
  return flow.find((b) => b.isStarting) || flow.find((b) => b.id === 'boas_vindas') || flow[0];
}

/** Casa a opção digitada (número ou palavra-chave) com um destino. */
function matchOption(block: FlowBlock, norm: string): string | null {
  if (block.type !== 'options' || !block.options?.length) return null;

  // Opção numérica
  if (block.optionType === 'numeric') {
    const n = parseInt(norm, 10);
    if (!isNaN(n) && n >= 1 && n <= block.options.length) {
      return block.options[n - 1].destinationBlockId;
    }
  }

  // Palavra-chave / trigger (exato ou contém)
  const matchType = block.keywordMatchType || 'exact';
  const opt = block.options.find((o) =>
    o.trigger
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

  // Catálogo dinâmico: injeta os produtos reais da plataforma
  if (block.id === 'catalogo' && ctx.products && ctx.products.length) {
    const list = ctx.products
      .map((p) => `• *[${p.codigo}]* ${p.nome} — R$ ${Number(p.preco).toFixed(2)}${p.estoque > 0 ? '' : ' (esgotado)'}`)
      .join('\n');
    msg += `\n\n${list}`;
  }

  if (block.type === 'options' && block.options?.length) {
    if (block.optionType === 'numeric') {
      msg += '\n\n' + block.options.map((o, i) => `*${i + 1}.* ${o.label}`).join('\n');
    } else {
      msg += '\n\n' + block.options.map((o) => `👉 *${o.trigger.split(',')[0]}* — ${o.label}`).join('\n');
    }
  }
  return msg;
}

/**
 * Processa uma mensagem recebida e devolve a resposta do bot.
 * @param text       Texto recebido do cliente
 * @param stateBlockId Bloco atual da conversa (estado), ou undefined se nova
 * @param ctx        Contexto (produtos, nome do lead)
 */
export function processBotMessage(text: string, stateBlockId: string | undefined, ctx: BotContext = {}): BotResult {
  const flow = loadBotFlow();
  const norm = normalize(text);
  const start = startBlock(flow);

  // Saudação / comando de menu -> reinicia no bloco inicial
  if (GREETINGS.includes(norm)) {
    return {
      replies: [renderBlock(start, ctx)],
      nextBlockId: start.id,
      action: start.actionType && start.actionType !== 'none' ? start.actionType : undefined,
    };
  }

  const active = flow.find((b) => b.id === (stateBlockId || start.id)) || start;

  // Tenta casar uma opção a partir do bloco atual
  let targetId = matchOption(active, norm);

  // Gatilho global: o texto bate exatamente com o id de um bloco
  if (!targetId) {
    const global = flow.find((b) => b.id === norm);
    if (global) targetId = global.id;
  }

  if (targetId) {
    const target = flow.find((b) => b.id === targetId) || active;
    return {
      replies: [renderBlock(target, ctx)],
      nextBlockId: target.id,
      action: target.actionType && target.actionType !== 'none' ? target.actionType : undefined,
    };
  }

  // Não entendeu -> re-exibe o bloco atual
  return {
    replies: [`Desculpe, não entendi 🙈.\n\n${renderBlock(active, ctx)}`],
    nextBlockId: active.id,
    fallback: true,
  };
}
