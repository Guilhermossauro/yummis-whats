import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers, 
  Smartphone, 
  Settings, 
  Database, 
  TrendingUp, 
  ShoppingBag, 
  MessageSquare, 
  Wifi, 
  User, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  ArrowRight,
  Code2
} from 'lucide-react';

import AdminLogin from './components/AdminLogin';
import AdminCRM from './components/AdminCRM';
import AdminCatalog from './components/AdminCatalog';
import AdminChat from './components/AdminChat';
import AdminSettings from './components/AdminSettings';
import AdminSqlTerminal from './components/AdminSqlTerminal';
import ChatSimulator from './components/ChatSimulator';
import SuperAdminPanel from './components/SuperAdminPanel';
import AdminCustomerProfiles from './components/AdminCustomerProfiles';

import { SQLProduct, SQLLead, SQLCart, SQLOrder, SQLMessageLog, WhatsAppConfig, SQLSeller, SQLEmployee } from './types';
import { PRODUCTS } from './data/products';
import { getSendMessageURL, getGatewayBaseURL, isGatewayMode } from './lib/gateway';
import { processBotMessage, BotProduct } from './lib/botProcessor';

export default function App() {
  
  // 1. Session state
  const [lojistaUser, setLojistaUser] = useState<{ name: string; email: string; store_name?: string } | null>(() => {
    const saved = localStorage.getItem('sql_lojista');
    return saved ? JSON.parse(saved) : null;
  });

  // 2. Tab selection
  const [activeTab, setActiveTab] = useState<'crm' | 'catalog' | 'chat' | 'simulator' | 'settings' | 'sqlite' | 'customer_profiles'>('simulator');

  // 3. Database tables (Simulated SQL)
  const [products, setProducts] = useState<SQLProduct[]>(() => {
    const saved = localStorage.getItem('sql_products');
    if (saved) return JSON.parse(saved);
    // Seed initial products
    return PRODUCTS.map(p => ({
      id: p.id,
      codigo: p.code,
      nome: p.name,
      descricao: p.description,
      preco: p.price,
      foto_path: p.image,
      estoque: 25
    }));
  });

  const [leads, setLeads] = useState<SQLLead[]>(() => {
    const saved = localStorage.getItem('sql_leads');
    if (saved) return JSON.parse(saved);
    // Seed initial leads
    return [
      {
        id: '101',
        telefone: '5511999999999',
        nome: 'Guilherme',
        status_funil: 'CARRINHO_ABERTO',
        ultimo_gatilho: new Date(Date.now() - 3600000).toISOString(),
        bot_pausado: 0
      },
      {
        id: '102',
        telefone: '5511888888888',
        nome: 'Maria Clara',
        status_funil: 'AGUARDANDO_PIX',
        ultimo_gatilho: new Date(Date.now() - 7200000).toISOString(),
        bot_pausado: 0
      },
      {
        id: '103',
        telefone: '5521777777777',
        nome: 'Jean da Silva',
        status_funil: 'PAGO',
        ultimo_gatilho: new Date(Date.now() - 10800000).toISOString(),
        bot_pausado: 1
      }
    ];
  });

  const [carts, setCarts] = useState<SQLCart[]>(() => {
    const saved = localStorage.getItem('sql_carts');
    if (saved) return JSON.parse(saved);
    // Seed initial carts
    return [
      {
        id: '1',
        lead_id: '101',
        product_id: '101',
        quantidade: 1,
        size: 'M',
        atualizado_em: new Date().toISOString()
      },
      {
        id: '2',
        lead_id: '102',
        product_id: '103',
        quantidade: 1,
        size: '38',
        atualizado_em: new Date().toISOString()
      }
    ];
  });

  const [orders, setOrders] = useState<SQLOrder[]>(() => {
    const saved = localStorage.getItem('sql_orders');
    if (saved) return JSON.parse(saved);
    // Seed initial orders
    return [
      {
        id: '501',
        lead_id: '102',
        total: 169.90,
        status_pagamento: 'PENDENTE',
        pix_copia_cola: '00020101021226830014br.gov.bcb.pix...',
        transaction_id: 'TX_PIX_SAMPLE_123',
        data_criacao: new Date(Date.now() - 7200000).toISOString()
      },
      {
        id: '502',
        lead_id: '103',
        total: 79.90,
        status_pagamento: 'PAGO',
        pix_copia_cola: '00020101021226830014br.gov.bcb.pix...',
        transaction_id: 'TX_PIX_SAMPLE_456',
        data_criacao: new Date(Date.now() - 10800000).toISOString()
      }
    ];
  });

  const [messages, setMessages] = useState<SQLMessageLog[]>(() => {
    const saved = localStorage.getItem('sql_messages_log');
    if (saved) return JSON.parse(saved);
    // Seed initial messages history
    return [
      {
        id: 'msg_1',
        lead_id: '101',
        direcao: 'in',
        texto: 'oi',
        data_envio: new Date(Date.now() - 3650000).toISOString()
      },
      {
        id: 'msg_2',
        lead_id: '101',
        direcao: 'out',
        texto: 'Olá, Guilherme! Seja bem-vinda à *Moda Express*! 👗🛍️\n\nQual modelo de roupa você gostaria de ver hoje? Envie a palavra *catálogo*!',
        data_envio: new Date(Date.now() - 3600000).toISOString()
      }
    ];
  });

  const [whatsAppConfig, setWhatsAppConfig] = useState<WhatsAppConfig>(() => {
    const saved = localStorage.getItem('sql_whatsapp_config');
    return saved ? JSON.parse(saved) : {
      mode: 'sandbox',
      apiKey: '',
      instanceName: '',
      apiURL: '' // vazio = usa a URL dinâmica do gateway (Yummis API)
    };
  });

  // Write variables back into LocalStorage to guarantee durable data persistence
  useEffect(() => {
    localStorage.setItem('sql_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('sql_leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem('sql_carts', JSON.stringify(carts));
  }, [carts]);

  useEffect(() => {
    localStorage.setItem('sql_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('sql_messages_log', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sql_whatsapp_config', JSON.stringify(whatsAppConfig));
  }, [whatsAppConfig]);

  // ------------------------------------------------------------------
  //  SINCRONIZAÇÃO COM O GATEWAY (Chat Omnichannel)
  //  Faz polling do inbox do gateway: mensagens reais recebidas em
  //  qualquer canal (WhatsApp/Telegram/Facebook/Instagram/X) aparecem
  //  aqui no front com a origem de cada mensagem.
  // ------------------------------------------------------------------
  const gatewayLastIdRef = useRef<number>(Number(localStorage.getItem('gw_inbox_since') || 0));
  // Estado do fluxo do bot por lead (bloco atual da conversa), persistido.
  const botStateRef = useRef<Record<string, string>>(
    JSON.parse(localStorage.getItem('gw_bot_state') || '{}')
  );
  // Na 1ª sincronização não respondemos o histórico (apenas marcamos a base).
  const firstSyncRef = useRef<boolean>(true);

  useEffect(() => {
    if (!isGatewayMode(whatsAppConfig.mode) || !whatsAppConfig.apiKey) return;
    let alive = true;
    const base = getGatewayBaseURL();
    const token = whatsAppConfig.apiKey;

    // Produtos atuais da plataforma (para o catálogo do bot e o card com foto)
    const readProducts = (): BotProduct[] => {
      try {
        const saved = JSON.parse(localStorage.getItem('sql_products') || '[]');
        return saved.map((p: any) => ({
          codigo: p.codigo, nome: p.nome, preco: p.preco, estoque: p.estoque,
          descricao: p.descricao, foto_path: p.foto_path,
        }));
      } catch { return []; }
    };

    // PROCESSAMENTO DO BOT (na plataforma) + envio da resposta pelo gateway
    const runBotFor = async (m: any) => {
      const stateKey = `gw${m.lead_id}`;
      const firstName = (m.nome && m.nome !== 'Novo contato') ? String(m.nome).split(' ')[0] : '';
      const result = processBotMessage(m.texto, botStateRef.current[stateKey], {
        products: readProducts(),
        leadName: firstName,
      });
      botStateRef.current[stateKey] = result.nextBlockId;
      localStorage.setItem('gw_bot_state', JSON.stringify(botStateRef.current));

      // Ação de handoff: pausa o bot no gateway (atendente assume)
      if (result.action === 'pause_bot') {
        setLeads(prev => prev.map(l => l.id === stateKey ? { ...l, bot_pausado: 1 } : l));
        fetch(`${base}/api/bot/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ phone: m.telefone, channel: m.channel }),
        }).catch(() => {});
      }

      // Envia as respostas que o BOT montou (gateway só entrega; actor=bot debita).
      // Suporta texto e imagem (card de produto com foto + ficha).
      for (const reply of result.replies) {
        const payload = reply.type === 'image'
          ? { to: m.telefone, channel: m.channel || 'whatsapp', image: reply.image, caption: reply.caption, actor: 'bot' }
          : { to: m.telefone, channel: m.channel || 'whatsapp', message: reply.text, actor: 'bot' };
        await fetch(`${base}/api/gateway/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload),
        }).catch(() => {});
      }
    };

    const sync = async () => {
      try {
        const url = `${base}/api/inbox?since=${gatewayLastIdRef.current}`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok || !alive) return;
        const data: { lastId: number; messages: any[] } = await res.json();
        if (!data.messages?.length) { firstSyncRef.current = false; return; }

        // Upsert dos leads vindos do gateway (id prefixado para não colidir)
        setLeads(prev => {
          let next = prev;
          for (const m of data.messages) {
            const leadId = `gw${m.lead_id}`;
            const existing = next.find(l => l.id === leadId);
            if (existing) {
              next = next.map(l => l.id === leadId
                ? { ...l, nome: m.nome || l.nome, bot_pausado: m.bot_pausado ?? l.bot_pausado, channel: m.channel, ultimo_gatilho: new Date().toISOString() }
                : l);
            } else {
              next = [...next, {
                id: leadId,
                telefone: m.telefone,
                nome: m.nome || 'Novo contato',
                status_funil: 'CARRINHO_ABERTO' as const,
                ultimo_gatilho: new Date().toISOString(),
                bot_pausado: m.bot_pausado ?? 0,
                channel: m.channel,
              }];
            }
          }
          return next;
        });

        // Acrescenta as mensagens novas (dedupe por id)
        setMessages(prev => {
          const ids = new Set(prev.map(p => p.id));
          const fresh = data.messages
            .filter(m => !ids.has(`gw_msg_${m.id}`))
            .map(m => ({
              id: `gw_msg_${m.id}`,
              lead_id: `gw${m.lead_id}`,
              direcao: m.direcao as 'in' | 'out',
              texto: m.texto,
              data_envio: m.data_envio || new Date().toISOString(),
              channel: m.channel,
            }));
          return fresh.length ? [...prev, ...fresh] : prev;
        });

        gatewayLastIdRef.current = data.lastId;
        localStorage.setItem('gw_inbox_since', String(data.lastId));

        // A PLATAFORMA processa o fluxo: responde só às mensagens recebidas ('in')
        // de leads com o bot ativo. Não processa o histórico na 1ª carga.
        if (!firstSyncRef.current) {
          for (const m of data.messages) {
            if (m.direcao === 'in' && !m.bot_pausado) {
              await runBotFor(m);
            }
          }
        }
        firstSyncRef.current = false;
      } catch {
        // gateway offline: tenta de novo no próximo tick
      }
    };

    sync();
    const timer = setInterval(sync, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, [whatsAppConfig.mode, whatsAppConfig.apiKey]);

  // Sellers and staff accounts limit state
  const [sellers, setSellers] = useState<SQLSeller[]>(() => {
    const saved = localStorage.getItem('sql_sellers');
    if (saved) return JSON.parse(saved);
    return [
      { id: '1', name: 'Lucas Rossi', email: 'lucas@modaexpress.com', senha_hash: '123456', store_name: 'Moda Express Prime', criado_em: new Date().toISOString() },
      { id: '2', name: 'Camila Souza', email: 'camila@modaexpress.com', senha_hash: '123456', store_name: 'Camila Closet', criado_em: new Date().toISOString() }
    ];
  });

  const [employeeLimit, setEmployeeLimit] = useState<number>(() => {
    const saved = localStorage.getItem('sql_employee_limit');
    return saved ? Number(saved) : 5;
  });

  const [employees, setEmployees] = useState<SQLEmployee[]>(() => {
    const saved = localStorage.getItem('sql_employees');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('sql_sellers', JSON.stringify(sellers));
  }, [sellers]);

  useEffect(() => {
    localStorage.setItem('sql_employee_limit', String(employeeLimit));
  }, [employeeLimit]);

  useEffect(() => {
    localStorage.setItem('sql_employees', JSON.stringify(employees));
  }, [employees]);

  const handleAddSeller = (newSeller: Omit<SQLSeller, 'id' | 'criado_em'>) => {
    if (sellers.some(s => s.email.toLowerCase() === newSeller.email.toLowerCase())) {
      return false;
    }
    const newlyCreated: SQLSeller = {
      ...newSeller,
      id: String(sellers.length + 101),
      criado_em: new Date().toISOString()
    };
    setSellers(prev => [...prev, newlyCreated]);
    return true;
  };

  const handleEditSeller = (sellerId: string, updated: Partial<SQLSeller>) => {
    setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, ...updated } : s));
  };

  const handleDeleteSeller = (sellerId: string) => {
    setSellers(prev => prev.filter(s => s.id !== sellerId));
  };

  const handleAddEmployee = (name: string, email: string, senha_hash: string, sellerId: string): { success: boolean; msg: string } => {
    const sellerEmployees = employees.filter(e => e.seller_id === sellerId);
    if (sellerEmployees.length >= employeeLimit) {
      return { success: false, msg: `Limite atingido! O limite máximo definido pelo administrador é de ${employeeLimit} funcionários por loja.` };
    }
    
    const emailLower = email.toLowerCase();
    const emailExists = sellers.some(s => s.email.toLowerCase() === emailLower) || 
                        employees.some(e => e.email.toLowerCase() === emailLower) ||
                        emailLower === 'adminsuper@admin.com';
                        
    if (emailExists) {
      return { success: false, msg: 'E-mail indisponível! Já existe um acesso cadastrado com este e-mail no sistema.' };
    }

    const newEmp: SQLEmployee = {
      id: String(employees.length + 1001),
      seller_id: sellerId,
      name,
      email,
      senha_hash,
      criado_em: new Date().toISOString()
    };
    setEmployees(prev => [...prev, newEmp]);
    return { success: true, msg: 'Funcionário cadastrado com sucesso!' };
  };

  const handleEditEmployee = (id: string, updated: Partial<SQLEmployee>) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
  };

  const handleDeleteEmployee = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  // Auth logins handler
  const handleLogin = (user: { name: string; email: string }) => {
    setLojistaUser(user);
    localStorage.setItem('sql_lojista', JSON.stringify(user));
  };

  const handleLogout = () => {
    setLojistaUser(null);
    localStorage.removeItem('sql_lojista');
  };

  const handleUpdateProfile = (name: string, email: string, storeName?: string) => {
    if (lojistaUser) {
      const updated = { ...lojistaUser, name, email, store_name: storeName };
      setLojistaUser(updated);
      localStorage.setItem('sql_lojista', JSON.stringify(updated));
      // Also update in sellers list if it exists to keep tables in sync
      setSellers(prev => prev.map(s => s.email.toLowerCase() === email.toLowerCase() ? { ...s, name, store_name: storeName || s.store_name } : s));
    }
  };

  // SQL MUTATORS
  const handleAddProduct = (payload: Omit<SQLProduct, 'id'>) => {
    const newProduct: SQLProduct = {
      ...payload,
      id: String(products.length + 101)
    };
    setProducts(prev => [newProduct, ...prev]);
  };

  const handleEditProduct = (id: string, payload: Partial<SQLProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));
  };

  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Funnel card movement
  const handleMoveLead = (leadId: string, nextStatus: SQLLead['status_funil']) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_funil: nextStatus, ultimo_gatilho: new Date().toISOString() } : l));
  };

  const handleDeleteLead = (leadId: string) => {
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setCarts(prev => prev.filter(c => c.lead_id !== leadId));
  };

  // Omnichannel message dispatcher (Human operator manual sending)
  const handleSendManualMessage = (leadId: string, text: string) => {
    const lead = leads.find(l => l.id === leadId);
    const newMsg: SQLMessageLog = {
      id: 'usr_msg_' + Math.random().toString(),
      lead_id: leadId,
      direcao: 'out',
      texto: text,
      data_envio: new Date().toISOString(),
      operator_name: lojistaUser ? lojistaUser.email || lojistaUser.name : 'Suporte Humano'
    };
    
    // 1. Add log message
    setMessages(prev => [...prev, newMsg]);

    // 2. Pause the automated bot since operator intervened! (As requested)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, bot_pausado: 1, ultimo_gatilho: new Date().toISOString() } : l));

    if (!lead) return;

    // 3. Despacho:
    //    - Leads do gateway (omnichannel): rota do ATENDENTE = GRATUITA (não consome token)
    //    - Leads locais (simulador): comportamento antigo
    if (leadId.startsWith('gw') && isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      fetch(`${getGatewayBaseURL()}/api/bot/operator-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whatsAppConfig.apiKey}` },
        body: JSON.stringify({ phone: lead.telefone, message: text, channel: lead.channel || 'whatsapp' })
      }).catch(() => {});
    } else {
      dispatchWhatsAppMessage(lead.telefone, text);
    }
  };

  const dispatchWhatsAppMessage = async (toPhone: string, textContent: string) => {
    // Yummis API = nosso gateway. URL resolvida dinamicamente pela origem atual
    // (mesma do navegador), com override opcional via apiURL.
    if (isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      try {
        await fetch(whatsAppConfig.apiURL || getSendMessageURL(), {
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
      } catch (err) {}
    }
  };

  const handleToggleBot = (leadId: string, paused: number) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, bot_pausado: paused } : l));
    // Para leads do gateway, sincroniza o estado do bot no servidor:
    //   pausar = atendente assume (handoff) | ativar = encerrar atendimento (close)
    const lead = leads.find(l => l.id === leadId);
    if (lead && leadId.startsWith('gw') && isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      const endpoint = paused ? 'handoff' : 'close';
      fetch(`${getGatewayBaseURL()}/api/bot/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whatsAppConfig.apiKey}` },
        body: JSON.stringify({ phone: lead.telefone, channel: lead.channel || 'whatsapp' })
      }).catch(() => {});
    }
  };

  // Simulator actions hooks
  const handleAddLead = (newLead: SQLLead) => {
    setLeads(prev => {
      if (prev.find(l => l.telefone === newLead.telefone)) return prev;
      return [...prev, newLead];
    });
  };

  const handleAddCartItem = (leadId: string, productId: string, size: string, quantity: number) => {
    const newId = String(carts.length + 1);
    const newItem: SQLCart = {
      id: newId,
      lead_id: leadId,
      product_id: productId,
      quantidade: quantity,
      size,
      atualizado_em: new Date().toISOString()
    };

    setCarts(prev => {
      // If same product and size exists, add quantity
      const existing = prev.findIndex(item => item.lead_id === leadId && item.product_id === productId && item.size === size);
      if (existing > -1) {
        const copy = [...prev];
        copy[existing].quantidade += quantity;
        return copy;
      }
      return [...prev, newItem];
    });
  };

  const handleClearCart = (leadId: string) => {
    setCarts(prev => prev.filter(item => item.lead_id !== leadId));
  };

  const handleAddOrder = (leadId: string, total: number, pix: string, txId: string) => {
    const newId = String(orders.length + 501);
    const newOrder: SQLOrder = {
      id: newId,
      lead_id: leadId,
      total,
      status_pagamento: 'PENDENTE',
      pix_copia_cola: pix,
      transaction_id: txId,
      data_criacao: new Date().toISOString()
    };
    setOrders(prev => [newOrder, ...prev]);
  };

  const handleAddMessage = (leadId: string, direcao: 'in' | 'out', text: string) => {
    const newMsg: SQLMessageLog = {
      id: 'sim_msg_' + Math.random().toString(),
      lead_id: leadId,
      direcao,
      texto: text,
      data_envio: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMsg]);
    
    // Update lead timestamp
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ultimo_gatilho: new Date().toISOString() } : l));
  };

  const handleConfirmOrderPayment = (leadId: string) => {
    setOrders(prev => prev.map(o => o.lead_id === leadId ? { ...o, status_pagamento: 'PAGO' } : o));
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_funil: 'PAGO', ultimo_gatilho: new Date().toISOString() } : l));
    // Clear cart once order paid
    setCarts(prev => prev.filter(c => c.lead_id !== leadId));
  };

  const handleTriggerInactivityRecovery = (hours: 24 | 48) => {
    // Simulated background cron check
    // Finds active lead with open cart items that isn't already paid
    const shoppingLeads = leads.filter(l => l.status_funil === 'CARRINHO_ABERTO');
    
    let firedCount = 0;

    shoppingLeads.forEach(lead => {
      const hasCart = carts.some(c => c.lead_id === lead.id);
      if (hasCart) {
        firedCount++;
        
        let msg = '';
        if (hours === 24) {
          msg = `Olá, ${lead.nome}! Tudo bem? 😊\n\nPassando para te avisar que reservamos os itens da sua sacola, mas seu pedido não foi finalizado. Digite *CARRINHO* para concluir compras!`;
        } else {
          msg = `Oi, ${lead.nome}! 🤩 Liberamos um cupom de *FRETE GRÁTIS* exclusivo para você fechar suas compras agora!\n\nUse o Cupom: *FRETEGRATIS* e digite *FINALIZAR* para resgatar.`;
        }

        // Add to logs and shift stage
        handleAddMessage(lead.id, 'out', msg);
        if (hours === 48) {
          handleMoveLead(lead.id, 'AGUARDANDO_PIX'); // Advance to waiting payment as hook
        }
      }
    });

    alert(`[CRON SCHEDULE] Varredura SQLite finalizada.\n\nContas inspecionadas: ${shoppingLeads.length}\nAutomações disparadas com sucesso de abandono ${hours}h: ${firedCount}`);
  };

  return (
    <div className="bg-[#0A0A0B] min-h-screen text-slate-200 font-sans selection:bg-indigo-900 selection:text-indigo-200" id="main-admin-app-root">
      
      {/* Header element */}
      {lojistaUser && lojistaUser.email === 'adminsuper@admin.com' ? null : (
        <header className="bg-slate-950 border-b border-white/10 sticky top-0 z-40" id="global-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-650 flex items-center justify-center text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]">
                  <Layers className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h1 className="text-sm font-extrabold text-white uppercase tracking-tight flex items-center gap-1.5 font-sans">
                    {lojistaUser?.store_name || 'Moda Express Premium'}
                    <span className="text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-550/20 px-1.5 py-0.5 rounded font-normal uppercase tracking-normal">
                      v1.5 PRO
                    </span>
                  </h1>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider font-sans">Painel de Controle & Engine de Atendimento Monolítico</p>
                </div>
              </div>

              {/* User credentials & Logout */}
              {lojistaUser && (
                <div className="flex items-center gap-4">
                  <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-white/5 rounded-xl">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-xs text-slate-300 font-medium font-sans">Operador: {lojistaUser.name}</span>
                  </div>
                  
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer font-sans"
                    title="Sair do Painel"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">Deslogar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {lojistaUser === null ? (
        <AdminLogin onLoginSuccess={handleLogin} />
      ) : lojistaUser.email === 'adminsuper@admin.com' ? (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" id="superadmin-wrapper">
          <SuperAdminPanel 
            sellers={sellers}
            employeeLimit={employeeLimit}
            onAddSeller={handleAddSeller}
            onEditSeller={handleEditSeller}
            onDeleteSeller={handleDeleteSeller}
            onUpdateLimit={setEmployeeLimit}
            onLogout={handleLogout}
          />
        </main>
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6" id="dashboard-wrapper">
          
          {/* Main Visual Navigator Tabs row */}
          <div className="flex bg-slate-900/60 rounded-xl p-1.5 border border-white/10 shadow-lg overflow-x-auto scrollbar-none backdrop-blur-md" id="tab-nav-bar">
            
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'simulator'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              1. Celular Simulado
            </button>

            <button
              onClick={() => setActiveTab('crm')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'crm'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              2. Funil de Vendas CRM
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'chat'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              3. Chat Omnichannel
            </button>

            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'catalog'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              4. Catálogo CRUD
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Wifi className="w-4 h-4" />
              5. Conexões & Conta
            </button>

            <button
              onClick={() => setActiveTab('sqlite')}
              className={`flex-grow flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'sqlite'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Database className="w-4 h-4" />
              6. Banco SQLite Terminal
            </button>

            <button
              onClick={() => setActiveTab('customer_profiles')}
              className={`flex-grow flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
                activeTab === 'customer_profiles'
                  ? 'bg-indigo-650 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] border border-indigo-400/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              id="tab-btn-customer-profiles"
            >
              <User className="w-4 h-4 text-indigo-400" />
              7. Perfis de Clientes
            </button>
          </div>

          {/* Active Tab rendering router */}
          <div className="transition-all duration-350 min-h-[550px]" id="tab-body-pane">
            
            {activeTab === 'simulator' && (
              <div className="space-y-4">
                <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-4 h-4 text-indigo-400 animate-pulse" />
                    Interação & Atendimento via Celular Simulado
                  </h3>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    Envie mensagens como cliente do WhatsApp (Ex: <strong className="text-slate-200">"oi"</strong>, <strong className="text-slate-200">"catálogo"</strong>, <strong className="text-slate-200">"101"</strong>, <strong className="text-slate-200">"carrinho"</strong>, <strong className="text-slate-200">"finalizar"</strong> ou <strong className="text-slate-200">"pago"</strong>) para engatilhar a engine de atendimento. Acompanhe a geração dos Pix e veja em tempo real as tabelas do SQLite sofrerem mutações em sincronia com o CRM e Chat a Vivo!
                  </p>
                </div>
                
                <ChatSimulator 
                  products={products}
                  leads={leads}
                  carts={carts}
                  orders={orders}
                  messages={messages}
                  whatsAppConfig={whatsAppConfig}
                  onAddLead={handleAddLead}
                  onUpdateLeadStatus={handleMoveLead}
                  onAddCartItem={handleAddCartItem}
                  onClearCart={handleClearCart}
                  onAddOrder={handleAddOrder}
                  onAddMessage={handleAddMessage}
                  onSetBotPaused={handleToggleBot}
                  onConfirmOrderPayment={handleConfirmOrderPayment}
                  onTriggerInactivityRecovery={handleTriggerInactivityRecovery}
                />
              </div>
            )}

            {activeTab === 'crm' && (
              <AdminCRM 
                leads={leads}
                carts={carts}
                products={products}
                orders={orders}
                onMoveLead={handleMoveLead}
                onDeleteLead={handleDeleteLead}
              />
            )}

            {activeTab === 'chat' && (
              <AdminChat 
                leads={leads}
                messages={messages}
                carts={carts}
                products={products}
                whatsAppConfig={whatsAppConfig}
                onSendManualMessage={handleSendManualMessage}
                onToggleBot={handleToggleBot}
                onSimulateWebhook={() => {}}
              />
            )}

            {activeTab === 'catalog' && (
              <AdminCatalog 
                products={products}
                onAddProduct={handleAddProduct}
                onEditProduct={handleEditProduct}
                onDeleteProduct={handleDeleteProduct}
              />
            )}

            {activeTab === 'settings' && (
              <AdminSettings 
                whatsAppConfig={whatsAppConfig}
                onUpdateWhatsAppConfig={setWhatsAppConfig}
                lojista={lojistaUser}
                onUpdateProfile={handleUpdateProfile}
                onResetPassword={(pwd) => log('SECURITY', 'info', 'Senha do lojista alterada com sucesso')}
                employees={employees}
                employeeLimit={employeeLimit}
                sellers={sellers}
                onAddEmployee={handleAddEmployee}
                onEditEmployee={handleEditEmployee}
                onDeleteEmployee={handleDeleteEmployee}
              />
            )}

            {activeTab === 'sqlite' && (
              <AdminSqlTerminal 
                lojista={lojistaUser}
                products={products}
                leads={leads}
                carts={carts}
                orders={orders}
                messages={messages}
              />
            )}

            {activeTab === 'customer_profiles' && (
              <AdminCustomerProfiles 
                leads={leads}
                carts={carts}
                products={products}
                orders={orders}
                messages={messages}
                onAddMessage={handleAddMessage}
                onSetBotPaused={(leadId, paused) => handleToggleBot(leadId, paused ? 1 : 0)}
                onUpdateLeadStatus={handleMoveLead}
                onDeleteLead={handleDeleteLead}
                onUpdateLead={(leadId, updatedData) => {
                  setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...updatedData } : l));
                }}
              />
            )}

          </div>
        </main>
      )}

      {/* Persistent global footer */}
      <footer className="bg-slate-950 border-t border-white/10 py-6 mt-12 text-center text-xs text-slate-500 font-mono" id="app-global-footer">
        Moda Express S.A. • Painel de Gestão Direta & Engine WhatsApp Monolítica • 2026
      </footer>
    </div>
  );
}

function log(arg0: string, arg1: string, arg2: string): any {
  // dummy log handler
}
