import { FlowBlock } from '../types';

export const ACTION_META: Record<NonNullable<FlowBlock['actionType']>, {
  label: string;
  shortLabel: string;
  description: string;
  resources: string[];
}> = {
  none: {
    label: '⚙️ Nenhuma ação adicional',
    shortLabel: 'Sem ação',
    description: 'O bloco apenas envia a mensagem configurada e aguarda a próxima resposta.',
    resources: ['Motor do bot'],
  },
  gateway_receive: {
    label: '📩 Receber mensagem pelo Gateway',
    shortLabel: 'Gateway recebe',
    description: 'Mensagem chega pelo WhatsApp/omnicanal, é gravada em messages_log e entra na fila do bot.',
    resources: ['Gateway WhatsApp', 'Tabela leads', 'Tabela messages_log'],
  },
  lookup_product: {
    label: '🔎 Buscar produto no banco',
    shortLabel: 'Busca produto',
    description: 'Lê o catálogo da loja pelo código, nome ou palavra-passe do link compartilhável.',
    resources: ['Tabela products', 'Catálogo por loja'],
  },
  send_product_card: {
    label: '🖼️ Enviar foto e detalhes do produto',
    shortLabel: 'Card produto',
    description: 'Monta a ficha do produto com foto, descrição, preço e pergunta se o cliente quer adicionar ao carrinho.',
    resources: ['Tabela products', 'Gateway de envio'],
  },
  add_pending_product_to_cart: {
    label: '🛒 Adicionar produto ao carrinho',
    shortLabel: 'Add carrinho',
    description: 'Adiciona o produto confirmado à sacola do lead e mantém o bot ativo para carrinho ou catálogo.',
    resources: ['Tabela carts', 'Tabela leads'],
  },
  show_catalog: {
    label: '👗 Ler e mostrar catálogo',
    shortLabel: 'Mostra catálogo',
    description: 'Carrega os produtos da loja, mostra códigos/preços e permite escolher qualquer item.',
    resources: ['Tabela products'],
  },
  show_cart: {
    label: '🧺 Ler e mostrar carrinho',
    shortLabel: 'Mostra carrinho',
    description: 'Consulta os itens da sacola do lead e oferece finalizar, limpar ou continuar comprando.',
    resources: ['Tabela carts', 'Tabela products'],
  },
  create_pix: {
    label: '💳 Gerar checkout Pix',
    shortLabel: 'Checkout Pix',
    description: 'Calcula o total do carrinho, cria o pedido e prepara Pix copia-e-cola.',
    resources: ['Tabela carts', 'Tabela orders', 'Gateway Pix simulado'],
  },
  open_storefront: {
    label: '🛍️ Abrir vitrine pública',
    shortLabel: 'Vitrine /store',
    description: 'Representa o fluxo iniciado pela página pública /store/nome_da_loja e redirecionamento ao WhatsApp.',
    resources: ['Rota pública /store', 'Tabela products', 'WhatsApp wa.me'],
  },
  register_lead: {
    label: '🪪 Cadastrar/confirmar cliente',
    shortLabel: 'Cadastro lead',
    description: 'Coleta nome/e-mail, confirma os dados e grava o cadastro antes de seguir com a compra.',
    resources: ['Tabela leads'],
  },
  pause_bot: {
    label: '👨‍💻 Transferir para suporte humano',
    shortLabel: 'Handoff humano',
    description: 'Pausa a automação do lead para um operador humano assumir o atendimento.',
    resources: ['Tabela leads', 'Gateway omnichannel'],
  },
  clear_cart: {
    label: '🧹 Esvaziar sacola de compras',
    shortLabel: 'Limpa carrinho',
    description: 'Remove todos os itens da sacola do lead e volta para o fluxo de catálogo/menu.',
    resources: ['Tabela carts'],
  },
  set_status_carrinho: {
    label: '👗 Alterar lead para CARRINHO_ABERTO',
    shortLabel: 'Status carrinho',
    description: 'Marca o lead como conversa de compra aberta.',
    resources: ['Tabela leads'],
  },
  set_status_aguardando: {
    label: '⏳ Alterar lead para AGUARDANDO_PIX',
    shortLabel: 'Aguardando Pix',
    description: 'Marca o lead como aguardando pagamento Pix.',
    resources: ['Tabela leads', 'Tabela orders'],
  },
  set_status_pago: {
    label: '🎉 Alterar lead para PAGO',
    shortLabel: 'Status pago',
    description: 'Marca o lead como pago após confirmação do pedido.',
    resources: ['Tabela leads', 'Tabela orders', 'Tabela products'],
  },
  set_status_concluido: {
    label: '✅ Alterar lead para CONCLUIDO',
    shortLabel: 'Concluído',
    description: 'Finaliza o atendimento comercial.',
    resources: ['Tabela leads'],
  },
};

