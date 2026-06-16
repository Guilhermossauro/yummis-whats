import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Store,
  Truck,
  X,
} from 'lucide-react';
import { SQLProduct, StoreLayoutType } from '../types';
import { getGatewayBaseURL } from '../lib/gateway';
import { buildWhatsAppStoreCartLink } from '../lib/productShare';

type PublicStorePayload = {
  success: boolean;
  store: {
    id: string;
    username: string;
    storeName: string;
    slug: string;
    bannerUrl?: string | null;
    logoUrl?: string | null;
    layout?: StoreLayoutType | null;
    whatsappPhone?: string | null;
  };
  products: SQLProduct[];
};

type CartDraftLine = {
  codigo: string;
  quantity: number;
};

type StoreRoute = {
  page: 'home' | 'product' | 'cart';
  productCode?: string;
};

type ProductWithMeta = SQLProduct & {
  category: string;
  promo: boolean;
};

type StoreLayoutPreset = {
  label: string;
  topTitle: string;
  homeTitle: string;
  homeSubtitle: string;
  searchPlaceholder: string;
  minOrderText: string;
  deliveryText: string;
  contactText: string;
  offerLabel: string;
  priceSupport: string;
  cartTitle: string;
  cartSubtitle: string;
  emptyCartTitle: string;
  emptyCartText: string;
  continueText: string;
  checkoutText: string;
  addCartText: string;
  buyNowText: string;
  detailBackText: string;
  assistBadge: string;
  stockBadge: string;
  primary: string;
  primaryHover: string;
  dark: string;
  background: string;
  soft: string;
  border: string;
  banner: string;
};

const DEFAULT_STORE_LAYOUT: StoreLayoutType = 'ecommerce';

