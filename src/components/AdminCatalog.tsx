import React, { useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, Check, X, Tag, Smartphone, Archive, ShoppingBag, DollarSign, Share2 } from 'lucide-react';
import { SQLProduct } from '../types';
import { buildWhatsAppProductLink } from '../lib/productShare';

interface CatalogProps {
  products: SQLProduct[];
  onAddProduct: (product: Omit<SQLProduct, 'id'>) => void | Promise<void>;
  onEditProduct: (id: string, product: Partial<SQLProduct>) => void | Promise<void>;
  onDeleteProduct: (id: string) => void | Promise<void>;
  gatewayPhone?: string | null;
  storeSlug?: string;
}

const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80',
  'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&q=80',
  'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&q=80',
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80',
  'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80',
  'https://images.unsplash.com/photo-1539252553119-a6e115520e5c?w=400&q=80'
];

export default function AdminCatalog({ products, onAddProduct, onEditProduct, onDeleteProduct, gatewayPhone, storeSlug }: CatalogProps) {
  const [filterText, setFilterText] = useState('');
  const [sharedId, setSharedId] = useState<string | null>(null);

  const shareProduct = (p: SQLProduct) => {
    const link = buildWhatsAppProductLink(p, gatewayPhone);
    navigator.clipboard?.writeText(link).catch(() => {});
    setSharedId(p.id);
    setTimeout(() => setSharedId(null), 2000);
  };
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('20');
  const [image, setImage] = useState(STOCK_IMAGES[0]);
  const [description, setDescription] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [hasShipping, setHasShipping] = useState(false);
  const [shippingType, setShippingType] = useState<'free' | 'paid'>('paid');
  const [shippingCost, setShippingCost] = useState('15.00');
  const [errorMsg, setErrorMsg] = useState('');

  const categorySuggestions = useMemo(() => (
    Array.from(new Set(products.flatMap(product => Array.isArray(product.categories) ? product.categories : [])))
      .sort((left, right) => left.localeCompare(right, 'pt-BR'))
  ), [products]);

  const addCategory = (value: string) => {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) return;
    setSelectedCategories(prev => prev.some(category => category.toLowerCase() === normalized.toLowerCase()) ? prev : [...prev, normalized]);
    setCategoryDraft('');
  };

  const removeCategory = (value: string) => {
    setSelectedCategories(prev => prev.filter(category => category.toLowerCase() !== value.toLowerCase()));
  };

  const openNewForm = () => {
    setEditingId(null);
    setCode(String(Math.floor(100 + Math.random() * 899))); // Suggest code
    setName('');
    setPrice('');
    setStock('25');
    setImage(STOCK_IMAGES[Math.floor(Math.random() * STOCK_IMAGES.length)]);
    setDescription('');
    setSelectedCategories([]);
    setCategoryDraft('');
    setHasShipping(false);
    setShippingType('paid');
    setShippingCost('15.00');
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const openEditForm = (prod: SQLProduct) => {
    setEditingId(prod.id);
    setCode(prod.codigo);
    setName(prod.nome);
    setPrice(String(prod.preco));
    setStock(String(prod.estoque));
    setImage(prod.foto_path);
    setDescription(prod.descricao);
    setSelectedCategories(Array.isArray(prod.categories) ? prod.categories : []);
    setCategoryDraft('');
    setHasShipping(!!prod.has_shipping);
    setShippingType(prod.shipping_type || 'paid');
    setShippingCost(String(prod.shipping_cost || '15.00'));
    setErrorMsg('');
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code || !name || !price || !description) {
      setErrorMsg('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (!selectedCategories.length) {
      setErrorMsg('Selecione pelo menos uma categoria para o produto.');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Informe um preço numérico válido e maior que zero.');
      return;
    }

    const stockNum = parseInt(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      setErrorMsg('Informe uma quantidade de estoque válida.');
      return;
    }

    // Check code uniqueness
    const codeDup = products.find(p => p.codigo === code && p.id !== editingId);
    if (codeDup) {
      setErrorMsg(`O código único "${code}" já foi cadastrado para o produto "${codeDup.nome}".`);
      return;
    }

    const payload = {
      codigo: code,
      nome: name,
      preco: priceNum,
      foto_path: image || STOCK_IMAGES[0],
      estoque: stockNum,
      descricao: description,
      categories: selectedCategories,
      has_shipping: hasShipping,
      shipping_type: shippingType,
      shipping_cost: hasShipping && shippingType === 'paid' ? parseFloat(shippingCost) || 0 : 0
    };

    try {
      if (editingId) {
        await onEditProduct(editingId, payload);
      } else {
        await onAddProduct(payload);
      }
      setIsFormOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar o produto.');
    }
  };

  const filteredProducts = products.filter(p =>
    p.nome.toLowerCase().includes(filterText.toLowerCase()) ||
    p.codigo.includes(filterText) ||
    p.descricao.toLowerCase().includes(filterText.toLowerCase()) ||
    (Array.isArray(p.categories) ? p.categories.some(category => category.toLowerCase().includes(filterText.toLowerCase())) : false)
  );

  return (
    <div className="space-y-6" id="catalog-component-root">
      {/* Search and Action Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-900/40 p-4 border border-white/5 rounded-2xl">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Filtrar por nome, descrição ou código..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {storeSlug && (
            <a
              href={`/store/${storeSlug}`}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-500 transition-all rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-950/20"
            >
              <ShoppingBag className="w-4 h-4" />
              Ver vitrine pública
            </a>
          )}
          <button
            onClick={openNewForm}
            className="w-full sm:w-auto px-4 py-2.5 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/20"
          >
            <Plus className="w-4 h-4" />
            Cadastrar Produto
          </button>
        </div>
      </div>

      {/* Main product creation/edit form */}
      {isFormOpen && (
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl relative animate-fadeIn">
          <button 
            onClick={() => setIsFormOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider mb-5 flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-400" />
            {editingId ? 'Editar Produto Cadastrado' : 'Cadastrar Novo Modelo no Catálogo'}
          </h3>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-950/30 border border-rose-500/25 rounded-xl text-rose-300 text-xs font-sans">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Left side inputs */}
            <div className="space-y-4 md:col-span-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Nome Comercial</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Camisa Linho Prime Branca"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Código de Consulta WhatsApp (Cód.)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 106"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    title="Código único usado pelo cliente nas mensagens para identificar o produto"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Preço de Venda (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="129.90"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-8 pr-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Estoque Inicial</label>
                  <input
                    type="number"
                    required
                    placeholder="25"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Descrição Detalhada do Modelo</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Descreva o tecido, modelagem, caimento ou especificações para o bot responder ao cliente..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans leading-relaxed"
                />
              </div>

              <div className="space-y-2 rounded-xl border border-white/5 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Categorias do produto</label>
                    <p className="text-[10px] text-slate-500 mt-1">Escolha uma ou mais categorias para a vitrine pública.</p>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-300">{selectedCategories.length} selecionada(s)</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedCategories.map((category) => (
                    <span key={category} className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold text-indigo-100">
                      {category}
                      <button type="button" onClick={() => removeCategory(category)} className="text-indigo-200 hover:text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {!selectedCategories.length && (
                    <span className="text-[10px] text-slate-500">Nenhuma categoria escolhida ainda.</span>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={categoryDraft}
                    onChange={(e) => setCategoryDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addCategory(categoryDraft);
                      }
                    }}
                    placeholder="Ex: Vestidos, Promoções, Verão"
                    className="flex-1 bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => addCategory(categoryDraft)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
                  >
                    Adicionar categoria
                  </button>
                </div>

                {!!categorySuggestions.length && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {categorySuggestions.map((category) => {
                      const active = selectedCategories.some(item => item.toLowerCase() === category.toLowerCase());
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => active ? removeCategory(category) : addCategory(category)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold border transition-all ${active ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100' : 'border-white/10 bg-slate-900 text-slate-300 hover:border-white/25'}`}
                        >
                          {active ? '✓ ' : '+ '}{category}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Shipping Section */}
              <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-white block">Necessita de Envio / Frete</span>
                    <span className="text-[10px] text-slate-500">Se selecionado, o chatbot solicitará o endereço de entrega ao cliente durante o fechamento.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasShipping}
                    onChange={(e) => setHasShipping(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-650 bg-slate-950 border-white/10"
                  />
                </div>

                {hasShipping && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2.5 border-t border-white/5 animate-fadeIn">
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Tipo de Frete</label>
                      <select
                        value={shippingType}
                        onChange={(e) => setShippingType(e.target.value as 'free' | 'paid')}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
                      >
                        <option value="paid">Pago (Valor Fixo)</option>
                        <option value="free">Grátis (Cortesia)</option>
                      </select>
                    </div>

                    {shippingType === 'paid' && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">Custo do Frete (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={shippingCost}
                          onChange={(e) => setShippingCost(e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side Image Selector */}
            <div className="space-y-4 md:col-span-4 flex flex-col justify-between">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-2">Foto / Imagem do Produto</label>
                <div className="bg-slate-950 rounded-xl p-3 border border-white/5 text-center flex flex-col items-center">
                  <img 
                    src={image || STOCK_IMAGES[0]} 
                    alt="Preview" 
                    referrerPolicy="no-referrer"
                    className="w-full h-32 object-cover rounded-lg border border-white/5 bg-slate-900"
                  />
                  <div className="mt-2 w-full">
                    <input 
                      type="text"
                      placeholder="Caminho local ou URL de imagem..."
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      className="w-full bg-slate-900 border border-white/5 rounded-lg py-1 px-2 text-[10px] text-slate-350 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* stock presets */}
                <span className="text-[9px] text-slate-500 font-mono block mt-2 text-center uppercase">Ou clique para escolher fotos predefinidas:</span>
                <div className="grid grid-cols-6 gap-1 mt-1">
                  {STOCK_IMAGES.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setImage(img)}
                      className={`h-7 rounded border overflow-hidden ${image === img ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-white/5 hover:border-slate-500'}`}
                    >
                      <img src={img} alt="preset" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Form buttons */}
              <div className="flex gap-2.5 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-2 border border-white/10 hover:bg-white/5 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all text-xs font-bold text-white rounded-xl cursor-pointer"
                >
                  Confirmar Salvar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Grid of Products */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="products-list-grid">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full bg-slate-950 border border-white/5 border-dashed rounded-2xl py-16 text-center text-slate-500 flex flex-col items-center">
            <Archive className="w-10 h-10 mb-2 text-slate-700" />
            <p className="text-xs font-mono">Nenhum produto cadastrado com os critérios de filtro.</p>
          </div>
        ) : (
          filteredProducts.map(p => (
            <div 
              key={p.id} 
              className="bg-slate-900 border border-white/10 rounded-2xl shadow-md overflow-hidden relative group hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              {/* Product Card Image Banner */}
              <div className="h-44 bg-slate-950 relative overflow-hidden">
                <img 
                  src={p.foto_path} 
                  alt={p.nome} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 bg-indigo-650 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full border border-indigo-400/20 shadow-lg">
                  CÓD: {p.codigo}
                </div>
                <div className="absolute top-3 right-3 bg-slate-950/80 text-white font-mono text-[9px] px-2 py-0.5 rounded-full border border-white/5">
                  Estoque: {p.estoque} un
                </div>
              </div>

              {/* Product Card Body details */}
              <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-white tracking-tight line-clamp-1">{p.nome}</h4>
                  {!!p.categories?.length && (
                    <div className="flex flex-wrap gap-1">
                      {p.categories.slice(0, 3).map((category) => (
                        <span key={category} className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-bold text-indigo-200">
                          {category}
                        </span>
                      ))}
                      {p.categories.length > 3 && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold text-slate-400">
                          +{p.categories.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 line-clamp-3 leading-relaxed font-sans">{p.descricao}</p>
                </div>

                <div className="pt-3 border-t border-white/5 flex justify-between items-center bg-slate-900">
                  <div>
                    <span className="text-[8px] text-slate-500 block uppercase font-mono">Preço Oficial</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold text-indigo-400 font-mono">
                        R$ {p.preco.toFixed(2).replace('.', ',')}
                      </span>
                      {p.has_shipping && (
                        <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                          p.shipping_type === 'free' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/10' : 'bg-amber-950 text-amber-450 border border-amber-500/10'
                        }`}>
                          {p.shipping_type === 'free' ? 'Frete Grátis' : `🚚 + R$${p.shipping_cost?.toFixed(2)}`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Edit / Remove actions */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => shareProduct(p)}
                      className="p-1.5 bg-slate-950 border border-white/5 hover:border-emerald-500/30 rounded-lg text-slate-400 hover:text-emerald-400 transition-all cursor-pointer"
                      title={gatewayPhone ? 'Copiar link de interesse (WhatsApp)' : 'Copiar link (conecte o WhatsApp para incluir o número)'}
                    >
                      {sharedId === p.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => openEditForm(p)}
                      className="p-1.5 bg-slate-950 border border-white/5 hover:border-indigo-500/30 rounded-lg text-slate-400 hover:text-indigo-400 transition-all cursor-pointer"
                      title="Editar Detalhes"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteProduct(p.id)}
                      className="p-1.5 bg-slate-950 border border-white/5 hover:border-rose-500/30 rounded-lg text-slate-400 hover:text-rose-450 transition-all cursor-pointer"
                      title="Excluir Produto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