export const DEFAULT_FLOW: FlowBlock[] = [
  {
    id: 'boas_vindas',
    title: '👋 Entrada Real do Gateway',
    message: 'Olá! Seja muito bem-vindo à Moda Express Premium! 👗🛍️ Sou seu assistente virtual de sacola e faturamento inteligente.',
    type: 'options',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'gateway_receive',
    options: [
      { trigger: '1', label: '👗 Ver nossa coleção / Catálogo completo', destinationBlockId: 'catalogo' },
      { trigger: '2', label: '🛒 Detalhar meu carrinho / Sacola de compras', destinationBlockId: 'carrinho' },
      { trigger: '3', label: '🛍️ Abrir vitrine pública da loja', destinationBlockId: 'vitrine_publica' },
      { trigger: '4', label: '💳 Finalizar meu pedido e gerar Pix Copia e Cola', destinationBlockId: 'faturamento' },
      { trigger: '5', label: '👨‍💻 Falar agora com Suporte Humano', destinationBlockId: 'suporte' },
    ],
    isStarting: true,
  },
  {
    id: 'catalogo',
    title: '👗 Catálogo Global',
    message: '👗 *NOSSA COLEÇÃO EXCLUSIVA* 👗\n\nNós separamos as melhores peças com as maiores tendências de moda para você hoje!',
    type: 'options',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'show_catalog',
    options: [
      { trigger: 'produto,comprar,codigo,código,quero', label: '🔎 Escolher produto pelo código ou nome', destinationBlockId: 'link_produto' },
      { trigger: 'carrinho,sacola', label: '🛒 Ver minha sacola', destinationBlockId: 'carrinho' },
      { trigger: 'loja,vitrine,site', label: '🛍️ Abrir vitrine pública', destinationBlockId: 'vitrine_publica' },
    ],
    isGlobalTrigger: true,
  },
  {
    id: 'link_produto',
    title: '🔗 Link / Código de Produto',
    message: 'Recebi seu interesse pelo produto. Vou consultar o catálogo da loja e te mostrar foto, preço e detalhes para confirmação.',
    type: 'options',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'lookup_product',
    options: [
      { trigger: 'sim,confirmo,quero,adicionar', label: '✅ Confirmar este produto', destinationBlockId: 'adicionar_carrinho' },
      { trigger: 'nao,não,outro,catalogo', label: '👗 Ver outro produto no catálogo', destinationBlockId: 'catalogo' },
    ],
    isGlobalTrigger: true,
  },
  {
    id: 'cadastro_cliente',
    title: '🪪 Cadastro Antes da Compra',
    message: 'Antes de confirmar a compra, valido se o cliente já está cadastrado. Se não estiver, peço nome/e-mail e confirmo os dados.',
    type: 'message_only',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'register_lead',
    options: [],
  },
  {
    id: 'confirmar_produto',
    title: '🖼️ Confirmar Produto',
    message: 'Envio a foto e os detalhes do produto encontrado e pergunto se é esse item que o cliente deseja adicionar à sacola.',
    type: 'options',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'send_product_card',
    options: [
      { trigger: 'sim,confirmar,quero', label: '🛒 Adicionar ao carrinho', destinationBlockId: 'adicionar_carrinho' },
      { trigger: 'nao,não,outro', label: '👗 Voltar ao catálogo', destinationBlockId: 'catalogo' },
    ],
  },
  {
    id: 'adicionar_carrinho',
    title: '🛒 Produto Adicionado',
    message: '✅ Produto adicionado ao carrinho! Agora você pode ver sua sacola ou continuar olhando o catálogo.',
    type: 'options',
    optionType: 'numeric',
    keywordMatchType: 'contains',
    actionType: 'add_pending_product_to_cart',
    options: [
      { trigger: '1', label: '🛒 Ver carrinho / sacola', destinationBlockId: 'carrinho' },
      { trigger: '2', label: '👗 Continuar vendo catálogo', destinationBlockId: 'catalogo' },
    ],
  },
  {
    id: 'carrinho',
    title: '🧺 Carrinho Global',
    message: '🛒 *SUA SACOLA DE COMPRAS* 🛒',
    type: 'options',
    optionType: 'numeric',
    keywordMatchType: 'contains',
    actionType: 'show_cart',
    options: [
      { trigger: '1', label: '💳 Finalizar pedido e ir para Checkout Pix', destinationBlockId: 'faturamento' },
      { trigger: '2', label: '👗 Continuar vendo catálogo', destinationBlockId: 'catalogo' },
      { trigger: '3', label: '🧹 Limpar e esvaziar minha sacola', destinationBlockId: 'limpar_sacola' },
      { trigger: '4', label: '🔙 Voltar ao menu principal inicial', destinationBlockId: 'boas_vindas' },
    ],
    isGlobalTrigger: true,
  },
  {
    id: 'vitrine_publica',
    title: '🛍️ Vitrine Pública /store',
    message: 'A página pública da loja mostra os produtos em estilo delivery. Ao comprar, o cliente é levado ao WhatsApp com a lista e palavra-passe do carrinho.',
    type: 'options',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'open_storefront',
    options: [
      { trigger: 'comprar,confirmar,#YMS_CART', label: '🧺 Receber lista do carrinho da vitrine', destinationBlockId: 'link_carrinho_loja' },
      { trigger: 'catalogo,produtos', label: '👗 Voltar ao catálogo do WhatsApp', destinationBlockId: 'catalogo' },
    ],
    isGlobalTrigger: true,
  },
  {
    id: 'link_carrinho_loja',
    title: '🧺 Link do Carrinho da Vitrine',
    message: 'Recebo a lista de produtos vinda da vitrine pública, valido os códigos no banco e peço confirmação antes de adicionar tudo à sacola.',
    type: 'options',
    optionType: 'keyword',
    keywordMatchType: 'contains',
    actionType: 'lookup_product',
    options: [
      { trigger: 'sim,confirmar,adicionar', label: '✅ Adicionar lista ao carrinho', destinationBlockId: 'adicionar_carrinho' },
      { trigger: 'nao,não,editar,corrigir', label: '👗 Voltar ao catálogo para ajustar', destinationBlockId: 'catalogo' },
    ],
    isGlobalTrigger: true,
  },
  {
    id: 'faturamento',
    title: '💳 Finalização Pix',
    message: 'Reserva efetuada! 🧾 Geramos o resumo das suas peças com o Pix copia-e-cola:',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'create_pix',
    options: [],
  },
  {
    id: 'suporte',
    title: '👨‍💻 Suporte Humano',
    message: 'Entendido! Estou transferindo seu chamado para nossa equipe comercial neste instante. Minha automação foi pausada para que possamos trocar mensagens diretamente! Aguarde um minuto 👨‍💻.',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'pause_bot',
    options: [],
  },
  {
    id: 'limpar_sacola',
    title: '🧹 Limpar Carrinho',
    message: 'Carrinho esvaziado com sucesso! 🗑️ Envie *catálogo* para continuar comprando ou *oi* para voltar ao menu.',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'clear_cart',
    options: [],
  },
];