const STORE_LAYOUT_PRESETS: Record<StoreLayoutType, StoreLayoutPreset> = {
  restaurant: {
    label: 'Restaurante',
    topTitle: 'Menu Oficial',
    homeTitle: 'Cardápio do restaurante',
    homeSubtitle: 'itens do cardápio exibidos',
    searchPlaceholder: 'Buscar pratos, bebidas ou combos',
    minOrderText: 'Pedido mínimo: R$ 15,00',
    deliveryText: 'Delivery rápido',
    contactText: 'Pedidos via WhatsApp',
    offerLabel: 'Especial da casa',
    priceSupport: 'com atendimento direto no WhatsApp',
    cartTitle: 'Meu pedido',
    cartSubtitle: 'Revise os itens e finalize pelo WhatsApp.',
    emptyCartTitle: 'Seu pedido está vazio',
    emptyCartText: 'Volte ao cardápio e escolha seus favoritos.',
    continueText: 'Continuar no cardápio',
    checkoutText: 'Enviar pedido no WhatsApp',
    addCartText: 'Adicionar ao pedido',
    buyNowText: 'Pedir agora',
    detailBackText: 'Cardápio',
    assistBadge: 'Pedido assistido',
    stockBadge: 'Disponibilidade da cozinha',
    primary: '#ea580c',
    primaryHover: '#c2410c',
    dark: '#431407',
    background: '#fff7ed',
    soft: '#fff1e8',
    border: '#fed7aa',
    banner: 'linear-gradient(135deg, #431407 0%, #ea580c 52%, #f97316 100%)',
  },
  ecommerce: {
    label: 'E-commerce',
    topTitle: 'Vitrine Oficial',
    homeTitle: 'Catálogo de produtos',
    homeSubtitle: 'produtos exibidos',
    searchPlaceholder: 'Buscar por produto, código ou descrição',
    minOrderText: 'Compra mínima: R$ 15,00',
    deliveryText: 'Entrega combinada',
    contactText: 'Atendimento via WhatsApp',
    offerLabel: 'Oferta da loja',
    priceSupport: 'no WhatsApp com atendimento personalizado',
    cartTitle: 'Meu carrinho',
    cartSubtitle: 'Finalize pelo WhatsApp com a loja.',
    emptyCartTitle: 'Seu carrinho está vazio',
    emptyCartText: 'Volte para a vitrine e escolha seus favoritos.',
    continueText: 'Continuar comprando',
    checkoutText: 'Confirmar no WhatsApp',
    addCartText: 'Adicionar ao carrinho',
    buyNowText: 'Comprar agora',
    detailBackText: 'Loja',
    assistBadge: 'Compra assistida',
    stockBadge: 'Estoque da loja',
    primary: '#6d28d9',
    primaryHover: '#5b21b6',
    dark: '#2e1065',
    background: '#f7f3ff',
    soft: '#f5f0ff',
    border: '#ddd6fe',
    banner: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 48%, #c026d3 100%)',
  },
  fashion: {
    label: 'Loja de modas',
    topTitle: 'Closet Oficial',
    homeTitle: 'Coleção da loja',
    homeSubtitle: 'looks exibidos',
    searchPlaceholder: 'Buscar looks, tamanhos ou coleções',
    minOrderText: 'Compra mínima: R$ 15,00',
    deliveryText: 'Envio e retirada',
    contactText: 'Consultoria via WhatsApp',
    offerLabel: 'Look em destaque',
    priceSupport: 'com atendimento personalizado para seu estilo',
    cartTitle: 'Sacola de looks',
    cartSubtitle: 'Revise sua seleção e finalize pelo WhatsApp.',
    emptyCartTitle: 'Sua sacola está vazia',
    emptyCartText: 'Volte para a coleção e escolha seus favoritos.',
    continueText: 'Continuar vendo looks',
    checkoutText: 'Enviar sacola no WhatsApp',
    addCartText: 'Adicionar à sacola',
    buyNowText: 'Comprar look',
    detailBackText: 'Coleção',
    assistBadge: 'Consultoria de estilo',
    stockBadge: 'Estoque da coleção',
    primary: '#db2777',
    primaryHover: '#be185d',
    dark: '#500724',
    background: '#fff1f8',
    soft: '#fdf2f8',
    border: '#fbcfe8',
    banner: 'linear-gradient(135deg, #500724 0%, #db2777 48%, #a855f7 100%)',
  },
  market: {
    label: 'Mercado',
    topTitle: 'Mercado Online',
    homeTitle: 'Corredores do mercado',
    homeSubtitle: 'itens disponíveis',
    searchPlaceholder: 'Buscar alimentos, utilidades ou ofertas',
    minOrderText: 'Compra mínima: R$ 15,00',
    deliveryText: 'Entrega de compras',
    contactText: 'Atendimento via WhatsApp',
    offerLabel: 'Oferta da semana',
    priceSupport: 'para montar sua compra pelo WhatsApp',
    cartTitle: 'Cesta de compras',
    cartSubtitle: 'Confira sua cesta antes de enviar para a loja.',
    emptyCartTitle: 'Sua cesta está vazia',
    emptyCartText: 'Volte aos corredores e adicione produtos.',
    continueText: 'Continuar comprando',
    checkoutText: 'Enviar cesta no WhatsApp',
    addCartText: 'Adicionar à cesta',
    buyNowText: 'Comprar item',
    detailBackText: 'Mercado',
    assistBadge: 'Compra assistida',
    stockBadge: 'Estoque do mercado',
    primary: '#059669',
    primaryHover: '#047857',
    dark: '#064e3b',
    background: '#ecfdf5',
    soft: '#dffaf0',
    border: '#a7f3d0',
    banner: 'linear-gradient(135deg, #064e3b 0%, #059669 52%, #14b8a6 100%)',
  },
  beauty: {
    label: 'Beleza',
    topTitle: 'Beauty Store',
    homeTitle: 'Vitrine de beleza',
    homeSubtitle: 'produtos de beleza exibidos',
    searchPlaceholder: 'Buscar cosméticos, kits ou autocuidado',
    minOrderText: 'Compra mínima: R$ 15,00',
    deliveryText: 'Entrega delicada',
    contactText: 'Especialista via WhatsApp',
    offerLabel: 'Ritual em destaque',
    priceSupport: 'com orientação personalizada',
    cartTitle: 'Necessaire virtual',
    cartSubtitle: 'Revise seus cuidados e finalize pelo WhatsApp.',
    emptyCartTitle: 'Sua necessaire está vazia',
    emptyCartText: 'Escolha produtos para montar seu ritual.',
    continueText: 'Continuar na beleza',
    checkoutText: 'Enviar seleção no WhatsApp',
    addCartText: 'Adicionar à necessaire',
    buyNowText: 'Quero este produto',
    detailBackText: 'Beleza',
    assistBadge: 'Orientação de beleza',
    stockBadge: 'Disponibilidade da loja',
    primary: '#c026d3',
    primaryHover: '#a21caf',
    dark: '#581c87',
    background: '#fdf4ff',
    soft: '#fae8ff',
    border: '#f5d0fe',
    banner: 'linear-gradient(135deg, #581c87 0%, #c026d3 48%, #fb7185 100%)',
  },
  electronics: {
    label: 'Eletrônicos',
    topTitle: 'Tech Store',
    homeTitle: 'Tecnologia em destaque',
    homeSubtitle: 'gadgets exibidos',
    searchPlaceholder: 'Buscar aparelhos, acessórios ou tecnologia',
    minOrderText: 'Compra mínima: R$ 15,00',
    deliveryText: 'Envio seguro',
    contactText: 'Suporte via WhatsApp',
    offerLabel: 'Oferta tech',
    priceSupport: 'com suporte para escolher o modelo ideal',
    cartTitle: 'Carrinho tech',
    cartSubtitle: 'Revise seus produtos e finalize pelo WhatsApp.',
    emptyCartTitle: 'Seu carrinho tech está vazio',
    emptyCartText: 'Explore os produtos e escolha sua tecnologia.',
    continueText: 'Continuar explorando',
    checkoutText: 'Enviar carrinho no WhatsApp',
    addCartText: 'Adicionar ao carrinho',
    buyNowText: 'Comprar tecnologia',
    detailBackText: 'Tecnologia',
    assistBadge: 'Suporte especializado',
    stockBadge: 'Estoque técnico',
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    dark: '#172554',
    background: '#eff6ff',
    soft: '#dbeafe',
    border: '#bfdbfe',
    banner: 'linear-gradient(135deg, #172554 0%, #2563eb 48%, #06b6d4 100%)',
  },
  services: {
    label: 'Serviços',
    topTitle: 'Serviços Online',
    homeTitle: 'Serviços disponíveis',
    homeSubtitle: 'serviços exibidos',
    searchPlaceholder: 'Buscar serviços, pacotes ou orçamentos',
    minOrderText: 'Atendimento inicial pelo WhatsApp',
    deliveryText: 'Agenda combinada',
    contactText: 'Consultor via WhatsApp',
    offerLabel: 'Pacote recomendado',
    priceSupport: 'com alinhamento direto pelo WhatsApp',
    cartTitle: 'Solicitação de serviços',
    cartSubtitle: 'Revise os serviços antes de chamar o atendimento.',
    emptyCartTitle: 'Nenhum serviço selecionado',
    emptyCartText: 'Escolha um serviço para iniciar o atendimento.',
    continueText: 'Ver mais serviços',
    checkoutText: 'Solicitar pelo WhatsApp',
    addCartText: 'Adicionar serviço',
    buyNowText: 'Solicitar agora',
    detailBackText: 'Serviços',
    assistBadge: 'Atendimento consultivo',
    stockBadge: 'Agenda/Disponibilidade',
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    dark: '#312e81',
    background: '#f5f3ff',
    soft: '#ede9fe',
    border: '#c4b5fd',
    banner: 'linear-gradient(135deg, #312e81 0%, #4f46e5 48%, #f59e0b 100%)',
  },
};

