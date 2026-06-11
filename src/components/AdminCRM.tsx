import React from 'react';
import { TrendingUp, ShoppingBag, CreditCard, CheckCircle2, ChevronRight, ChevronLeft, Trash2, Database } from 'lucide-react';
import { SQLLead, SQLCart, SQLProduct, SQLOrder } from '../types';

interface CRMProps {
  leads: SQLLead[];
  carts: SQLCart[];
  products: SQLProduct[];
  orders: SQLOrder[];
  onMoveLead: (leadId: string, nextStatus: SQLLead['status_funil']) => void;
  onDeleteLead: (leadId: string) => void;
}

export default function AdminCRM({ leads, carts, products, orders, onMoveLead, onDeleteLead }: CRMProps) {
  
  // Calculate analytics
  const totalLeads = leads.length;
  
  const sales = orders
    .filter(o => o.status_pagamento === 'PAGO')
    .reduce((acc, current) => acc + current.total, 0);

  const openCartsCount = leads.filter(l => l.status_funil === 'CARRINHO_ABERTO').length;
  const waitingPixCount = leads.filter(l => l.status_funil === 'AGUARDANDO_PIX').length;
  const paidCount = leads.filter(l => l.status_funil === 'PAGO').length;
  const concludedCount = leads.filter(l => l.status_funil === 'CONCLUIDO').length;

  const conversionRate = totalLeads > 0 
    ? ((paidCount + concludedCount) / totalLeads) * 100 
    : 0;

  // Render columns definitions
  const COLUMNS = [
    { 
      key: 'CARRINHO_ABERTO', 
      title: 'Carrinho Aberto', 
      color: 'border-purple-500/20 text-purple-355 bg-purple-500/5', 
      badge: 'bg-purple-950/80 text-purple-300 border border-purple-500/30'
    },
    { 
      key: 'AGUARDANDO_PIX', 
      title: 'Aguardando Pagamento (Pix)', 
      color: 'border-amber-500/20 text-amber-355 bg-amber-500/5',
      badge: 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
    },
    { 
      key: 'PAGO', 
      title: 'Pago / Preparando Envio', 
      color: 'border-emerald-500/20 text-emerald-355 bg-emerald-500/5',
      badge: 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
    },
    { 
      key: 'CONCLUIDO', 
      title: 'Pedido Concluído', 
      color: 'border-blue-500/20 text-blue-355 bg-blue-500/5',
      badge: 'bg-blue-950/80 text-blue-300 border border-blue-500/30'
    }
  ];

  // Helper to fetch compact cart contents for list
  const getLeadCartSummary = (leadId: string) => {
    const leadCarts = carts.filter(c => c.lead_id === leadId);
    if (leadCarts.length === 0) return 'Sacola Vazia';
    
    return leadCarts.map(item => {
      const prod = products.find(p => p.id === item.product_id);
      return `${prod ? prod.nome : 'Produto'}(${item.size}) x${item.quantidade}`;
    }).join(', ');
  };

  const calculateLeadTotal = (leadId: string) => {
    const leadCarts = carts.filter(c => c.lead_id === leadId);
    return leadCarts.reduce((acc, item) => {
      const prod = products.find(p => p.id === item.product_id);
      const price = prod ? prod.preco : 0;
      return acc + (price * item.quantidade);
    }, 0);
  };

  return (
    <div className="space-y-6" id="crm-kanban-root">
      {/* 1. Statistics Cards Block */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Faturado */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Total Faturado</span>
              <span className="text-xl font-bold text-white block mt-1">R$ {sales.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-550/30 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
            <span>Conversão ativa de Pix</span>
          </div>
        </div>

        {/* Carrinhos Ativos */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Carrinhos Abertos</span>
              <span className="text-xl font-bold text-white block mt-1">{openCartsCount} clientes</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-550/30 flex items-center justify-center text-purple-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-sans">
            Comunicação de abandono elegível
          </div>
        </div>

        {/* Aguardando Pix */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Aguardando Pagamento</span>
              <span className="text-xl font-bold text-white block mt-1">{waitingPixCount} faturas</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-950/80 border border-amber-550/30 flex items-center justify-center text-amber-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-amber-400 font-sans">
            Aguardando callback Pix webhook
          </div>
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block uppercase">Taxa de Conversão</span>
              <span className="text-xl font-bold text-white block mt-1">{conversionRate.toFixed(1)}%</span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-550/30 flex items-center justify-center text-blue-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 text-[10px] text-slate-400 font-sans">
            {paidCount + concludedCount} de {totalLeads} contatos convertidos
          </div>
        </div>
      </div>

      {/* 2. Pipeline Kanban layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start" id="kanban-pipeline-columns">
        {COLUMNS.map(col => {
          const colLeads = leads.filter(l => l.status_funil === col.key);

          return (
            <div key={col.key} className="bg-slate-950 border border-white/5 rounded-2xl p-4 space-y-4 flex flex-col min-h-[500px]">
              {/* Header column */}
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">{col.title}</h4>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                  {colLeads.length}
                </span>
              </div>

              {/* Cards List container */}
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] scrollbar-thin">
                {colLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-slate-600 border border-dashed border-white/5 rounded-xl">
                    <Database className="w-6 h-6 mb-1 text-slate-700" />
                    <span className="text-[10px] font-mono">Sem leads ativos</span>
                  </div>
                ) : (
                  colLeads.map(lead => {
                    const totalVal = calculateLeadTotal(lead.id);

                    return (
                      <div 
                        key={lead.id} 
                        className="bg-slate-900 border border-white/10 hover:border-slate-700 rounded-xl p-3.5 space-y-3.5 shadow-md relative group transition-all"
                      >
                        {/* Name and actions */}
                        <div className="flex justify-between items-start gap-1">
                          <div>
                            <h5 className="text-xs font-bold text-white transition-colors group-hover:text-indigo-300">{lead.nome}</h5>
                            <span className="text-[9px] text-slate-500 font-mono tracking-tight block">{lead.telefone}</span>
                          </div>
                          
                          <button 
                            onClick={() => onDeleteLead(lead.id)}
                            className="text-slate-600 hover:text-rose-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="Deletar Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Cart contents wrapper */}
                        <div className="bg-slate-950 p-2 rounded-lg border border-white/5">
                          <span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5 tracking-wide">Produtos:</span>
                          <p className="text-[10px] text-slate-300 leading-tight font-sans truncate" title={getLeadCartSummary(lead.id)}>
                            {getLeadCartSummary(lead.id)}
                          </p>
                        </div>

                        {/* Subtotal / Price */}
                        <div className="flex justify-between items-center pt-1">
                          <div>
                            <span className="text-[8px] text-slate-500 block uppercase font-mono">Total Estimado</span>
                            <span className="text-[10px] font-bold text-slate-100 font-mono">
                              R$ {totalVal.toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          {/* Quick manual column shifts */}
                          <div className="flex gap-1">
                            {col.key !== 'CARRINHO_ABERTO' && (
                              <button
                                onClick={() => {
                                  const idx = COLUMNS.findIndex(c => c.key === col.key);
                                  onMoveLead(lead.id, COLUMNS[idx - 1].key as SQLLead['status_funil']);
                                }}
                                className="p-1 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-md text-slate-400 hover:text-white cursor-pointer"
                                title="Mover para esquerda"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                            )}

                            {col.key !== 'CONCLUIDO' && (
                              <button
                                onClick={() => {
                                  const idx = COLUMNS.findIndex(c => c.key === col.key);
                                  onMoveLead(lead.id, COLUMNS[idx + 1].key as SQLLead['status_funil']);
                                }}
                                className="p-1 bg-slate-950 hover:bg-slate-800 border border-white/5 rounded-md text-slate-400 hover:text-white cursor-pointer"
                                title="Mover para direita"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Indicator tag */}
                        <div className="flex justify-between items-center text-[8px] text-slate-500 pt-1 font-mono border-t border-white/5 mt-1">
                          <span>Auto-bot: {lead.bot_pausado === 1 ? '🔴 Pausado' : '🟢 Ativo'}</span>
                          <span>{lead.ultimo_gatilho.slice(11, 16)}h</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
