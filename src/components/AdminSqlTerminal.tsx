import React, { useState } from 'react';
import { Database, Terminal, FileCode, CheckCircle, Copy, FileText, Play, Download } from 'lucide-react';
import { LojistaUser, SQLProduct, SQLLead, SQLCart, SQLOrder, SQLMessageLog } from '../types';

interface SQLTerminalProps {
  lojista: { name: string; email: string };
  products: SQLProduct[];
  leads: SQLLead[];
  carts: SQLCart[];
  orders: SQLOrder[];
  messages: SQLMessageLog[];
}

export default function AdminSqlTerminal({
  lojista,
  products,
  leads,
  carts,
  orders,
  messages
}: SQLTerminalProps) {
  const [selectedTable, setSelectedTable] = useState<'users' | 'products' | 'leads' | 'carts' | 'orders' | 'messages_log'>('leads');
  const [queryInput, setQueryInput] = useState('SELECT * FROM leads WHERE status_funil = \'CARRINHO_ABERTO\'');
  const [terminalResult, setTerminalResult] = useState<any[] | null>(null);
  const [terminalHeaders, setTerminalHeaders] = useState<string[]>([]);
  const [terminalError, setTerminalError] = useState('');
  const [copiedType, setCopiedType] = useState<'schema' | 'config' | null>(null);

  // Expose Schema String for visual inspection or copy
  const schemaSQLString = `-- Tabela central de controle de sessões e carrinho
CREATE TABLE IF NOT EXISTS customer_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(50) DEFAULT 'START',
    cart_json TEXT DEFAULT '[]',
    transaction_id VARCHAR(100) NULL,
    total_value DECIMAL(10,2) DEFAULT 0,
    abandoned_notified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_phone ON customer_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_sessions_state ON customer_sessions(state);`;

  const handleCopy = (type: 'schema' | 'config', code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleRunQuery = (e: React.FormEvent) => {
    e.preventDefault();
    setTerminalError('');
    setTerminalResult(null);

    const q = queryInput.trim().toLowerCase();

    if (!q.startsWith('select')) {
      setTerminalError('Error: Apenas consultas SELECT são permitidas neste terminal interativo de consulta de simulação.');
      return;
    }

    try {
      // Basic SQL custom interpreter for visual playground!
      if (q.includes('from products')) {
        let res = [...products];
        if (q.includes('where')) {
          res = res.filter(p => p.estoque > 0);
        }
        setTerminalHeaders(['id', 'codigo', 'nome', 'preco', 'estoque']);
        setTerminalResult(res.map(p => ({
          id: p.id,
          codigo: p.codigo,
          nome: p.nome,
          preco: `R$ ${p.preco.toFixed(2)}`,
          estoque: p.estoque
        })));
      } else if (q.includes('from leads')) {
        let res = [...leads];
        if (q.includes('carrinho_aberto')) {
          res = res.filter(l => l.status_funil === 'CARRINHO_ABERTO');
        } else if (q.includes('aguardando_pix')) {
          res = res.filter(l => l.status_funil === 'AGUARDANDO_PIX');
        } else if (q.includes('pago')) {
          res = res.filter(l => l.status_funil === 'PAGO');
        }
        
        setTerminalHeaders(['id', 'telefone', 'nome', 'status_funil', 'bot_pausado']);
        setTerminalResult(res.map(l => ({
          id: l.id,
          telefone: l.telefone,
          nome: l.nome,
          status_funil: l.status_funil,
          bot_pausado: l.bot_pausado === 1 ? 'PAUSADO' : 'ATIVO'
        })));
      } else if (q.includes('from carts')) {
        setTerminalHeaders(['id', 'lead_id', 'product_id', 'quantidade', 'size']);
        setTerminalResult(carts);
      } else if (q.includes('from orders')) {
        setTerminalHeaders(['id', 'lead_id', 'total', 'status_pagamento', 'transaction_id']);
        setTerminalResult(orders);
      } else if (q.includes('from users')) {
        setTerminalHeaders(['id', 'nome', 'email', 'senha_hash']);
        setTerminalResult([{
          id: '1',
          nome: lojista.name,
          email: lojista.email,
          senha_hash: '$2y$10$f8v7b8n9m0...'
        }]);
      } else if (q.includes('from messages_log')) {
        setTerminalHeaders(['id', 'lead_id', 'direcao', 'texto', 'data_envio']);
        setTerminalResult(messages.map(m => ({
          id: m.id,
          lead_id: m.lead_id,
          direcao: m.direcao.toUpperCase(),
          texto: m.texto.slice(0, 30) + (m.texto.length > 30 ? '...' : ''),
          data_envio: m.data_envio.slice(11, 19)
        })));
      } else {
        setTerminalError('Tabela não identificada na sintaxe. Use "FROM leads", "FROM products", "FROM carts", "FROM orders", "FROM messages_log" ou "FROM users"');
      }
    } catch (err: any) {
      setTerminalError('Erro de sintaxe SQL: ' + err.message);
    }
  };

  // Select memory array representing active table
  const getActiveArray = () => {
    switch(selectedTable) {
      case 'users': 
        return [{ id: '1', nome: lojista.name, email: lojista.email, senha_hash: '$2y$12$Z0E5x3bB...' }];
      case 'products': 
        return products;
      case 'leads': 
        return leads;
      case 'carts': 
        return carts;
      case 'orders': 
        return orders;
      case 'messages_log': 
        return messages;
      default: 
        return [];
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-6" id="sql-terminal-component-viewport">
      
      {/* Visual DB Inspect block */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/5 pb-3 gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-400" />
              Inspetor de Dados SQLite (Tabelas em Memória)
            </h3>
            <p className="text-xs text-slate-400 mt-1">Navegue pelas tabelas do SQLite em tempo real que controlam o estado do chatbot:</p>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {(['users', 'products', 'leads', 'carts', 'orders', 'messages_log'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setSelectedTable(tab); setTerminalResult(null); }}
                className={`py-1 px-2.5 rounded-lg text-[10px] font-mono uppercase border cursor-pointer ${
                  selectedTable === tab
                    ? 'bg-indigo-650 text-white border-indigo-500'
                    : 'text-slate-400 border-white/5 bg-slate-950/40 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tabular Visualizer */}
        <div className="overflow-x-auto rounded-xl border border-white/5 bg-slate-950/40 max-h-[300px] scrollbar-thin">
          <table className="min-w-full divide-y divide-white/5 text-left text-xs font-sans">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
              {selectedTable === 'leads' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">telefone</th>
                  <th className="px-4 py-3">nome</th>
                  <th className="px-4 py-3">status_funil</th>
                  <th className="px-4 py-3">bot_pausado</th>
                </tr>
              )}
              {selectedTable === 'products' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">codigo</th>
                  <th className="px-4 py-3">nome</th>
                  <th className="px-4 py-3">preco</th>
                  <th className="px-4 py-3">estoque</th>
                </tr>
              )}
              {selectedTable === 'carts' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">lead_id</th>
                  <th className="px-4 py-3">product_id</th>
                  <th className="px-4 py-3">quantidade</th>
                  <th className="px-4 py-3">tamanho</th>
                </tr>
              )}
              {selectedTable === 'orders' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">lead_id</th>
                  <th className="px-4 py-3">total</th>
                  <th className="px-4 py-3">status</th>
                  <th className="px-4 py-3">transação ID</th>
                </tr>
              )}
              {selectedTable === 'users' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">nome</th>
                  <th className="px-4 py-3">email</th>
                  <th className="px-4 py-3">senha_hash</th>
                </tr>
              )}
              {selectedTable === 'messages_log' && (
                <tr>
                  <th className="px-4 py-3">id</th>
                  <th className="px-4 py-3">lead_id</th>
                  <th className="px-4 py-3">direção</th>
                  <th className="px-4 py-3">mensagem</th>
                  <th className="px-4 py-3">data</th>
                </tr>
              )}
            </thead>

            <tbody className="divide-y divide-white/5 font-mono text-[10px] text-slate-300">
              {getActiveArray().length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-550 italic">Nenhum registro armazenado na tabela "{selectedTable}"</td>
                </tr>
              ) : (
                getActiveArray().map((row: any, index) => (
                  <tr key={row.id || index} className="hover:bg-white/5">
                    {selectedTable === 'leads' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5">{row.telefone}</td>
                        <td className="px-4 py-2.5 text-white font-sans font-semibold">{row.nome}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-slate-900 border border-white/5">{row.status_funil}</span>
                        </td>
                        <td className="px-4 py-2.5">{row.bot_pausado === 1 ? '🔴 Sim (Humano)' : '🟢 Não (Bot)'}</td>
                      </>
                    )}
                    {selectedTable === 'products' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5">{row.codigo}</td>
                        <td className="px-4 py-2.5 text-white font-sans font-semibold">{row.nome}</td>
                        <td className="px-4 py-2.5">R$ {row.preco.toFixed(2)}</td>
                        <td className="px-4 py-2.5">{row.estoque} un</td>
                      </>
                    )}
                    {selectedTable === 'carts' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5">Lead #{row.lead_id}</td>
                        <td className="px-4 py-2.5">Prod #{row.product_id}</td>
                        <td className="px-4 py-2.5">{row.quantidade} x</td>
                        <td className="px-4 py-2.5 text-white font-bold">{row.size || 'U'}</td>
                      </>
                    )}
                    {selectedTable === 'orders' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5">Lead #{row.lead_id}</td>
                        <td className="px-4 py-2.5 text-emerald-400 font-bold">R$ {row.total.toFixed(2)}</td>
                        <td className="px-4 py-2.5 font-sans">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-950 text-emerald-350">{row.status_pagamento}</span>
                        </td>
                        <td className="px-4 py-2.5 font-sans select-all">{row.transaction_id}</td>
                      </>
                    )}
                    {selectedTable === 'users' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5 text-white font-sans font-semibold">{row.nome}</td>
                        <td className="px-4 py-2.5">{row.email}</td>
                        <td className="px-4 py-2.5 text-slate-500 font-sans truncate max-w-[120px]">{row.senha_hash}</td>
                      </>
                    )}
                    {selectedTable === 'messages_log' && (
                      <>
                        <td className="px-4 py-2.5 text-indigo-400 font-bold">#{row.id}</td>
                        <td className="px-4 py-2.5">Lead #{row.lead_id}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1 rounded text-[8px] font-bold ${row.direcao === 'out' ? 'bg-indigo-950 text-indigo-300' : 'bg-slate-850 text-slate-300'}`}>
                            {row.direcao ? row.direcao.toUpperCase() : 'IN'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-sans text-slate-200 line-clamp-1 truncate max-w-[250px]">{row.texto}</td>
                        <td className="px-4 py-2.5 font-sans text-slate-450">{row.data_envio.slice(11, 16)}h</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Execution Console */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-5 h-5 text-indigo-400" />
            Terminal de Consulta SQLite Interativo (Read Query)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Simule a execução de consultas de leitura SQL estruturadas para o banco de dados local.
          </p>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleRunQuery} className="flex gap-2">
          <div className="relative flex-grow">
            <Terminal className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-indigo-455" />
            <input
              type="text"
              placeholder="Digite sua query SELECT (Ex: SELECT * FROM leads)"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              className="w-full bg-slate-950 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-indigo-300 placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white" />
            Executar
          </button>
        </form>

        {/* Console output display */}
        {(terminalResult !== null || terminalError) && (
          <div className="bg-slate-950 rounded-xl border border-white/5 p-4 font-mono text-xs overflow-auto max-h-[300px]">
            {terminalError ? (
              <span className="text-rose-400 font-bold block">{terminalError}</span>
            ) : terminalResult.length === 0 ? (
              <span className="text-slate-550 block font-semibold">Tabela retornou zero registros para sua query.</span>
            ) : (
              <table className="min-w-full divide-y divide-white/5 text-left text-xs font-mono text-slate-300">
                <thead>
                  <tr>
                    {terminalHeaders.map(h => (
                      <th key={h} className="pb-2 text-slate-450 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-[11px]">
                  {terminalResult.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-white/5">
                      {terminalHeaders.map(h => (
                        <td key={h} className="py-1.5 pr-2 truncate max-w-[200px] text-slate-200">
                          {String(item[h] !== undefined ? item[h] : '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="flex gap-2.5 pt-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setQueryInput('SELECT * FROM leads'); }}
            className="py-1 px-2.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-[9px] font-mono text-slate-400 cursor-pointer"
          >
            Buscar todos os Leads
          </button>
          <button
            type="button"
            onClick={() => { setQueryInput('SELECT * FROM products WHERE estoque > 0'); }}
            className="py-1 px-2.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-[9px] font-mono text-slate-400 cursor-pointer"
          >
            Buscar Produtos em Estoque
          </button>
          <button
            type="button"
            onClick={() => { setQueryInput('SELECT * FROM messages_log'); }}
            className="py-1 px-2.5 bg-slate-950 hover:bg-slate-800 rounded-lg text-[9px] font-mono text-slate-400 cursor-pointer"
          >
            Buscar Logs de Mensagens
          </button>
        </div>
      </div>

    </div>
  );
}
