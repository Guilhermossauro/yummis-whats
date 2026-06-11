import React from 'react';
import { ShoppingBag, BarChart3, UserPlus, MessageSquare, TrendingUp, Bot, Headphones } from 'lucide-react';
import { SQLProduct, SQLLead, SQLCart, SQLOrder, SQLMessageLog } from '../types';
import { channelMeta } from '../lib/gateway';

interface DashboardHomeProps {
  products: SQLProduct[];
  leads: SQLLead[];
  carts: SQLCart[];
  orders: SQLOrder[];
  messages: SQLMessageLog[];
}

const card = 'bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm';
const title = 'text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2';
const sub = 'text-xs text-slate-400 dark:text-slate-500';

const FUNNEL = [
  { key: 'CARRINHO_ABERTO', label: 'Carrinho Aberto', color: '#6366f1' },
  { key: 'AGUARDANDO_PIX', label: 'Aguardando Pix', color: '#f59e0b' },
  { key: 'PAGO', label: 'Pago', color: '#10b981' },
  { key: 'CONCLUIDO', label: 'Concluído', color: '#0ea5e9' },
] as const;

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  return out;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ products, leads, carts, orders, messages }) => {
  // ----- Métricas principais -----
  const paid = orders.filter((o) => o.status_pagamento === 'PAGO');
  const salesRate = orders.length ? Math.round((paid.length / orders.length) * 100) : 0;
  const revenue = paid.reduce((s, o) => s + Number(o.total || 0), 0);

  const stats = [
    { label: 'Pedidos', value: String(orders.length), Icon: ShoppingBag, grad: 'from-slate-500 to-slate-700' },
    { label: 'Taxa de Vendas', value: salesRate + '%', Icon: BarChart3, grad: 'from-teal-500 to-emerald-600' },
    { label: 'Leads', value: String(leads.length), Icon: UserPlus, grad: 'from-fuchsia-500 to-purple-600' },
    { label: 'Mensagens', value: String(messages.length), Icon: MessageSquare, grad: 'from-orange-500 to-red-500' },
  ];

  // ----- Vendas por dia (últimos 7 dias) -----
  const days = lastNDays(7);
  const salesByDay = days.map((d) => ({
    date: d,
    total: orders.filter((o) => (o.data_criacao || '').slice(0, 10) === d).reduce((s, o) => s + Number(o.total || 0), 0),
    count: orders.filter((o) => (o.data_criacao || '').slice(0, 10) === d).length,
  }));
  const maxSales = Math.max(1, ...salesByDay.map((d) => d.total));

  // ----- Funil de atendimento -----
  const funnel = FUNNEL.map((f) => ({ ...f, count: leads.filter((l) => l.status_funil === f.key).length }));
  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  // ----- Mensagens por canal -----
  const channelCounts: Record<string, number> = {};
  messages.forEach((m) => {
    const ch = m.channel || 'whatsapp';
    channelCounts[ch] = (channelCounts[ch] || 0) + 1;
  });
  const channelData = Object.entries(channelCounts).sort((a, b) => b[1] - a[1]);
  const totalMsgs = messages.length || 1;

  // ----- Atendimento: bot x humano -----
  const botActive = leads.filter((l) => !l.bot_pausado).length;
  const humanActive = leads.filter((l) => l.bot_pausado).length;
  const incoming = messages.filter((m) => m.direcao === 'in').length;
  const outgoing = messages.filter((m) => m.direcao === 'out').length;

  // Donut (canais) — geometria
  let acc = 0;
  const donut = channelData.map(([ch, count]) => {
    const frac = count / totalMsgs;
    const seg = { ch, count, color: channelMeta(ch).color, start: acc, frac };
    acc += frac;
    return seg;
  });

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((c) => (
          <div key={c.label} className={`bg-gradient-to-br ${c.grad} rounded-xl p-4 text-white shadow-md flex items-center justify-between`}>
            <div>
              <div className="text-2xl font-extrabold leading-tight">{c.value}</div>
              <div className="text-xs opacity-90 font-medium">{c.label}</div>
            </div>
            <c.Icon className="w-9 h-9 opacity-80" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Vendas por dia */}
        <div className={`${card} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className={title}><TrendingUp className="w-4 h-4 text-emerald-500" /> Vendas (7 dias)</h3>
              <p className={sub}>Faturamento pago por dia</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-extrabold text-emerald-500">R$ {revenue.toFixed(2)}</div>
              <div className={sub}>receita confirmada</div>
            </div>
          </div>
          <div className="flex items-end gap-2 h-44">
            {salesByDay.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                <div className="w-full flex items-end justify-center h-full">
                  <div
                    className="w-7 rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-400 transition-all"
                    style={{ height: `${Math.max(4, (d.total / maxSales) * 100)}%` }}
                    title={`R$ ${d.total.toFixed(2)} • ${d.count} pedido(s)`}
                  />
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{d.date.slice(8, 10)}/{d.date.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Mensagens por canal (donut) */}
        <div className={`${card} p-5`}>
          <h3 className={title}><MessageSquare className="w-4 h-4 text-indigo-500" /> Mensagens por canal</h3>
          <p className={`${sub} mb-3`}>Origem das conversas</p>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
              <circle cx="18" cy="18" r="15.915" fill="none" className="stroke-slate-100 dark:stroke-slate-700" strokeWidth="4" />
              {donut.map((s) => (
                <circle key={s.ch} cx="18" cy="18" r="15.915" fill="none" stroke={s.color} strokeWidth="4"
                  strokeDasharray={`${s.frac * 100} ${100 - s.frac * 100}`} strokeDashoffset={`${-s.start * 100}`} />
              ))}
            </svg>
            <div className="flex-1 space-y-1.5">
              {donut.length === 0 && <p className={sub}>Sem mensagens ainda.</p>}
              {donut.map((s) => (
                <div key={s.ch} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-slate-700 dark:text-slate-300 flex-1">{channelMeta(s.ch).label}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funil de atendimento */}
        <div className={`${card} p-5 lg:col-span-2`}>
          <h3 className={title}><BarChart3 className="w-4 h-4 text-fuchsia-500" /> Funil de Atendimento</h3>
          <p className={`${sub} mb-4`}>Distribuição dos leads por etapa</p>
          <div className="space-y-3">
            {funnel.map((f) => (
              <div key={f.key}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">{f.label}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{f.count}</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(f.count / maxFunnel) * 100}%`, background: f.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Atendimento bot x humano + mensagens */}
        <div className={`${card} p-5`}>
          <h3 className={title}><Headphones className="w-4 h-4 text-teal-500" /> Atendimento</h3>
          <p className={`${sub} mb-3`}>Bot e operadores</p>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <Bot className="w-5 h-5 text-emerald-500" />
              <div className="flex-1"><div className="text-xs text-slate-500 dark:text-slate-400">Bot atendendo</div></div>
              <div className="text-lg font-extrabold text-emerald-500">{botActive}</div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
              <Headphones className="w-5 h-5 text-rose-500" />
              <div className="flex-1"><div className="text-xs text-slate-500 dark:text-slate-400">Com operador</div></div>
              <div className="text-lg font-extrabold text-rose-500">{humanActive}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{incoming}</div>
                <div className={sub}>Recebidas</div>
              </div>
              <div className="text-center p-2 rounded-xl bg-slate-50 dark:bg-slate-700/40">
                <div className="text-lg font-extrabold text-slate-700 dark:text-slate-200">{outgoing}</div>
                <div className={sub}>Enviadas</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo rápido */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Produtos no catálogo', value: products.length },
          { label: 'Itens em carrinhos', value: carts.length },
          { label: 'Pedidos pagos', value: paid.length },
          { label: 'Receita total', value: 'R$ ' + revenue.toFixed(2) },
        ].map((x) => (
          <div key={x.label} className={`${card} p-4`}>
            <div className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{x.value}</div>
            <div className={sub}>{x.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardHome;
