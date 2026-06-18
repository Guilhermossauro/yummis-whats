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
  Code2,
  Bell,
  Search,
  Moon,
  Sun,
  ChevronRight,
  LayoutDashboard,
  Store
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
import BotFlowBuilder from './components/BotFlowBuilder';
import PublicStorefront from './components/PublicStorefront';
import AdminVirtualStore from './components/AdminVirtualStore';

import { SQLProduct, SQLLead, SQLCart, SQLOrder, SQLMessageLog, WhatsAppConfig, SQLSeller, SQLEmployee, FlowBlock, GatewayUser, StoreLayoutType, StorefrontConfig } from './types';
import { getSendMessageURL, getGatewayBaseURL, isGatewayMode } from './lib/gateway';
import { processBotMessage, BotProduct, BotState } from './lib/botProcessor';
import { resolveOrderPaymentTransition } from './lib/orderPayment';
import DashboardHome from './components/DashboardHome';
import { normalizeFlowBlocks } from './data/flows';

type SessionUser = {
  id?: string;
  name: string;
  email: string;
  store_name?: string;
  store_banner_url?: string;
  store_logo_url?: string;
  store_layout?: StoreLayoutType;
  storefront_config?: StorefrontConfig | null;
  token?: string;
  status?: string;
};

const storeSlug = (value?: string) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const publicStoreMatch = pathname.match(/^\/store\/([^/?#]+)/);
  const storeEditorMatch = pathname.match(/^\/editor\/loja(?:\/([^/?#]+))?/);
  
  // 1. Session state
  const [lojistaUser, setLojistaUser] = useState<SessionUser | null>(() => {
    const saved = localStorage.getItem('sql_lojista');
    return saved ? JSON.parse(saved) : null;
  });
  const storefrontSlug = storeSlug(lojistaUser?.store_name || lojistaUser?.name || lojistaUser?.email || '') || 'loja';
  const botFlowStorageKey = lojistaUser?.id ? `sql_bot_flow_${lojistaUser.id}` : 'sql_bot_flow';

  // 2. Tab selection
  const [activeTab, setActiveTab] = useState<'dashboard' | 'crm' | 'catalog' | 'storefront' | 'chat' | 'simulator' | 'settings' | 'sqlite' | 'customer_profiles' | 'flow'>('dashboard');

  // Tema (claro / escuro) — persistido e aplicado no <html>
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [gatewayUsers, setGatewayUsers] = useState<GatewayUser[]>([]);
  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigatePath = (nextPath: string) => {
    if (window.location.pathname === nextPath) return;
    window.history.pushState({}, '', nextPath);
    setPathname(nextPath);
  };
  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('yms_theme', next ? 'dark' : 'light');
      return next;
    });
  };

  // 3. Database tables (Simulated SQL)
  const [products, setProducts] = useState<SQLProduct[]>([]);
  const productsRef = useRef<SQLProduct[]>([]);
  const cartsRef = useRef<SQLCart[]>([]);
  const leadsRef = useRef<SQLLead[]>([]);
  const ordersRef = useRef<SQLOrder[]>([]);
  const paymentLocksRef = useRef<Set<string>>(new Set());

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

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    cartsRef.current = carts;
  }, [carts]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const activeGatewayToken = () => whatsAppConfig.apiKey || lojistaUser?.token || '';
  const gatewayJsonHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${activeGatewayToken()}`,
  });

  const refreshProductsFromGateway = async () => {
    const token = activeGatewayToken();
    if (!token || lojistaUser?.email === 'adminsuper@admin.com') return;
    const res = await fetch(`${getGatewayBaseURL()}/api/products`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Não foi possível carregar o catálogo da loja.');
    const data = await res.json();
    setProducts(data.products || []);
  };

  useEffect(() => {
    refreshProductsFromGateway().catch((err) => console.warn('[Produtos] Falha ao sincronizar catálogo', err));
  }, [lojistaUser?.id, lojistaUser?.email, whatsAppConfig.apiKey]);

  const decrementProductStock = async (
    items: Array<{ id?: string; codigo?: string; quantidade: number }>,
    operationKey?: string,
  ) => {
    if (!items.length) return;
    const token = activeGatewayToken();
    if (token && lojistaUser?.email !== 'adminsuper@admin.com') {
      try {
        const res = await fetch(`${getGatewayBaseURL()}/api/products/decrement-stock`, {
          method: 'POST',
          headers: gatewayJsonHeaders(),
          body: JSON.stringify({ items, operationKey }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.applied === false) return;
          const updated: SQLProduct[] = data.products || [];
          if (updated.length) {
            setProducts(prev => prev.map(p => updated.find(u => String(u.id) === String(p.id)) || p));
          }
          return;
        }
      } catch (err) {
        console.warn('[Produtos] Falha ao baixar estoque no gateway', err);
      }
    }

    setProducts(prev => prev.map(product => {
      const match = items.find(item => String(item.id || '') === String(product.id) || item.codigo === product.codigo);
      return match ? { ...product, estoque: Math.max(0, product.estoque - match.quantidade) } : product;
    }));
  };

  // Write variables back into LocalStorage to guarantee durable data persistence
  useEffect(() => {
    localStorage.removeItem('sql_products');
  }, []);

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
  // Estado do fluxo do bot por lead (máquina de estados), persistido.
  const botStateRef = useRef<Record<string, BotState>>(
    JSON.parse(localStorage.getItem('gw_bot_state') || '{}')
  );
  // Na 1ª sincronização não respondemos o histórico (apenas marcamos a base).
  const firstSyncRef = useRef<boolean>(true);
  // Número do WhatsApp conectado (para gerar links wa.me compartilháveis).
  const [gatewayPhone, setGatewayPhone] = useState<string | null>(null);
  // Vitrine virtual: só aparece a opção de compartilhar/editar se o super admin liberou.
  const [storefront, setStorefront] = useState<{ enabled: boolean; slug: string | null; storeName: string | null }>(
    { enabled: false, slug: null, storeName: null }
  );

  useEffect(() => {
    if (!isGatewayMode(whatsAppConfig.mode) || !whatsAppConfig.apiKey) return;
    let alive = true;
    const base = getGatewayBaseURL();
    const token = whatsAppConfig.apiKey;

    // Descobre o número conectado + autorização da vitrine (super admin).
    fetch(`${base}/api/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return;
        if (d.whatsapp?.phone) setGatewayPhone(d.whatsapp.phone);
        setStorefront({ enabled: !!d.storefrontEnabled, slug: d.storeSlug || null, storeName: d.storeName || null });
      })
      .catch(() => {});

    // Produtos atuais da plataforma (para o catálogo do bot e o card com foto)
    const readProducts = (): BotProduct[] => {
      return productsRef.current.map((p: any) => ({
        codigo: p.codigo, nome: p.nome, preco: p.preco, estoque: p.estoque,
        descricao: p.descricao, foto_path: p.foto_path,
      }));
    };

    const readFlow = (): FlowBlock[] => {
      try {
        const stored = localStorage.getItem(botFlowStorageKey) ?? localStorage.getItem('sql_bot_flow') ?? '[]';
        return normalizeFlowBlocks(JSON.parse(stored));
      } catch { return normalizeFlowBlocks([]); }
    };

    const readCartItems = (leadId: string) => {
      return cartsRef.current
        .filter(item => item.lead_id === leadId)
        .map((item) => {
          const product = productsRef.current.find(p => p.id === item.product_id);
          return product ? { codigo: product.codigo, quantidade: item.quantidade } : null;
        })
        .filter(Boolean) as Array<{ codigo: string; quantidade: number }>;
    };

    const readCartSummary = (leadId: string) => {
      const items = cartsRef.current.filter(item => item.lead_id === leadId);
      if (!items.length) return 'Sua sacola ainda está vazia. Digite *catálogo* para escolher produtos.';
      let total = 0;
      const lines = items.map((item, index) => {
        const product = productsRef.current.find(p => p.id === item.product_id);
        const subtotal = (product?.preco || 0) * item.quantidade;
        total += subtotal;
        return `*${index + 1}.* ${product?.nome || 'Produto'}\n  └ Qtd: *${item.quantidade}* | Subtotal: *R$ ${subtotal.toFixed(2).replace('.', ',')}*`;
      });
      return `${lines.join('\n\n')}\n\n💰 *Total estimado:* R$ ${total.toFixed(2).replace('.', ',')}`;
    };

    // PROCESSAMENTO DO BOT (na plataforma) + envio da resposta pelo gateway
    const runBotFor = async (m: any) => {
      const stateKey = `gw${m.lead_id}`;
      const firstName = (m.nome && m.nome !== 'Novo contato') ? String(m.nome).split(' ')[0] : '';
      const result = processBotMessage(m.texto, botStateRef.current[stateKey], {
        products: readProducts(),
        leadName: firstName,
        registered: !!m.cadastrado,
        flowBlocks: readFlow(),
        cartSummaryText: readCartSummary(stateKey),
        cartItems: readCartItems(stateKey),
        storeLink: `${window.location.origin}/store/${storefrontSlug}`,
      });
      botStateRef.current[stateKey] = result.nextState;
      localStorage.setItem('gw_bot_state', JSON.stringify(botStateRef.current));

      const registerEffect = result.effects?.find((effect) => effect.type === 'register_lead');
      if (registerEffect && registerEffect.type === 'register_lead') {
        const { nome, email } = registerEffect.data;
        setLeads(prev => prev.map(l => l.id === stateKey ? { ...l, nome: nome || l.nome, email, cadastrado: 1 } : l));
        fetch(`${base}/api/bot/register-lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ phone: m.telefone, channel: m.channel, name: nome, email }),
        }).catch(() => {});
      }

      // Efeito de CARRINHO: link de produto/vitrine confirma e adiciona à sacola sem pausar o bot.
      const cartEffects = result.effects?.filter((effect) => effect.type === 'add_to_cart') || [];
      if (cartEffects.length) {
        const now = new Date().toISOString();
        setCarts(prev => {
          let next = [...prev];
          for (const effect of cartEffects) {
            if (effect.type !== 'add_to_cart') continue;
            const product = productsRef.current.find(p => p.codigo.toLowerCase() === effect.data.codigo.toLowerCase());
            if (!product) continue;
            const existingIndex = next.findIndex(item => item.lead_id === stateKey && item.product_id === product.id && item.size === 'Único');
            if (existingIndex >= 0) {
              next = next.map((item, index) => index === existingIndex
                ? { ...item, quantidade: item.quantidade + effect.data.quantidade, atualizado_em: now }
                : item);
            } else {
              next.push({
                id: `gw_cart_${m.lead_id}_${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                lead_id: stateKey,
                product_id: product.id,
                quantidade: effect.data.quantidade,
                size: 'Único',
                atualizado_em: now,
              });
            }
          }
          return next;
        });
        setLeads(prev => prev.map(l => l.id === stateKey ? { ...l, status_funil: 'CARRINHO_ABERTO', ultimo_gatilho: now } : l));
      }

      if (result.effects?.some((effect) => effect.type === 'clear_cart')) {
        setCarts(prev => prev.filter(item => item.lead_id !== stateKey));
      }

      const statusEffect = result.effects?.find((effect) => effect.type === 'set_lead_status');
      if (statusEffect && statusEffect.type === 'set_lead_status') {
        setLeads(prev => prev.map(l => l.id === stateKey ? {
          ...l,
          status_funil: statusEffect.data.status,
          ultimo_gatilho: new Date().toISOString(),
        } : l));
      }

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
      for (const [replyIndex, reply] of result.replies.entries()) {
        const payload = reply.type === 'image'
          ? { to: m.telefone, channel: m.channel || 'whatsapp', image: reply.image, caption: reply.caption, actor: 'bot' }
          : { to: m.telefone, channel: m.channel || 'whatsapp', message: reply.text, actor: 'bot' };
        const pendingId = `gw_bot_pending_${m.id || m.lead_id}_${replyIndex}_${Date.now()}`;
        const pendingText = reply.type === 'image' ? `[foto] ${reply.caption || ''}`.trim() : reply.text;
        setMessages(prev => [...prev, {
          id: pendingId,
          lead_id: stateKey,
          direcao: 'out',
          texto: pendingText,
          data_envio: new Date().toISOString(),
          channel: m.channel,
          delivery_status: 'sending',
        } as SQLMessageLog]);
        try {
          const sendRes = await fetch(`${base}/api/gateway/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const sendData = await sendRes.json().catch(() => ({}));
          if (!sendRes.ok) {
            const fallback = `erro ${sendRes.status}`;
            const reason = sendData?.error || fallback;
            console.error('[Gateway] Falha ao enviar resposta automática', { reason, payload });
            setMessages(prev => prev.map(msg => msg.id === pendingId ? { ...msg, delivery_status: 'failed' } : msg));
          } else {
            setMessages(prev => prev.map(msg => msg.id === pendingId ? {
              ...msg,
              id: sendData?.message?.id ? `gw_msg_${sendData.message.id}` : msg.id,
              texto: sendData?.message?.texto || msg.texto,
              data_envio: sendData?.message?.data_envio || msg.data_envio,
              delivery_status: 'sent',
            } : msg));
          }
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'gateway indisponível';
          console.error('[Gateway] Falha ao acionar envio automático', { reason, payload });
          setMessages(prev => prev.map(msg => msg.id === pendingId ? { ...msg, delivery_status: 'failed' } : msg));
        }
      }
    };

    const claimBotMessage = async (m: any) => {
      if (!m.id) return true;
      try {
        const res = await fetch(`${base}/api/bot/claim-message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ messageId: m.id }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.claimed;
      } catch {
        return false;
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
                ? { ...l, nome: m.nome || l.nome, bot_pausado: m.bot_pausado ?? l.bot_pausado, cadastrado: m.cadastrado ?? l.cadastrado, email: m.email ?? l.email, channel: m.channel, ultimo_gatilho: new Date().toISOString() }
                : l);
            } else {
              next = [...next, {
                id: leadId,
                telefone: m.telefone,
                nome: m.nome || 'Novo contato',
                status_funil: 'CARRINHO_ABERTO' as const,
                ultimo_gatilho: new Date().toISOString(),
                bot_pausado: m.bot_pausado ?? 0,
                cadastrado: m.cadastrado ?? 0,
                email: m.email,
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
              delivery_status: m.direcao === 'out' ? 'sent' as const : undefined,
            }));
          return fresh.length ? [...prev, ...fresh] : prev;
        });

        const previousSince = gatewayLastIdRef.current;
        gatewayLastIdRef.current = data.lastId;
        localStorage.setItem('gw_inbox_since', String(data.lastId));

        // A PLATAFORMA processa o fluxo: responde só às mensagens recebidas ('in')
        // de leads com o bot ativo. Na 1ª carga, responde apenas mensagens recentes
        // ou mensagens posteriores ao último marcador salvo, evitando disparos antigos.
        const shouldProcess = (m: any) => {
          if (m.direcao !== 'in' || m.bot_pausado) return false;
          if (m.bot_processed) return false;
          if (!firstSyncRef.current || previousSince > 0) return true;
          const sentAt = new Date(m.data_envio || 0).getTime();
          return Number.isFinite(sentAt) && Date.now() - sentAt <= 3 * 60 * 1000;
        };
        if (!firstSyncRef.current || data.messages.some(shouldProcess)) {
          for (const m of data.messages) {
            if (shouldProcess(m) && await claimBotMessage(m)) {
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
    const timer = setInterval(sync, 1500);
    return () => { alive = false; clearInterval(timer); };
  }, [whatsAppConfig.mode, whatsAppConfig.apiKey, botFlowStorageKey, storefrontSlug]);

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
  const handleLogin = (user: SessionUser) => {
    setLojistaUser(user);
    localStorage.setItem('sql_lojista', JSON.stringify(user));
    if (user.token) {
      setWhatsAppConfig(prev => ({
        ...prev,
        mode: 'yummis',
        apiKey: user.token || prev.apiKey,
        apiURL: '',
      }));
    }
  };

  const handleLogout = () => {
    setLojistaUser(null);
    setProducts([]);
    setWhatsAppConfig({ mode: 'sandbox', apiKey: '', instanceName: '', apiURL: '' });
    localStorage.removeItem('sql_lojista');
    localStorage.removeItem('sql_whatsapp_config');
  };

  const handleUpdateProfile = (name: string, email: string) => {
    if (lojistaUser) {
      const updated = { ...lojistaUser, name, email };
      setLojistaUser(updated);
      localStorage.setItem('sql_lojista', JSON.stringify(updated));
      setSellers(prev => prev.map(s => s.email.toLowerCase() === email.toLowerCase() ? { ...s, name } : s));
    }
  };

  const handleUpdateStorefront = ({ storeBannerUrl, storeLogoUrl, storeLayout, storefrontConfig }: {
    storeBannerUrl: string;
    storeLogoUrl: string;
    storeLayout: StoreLayoutType;
    storefrontConfig: StorefrontConfig;
  }) => {
    if (!lojistaUser) return;
    const optimistic = {
      ...lojistaUser,
      store_banner_url: storeBannerUrl,
      store_logo_url: storeLogoUrl,
      store_layout: storeLayout,
      storefront_config: storefrontConfig,
    };
    setLojistaUser(optimistic);
    localStorage.setItem('sql_lojista', JSON.stringify(optimistic));

    if (!lojistaUser.token) return;

    fetch(`${getGatewayBaseURL()}/api/user/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lojistaUser.token}`,
      },
      body: JSON.stringify({ storeBannerUrl, storeLogoUrl, storeLayout, storefrontConfig }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Falha ao atualizar loja virtual.');
        if (!data.user) return;
        const synced = {
          ...optimistic,
          store_name: data.user.storeName || optimistic.store_name,
          store_banner_url: data.user.storeBannerUrl || '',
          store_logo_url: data.user.storeLogoUrl || '',
          store_layout: data.user.storeLayout || storeLayout,
          storefront_config: data.user.storefrontConfig || storefrontConfig,
        };
        setLojistaUser(synced);
        localStorage.setItem('sql_lojista', JSON.stringify(synced));
      })
      .catch((err) => {
        console.warn('[Loja Virtual] Falha ao sincronizar vitrine', err);
      });
  };

  const refreshGatewayUsers = async () => {
    try {
      const res = await fetch(`${getGatewayBaseURL()}/api/admin/users`);
      if (!res.ok) return;
      setGatewayUsers(await res.json());
    } catch (err) {
      console.warn('[Admin] Falha ao carregar lojas do gateway', err);
    }
  };

  useEffect(() => {
    if (lojistaUser?.email === 'adminsuper@admin.com') {
      refreshGatewayUsers();
    }
  }, [lojistaUser?.email]);

  useEffect(() => {
    if (!lojistaUser?.id || !lojistaUser?.token || lojistaUser.email === 'adminsuper@admin.com') return;

    let cancelled = false;

    const syncProfile = async () => {
      try {
        const res = await fetch(`${getGatewayBaseURL()}/api/user/profile/${lojistaUser.id}`);
        if (!res.ok) return;
        const user = await res.json();
        if (cancelled || !user) return;

        setLojistaUser(prev => {
          if (!prev) return prev;
          const next = {
            ...prev,
            name: user.storeName || prev.name,
            email: user.username || prev.email,
            store_name: user.storeName || prev.store_name,
            store_banner_url: user.storeBannerUrl || '',
            store_logo_url: user.storeLogoUrl || '',
            store_layout: user.storeLayout || prev.store_layout,
            storefront_config: user.storefrontConfig || prev.storefront_config,
          };
          localStorage.setItem('sql_lojista', JSON.stringify(next));
          return next;
        });
      } catch (err) {
        console.warn('[Sessao] Falha ao sincronizar dados da loja', err);
      }
    };

    syncProfile();
    const intervalId = window.setInterval(syncProfile, 30000);
    window.addEventListener('focus', syncProfile);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncProfile);
    };
  }, [lojistaUser?.email, lojistaUser?.id, lojistaUser?.token]);

  const handleUpdateGatewayStoreName = async (id: string, storeName: string) => {
    try {
      const res = await fetch(`${getGatewayBaseURL()}/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Não foi possível atualizar o nome da loja.' };
      }
      setGatewayUsers(prev => prev.map(user => user.id === id ? data.user : user));
      return { success: true };
    } catch (err) {
      console.warn('[Admin] Falha ao atualizar nome da loja', err);
      return { success: false, error: 'Falha de conexão ao atualizar a loja.' };
    }
  };

  const handleGatewayUserStatus = async (id: string, status: 'active' | 'pending' | 'blocked') => {
    const res = await fetch(`${getGatewayBaseURL()}/api/admin/users/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || 'Não foi possível atualizar a loja.');
      return;
    }
    setGatewayUsers(prev => prev.map(user => user.id === id ? data.user : user));
  };

  // SQL MUTATORS
  const handleAddProduct = async (payload: Omit<SQLProduct, 'id'>) => {
    const token = activeGatewayToken();
    if (token && lojistaUser?.email !== 'adminsuper@admin.com') {
      const res = await fetch(`${getGatewayBaseURL()}/api/products`, {
        method: 'POST',
        headers: gatewayJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível cadastrar o produto.');
      }
      setProducts(prev => [data.product, ...prev]);
      return;
    }

    setProducts(prev => [{ ...payload, id: String(prev.length + 101) }, ...prev]);
  };

  const handleEditProduct = async (id: string, payload: Partial<SQLProduct>) => {
    const token = activeGatewayToken();
    if (token && lojistaUser?.email !== 'adminsuper@admin.com') {
      const res = await fetch(`${getGatewayBaseURL()}/api/products/${id}`, {
        method: 'PUT',
        headers: gatewayJsonHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível atualizar o produto.');
      }
      setProducts(prev => prev.map(p => p.id === id ? data.product : p));
      return;
    }

    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...payload } : p));
  };

  const handleDeleteProduct = async (id: string) => {
    const token = activeGatewayToken();
    if (token && lojistaUser?.email !== 'adminsuper@admin.com') {
      const res = await fetch(`${getGatewayBaseURL()}/api/products/${id}`, {
        method: 'DELETE',
        headers: gatewayJsonHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Não foi possível excluir o produto.');
      }
    }
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
    if (!lead) return;
    const operatorName = lojistaUser?.name || lojistaUser?.email?.split('@')[0] || 'Atendente';
    const formattedText = `*${operatorName}*\n${text}`;
    const pendingId = 'usr_msg_' + Math.random().toString();
    const newMsg: SQLMessageLog = {
      id: pendingId,
      lead_id: leadId,
      direcao: 'out',
      texto: formattedText,
      data_envio: new Date().toISOString(),
      operator_name: operatorName,
      channel: lead.channel,
      delivery_status: 'sending',
    };
    
    // 1. Add log message
    setMessages(prev => [...prev, newMsg]);

    // 2. Pause the automated bot since operator intervened! (As requested)
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, bot_pausado: 1, ultimo_gatilho: new Date().toISOString() } : l));

    // 3. Despacho:
    //    - Leads do gateway (omnichannel): rota do ATENDENTE = GRATUITA (não consome token)
    //    - Leads locais (simulador): comportamento antigo
    if (leadId.startsWith('gw') && isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      fetch(`${getGatewayBaseURL()}/api/bot/operator-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${whatsAppConfig.apiKey}` },
        body: JSON.stringify({ phone: lead.telefone, message: text, channel: lead.channel || 'whatsapp', operatorName })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `erro ${res.status}`);
          setMessages(prev => prev.map(msg => msg.id === pendingId ? {
            ...msg,
            id: data?.message?.id ? `gw_msg_${data.message.id}` : msg.id,
            texto: data?.message?.texto || msg.texto,
            data_envio: data?.message?.data_envio || msg.data_envio,
            delivery_status: 'sent',
          } : msg));
        })
        .catch((err) => {
          console.error('[Gateway] Falha ao enviar mensagem do operador', err);
          setMessages(prev => prev.map(msg => msg.id === pendingId ? { ...msg, delivery_status: 'failed' } : msg));
        });
    } else {
      dispatchWhatsAppMessage(lead.telefone, formattedText)
        .then(() => setMessages(prev => prev.map(msg => msg.id === pendingId ? { ...msg, delivery_status: 'sent' } : msg)))
        .catch(() => setMessages(prev => prev.map(msg => msg.id === pendingId ? { ...msg, delivery_status: 'failed' } : msg)));
    }
  };

  const dispatchWhatsAppMessage = async (toPhone: string, textContent: string) => {
    // Yummis API = nosso gateway. URL resolvida dinamicamente pela origem atual
    // (mesma do navegador), com override opcional via apiURL.
    if (isGatewayMode(whatsAppConfig.mode) && whatsAppConfig.apiKey) {
      try {
        const res = await fetch(whatsAppConfig.apiURL || getSendMessageURL(), {
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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `erro ${res.status}`);
        }
      } catch (err) {
        throw err;
      }
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

  const handleConfirmOrderPayment = async (leadId: string) => {
    if (paymentLocksRef.current.has(leadId)) return;

    const paidAt = new Date().toISOString();
    const resolution = resolveOrderPaymentTransition(leadId, ordersRef.current, leadsRef.current, cartsRef.current, paidAt);
    const pendingOrderKeys = ordersRef.current
      .filter(order => order.lead_id === leadId && order.status_pagamento !== 'PAGO')
      .map(order => order.transaction_id || order.id)
      .sort();

    paymentLocksRef.current.add(leadId);
    ordersRef.current = resolution.nextOrders;
    leadsRef.current = resolution.nextLeads;
    cartsRef.current = resolution.nextCarts;
    setOrders(resolution.nextOrders);
    setLeads(resolution.nextLeads);
    setCarts(resolution.nextCarts);

    try {
      if (resolution.shouldDecrementStock) {
        const operationKey = `order-paid:${leadId}:${pendingOrderKeys.join(',')}`;
        await decrementProductStock(resolution.paidItems, operationKey);
      }
    } catch (err) {
      console.warn('[Produtos] Falha ao baixar estoque da compra', err);
    } finally {
      paymentLocksRef.current.delete(leadId);
    }
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

  // Navegação lateral (estilo Cross Admin). O Dashboard é a tela de métricas.
  // A "Loja Virtual" (vitrine) só aparece se o super admin autorizou a loja.
  const NAV = ([
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'simulator', label: 'Simulador', icon: Smartphone },
    { key: 'crm', label: 'Funil de Vendas', icon: TrendingUp },
    { key: 'chat', label: 'Chat Omnichannel', icon: MessageSquare },
    { key: 'flow', label: 'Fluxo do Bot', icon: Settings },
    { key: 'catalog', label: 'Catálogo', icon: ShoppingBag },
    ...(storefront.enabled ? [{ key: 'storefront', label: 'Loja Virtual', icon: Store }] : []),
    { key: 'settings', label: 'Conexões & Conta', icon: Wifi },
    { key: 'customer_profiles', label: 'Perfis de Clientes', icon: User },
  ]) as { key: string; label: string; icon: any }[];
  const activeNav = NAV.find(n => n.key === activeTab);
  const openStoreEditor = () => {
    const slug = storeSlug(lojistaUser?.store_name || lojistaUser?.name || lojistaUser?.email || storeEditorMatch?.[1] || 'loja') || 'loja';
    navigatePath(`/editor/loja/${slug}`);
    setShowNotifications(false);
    setShowProfileMenu(false);
  };

  if (publicStoreMatch) {
    return <PublicStorefront slug={decodeURIComponent(publicStoreMatch[1])} />;
  }

  if (storeEditorMatch && lojistaUser && lojistaUser.email !== 'adminsuper@admin.com') {
    return (
      <AdminVirtualStore
        standalone
        lojista={lojistaUser}
        products={products}
        storeSlug={storeSlug(lojistaUser?.store_name || lojistaUser?.name || lojistaUser?.email || storeEditorMatch[1] || '')}
        onUpdateStorefront={handleUpdateStorefront}
        onBack={() => {
          setActiveTab('dashboard');
          navigatePath('/');
        }}
      />
    );
  }

  return (
    <div className="bg-[#eef1f6] dark:bg-slate-950 min-h-screen text-slate-800 dark:text-slate-100 font-sans transition-colors" id="main-admin-app-root">

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
            gatewayUsers={gatewayUsers}
            onRefreshGatewayUsers={refreshGatewayUsers}
            onSetGatewayUserStatus={handleGatewayUserStatus}
            onUpdateGatewayStoreName={handleUpdateGatewayStoreName}
          />
        </main>
      ) : (
        <div className="flex min-h-screen" id="dashboard-wrapper">
          {/* SIDEBAR */}
          <aside className="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-white/10 flex-col shrink-0 sticky top-0 h-screen hidden md:flex">
            <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-100 dark:border-white/10">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white"><Layers className="w-5 h-5" /></div>
              <span className="font-extrabold text-slate-800 dark:text-white text-lg">YMS <span className="text-indigo-500">CRM</span></span>
            </div>
            <nav className="flex-1 overflow-y-auto py-3">
              <p className="px-5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">Menu</p>
              {NAV.map(item => (
                <button
                  key={item.key}
                  onClick={() => item.key === 'storefront' ? openStoreEditor() : setActiveTab(item.key as any)}
                  className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-semibold transition-all ${(item.key === 'storefront' ? !!storeEditorMatch : activeTab === item.key) ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-r-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`}
                >
                  <item.icon className="w-4 h-4" /> {item.label}
                </button>
              ))}
            </nav>
            <button onClick={handleLogout} className="flex items-center gap-3 px-5 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-t border-slate-100 dark:border-white/10">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </aside>

          {/* MAIN COLUMN */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* TOPBAR */}
            <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="flex items-center gap-2 w-full bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input placeholder="Buscar..." className="bg-transparent text-sm outline-none flex-1 text-slate-700 dark:text-slate-200" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={toggleTheme} title="Alternar tema" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <div className="relative">
                  <button
                    onClick={() => { setShowNotifications(prev => !prev); setShowProfileMenu(false); }}
                    title="Ver notificações"
                    className="relative text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <Bell className="w-5 h-5" />
                    {messages.some(m => m.direcao === 'in') && <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full" />}
                  </button>
                  {showNotifications && (
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-white">Notificações</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{messages.filter(m => m.direcao === 'in').length} mensagens recebidas no histórico</p>
                      </div>
                      <div className="max-h-72 overflow-y-auto">
                        {messages.filter(m => m.direcao === 'in').slice(-5).reverse().map(msg => {
                          const lead = leads.find(l => l.id === msg.lead_id);
                          return (
                            <button
                              key={msg.id}
                              onClick={() => { setActiveTab('chat'); setShowNotifications(false); }}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-100 dark:border-white/5"
                            >
                              <span className="block text-xs font-bold text-slate-800 dark:text-white truncate">{lead?.nome || 'Novo contato'}</span>
                              <span className="block text-[11px] text-slate-500 truncate mt-0.5">{msg.texto}</span>
                            </button>
                          );
                        })}
                        {!messages.some(m => m.direcao === 'in') && (
                          <div className="px-4 py-6 text-center text-xs text-slate-500">Nenhuma mensagem recebida ainda.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="relative pl-3 border-l border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => { setShowProfileMenu(prev => !prev); setShowNotifications(false); }}
                    className="flex items-center gap-2"
                    title="Abrir perfil"
                  >
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">{(lojistaUser?.store_name || lojistaUser?.name || 'U').slice(0, 2).toUpperCase()}</div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 hidden sm:block">{lojistaUser?.store_name || lojistaUser?.name}</span>
                  </button>
                  {showProfileMenu && (
                    <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                      <div className="px-4 py-4 border-b border-slate-100 dark:border-white/10">
                        <span className="block text-sm font-bold text-slate-800 dark:text-white">{lojistaUser?.store_name || lojistaUser?.name}</span>
                        <span className="block text-xs text-slate-500 truncate">{lojistaUser?.email}</span>
                      </div>
                      <button onClick={() => openStoreEditor()} className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                        Loja virtual
                      </button>
                      <button onClick={() => { setActiveTab('settings'); setShowProfileMenu(false); }} className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                        Conexões e conta
                      </button>
                      <button onClick={() => { setActiveTab('customer_profiles'); setShowProfileMenu(false); }} className="w-full text-left px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5">
                        Perfis de clientes
                      </button>
                      <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        Sair
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* CONTENT */}
            <main className="flex-1 p-4 sm:p-6 space-y-6">
              {/* Breadcrumb */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h1 className="text-xl font-extrabold text-slate-800 dark:text-white">{activeNav?.label}</h1>
                  <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">Home <ChevronRight className="w-3 h-3" /> {activeNav?.label}</p>
                </div>
              </div>

              {/* Navegação mobile (sidebar oculta no mobile) */}
              <div className="md:hidden flex gap-2 overflow-x-auto pb-1">
                {NAV.map(item => (
                  <button
                    key={item.key}
                    onClick={() => item.key === 'storefront' ? openStoreEditor() : setActiveTab(item.key as any)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap ${(item.key === 'storefront' ? !!storeEditorMatch : activeTab === item.key) ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-white/10'}`}
                  >
                    <item.icon className="w-3.5 h-3.5" /> {item.label}
                  </button>
                ))}
              </div>

          {/* Tabnav antiga (oculta) */}
          <div className="hidden" id="tab-nav-bar">
            
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

          {/* Dashboard (tela própria de métricas/gráficos) */}
          {activeTab === 'dashboard' && (
            <DashboardHome products={products} leads={leads} carts={carts} orders={orders} messages={messages} />
          )}

          {/* Active Tab rendering router — módulos legados (tema claro via .legacy-pane) */}
          <div className="legacy-pane transition-all duration-350" id="tab-body-pane">

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
                  botFlowStorageKey={botFlowStorageKey}
                  storeLink={`${window.location.origin}/store/${storefrontSlug}`}
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
                onSendManualMessage={handleSendManualMessage}
                onToggleBot={handleToggleBot}
                onSimulateWebhook={() => {}}
              />
            )}

            {activeTab === 'flow' && (
              <BotFlowBuilder storageKey={botFlowStorageKey} />
            )}

            {activeTab === 'catalog' && (
              <AdminCatalog
                products={products}
                onAddProduct={handleAddProduct}
                onEditProduct={handleEditProduct}
                onDeleteProduct={handleDeleteProduct}
                gatewayPhone={gatewayPhone}
                storeSlug={storefront.slug || storefrontSlug}
                storefrontEnabled={storefront.enabled}
              />
            )}

            {activeTab === 'storefront' && (
              <div className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-8 text-white shadow-2xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300 font-black">Editor dedicado</p>
                <h2 className="mt-3 text-2xl font-black">A Loja Virtual agora abre fora do menu</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  O editor usa uma página própria, com canvas visual e drag and drop direto na renderização da loja.
                </p>
                <button onClick={openStoreEditor} className="mt-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3 text-sm font-black inline-flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Abrir editor da loja
                </button>
              </div>
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
                botFlowStorageKey={botFlowStorageKey}
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
              <footer className="pt-4 text-center text-xs text-slate-400" id="app-global-footer">
                YMS CRM • Plataforma de Atendimento Omnichannel • 2026
              </footer>
            </main>
          </div>
        </div>
      )}
    </div>
  );
}

function log(arg0: string, arg1: string, arg2: string): any {
  // dummy log handler
}
