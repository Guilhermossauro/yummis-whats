import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  GripVertical,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import {
  SQLProduct,
  StoreLayoutType,
  StorefrontCartElementId,
  StorefrontConfig,
  StorefrontEditorPageId,
  StorefrontLabels,
  StorefrontPageElement,
  StorefrontProductElementId,
  StorefrontSection,
  StorefrontSectionId,
} from '../types';
import { getGatewayBaseURL } from '../lib/gateway';
import { buildWhatsAppStoreCartLink } from '../lib/productShare';
import {
  buildStoreCategoryChips,
  getFeaturedCategories,
  getLayoutDefaults,
  normalizeStorefrontConfig,
  resolveProductCategories,
  sortStoreProducts,
} from '../lib/storefront';

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
    config?: StorefrontConfig | null;
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
  categoriesResolved: string[];
  primaryCategory: string;
  promo: boolean;
  featured: boolean;
};

type PreviewEditorConfig = {
  enabled?: boolean;
  page?: StorefrontEditorPageId;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string) => void;
  onMoveElement?: (draggedElementId: string, targetElementId: string) => void;
};

const ALL_CATEGORY_KEY = '__all__';
const DEFAULT_STORE_LAYOUT: StoreLayoutType = 'ecommerce';
const PUBLIC_AUTO_HIDE_LABEL_KEYS: Array<keyof StorefrontLabels> = [
  'heroTitle',
  'heroSubtitle',
  'featuredSubtitle',
  'aboutTitle',
  'aboutText',
  'benefitsTitle',
  'benefitsText',
  'footerNote',
];

