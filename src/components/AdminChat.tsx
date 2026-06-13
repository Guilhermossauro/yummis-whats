import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, CornerDownLeft, RefreshCw, ShoppingCart, Power, ExternalLink, Play } from 'lucide-react';
import { SQLLead, SQLMessageLog, SQLCart, SQLProduct, WhatsAppConfig } from '../types';
import { getSendMessageURL, isGatewayMode, channelMeta } from '../lib/gateway';

interface ChatProps {
  leads: SQLLead[];
  messages: SQLMessageLog[];
  carts: SQLCart[];
  products: SQLProduct[];
  whatsAppConfig: WhatsAppConfig;
  onSendManualMessage: (leadId: string, text: string) => void;
  onToggleBot: (leadId: string, paused: number) => void;
  onSimulateWebhook: (payload: any) => void;
}

export default function AdminChat({
  leads,
  messages,
  carts,
  products,
  whatsAppConfig,
  onSendManualMessage,
  onToggleBot,
  onSimulateWebhook
}: ChatProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
  const [typedMessage, setTypedMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-select first lead on load if any
  useEffect(() => {
    if (leads.length > 0 && !selectedLeadId) {
      setSelectedLeadId(leads[0].id);
    }
  }, [leads, selectedLeadId]);

  // Scroll to bottom of chat history when selection or messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedLeadId, messages]);

  const selectedLead = leads.find(l => l.id === selectedLeadId);
  const selectedCarts = carts.filter(c => c.lead_id === selectedLeadId);
  const selectedMessages = messages
    .filter(m => m.lead_id === selectedLeadId)
    .sort((a, b) => new Date(a.data_envio).getTime() - new Date(b.data_envio).getTime());

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedMessage.trim() || !selectedLeadId) return;

    onSendManualMessage(selectedLeadId, typedMessage.trim());
    setTypedMessage('');
  };

  // Helper formats
  const formatTimeCompact = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const cleanMessageText = (text: string) => text.replace(/^\[operador\]\s*/i, '');

  const deliveryLabel = (msg: SQLMessageLog) => {
    if (msg.direcao !== 'out') return 'Cliente';
    if (msg.delivery_status === 'sending') return '✓ Enviando ao Gateway';
    if (msg.delivery_status === 'failed') return '⚠ Falha no envio';
    return '✓✓ Enviado ao cliente';
  };

  const getProductDetails = (prodId: string) => {
    return products.find(p => p.id === prodId);
  };

  const calculateCartTotal = () => {
    return selectedCarts.reduce((acc, item) => {
      const prod = getProductDetails(item.product_id);
      return acc + (prod ? prod.preco * item.quantidade : 0);
    }, 0);
  };

  return (
    <div className="bg-slate-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl h-[650px] grid grid-cols-1 md:grid-cols-12" id="omnichannel-chat-viewport">
      
      {/* COLUMN 1: Leads list (left-side) - 3 cols */}
      <div className="md:col-span-4 border-r border-white/10 flex flex-col bg-slate-950/60" id="chat-sidebar-leads-column">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
            <MessageSquare className="w-4 h-4 text-indigo-400" />
            Contatos Recentes 
            <span className="text-[10px] bg-slate-800 text-slate-350 px-1.5 py-0.2 rounded font-mono font-normal">
              {leads.length}
            </span>
          </h4>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[580px] scrollbar-thin">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-slate-650 text-xs">
              Nenhuma conversa ativa no momento... Use o Simulador ao lado para abrir contatos!
            </div>
          ) : (
            leads.map(lead => {
              const active = lead.id === selectedLeadId;
              const lastMsg = messages
                .filter(m => m.lead_id === lead.id)
                .sort((a, b) => new Date(b.data_envio).getTime() - new Date(a.data_envio).getTime())[0];

              return (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left p-4 flex flex-col gap-1 cursor-pointer transition-all ${
                    active ? 'bg-indigo-650/20 border-l-3 border-indigo-500' : 'hover:bg-white/5 border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-baseline w-full">
                    <span className="text-xs font-bold text-white max-w-[120px] truncate flex items-center gap-1">
                      {lead.channel && <span title={channelMeta(lead.channel).label}>{channelMeta(lead.channel).emoji}</span>}
                      {lead.nome}
                    </span>
                    <span className="text-[8px] text-slate-500 font-mono">
                      {lastMsg ? formatTimeCompact(lastMsg.data_envio) : lead.ultimo_gatilho.slice(11, 16) + 'h'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 w-full">
                    <span className="font-mono text-[9px] truncate max-w-[100px] text-slate-500">{lead.telefone}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[7px] font-bold uppercase ${
                      lead.bot_pausado === 1 ? 'bg-rose-950 text-rose-350 border border-rose-500/10' : 'bg-emerald-950 text-emerald-350 border border-emerald-550/10'
                    }`}>
                      {lead.bot_pausado === 1 ? 'Bot Pausado' : 'Bot Ativo'}
                    </span>
                  </div>
                  {lastMsg && (
                    <p className="text-[10px] text-slate-400 font-sans italic truncate mt-1 w-full max-w-[200px]">
                      {lastMsg.direcao === 'out' ? `${deliveryLabel(lastMsg)}: ` : ''}{cleanMessageText(lastMsg.texto)}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* COLUMN 2: Message Box History (center col) - 5 cols */}
      <div className="md:col-span-5 flex flex-col h-full bg-slate-900 justify-between" id="chat-central-history-column">
        {selectedLead ? (
          <>
            {/* Header segment */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-white font-sans flex items-center gap-1.5">
                  {selectedLead.nome}
                  {selectedLead.channel && (
                    <span
                      className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border"
                      style={{ color: channelMeta(selectedLead.channel).color, borderColor: channelMeta(selectedLead.channel).color + '40', background: channelMeta(selectedLead.channel).color + '15' }}
                      title={`Origem: ${channelMeta(selectedLead.channel).label}`}
                    >
                      {channelMeta(selectedLead.channel).emoji} {channelMeta(selectedLead.channel).label}
                    </span>
                  )}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedLead.bot_pausado === 1 ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
                  <span className="text-[9px] text-slate-400 uppercase font-mono tracking-wider">
                    {selectedLead.bot_pausado === 1 ? 'Suporte Humano (Bot Pausado)' : 'Atendimento por Inteligência Artificial'}
                  </span>
                </div>
              </div>

              {/* Bot Toggle Action button */}
              <button
                onClick={() => onToggleBot(selectedLead.id, selectedLead.bot_pausado === 1 ? 0 : 1)}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] font-bold border cursor-pointer select-none transition-all flex items-center gap-1 ${
                  selectedLead.bot_pausado === 1
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-500/25 hover:bg-emerald-900'
                    : 'bg-rose-950 text-rose-450 border-rose-500/25 hover:bg-rose-900'
                }`}
                title={selectedLead.bot_pausado === 1 ? 'Ligar robô automático' : 'Pausar robô automático'}
              >
                <Bot className="w-3.5 h-3.5" />
                {selectedLead.bot_pausado === 1 ? 'Ativar Robô' : 'Pausar Robô'}
              </button>
            </div>

            {/* Chat list viewport */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin max-h-[460px] bg-slate-950/20">
              {selectedMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 text-xs font-sans italic">
                  Início do chat. Nenhuma mensagem arquivada ainda.
                </div>
              ) : (
                selectedMessages.map(msg => {
                  const isOut = msg.direcao === 'out';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col max-w-[85%] ${isOut ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed font-sans ${
                        isOut 
                          ? 'bg-indigo-650 text-white rounded-tr-none' 
                          : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
                      }`}>
                        {/* Preserve layout breaks but replace formatting brackets for preview elegance */}
                        <p className="whitespace-pre-wrap select-all selection:bg-slate-700">
                          {cleanMessageText(msg.texto)}
                        </p>
                      </div>
                      <span className="text-[8px] text-slate-500 font-mono mt-0.5 ml-1">
                        {deliveryLabel(msg)}
                        {msg.channel && (
                          <span style={{ color: channelMeta(msg.channel).color }}> • {channelMeta(msg.channel).emoji} {channelMeta(msg.channel).label}</span>
                        )}
                        {' '}• {formatTimeCompact(msg.data_envio)}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input keyboard form */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-slate-950/40 flex gap-2">
              <input
                type="text"
                placeholder={selectedLead.bot_pausado === 1 ? "Digite sua resposta para o cliente..." : "Responda p/ pausar bot e assumir suporte..."}
                value={typedMessage}
                onChange={(e) => setTypedMessage(e.target.value)}
                className="flex-grow bg-slate-950 border border-white/5 rounded-xl py-2 px-3.5 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
              />
              <button
                type="submit"
                className="p-2.5 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-white shadow-lg cursor-pointer flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-650">
            <Bot className="w-10 h-10 mb-2 text-slate-800" />
            <span className="text-xs font-mono">Selecione um contato na barra lateral</span>
          </div>
        )}
      </div>

      {/* COLUMN 3: Active Cart Overview (right side) - 3 cols */}
      <div className="md:col-span-3 border-l border-white/10 bg-slate-950/40 p-4 flex flex-col justify-between" id="chat-sidebar-cart-column">
        {selectedLead ? (
          <>
            <div className="space-y-4">
              <div className="pb-3 border-b border-white/5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-mono">Carrinho Ativo</span>
                <span className="text-xs font-bold text-white block mt-0.5 flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
                  Sacola do Cliente
                </span>
              </div>

              {selectedCarts.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs font-mono">
                  Carrinho está vazio.
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[350px] scrollbar-thin">
                  {selectedCarts.map(item => {
                    const prod = getProductDetails(item.product_id);
                    if (!prod) return null;
                    return (
                      <div key={item.id} className="bg-slate-900 border border-white/5 p-2 rounded-xl flex gap-2 items-center">
                        <img 
                          src={prod.foto_path} 
                          alt={prod.nome} 
                          className="w-10 h-10 object-cover rounded-md"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-[10px] font-bold text-white truncate">{prod.nome}</h5>
                          <span className="text-[8px] text-slate-400 font-mono">Qtd: {item.quantidade} | T: {item.size}</span>
                        </div>
                        <div className="text-[10px] font-mono text-indigo-400 font-bold">
                          R$ {(prod.preco * item.quantidade).toFixed(2).replace('.', ',')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Summary & Active Connections indicators */}
            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex justify-between items-baseline text-xs">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-bold text-white font-mono">R$ {calculateCartTotal().toFixed(2).replace('.', ',')}</span>
              </div>

              {/* Status card showing Yummis API (gateway) trigger feedback */}
              <div className="p-3 rounded-xl border border-white/5 bg-slate-950/60 text-[9px] text-slate-500 leading-relaxed font-sans">
                <span className="text-white font-bold uppercase text-[8px] block mb-1">Status de Envio ({whatsAppConfig.mode})</span>
                {isGatewayMode(whatsAppConfig.mode) ? (
                  <>
                    <span className="text-emerald-400 block font-semibold">• Yummis API Ativada (Gateway)</span>
                    <span className="block mt-0.5 uppercase tracking-wide">Gateway: {whatsAppConfig.apiURL || getSendMessageURL()}</span>
                    <span className="block mt-0.5 uppercase tracking-wide">Token: {whatsAppConfig.apiKey ? whatsAppConfig.apiKey.slice(0, 10) + '...' : 'Faltando'}</span>
                  </>
                ) : whatsAppConfig.mode === 'baileys' ? (
                  <span className="text-blue-400 block">• Integração Local Simulada</span>
                ) : (
                  <span className="text-indigo-400 block">• Modo Sandbox Ativo</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-650 text-center text-[10px] font-mono">
            Esperando seleção de contato...
          </div>
        )}
      </div>
    </div>
  );
}
