import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Search, 
  Filter, 
  Bot, 
  UserCheck, 
  Trash2, 
  ShoppingBag, 
  DollarSign, 
  MessageSquare, 
  Send, 
  ChevronRight, 
  UserX,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { SQLLead, SQLCart, SQLProduct, SQLOrder, SQLMessageLog } from '../types';

interface CustomerProfilesProps {
  leads: SQLLead[];
  carts: SQLCart[];
  products: SQLProduct[];
  orders: SQLOrder[];
  messages: SQLMessageLog[];
  onAddMessage: (leadId: string, text: string, direction: 'in' | 'out', operatorName?: string) => void;
  onSetBotPaused: (leadId: string, paused: boolean) => void;
  onUpdateLeadStatus: (leadId: string, nextStatus: SQLLead['status_funil']) => void;
  onDeleteLead: (leadId: string) => void;
  onUpdateLead: (leadId: string, updatedData: Partial<SQLLead>) => void;
}

export default function AdminCustomerProfiles({
  leads,
  carts,
  products,
  orders,
  messages,
  onAddMessage,
  onSetBotPaused,
  onUpdateLeadStatus,
  onDeleteLead,
  onUpdateLead
}: CustomerProfilesProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  
  // Inline editing fields
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  // Message input state
  const [replyText, setReplyText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom when selected client or messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedLeadId, messages]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  // Filtered Leads list
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.telefone.includes(searchTerm);
    
    const matchesFilter = 
      statusFilter === 'todos' || 
      lead.status_funil.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesFilter;
  });

  const handleSelectLead = (lead: SQLLead) => {
    setSelectedLeadId(lead.id);
    setEditName(lead.nome);
    setEditPhone(lead.telefone);
    setIsEditing(false);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !editName || !editPhone) return;
    onUpdateLead(selectedLeadId, { nome: editName, telefone: editPhone });
    setIsEditing(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId || !replyText.trim()) return;
    
    // 1. Send manual message (direction: 'out')
    onAddMessage(selectedLeadId, replyText, 'out', 'Operador');
    
    // 2. Automatically pause bot to allow manual conversation
    onSetBotPaused(selectedLeadId, true);
    
    setReplyText('');
  };

  const getLeadCartItems = (leadId: string) => {
    return carts
      .filter(c => c.lead_id === leadId)
      .map(cartItem => {
        const product = products.find(p => p.id === cartItem.product_id);
        return {
          ...cartItem,
          productName: product ? product.nome : 'Produto Desconhecido',
          price: product ? product.preco : 0
        };
      });
  };

  const getLeadOrders = (leadId: string) => {
    return orders.filter(o => o.lead_id === leadId);
  };

  const getLeadMessages = (leadId: string) => {
    return messages.filter(m => m.lead_id === leadId);
  };

  const getStatusBadgeClass = (status: SQLLead['status_funil']) => {
    switch (status) {
      case 'CARRINHO_ABERTO':
        return 'bg-amber-950 text-amber-400 border border-amber-500/20';
      case 'AGUARDANDO_PIX':
        return 'bg-blue-950 text-blue-400 border border-blue-500/20';
      case 'PAGO':
        return 'bg-emerald-950 text-emerald-400 border border-emerald-500/20';
      default:
        return 'bg-slate-900 text-slate-400 border border-white/5';
    }
  };

  const getStatusLabel = (status: SQLLead['status_funil']) => {
    switch (status) {
      case 'CARRINHO_ABERTO': return 'Carrinho Aberto';
      case 'AGUARDANDO_PIX': return 'Aguardando Pix';
      case 'PAGO': return 'Compra Concluída (Pago)';
      default: return status;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="customer-profiles-tab-root">
      
      {/* Left panel: Clients list */}
      <div className="md:col-span-4 bg-slate-900 border border-white/10 rounded-2xl p-4 flex flex-col h-[650px] shadow-xl">
        <div className="space-y-3 pb-3 border-b border-white/5">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-400" />
            Clientes no Banco de Dados
          </h3>
          <p className="text-xs text-slate-400">Gerencie e visualize fichas detalhadas dos leads:</p>
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome ou celular..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Status filters */}
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
            {['todos', 'carrinho_aberto', 'aguardando_pix', 'pago'].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border cursor-pointer whitespace-nowrap ${
                  statusFilter === filter
                    ? 'bg-indigo-650 text-white border-indigo-550 shadow-sm'
                    : 'bg-slate-950/40 text-slate-450 border-white/5 hover:text-white'
                }`}
              >
                {filter === 'todos' ? 'Todos' : filter.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* List scroll container */}
        <div className="flex-grow overflow-y-auto space-y-2 mt-4 pr-1 scrollbar-thin">
          {filteredLeads.length === 0 ? (
            <div className="text-center py-12 text-slate-550 text-xs italic font-semibold">
              Nenhum cliente encontrado
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const isActive = lead.id === selectedLeadId;
              return (
                <button
                  key={lead.id}
                  onClick={() => handleSelectLead(lead)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center cursor-pointer ${
                    isActive 
                      ? 'bg-indigo-650/15 border-indigo-500/30' 
                      : 'bg-slate-950/20 border-white/5 hover:bg-white/5'
                  }`}
                >
                  <div className="space-y-1 min-w-0 pr-2">
                    <span className="text-xs font-bold text-white block truncate">{lead.nome}</span>
                    <span className="text-[10px] text-slate-400 font-mono block flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-500" />
                      {lead.telefone}
                    </span>
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase mt-1 ${getStatusBadgeClass(lead.status_funil)}`}>
                      {getStatusLabel(lead.status_funil)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className={`text-[8px] font-mono font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                      lead.bot_pausado === 1 ? 'bg-rose-950 text-rose-300 border border-rose-500/10' : 'bg-emerald-950 text-emerald-300 border border-emerald-500/10'
                    }`}>
                      {lead.bot_pausado === 1 ? 'Mão' : 'Bot'}
                    </span>
                    <ChevronRight className={`w-4 h-4 text-slate-550 transition-transform ${isActive ? 'translate-x-0.5 text-indigo-400' : ''}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right panel: Profile detail view */}
      <div className="md:col-span-8 bg-slate-900 border border-white/10 rounded-2xl p-6 flex flex-col h-[650px] shadow-xl overflow-hidden relative">
        {selectedLead ? (
          <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-1 scrollbar-thin">
            
            {/* Header info card */}
            <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Nome do Cliente</span>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Telefone</span>
                    <input
                      type="text"
                      required
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div className="flex gap-2 pt-2 sm:pt-0">
                    <button
                      type="submit"
                      className="p-1.5 bg-emerald-650 hover:bg-emerald-555 rounded-lg text-white cursor-pointer"
                      title="Salvar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-extrabold text-white">{selectedLead.nome}</h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
                      title="Editar dados do cliente"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-slate-450 font-mono flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    {selectedLead.telefone}
                    <span className="text-slate-600">•</span>
                    <span className="font-sans text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-400 border border-white/5">Lead ID: #{selectedLead.id}</span>
                  </div>
                </div>
              )}

              {/* Status progression button flow */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Funil:</span>
                <select
                  value={selectedLead.status_funil}
                  onChange={(e) => onUpdateLeadStatus(selectedLead.id, e.target.value as any)}
                  className="bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-hidden"
                >
                  <option value="CARRINHO_ABERTO">Carrinho Aberto</option>
                  <option value="AGUARDANDO_PIX">Aguardando Pix</option>
                  <option value="PAGO">Pago</option>
                </select>
              </div>
            </div>

            {/* Middle Section: Control buttons and Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Bot status controller & Actions card */}
              <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5 space-y-4">
                <span className="text-[10px] text-slate-550 uppercase font-bold tracking-wider block font-mono">Status & Controle do Bot</span>
                
                <div className="flex items-center justify-between p-3 bg-slate-950/80 border border-white/5 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Bot className={`w-5 h-5 ${selectedLead.bot_pausado === 1 ? 'text-rose-400' : 'text-emerald-400'}`} />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {selectedLead.bot_pausado === 1 ? 'Atendimento Humano' : 'Bot WhatsApp Ativo'}
                      </span>
                      <span className="text-[10px] text-slate-450 block">
                        {selectedLead.bot_pausado === 1 ? 'O bot não responderá mensagens.' : 'O bot responde comandos automaticamente.'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onSetBotPaused(selectedLead.id, selectedLead.bot_pausado !== 1)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase border cursor-pointer transition-all ${
                      selectedLead.bot_pausado === 1
                        ? 'bg-rose-950 text-rose-300 border-rose-500/20 hover:bg-rose-900'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-500/20 hover:bg-emerald-900'
                    }`}
                  >
                    {selectedLead.bot_pausado === 1 ? 'Ativar Bot' : 'Pausar Bot'}
                  </button>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-sans">Ações de exclusão de dados:</span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Tem certeza que deseja remover permanentemente o cliente ${selectedLead.nome} e limpar todos os seus dados e carrinhos?`)) {
                        onDeleteLead(selectedLead.id);
                        setSelectedLeadId(null);
                      }
                    }}
                    className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-500/10 cursor-pointer font-bold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Lead
                  </button>
                </div>
              </div>

              {/* Shopping Cart details */}
              <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-555 uppercase font-bold tracking-wider block font-mono flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-indigo-400" />
                    Itens no Carrinho Ativo
                  </span>
                  
                  <div className="mt-3.5 space-y-2 max-h-[85px] overflow-y-auto pr-1 scrollbar-thin">
                    {getLeadCartItems(selectedLead.id).length === 0 ? (
                      <span className="text-[10px] text-slate-550 italic font-medium block pt-2">Carrinho está vazio</span>
                    ) : (
                      getLeadCartItems(selectedLead.id).map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border-b border-white/5 pb-1 font-mono">
                          <span className="text-slate-300 truncate max-w-[130px] font-sans font-semibold">{item.productName} ({item.size})</span>
                          <span className="text-slate-400">{item.quantidade}x R${item.price.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 mt-3 flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Valor Total:</span>
                  <span className="text-sm font-extrabold text-emerald-400 font-mono">
                    R$ {getLeadCartItems(selectedLead.id).reduce((sum, item) => sum + (item.price * item.quantidade), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Orders & Invoices History */}
            <div className="bg-slate-950/20 rounded-2xl p-4 border border-white/5 space-y-3">
              <span className="text-[10px] text-slate-555 uppercase font-bold tracking-wider block font-mono flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Histórico de Pedidos & Faturamento Pix
              </span>

              <div className="space-y-2 max-h-[100px] overflow-y-auto pr-1 scrollbar-thin">
                {getLeadOrders(selectedLead.id).length === 0 ? (
                  <span className="text-[10px] text-slate-550 italic font-semibold block py-2">Nenhum faturamento registrado para este cliente</span>
                ) : (
                  getLeadOrders(selectedLead.id).map((order) => (
                    <div key={order.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 bg-slate-950/60 border border-white/5 rounded-xl text-xs font-mono gap-2">
                      <div className="space-y-0.5">
                        <span className="text-white block font-bold">Pedido #{order.id}</span>
                        <span className="text-[9px] text-slate-500 block truncate max-w-[280px]">TxID Pix: {order.transaction_id || 'Não Gerado'}</span>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <span className="text-emerald-400 font-bold">R$ {order.total.toFixed(2)}</span>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          order.status_pagamento === 'PAGO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/15' : 'bg-amber-950 text-amber-400 border border-amber-500/15'
                        }`}>
                          {order.status_pagamento}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Chat Log History & Message Input */}
            <div className="bg-slate-950/30 rounded-2xl p-4 border border-white/5 flex flex-col h-[280px] overflow-hidden">
              <span className="text-[10px] text-slate-555 uppercase font-bold tracking-wider block font-mono flex items-center gap-1 border-b border-white/5 pb-2">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                Logs do WhatsApp & Atendimento Omnichannel
              </span>

              {/* Chat messages box */}
              <div className="flex-grow overflow-y-auto py-3 space-y-2 pr-1 scrollbar-thin">
                {getLeadMessages(selectedLead.id).length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs italic font-medium">
                    Nenhuma mensagem registrada no banco de dados.
                  </div>
                ) : (
                  getLeadMessages(selectedLead.id).map((msg) => {
                    const isOut = msg.direcao === 'out';
                    return (
                      <div 
                        key={msg.id} 
                        className={`flex flex-col max-w-[80%] ${isOut ? 'self-end ml-auto items-end' : 'self-start mr-auto items-start'}`}
                      >
                        <div className={`p-2.5 rounded-2xl text-xs font-sans leading-relaxed ${
                          isOut 
                            ? 'bg-indigo-650 text-white rounded-tr-none' 
                            : 'bg-slate-950 border border-white/5 text-slate-200 rounded-tl-none'
                        }`}>
                          {msg.texto}
                        </div>
                        <span className="text-[8px] text-slate-500 font-mono mt-1 px-1">
                          {isOut && msg.operator_name ? `${msg.operator_name} • ` : ''}
                          {msg.data_envio.slice(11, 16)}h
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-white/5">
                <input
                  type="text"
                  placeholder="Responda manualmente (isso irá pausar o bot)..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-grow bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="p-2 bg-indigo-650 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white cursor-pointer shrink-0 transition-all"
                  title="Enviar mensagem"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-950 flex items-center justify-center text-slate-600 border border-white/5">
              <UserX className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nenhum Cliente Selecionado</h3>
              <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Selecione um cliente na barra lateral esquerda para gerenciar sua ficha técnica, ver compras, acompanhar faturamento e interagir via chat.
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
