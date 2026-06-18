import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  GripVertical,
  Image,
  Info,
  LayoutTemplate,
  Palette,
  Save,
  Settings2,
  Smartphone,
  Store,
  Tag,
  Type,
  Wand2,
} from 'lucide-react';
import {
  SQLProduct,
  StoreLayoutType,
  StorefrontCartElementId,
  StorefrontCategorySetting,
  StorefrontConfig,
  StorefrontEditorPageId,
  StorefrontPageElement,
  StorefrontProductElementId,
  StorefrontSection,
  StorefrontSectionId,
} from '../types';
import PublicStorefront from './PublicStorefront';
import {
  createDefaultStorefrontConfig,
  getProductSuggestionCategories,
  normalizeStorefrontConfig,
  STOREFRONT_LAYOUT_OPTIONS,
  syncCategorySettings,
  toggleCategoryOrder,
  togglePageElementOrder,
  toggleSectionOrder,
} from '../lib/storefront';

type VirtualStoreUser = {
  name: string;
  email: string;
  store_name?: string;
  store_banner_url?: string;
  store_logo_url?: string;
  store_layout?: StoreLayoutType;
  storefront_config?: StorefrontConfig | null;
};

type LeftTab = 'sections' | 'edit' | 'tools';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';
type EditorElementView = {
  id: string;
  title: string;
  subtitle: string;
  enabled: boolean;
  order: number;
  page: StorefrontEditorPageId;
};

const PAGE_LABELS: Record<StorefrontEditorPageId, string> = {
  home: 'Página da Loja',
  product: 'Página do Produto',
  cart: 'Página do Carrinho',
};

const LEFT_TABS: Array<{ key: LeftTab; label: string }> = [
  { key: 'sections', label: 'Seções' },
  { key: 'edit', label: 'Editar' },
  { key: 'tools', label: 'Ferramentas' },
];