const money = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;

function resolveStoreLayout(value?: string | null): StoreLayoutType {
  return value && value in STORE_LAYOUT_PRESETS ? value as StoreLayoutType : DEFAULT_STORE_LAYOUT;
}

function parseStoreRoute(): StoreRoute {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const section = parts[2] || '';
  if (section === 'produto' || section === 'product') return { page: 'product', productCode: decodeURIComponent(parts[3] || '') };
  if (section === 'carrinho' || section === 'cart') return { page: 'cart' };
  return { page: 'home' };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'LJ';
}

function categoryFor(product: SQLProduct, layout: StoreLayoutType) {
  const text = `${product.nome} ${product.descricao}`.toLowerCase();
  if (layout === 'restaurant') {
    if (/bebida|suco|refrigerante|drink|agua|cafe/.test(text)) return 'Bebidas';
    if (/doce|sobremesa|bolo|acai|sorvete/.test(text)) return 'Sobremesas';
    if (/combo|promocao|kit/.test(text)) return 'Combos';
    if (/lanche|burger|pizza|prato|massa/.test(text)) return 'Pratos';
    return 'Especiais';
  }
  if (layout === 'market') {
    if (/bebida|suco|refrigerante|agua/.test(text)) return 'Bebidas';
    if (/limpeza|utilidade|casa/.test(text)) return 'Casa';
    if (/fruta|verdura|legume|hortifruti/.test(text)) return 'Hortifruti';
    return 'Mercado';
  }
  if (layout === 'beauty') {
    if (/perfume|creme|skin|maquiagem|batom/.test(text)) return 'Beleza';
    if (/kit|combo|promocao/.test(text)) return 'Kits';
    return 'Cuidados';
  }
  if (layout === 'electronics') {
    if (/fone|cabo|carregador|case|acessorio/.test(text)) return 'Acessórios';
    if (/celular|phone|notebook|tablet|monitor/.test(text)) return 'Dispositivos';
    return 'Tecnologia';
  }
  if (layout === 'services') {
    if (/consultoria|agenda|aula|sessao|pacote|servico/.test(text)) return 'Serviços';
    return 'Pacotes';
  }
  if (/vestido|saia|moda|look|conjunto/.test(text)) return 'Moda';
  if (/blusa|cropped|camisa|camiseta/.test(text)) return 'Blusas';
  if (/calca|pantalona|jeans|short/.test(text)) return 'Calcas';
  if (/tenis|sandalia|sapato|bolsa|acessorio/.test(text)) return 'Acessorios';
  if (/combo|kit|promocao|promo/.test(text)) return 'Promocoes';
  return 'Destaques';
}