function resolveStoreLayout(value?: string | null): StoreLayoutType {
  return value && ['restaurant', 'ecommerce', 'fashion', 'market', 'beauty', 'electronics', 'services'].includes(value)
    ? value as StoreLayoutType
    : DEFAULT_STORE_LAYOUT;
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

const money = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

function cleanText(value?: string | null) {
  return String(value || '').trim();
}

function hasText(value?: string | null) {
  return cleanText(value).length > 0;
}

function buildPublicLabels(labels: StorefrontLabels, defaults: StorefrontLabels) {
  const next = { ...labels };
  PUBLIC_AUTO_HIDE_LABEL_KEYS.forEach((key) => {
    if (cleanText(labels[key]) === cleanText(defaults[key])) {
      next[key] = '' as StorefrontLabels[typeof key];
    }
  });
  return next;
}

export default function PublicStorefront({
  slug,
  previewPayload,
  embeddedMode = false,
  previewPage = 'home',
  previewEditor,
}: {
  slug: string;
  previewPayload?: PublicStorePayload;
  embeddedMode?: boolean;
  previewPage?: 'home' | 'product' | 'cart';
  previewEditor?: PreviewEditorConfig;
}) {
  const cartStorageKey = `yms_store_cart_${slug}`;
  const [payload, setPayload] = useState<PublicStorePayload | null>(previewPayload || null);
  const [loading, setLoading] = useState(!previewPayload);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY_KEY);
  const [activeFilter, setActiveFilter] = useState<'todos' | 'disponiveis' | 'promos' | 'envio'>('todos');
  const [route, setRoute] = useState<StoreRoute>(() => embeddedMode ? { page: previewPage } : parseStoreRoute());
  const [detailQuantity, setDetailQuantity] = useState(1);
  const [previewDraggingElementId, setPreviewDraggingElementId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartDraftLine[]>(() => {
    if (embeddedMode) return [];
    try {
      return JSON.parse(localStorage.getItem(cartStorageKey) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!previewPayload) return;
    setPayload(previewPayload);
    setLoading(false);
    setError('');
  }, [previewPayload]);

  useEffect(() => {
    if (!embeddedMode) return;
    const previewCode = (previewPayload?.products || payload?.products || [])[0]?.codigo;
    setRoute((prev) => {
      const next = previewPage === 'product'
        ? { page: 'product' as const, productCode: previewCode }
        : { page: previewPage };
      return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
    });
    if (previewPage === 'cart' && previewCode) {
      setCart(prev => prev.length ? prev : [{ codigo: previewCode, quantity: 1 }]);
    }
  }, [embeddedMode, payload?.products, previewPage, previewPayload?.products]);

  useEffect(() => {
    if (embeddedMode) return undefined;
    const onPopState = () => setRoute(parseStoreRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [embeddedMode]);

  useEffect(() => {
    if (embeddedMode) return;
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart, cartStorageKey, embeddedMode]);

  useEffect(() => {
    if (previewPayload || embeddedMode) return;
    let alive = true;
    setLoading(true);
    fetch(`${getGatewayBaseURL()}/api/store/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Loja não encontrada.');
        if (!data?.store || !Array.isArray(data?.products)) {
          throw new Error('A resposta da loja veio incompleta. Atualize a página em alguns segundos.');
        }
        return data as PublicStorePayload;
      })
      .then((data) => { if (alive) setPayload(data); })
      .catch((err) => { if (alive) setError(err instanceof Error ? err.message : 'Não foi possível carregar a loja.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [embeddedMode, previewPayload, slug]);

  useEffect(() => {
    setDetailQuantity(1);
  }, [route.productCode]);

  const storeBasePath = `/store/${slug}`;
  const storeData = payload?.store || null;
  const productsData = payload?.products || [];
  const layout = resolveStoreLayout(storeData?.layout);
  const storeName = storeData?.storeName || 'Loja';
  const config = useMemo(
    () => normalizeStorefrontConfig(layout, storeName, productsData, storeData?.config),
    [layout, productsData, storeData?.config, storeName],
  );
  const publicConfig = useMemo(
    () => ({
      ...config,
      labels: buildPublicLabels(config.labels, getLayoutDefaults(layout).labels),
    }),
    [config, layout],
  );

  const sortedProducts = useMemo(() => {
    const base = sortStoreProducts(productsData, layout, config)
      .filter(product => !config.hiddenProductCodes.includes(product.codigo.toUpperCase()));

    return base.map((product) => {
      const categoriesResolved = resolveProductCategories(product, layout);
      const featuredCategories = new Set(getFeaturedCategories(config.categorySettings).map(item => item.name.toLowerCase()));
      const featured = config.highlightCodes.includes(product.codigo.toUpperCase())
        || categoriesResolved.some(category => featuredCategories.has(category.toLowerCase()));
      return {
        ...product,
        categoriesResolved,
        primaryCategory: categoriesResolved[0] || 'Destaques',
        promo: Number(product.estoque || 0) > 0 && (/promo|oferta|kit|combo/i.test(`${product.nome} ${product.descricao}`) || Number(product.id) % 2 === 0),
        featured,
      } satisfies ProductWithMeta;
    });
  }, [config, layout, productsData]);

  const categoryChips = useMemo(
    () => buildStoreCategoryChips(sortedProducts, layout, config),
    [sortedProducts, layout, config],
  );

  useEffect(() => {
    if (activeCategory === ALL_CATEGORY_KEY) return;
    if (!categoryChips.some(chip => chip.name === activeCategory)) {
      setActiveCategory(ALL_CATEGORY_KEY);
    }
  }, [activeCategory, categoryChips]);

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortedProducts.filter((product) => {
      const matchesSearch = !normalized
        || product.nome.toLowerCase().includes(normalized)
        || product.codigo.toLowerCase().includes(normalized)
        || product.descricao.toLowerCase().includes(normalized)
        || product.categoriesResolved.some(category => category.toLowerCase().includes(normalized));
      const matchesCategory = activeCategory === ALL_CATEGORY_KEY || product.categoriesResolved.includes(activeCategory);
      const matchesFilter =
        activeFilter === 'todos'
        || (activeFilter === 'disponiveis' && Number(product.estoque || 0) > 0)
        || (activeFilter === 'promos' && product.promo)
        || (activeFilter === 'envio' && !!product.has_shipping);
      return matchesSearch && matchesCategory && matchesFilter;
    });
  }, [activeCategory, activeFilter, query, sortedProducts]);

  const featuredProducts = useMemo(() => {
    const explicit = filteredProducts.filter(product => product.featured || product.promo);
    return (explicit.length ? explicit : filteredProducts).slice(0, 4);
  }, [filteredProducts]);

  const selectedProduct = sortedProducts.find(product => product.codigo.toLowerCase() === (route.productCode || '').toLowerCase());

  const cartLines = cart
    .map(line => {
      const product = sortedProducts.find(item => item.codigo === line.codigo);
      return product ? { product, quantity: line.quantity } : null;
    })
    .filter(Boolean) as Array<{ product: ProductWithMeta; quantity: number }>;

  const cartTotal = cartLines.reduce((sum, item) => sum + Number(item.product.preco || 0) * item.quantity, 0);
  const cartCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);

  const navigate = (next: StoreRoute) => {
    if (embeddedMode) {
      setRoute(next);
      return;
    }
    const path = next.page === 'home'
      ? storeBasePath
      : next.page === 'cart'
        ? `${storeBasePath}/carrinho`
        : `${storeBasePath}/produto/${encodeURIComponent(next.productCode || '')}`;
    window.history.pushState({}, '', path);
    setRoute(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addToCart = (product: SQLProduct, quantity = 1, goToCart = true) => {
    setCart(prev => {
      const existing = prev.find(item => item.codigo === product.codigo);
      if (existing) return prev.map(item => item.codigo === product.codigo ? { ...item, quantity: item.quantity + quantity } : item);
      return [...prev, { codigo: product.codigo, quantity }];
    });
    if (goToCart) navigate({ page: 'cart' });
  };

  const updateQuantity = (codigo: string, delta: number) => {
    setCart(prev => prev
      .map(item => item.codigo === codigo ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const redirectToWhatsApp = (lines = cartLines) => {
    if (!payload || !storeData || !lines.length) return;
    if (embeddedMode) {
      navigate({ page: 'cart' });
      return;
    }
    window.location.href = buildWhatsAppStoreCartLink(
      lines.map(item => ({ product: item.product, quantity: item.quantity })),
      storeData.whatsappPhone,
      storeData.storeName
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg font-black" style={{ backgroundColor: publicConfig.theme.background, color: publicConfig.theme.primary }}>
        Carregando vitrine...
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f3ff' }}>
        <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-xl border border-zinc-200">
          <Store className="w-10 h-10 mx-auto mb-3 text-violet-600" />
          <h1 className="text-2xl font-black text-zinc-950">Loja indisponível</h1>
          <p className="text-sm text-zinc-500 mt-2">{error || 'Não encontramos essa vitrine.'}</p>
        </div>
      </div>
    );
  }

  const bannerStyle = storeData?.bannerUrl
    ? { backgroundImage: `linear-gradient(180deg, rgba(20, 20, 20, 0.18), rgba(20, 20, 20, 0.55)), url(${storeData.bannerUrl})` }
    : { background: config.theme.topbar };

  return (
    <div className={`min-h-screen ${embeddedMode ? 'overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl' : ''}`} style={{ backgroundColor: publicConfig.theme.background, color: publicConfig.theme.text }}>
      <TopBar
        layout={layout}
        config={publicConfig}
        cartCount={cartCount}
        onCart={() => navigate({ page: 'cart' })}
        onBack={() => route.page === 'home' ? (embeddedMode ? undefined : window.history.back()) : navigate({ page: 'home' })}
      />

      {route.page === 'home' && (
        <main className="pb-24">
          {config.sections.filter(section => section.enabled).map((section) => (
            (() => {
              const content = renderHomeSection({
                section,
                layout,
                config: publicConfig,
                payload,
                bannerStyle,
                storeName,
                products: filteredProducts,
                allProducts: sortedProducts,
                featuredProducts,
                categoryChips,
                activeCategory,
                activeFilter,
                query,
                onQuery: setQuery,
                onCategory: setActiveCategory,
                onFilter: setActiveFilter,
                onDetails: (product) => navigate({ page: 'product', productCode: product.codigo }),
                onBuy: (product) => redirectToWhatsApp([{ product, quantity: 1 }]),
                onAdd: (product) => addToCart(product, 1, false),
              });

              if (!content) return null;
              if (!embeddedMode || !previewEditor?.enabled) {
                return <React.Fragment key={section.id}>{content}</React.Fragment>;
              }

              return (
                <React.Fragment key={section.id}>
                  <PreviewCanvasFrame
                    itemId={section.id}
                    label={section.title || section.id}
                    selected={previewEditor.selectedElementId === section.id}
                    onSelect={previewEditor.onSelectElement}
                    onMove={previewEditor.onMoveElement}
                    draggingItemId={previewDraggingElementId}
                    setDraggingItemId={setPreviewDraggingElementId}
                  >
                    {content}
                  </PreviewCanvasFrame>
                </React.Fragment>
              );
            })()
          ))}
        </main>
      )}

      {route.page === 'product' && (
        <ProductDetailPage
          product={selectedProduct}
          config={publicConfig}
          layout={layout}
          quantity={detailQuantity}
          setQuantity={setDetailQuantity}
          onBack={() => navigate({ page: 'home' })}
          onAddToCart={(product, quantity) => addToCart(product, quantity, true)}
          onBuyNow={(product, quantity) => redirectToWhatsApp([{ product, quantity }])}
          previewEditor={embeddedMode && previewEditor?.enabled ? previewEditor : undefined}
        />
      )}

      {route.page === 'cart' && (
        <CartPage
          layout={layout}
          config={publicConfig}
          lines={cartLines}
          total={cartTotal}
          onBack={() => navigate({ page: 'home' })}
          onUpdateQuantity={updateQuantity}
          onCheckout={() => redirectToWhatsApp()}
          onContinue={() => navigate({ page: 'home' })}
          previewEditor={embeddedMode && previewEditor?.enabled ? previewEditor : undefined}
        />
      )}
    </div>
  );
}

function renderHomeSection({
  section,
  layout,
  config,
  payload,
  bannerStyle,
  storeName,
  products,
  allProducts,
  featuredProducts,
  categoryChips,
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
  section: StorefrontSection;
  layout: StoreLayoutType;
  config: StorefrontConfig;
  payload: PublicStorePayload;
  bannerStyle: React.CSSProperties;
  storeName: string;
  products: ProductWithMeta[];
  allProducts: ProductWithMeta[];
  featuredProducts: ProductWithMeta[];
  categoryChips: Array<{ name: string; label: string; featured: boolean }>;
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
  if (section.id === 'hero') {
    return null;
  }
  if (section.id === 'categories') {
    if (!categoryChips.length) return null;
    return <CategoryRail layout={layout} config={config} section={section} categoryChips={categoryChips} activeCategory={activeCategory} onCategory={onCategory} />;
  }
  if (section.id === 'filters') {
    if (!config.layoutSettings.showSearch && !config.layoutSettings.showFilters) return null;
    return (
      <SearchAndFilters
        layout={layout}
        config={config}
        section={section}
        query={query}
        activeFilter={activeFilter}
        onQuery={onQuery}
        onFilter={onFilter}
      />
    );
  }
  if (section.id === 'featured') {
    if (!config.layoutSettings.showFeaturedStrip || !featuredProducts.length) return null;
    return <FeaturedSection layout={layout} config={config} section={section} products={featuredProducts} onDetails={onDetails} />;
  }
  if (section.id === 'products') {
    return (
      <ProductCollectionSection
        layout={layout}
        config={config}
        section={section}
        products={products}
        allCount={allProducts.length}
        onDetails={onDetails}
        onBuy={onBuy}
        onAdd={onAdd}
      />
    );
  }
  if (section.id === 'about') {
    if (!config.layoutSettings.showAbout) return null;
    return <AboutSection layout={layout} config={config} section={section} />;
  }
  if (section.id === 'benefits') {
    if (!config.layoutSettings.showBenefits) return null;
    return <BenefitsSection layout={layout} config={config} section={section} />;
  }
  if (section.id === 'footer') {
    return <FooterSection config={config} />;
  }
  return null;
}

function TopBar({
  layout,
  config,
  cartCount,
  onCart,
  onBack,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  cartCount: number;
  onCart: () => void;
  onBack: () => void;
}) {
  return (
    <div className="sticky top-0 z-40 text-white shadow-lg" style={{ background: config.theme.topbar }}>
      <div className="max-w-7xl mx-auto h-14 px-4 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center" title="Voltar">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 font-black tracking-wide uppercase text-xs sm:text-sm">
          {layout === 'electronics' && <Zap className="w-4 h-4" />}
          {layout === 'beauty' && <Sparkles className="w-4 h-4" />}
          <span>{config.labels.topTitle}</span>
        </div>
        <button onClick={onCart} className="relative w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center" title="Carrinho">
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

function StoreLogo({ logoUrl, storeName, color, size = 'large' }: { logoUrl?: string | null; storeName: string; color: string; size?: 'large' | 'normal' }) {
  const dimensions = size === 'large' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl';
  return (
    <div className={`${dimensions} rounded-full bg-white shadow-2xl ring-4 ring-white overflow-hidden flex items-center justify-center font-black`} style={{ color }}>
      {logoUrl ? <img src={logoUrl} alt={storeName} className="w-full h-full object-cover" /> : initials(storeName)}
    </div>
  );
}

function heroFallbackCopy(layout: StoreLayoutType) {
  switch (layout) {
    case 'fashion':
      return 'Modelagens escolhidas para inspirar looks marcantes e deixar a compra mais gostosa do primeiro clique ao carrinho.';
    case 'restaurant':
      return 'Sabores em destaque, combinações irresistíveis e favoritos prontos para abrir o apetite logo na chegada.';
    case 'electronics':
      return 'Tecnologia em evidência, lançamentos atuais e uma seleção pensada para facilitar sua escolha.';
    case 'services':
      return 'Especialidades apresentadas com clareza para você entender rápido e seguir com mais confiança.';
    case 'beauty':
      return 'Lançamentos, kits e queridinhos reunidos em uma experiência leve, bonita e fácil de explorar.';
    case 'market':
      return 'Ofertas, itens do dia e favoritos organizados para você encontrar tudo com mais rapidez.';
    default:
      return 'Destaques selecionados para você encontrar o que procura com mais facilidade e seguir comprando sem complicação.';
  }
}

function heroFallbackBackground(layout: StoreLayoutType, config: StorefrontConfig) {
  switch (layout) {
    case 'fashion':
      return 'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.82), transparent 28%), radial-gradient(circle at 85% 18%, rgba(255,255,255,0.24), transparent 22%), linear-gradient(135deg, #f7eee8 0%, #d49dd8 42%, #2c1248 100%)';
    case 'restaurant':
      return 'radial-gradient(circle at 18% 18%, rgba(255,255,255,0.28), transparent 24%), linear-gradient(135deg, #1f1728 0%, #532d21 45%, #1f7a54 100%)';
    case 'electronics':
      return 'radial-gradient(circle at 12% 14%, rgba(56,189,248,0.26), transparent 26%), radial-gradient(circle at 78% 20%, rgba(167,139,250,0.24), transparent 22%), linear-gradient(135deg, #020617 0%, #0f172a 45%, #1d4ed8 100%)';
    case 'services':
      return 'radial-gradient(circle at 82% 18%, rgba(255,255,255,0.24), transparent 22%), linear-gradient(135deg, #eff6ff 0%, #c4d9ff 48%, #4f46e5 100%)';
    case 'beauty':
      return 'radial-gradient(circle at 15% 20%, rgba(255,255,255,0.9), transparent 28%), linear-gradient(135deg, #fff7fb 0%, #ffd7ec 44%, #9d4edd 100%)';
    case 'market':
      return 'radial-gradient(circle at 82% 16%, rgba(255,255,255,0.24), transparent 22%), linear-gradient(135deg, #f8fafc 0%, #d8f7e7 46%, #15803d 100%)';
    default:
      return `radial-gradient(circle at 15% 20%, rgba(255,255,255,0.46), transparent 28%), linear-gradient(135deg, ${config.theme.primary} 0%, ${config.theme.secondary} 56%, #18181b 100%)`;
  }
}

function heroShowcaseLabel(layout: StoreLayoutType) {
  switch (layout) {
    case 'fashion':
      return 'Coleção em destaque';
    case 'restaurant':
      return 'Banner de sabor';
    case 'electronics':
      return 'Visual de lançamentos';
    case 'services':
      return 'Apresentação premium';
    case 'beauty':
      return 'Destaque da vitrine';
    case 'market':
      return 'Oferta principal';
    default:
      return 'Vitrine em destaque';
  }
}

const HeroInfoPill: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  tone?: 'light' | 'dark';
}> = ({
  icon: Icon,
  text,
  tone = 'light',
}) => {
  const dark = tone === 'dark';
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-black backdrop-blur-md"
      style={dark
        ? { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(15,23,42,0.5)', color: 'white' }
        : { borderColor: 'rgba(124,58,237,0.12)', backgroundColor: 'rgba(255,255,255,0.88)', color: '#2e1065' }}
    >
      <Icon className="w-4 h-4" />
      {text}
    </span>
  );
};

const HeroMiniProductCard: React.FC<{
  product: ProductWithMeta;
  config: StorefrontConfig;
  tone?: 'light' | 'dark';
  compact?: boolean;
}> = ({
  product,
  config,
  tone = 'light',
  compact = false,
}) => {
  const dark = tone === 'dark';
  return (
    <div
      className={`rounded-[1.55rem] border backdrop-blur-md shadow-[0_26px_55px_-35px_rgba(15,23,42,0.72)] ${compact ? 'p-3' : 'p-4'}`}
      style={dark
        ? { borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(8,15,30,0.68)', color: 'white' }
        : { borderColor: config.theme.border, backgroundColor: 'rgba(255,255,255,0.92)', color: config.theme.text }}
    >
      <div className="flex items-center gap-3">
        <div className={`rounded-[1.2rem] overflow-hidden bg-zinc-100 shrink-0 ${compact ? 'w-14 h-14' : 'w-16 h-16'}`}>
          {product.foto_path ? (
            <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300">
              <ShoppingBag className={compact ? 'w-6 h-6' : 'w-7 h-7'} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] uppercase font-black tracking-[0.24em] ${dark ? 'text-white/70' : ''}`} style={dark ? undefined : { color: config.theme.primary }}>
            {product.primaryCategory}
          </p>
          <h3 className={`mt-1 font-black line-clamp-2 ${compact ? 'text-sm' : 'text-base'}`}>{product.nome}</h3>
          <p className={`mt-2 font-black ${compact ? 'text-sm' : 'text-lg'}`} style={{ color: dark ? '#e9d5ff' : config.theme.secondary }}>
            {money(product.preco)}
          </p>
        </div>
      </div>
    </div>
  );
};

const HeroMediaPanel: React.FC<{
  layout: StoreLayoutType;
  config: StorefrontConfig;
  bannerStyle: React.CSSProperties;
  bannerUrl?: string | null;
  storeName: string;
  products: ProductWithMeta[];
}> = ({
  layout,
  config,
  bannerStyle,
  bannerUrl,
  storeName,
  products,
}) => {
  const dark = layout === 'electronics';
  const visibleProducts = products.slice(0, 3);
  const overlay = layout === 'fashion'
    ? 'linear-gradient(135deg, rgba(28,18,46,0.04) 0%, rgba(52,20,82,0.34) 58%, rgba(10,10,18,0.6) 100%)'
    : layout === 'restaurant'
      ? 'linear-gradient(135deg, rgba(7,10,18,0.1) 0%, rgba(18,24,28,0.34) 48%, rgba(8,12,16,0.72) 100%)'
      : layout === 'services'
        ? 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(30,41,59,0.2) 50%, rgba(15,23,42,0.68) 100%)'
        : layout === 'beauty'
          ? 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(157,78,221,0.28) 52%, rgba(46,16,101,0.58) 100%)'
          : layout === 'market'
            ? 'linear-gradient(135deg, rgba(20,83,45,0.06) 0%, rgba(21,128,61,0.18) 48%, rgba(17,24,39,0.7) 100%)'
            : 'linear-gradient(135deg, rgba(4,8,16,0.08) 0%, rgba(32,23,68,0.24) 52%, rgba(17,24,39,0.72) 100%)';

  return (
    <div
      className={`relative min-h-[420px] overflow-hidden rounded-[2.2rem] border ${dark ? 'bg-slate-950' : 'bg-white'}`}
      style={{ borderColor: dark ? 'rgba(255,255,255,0.14)' : config.theme.border }}
    >
      {bannerUrl ? (
        <div
          className="absolute inset-0"
          style={{ ...bannerStyle, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: heroFallbackBackground(layout, config) }} />
      )}
      <div className="absolute inset-0" style={{ background: overlay }} />
      <div className="absolute -right-12 -top-14 h-48 w-48 rounded-full blur-3xl opacity-35" style={{ backgroundColor: config.theme.secondary }} />
      <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full blur-3xl opacity-25" style={{ backgroundColor: config.theme.primary }} />

      {!bannerUrl && visibleProducts.length > 0 && (
        <div className="absolute inset-0 p-4 sm:p-5">
          <div className="grid h-full grid-cols-2 grid-rows-2 gap-3">
            {visibleProducts[0] && (
              <div className="row-span-2 rounded-[1.9rem] overflow-hidden border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm">
                {visibleProducts[0].foto_path ? (
                  <img src={visibleProducts[0].foto_path} alt={visibleProducts[0].nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/70"><ShoppingBag className="w-12 h-12" /></div>
                )}
              </div>
            )}
            {visibleProducts[1] && (
              <div className="rounded-[1.6rem] overflow-hidden border border-white/16 bg-white/10 shadow-xl backdrop-blur-sm">
                {visibleProducts[1].foto_path ? (
                  <img src={visibleProducts[1].foto_path} alt={visibleProducts[1].nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/70"><ShoppingBag className="w-8 h-8" /></div>
                )}
              </div>
            )}
            {visibleProducts[2] && (
              <div className="rounded-[1.6rem] overflow-hidden border border-white/16 bg-white/10 shadow-xl backdrop-blur-sm">
                {visibleProducts[2].foto_path ? (
                  <img src={visibleProducts[2].foto_path} alt={visibleProducts[2].nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/70"><ShoppingBag className="w-8 h-8" /></div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative z-10 flex h-full min-h-[420px] flex-col justify-between p-5 sm:p-6 lg:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.32em] text-white backdrop-blur-md" style={{ borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(15,23,42,0.26)' }}>
            {layout === 'electronics' ? <Zap className="w-3.5 h-3.5" /> : layout === 'beauty' ? <Sparkles className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            {heroShowcaseLabel(layout)}
          </span>
          <span className="rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-black text-white/90 backdrop-blur-md">
            {bannerUrl ? 'nova coleção' : 'seleção especial'}
          </span>
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-[13rem] text-white sm:max-w-md">
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-white/72">{storeName}</p>
            <h3 className="mt-3 text-xl font-black leading-tight sm:text-4xl">
              {bannerUrl ? 'Descubra os destaques que definem esta vitrine.' : 'Escolhas pensadas para abrir sua próxima compra.'}
            </h3>
            <p className="mt-2 max-w-[13rem] text-xs leading-relaxed text-white/84 sm:mt-3 sm:max-w-md sm:text-base">{heroFallbackCopy(layout)}</p>
          </div>
          <div className="hidden gap-3 sm:grid">
            {visibleProducts.slice(0, 2).map((product) => (
              <HeroMiniProductCard key={product.id} product={product} config={config} tone="dark" compact />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function HeroSection({
  layout,
  config,
  bannerStyle,
  storeName,
  payload,
  products,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  bannerStyle: React.CSSProperties;
  storeName: string;
  payload: PublicStorePayload;
  products: ProductWithMeta[];
}) {
  const heroTitle = hasText(config.labels.heroTitle) ? config.labels.heroTitle : storeName;
  const heroSubtitle = hasText(config.labels.heroSubtitle) ? config.labels.heroSubtitle : heroFallbackCopy(layout);
  const leadProduct = products[0];
  const heroCategories = Array.from(new Set(products.map(product => cleanText(product.primaryCategory)).filter(Boolean))).slice(0, 4);
  const summaryCards = [
    { icon: Clock3, text: 'Hoje 18:30 às 23:50' },
    { icon: Truck, text: config.labels.deliveryText },
    { icon: MapPin, text: config.labels.contactText },
  ];

  if (layout === 'restaurant') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.5rem] border bg-white shadow-[0_35px_90px_-40px_rgba(15,23,42,0.4)]" style={{ borderColor: config.theme.border }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.94fr_1.06fr]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #fffaf5 0%, #ffffff 52%, #eefcf5 100%)' }}>
              <div className="absolute -left-16 top-0 h-48 w-48 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.secondary }} />
              <div className="absolute right-0 top-24 h-52 w-52 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.primary }} />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                  <div>
                    <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>
                      {config.labels.heroBadge}
                    </span>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: config.theme.primary }}>
                      Sabores em destaque
                    </p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.98]" style={{ color: '#26162f' }}>
                  {heroTitle}
                </h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#645261' }}>
                  {heroSubtitle}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {summaryCards.map(({ icon: Icon, text }) => (
                    <HeroInfoPill key={text} icon={Icon} text={text} />
                  ))}
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.7rem] border bg-white/92 p-5 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.35)]" style={{ borderColor: config.theme.border }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.primary }}>Destaque de hoje</p>
                    <h3 className="mt-3 text-xl font-black" style={{ color: '#26162f' }}>{leadProduct?.nome || storeName}</h3>
                    <p className="mt-2 text-sm" style={{ color: '#645261' }}>
                      {leadProduct ? `Peça em evidência por ${money(leadProduct.preco)}.` : 'Favoritos escolhidos para começar sua experiência com mais vontade.'}
                    </p>
                  </div>
                  <div className="rounded-[1.7rem] border p-5" style={{ borderColor: config.theme.border, backgroundColor: 'rgba(255,255,255,0.75)' }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.secondary }}>Escolha com mais clareza</p>
                    <p className="mt-3 text-sm leading-relaxed" style={{ color: '#645261' }}>
                      {hasText(config.labels.minOrderText) ? config.labels.minOrderText : 'Favoritos organizados para você decidir com mais rapidez.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(31,122,84,0.08) 0%, rgba(255,255,255,0.94) 42%, rgba(83,45,33,0.08) 100%)' }}>
              <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'fashion') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.7rem] border bg-white shadow-[0_38px_100px_-44px_rgba(15,23,42,0.44)]" style={{ borderColor: config.theme.border }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #fbf6f2 0%, #fffdfd 52%, #f4ebff 100%)' }}>
              <div className="absolute -left-10 top-10 h-40 w-40 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.secondary }} />
              <div className="absolute right-0 bottom-0 h-52 w-52 rounded-full blur-3xl opacity-15" style={{ backgroundColor: config.theme.primary }} />
              <div className="absolute left-8 top-8 h-28 w-28 rounded-full border opacity-30" style={{ borderColor: config.theme.primary }} />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                  <div>
                    <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>
                      {config.labels.heroBadge}
                    </span>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: config.theme.primary }}>
                      Lançamentos em destaque
                    </p>
                  </div>
                </div>
                <div className="mt-8 max-w-xl">
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.94]" style={{ color: '#2b1649' }}>
                    {heroTitle}
                  </h1>
                  <p className="mt-4 text-base sm:text-lg leading-relaxed" style={{ color: '#6b5b7d' }}>
                    {heroSubtitle}
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {summaryCards.map(({ icon: Icon, text }) => (
                    <HeroInfoPill key={text} icon={Icon} text={text} />
                  ))}
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.75rem] border bg-white/92 p-5 shadow-[0_24px_65px_-42px_rgba(15,23,42,0.34)]" style={{ borderColor: config.theme.border }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.32em]" style={{ color: config.theme.primary }}>Peça que chama atenção</p>
                    <h3 className="mt-3 text-xl font-black" style={{ color: '#2b1649' }}>{leadProduct?.nome || storeName}</h3>
                    <p className="mt-2 text-sm" style={{ color: '#6b5b7d' }}>
                      {leadProduct ? `A partir de ${money(leadProduct.preco)} para abrir sua coleção com força.` : 'Seleção pensada para começar sua visita pelos looks mais desejados.'}
                    </p>
                  </div>
                  <div className="rounded-[1.75rem] border p-5" style={{ borderColor: config.theme.border, backgroundColor: 'rgba(255,255,255,0.74)' }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.32em]" style={{ color: config.theme.secondary }}>Categorias em foco</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(heroCategories.length ? heroCategories : ['Coleção premium', 'Novidades']).map((label) => (
                        <span key={label} className="rounded-full border px-3 py-1.5 text-xs font-black" style={{ borderColor: config.theme.border, color: '#4c1d95', backgroundColor: '#ffffff' }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.8) 0%, rgba(233,213,255,0.56) 100%)' }}>
              <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'electronics') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto rounded-[2.55rem] overflow-hidden border shadow-[0_35px_100px_-44px_rgba(2,6,23,0.85)]" style={{ borderColor: '#182237', backgroundColor: '#020817', color: 'white' }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #050d1f 0%, #0f172a 55%, #07111f 100%)' }}>
              <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-60" />
              <div className="absolute -left-14 top-14 h-44 w-44 rounded-full blur-3xl opacity-25" style={{ backgroundColor: '#38bdf8' }} />
              <div className="absolute right-0 bottom-0 h-56 w-56 rounded-full blur-3xl opacity-20" style={{ backgroundColor: '#8b5cf6' }} />
              <div className="relative z-10">
                <div className="flex items-center gap-4">
                  <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                  <div>
                    <p className="text-[11px] uppercase font-black tracking-[0.36em] text-cyan-300">{config.labels.heroBadge}</p>
                    <h1 className="mt-3 text-3xl sm:text-4xl font-black">{storeName}</h1>
                  </div>
                </div>
                <h2 className="mt-8 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.98]">{heroTitle}</h2>
                <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300">{heroSubtitle}</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map(({ icon: Icon, text }) => (
                    <div key={text} className="rounded-[1.5rem] border px-4 py-4 backdrop-blur-sm" style={{ borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(8,15,30,0.56)' }}>
                      <Icon className="w-5 h-5 text-cyan-300" />
                      <p className="mt-3 text-sm font-bold text-white/92">{text}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-7 rounded-[1.75rem] border p-5" style={{ borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(8,15,30,0.56)' }}>
                  <p className="text-[11px] uppercase font-black tracking-[0.32em] text-cyan-300">Produto em evidência</p>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-lg line-clamp-2">{leadProduct?.nome || storeName}</p>
                      <p className="mt-1 text-sm text-slate-300">{leadProduct ? `Código ${leadProduct.codigo}` : 'Confira o destaque que abriu a seleção da semana.'}</p>
                    </div>
                    {leadProduct && <p className="text-xl font-black text-cyan-300">{money(leadProduct.preco)}</p>}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(2,8,23,1) 0%, rgba(15,23,42,0.96) 100%)' }}>
              <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'services') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[0.96fr_1.04fr] gap-4">
          <div className="relative overflow-hidden rounded-[2.35rem] border bg-white p-7 sm:p-8 lg:p-10 shadow-[0_30px_85px_-44px_rgba(15,23,42,0.42)]" style={{ borderColor: config.theme.border }}>
            <div className="absolute -right-12 top-0 h-48 w-48 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.primary }} />
            <div className="absolute left-0 bottom-0 h-44 w-44 rounded-full blur-3xl opacity-15" style={{ backgroundColor: config.theme.secondary }} />
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                <div>
                  <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>{config.labels.heroBadge}</span>
                  <p className="mt-3 text-[11px] font-black uppercase tracking-[0.34em]" style={{ color: config.theme.primary }}>Soluções em destaque</p>
                </div>
              </div>
              <h1 className="mt-8 max-w-xl text-4xl sm:text-5xl font-black leading-tight" style={{ color: '#172554' }}>{heroTitle}</h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#475569' }}>{heroSubtitle}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {summaryCards.map(({ icon: Icon, text }) => (
                  <HeroInfoPill key={text} icon={Icon} text={text} />
                ))}
              </div>
              <div className="mt-8 space-y-3">
                {[
                  'Escolha a solução ideal para sua necessidade.',
                  'Envie o contexto pelo WhatsApp em poucos toques.',
                  'Receba retorno com mais clareza e rapidez.',
                ].map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-[1.5rem] border bg-white/88 p-4" style={{ borderColor: config.theme.border }}>
                    <div className="w-9 h-9 rounded-2xl text-white flex items-center justify-center font-black shrink-0" style={{ backgroundColor: index === 1 ? config.theme.secondary : config.theme.primary }}>
                      {index + 1}
                    </div>
                    <p className="font-bold text-sm leading-relaxed" style={{ color: '#334155' }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 lg:p-6 rounded-[2.35rem] border shadow-[0_30px_85px_-44px_rgba(15,23,42,0.42)]" style={{ borderColor: config.theme.border, background: 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(224,231,255,0.92) 100%)' }}>
            <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'beauty') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.55rem] border bg-white shadow-[0_36px_95px_-44px_rgba(15,23,42,0.4)]" style={{ borderColor: config.theme.border }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #fff7fb 0%, #fffbfd 52%, #f3e8ff 100%)' }}>
              <div className="absolute left-10 top-10 h-32 w-32 rounded-full border opacity-30" style={{ borderColor: config.theme.secondary }} />
              <div className="absolute right-0 bottom-0 h-52 w-52 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.secondary }} />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                  <div>
                    <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>{config.labels.heroBadge}</span>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: config.theme.secondary }}>Curadoria delicada</p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.96]" style={{ color: '#581c87' }}>{heroTitle}</h1>
                <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: '#7c3f75' }}>{heroSubtitle}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {summaryCards.map(({ icon: Icon, text }) => (
                    <HeroInfoPill key={text} icon={Icon} text={text} />
                  ))}
                </div>
                <div className="mt-8 rounded-[1.75rem] border bg-white/88 p-5" style={{ borderColor: config.theme.border }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.32em]" style={{ color: config.theme.secondary }}>Categorias em destaque</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(heroCategories.length ? heroCategories : ['Lançamentos', 'Kits', 'Favoritos']).map((label) => (
                      <span key={label} className="rounded-full px-3 py-1.5 text-xs font-black text-white" style={{ backgroundColor: label === heroCategories[1] ? config.theme.secondary : config.theme.primary }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(255,214,236,0.52) 100%)' }}>
              <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === 'market') {
    return (
      <section className="px-4 pt-6">
        <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.45rem] border bg-white shadow-[0_34px_90px_-42px_rgba(15,23,42,0.34)]" style={{ borderColor: config.theme.border }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #f6fff8 0%, #ffffff 52%, #effcf3 100%)' }}>
              <div className="absolute left-0 top-0 h-full w-1.5 rounded-r-full" style={{ backgroundColor: config.theme.primary }} />
              <div className="absolute right-0 top-8 h-44 w-44 rounded-full blur-3xl opacity-15" style={{ backgroundColor: config.theme.primary }} />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                  <div>
                    <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>{config.labels.heroBadge}</span>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: config.theme.primary }}>Busca simples e compra rápida</p>
                  </div>
                </div>
                <h1 className="mt-8 max-w-xl text-4xl sm:text-5xl font-black leading-tight" style={{ color: '#14532d' }}>{heroTitle}</h1>
                <p className="mt-4 max-w-xl text-base leading-relaxed" style={{ color: '#365314' }}>{heroSubtitle}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {summaryCards.map(({ icon: Icon, text }) => (
                    <HeroInfoPill key={text} icon={Icon} text={text} />
                  ))}
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.7rem] border bg-white/92 p-5" style={{ borderColor: config.theme.border }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.primary }}>Oferta de abertura</p>
                    <h3 className="mt-3 text-xl font-black" style={{ color: '#14532d' }}>{leadProduct?.nome || storeName}</h3>
                    <p className="mt-2 text-sm" style={{ color: '#365314' }}>{leadProduct ? `Destaque visível por ${money(leadProduct.preco)}.` : 'Comece pelos itens mais procurados da loja.'}</p>
                  </div>
                  <div className="rounded-[1.7rem] border p-5" style={{ borderColor: config.theme.border, backgroundColor: 'rgba(255,255,255,0.74)' }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.secondary }}>Corredores em foco</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(heroCategories.length ? heroCategories : ['Ofertas', 'Mais vendidos']).map((label) => (
                        <span key={label} className="rounded-full border px-3 py-1.5 text-xs font-black" style={{ borderColor: config.theme.border, color: '#14532d', backgroundColor: 'white' }}>{label}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.82) 0%, rgba(220,252,231,0.8) 100%)' }}>
              <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto overflow-hidden rounded-[2.45rem] border bg-white shadow-[0_34px_90px_-42px_rgba(15,23,42,0.38)]" style={{ borderColor: config.theme.border }}>
        <div className="grid grid-cols-1 lg:grid-cols-[0.94fr_1.06fr]">
          <div className="relative overflow-hidden px-6 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-10" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #faf8ff 52%, #f1f5ff 100%)' }}>
            <div className="absolute -left-10 top-0 h-44 w-44 rounded-full blur-3xl opacity-15" style={{ backgroundColor: config.theme.primary }} />
            <div className="absolute right-0 bottom-0 h-56 w-56 rounded-full blur-3xl opacity-20" style={{ backgroundColor: config.theme.secondary }} />
            <div className="relative z-10">
              <div className="flex items-start gap-4">
                <StoreLogo logoUrl={payload.store.logoUrl} storeName={storeName} color={config.theme.primary} />
                <div>
                  <span className="inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase text-white" style={{ backgroundColor: config.theme.primary }}>{config.labels.heroBadge}</span>
                  <p className="mt-3 text-[11px] font-black uppercase tracking-[0.35em]" style={{ color: config.theme.primary }}>
                    Lançamentos e favoritos
                  </p>
                </div>
              </div>
              <h1 className="mt-8 max-w-xl text-4xl sm:text-5xl lg:text-6xl font-black leading-[0.96]" style={{ color: '#1e1b4b' }}>
                {heroTitle}
              </h1>
              <p className="mt-4 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: '#475569' }}>
                {heroSubtitle}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {summaryCards.map(({ icon: Icon, text }) => (
                  <HeroInfoPill key={text} icon={Icon} text={text} />
                ))}
              </div>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.7rem] border bg-white/92 p-5" style={{ borderColor: config.theme.border }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.primary }}>Produto principal</p>
                  <h3 className="mt-3 text-xl font-black" style={{ color: '#1e1b4b' }}>{leadProduct?.nome || storeName}</h3>
                  <p className="mt-2 text-sm" style={{ color: '#475569' }}>{leadProduct ? `Destaque inicial por ${money(leadProduct.preco)}.` : 'Seleção pensada para começar sua navegação com os queridinhos da vitrine.'}</p>
                </div>
                <div className="rounded-[1.7rem] border p-5" style={{ borderColor: config.theme.border, backgroundColor: 'rgba(255,255,255,0.76)' }}>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.secondary }}>Linhas em destaque</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(heroCategories.length ? heroCategories : ['Destaques', 'Novidades']).map((label) => (
                      <span key={label} className="rounded-full border px-3 py-1.5 text-xs font-black" style={{ borderColor: config.theme.border, color: '#312e81', backgroundColor: '#ffffff' }}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="p-4 sm:p-5 lg:p-6" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.84) 0%, rgba(224,231,255,0.78) 100%)' }}>
            <HeroMediaPanel layout={layout} config={config} bannerStyle={bannerStyle} bannerUrl={payload.store.bannerUrl} storeName={storeName} products={products} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CategoryRail({
  layout,
  config,
  section,
  categoryChips,
  activeCategory,
  onCategory,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  section: StorefrontSection;
  categoryChips: Array<{ name: string; label: string; featured: boolean }>;
  activeCategory: string;
  onCategory: (value: string) => void;
}) {
  const isSidebar = config.layoutSettings.categoryMenuStyle === 'sidebar' && layout === 'restaurant';

  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className={`${isSidebar ? 'rounded-[1.7rem] border bg-white p-4 shadow-sm' : 'flex gap-2 overflow-x-auto pb-2'}`} style={isSidebar ? { borderColor: config.theme.border } : undefined}>
          <button
            onClick={() => onCategory(ALL_CATEGORY_KEY)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-black border transition-all ${activeCategory === ALL_CATEGORY_KEY ? 'text-white' : ''}`}
            style={activeCategory === ALL_CATEGORY_KEY ? { backgroundColor: config.theme.primary, borderColor: config.theme.primary } : { borderColor: config.theme.border, color: config.theme.text, backgroundColor: config.theme.surface }}
          >
            Todas
          </button>
          {categoryChips.map((chip) => (
            <button
              data-store-category
              key={chip.name}
              onClick={() => onCategory(chip.name)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-black border transition-all ${activeCategory === chip.name ? 'text-white' : ''}`}
              style={activeCategory === chip.name ? { backgroundColor: config.theme.secondary, borderColor: config.theme.secondary } : { borderColor: config.theme.border, color: chip.featured ? config.theme.primary : config.theme.text, backgroundColor: config.theme.surface }}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function SearchAndFilters({
  layout,
  config,
  section,
  query,
  activeFilter,
  onQuery,
  onFilter,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  section: StorefrontSection;
  query: string;
  activeFilter: 'todos' | 'disponiveis' | 'promos' | 'envio';
  onQuery: (value: string) => void;
  onFilter: (value: 'todos' | 'disponiveis' | 'promos' | 'envio') => void;
}) {
  const filters: Array<{ key: 'todos' | 'disponiveis' | 'promos' | 'envio'; label: string }> = [
    { key: 'todos', label: 'Todos' },
    { key: 'disponiveis', label: 'Disponíveis' },
    { key: 'promos', label: 'Ofertas' },
    { key: 'envio', label: 'Com envio' },
  ];

  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className={`grid gap-3 ${layout === 'services' ? 'grid-cols-1 lg:grid-cols-[1fr_1fr]' : 'grid-cols-1 lg:grid-cols-[1fr_auto]'}`}>
          {config.layoutSettings.showSearch && (
            <div className="h-14 rounded-2xl border flex items-center gap-3 px-4 shadow-sm" style={{ backgroundColor: config.theme.surface, borderColor: config.theme.border }}>
              <Search className="w-5 h-5" style={{ color: config.theme.primary }} />
              <input
                value={query}
                onChange={(event) => onQuery(event.target.value)}
                placeholder={config.labels.searchPlaceholder}
                className="flex-1 h-full outline-none bg-transparent text-sm"
              />
            </div>
          )}
          {config.layoutSettings.showFilters && (
            <div className="flex gap-2 overflow-x-auto">
              {filters.map((filter) => (
                <button
                  data-store-filter
                  key={filter.key}
                  onClick={() => onFilter(filter.key)}
                  className={`h-14 shrink-0 rounded-2xl border px-4 text-xs font-black flex items-center gap-2 ${activeFilter === filter.key ? 'text-white' : ''}`}
                  style={activeFilter === filter.key ? { backgroundColor: config.theme.primary, borderColor: config.theme.primary } : { backgroundColor: config.theme.surface, borderColor: config.theme.border, color: config.theme.text }}
                >
                  {filter.key === 'todos' ? <SlidersHorizontal className="w-4 h-4" /> : <Filter className="w-4 h-4" />}
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FeaturedSection({
  layout,
  config,
  section,
  products,
  onDetails,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  section: StorefrontSection;
  products: ProductWithMeta[];
  onDetails: (product: ProductWithMeta) => void;
}) {
  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        {(hasText(config.labels.featuredTitle) || hasText(config.labels.featuredSubtitle)) && (
          <div className="mb-4">
            {hasText(config.labels.featuredTitle) && (
              <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: config.theme.primary }}>
                {config.labels.featuredTitle}
              </p>
            )}
            {hasText(config.labels.featuredSubtitle) && (
              <p className="text-sm mt-1" style={{ color: config.theme.muted }}>
                {config.labels.featuredSubtitle}
              </p>
            )}
          </div>
        )}
        <div className={`grid gap-4 ${layout === 'fashion' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'}`}>
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => onDetails(product)}
              className="text-left rounded-[1.7rem] border overflow-hidden bg-white shadow-sm hover:-translate-y-0.5 transition-transform"
              style={{ borderColor: config.theme.border }}
            >
              <div className="aspect-[4/3] bg-zinc-100">
                {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-10 h-10" /></div>}
              </div>
              <div className="p-4">
                <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: config.theme.primary }}>{product.primaryCategory}</p>
                <h3 className="mt-2 font-black line-clamp-2">{product.nome}</h3>
                <p className="mt-3 font-black text-lg" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCollectionSection({
  layout,
  config,
  section,
  products,
  allCount,
  onDetails,
  onBuy,
  onAdd,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  section: StorefrontSection;
  products: ProductWithMeta[];
  allCount: number;
  onDetails: (product: ProductWithMeta) => void;
  onBuy: (product: ProductWithMeta) => void;
  onAdd: (product: ProductWithMeta) => void;
}) {
  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black">{config.labels.homeTitle}</h2>
            <p className="text-sm mt-1" style={{ color: config.theme.muted }}>{products.length} de {allCount} {config.labels.homeSubtitle}</p>
          </div>
        </div>

        {!products.length ? (
          <div className="rounded-[1.7rem] bg-white border p-10 text-center" style={{ borderColor: config.theme.border }}>
            <Search className="w-10 h-10 mx-auto text-zinc-300" />
            <p className="mt-3 font-black text-lg">Nenhum produto encontrado</p>
            <p className="text-sm text-zinc-500 mt-1">Ajuste a busca ou escolha outra categoria.</p>
          </div>
        ) : (
          <div className={productCollectionGrid(layout)}>
            {products.map((product, index) => (
              <React.Fragment key={product.id}>
                <ProductCard
                  product={product}
                  layout={layout}
                  config={config}
                  featured={index === 0 && layout === 'fashion'}
                  onDetails={onDetails}
                  onBuy={onBuy}
                  onAdd={onAdd}
                />
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AboutSection({ layout, config, section }: { layout: StoreLayoutType; config: StorefrontConfig; section: StorefrontSection }) {
  if (!hasText(config.labels.aboutTitle) && !hasText(config.labels.aboutText)) return null;
  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto rounded-[1.9rem] overflow-hidden border shadow-sm" style={{ borderColor: config.theme.border, backgroundColor: config.theme.surface }}>
        <div className={`grid gap-0 ${layout === 'fashion' ? 'grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]' : 'grid-cols-1 lg:grid-cols-[0.95fr_1.05fr]'}`}>
          <div className="p-7 sm:p-9" style={{ backgroundColor: config.theme.card }}>
            {hasText(config.labels.aboutTitle) && <h3 className="text-3xl font-black">{config.labels.aboutTitle}</h3>}
            {hasText(config.labels.aboutText) && <p className={`${hasText(config.labels.aboutTitle) ? 'mt-4' : ''} leading-relaxed`} style={{ color: config.theme.muted }}>{config.labels.aboutText}</p>}
          </div>
          <div className="p-7 sm:p-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              config.labels.deliveryText,
              config.labels.contactText,
              config.labels.minOrderText,
              config.labels.footerNote,
            ].filter(item => hasText(item)).map((item) => (
              <div key={item} className="rounded-2xl border p-4" style={{ borderColor: config.theme.border, backgroundColor: config.theme.card }}>
                <p className="text-sm font-bold leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BenefitsSection({ layout, config, section }: { layout: StoreLayoutType; config: StorefrontConfig; section: StorefrontSection }) {
  if (!hasText(config.labels.benefitsTitle) && !hasText(config.labels.benefitsText)) return null;
  const cards = config.labels.benefitsText
    .split(/[.;]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <section className="px-4 pt-6">
      <div className="max-w-7xl mx-auto">
        {hasText(config.labels.benefitsTitle) && <h3 className="mb-4 text-2xl sm:text-3xl font-black">{config.labels.benefitsTitle}</h3>}
        <div className={`grid gap-4 ${layout === 'restaurant' || layout === 'services' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'}`}>
          {cards.map((item, index) => (
            <div key={item} className="rounded-[1.6rem] border p-5 shadow-sm" style={{ borderColor: config.theme.border, backgroundColor: index % 2 === 0 ? config.theme.surface : config.theme.card }}>
              <div className="w-11 h-11 rounded-2xl text-white flex items-center justify-center font-black" style={{ backgroundColor: index % 2 === 0 ? config.theme.primary : config.theme.secondary }}>{index + 1}</div>
              <h3 className="mt-4 font-black text-lg">{config.labels.benefitsTitle}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: config.theme.muted }}>{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterSection({ config }: { config: StorefrontConfig }) {
  if (!hasText(config.labels.footerNote)) return null;
  return (
    <section className="px-4 pt-6 pb-10">
      <div className="max-w-7xl mx-auto rounded-[1.6rem] px-6 py-5 text-center text-sm font-bold border" style={{ backgroundColor: config.theme.surface, borderColor: config.theme.border, color: config.theme.muted }}>
        {config.labels.footerNote}
      </div>
    </section>
  );
}

function PreviewCanvasFrame({
  itemId,
  label,
  selected,
  onSelect,
  onMove,
  draggingItemId,
  setDraggingItemId,
  children,
}: {
  itemId: string;
  label: string;
  selected: boolean;
  onSelect?: (elementId: string) => void;
  onMove?: (draggedElementId: string, targetElementId: string) => void;
  draggingItemId: string | null;
  setDraggingItemId: React.Dispatch<React.SetStateAction<string | null>>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative rounded-[2rem] transition-all ${selected ? 'ring-2 ring-violet-400/80 ring-offset-2 ring-offset-slate-950' : 'hover:ring-1 hover:ring-white/20'}`}
    >
      <div
        className="absolute inset-0 z-10 rounded-[2rem] cursor-grab active:cursor-grabbing"
        onClick={() => onSelect?.(itemId)}
        draggable
        onDragStart={() => setDraggingItemId(itemId)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => {
          if (!draggingItemId || draggingItemId === itemId) return;
          onMove?.(draggingItemId, itemId);
          setDraggingItemId(null);
        }}
        onDragEnd={() => setDraggingItemId(null)}
      />
      <div className="pointer-events-none absolute left-6 top-4 z-20">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-slate-950/90 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-violet-100 shadow-lg">
          <GripVertical className="w-3.5 h-3.5" />
          <span>{label || itemId}</span>
        </div>
      </div>
      {children}
    </div>
  );
}

function productCollectionGrid(layout: StoreLayoutType) {
  if (layout === 'restaurant' || layout === 'services') return 'grid grid-cols-1 gap-4';
  if (layout === 'market') return 'grid grid-cols-1 lg:grid-cols-2 gap-4';
  if (layout === 'fashion') return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5';
  return 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4';
}

function ProductCard({
  product,
  layout,
  config,
  featured,
  onDetails,
  onBuy,
  onAdd,
}: {
  product: ProductWithMeta;
  layout: StoreLayoutType;
  config: StorefrontConfig;
  featured?: boolean;
  onDetails: (product: ProductWithMeta) => void;
  onBuy: (product: ProductWithMeta) => void;
  onAdd: (product: ProductWithMeta) => void;
}) {
  if (layout === 'restaurant' || layout === 'services') {
    return (
      <article className="rounded-[1.8rem] border bg-white overflow-hidden shadow-sm" style={{ borderColor: config.theme.border }}>
        <div className="grid grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr]">
          <button onClick={() => onDetails(product)} className="bg-zinc-100 min-h-[160px]">
            {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-10 h-10" /></div>}
          </button>
          <div className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase" style={{ backgroundColor: config.theme.card, color: config.theme.primary }}>{product.primaryCategory}</span>
                {product.promo && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-600">Destaque</span>}
              </div>
              <h3 className="mt-3 text-lg font-black">{product.nome}</h3>
              <p className="mt-2 text-sm line-clamp-2" style={{ color: config.theme.muted }}>{product.descricao}</p>
            </div>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: config.theme.muted }}>{config.labels.offerLabel}</p>
                <p className="text-2xl font-black" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => onAdd(product)} disabled={product.estoque <= 0} className="h-11 px-4 rounded-2xl border font-black text-sm disabled:opacity-40" style={{ borderColor: config.theme.primary, color: config.theme.primary }}>
                  {config.labels.addCartText}
                </button>
                <button onClick={() => onBuy(product)} disabled={product.estoque <= 0} className="h-11 px-4 rounded-2xl text-white font-black text-sm disabled:opacity-40" style={{ backgroundColor: config.theme.primary }}>
                  {config.labels.buyNowText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (layout === 'market') {
    return (
      <article className="rounded-[1.7rem] border bg-white p-3 shadow-sm" style={{ borderColor: config.theme.border }}>
        <div className="grid grid-cols-[112px_1fr] gap-4">
          <button onClick={() => onDetails(product)} className="rounded-2xl overflow-hidden bg-zinc-100 aspect-square">
            {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-8 h-8" /></div>}
          </button>
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full px-2 py-1 text-[10px] font-black uppercase" style={{ backgroundColor: config.theme.card, color: config.theme.primary }}>{product.primaryCategory}</span>
                <h3 className="mt-2 font-black text-base line-clamp-2">{product.nome}</h3>
              </div>
              {config.layoutSettings.showStock && (
                <span className="text-[10px] font-black px-2 py-1 rounded-full" style={{ backgroundColor: config.theme.card, color: config.theme.muted }}>
                  {product.estoque} un.
                </span>
              )}
            </div>
            <p className="mt-2 text-sm line-clamp-2" style={{ color: config.theme.muted }}>{product.descricao}</p>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xl font-black" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
              <div className="flex gap-2">
                <button onClick={() => onAdd(product)} disabled={product.estoque <= 0} className="w-10 h-10 rounded-xl text-white disabled:opacity-40" style={{ backgroundColor: config.theme.secondary }}>
                  <Plus className="w-4 h-4 mx-auto" />
                </button>
                <button onClick={() => onBuy(product)} disabled={product.estoque <= 0} className="px-4 h-10 rounded-xl text-white text-xs font-black disabled:opacity-40" style={{ backgroundColor: config.theme.primary }}>
                  {config.labels.buyNowText}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (layout === 'fashion') {
    return (
      <article className={`rounded-[1.9rem] overflow-hidden border bg-white shadow-sm ${featured ? 'md:col-span-2 xl:col-span-2' : ''}`} style={{ borderColor: config.theme.border }}>
        <button onClick={() => onDetails(product)} className="block w-full text-left">
          <div className={`${featured ? 'aspect-[16/9]' : 'aspect-[4/5]'} bg-zinc-100 relative overflow-hidden`}>
            {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-12 h-12" /></div>}
            <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase" style={{ color: config.theme.primary }}>{product.primaryCategory}</div>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black line-clamp-2">{product.nome}</h3>
                <p className="mt-2 text-sm line-clamp-2" style={{ color: config.theme.muted }}>{product.descricao}</p>
              </div>
              <Heart className="w-5 h-5 shrink-0" style={{ color: config.theme.primary }} />
            </div>
            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-2xl font-black" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: config.theme.primary }}>Ver detalhes</span>
            </div>
          </div>
        </button>
        <div className="px-5 pb-5 grid grid-cols-[1fr_52px] gap-2">
          <button onClick={() => onBuy(product)} disabled={product.estoque <= 0} className="h-12 rounded-2xl text-white font-black text-sm disabled:opacity-40" style={{ backgroundColor: config.theme.primary }}>
            {config.labels.buyNowText}
          </button>
          <button onClick={() => onAdd(product)} disabled={product.estoque <= 0} className="h-12 rounded-2xl text-white disabled:opacity-40" style={{ backgroundColor: config.theme.secondary }}>
            <Plus className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </article>
    );
  }

  if (layout === 'electronics') {
    return (
      <article className="rounded-[1.8rem] overflow-hidden border bg-white shadow-sm" style={{ borderColor: config.theme.border }}>
        <button onClick={() => onDetails(product)} className="block w-full text-left">
          <div className="aspect-[16/11] bg-slate-100 relative overflow-hidden">
            {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-12 h-12" /></div>}
            <div className="absolute left-4 top-4 right-4 flex justify-between gap-3">
              <span className="rounded-full bg-slate-950/85 px-3 py-1 text-[10px] font-black uppercase text-cyan-200">{product.primaryCategory}</span>
              <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase" style={{ color: config.theme.primary }}>Cod. {product.codigo}</span>
            </div>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-black line-clamp-2">{product.nome}</h3>
              {config.layoutSettings.showRatings && (
                <span className="inline-flex items-center gap-1 text-xs font-black text-amber-500">
                  <Star className="w-3.5 h-3.5 fill-amber-400" /> 4.9
                </span>
              )}
            </div>
            <p className="mt-2 text-sm line-clamp-3" style={{ color: config.theme.muted }}>{product.descricao}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider" style={{ color: config.theme.muted }}>{config.labels.offerLabel}</p>
                <p className="text-2xl font-black" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
              </div>
              {config.layoutSettings.showStock && (
                <span className="rounded-full px-3 py-1 text-[10px] font-black" style={{ backgroundColor: config.theme.card, color: config.theme.primary }}>{product.estoque} un.</span>
              )}
            </div>
          </div>
        </button>
        <div className="px-5 pb-5 grid grid-cols-[1fr_52px] gap-2">
          <button onClick={() => onBuy(product)} disabled={product.estoque <= 0} className="h-12 rounded-2xl text-white font-black text-sm disabled:opacity-40" style={{ backgroundColor: config.theme.primary }}>
            {config.labels.buyNowText}
          </button>
          <button onClick={() => onAdd(product)} disabled={product.estoque <= 0} className="h-12 rounded-2xl text-white disabled:opacity-40" style={{ backgroundColor: config.theme.secondary }}>
            <Plus className="w-4 h-4 mx-auto" />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[1.7rem] overflow-hidden border bg-white shadow-sm group" style={{ borderColor: config.theme.border }}>
      <button onClick={() => onDetails(product)} className="block w-full text-left">
        <div className="aspect-[4/3] bg-zinc-100 relative overflow-hidden">
          {product.foto_path ? <img src={product.foto_path} alt={product.nome} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="w-full h-full flex items-center justify-center text-zinc-300"><ShoppingBag className="w-12 h-12" /></div>}
          <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[10px] font-black uppercase" style={{ color: config.theme.primary }}>{product.primaryCategory}</div>
          {product.estoque <= 0 && (
            <div className="absolute inset-0 bg-zinc-950/65 flex items-center justify-center text-white text-xs font-black uppercase">
              Esgotado
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-black text-base leading-tight min-h-10">{product.nome}</h3>
            {config.layoutSettings.showRatings && (
              <span className="inline-flex items-center gap-1 text-xs font-black text-amber-500">
                <Star className="w-3.5 h-3.5 fill-amber-400" /> 4.9
              </span>
            )}
          </div>
          <p className="mt-2 text-xs line-clamp-2 min-h-8" style={{ color: config.theme.muted }}>{product.descricao}</p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-black uppercase" style={{ color: config.theme.muted }}>Preço</p>
              <p className="text-xl font-black" style={{ color: config.theme.secondary }}>{money(product.preco)}</p>
            </div>
            <span className="text-[11px] font-bold inline-flex items-center gap-1" style={{ color: config.theme.primary }}>
              Detalhes <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </button>
      <div className="px-4 pb-4 grid grid-cols-[1fr_44px] gap-2">
        <button
          disabled={product.estoque <= 0}
          onClick={() => onBuy(product)}
          className="h-11 rounded-2xl disabled:bg-zinc-300 disabled:cursor-not-allowed text-white text-xs font-black"
          style={product.estoque > 0 ? { backgroundColor: config.theme.primary } : undefined}
        >
          {config.labels.buyNowText}
        </button>
        <button
          disabled={product.estoque <= 0}
          onClick={() => onAdd(product)}
          className="h-11 rounded-2xl disabled:bg-zinc-300 disabled:cursor-not-allowed text-white flex items-center justify-center"
          style={product.estoque > 0 ? { backgroundColor: config.theme.secondary } : undefined}
          title="Adicionar"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </article>
  );
}

function getOrderedPageElements<TElementId extends string>(elements: StorefrontPageElement<TElementId>[]) {
  return [...elements]
    .filter(element => element.enabled)
    .sort((left, right) => left.order - right.order);
}

function ProductDetailPage({
  product,
  config,
  layout,
  quantity,
  setQuantity,
  onBack,
  onAddToCart,
  onBuyNow,
  previewEditor,
}: {
  product?: ProductWithMeta;
  config: StorefrontConfig;
  layout: StoreLayoutType;
  quantity: number;
  setQuantity: (quantity: number) => void;
  onBack: () => void;
  onAddToCart: (product: ProductWithMeta, quantity: number) => void;
  onBuyNow: (product: ProductWithMeta, quantity: number) => void;
  previewEditor?: PreviewEditorConfig;
}) {
  const [selectedImage, setSelectedImage] = useState(product?.foto_path || '');
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedImage(product?.foto_path || '');
  }, [product?.foto_path]);

  if (!product) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-10">
        <div className="rounded-[1.8rem] bg-white p-8 text-center border shadow-xl" style={{ borderColor: config.theme.border }}>
          <h2 className="text-2xl font-black">Produto não encontrado</h2>
          <p className="text-sm mt-2" style={{ color: config.theme.muted }}>Volte para a vitrine e escolha outro item.</p>
          <button onClick={onBack} className="mt-5 rounded-2xl text-white px-5 py-3 text-sm font-black" style={{ backgroundColor: config.theme.primary }}>{config.labels.detailBackText}</button>
        </div>
      </main>
    );
  }

  const subtotal = Number(product.preco || 0) * quantity;
  const gallery = [product.foto_path].filter(Boolean);
  const detailElements = getOrderedPageElements(config.productPageElements);
  const frame = (element: StorefrontPageElement<StorefrontProductElementId>, content: React.ReactNode) => {
    if (!previewEditor?.enabled) return <React.Fragment key={element.id}>{content}</React.Fragment>;
    return (
      <React.Fragment key={element.id}>
        <PreviewCanvasFrame
          itemId={element.id}
          label={element.title}
          selected={previewEditor.selectedElementId === element.id}
          onSelect={previewEditor.onSelectElement}
          onMove={previewEditor.onMoveElement}
          draggingItemId={draggingElementId}
          setDraggingItemId={setDraggingElementId}
        >
          {content}
        </PreviewCanvasFrame>
      </React.Fragment>
    );
  };

  const showcaseCard = (
    <section className={`rounded-[2rem] border shadow-sm overflow-hidden ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
      <div className={`grid grid-cols-1 ${layout === 'services' ? 'lg:grid-cols-[360px_1fr]' : 'lg:grid-cols-[420px_1fr]'} gap-0`}>
        <div className={`${layout === 'electronics' ? 'bg-slate-900' : 'bg-zinc-50'} p-4 sm:p-6`}>
          <div className="aspect-square rounded-[1.6rem] overflow-hidden bg-zinc-100 relative">
            {selectedImage ? (
              <img src={selectedImage} alt={product.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-300">
                <ShoppingBag className="w-20 h-20" />
              </div>
            )}
            <button onClick={onBack} className="absolute left-3 top-3 w-10 h-10 rounded-xl bg-white/95 flex items-center justify-center shadow" style={{ color: config.theme.primary }} title="Voltar">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {(gallery.length ? gallery : ['']).map((image, index) => (
              <button
                key={`${image}-${index}`}
                onClick={() => setSelectedImage(image)}
                className="w-20 h-20 rounded-2xl border overflow-hidden bg-zinc-100 shrink-0"
                style={selectedImage === image ? { borderColor: config.theme.primary } : { borderColor: config.theme.border }}
                title={`Imagem ${index + 1}`}
              >
                {image ? <img src={image} alt={product.nome} className="w-full h-full object-cover" /> : <ShoppingBag className="w-7 h-7 mx-auto text-zinc-300" />}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-white text-[10px] font-black uppercase" style={{ backgroundColor: config.theme.primary }}>{product.primaryCategory}</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}>Cod. {product.codigo}</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-black leading-tight">{product.nome}</h2>

          {config.layoutSettings.showRatings && (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-black" style={{ color: layout === 'electronics' ? '#67e8f9' : config.theme.primary }}>4.9</span>
              <span className="inline-flex text-amber-400">
                {Array.from({ length: 5 }).map((_, index) => <Star key={index} className="w-4 h-4 fill-amber-400" />)}
              </span>
              <span className={layout === 'electronics' ? 'text-white/70' : 'text-zinc-400'}>7,7 mil avaliações</span>
              <span className={layout === 'electronics' ? 'text-white/70' : 'text-zinc-400'}>10 mil+ vendidos</span>
            </div>
          )}

          <div className="mt-6 rounded-[1.5rem] border px-4 py-4" style={{ backgroundColor: layout === 'electronics' ? 'rgba(255,255,255,0.04)' : config.theme.card, borderColor: layout === 'electronics' ? 'rgba(255,255,255,0.08)' : config.theme.border }}>
            <p className={`text-[12px] font-bold ${layout === 'electronics' ? 'text-cyan-200' : ''}`}>{config.labels.offerLabel}</p>
            <div className="flex flex-wrap items-end gap-3">
              <span className="text-4xl font-black" style={{ color: layout === 'electronics' ? '#67e8f9' : config.theme.secondary }}>{money(product.preco)}</span>
              <span className={layout === 'electronics' ? 'text-white/70 text-sm' : 'text-zinc-500 text-sm'}>{config.labels.priceSupport}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  const specsCard = (
    <section className={`rounded-[2rem] border px-5 py-5 shadow-sm ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-y-4 text-sm">
        <span className={layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}>{config.labels.detailShippingLabel}</span>
        <span className="font-bold">{config.labels.detailShippingText}</span>
        <span className={layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}>{config.labels.detailAvailabilityLabel}</span>
        <span className="font-bold">{Number(product.estoque || 0) > 0 ? `${product.estoque} unidades em estoque` : 'Indisponível no momento'}</span>
        <span className={layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}>{config.labels.detailDescriptionLabel}</span>
        <span className={layout === 'electronics' ? 'text-white/85' : 'text-zinc-700'}>{product.descricao}</span>
      </div>
    </section>
  );

  const actionsCard = (
    <section className={`rounded-[2rem] border px-5 py-5 shadow-sm ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-sm ${layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}`}>Quantidade</span>
        <div className={`h-11 border rounded-2xl flex items-center overflow-hidden ${layout === 'electronics' ? 'border-white/10' : 'border-zinc-200'}`}>
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-11 h-full flex items-center justify-center hover:bg-white/5" title="Diminuir">
            <Minus className="w-4 h-4" />
          </button>
          <span className={`w-14 h-full border-x flex items-center justify-center font-black ${layout === 'electronics' ? 'border-white/10' : 'border-zinc-200'}`}>{quantity}</span>
          <button onClick={() => setQuantity(quantity + 1)} className="w-11 h-full flex items-center justify-center hover:bg-white/5" title="Aumentar">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <span className={`text-sm ${layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}`}>Subtotal: <strong className={layout === 'electronics' ? 'text-white' : 'text-zinc-950'}>{money(subtotal)}</strong></span>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
        <button
          disabled={product.estoque <= 0}
          onClick={() => onAddToCart(product, quantity)}
          className="h-12 rounded-2xl border disabled:opacity-40 font-black flex items-center justify-center gap-2"
          style={product.estoque > 0 ? { borderColor: config.theme.primary, color: config.theme.primary } : undefined}
        >
          <ShoppingBag className="w-5 h-5" />
          {config.labels.addCartText}
        </button>
        <button
          disabled={product.estoque <= 0}
          onClick={() => onBuyNow(product, quantity)}
          className="h-12 rounded-2xl disabled:bg-zinc-300 disabled:cursor-not-allowed text-white font-black flex items-center justify-center gap-2"
          style={product.estoque > 0 ? { backgroundColor: config.theme.primary } : undefined}
        >
          <MessageCircle className="w-5 h-5" />
          {config.labels.buyNowText}
        </button>
      </div>
    </section>
  );

  const trustCard = (
    <section className={`rounded-[2rem] border px-5 py-5 shadow-sm ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
      <div className="flex flex-wrap gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}><CheckCircle2 className="w-4 h-4 text-teal-500" /> {config.labels.contactText}</span>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-700'}`}><CheckCircle2 className="w-4 h-4 text-teal-500" /> {config.labels.minOrderText}</span>
      </div>
    </section>
  );

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-4">
        {detailElements.map((element) => {
          if (element.id === 'detail_breadcrumb') {
            return frame(element, (
              <div className="mb-1 flex items-center gap-2 text-xs" style={{ color: config.theme.muted }}>
                <button onClick={onBack} className="font-bold" style={{ color: config.theme.primary }}>{config.labels.detailBackText}</button>
                <ChevronRight className="w-3 h-3" />
                <span>{product.primaryCategory}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="truncate">{product.nome}</span>
              </div>
            ));
          }

          if (element.id === 'detail_showcase') return frame(element, showcaseCard);
          if (element.id === 'detail_specs') return frame(element, specsCard);
          if (element.id === 'detail_actions') return frame(element, actionsCard);
          if (element.id === 'detail_trust') return frame(element, trustCard);
          return null;
        })}
      </div>
    </main>
  );
}

function CartPage({
  layout,
  config,
  lines,
  total,
  onBack,
  onUpdateQuantity,
  onCheckout,
  onContinue,
  previewEditor,
}: {
  layout: StoreLayoutType;
  config: StorefrontConfig;
  lines: Array<{ product: ProductWithMeta; quantity: number }>;
  total: number;
  onBack: () => void;
  onUpdateQuantity: (codigo: string, delta: number) => void;
  onCheckout: () => void;
  onContinue: () => void;
  previewEditor?: PreviewEditorConfig;
}) {
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const cartElements = getOrderedPageElements(config.cartPageElements);
  const editorMode = !!previewEditor?.enabled;
  const linesToShow = lines.length ? lines : [];
  const totalToShow = linesToShow.reduce((sum, item) => sum + item.product.preco * item.quantity, 0);
  const wrap = (element: StorefrontPageElement<StorefrontCartElementId>, content: React.ReactNode) => {
    if (!editorMode) return <React.Fragment key={element.id}>{content}</React.Fragment>;
    return (
      <React.Fragment key={element.id}>
        <PreviewCanvasFrame
          itemId={element.id}
          label={element.title}
          selected={previewEditor.selectedElementId === element.id}
          onSelect={previewEditor.onSelectElement}
          onMove={previewEditor.onMoveElement}
          draggingItemId={draggingElementId}
          setDraggingItemId={setDraggingElementId}
        >
          {content}
        </PreviewCanvasFrame>
      </React.Fragment>
    );
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-6">
      <div className="space-y-4">
        {cartElements.map((element) => {
          if (element.id === 'cart_header') {
            return wrap(element, (
              <section className={`rounded-[2rem] border shadow-sm overflow-hidden ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
                <div className="p-5 sm:p-6 text-white flex items-center justify-between" style={{ background: config.theme.topbar }}>
                  <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center" title="Voltar">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="text-center">
                    <h2 className="text-xl font-black">{config.labels.cartTitle}</h2>
                    <p className="text-xs text-white/80">{config.labels.cartSubtitle}</p>
                  </div>
                  <div className="w-10" />
                </div>
              </section>
            ));
          }

          if (element.id === 'cart_empty') {
            if (!editorMode && lines.length > 0) return null;
            return wrap(element, (
              <section className={`rounded-[2rem] border shadow-sm px-5 py-10 ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
                <div className="py-6 text-center">
                  <ShoppingBag className="w-12 h-12 text-zinc-300 mx-auto" />
                  <h3 className="font-black text-xl mt-3">{config.labels.emptyCartTitle}</h3>
                  <p className={`text-sm mt-1 ${layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}`}>{config.labels.emptyCartText}</p>
                  <button onClick={onContinue} className="mt-5 rounded-2xl text-white px-5 py-3 text-sm font-black" style={{ backgroundColor: config.theme.primary }}>
                    {config.labels.continueText}
                  </button>
                </div>
              </section>
            ));
          }

          if (element.id === 'cart_items') {
            if (!editorMode && !lines.length) return null;
            return wrap(element, (
              <section className={`rounded-[2rem] border shadow-sm p-4 sm:p-6 space-y-4 ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
                {linesToShow.map(item => (
                  <div key={item.product.codigo} className={`grid grid-cols-[88px_1fr_auto] gap-4 rounded-[1.5rem] border p-3 ${layout === 'electronics' ? 'bg-white/5 border-white/10' : ''}`} style={layout === 'electronics' ? undefined : { borderColor: config.theme.border }}>
                    <div className="w-24 h-24 rounded-2xl bg-zinc-100 overflow-hidden shrink-0">
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
                      <p className={`text-xs mt-1 ${layout === 'electronics' ? 'text-white/60' : 'text-zinc-500'}`}>Cod. {item.product.codigo}</p>
                      <p className="text-sm font-black mt-1" style={{ color: layout === 'electronics' ? '#67e8f9' : config.theme.secondary }}>{money(item.product.preco)}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <button onClick={() => onUpdateQuantity(item.product.codigo, -1)} className={`w-8 h-8 rounded-xl flex items-center justify-center ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-800'}`} title="Diminuir">
                          {item.quantity === 1 ? <X className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-sm font-black">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.product.codigo, 1)} className={`w-8 h-8 rounded-xl flex items-center justify-center ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-800'}`} title="Aumentar">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="font-black">{money(item.product.preco * item.quantity)}</p>
                  </div>
                ))}
                {!linesToShow.length && (
                  <div className="rounded-[1.5rem] border border-dashed p-6 text-center text-sm" style={{ borderColor: config.theme.border, color: config.theme.muted }}>
                    Os itens reais aparecem aqui quando o carrinho estiver preenchido.
                  </div>
                )}
              </section>
            ));
          }

          if (element.id === 'cart_summary') {
            if (!editorMode && !lines.length) return null;
            return wrap(element, (
              <section className={`rounded-[2rem] border shadow-sm p-5 sm:p-6 ${layout === 'electronics' ? 'bg-slate-950 text-white' : 'bg-white'}`} style={{ borderColor: config.theme.border }}>
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${layout === 'electronics' ? 'text-white/70' : 'text-zinc-500'}`}>Total</span>
                  <span className="text-3xl font-black" style={{ color: layout === 'electronics' ? '#67e8f9' : config.theme.secondary }}>{money(lines.length ? total : totalToShow)}</span>
                </div>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button onClick={onContinue} className={`rounded-2xl py-4 font-black ${layout === 'electronics' ? 'bg-white/10 text-white' : 'bg-zinc-100 text-zinc-900'}`}>
                    {config.labels.continueText}
                  </button>
                  <button onClick={onCheckout} className="rounded-2xl text-white py-4 font-black flex items-center justify-center gap-2" style={{ backgroundColor: config.theme.primary }}>
                    <MessageCircle className="w-5 h-5" />
                    {config.labels.checkoutText}
                  </button>
                </div>
              </section>
            ));
          }

          return null;
        })}
      </div>
    </main>
  );
}