const CORE_FLOW_IDS = new Set(DEFAULT_FLOW.map((block) => block.id));

function mergeOptions(defaultOptions: FlowBlock['options'], currentOptions?: FlowBlock['options']) {
  const next = currentOptions?.length ? [...currentOptions] : [];
  for (const option of defaultOptions) {
    const exists = next.some((current) =>
      current.destinationBlockId === option.destinationBlockId ||
      current.trigger === option.trigger
    );
    if (!exists) next.push(option);
  }
  return next.length ? next : defaultOptions;
}

export function normalizeFlowBlocks(flow?: FlowBlock[] | null): FlowBlock[] {
  const incoming = Array.isArray(flow) && flow.length ? flow : DEFAULT_FLOW;
  const byDefault = new Map(DEFAULT_FLOW.map((block) => [block.id, block]));
  const seen = new Set<string>();
  const normalized = incoming.map((block) => {
    seen.add(block.id);
    const defaultBlock = byDefault.get(block.id);
    if (!defaultBlock) return block;
    const keepCustomText = block.message && block.message !== defaultBlock.message;
    return {
      ...defaultBlock,
      ...block,
      message: keepCustomText ? block.message : defaultBlock.message,
      actionType: defaultBlock.actionType,
      isGlobalTrigger: block.isGlobalTrigger ?? defaultBlock.isGlobalTrigger,
      options: mergeOptions(defaultBlock.options, block.options),
    };
  });

  for (const block of DEFAULT_FLOW) {
    if (!seen.has(block.id)) normalized.push(block);
  }

  return normalized.sort((a, b) => {
    const aCore = CORE_FLOW_IDS.has(a.id);
    const bCore = CORE_FLOW_IDS.has(b.id);
    if (aCore !== bCore) return aCore ? -1 : 1;
    const aDefaultIndex = DEFAULT_FLOW.findIndex((block) => block.id === a.id);
    const bDefaultIndex = DEFAULT_FLOW.findIndex((block) => block.id === b.id);
    if (aDefaultIndex >= 0 && bDefaultIndex >= 0) return aDefaultIndex - bDefaultIndex;
    return 0;
  });
}