function productMeta(product: SQLProduct, layout: StoreLayoutType): ProductWithMeta {
  return {
    ...product,
    category: categoryFor(product, layout),
    promo: product.estoque > 0 && (Number(product.id) % 2 === 0 || /promo|oferta|kit/i.test(`${product.nome} ${product.descricao}`)),
  };
}

export default function PublicStorefront({ slug }: { slug: string }) {
  const cartStorageKey = `yms_store_cart_${slug}`;
  const [payload, setPayload] = useState<PublicStorePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Todos');
  const [activeFilter, setActiveFilter] = useState<'todos' | 'disponiveis' | 'promos' | 'envio'>('todos');
  const [route, setRoute] = useState<StoreRoute>(() => parseStoreRoute());
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [cart, setCart] = useState<CartDraftLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const onPopState = () => setRoute(parseStoreRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`${getGatewayBaseURL()}/api/store/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Loja nao encontrada.');
        return data as PublicStorePayload;
      })
      .then((data) => { if (alive) setPayload(data); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Nao foi possivel carregar a loja.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    setDetailQuantity(1);
  }, [route.productCode]);

  const storeBasePath = `/store/${slug}`;
  const layout = resolveStoreLayout(payload?.store.layout);
  const preset = STORE_LAYOUT_PRESETS[layout];
  const products = (payload?.products || []).map(product => productMeta(product, layout));
  const storeName = payload?.store.storeName || 'Loja';
  const selectedProduct = products.find(product => product.codigo.toLowerCase() === (route.productCode || '').toLowerCase());
  const categories: string[] = ['Todos', ...Array.from(new Set<string>(products.map(product => product.category)))];

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter(product => {
      const matchesSearch = !normalized ||
        product.nome.toLowerCase().includes(normalized) ||
        product.codigo.toLowerCase().includes(normalized) ||
        product.descricao.toLowerCase().includes(normalized);
      const matchesCategory = activeCategory === 'Todos' || product.category === activeCategory;
      const matchesFilter =
        activeFilter === 'todos' ||
        (activeFilter === 'disponiveis' && product.estoque > 0) ||
        (activeFilter === 'promos' && product.promo) ||
        (activeFilter === 'envio' && !!product.has_shipping);
      return matchesSearch && matchesCategory && matchesFilter;
    });
  }, [products, query, activeCategory, activeFilter]);

  const cartLines = cart
    .map(line => {
      const product = products.find(item => item.codigo === line.codigo);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter(Boolean) as Array<{ product: ProductWithMeta; quantity: number }>;

  const cartTotal = cartLines.reduce((sum, item) => sum + item.product.preco * item.quantity, 0);
  const cartCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setRoute(parseStoreRoute());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (product: SQLProduct, quantity = 1, goToCart = true) => {
    setCart(prev => {
      const existing = prev.find(item => item.codigo === product.codigo);
      if (existing) return prev.map(item => item.codigo === product.codigo ? { ...item, quantity: item.quantity + quantity } : item);
      return [...prev, { codigo: product.codigo, quantity }];
    });
    if (goToCart) navigate(`${storeBasePath}/carrinho`);
  };

  const updateQuantity = (codigo: string, delta: number) => {
    setCart(prev => prev
      .map(item => item.codigo === codigo ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const redirectToWhatsApp = (lines = cartLines) => {
    if (!payload || !lines.length) return;
    window.location.href = buildWhatsAppStoreCartLink(
      lines.map(item => ({ product: item.product, quantity: item.quantity })),
      payload.store.whatsappPhone,
      payload.store.storeName
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f3ff] flex items-center justify-center text-[#6d28d9] font-black">
        Carregando vitrine...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-[#f7f3ff] flex items-center justify-center px-4">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-xl border border-zinc-200">
          <Store className="w-10 h-10 text-[#6d28d9] mx-auto mb-3" />
          <h1 className="text-2xl font-black text-zinc-950">Loja indisponivel</h1>
          <p className="text-sm text-zinc-500 mt-2">{error || 'Nao encontramos essa vitrine.'}</p>
        </div>
      </div>
    );
  }

  const bannerStyle = payload.store.bannerUrl
    ? { backgroundImage: `linear-gradient(180deg, rgba(20, 20, 20, 0.16), rgba(20, 20, 20, 0.48)), url(${payload.store.bannerUrl})` }
    : { background: preset.banner };

  return (
    <div className="min-h-screen text-zinc-950" style={{ backgroundColor: preset.background }}>
      <TopBar
        preset={preset}
        cartCount={cartCount}
        onCart={() => navigate(`${storeBasePath}/carrinho`)}
        onBack={() => route.page === 'home' ? window.history.back() : navigate(storeBasePath)}
      />

      <header className="relative">
        <div className="h-44 sm:h-56 bg-cover bg-center" style={bannerStyle} />
        <div className="max-w-6xl mx-auto px-4">
          <div className="-mt-14 pb-5 text-center">
            <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} preset={preset} size="large" />
            <h1 className="mt-4 text-2xl sm:text-3xl font-black">{storeName}</h1>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm text-zinc-600">
              <span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" style={{ color: preset.primary }} /> Hoje 18:30 as 23:50</span>
              <span className="inline-flex items-center gap-1.5"><Truck className="w-4 h-4" style={{ color: preset.primary }} /> {preset.deliveryText}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" style={{ color: preset.primary }} /> {preset.contactText}</span>
            </div>
            <p className="mt-3 text-sm font-bold text-zinc-800">{preset.minOrderText}</p>
          </div>
        </div>
      </header>

      {route.page === 'home' && (
        <HomePage
          products={filteredProducts}
          allCount={products.length}
          preset={preset}
          categories={categories}
          activeCategory={activeCategory}
          activeFilter={activeFilter}
          query={query}
          onQuery={setQuery}
          onCategory={setActiveCategory}
          onFilter={setActiveFilter}
          onDetails={(product) => navigate(`${storeBasePath}/produto/${encodeURIComponent(product.codigo)}`)}
          onBuy={(product) => redirectToWhatsApp([{ product, quantity: 1 }])}
          onAdd={(product) => addToCart(product, 1, false)}
        />
      )}

      {route.page === 'product' && (
        <ProductDetailPage
          product={selectedProduct}
          preset={preset}
          quantity={detailQuantity}
          setQuantity={setDetailQuantity}
          onBack={() => navigate(storeBasePath)}
          onAddToCart={(product, quantity) => addToCart(product, quantity, true)}
          onBuyNow={(product, quantity) => redirectToWhatsApp([{ product, quantity }])}
        />
      )}

      {route.page === 'cart' && (
        <CartPage
          lines={cartLines}
          preset={preset}
          total={cartTotal}
          onBack={() => navigate(storeBasePath)}
          onUpdateQuantity={updateQuantity}
          onCheckout={() => redirectToWhatsApp()}
          onContinue={() => navigate(storeBasePath)}
        />
      )}
    </div>
  );
}

function TopBar({ preset, cartCount, onCart, onBack }: { preset: StoreLayoutPreset; cartCount: number; onCart: () => void; onBack: () => void }) {
  return (
    <div className="sticky top-0 z-40 text-white shadow-lg shadow-purple-950/20" style={{ background: preset.banner }}>
      <div className="max-w-6xl mx-auto h-14 px-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-md hover:bg-white/10 flex items-center justify-center" title="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="font-black tracking-wide">{preset.topTitle}</div>
        <button onClick={onCart} className="relative w-10 h-10 rounded-md hover:bg-white/10 flex items-center justify-center" title="Sacola">
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center px-1">
              {cartCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function StoreLogo({ logoUrl, storeName, preset, size = 'normal' }: { logoUrl?: string | null; storeName: string; preset: StoreLayoutPreset; size?: 'normal' | 'large' }) {
  const dimensions = size === 'large' ? 'w-28 h-28 text-3xl' : 'w-14 h-14 text-lg';
  return (
    <div data-store-logo className={`${dimensions} mx-auto rounded-full bg-white shadow-xl ring-4 ring-white overflow-hidden flex items-center justify-center font-black`} style={{ color: preset.primary }}>
      {logoUrl ? (
        <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" />
      ) : (
        initials(storeName)
      )}
    </div>
  );
}

function HomePage({
  products,
  allCount,
  preset,
  categories,
  activeCategory,
  activeFilter,
  query,
  onQuery,
  onCategory,
  onFilter,
  onDetails,
  onBuy,
  onAdd,
}: {
  products: ProductWithMeta[];
  allCount: number;
  preset: StoreLayoutPreset;
  categories: string[];
  activeCategory: string;
  activeFilter: 'todos' | 'disponiveis' | 'promos' | 'envio';
  query: string;
  onQuery: (value: string) => void;
  onCategory: (value: string) => void;
  onFilter: (value: 'todos' | 'disponiveis' | 'promos' | 'envio') => void;
  onDetails: (product: ProductWithMeta) => void;
  onBuy: (product: ProductWithMeta) => void;
  onAdd: (product: ProductWithMeta) => void;
}) {
  const filters: Array<{ key: 'todos' | 'disponiveis' | 'promos' | 'envio'; label: string }> = [
    { key: 'todos', label: 'Todos' },
    { key: 'disponiveis', label: 'Disponiveis' },
    { key: 'promos', label: 'Ofertas' },
    { key: 'envio', label: 'Com envio' },
  ];

  return (
    <main className="pb-24">
      <section className="sticky top-14 z-30 backdrop-blur border-y" style={{ backgroundColor: `${preset.background}f2`, borderColor: preset.border }}>
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map(category => (
              <button
                data-store-category
                key={category}
                onClick={() => onCategory(category)}
                className={`shrink-0 px-4 h-11 border-b-2 text-sm font-black transition-colors ${
                  activeCategory === category
                    ? ''
                    : 'border-transparent text-zinc-700 hover:text-zinc-950'
                }`}
                style={activeCategory === category ? { borderColor: preset.primary, color: preset.primary } : undefined}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 pt-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="h-12 bg-white border border-zinc-200 rounded-md flex items-center gap-2 px-3 shadow-sm">
            <Search className="w-5 h-5" style={{ color: preset.primary }} />
            <input
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder={preset.searchPlaceholder}
              className="flex-1 h-full outline-none bg-transparent text-sm"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {filters.map(filter => (
              <button
                data-store-filter
                key={filter.key}
                onClick={() => onFilter(filter.key)}
                className={`h-12 shrink-0 rounded-md border px-3 text-xs font-black flex items-center gap-2 ${
                  activeFilter === filter.key
                    ? 'text-white shadow-sm shadow-purple-900/20'
                    : 'bg-white text-zinc-700 border-zinc-200'
                }`}
                style={activeFilter === filter.key ? { backgroundColor: preset.primary, borderColor: preset.primary } : undefined}
              >
                {filter.key === 'todos' ? <SlidersHorizontal className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black">{preset.homeTitle}</h2>
            <p className="text-sm text-zinc-500 mt-1">{products.length} de {allCount} {preset.homeSubtitle}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map(product => (
            <React.Fragment key={product.id}>
              <ProductCard product={product} preset={preset} onDetails={onDetails} onBuy={onBuy} onAdd={onAdd} />
            </React.Fragment>
          ))}
        </div>

        {!products.length && (
          <div className="mt-8 bg-white border border-zinc-200 rounded-md p-10 text-center">
            <Search className="w-10 h-10 mx-auto text-zinc-300" />
            <p className="mt-3 font-black">Nenhum produto encontrado</p>
            <p className="text-sm text-zinc-500 mt-1">Ajuste a busca ou escolha outra categoria.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function ProductCard({
  product,
  preset,
  onDetails,
  onBuy,
  onAdd,
}: {
  product: ProductWithMeta;
  preset: StoreLayoutPreset;
  onDetails: (product: ProductWithMeta) => void;
  onBuy: (product: ProductWithMeta) => void;
  onAdd: (product: ProductWithMeta) => void;
}) {
  return (
    <article data-store-product-card className="bg-white border border-zinc-200 rounded-md shadow-sm overflow-hidden group">
      <button onClick={() => onDetails(product)} className="block w-full text-left">
        <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
          {product.foto_path ? (
            <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300">
              <ShoppingBag className="w-14 h-14" />
            </div>
          )}
          <div className="absolute left-3 top-3 px-2 py-1 rounded-sm bg-white/95 text-[10px] font-black uppercase shadow" style={{ color: preset.primary }}>
            {product.category}
          </div>
          {product.estoque <= 0 && (
            <div className="absolute inset-0 bg-zinc-950/65 flex items-center justify-center text-white text-xs font-black uppercase">
              Esgotado
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-black text-base leading-tight min-h-10">{product.nome}</h3>
            <span className="inline-flex items-center gap-1 text-xs font-black text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-400" /> 4.9
            </span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 line-clamp-2 min-h-8">{product.descricao}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-zinc-400">Preco</p>
              <p className="text-xl font-black" style={{ color: preset.primary }}>{money(product.preco)}</p>
            </div>
            <span className="text-[11px] font-bold text-zinc-500 inline-flex items-center gap-1">
              Detalhes <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </button>
      <div className="px-4 pb-4 grid grid-cols-[1fr_44px] gap-2">
        <button
          disabled={product.estoque <= 0}
          onClick={() => onBuy(product)}
          className="h-11 rounded-md disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-black"
          style={product.estoque > 0 ? { backgroundColor: preset.primary } : undefined}
        >
          {preset.buyNowText}
        </button>
        <button
          disabled={product.estoque <= 0}
          onClick={() => onAdd(product)}
          className="h-11 rounded-md disabled:bg-zinc-300 disabled:cursor-not-allowed text-white flex items-center justify-center"
          style={product.estoque > 0 ? { backgroundColor: preset.dark } : undefined}
          title="Adicionar a sacola"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

function ProductDetailPage({
  product,
  preset,
  quantity,
  setQuantity,
  onBack,
  onAddToCart,
  onBuyNow,
}: {
  product?: ProductWithMeta;
  preset: StoreLayoutPreset;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onBack: () => void;
  onAddToCart: (product: ProductWithMeta, quantity: number) => void;
  onBuyNow: (product: ProductWithMeta, quantity: number) => void;
}) {
  const [selectedImage, setSelectedImage] = useState(product?.foto_path || '');

  useEffect(() => {
    setSelectedImage(product?.foto_path || '');
  }, [product?.foto_path]);

  if (!product) {
    return (
      <main className="max-w-3xl mx-auto px-4 pb-24">
        <div className="rounded-md bg-white p-8 text-center border border-zinc-200 shadow-xl">
          <h2 className="text-2xl font-black">Produto nao encontrado</h2>
          <p className="text-sm text-zinc-500 mt-2">Volte para a vitrine e escolha outro item.</p>
          <button onClick={onBack} className="mt-5 rounded-md text-white px-5 py-3 text-sm font-black" style={{ backgroundColor: preset.primary }}>Voltar aos produtos</button>
        </div>
      </main>
    );
  }

  const subtotal = product.preco * quantity;
  const gallery = [product.foto_path].filter(Boolean);

  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
        <button onClick={onBack} className="font-bold" style={{ color: preset.primary }}>{preset.detailBackText}</button>
        <ChevronRight className="w-3 h-3" />
        <span>{product.category}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="truncate">{product.nome}</span>
      </div>

      <section className="bg-white border border-zinc-200 rounded-md shadow-sm p-3 sm:p-5 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <div>
          <div className="aspect-square bg-zinc-100 rounded-md overflow-hidden relative">
            {selectedImage ? (
              <img src={selectedImage} alt={product.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                <ShoppingBag className="w-20 h-20" />
              </div>
            )}
            <button onClick={onBack} className="absolute left-3 top-3 w-10 h-10 rounded-md bg-white/95 flex items-center justify-center shadow" style={{ color: preset.primary }} title="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {(gallery.length ? gallery : ['']).map((image, index) => (
              <button
                data-product-gallery-thumb
                key={`${image}-${index}`}
                onClick={() => setSelectedImage(image)}
                className={`w-20 h-20 rounded-md border overflow-hidden bg-zinc-100 shrink-0 ${selectedImage === image ? '' : 'border-zinc-200'}`}
                style={selectedImage === image ? { borderColor: preset.primary } : undefined}
                title={`Imagem ${index + 1}`}
              >
                {image ? <img src={image} alt={product.nome} className="w-full h-full object-cover" /> : <ShoppingBag className="w-7 h-7 mx-auto text-zinc-300" />}
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1"><Heart className="w-4 h-4" style={{ color: preset.primary }} /> Favoritar</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="w-4 h-4" style={{ color: preset.primary }} /> Compartilhar</span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded-sm text-white text-[10px] font-black uppercase" style={{ backgroundColor: preset.primary }}>Oficial</span>
                <span className="px-2 py-1 rounded-sm bg-zinc-100 text-zinc-700 text-[10px] font-black uppercase">Cod. {product.codigo}</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-black leading-tight">{product.nome}</h2>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-black" style={{ color: preset.primary }}>4.9</span>
            <span className="inline-flex text-amber-400">
              {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="w-4 h-4 fill-amber-400" />)}
            </span>
            <span className="text-zinc-400">7,7 mil avaliacoes</span>
            <span className="text-zinc-400">10 mil+ vendidos</span>
          </div>

          <div className="mt-5 border-y px-4 py-4" style={{ backgroundColor: preset.soft, borderColor: preset.border }}>
            <p className="text-[12px] font-bold text-zinc-500">{preset.offerLabel}</p>
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-4xl font-black" style={{ color: preset.primary }}>{money(product.preco)}</span>
              <span className="text-sm text-zinc-500">{preset.priceSupport}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-y-4 text-sm">
            <span className="text-zinc-500">Entrega</span>
            <span className="inline-flex items-center gap-2 font-bold text-zinc-800"><Truck className="w-4 h-4 text-teal-600" /> Combine envio e retirada pelo WhatsApp</span>
            <span className="text-zinc-500">Disponibilidade</span>
            <span className="font-bold text-zinc-800">{product.estoque > 0 ? `${product.estoque} unidades em estoque` : 'Indisponivel no momento'}</span>
            <span className="text-zinc-500">Descricao</span>
            <span className="text-zinc-700 leading-relaxed">{product.descricao}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-zinc-500 w-full sm:w-auto">Quantidade</span>
            <div className="h-10 border border-zinc-200 rounded-md flex items-center overflow-hidden">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-full flex items-center justify-center hover:bg-zinc-50" title="Diminuir">
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 h-full border-x border-zinc-200 flex items-center justify-center font-black">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-full flex items-center justify-center hover:bg-zinc-50" title="Aumentar">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <span className="text-sm text-zinc-500">Subtotal: <strong className="text-zinc-950">{money(subtotal)}</strong></span>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
            <button
              disabled={product.estoque <= 0}
              onClick={() => onAddToCart(product, quantity)}
              className="h-12 rounded-md border disabled:border-zinc-200 disabled:text-zinc-400 font-black flex items-center justify-center gap-2"
              style={product.estoque > 0 ? { borderColor: preset.primary, color: preset.primary } : undefined}
            >
              <ShoppingBag className="w-5 h-5" />
              {preset.addCartText}
            </button>
            <button
              disabled={product.estoque <= 0}
              onClick={() => onBuyNow(product, quantity)}
              className="h-12 rounded-md disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2"
              style={product.estoque > 0 ? { backgroundColor: preset.primary } : undefined}
            >
              <MessageCircle className="w-5 h-5" />
              {preset.buyNowText}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 rounded-sm"><CheckCircle2 className="w-4 h-4 text-teal-600" /> {preset.assistBadge}</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-100 rounded-sm"><CheckCircle2 className="w-4 h-4 text-teal-600" /> {preset.stockBadge}</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function CartPage({
  lines,
  preset,
  total,
  onBack,
  onUpdateQuantity,
  onCheckout,
  onContinue,
}: {
  lines: Array<{ product: ProductWithMeta; quantity: number }>;
  preset: StoreLayoutPreset;
  total: number;
  onBack: () => void;
  onUpdateQuantity: (codigo: string, delta: number) => void;
  onCheckout: () => void;
  onContinue: () => void;
}) {
  return (
    <main className="max-w-4xl mx-auto px-4 pb-24">
      <div className="bg-white rounded-md border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 text-white flex items-center justify-between" style={{ background: preset.banner }}>
          <button onClick={onBack} className="w-10 h-10 rounded-md bg-white/15 flex items-center justify-center" title="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-xl font-black">{preset.cartTitle}</h2>
            <p className="text-xs text-white/80">{preset.cartSubtitle}</p>
          </div>
          <div className="w-10" />
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {!lines.length && (
            <div className="py-16 text-center">
              <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
              <h3 className="font-black text-xl mt-3">{preset.emptyCartTitle}</h3>
              <p className="text-sm text-zinc-500 mt-1">{preset.emptyCartText}</p>
              <button onClick={onContinue} className="mt-5 rounded-md text-white px-5 py-3 text-sm font-black" style={{ backgroundColor: preset.primary }}>
                {preset.continueText}
              </button>
            </div>
          )}

          {lines.map(item => (
            <div data-cart-line key={item.product.codigo} className="grid grid-cols-[88px_1fr_auto] gap-4 rounded-md border border-zinc-200 p-3">
              <div className="w-24 h-24 rounded-md bg-zinc-100 overflow-hidden shrink-0">
                {item.product.foto_path ? (
                  <img src={item.product.foto_path} alt={item.product.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-300">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-black truncate">{item.product.nome}</p>
                <p className="text-xs text-zinc-500 mt-1">Cod. {item.product.codigo}</p>
                <p className="text-sm font-black mt-1" style={{ color: preset.primary }}>{money(item.product.preco)}</p>
                <div className="mt-3 flex items-center gap-2">
                  <button onClick={() => onUpdateQuantity(item.product.codigo, -1)} className="w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-800" title="Diminuir">
                    {item.quantity === 1 ? <X className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-sm font-black">{item.quantity}</span>
                  <button onClick={() => onUpdateQuantity(item.product.codigo, 1)} className="w-8 h-8 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-800" title="Aumentar">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="font-black text-zinc-950">{money(item.product.preco * item.quantity)}</p>
            </div>
          ))}
        </div>

        {!!lines.length && (
          <div className="p-5 sm:p-6 border-t border-zinc-200 bg-white">
            <div className="flex items-center justify-between">
              <span className="font-bold text-zinc-500">Total</span>
              <span className="text-3xl font-black" style={{ color: preset.primary }}>{money(total)}</span>
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={onContinue} className="rounded-md bg-zinc-100 text-zinc-900 py-4 font-black">
                {preset.continueText}
              </button>
              <button onClick={onCheckout} className="rounded-md text-white py-4 font-black flex items-center justify-center gap-2" style={{ backgroundColor: preset.primary }}>
                <MessageCircle className="w-5 h-5" />
                {preset.checkoutText}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