const slugifyStoreValue = (value: string) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export default function AdminVirtualStore({
  lojista,
  products,
  storeSlug,
  onUpdateStorefront,
  standalone = false,
  onBack,
}: {
  lojista: VirtualStoreUser | null;
  products: SQLProduct[];
  storeSlug: string;
  onUpdateStorefront: (payload: {
    storeBannerUrl: string;
    storeLogoUrl: string;
    storeLayout: StoreLayoutType;
    storefrontConfig: StorefrontConfig;
  }) => void;
  standalone?: boolean;
  onBack?: () => void;
}) {
  const storeName = (lojista?.store_name || '').trim() || 'Loja sem nome';
  const [storeBannerUrl, setStoreBannerUrl] = useState(lojista?.store_banner_url || '');
  const [storeLogoUrl, setStoreLogoUrl] = useState(lojista?.store_logo_url || '');
  const [storeLayout, setStoreLayout] = useState<StoreLayoutType>(lojista?.store_layout || 'ecommerce');
  const [draftConfig, setDraftConfig] = useState<StorefrontConfig>(() => normalizeStorefrontConfig(lojista?.store_layout || 'ecommerce', storeName, products, lojista?.storefront_config));
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>('sections');
  const [canvasPage, setCanvasPage] = useState<StorefrontEditorPageId>('home');
  const [selectedElementId, setSelectedElementId] = useState<string | null>('categories');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [draggingCategoryIndex, setDraggingCategoryIndex] = useState<number | null>(null);

  useEffect(() => {
    setStoreBannerUrl(lojista?.store_banner_url || '');
    setStoreLogoUrl(lojista?.store_logo_url || '');
    setStoreLayout(lojista?.store_layout || 'ecommerce');
    setDraftConfig(normalizeStorefrontConfig(lojista?.store_layout || 'ecommerce', (lojista?.store_name || '').trim() || 'Loja sem nome', products, lojista?.storefront_config));
  }, [lojista?.store_banner_url, lojista?.store_logo_url, lojista?.store_layout, lojista?.store_name, lojista?.storefront_config, products]);

  const config = useMemo(
    () => syncCategorySettings(storeLayout, draftConfig, products, storeName),
    [draftConfig, products, storeLayout, storeName],
  );

  const categorySuggestions = useMemo(() => getProductSuggestionCategories(products, storeLayout), [products, storeLayout]);
  const resolvedStoreSlug = storeSlug || slugifyStoreValue(storeName) || 'loja';
  const publicPath = `/store/${resolvedStoreSlug}`;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${publicPath}` : publicPath;
  const editorPath = `/editor/loja/${resolvedStoreSlug}`;
  const layoutOption = STOREFRONT_LAYOUT_OPTIONS.find(option => option.key === storeLayout) || STOREFRONT_LAYOUT_OPTIONS[1];

  const pageElements = useMemo(() => getPageElements(canvasPage, config), [canvasPage, config]);
  const visibleElements = pageElements.filter(element => element.enabled).sort((a, b) => a.order - b.order);
  const hiddenElements = pageElements.filter(element => !element.enabled);
  const selectedElement = pageElements.find(element => element.id === selectedElementId) || visibleElements[0] || pageElements[0] || null;

  useEffect(() => {
    if (!pageElements.length) {
      setSelectedElementId(null);
      return;
    }
    if (!selectedElementId || !pageElements.some(element => element.id === selectedElementId)) {
      setSelectedElementId((visibleElements[0] || pageElements[0]).id);
    }
  }, [pageElements, selectedElementId, visibleElements]);

  const updateLabels = <K extends keyof StorefrontConfig['labels']>(key: K, value: StorefrontConfig['labels'][K]) => {
    setDraftConfig(prev => ({
      ...prev,
      labels: { ...prev.labels, [key]: value },
    }));
  };

  const updateTheme = <K extends keyof StorefrontConfig['theme']>(key: K, value: StorefrontConfig['theme'][K]) => {
    setDraftConfig(prev => ({
      ...prev,
      theme: { ...prev.theme, [key]: value },
    }));
  };

  const updateLayoutSettings = <K extends keyof StorefrontConfig['layoutSettings']>(key: K, value: StorefrontConfig['layoutSettings'][K]) => {
    setDraftConfig(prev => ({
      ...prev,
      layoutSettings: { ...prev.layoutSettings, [key]: value },
    }));
  };

  const updateSection = (sectionId: StorefrontSectionId, patch: Partial<StorefrontSection>) => {
    setDraftConfig(prev => ({
      ...prev,
      sections: prev.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section),
    }));
  };

  const updateCategory = (index: number, patch: Partial<StorefrontCategorySetting>) => {
    setDraftConfig(prev => ({
      ...prev,
      categorySettings: prev.categorySettings.map((category, categoryIndex) => categoryIndex === index ? { ...category, ...patch } : category),
    }));
  };

  const updateProductPageElement = (elementId: StorefrontProductElementId, patch: Partial<StorefrontPageElement<StorefrontProductElementId>>) => {
    setDraftConfig(prev => ({
      ...prev,
      productPageElements: prev.productPageElements.map((element) => element.id === elementId ? { ...element, ...patch } : element),
    }));
  };

  const updateCartPageElement = (elementId: StorefrontCartElementId, patch: Partial<StorefrontPageElement<StorefrontCartElementId>>) => {
    setDraftConfig(prev => ({
      ...prev,
      cartPageElements: prev.cartPageElements.map((element) => element.id === elementId ? { ...element, ...patch } : element),
    }));
  };

  const addCategorySetting = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (config.categorySettings.some(category => category.name.toLowerCase() === trimmed.toLowerCase())) return;
    setDraftConfig(prev => ({
      ...prev,
      categorySettings: [...prev.categorySettings, {
        name: trimmed,
        label: trimmed,
        visible: true,
        featured: false,
        order: prev.categorySettings.length,
      }],
    }));
  };

  const removeCategorySetting = (name: string) => {
    setDraftConfig(prev => ({
      ...prev,
      categorySettings: prev.categorySettings
        .filter(category => category.name !== name)
        .map((category, index) => ({ ...category, order: index })),
    }));
  };

  const toggleHighlightCode = (code: string) => {
    setDraftConfig(prev => ({
      ...prev,
      highlightCodes: prev.highlightCodes.includes(code)
        ? prev.highlightCodes.filter(item => item !== code)
        : [...prev.highlightCodes, code],
    }));
  };

  const applyLayoutPreset = (nextLayout: StoreLayoutType) => {
    setStoreLayout(nextLayout);
    setDraftConfig(prev => {
      const nextBase = createDefaultStorefrontConfig(nextLayout, storeName, products);
      return {
        ...nextBase,
        categorySettings: prev.categorySettings.length ? prev.categorySettings : nextBase.categorySettings,
        highlightCodes: prev.highlightCodes,
        hiddenProductCodes: prev.hiddenProductCodes,
        productPageElements: prev.productPageElements.length ? prev.productPageElements : nextBase.productPageElements,
        cartPageElements: prev.cartPageElements.length ? prev.cartPageElements : nextBase.cartPageElements,
      };
    });
  };

  const moveSectionById = (draggedSectionId: StorefrontSectionId, targetSectionId: StorefrontSectionId) => {
    setDraftConfig(prev => {
      const fromIndex = prev.sections.findIndex(section => section.id === draggedSectionId);
      const toIndex = prev.sections.findIndex(section => section.id === targetSectionId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return {
        ...prev,
        sections: toggleSectionOrder(prev.sections, fromIndex, toIndex),
      };
    });
    setSelectedElementId(targetSectionId);
  };

  const moveProductElementById = (draggedElementId: StorefrontProductElementId, targetElementId: StorefrontProductElementId) => {
    setDraftConfig(prev => {
      const fromIndex = prev.productPageElements.findIndex(element => element.id === draggedElementId);
      const toIndex = prev.productPageElements.findIndex(element => element.id === targetElementId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return {
        ...prev,
        productPageElements: togglePageElementOrder(prev.productPageElements, fromIndex, toIndex),
      };
    });
    setSelectedElementId(targetElementId);
  };

  const moveCartElementById = (draggedElementId: StorefrontCartElementId, targetElementId: StorefrontCartElementId) => {
    setDraftConfig(prev => {
      const fromIndex = prev.cartPageElements.findIndex(element => element.id === draggedElementId);
      const toIndex = prev.cartPageElements.findIndex(element => element.id === targetElementId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;
      return {
        ...prev,
        cartPageElements: togglePageElementOrder(prev.cartPageElements, fromIndex, toIndex),
      };
    });
    setSelectedElementId(targetElementId);
  };

  const moveCanvasElement = (page: StorefrontEditorPageId, draggedId: string, targetId: string) => {
    if (page === 'home') return moveSectionById(draggedId as StorefrontSectionId, targetId as StorefrontSectionId);
    if (page === 'product') return moveProductElementById(draggedId as StorefrontProductElementId, targetId as StorefrontProductElementId);
    return moveCartElementById(draggedId as StorefrontCartElementId, targetId as StorefrontCartElementId);
  };

  const updateSelectedElement = (patch: Partial<Pick<EditorElementView, 'title' | 'subtitle' | 'enabled'>>) => {
    if (!selectedElement) return;
    if (selectedElement.page === 'home') {
      updateSection(selectedElement.id as StorefrontSectionId, patch);
      return;
    }
    if (selectedElement.page === 'product') {
      updateProductPageElement(selectedElement.id as StorefrontProductElementId, patch);
      return;
    }
    updateCartPageElement(selectedElement.id as StorefrontCartElementId, patch);
  };

  const restoreHiddenElement = (elementId: string) => {
    if (canvasPage === 'home') return updateSection(elementId as StorefrontSectionId, { enabled: true });
    if (canvasPage === 'product') return updateProductPageElement(elementId as StorefrontProductElementId, { enabled: true });
    return updateCartPageElement(elementId as StorefrontCartElementId, { enabled: true });
  };

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalized = syncCategorySettings(storeLayout, draftConfig, products, storeName);
    onUpdateStorefront({
      storeBannerUrl,
      storeLogoUrl,
      storeLayout,
      storefrontConfig: normalized,
    });
    setDraftConfig(normalized);
    setNotice({ type: 'success', text: 'Alterações salvas. A loja pública já passa a usar a nova estrutura.' });
    setTimeout(() => setNotice(null), 3000);
  };

  const canvasWidthClass = deviceMode === 'mobile'
    ? 'max-w-[430px]'
    : deviceMode === 'tablet'
      ? 'max-w-[860px]'
      : 'max-w-[1320px]';

  if (!standalone) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-slate-900 p-8 shadow-2xl text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300 font-black">Editor dedicado</p>
            <h2 className="mt-3 text-2xl font-black">Abra a loja em modo estúdio</h2>
            <p className="mt-2 text-sm text-slate-400 max-w-2xl">
              O editor agora roda em uma página própria, sem o menu do CRM, com painel lateral, canvas visual e drag and drop direto nos elementos.
            </p>
          </div>
          <a href={editorPath} className="shrink-0 rounded-2xl bg-indigo-600 hover:bg-indigo-500 px-5 py-3 text-sm font-black inline-flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Abrir editor
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1220] text-white flex flex-col">
      <header className="h-16 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#0f172a] sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center" title="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-cyan-300 text-sm font-black">
              <Wand2 className="w-4 h-4" />
              Editor de Loja
            </div>
            <p className="text-xs text-slate-400 truncate">{storeName}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          <DeviceButton active={deviceMode === 'desktop'} onClick={() => setDeviceMode('desktop')}>Desktop</DeviceButton>
          <DeviceButton active={deviceMode === 'tablet'} onClick={() => setDeviceMode('tablet')}>Tablet</DeviceButton>
          <DeviceButton active={deviceMode === 'mobile'} onClick={() => setDeviceMode('mobile')}>Mobile</DeviceButton>
        </div>

        <div className="flex items-center gap-2">
          {notice?.type === 'success' && (
            <div className="hidden lg:flex rounded-full bg-emerald-500/15 border border-emerald-400/20 px-3 py-1 text-[11px] font-black text-emerald-200">
              Tudo salvo
            </div>
          )}
          <a href={publicUrl} target="_blank" rel="noreferrer" className="hidden sm:inline-flex rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold items-center gap-2">
            <EyeIcon />
            Ver loja
          </a>
          <button onClick={() => handleSave()} className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-black inline-flex items-center gap-2">
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="border-r border-white/10 bg-[#0d1627] flex flex-col min-h-0">
          <div className="border-b border-white/10 px-4">
            <div className="grid grid-cols-3 gap-1 py-3">
              {LEFT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setLeftTab(tab.key)}
                  className={`rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.2em] ${leftTab === tab.key ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-400/20' : 'text-slate-500 hover:text-white hover:bg-white/5 border border-transparent'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {leftTab === 'sections' && (
              <>
                <SidebarBlock title="Páginas">
                  <div className="space-y-2">
                    {(['home', 'product', 'cart'] as const).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCanvasPage(page)}
                        className={`w-full rounded-2xl border px-4 py-3 text-left ${canvasPage === page ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'}`}
                      >
                        <span className="block text-xs font-black">{PAGE_LABELS[page]}</span>
                        <span className="block mt-1 text-[11px] text-slate-400">
                          {page === 'home' ? 'Vitrine inicial com categorias e catálogo.' : page === 'product' ? 'Tela de detalhes com compra.' : 'Resumo do carrinho e checkout.'}
                        </span>
                      </button>
                    ))}
                  </div>
                </SidebarBlock>

                <SidebarBlock title="Elementos visíveis">
                  <div className="space-y-2">
                    {visibleElements.map((element, index) => (
                      <button
                        key={element.id}
                        type="button"
                        onClick={() => { setSelectedElementId(element.id); setLeftTab('edit'); }}
                        className={`w-full rounded-2xl border px-4 py-3 text-left ${selectedElement?.id === element.id ? 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-black text-cyan-200 shrink-0">
                              {element.order + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="block text-xs font-black truncate">{element.title}</span>
                              <span className="block text-[10px] text-slate-500 truncate">{element.subtitle}</span>
                            </div>
                          </div>
                          <GripVertical className="w-4 h-4 text-slate-500 shrink-0" />
                        </div>
                        <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-slate-500">Arraste no canvas</div>
                      </button>
                    ))}
                  </div>
                </SidebarBlock>

                {hiddenElements.length > 0 && (
                  <SidebarBlock title="Blocos ocultos">
                    <div className="space-y-2">
                      {hiddenElements.map((element) => (
                        <button
                          key={element.id}
                          type="button"
                          onClick={() => restoreHiddenElement(element.id)}
                          className="w-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-left text-slate-300 hover:border-cyan-400/20 hover:bg-cyan-500/5"
                        >
                          <span className="block text-xs font-black">{element.title}</span>
                          <span className="block mt-1 text-[10px] text-slate-500">Clique para recolocar no canvas.</span>
                        </button>
                      ))}
                    </div>
                  </SidebarBlock>
                )}
              </>
            )}

            {leftTab === 'edit' && (
              <SidebarBlock title="Editar elemento">
                {!selectedElement ? (
                  <p className="text-sm text-slate-400">Selecione um bloco na lista ou clique nele no canvas.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                      <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200">Elemento selecionado</p>
                      <p className="mt-2 text-sm font-black text-white">{selectedElement.title}</p>
                      <p className="mt-1 text-[11px] text-slate-300">{selectedElement.subtitle}</p>
                    </div>

                    <Field
                      label="Nome interno"
                      value={selectedElement.title}
                      onChange={(value) => updateSelectedElement({ title: value })}
                      placeholder="Título visível apenas no editor"
                    />
                    <Field
                      label="Descrição interna"
                      value={selectedElement.subtitle}
                      onChange={(value) => updateSelectedElement({ subtitle: value })}
                      placeholder="Ajuda para orientar a montagem"
                      textarea
                    />
                    <ToggleField label="Elemento ativo" checked={selectedElement.enabled} onChange={(checked) => updateSelectedElement({ enabled: checked })} />

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={selectedElement.order <= 0}
                        onClick={() => {
                          const prevElement = visibleElements.find(element => element.order === selectedElement.order - 1);
                          if (prevElement) moveCanvasElement(canvasPage, selectedElement.id, prevElement.id);
                        }}
                        className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] text-xs font-black text-white disabled:opacity-40"
                      >
                        Mover acima
                      </button>
                      <button
                        type="button"
                        disabled={selectedElement.order >= visibleElements.length - 1}
                        onClick={() => {
                          const nextElement = visibleElements.find(element => element.order === selectedElement.order + 1);
                          if (nextElement) moveCanvasElement(canvasPage, selectedElement.id, nextElement.id);
                        }}
                        className="h-11 rounded-2xl border border-white/10 bg-white/[0.03] text-xs font-black text-white disabled:opacity-40"
                      >
                        Mover abaixo
                      </button>
                    </div>
                  </div>
                )}
              </SidebarBlock>
            )}

            {leftTab === 'tools' && (
              <div className="space-y-5">
                <SidebarBlock title="Identidade da loja">
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-3 flex gap-2">
                    <Info className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                      Nome da loja: <strong>{storeName}</strong>. Esse nome segue protegido para evitar links duplicados.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Link público</span>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-1 text-sm font-bold text-indigo-300 flex items-center gap-1 truncate">
                      {publicUrl}
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </div>
                  <Field label="Banner da loja" value={storeBannerUrl} onChange={setStoreBannerUrl} placeholder="https://..." />
                  <Field label="Logo da loja" value={storeLogoUrl} onChange={setStoreLogoUrl} placeholder="https://..." />
                </SidebarBlock>

                <SidebarBlock title="Modelo e tema">
                  <div className="space-y-2">
                    {STOREFRONT_LAYOUT_OPTIONS.map((option) => {
                      const selected = option.key === storeLayout;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => applyLayoutPreset(option.key)}
                          className={`w-full rounded-2xl border p-4 text-left ${selected ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-xs font-black">{option.label}</span>
                            {selected && <Check className="w-4 h-4 text-cyan-300" />}
                          </div>
                          <p className="mt-2 text-[11px] text-slate-400">{option.title}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorField label="Cor principal" value={config.theme.primary} onChange={(value) => updateTheme('primary', value)} />
                    <ColorField label="Cor secundária" value={config.theme.secondary} onChange={(value) => updateTheme('secondary', value)} />
                    <ColorField label="Cards" value={config.theme.card} onChange={(value) => updateTheme('card', value)} />
                    <ColorField label="Fundo" value={config.theme.background} onChange={(value) => updateTheme('background', value)} />
                  </div>
                  <Field label="Gradiente do topo" value={config.theme.topbar} onChange={(value) => updateTheme('topbar', value)} placeholder="linear-gradient(...)" />
                </SidebarBlock>

                <SidebarBlock title="Textos principais">
                  <Field label="Título superior" value={config.labels.topTitle} onChange={(value) => updateLabels('topTitle', value)} />
                  <Field label="Badge principal" value={config.labels.heroBadge} onChange={(value) => updateLabels('heroBadge', value)} />
                  <Field label="Título hero" value={config.labels.heroTitle} onChange={(value) => updateLabels('heroTitle', value)} />
                  <Field label="Subtítulo hero" value={config.labels.heroSubtitle} onChange={(value) => updateLabels('heroSubtitle', value)} textarea />
                  <Field label="Título catálogo" value={config.labels.homeTitle} onChange={(value) => updateLabels('homeTitle', value)} />
                  <Field label="Subtítulo catálogo" value={config.labels.homeSubtitle} onChange={(value) => updateLabels('homeSubtitle', value)} />
                  <Field label="Comprar agora" value={config.labels.buyNowText} onChange={(value) => updateLabels('buyNowText', value)} />
                  <Field label="Adicionar ao carrinho" value={config.labels.addCartText} onChange={(value) => updateLabels('addCartText', value)} />
                  <Field label="Finalizar" value={config.labels.checkoutText} onChange={(value) => updateLabels('checkoutText', value)} />
                </SidebarBlock>

                <SidebarBlock title="Comportamento da vitrine">
                  <SelectField
                    label="Ordenação dos itens"
                    value={config.layoutSettings.productSort}
                    onChange={(value) => updateLayoutSettings('productSort', value as StorefrontConfig['layoutSettings']['productSort'])}
                    options={[
                      ['featured', 'Priorizar destaques'],
                      ['newest', 'Mais recentes'],
                      ['name_asc', 'Nome A-Z'],
                      ['price_asc', 'Preço crescente'],
                      ['price_desc', 'Preço decrescente'],
                      ['stock_desc', 'Maior estoque'],
                    ]}
                  />
                  <SelectField
                    label="Menu de categorias"
                    value={config.layoutSettings.categoryMenuStyle}
                    onChange={(value) => updateLayoutSettings('categoryMenuStyle', value as StorefrontConfig['layoutSettings']['categoryMenuStyle'])}
                    options={[
                      ['tabs', 'Abas horizontais'],
                      ['pills', 'Chips / pills'],
                      ['sidebar', 'Menu lateral'],
                    ]}
                  />
                  <ToggleField label="Mostrar busca" checked={config.layoutSettings.showSearch} onChange={(checked) => updateLayoutSettings('showSearch', checked)} />
                  <ToggleField label="Mostrar filtros" checked={config.layoutSettings.showFilters} onChange={(checked) => updateLayoutSettings('showFilters', checked)} />
                  <ToggleField label="Mostrar destaques" checked={config.layoutSettings.showFeaturedStrip} onChange={(checked) => updateLayoutSettings('showFeaturedStrip', checked)} />
                  <ToggleField label="Mostrar institucional" checked={config.layoutSettings.showAbout} onChange={(checked) => updateLayoutSettings('showAbout', checked)} />
                  <ToggleField label="Mostrar benefícios" checked={config.layoutSettings.showBenefits} onChange={(checked) => updateLayoutSettings('showBenefits', checked)} />
                </SidebarBlock>
              </div>
            )}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-[#07101d] px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-300 font-black">{PAGE_LABELS[canvasPage]}</p>
              <h2 className="mt-2 text-xl font-black text-white">
                Canvas visual com drag and drop
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Arraste direto no preview para reorganizar a página. Clique em um bloco para editar seus dados internos.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-400">
              <Smartphone className="w-4 h-4" />
              {deviceMode === 'desktop' ? 'Visualização ampla' : deviceMode === 'tablet' ? 'Visualização tablet' : 'Visualização mobile'}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#10192a] p-4 shadow-2xl min-h-[calc(100vh-9rem)]">
            <div className={`mx-auto transition-all duration-300 ${canvasWidthClass}`}>
              <PublicStorefront
                slug={storeSlug || 'preview'}
                embeddedMode
                previewPage={canvasPage === 'home' ? 'home' : canvasPage}
                previewEditor={{
                  enabled: true,
                  page: canvasPage,
                  selectedElementId,
                  onSelectElement: (elementId) => {
                    setSelectedElementId(elementId);
                    setLeftTab('edit');
                  },
                  onMoveElement: (draggedElementId, targetElementId) => moveCanvasElement(canvasPage, draggedElementId, targetElementId),
                }}
                previewPayload={{
                  success: true,
                  store: {
                    id: lojista?.email || 'preview-store',
                    username: lojista?.email || 'preview',
                    storeName,
                    slug: storeSlug || 'preview',
                    bannerUrl: storeBannerUrl || null,
                    logoUrl: storeLogoUrl || null,
                    layout: storeLayout,
                    whatsappPhone: null,
                    config,
                  },
                  products,
                }}
              />
            </div>
          </div>
        </main>

        <aside className="border-l border-white/10 bg-[#0d1627] min-h-0 overflow-y-auto p-4 space-y-5">
          <SidebarBlock title="Ferramentas rápidas">
            <div className="grid grid-cols-2 gap-3">
              <QuickTool icon={LayoutTemplate} label="Seções" active={leftTab === 'sections'} onClick={() => setLeftTab('sections')} />
              <QuickTool icon={Type} label="Editar" active={leftTab === 'edit'} onClick={() => setLeftTab('edit')} />
              <QuickTool icon={Palette} label="Tema" active={leftTab === 'tools'} onClick={() => setLeftTab('tools')} />
              <QuickTool icon={Tag} label="Catálogo" active={canvasPage === 'home'} onClick={() => { setCanvasPage('home'); setLeftTab('tools'); }} />
            </div>
          </SidebarBlock>

          <SidebarBlock title="Resumo da página">
            <div className="space-y-3 text-sm">
              <SummaryRow label="Página atual" value={PAGE_LABELS[canvasPage]} />
              <SummaryRow label="Elementos ativos" value={`${visibleElements.length}`} />
              <SummaryRow label="Elementos ocultos" value={`${hiddenElements.length}`} />
              <SummaryRow label="Layout" value={layoutOption.label} />
            </div>
          </SidebarBlock>

          <SidebarBlock title="Categorias da vitrine">
            <div className="flex flex-wrap gap-2">
              {categorySuggestions.map((category) => {
                const exists = config.categorySettings.some(item => item.name.toLowerCase() === category.toLowerCase());
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => addCategorySetting(category)}
                    disabled={exists}
                    className={`rounded-full px-3 py-1 text-[10px] font-bold border ${exists ? 'border-white/10 bg-white/5 text-slate-500 cursor-default' : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-100 hover:border-indigo-400'}`}
                  >
                    {exists ? '✓ ' : '+ '}{category}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              {config.categorySettings.map((category, index) => (
                <div
                  key={category.name}
                  draggable
                  onDragStart={() => setDraggingCategoryIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggingCategoryIndex === null || draggingCategoryIndex === index) return;
                    setDraftConfig(prev => ({ ...prev, categorySettings: toggleCategoryOrder(prev.categorySettings, draggingCategoryIndex, index) }));
                    setDraggingCategoryIndex(null);
                  }}
                  onDragEnd={() => setDraggingCategoryIndex(null)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-500 cursor-grab shrink-0" />
                    <div className="flex-1 min-w-0 space-y-3">
                      <div>
                        <p className="text-xs font-black text-white">{category.name}</p>
                        <p className="text-[10px] text-slate-500">Ordem #{index + 1}</p>
                      </div>
                      <input
                        type="text"
                        value={category.label}
                        onChange={(event) => updateCategory(index, { label: event.target.value })}
                        className="w-full bg-[#08111f] border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
                        placeholder="Nome visível"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <ToggleMini label="Visível" checked={category.visible} onChange={(checked) => updateCategory(index, { visible: checked })} />
                        <ToggleMini label="Destaque" checked={category.featured} onChange={(checked) => updateCategory(index, { featured: checked })} />
                        <button type="button" onClick={() => removeCategorySetting(category.name)} className="h-10 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-200 text-[11px] font-bold">
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SidebarBlock>

          <SidebarBlock title="Produtos em destaque">
            <div className="flex flex-wrap gap-2">
              {products.map((product) => {
                const active = config.highlightCodes.includes(product.codigo);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleHighlightCode(product.codigo)}
                    className={`rounded-2xl border px-3 py-2 text-left text-[11px] font-bold ${active ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'}`}
                  >
                    <span className="block">{product.nome}</span>
                    <span className="block text-[10px] opacity-70">Código {product.codigo}</span>
                  </button>
                );
              })}
            </div>
          </SidebarBlock>
        </aside>
      </div>
    </div>
  );
}

function getPageElements(page: StorefrontEditorPageId, config: StorefrontConfig): EditorElementView[] {
  if (page === 'home') {
    return config.sections.map((section, index) => ({
      id: section.id,
      title: section.title,
      subtitle: section.subtitle,
      enabled: section.enabled,
      order: index,
      page,
    }));
  }

  if (page === 'product') {
    return config.productPageElements
      .map((element) => ({ ...element, page }))
      .sort((left, right) => left.order - right.order);
  }

  return config.cartPageElements
    .map((element) => ({ ...element, page }))
    .sort((left, right) => left.order - right.order);
}

function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.6rem] border border-white/10 bg-white/[0.02] p-4 space-y-4">
      <h3 className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-black">{title}</h3>
      {children}
    </section>
  );
}

function QuickTool({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left ${active ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20'}`}
    >
      <Icon className="w-4 h-4 mb-2" />
      <span className="block text-xs font-black">{label}</span>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function DeviceButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-[11px] font-black border ${active ? 'bg-cyan-500/15 text-cyan-100 border-cyan-400/20' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
    >
      {children}
    </button>
  );
}

function EyeIcon() {
  return <ExternalLink className="w-4 h-4" />;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
      {textarea ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#08111f] border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#08111f] border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
        />
      )}
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
      <div className="flex gap-2">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="w-12 h-11 rounded-xl border border-white/10 bg-[#08111f]" />
        <input type="text" value={value} onChange={(event) => onChange(event.target.value)} className="flex-1 bg-[#08111f] border border-white/10 rounded-xl py-2 px-3 text-xs text-white" />
      </div>
    </label>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-300 gap-3">
      <span className="font-bold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ToggleMini({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#08111f] px-3 py-2 text-[11px] text-slate-300 gap-2">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="space-y-1.5 block">
      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-[#08111f] border border-white/10 rounded-xl py-2 px-3 text-xs text-white">
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}
