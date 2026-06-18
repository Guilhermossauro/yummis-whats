import React, { useState, useRef, useEffect } from 'react';
import { Send, Smartphone, Database, Check, RefreshCw, ShoppingCart, Trash2, Clock, Play, Server, AlertCircle, Sparkles, SendHorizontal } from 'lucide-react';
import { SQLProduct, SQLLead, SQLCart, SQLOrder, SQLMessageLog, WhatsAppConfig, FlowBlock, FlowOption } from '../types';
import { DEFAULT_FLOW, normalizeFlowBlocks } from '../data/flows';
import { getSendMessageURL, isGatewayMode } from '../lib/gateway';
import { processBotMessage, BotState } from '../lib/botProcessor';

interface ChatSimulatorProps {
  products: SQLProduct[];
  leads: SQLLead[];
  carts: SQLCart[];
  orders: SQLOrder[];
  messages: SQLMessageLog[];
  whatsAppConfig: WhatsAppConfig;
  onAddLead: (lead: SQLLead) => void;
  onUpdateLeadStatus: (leadId: string, status: SQLLead['status_funil']) => void;
  onAddCartItem: (leadId: string, productId: string, size: string, quantity: number) => void;
  onClearCart: (leadId: string) => void;
  onAddOrder: (leadId: string, total: number, pix: string, txId: string) => void;
  onAddMessage: (leadId: string, direcao: 'in' | 'out', text: string) => void;
  onSetBotPaused: (leadId: string, paused: number) => void;
  onConfirmOrderPayment: (leadId: string) => void;
  onTriggerInactivityRecovery: (hours: 24 | 48) => void;
  botFlowStorageKey?: string;
  storeLink?: string;
}

// Levenshtein distance computation helper
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

// Check triggers or labels under fuzzy matching with Levenshtein distance
function fuzzyMatchOption(input: string, options: FlowOption[]): FlowOption | null {
  const cleanedInput = input.trim().toLowerCase();
  if (!cleanedInput || cleanedInput.length < 2) return null;

  let bestMatch: FlowOption | null = null;
  let minDistance = 999;

  for (const opt of options) {
    const triggers = opt.trigger.toLowerCase().split(',').map(t => t.trim());
    for (const trig of triggers) {
      if (trig === cleanedInput) return opt;
      const dist = getLevenshteinDistance(cleanedInput, trig);
      if (dist < minDistance && dist <= 2) {
        minDistance = dist;
        bestMatch = opt;
      }
    }

    const labelWords = opt.label.toLowerCase()
      .replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '')
      .split(/\s+/);
    for (const word of labelWords) {
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      if (cleanWord.length >= 3) {
        if (cleanWord === cleanedInput) return opt;
        const dist = getLevenshteinDistance(cleanedInput, cleanWord);
        if (dist < minDistance && dist <= 2) {
          minDistance = dist;
          bestMatch = opt;
        }
      }
    }
  }
  return bestMatch;
}

