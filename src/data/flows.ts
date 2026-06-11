import { FlowBlock } from '../types';

export const DEFAULT_FLOW: FlowBlock[] = [
  {
    id: 'boas_vindas',
    title: '👋 Boas-Vindas & Boas Novidades',
    message: 'Olá! Seja muito bem-vindo à Moda Express Premium! 👗🛍️ Sou seu assistente virtual de sacola e faturamento inteligente.',
    type: 'options',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'none',
    options: [
      { trigger: '1', label: '👗 Ver nossa coleção / Catálogo completo', destinationBlockId: 'catalogo' },
      { trigger: '2', label: '🛒 Detalhar meu carrinho / Sacola de compras', destinationBlockId: 'carrinho' },
      { trigger: '3', label: '💳 Finalizar meu pedido e gerar Pix Copia e Cola', destinationBlockId: 'faturamento' },
      { trigger: '4', label: '👨‍💻 Falar agora com Suporte Humano', destinationBlockId: 'suporte' }
    ],
    isStarting: true
  },
  {
    id: 'catalogo',
    title: '👗 Visualização de Catálogo',
    message: '👗 *NOSSA COLEÇÃO EXCLUSIVA* 👗\n\nNós separamos as melhores peças com as maiores tendências de moda para você hoje!',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'contains',
    actionType: 'set_status_carrinho',
    options: []
  },
  {
    id: 'carrinho',
    title: '🛒 Sacola de Compras',
    message: '🛒 *SUA SACOLA DE COMPRAS ATUALIZAÇÕES* 🛒',
    type: 'options',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'none',
    options: [
      { trigger: '1', label: '💳 Finalizar pedido e ir para Checkout Pix', destinationBlockId: 'faturamento' },
      { trigger: '2', label: '🧹 Limpar e esvaziar minha sacola', destinationBlockId: 'limpar_sacola' },
      { trigger: '3', label: '🔙 Voltar ao menu principal inicial', destinationBlockId: 'boas_vindas' }
    ]
  },
  {
    id: 'faturamento',
    title: '💳 Finalização Pix',
    message: 'Reserva efetuada! 🧾 Geramos o resumo das suas peças com o QrCode Pix e chave copia-e-cola:',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'set_status_aguardando',
    options: []
  },
  {
    id: 'suporte',
    title: '👨‍💻 Suporte Humano',
    message: 'Entendido! Estou transferindo seu chamado para nossa equipe comercial neste instante. Minha automação foi pausada para que possamos trocar mensagens diretamente! Aguarde um minuto 👨‍💻.',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'pause_bot',
    options: []
  },
  {
    id: 'limpar_sacola',
    title: '🧹 Limpar Carrinho',
    message: 'Carrinho esvaziado com sucesso! 🗑️ Envie *oi* para ver as opções do menu novamente.',
    type: 'message_only',
    optionType: 'numeric',
    keywordMatchType: 'exact',
    actionType: 'clear_cart',
    options: []
  }
];