export default function ChatSimulator({
  products,
  leads,
  carts,
  orders,
  messages,
  whatsAppConfig,
  onAddLead,
  onUpdateLeadStatus,
  onAddCartItem,
  onClearCart,
  onAddOrder,
  onAddMessage,
  onSetBotPaused,
  onConfirmOrderPayment,
  onTriggerInactivityRecovery,
  botFlowStorageKey,
  storeLink,
}: ChatSimulatorProps) {
  const publishedFlowStorageKey = botFlowStorageKey || 'sql_bot_flow';
  const readPublishedFlow = (): FlowBlock[] => {
    try {
      const stored = localStorage.getItem(publishedFlowStorageKey) ?? localStorage.getItem('sql_bot_flow') ?? '[]';
      return normalizeFlowBlocks(JSON.parse(stored));
    } catch {
      return normalizeFlowBlocks(DEFAULT_FLOW);
    }
  };
  
  // Choose/register active simulation number
  const [activeNumber, setActiveNumber] = useState('5511999999999');
  const [activeName, setActiveName] = useState('Guilherme');
  const [phoneInput, setPhoneInput] = useState('5511999999999');
  const [nameInput, setNameInput] = useState('Guilherme');
  const [isRegistering, setIsRegistering] = useState(false);

  // Chatbot active session block mapping
  const [leadCurrentBlocks, setLeadCurrentBlocks] = useState<{ [leadId: string]: string }>(() => {
    const saved = localStorage.getItem('sql_lead_blocks');
    return saved ? JSON.parse(saved) : {};
  });

  const [leadAddresses, setLeadAddresses] = useState<{ [leadId: string]: string }>(() => {
    const saved = localStorage.getItem('sql_lead_addresses');
    return saved ? JSON.parse(saved) : {};
  });

  const [appliedCoupons, setAppliedCoupons] = useState<{ [leadId: string]: string }>(() => {
    const saved = localStorage.getItem('sql_lead_coupons');
    return saved ? JSON.parse(saved) : {};
  });

  const [leadAwaitingAddress, setLeadAwaitingAddress] = useState<{ [leadId: string]: boolean }>(() => {
    const saved = localStorage.getItem('sql_lead_awaiting_address');
    return saved ? JSON.parse(saved) : {};
  });

  const [allowGlobalTriggers, setAllowGlobalTriggers] = useState<boolean>(() => {
    const saved = localStorage.getItem('sql_allow_global_triggers');
    return saved ? saved === 'true' : true;
  });

  const [leadBotStates, setLeadBotStates] = useState<{ [leadId: string]: BotState }>(() => {
    const saved = localStorage.getItem('sql_simulator_bot_states');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('sql_lead_blocks', JSON.stringify(leadCurrentBlocks));
  }, [leadCurrentBlocks]);

  useEffect(() => {
    localStorage.setItem('sql_lead_addresses', JSON.stringify(leadAddresses));
  }, [leadAddresses]);

  useEffect(() => {
    localStorage.setItem('sql_lead_coupons', JSON.stringify(appliedCoupons));
  }, [appliedCoupons]);

  useEffect(() => {
    localStorage.setItem('sql_lead_awaiting_address', JSON.stringify(leadAwaitingAddress));
  }, [leadAwaitingAddress]);

  useEffect(() => {
    localStorage.setItem('sql_allow_global_triggers', String(allowGlobalTriggers));
  }, [allowGlobalTriggers]);

  useEffect(() => {
    localStorage.setItem('sql_simulator_bot_states', JSON.stringify(leadBotStates));
  }, [leadBotStates]);

  const [inputText, setInputText] = useState('');
  const [simLogs, setSimLogs] = useState<{ id: string; node: string; level: 'info' | 'success' | 'warning' | 'error'; message: string; timestamp: string }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize active search lead or default
  const activeLead = leads.find(l => l.telefone === activeNumber);

  useEffect(() => {
    // Scroll chats
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeNumber]);

  // Insert standard start log
  useEffect(() => {
    log('STATE_MANAGER', 'info', `Playground WhatsApp iniciado para o telefone: ${activeNumber}`);
  }, [activeNumber]);

  function log(node: string, level: 'info' | 'success' | 'warning' | 'error', message: string) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(new Date().getMilliseconds()).padStart(3, '0');
    setSimLogs(prev => [
      { id: Math.random().toString(), node, level, message, timestamp: time },
      ...prev
    ]);
  }

  const handleRegisterContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput || !nameInput) return;
    
    // Purify number
    const purePhone = phoneInput.replace(/[^0-9]/g, '');
    if (!purePhone) return;

    setActiveNumber(purePhone);
    setActiveName(nameInput);
    
    // Register Lead structured SQL record
    const existing = leads.find(l => l.telefone === purePhone);
    if (!existing) {
      onAddLead({
        id: String(leads.length + 101),
        telefone: purePhone,
        nome: nameInput,
        status_funil: 'CARRINHO_ABERTO',
        ultimo_gatilho: new Date().toISOString(),
        bot_pausado: 0,
        cadastrado: 0
      });
      log('STATE_MANAGER', 'success', `Sucesso! Cadastrada nova sessão SQLite para o telefone ${purePhone}`);
    } else {
      log('STATE_MANAGER', 'info', `Sessão ativa encontrada para o telefone ${purePhone}. Nome: ${existing.nome}`);
    }
    setIsRegistering(false);
  };

  const currentLeadMessages = activeLead 
    ? messages.filter(m => m.lead_id === activeLead.id).sort((a,b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime())
    : [];

  const currentLeadCart = activeLead 
    ? carts.filter(c => c.lead_id === activeLead.id)
    : [];

  const calculateCartWithDiscountsAndShipping = (leadId: string) => {
    const leadCart = carts.filter(c => c.lead_id === leadId);
    let itemsTotal = 0;
    let shippingCostTotal = 0;
    let shippingRequired = false;

    leadCart.forEach(item => {
      const prod = products.find(p => p.id === item.product_id);
      if (prod) {
        itemsTotal += prod.preco * item.quantidade;
        if (prod.has_shipping) {
          shippingRequired = true;
          if (prod.shipping_type === 'paid') {
            shippingCostTotal += (prod.shipping_cost || 0) * item.quantidade;
          }
        }
      }
    });

    const coupon = appliedCoupons[leadId]?.toUpperCase() || '';
    let couponDiscount = 0;
    let freeShippingCoupon = false;

    if (coupon === 'FRETEGRATIS') {
      freeShippingCoupon = true;
    } else if (coupon === 'DESCONTO10' || coupon === 'CUPOM10') {
      couponDiscount = itemsTotal * 0.10;
    } else if (coupon === 'PROMO20') {
      couponDiscount = itemsTotal * 0.20;
    } else if (coupon === 'QUERO10') {
      couponDiscount = Math.min(itemsTotal, 10.05);
    }

    const appliedShippingCost = freeShippingCoupon ? 0 : shippingCostTotal;
    const finalTotal = Math.max(0, itemsTotal - couponDiscount + appliedShippingCost);

    return {
      itemsTotal,
      shippingRequired,
      shippingCostTotal,
      appliedShippingCost,
      coupon,
      couponDiscount,
      finalTotal,
      freeShippingCoupon
    };
  };

  // Core Chatbot Response Routing Engine (The real core logic!)
  const handleSendMessage = async (customText?: string) => {
    const msgToSend = customText !== undefined ? customText : inputText;
    if (!msgToSend.trim()) return;

    setInputText('');

    // Ensure lead exists
    let lead = leads.find(l => l.telefone === activeNumber);
    if (!lead) {
      // Auto register if not present
      const newId = String(leads.length + 101);
      lead = {
        id: newId,
        telefone: activeNumber,
        nome: activeName,
        status_funil: 'CARRINHO_ABERTO',
        ultimo_gatilho: new Date().toISOString(),
        bot_pausado: 0,
        cadastrado: 0
      };
      onAddLead(lead);
    }

    const currentLeadId = lead.id;

    // 1. Add User Input Log & DB Message record
    onAddMessage(currentLeadId, 'in', msgToSend);
    log('ADAPTER', 'info', `Recebido status da Evolution API. Webhook OK para ${activeNumber}`);
    log('NORMALIZE', 'success', `Mensagem normalizada: "${msgToSend}" | DDI: 55 | DDD: ${activeNumber.slice(2, 4)}`);

    // Check if bot is paused (human support took over!)
    if (lead.bot_pausado === 1) {
      log('CORE_LOGIC', 'warning', `Aviso: Robô AUTOMÁTICO pausado pelo lojista para suporte humano. Nenhuma resposta disparada.`);
      return;
    }

    const previousBotState = leadBotStates[currentLeadId];
    const previousStep = previousBotState?.step;
    const guidedFlowActive = !!previousStep && !['start', 'menu', 'handoff'].includes(previousStep);
    const legacyCommerceCommand = /^(comprar\s+|carrinho|sacola|itens|finalizar|fechar|faturamento|pagar|checkout|concluir|pago|comprovante|efetuei o pagamento|limpar)$/i.test(msgToSend.trim());

    if (guidedFlowActive || !legacyCommerceCommand) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const configuredFlow = readPublishedFlow();
      const currentCartItems = carts
        .filter(item => item.lead_id === currentLeadId)
        .map((item) => {
          const product = products.find(p => p.id === item.product_id);
          return product ? { codigo: product.codigo, quantidade: item.quantidade } : null;
        })
        .filter(Boolean) as Array<{ codigo: string; quantidade: number }>;

      const result = processBotMessage(msgToSend, previousBotState, {
        products: products.map(p => ({
          codigo: p.codigo,
          nome: p.nome,
          preco: p.preco,
          estoque: p.estoque,
          descricao: p.descricao,
          foto_path: p.foto_path,
        })),
        registered: !!previousBotState?.registered || !!lead.cadastrado,
        leadName: lead.nome,
        flowBlocks: configuredFlow,
        cartItems: currentCartItems,
        storeLink,
      });

      setLeadBotStates(prev => ({ ...prev, [currentLeadId]: result.nextState }));

      const registerEffect = result.effects?.find(effect => effect.type === 'register_lead');
      if (registerEffect) {
        setActiveName(registerEffect.data.nome || activeName);
        log('STATE_MANAGER', 'success', `Cadastro confirmado para ${registerEffect.data.nome} (${registerEffect.data.email})`);
      }

      for (const reply of result.replies) {
        const text = reply.type === 'image' ? `[foto] ${reply.caption}` : reply.text;
        onAddMessage(currentLeadId, 'out', text);
        dispatchWhatsAppMessage(lead.telefone, text);
        log(reply.type === 'image' ? 'PRODUCT_CARD' : 'ACTION_SENDER', 'success', 'Mensagem automatizada enviada pelo fluxo guiado.');
      }

      if (result.action === 'pause_bot') {
        onSetBotPaused(currentLeadId, 1);
        log('STATE_MANAGER', 'warning', 'Robô pausado: atendimento humano solicitado pelo fluxo.');
      }

      return;
    }

    const normalizedText = msgToSend.trim().toLowerCase();

    // 1. Intercept Delivery Address Input if the system is waiting for it
    if (leadAwaitingAddress[currentLeadId]) {
      // Save address
      setLeadAddresses(prev => ({ ...prev, [currentLeadId]: msgToSend }));
      // Clear waiting flag
      setLeadAwaitingAddress(prev => ({ ...prev, [currentLeadId]: false }));

      log('CART_RESOLVER', 'success', `Endereço de entrega salvo: "${msgToSend}"`);

      // Automatically construct final order Summary with shipping cost and Pix Details!
      const cartCalc = calculateCartWithDiscountsAndShipping(currentLeadId);
      const txId = 'TX_PIX_' + Math.floor(100000 + Math.random() * 899999);
      const pixKey = `00020101021226830014br.gov.bcb.pix2561api.pixpayment.com.br/v2/${txId}5204000053039865405${cartCalc.finalTotal.toFixed(2)}5802BR5915LOJA_ROUPAS6009SAO_PAULO62070503***6304`;

      // Create Order in state
      onAddOrder(currentLeadId, cartCalc.finalTotal, pixKey, txId);
      onUpdateLeadStatus(currentLeadId, 'AGUARDANDO_PIX');

      // Update lead block state
      setLeadCurrentBlocks(prev => ({ ...prev, [currentLeadId]: 'faturamento' }));

      let orderSummary = `✅ *PEDIDO RESERVADO COM SUCESSO!* ✅\n\nResumo Simplificado da sua Compra:\n\n`;
      const leadCart = carts.filter(c => c.lead_id === currentLeadId);
      leadCart.forEach((item, index) => {
        const prod = products.find(p => p.id === item.product_id);
        if (prod) {
          orderSummary += `*${index + 1}. ${prod.nome}* (${item.size}) - ${item.quantidade}x\n`;
        }
      });

      orderSummary += `\n───────────────────\n`;
      orderSummary += `🛍️ *Subtotal das Peças:* R$ ${cartCalc.itemsTotal.toFixed(2).replace('.', ',')}\n`;
      orderSummary += `🚚 *Endereço de Entrega:* ${msgToSend}\n`;
      orderSummary += `📦 *Valor do Frete:* ${cartCalc.appliedShippingCost === 0 ? '*Grátis*' : `R$ ${cartCalc.appliedShippingCost.toFixed(2).replace('.', ',')}`}\n`;
      if (cartCalc.couponDiscount > 0) {
        orderSummary += `🎟️ *Cupom Desconto:* - R$ ${cartCalc.couponDiscount.toFixed(2).replace('.', ',')} (${cartCalc.coupon})\n`;
      }
      orderSummary += `💰 *VALOR TOTAL DO PEDIDO: R$ ${cartCalc.finalTotal.toFixed(2).replace('.', ',')}*\n`;
      orderSummary += `🆔 *Identificador do Pix:* ${txId}\n\n👇 *Copie o Código Pix abaixo para pagar no seu App de banco:*`;

      onAddMessage(currentLeadId, 'out', orderSummary);

      setTimeout(() => {
        onAddMessage(currentLeadId, 'out', pixKey);
        onAddMessage(currentLeadId, 'out', `💡 *Para finalizar rápido:* Efetue o pagamento Pix acima no seu banco e envie a palavra *PAGO* para receber automaticamente o comprovante fiscal de confirmação!`);
      }, 800);

      dispatchWhatsAppMessage(lead.telefone, orderSummary);
      return;
    }

    // 2. Intercept Inflow Coupons validation
    const couponsList = ['desconto10', 'promo20', 'quero10', 'fretegratis', 'cupom10'];
    let appliedCouponThisTurn = '';
    couponsList.forEach(c => {
      if (normalizedText === c || normalizedText.includes(`cupom ${c}`)) {
        appliedCouponThisTurn = c.toUpperCase();
      }
    });

    if (appliedCouponThisTurn) {
      setAppliedCoupons(prev => ({ ...prev, [currentLeadId]: appliedCouponThisTurn }));
      log('CART_RESOLVER', 'success', `Cupom de benefícios validado e configurado: "${appliedCouponThisTurn}"`);

      let couponBenefit = '';
      if (appliedCouponThisTurn === 'DESCONTO10' || appliedCouponThisTurn === 'CUPOM10') couponBenefit = '10% de desconto adicional no subtotal de roupas!';
      if (appliedCouponThisTurn === 'PROMO20') couponBenefit = '20% de desconto no total de roupas!';
      if (appliedCouponThisTurn === 'QUERO10') couponBenefit = 'Abatimento direto de R$ 10,05 nas suas peças!';
      if (appliedCouponThisTurn === 'FRETEGRATIS') couponBenefit = 'Frete Grátis 100% isento de custos de envio e entrega!';

      const couponReply = `🎟️ *CUPOM RESGATADO COM SUCESSO!* 🎟️\n\n• Parabéns! Aplicamos o cupom: *${appliedCouponThisTurn}*\n• Benefício: *${couponBenefit}*\n\nSeu desconto será calculado e exibido no resumo final! Digite *FINALIZAR* para gerar o Pix.`;
      
      onAddMessage(currentLeadId, 'out', couponReply);
      dispatchWhatsAppMessage(lead.telefone, couponReply);
      return;
    }
    
    // Simulate thinking delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // Core logic decisions
    let response = '';

    // Load custom flows from localStorage or default
      const botFlows = readPublishedFlow();

    // First, determine if it is a global trigger / command or entry greeting
    const isGreeting = normalizedText === 'oi' || normalizedText === 'ola' || normalizedText === 'olá' || normalizedText === 'começar' || normalizedText === 'menu' || normalizedText === 'ajuda';
    const currentBlockId = isGreeting ? 'boas_vindas' : (leadCurrentBlocks[currentLeadId] || 'boas_vindas');
    
    let activeBlock = botFlows.find(b => b.id === currentBlockId);
    if (!activeBlock) {
      activeBlock = botFlows.find(b => b.isStarting) || botFlows[0];
    }

    // Process options transitions if not a fresh greeting
    let targetBlockId = activeBlock.id;
    let optionMatched = false;

    // A. Global triggers bypass if enabled
    let globalMatchBlock: FlowBlock | undefined;
    if (allowGlobalTriggers && !isGreeting) {
      globalMatchBlock = botFlows.find(b => {
        if (normalizedText === b.id) return true;
        if (b.id === 'catalogo' && (normalizedText === 'catalogo' || normalizedText === 'catálogo' || normalizedText === 'coleção' || normalizedText === 'produtos' || normalizedText === 'ver produtos')) return true;
        if (b.id === 'carrinho' && (normalizedText === 'carrinho' || normalizedText === 'sacola' || normalizedText === 'sacola de compras' || normalizedText === 'itens')) return true;
        if (b.id === 'faturamento' && (normalizedText === 'finalizar' || normalizedText === 'fechar' || normalizedText === 'faturamento' || normalizedText === 'pagar' || normalizedText === 'checkout' || normalizedText === 'concluir')) return true;
        if (b.id === 'suporte' && (normalizedText === 'suporte' || normalizedText === 'ajuda' || normalizedText === 'humano' || normalizedText === 'atendente' || normalizedText === 'falar com suporte')) return true;
        if (b.id === 'boas_vindas' && (normalizedText === 'inicio' || normalizedText === 'início' || normalizedText === 'menu' || normalizedText === 'começar' || normalizedText === 'voltar ao inicio')) return true;
        return false;
      });

      if (globalMatchBlock) {
        log('CORE_LOGIC', 'success', `Gatilho Global detectado: "${normalizedText}" -> Direcionando para o bloco "${globalMatchBlock.title}"`);
        targetBlockId = globalMatchBlock.id;
        optionMatched = true;
        activeBlock = globalMatchBlock;
      }
    }

    if (!isGreeting && activeBlock.type === 'options') {
      if (activeBlock.optionType === 'numeric') {
        // Find if user sent a valid option number
        const optNum = parseInt(normalizedText);
        if (!isNaN(optNum) && optNum >= 1 && optNum <= activeBlock.options.length) {
          const matchedOpt = activeBlock.options[optNum - 1];
          targetBlockId = matchedOpt.destinationBlockId;
          optionMatched = true;
          log('CORE_LOGIC', 'success', `Opção automática casada: ${optNum} -> Bloco: ${targetBlockId}`);
        } else {
          // If the user typed something else inside a numeric block (e.g. text), let's ALSO try fuzzy / trigger matches among the option labels!
          const matchedOpt = fuzzyMatchOption(normalizedText, activeBlock.options);
          if (matchedOpt) {
            targetBlockId = matchedOpt.destinationBlockId;
            optionMatched = true;
            log('CORE_LOGIC', 'success', `Opção aproximada casada via Levenshtein: "${normalizedText}" -> "${matchedOpt.label}"`);
          }
        }
      } else {
        const matchType = activeBlock.keywordMatchType || 'exact';
        
        // Keyword trigger matching
        const matchedOpt = activeBlock.options.find(opt => {
          const triggers = opt.trigger.toLowerCase().split(',').map(t => t.trim());
          return triggers.some(trig => {
            if (matchType === 'contains') {
              return normalizedText.includes(trig) || trig.includes(normalizedText);
            } else {
              return normalizedText === trig;
            }
          });
        });
        if (matchedOpt) {
          targetBlockId = matchedOpt.destinationBlockId;
          optionMatched = true;
          log('CORE_LOGIC', 'success', `Palavra-chave casada (${matchType}): "${normalizedText}" -> Bloco: ${targetBlockId}`);
        } else {
          // Try fuzzy matchmaking with Levenshtein
          const matchedFuzzy = fuzzyMatchOption(normalizedText, activeBlock.options);
          if (matchedFuzzy) {
            targetBlockId = matchedFuzzy.destinationBlockId;
            optionMatched = true;
            log('CORE_LOGIC', 'success', `Fuzzy Levenshtein auto-corrigido: "${normalizedText}" -> "${matchedFuzzy.label}"`);
          }
        }
      }
    }

    // If an option was matched or we entered with a fresh greeting
    let currentBlock = activeBlock;
    if (optionMatched) {
      currentBlock = botFlows.find(b => b.id === targetBlockId) || activeBlock;
      // Persist active block for this client
      setLeadCurrentBlocks(prev => ({
        ...prev,
        [currentLeadId]: currentBlock.id
      }));
    } else if (isGreeting) {
      currentBlock = botFlows.find(b => b.isStarting) || botFlows.find(b => b.id === 'boas_vindas') || activeBlock;
      // Reset block to start
      setLeadCurrentBlocks(prev => ({
        ...prev,
        [currentLeadId]: currentBlock.id
      }));
    }

    // --- EXECUTE BLOCK PERSONALIZED SYSTEM ACTION TYPE ---
    if (currentBlock.actionType && currentBlock.actionType !== 'none') {
      const action = currentBlock.actionType;
      log('CORE_LOGIC', 'success', `Ação customizada de entrada acionada no bloco "${currentBlock.title}": ${action.toUpperCase()}`);
      
      if (action === 'pause_bot') {
        onSetBotPaused(currentLeadId, 1);
        log('STATE_MANAGER', 'warning', `Módulo Automação: Robô pausado para atendimento humano.`);
      } else if (action === 'clear_cart') {
        onClearCart(currentLeadId);
        log('STATE_MANAGER', 'info', `Módulo Compras: Carrinho do lead foi esvaziado.`);
      } else if (action === 'set_status_carrinho') {
        onUpdateLeadStatus(currentLeadId, 'CARRINHO_ABERTO');
      } else if (action === 'set_status_aguardando') {
        onUpdateLeadStatus(currentLeadId, 'AGUARDANDO_PIX');
      } else if (action === 'set_status_pago') {
        onUpdateLeadStatus(currentLeadId, 'PAGO');
        onConfirmOrderPayment(currentLeadId);
      }
    }

    // Now, run the visual response block logic
    let baseMessage = currentBlock.message;

    // Append options to message if numeric/keyword lists are needed
    if (currentBlock.type === 'options' && currentBlock.options.length > 0) {
      if (currentBlock.optionType === 'numeric') {
        const listText = currentBlock.options.map((opt, oIdx) => `*${oIdx + 1}.* ${opt.label}`).join('\n');
        baseMessage += `\n\n${listText}`;
      } else {
        const listText = currentBlock.options.map(opt => `👉 Digite *"${opt.trigger.split(',')[0]}"* para: ${opt.label}`).join('\n');
        baseMessage += `\n\n${listText}`;
      }
    }

    // Process system e-commerce actions based on Block ID matches (catalogo, carrinho, faturamento, suporte, etc.)
    const blockRefId = currentBlock.id;

    // Detect if user typed a valid product code (3 digits) or matched a product's name
    const matchesProductInquiry = products.find(p => {
      const codeStr = p.codigo.trim();
      const nameStr = p.nome.toLowerCase().trim();
      return normalizedText === codeStr ||
             normalizedText === `codigo ${codeStr}` ||
             normalizedText === `código ${codeStr}` ||
             (normalizedText.length >= 3 && p.codigo.includes(normalizedText)) ||
             normalizedText.includes(codeStr) ||
             normalizedText === nameStr ||
             normalizedText.includes(nameStr) ||
             (normalizedText.length >= 4 && nameStr.includes(normalizedText));
    });

    if (matchesProductInquiry) {
      const p = matchesProductInquiry;
      let shippingInfoText = '';
      if (p.has_shipping) {
        shippingInfoText = p.shipping_type === 'free' 
          ? '\n🚚 *Envio:* Frete Grátis!' 
          : `\n🚚 *Envio:* Frete fixo de R$ ${p.shipping_cost?.toFixed(2).replace('.', ',')}`;
      }

      response = `✨ *MODELO SELECIONADO:* ✨\n\n🛍️ *${p.nome}*\n🏷️ *Cód. Consulta:* ${p.codigo}\n💰 *Preço:* R$ ${p.preco.toFixed(2).replace('.', ',')}\n📐 *Tamanhos disponíveis:* M, G, GG (Em estoque)${shippingInfoText}\n\n📝 *Descrição:* ${p.descricao}\n\n👇 *Deseja adicionar esta peça à sua sacola?*\n👉 Digite *COMPRAR ${p.codigo}* para adicionar esse item à sua sacola.`;
      
      log('CORE_LOGIC', 'success', `Pesquisa de produto direta casada: "${p.nome}" (Cód ${p.codigo})`);
    }
    else if (blockRefId === 'catalogo') {
      if (products.length === 0) {
        response = `${baseMessage}\n\nDesculpe, o catálogo de modelos está baleado ou esvaziado hoje no painel do administrador.`;
      } else {
        const pList = products.map(p => `• *[Cód: ${p.codigo}]* ${p.nome}\n  └ Preço: *R$ ${p.preco.toFixed(2).replace('.', ',')}* | Estoque: ${p.estoque} un\n`).join('\n');
        response = `${baseMessage}\n\n${pList}\n✍️ Para consultar a foto, detalhes de um item ou comprá-lo, envie apenas o *código de 3 dígitos* (Ex: *${products[0]?.codigo || '101'}*).`;
      }
    } 
    else if (blockRefId === 'carrinho') {
      if (currentLeadCart.length === 0) {
        response = `${baseMessage}\n\nSua sacola de compras está vazia 🧺! Envie a opção do catálogo para adicionar peças.`;
      } else {
        const cartCalc = calculateCartWithDiscountsAndShipping(currentLeadId);
        let cartItemsSummary = '';
        currentLeadCart.forEach((item, index) => {
          const prod = products.find(p => p.id === item.product_id);
          if (prod) {
            const sub = prod.preco * item.quantidade;
            cartItemsSummary += `*${index + 1}. ${prod.nome}*\n  └ Unidade: R$ ${prod.preco.toFixed(2).replace('.', ',')} | Tam: *${item.size}* | Qtd: *${item.quantidade}*\n  └ Subtotal: *R$ ${sub.toFixed(2).replace('.', ',')}*\n\n`;
          }
        });

        let bottomSummary = `───────────────────\n`;
        bottomSummary += `🛍️ *Subtotal das Peças:* R$ ${cartCalc.itemsTotal.toFixed(2).replace('.', ',')}\n`;
        if (cartCalc.couponDiscount > 0) {
          bottomSummary += `🎟️ *Cupom Aplicado:* - R$ ${cartCalc.couponDiscount.toFixed(2).replace('.', ',')} (${cartCalc.coupon})\n`;
        }
        if (cartCalc.shippingRequired) {
          bottomSummary += `🚚 *Envio:* Requer cálculo de frete posterior\n`;
        }
        bottomSummary += `💰 *VALOR ESTIMADO: R$ ${cartCalc.finalTotal.toFixed(2).replace('.', ',')}*\n\n👉 Envie a opção do menu ou digite *FINALIZAR* para gerar o Pix.`;

        response = `${baseMessage}\n\n${cartItemsSummary}${bottomSummary}`;
      }
    } 
    else if (blockRefId === 'limpar_sacola' || normalizedText === 'limpar') {
      onClearCart(currentLeadId);
      response = baseMessage;
      log('CORE_LOGIC', 'info', `Sacola resetada via WhatsApp. Cliente: ${currentLeadId}`);
    } 
    else if (blockRefId === 'faturamento') {
      if (currentLeadCart.length === 0) {
        response = 'Aviso: Sua sacola de compras está vazia 🧺! Escolha primeiro um produto do nosso catálogo.';
      } else {
        const cartCalc = calculateCartWithDiscountsAndShipping(currentLeadId);
        
        // If shipping is required and we DO NOT have the customer's address yet:
        if (cartCalc.shippingRequired && !leadAddresses[currentLeadId]) {
          // Put the lead in "awaiting address" mode so their next message is saved as their address!
          setLeadAwaitingAddress(prev => ({ ...prev, [currentLeadId]: true }));
          
          response = `🚚 *CÁLCULO DE FRETE NECESSÁRIO* 🚚\n\nIdentificamos uma ou mais peças em seu carrinho que requerem envio físico.\n\n✍️ *Por favor, digite seu endereço de entrega completo (Rua, Número, Bairro, Cidade/UF e CEP):*`;
          
          log('CART_RESOLVER', 'info', `Carrinho requer envio físico. Solicitando endereço ao cliente ${currentLeadId}`);
        } else {
          // Generate Pix details!
          const txId = 'TX_PIX_' + Math.floor(100000 + Math.random() * 899999);
          const pixKey = `00020101021226830014br.gov.bcb.pix2561api.pixpayment.com.br/v2/${txId}5204000053039865405${cartCalc.finalTotal.toFixed(2)}5802BR5915LOJA_ROUPAS6009SAO_PAULO62070503***6304`;

          // Create Order and Shift Lead status inside state
          onAddOrder(currentLeadId, cartCalc.finalTotal, pixKey, txId);
          onUpdateLeadStatus(currentLeadId, 'AGUARDANDO_PIX');

          // Build summary details response message
          let orderSummary = `✅ *PEDIDO RESERVADO COM SUCESSO!* ✅\n\nResumo Simplificado da sua Compra:\n\n`;
          currentLeadCart.forEach((item, index) => {
            const prod = products.find(p => p.id === item.product_id);
            if (prod) {
              orderSummary += `*${index + 1}. ${prod.nome}* (${item.size}) - ${item.quantidade}x\n`;
            }
          });

          orderSummary += `\n───────────────────\n`;
          orderSummary += `🛍️ *Subtotal das Peças:* R$ ${cartCalc.itemsTotal.toFixed(2).replace('.', ',')}\n`;
          if (cartCalc.shippingRequired) {
            orderSummary += `🚚 *Endereço:* ${leadAddresses[currentLeadId]}\n`;
            orderSummary += `📦 *Valor do Frete:* ${cartCalc.appliedShippingCost === 0 ? '*Grátis (Cupom)*' : `R$ ${cartCalc.appliedShippingCost.toFixed(2).replace('.', ',')}`}\n`;
          }
          if (cartCalc.couponDiscount > 0) {
            orderSummary += `🎟️ *Cupom Desconto:* - R$ ${cartCalc.couponDiscount.toFixed(2).replace('.', ',')} (${cartCalc.coupon})\n`;
          }
          orderSummary += `💰 *VALOR TOTAL DO PEDIDO: R$ ${cartCalc.finalTotal.toFixed(2).replace('.', ',')}*\n`;
          orderSummary += `🆔 *Identificador do Pix:* ${txId}\n\n👇 *Copie o Código Pix abaixo para pagar no seu App de banco:*`;

          response = orderSummary;

          log('CART_RESOLVER', 'success', `Faturamento efetuado no Pix de R$ ${cartCalc.finalTotal.toFixed(2)}. Estado do Lead: AGUARDANDO_PIX`);
          
          setTimeout(() => {
            onAddMessage(currentLeadId, 'out', pixKey);
            onAddMessage(currentLeadId, 'out', `💡 *Para finalizar rápido:* Efetue o pagamento Pix acima no seu banco e envie a palavra *PAGO* para receber automaticamente o comprovante fiscal de confirmação!`);
          }, 800);
        }
      }
    } 
    else if (blockRefId === 'suporte') {
      response = baseMessage;
      onSetBotPaused(currentLeadId, 1);
      log('CORE_LOGIC', 'warning', `Aviso: Robô AUTOMÁTICO pausado para dar prioridade ao suporte humano!`);
    } 
    else {
      // Standard custom block message with no special e-commerce actions
      if (!optionMatched && !isGreeting) {
        
        // Product code query override
        const codeMatch = products.find(p => normalizedText.includes(p.codigo) || normalizedText.includes(p.nome.toLowerCase()));
        
        if (codeMatch) {
          response = `✨ *PEÇA DISPONÍVEL:* ✨\n\n🛍️ *${codeMatch.nome}*\n🏷️ *Cód. Consulta:* ${codeMatch.codigo}\n💰 *Preço:* R$ ${codeMatch.preco.toFixed(2).replace('.', ',')}\n📐 *Tamanhos:* M, G, GG (Consulte estoque)\n\n📝 *Detalhes:* ${codeMatch.descricao}\n\n👇 *Selecione uma opção de compra clicando nos botões de atalho:*`;
          log('CORE_LOGIC', 'success', `Localizado produto Cód: ${codeMatch.codigo} na pesquisa textual.`);
        } 
        else if (normalizedText.startsWith('comprar ')) {
          const itemCode = normalizedText.replace('comprar ', '').trim();
          const codeProd = products.find(p => p.codigo === itemCode);
          if (codeProd) {
            onAddCartItem(currentLeadId, codeProd.id, 'M', 1);
            response = `✅ *${codeProd.nome}* adicionado à sacola na quantidade especificada!\n\nEnvie *carrinho* para ver os itens e finalizar sua compra de faturamento ou *catálogo* se quiser comprar mais peças.`;
          } else {
            response = `Desculpe, não localizei nenhum modelo correspondente ao código "${itemCode}".`;
          }
        } 
        else if (normalizedText === 'pago' || normalizedText === 'comprovante' || normalizedText === 'efetuei o pagamento') {
          if (lead.status_funil === 'AGUARDANDO_PIX') {
            onConfirmOrderPayment(currentLeadId);
            response = `🎉 *PAGAMENTO COMPENSADO COM SUCESSO!* 🎉\n\nOba! Recebemos a confirmação eletrônica do seu Pix com sucesso em nosso webhook financeiro.\n\n📦 *Seu pedido já foi enviado para separação logística:*\n• Cliente: ${lead.nome}\n• Telefone: ${lead.telefone}\n\n🧾 *COMPROVANTE DE FATURAMENTO:*\n• Chave da nota NF-e: 3526 0610 9991 0001 5500 2400 9342\n• Protocolo Sefaz: 13526938491\n\nVocê receberá informações sobre o envio e o código de rastreio das peças no WhatsApp em breve! Obrigado pelas compras!`;
            log('CORE_LOGIC', 'success', `Webhook financeiro: Compensação Pix recebida para a transação do Lead ${currentLeadId}`);
          } else {
            response = 'Não identificamos nenhuma cobrança/pedido gerado em aberto no Pix para o seu número ⏳. Deseja fazer novas compras? Envie a palavra *catálogo*!';
          }
        } 
        else {
          // No option matched, fallback print the current block's message and options
          response = `Olá! Não consegui compreender muito bem a mensagem 🙈.\n\n${baseMessage}`;
          log('CORE_LOGIC', 'warning', `Mensagem não casou de forma exata. Exibindo as diretrizes do bloco novamente.`);
        }
      } else {
        response = baseMessage;
      }
    }

    // Output final Bot message log
    if (response) {
      onAddMessage(currentLeadId, 'out', response);
      log('ACTION_SENDER', 'success', `Mensagem automatizada enviada ao destinatário via api.`);
    }

    // Trigger API actual Fetch dispatch if integration mode is indeed active!
    dispatchWhatsAppMessage(lead.telefone, response);
  };

  const dispatchWhatsAppMessage = (toPhone: string, textContent: string) => {
    if (isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      triggerGatewayMessage(toPhone, textContent);
    }
  };

  const triggerGatewayMessage = async (toPhone: string, textContent: string) => {
    const url = whatsAppConfig.apiURL || getSendMessageURL();
    log('ACTION_SENDER', 'info', `[Yummis API] Disparando HTTP POST para o gateway: ${url}`);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${whatsAppConfig.apiKey}`
        },
        body: JSON.stringify({
          to: toPhone,
          message: textContent
        })
      });
      if (response.ok) {
        log('ACTION_SENDER', 'success', `[Yummis API] Mensagem enviada com sucesso!`);
      } else {
        const errData = await response.json().catch(() => ({}));
        log('ACTION_SENDER', 'error', `[Yummis API] Erro: ${errData.error || response.statusText}`);
      }
    } catch (err: any) {
      log('ACTION_SENDER', 'error', `[Yummis API] Falha de requisição: ${err.message}`);
    }
  };

  const simulateQuickKeyword = (text: string) => {
    setInputText(text);
    setTimeout(() => {
      handleSendMessage(text);
    }, 150);
  };

  // Preset button actions
  const selectSizeToBuy = (prod: SQLProduct, size: string) => {
    if (!activeLead) return;
    onAddCartItem(activeLead.id, prod.id, size, 1);
    log('CART_RESOLVER', 'success', `Adicionado item: ${prod.nome} em tamanho ${size}. Carrinho persistido no SQLite.`);
    
    // Send automated response confirm
    const confirmText = `✅ Excelente! Adicionamos o item *${prod.nome}* no tamanho *${size}* na sua sacola de compras com sucesso!\n\nDigite *carrinho* para detalhar os itens e fechar o pedido, ou continue passeando pelo estoque digitando *catálogo*.`;
    onAddMessage(activeLead.id, 'out', confirmText);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6" id="simulator-phone-panel">
      
      {/* LEFT PORT: The Visual Phone Emulator mockup - 6 cols */}
      <div className="xl:col-span-6 flex flex-col items-center">
        
        {/* Device select indicator */}
        <div className="w-full max-w-[340px] mb-2 flex justify-between items-center text-[10px] text-slate-500 font-mono px-2">
          <span>Usuário ativo: <strong className="text-white font-sans">{activeName}</strong></span>
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-indigo-400 hover:underline cursor-pointer"
          >
            Mudar Usuário / Celular
          </button>
        </div>

        {isRegistering && (
          <form onSubmit={handleRegisterContact} className="w-full max-w-[340px] bg-slate-900 border border-white/10 rounded-xl p-3.5 mb-3 space-y-2 text-xs">
            <span className="font-bold text-white uppercase text-[10px] tracking-wide block">Trocar de Número / Simulando Lead</span>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500">Nome do Lead</label>
              <input 
                type="text" 
                required 
                value={nameInput} 
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full bg-slate-950 px-2 py-1.5 rounded text-white border-white/5" 
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-500">Número de WhatsApp (Digitar apenas números)</label>
              <input 
                type="text" 
                required 
                placeholder="Ex: 5511999999999"
                value={phoneInput} 
                onChange={(e) => setPhoneInput(e.target.value)}
                className="w-full bg-slate-950 px-2 py-1.5 rounded text-white border-white/5 font-mono" 
              />
            </div>
            <div className="flex gap-1 pt-1.5">
              <button type="button" onClick={() => setIsRegistering(false)} className="flex-1 py-1 rounded bg-slate-850 hover:bg-slate-800 text-[10px]">Cancelar</button>
              <button type="submit" className="flex-1 py-1 rounded bg-indigo-650 hover:bg-indigo-505 text-[10px] text-white">Confirmar Seleção</button>
            </div>
          </form>
        )}

        {/* Visual Phone mock */}
        <div className="w-full max-w-[350px] aspect-[9/19] bg-black border-[12px] border-slate-950 rounded-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden relative flex flex-col border-b-[18px]">
          {/* Speaker ear piece */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-950 rounded-b-2xl z-30 flex items-center justify-center">
            <div className="w-8 h-1 bg-neutral-800 rounded-full" />
          </div>

          {/* Device Header */}
          <div className="bg-slate-950 pt-5 px-4 pb-3 flex justify-between items-center text-slate-400 font-mono text-[9px] border-b border-white/5">
            <div className="flex items-center gap-1 mt-1 text-slate-400 font-semibold font-sans">
              <span className="w-2 h-2 rounded-full bg-emerald-450 inline-block animate-pulse" />
              Moda Express BOT
            </div>
            <div className="text-[8px] flex items-center gap-1">
              <span>LTE</span>
              <span>100%</span>
            </div>
          </div>

          {/* Chat scrolling viewport inside phone */}
          <div className="flex-1 p-3 bg-neutral-950 flex flex-col justify-between overflow-y-auto max-h-[85%] scrollbar-none relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.03),transparent)] pointer-events-none" />
            
            <div className="space-y-2.5">
              <div className="p-2 bg-slate-900/40 rounded-xl text-[8px] text-slate-500 font-mono text-center border border-white/5">
                Segurança WhatsApp: Chat criptografado por ambiente Sandbox local.
              </div>

              {currentLeadMessages.map(msg => {
                const isBot = msg.direcao === 'out';
                const imageProduct = isBot && msg.texto.startsWith('[foto]')
                  ? products.find(p => msg.texto.includes(p.codigo) || msg.texto.includes(p.nome))
                  : null;
                const displayText = msg.texto.replace(/^\[foto\]\s*/, '');
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isBot ? 'mr-auto items-start' : 'ml-auto items-end'}`}>
                    <div className={`p-2 px-3 rounded-2xl text-[10px] leading-relaxed font-sans ${
                      isBot 
                        ? 'bg-slate-900 border border-white/5 text-slate-150 rounded-tl-none' 
                        : 'bg-indigo-650 text-white rounded-tr-none'
                    }`}>
                      {msg.operator_name && (
                        <div className="font-extrabold text-[8.5px] uppercase tracking-wider text-indigo-400 mb-1.5 border-b border-white/5 pb-1">
                          👤 <strong>{msg.operator_name.split('@')[0].split(' ')[0]}</strong>
                        </div>
                      )}
                      {imageProduct && (
                        <img
                          src={imageProduct.foto_path}
                          alt={imageProduct.nome}
                          referrerPolicy="no-referrer"
                          className="mb-2 h-28 w-full rounded-xl object-cover border border-white/10 bg-slate-950"
                        />
                      )}
                      <p className="whitespace-pre-wrap select-all selection:bg-indigo-900">{displayText}</p>

                      {/* Render interactive Buy Card buttons if code match details */}
                      {isBot && msg.texto.includes('Descrição:') && products.map(p => {
                        if (msg.texto.includes(p.nome)) {
                          return (
                            <div key={p.id} className="mt-3.5 space-y-1.5 border-t border-white/10 pt-2 bg-slate-900">
                              <span className="text-[8px] text-indigo-400 uppercase font-mono block">Escolher Tamanho do Vestuário:</span>
                              <div className="flex gap-1">
                                {['P', 'M', 'G', 'GG'].map(size => (
                                  <button
                                    key={size}
                                    onClick={() => selectSizeToBuy(p, size)}
                                    className="flex-1 py-1 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded text-[8px] font-bold text-slate-300 cursor-pointer"
                                  >
                                    Tamanho {size}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                    <span className="text-[7px] text-slate-650 font-mono mt-0.5 ml-1">
                      {isBot ? 'Bot' : 'Você'} • {new Date(msg.data_envio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Quick Shortcuts bar above keyboard */}
          <div className="bg-slate-950 p-2 gap-1.5 flex overflow-x-auto scrollbar-none border-t border-white/5">
            <button onClick={() => simulateQuickKeyword('Catálogo')} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-full text-[8px] font-bold text-slate-350 shrink-0 cursor-pointer">👗 Catálogo</button>
            <button onClick={() => simulateQuickKeyword('101')} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-full text-[8px] font-bold text-slate-350 shrink-0 cursor-pointer">🏷️ Ver Vestido 101</button>
            <button onClick={() => simulateQuickKeyword('Carrinho')} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-full text-[8px] font-bold text-slate-350 shrink-0 cursor-pointer">🛒 Ver Sacola</button>
            <button onClick={() => simulateQuickKeyword('Finalizar')} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-full text-[8px] font-bold text-slate-350 shrink-0 cursor-pointer">💳 Fechar Pix</button>
            <button onClick={() => simulateQuickKeyword('Pago')} className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-full text-[8px] font-bold text-slate-350 shrink-0 cursor-pointer">🎉 Simular PAGO</button>
          </div>

          {/* Input container inside phone */}
          <div className="bg-slate-950 p-2 border-t border-white/5 flex gap-1.5">
            <input
              type="text"
              placeholder="Envie oi, catalogo ou um código..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-grow bg-slate-900 border border-white/5 rounded-full py-1.5 px-3 text-[10px] text-white focus:outline-none font-sans"
            />
            <button
              onClick={() => handleSendMessage()}
              className="p-1.5 bg-indigo-650 hover:bg-indigo-500 rounded-full text-white cursor-pointer flex items-center justify-center shrink-0"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PORT: Engine logs & Trigger schedulers - 6 cols */}
      <div className="xl:col-span-6 space-y-5 flex flex-col justify-between">
        
        {/* Scheduler Cron Actions */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg space-y-3.5">
          <div>
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Gatilhador de Recuperação automática (Cronjob Simulator)
            </h4>
            <p className="text-[11px] text-slate-400">
              Varre a tabela SQLite <code className="bg-slate-950 border border-white/5 text-slate-350 font-mono text-[9px] px-1 rounded">carts</code> e dispara notificações síncronas de abandono para leads sem faturas geradas de compras há mais de 24h ou 48h:
            </p>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-white/5 rounded-xl">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-white block">Ativar Gatilhos Globais</span>
              <span className="text-[9px] text-slate-500">Se ativo, palavras avulsas como "catalogo", "carrinho" e "suporte" mudam o bloco do cliente de imediato.</span>
            </div>
            <input
              type="checkbox"
              checked={allowGlobalTriggers}
              onChange={(e) => setAllowGlobalTriggers(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-650 bg-slate-950 border-white/10 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => onTriggerInactivityRecovery(24)}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all border border-indigo-550/20 rounded-xl text-xs font-bold text-indigo-400 text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4 shrink-0" />
              Executar Cron 24h
            </button>

            <button
              onClick={() => onTriggerInactivityRecovery(48)}
              className="py-2.5 px-3 bg-slate-950 hover:bg-slate-850 active:scale-98 transition-all border border-indigo-550/20 rounded-xl text-xs font-bold text-indigo-400 text-center flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Clock className="w-4 h-4 shrink-0" />
              Executar Cron 48h (+ Cupom)
            </button>
          </div>
        </div>

        {/* Real-time Engine steps console logs */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg space-y-3.5 flex-1 flex flex-col">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              Logs de Comunicação & Engine de Atendimento
            </h4>
            <button
              onClick={() => setSimLogs([])}
              className="text-[9px] font-bold text-slate-500 hover:text-white cursor-pointer uppercase flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpar Logs
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[300px] font-mono text-[10px] leading-normal scrollbar-thin scroll-smooth">
            {simLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-600 col-span-full py-12 italic text-center">
                Console limpo. Envie mensagens pelo celular ao lado para disparar a engine!
              </div>
            ) : (
              simLogs.map(log => {
                const badgeColor = 
                  log.level === 'success' 
                    ? 'bg-emerald-950/80 text-emerald-440 border border-emerald-500/20' 
                    : log.level === 'warning' 
                      ? 'bg-amber-950/80 text-amber-440 border border-amber-500/20' 
                      : log.level === 'error' 
                        ? 'bg-rose-950/80 text-rose-440 border border-rose-500/20' 
                        : 'bg-slate-950/80 text-indigo-400 border border-slate-500/10';

                return (
                  <div key={log.id} className="p-2 rounded-lg bg-slate-950/40 border border-white/5 flex gap-2 items-start shrink-0 relative animate-fadeIn">
                    <div className="text-[8px] text-slate-550 select-none">{log.timestamp}</div>
                    <div className="flex-1 font-sans">
                      <div className="flex items-center gap-1.5 mb-1 bg-slate-950">
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase tracking-wider ${badgeColor}`}>
                          {log.node}
                        </span>
                        <span className="text-[8px] text-slate-500 tracking-wider">STATUS_OK</span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-sans leading-relaxed">{log.message}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
