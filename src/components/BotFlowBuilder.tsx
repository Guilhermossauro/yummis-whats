import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Trash2, 
  Plus, 
  RotateCcw, 
  Check, 
  GripVertical, 
  Type, 
  Sliders, 
  Settings, 
  ChevronRight, 
  FileText, 
  Zap, 
  Layers, 
  ArrowRight,
  Info 
} from 'lucide-react';
import { FlowBlock, FlowOption } from '../types';
import { DEFAULT_FLOW } from '../data/flows';

export default function BotFlowBuilder() {
  const [blocks, setBlocks] = useState<FlowBlock[]>(() => {
    const saved = localStorage.getItem('sql_bot_flow');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Falha ao ler fluxo do banco do bot', e);
      }
    }
    return [...DEFAULT_FLOW];
  });

  const [selectedBlockId, setSelectedBlockId] = useState<string>('boas_vindas');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [notif, setNotif] = useState('');

  // Node positions matching for visual drag and drop
  const [nodePositions, setNodePositions] = useState<{ [id: string]: { x: number; y: number } }>(() => {
    const saved = localStorage.getItem('sql_flow_positions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fall through
      }
    }
    return {
      boas_vindas: { x: 20, y: 50 },
      catalogo: { x: 260, y: 15 },
      carrinho: { x: 260, y: 220 },
      faturamento: { x: 500, y: 15 },
      suporte: { x: 500, y: 220 },
      limpar_sacola: { x: 740, y: 120 }
    };
  });

  useEffect(() => {
    localStorage.setItem('sql_flow_positions', JSON.stringify(nodePositions));
  }, [nodePositions]);

  const [draggingNode, setDraggingNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(10, Math.min(e.clientX - rect.left - draggingNode.offsetX, 1100));
    const y = Math.max(10, Math.min(e.clientY - rect.top - draggingNode.offsetY, 275));
    setNodePositions(prev => ({
      ...prev,
      [draggingNode.id]: { x, y }
    }));
  };

  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
  };

  // Persist flow to localstorage on changes
  useEffect(() => {
    localStorage.setItem('sql_bot_flow', JSON.stringify(blocks));
  }, [blocks]);

  const activeBlock = blocks.find(b => b.id === selectedBlockId) || blocks[0];

  const triggerNotif = (msg: string) => {
    setNotif(msg);
    setTimeout(() => setNotif(''), 3000);
  };

  // Drag-and-drop block reordering handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const updatedBlocks = [...blocks];
    const [movedBlock] = updatedBlocks.splice(draggedIndex, 1);
    updatedBlocks.splice(targetIndex, 0, movedBlock);

    setBlocks(updatedBlocks);
    setDraggedIndex(null);
    triggerNotif('Posicionamento de blocos reordenado!');
  };

  // Reset to default e-commerce flow
  const handleResetToDefault = () => {
    if (window.confirm('Tem certeza que deseja restaurar o fluxo de mensagens padrão da loja? Todas as modificações locais serão apagadas.')) {
      setBlocks(JSON.parse(JSON.stringify(DEFAULT_FLOW)));
      setSelectedBlockId('boas_vindas');
      triggerNotif('Fluxo redefinido para o padrão da loja com sucesso!');
    }
  };

  // Add new block
  const handleAddBlock = () => {
    const newId = 'custom_' + Math.floor(1000 + Math.random() * 9000);
    const newBlock: FlowBlock = {
      id: newId,
      title: '🆕 Novo Bloco de Mensagem',
      message: 'Olá! Escreva aqui a mensagem que o chatbot enviará para o cliente para este bloco.',
      type: 'message_only',
      optionType: 'numeric',
      keywordMatchType: 'exact',
      actionType: 'none',
      options: []
    };
    
    // Assign position
    const newX = 200 + Math.floor(Math.random() * 250);
    const newY = 100 + Math.floor(Math.random() * 150);
    setNodePositions(prev => ({ ...prev, [newId]: { x: newX, y: newY } }));

    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlockId(newId);
    triggerNotif('Novo bloco de chat criado!');
  };

  // Delete a block
  const handleDeleteBlock = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (blocks.length <= 1) {
      triggerNotif('Erro: O chatbot precisa conter pelo menos um bloco ativo.');
      return;
    }
    if (id === 'boas_vindas') {
      triggerNotif('Erro: Não é permitido remover o bloco de Boas-Vindas inicial.');
      return;
    }

    if (window.confirm('Excluir este bloco de mensagem?')) {
      const remaining = blocks.filter(b => b.id !== id);
      setBlocks(remaining);
      if (selectedBlockId === id) {
        setSelectedBlockId(remaining[0].id);
      }
      triggerNotif('Bloco removido com sucesso!');
    }
  };

  // Edit fields for active block
  const updateActiveBlock = (fields: Partial<FlowBlock>) => {
    setBlocks(prev => prev.map(b => b.id === activeBlock.id ? { ...b, ...fields } : b));
  };

  // Edit option details
  const handleUpdateOption = (optIndex: number, updatedFields: Partial<FlowOption>) => {
    const updatedOptions = [...activeBlock.options];
    updatedOptions[optIndex] = { ...updatedOptions[optIndex], ...updatedFields };
    updateActiveBlock({ options: updatedOptions });
  };

  // Add option to active block
  const handleAddOption = () => {
    const defaultDest = blocks.find(b => b.id !== activeBlock.id)?.id || activeBlock.id;
    const triggerValue = activeBlock.optionType === 'numeric' 
      ? String(activeBlock.options.length + 1)
      : 'palavra_chave';

    const newOption: FlowOption = {
      trigger: triggerValue,
      label: 'Opção de Menu ' + (activeBlock.options.length + 1),
      destinationBlockId: defaultDest
    };

    updateActiveBlock({
      options: [...activeBlock.options, newOption]
    });
    triggerNotif('Nova opção de decisão adicionada!');
  };

  // Delete option from active block
  const handleDeleteOption = (optIndex: number) => {
    const updatedOptions = activeBlock.options.filter((_, i) => i !== optIndex);
    // Recalculate triggers if numeric to maintain ordering (1, 2, 3...)
    if (activeBlock.optionType === 'numeric') {
      updatedOptions.forEach((opt, idx) => {
        opt.trigger = String(idx + 1);
      });
    }
    updateActiveBlock({ options: updatedOptions });
    triggerNotif('Opção excluída.');
  };

  // Change option style (numeric vs keyword) and adapt triggers accordingly
  const handleOptionTypeChange = (newType: 'numeric' | 'keyword') => {
    const updatedOptions = activeBlock.options.map((opt, idx) => ({
      ...opt,
      trigger: newType === 'numeric' ? String(idx + 1) : 'opcao_chave_exemplo'
    }));
    updateActiveBlock({
      optionType: newType,
      options: updatedOptions
    });
  };

  return (
    <div className="space-y-6" id="bot-flow-workspace">
      
      {/* Header section with instructions & actions */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400 animate-pulse" />
            Configurador de Fluxo do Bot (Drag & Drop)
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans leading-relaxed">
            Personalize a árvore de conversação do chatbot de atendimento. Ordene os blocos arrastando o ícone à esquerda do card, crie novas interações, defina opções de resposta e o bot se ajustará automaticamente no celular simulado!
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handleAddBlock}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Criar Bloco
          </button>
          
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950 border border-white/10 hover:bg-slate-900 text-slate-400 hover:text-white transition-all rounded-xl text-xs font-medium cursor-pointer font-mono"
            title="Restaurar fluxo padrão da loja"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar Padrão
          </button>
        </div>
      </div>

      {notificationDisplay(notif)}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: The Blocks sidebar with Drag and Drop order (Grid 5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block font-mono">
            Blocos de Conversa ({blocks.length})
          </span>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {blocks.map((block, idx) => {
              const isSelected = block.id === selectedBlockId;
              return (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`group relative p-3 border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-indigo-950/30 border-indigo-550 shadow-md shadow-indigo-950/20' 
                      : 'bg-slate-950/40 border-white/5 hover:border-slate-700 hover:bg-slate-950/65'
                  }`}
                >
                  <div className="flex items-center gap-3 w-5/6">
                    {/* Drag Handle icon */}
                    <div 
                      className="text-slate-500 hover:text-indigo-400 cursor-grab active:cursor-grabbing p-1 transition-colors"
                      title="Arraste para reposicionar a prioridade"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-white truncate font-sans">
                          {block.title || 'Sem título'}
                        </h4>
                        {block.isStarting && (
                          <span className="text-[7.5px] bg-emerald-950 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-mono font-bold uppercase shrink-0">
                            INÍCIO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5 font-sans leading-tight">
                        {block.message}
                      </p>
                      
                      {/* Short summary details */}
                      <div className="flex items-center gap-2 mt-1.5 text-[8.5px] text-slate-500 font-mono">
                        <span className="capitalize px-1.5 py-0.2 bg-slate-900 border border-white/5 rounded">
                          {block.type === 'message_only' ? '✉️ Apenas mensagem' : '🎛️ Menu opções'}
                        </span>
                        {block.type === 'options' && (
                          <span className="bg-slate-900 px-1 py-0.2 rounded">
                            {block.options.length} {block.options.length === 1 ? 'rota' : 'rotas'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Arrow selection visual */}
                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600'}`} />

                    {/* Trash can to delete if not starter */}
                    {block.id !== 'boas_vindas' && (
                      <button
                        onClick={(e) => handleDeleteBlock(block.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-rose-950/50 rounded text-rose-400 hover:text-rose-300 transition-all cursor-pointer"
                        title="Remover este bloco"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-indigo-950/15 border border-indigo-500/10 rounded-xl text-[10px] text-slate-400 flex gap-2 font-sans mt-3">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <strong className="text-slate-300 block mb-0.5">💡 Como usar o Drag & Drop:</strong>
              Use a alça de arrastar para ordenar ou movimentar os blocos do chatbot na lista acima. O administrador decide qual sequenciador tem prioridade nos casamentos automáticos!
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Active block detailed configurator (Grid 7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block font-mono">
            Editando Bloco: <strong className="text-white font-sans">{activeBlock.title}</strong>
          </span>

          <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-xl space-y-4">
            
            {/* Block configuration fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Visual Title (Nome Administrativo)</label>
                <input
                  type="text"
                  value={activeBlock.title}
                  onChange={(e) => updateActiveBlock({ title: e.target.value })}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-705 font-sans font-bold"
                  placeholder="Nome visual do Bloco"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">ID de Rastreamento (Identificador)</label>
                <input
                  type="text"
                  value={activeBlock.id}
                  disabled={activeBlock.id === 'boas_vindas' || activeBlock.id === 'catalogo' || activeBlock.id === 'carrinho' || activeBlock.id === 'faturamento' || activeBlock.id === 'suporte'}
                  onChange={(e) => updateActiveBlock({ id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  className="w-full bg-slate-950/60 border border-white/5 rounded-xl py-2 px-3 text-xs text-slate-400 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="identificador_do_bloco"
                  title={activeBlock.id === 'boas_vindas' ? "Blocos reservados de sistema não podem mudar ID" : ""}
                />
              </div>
            </div>

            {/* Message Body text area */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                <label>Texto da Mensagem Enviada pelo Bot</label>
                <span className="text-indigo-400 font-normal capitalize">Suporta formatação do WhatsApp (*negrito*, etc.)</span>
              </div>
              <textarea
                value={activeBlock.message}
                onChange={(e) => updateActiveBlock({ message: e.target.value })}
                rows={4}
                className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-705 font-sans leading-relaxed resize-none focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Exemplo: Olá! Seja bem-vindo à nossa loja virtual."
              />
            </div>

            {/* Flow Behavior Type selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/5">
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Comportamento do Bloco</label>
                <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => updateActiveBlock({ type: 'message_only' })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      activeBlock.type === 'message_only'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Mensagem Apenas
                  </button>

                  <button
                    type="button"
                    onClick={() => updateActiveBlock({ type: 'options' })}
                    className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                      activeBlock.type === 'options'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Card com Opções
                  </button>
                </div>
              </div>

              {/* Custom Rules & Execution Actions */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Correspondência de Opções</label>
                <select
                  value={activeBlock.keywordMatchType || 'exact'}
                  onChange={(e) => updateActiveBlock({ keywordMatchType: e.target.value as 'exact' | 'contains' })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-indigo-400 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-505"
                >
                  <option value="exact">🎯 Palavra-Chave Exata (Igualdade Estrita)</option>
                  <option value="contains">🔍 Possuir a Palavra-Chave na Mensagem (Contém)</option>
                </select>
                <span className="text-[9px] text-slate-500 block leading-tight">Mapeamento para acionar esta rota por igualdade estrita ou por correspondência parcial.</span>
              </div>

              <div className="space-y-1.5 font-sans">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono block">Ação do Sistema ao Entrar no Bloco</label>
                <select
                  value={activeBlock.actionType || 'none'}
                  onChange={(e) => updateActiveBlock({ actionType: e.target.value as any })}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-xs text-indigo-400 cursor-pointer"
                >
                  <option value="none">⚙️ Nenhuma Ação Adicional</option>
                  <option value="pause_bot">👨‍💻 Transferir p/ Suporte Humano (Pausa Automação)</option>
                  <option value="clear_cart">🧹 Esvaziar / Resetar Sacola de Compras</option>
                  <option value="set_status_carrinho">👗 Alterar Leads para CARRINHO_ABERTO</option>
                  <option value="set_status_aguardando">⏳ Alterar Leads para AGUARDANDO_PIX</option>
                  <option value="set_status_pago">🎉 Alterar Leads para PAGO (Faturamento Concluído)</option>
                </select>
                <span className="text-[9px] text-slate-500 block leading-tight">Gatilhos adicionais que alteram estados do lead quando o fluxo avança até aqui.</span>
              </div>

            </div>

            <div className="pt-2">
              {activeBlock.type === 'options' && (
                <div className="space-y-1.5 select-type">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">Gatilho de Entrada Opções</label>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => handleOptionTypeChange('numeric')}
                      className={`flex-1 flex items-center justify-center py-1.5 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeBlock.optionType === 'numeric'
                          ? 'bg-indigo-650/40 text-indigo-300 border border-indigo-500/10'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🔢 Numérico (1, 2, 3...)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOptionTypeChange('keyword')}
                      className={`flex-1 flex items-center justify-center py-1.5 text-[10.5px] font-bold rounded-lg transition-all cursor-pointer ${
                        activeBlock.optionType === 'keyword'
                          ? 'bg-indigo-650/40 text-indigo-300 border border-indigo-500/10'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ✍️ Palavras-Chave
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Menu Options Builder area */}
            {activeBlock.type === 'options' && (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest font-mono">
                    Construir Rotas e Atalhos (Interatividade)
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="flex items-center gap-1 text-[9.5px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-950/30 hover:bg-indigo-950/50 border border-indigo-550/20 px-2 py-1 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    Adicionar Rota
                  </button>
                </div>

                {activeBlock.options.length === 0 ? (
                  <div className="p-4 bg-slate-950 text-center rounded-xl border border-dashed border-white/5 text-[11px] text-slate-500">
                    Nenhuma opção configurada. Clique em "Adicionar Rota" para registrar conexões interativas!
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {activeBlock.options.map((opt, oIdx) => (
                      <div 
                        key={oIdx} 
                        className="bg-slate-950/60 p-2 rounded-xl border border-white/5 flex flex-col sm:flex-row items-center gap-2 text-xs"
                      >
                        {/* Trigger key */}
                        <div className="w-full sm:w-[90px] flex flex-col gap-1">
                          <label className="text-[8px] uppercase text-slate-550 font-bold block tracking-wider font-mono">Gatilhos</label>
                          <input
                            type="text"
                            value={opt.trigger}
                            disabled={activeBlock.optionType === 'numeric'}
                            onChange={(e) => handleUpdateOption(oIdx, { trigger: e.target.value })}
                            className="bg-slate-950 border border-white/5 rounded-lg py-1 px-1.5 text-xs text-white max-w-full font-mono font-bold text-center disabled:opacity-50"
                            placeholder="ex: falar_atend"
                            title={activeBlock.optionType === 'numeric' ? "No modo numérico, o índice do menu é sequencial automático" : "Palavras chaves separadas por vírgula"}
                          />
                        </div>

                        {/* Label name */}
                        <div className="w-full flex-1 flex flex-col gap-1">
                          <label className="text-[8px] uppercase text-slate-550 font-bold block tracking-wider">Texto de Descrição do Menu</label>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => handleUpdateOption(oIdx, { label: e.target.value })}
                            className="bg-slate-950 border border-white/5 rounded-lg py-1 px-2 text-xs text-white"
                            placeholder="👗 Ver nossa coleção"
                          />
                        </div>

                        {/* Destination select */}
                        <div className="w-full sm:w-[130px] flex flex-col gap-1">
                          <label className="text-[8px] uppercase text-slate-550 font-bold block tracking-wider">Destino Conversa</label>
                          <select
                            value={opt.destinationBlockId}
                            onChange={(e) => handleUpdateOption(oIdx, { destinationBlockId: e.target.value })}
                            className="bg-slate-950 border border-white/5 rounded-lg py-1 px-2 text-[10.5px] text-indigo-400 font-sans cursor-pointer focus:outline-none"
                          >
                            {blocks.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.title}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Trash */}
                        <button
                          type="button"
                          onClick={() => handleDeleteOption(oIdx)}
                          className="pt-4 sm:pt-2 text-rose-500 hover:text-rose-400 p-1 bg-transparent border-none outline-none cursor-pointer"
                          title="Remover opção"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Visual flowchart representation below */}
      <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider flex items-center gap-2 font-mono">
              <Layers className="w-4 h-4 text-emerald-400" />
              Mapeador de Fluxo Visual do Chatbot (Arraste os Blocos)
            </h4>
            <p className="text-[9.5px] text-slate-400 font-sans mt-0.5">
              Clique e arraste os blocos pretos para posicioná-los onde quiser. As setas de conexão do fluxo se ajustam sozinhas!
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const defaults = {
                boas_vindas: { x: 20, y: 50 },
                catalogo: { x: 250, y: 15 },
                carrinho: { x: 250, y: 220 },
                faturamento: { x: 480, y: 15 },
                suporte: { x: 480, y: 220 },
                limpar_sacola: { x: 710, y: 120 }
              };
              setNodePositions(defaults);
              triggerNotif('Layout visual redefinido!');
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-950 hover:bg-slate-900 border border-white/10 hover:border-white/20 transition-all text-[9px] font-mono text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Resetar Layout
          </button>
        </div>

        {/* The Connection Board canvas viewport */}
        <div 
          className="relative w-full h-[380px] bg-slate-950 rounded-xl border border-white/5 overflow-x-auto overflow-y-hidden bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] select-none"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* SVG Connector Pathways */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 min-w-[950px]">
            <defs>
              <marker 
                id="flow-arrow" 
                viewBox="0 0 10 10" 
                refX="6" 
                refY="5" 
                markerWidth="5" 
                markerHeight="5" 
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="rgb(129, 140, 248)" />
              </marker>
            </defs>
            {blocks.map(block => {
              const fromPos = nodePositions[block.id] || { x: 50, y: 50 };
              const isBlockSelected = block.id === selectedBlockId;
              
              return block.options?.map((opt, oIdx) => {
                const destPos = nodePositions[opt.destinationBlockId];
                if (!destPos) return null;
                
                // Coordinates from source block card to destination block card
                const startX = fromPos.x + 190; // right boundary anchor
                const startY = fromPos.y + 40 + (oIdx * 12);
                const endX = destPos.x; // left boundary anchor
                const endY = destPos.y + 35;
                
                const cp1X = startX + 40;
                const cp1Y = startY;
                const cp2X = endX - 40;
                const cp2Y = endY;
                
                return (
                  <g key={`${block.id}-path-${oIdx}`}>
                    <path
                      d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                      fill="none"
                      stroke={isBlockSelected ? "rgba(99, 102, 241, 0.65)" : "rgba(129, 140, 248, 0.25)"}
                      strokeWidth={isBlockSelected ? "2.2" : "1.5"}
                      strokeDasharray={block.actionType && block.actionType !== 'none' ? "4 2" : undefined}
                      markerEnd="url(#flow-arrow)"
                      className="transition-all"
                    />
                    <text
                      x={(startX + endX) / 2}
                      y={(startY + endY) / 2 - 4}
                      fill={isBlockSelected ? "rgb(165, 180, 252)" : "rgb(148, 163, 184)"}
                      fontSize="7.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                      className="px-1 py-0.2 bg-slate-950 font-bold"
                    >
                      {block.optionType === 'numeric' ? idxLabel(oIdx) : `"${opt.trigger}"`}
                    </text>
                  </g>
                );
              });
            })}
          </svg>

          {/* Interactive Card Nodes */}
          <div className="absolute inset-0 min-w-[950px] z-10 pointer-events-none">
            {blocks.map((block) => {
              const pos = nodePositions[block.id] || { x: 50, y: 50 };
              const isSelected = block.id === selectedBlockId;
              
              return (
                <div
                  key={block.id}
                  style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                  onMouseDown={(e) => {
                    // Start dragging node
                    e.stopPropagation();
                    const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                    if (rect) {
                      setDraggingNode({
                        id: block.id,
                        offsetX: e.clientX - rect.left - pos.x,
                        offsetY: e.clientY - rect.top - pos.y
                      });
                    }
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(block.id);
                  }}
                  className={`absolute w-[190px] p-3 rounded-xl border flex flex-col justify-between min-h-[105px] transition-all cursor-grab active:cursor-grabbing pointer-events-auto shadow-md ${
                    isSelected 
                      ? 'bg-slate-900 border-indigo-500 ring-1 ring-indigo-550/20 shadow-indigo-950/20' 
                      : 'bg-slate-950/90 border-white/5 hover:border-slate-700 hover:bg-slate-900/80 shadow-black'
                  }`}
                >
                  <div className="select-none">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-extrabold text-white truncate max-w-[125px]" title={block.title}>
                        {block.title}
                      </span>
                      <span className={`text-[7px] uppercase tracking-wider font-mono font-bold px-1 rounded ${
                        block.type === 'message_only' ? 'bg-indigo-950/40 text-indigo-400' : 'bg-emerald-950/40 text-emerald-400'
                      }`}>
                        {block.type === 'message_only' ? 'mensagem' : 'opções'}
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 line-clamp-2 leading-snug">
                      {block.message}
                    </p>
                  </div>

                  {block.actionType && block.actionType !== 'none' && (
                    <div className="mt-2 text-[7.5px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-950/30 border border-emerald-500/10 px-1.5 py-0.5 rounded leading-none shrink-0 w-max max-w-full">
                      <Zap className="w-2.5 h-2.5 shrink-0" />
                      Ação: {block.actionType.replace('set_status_', '').replace('_', ' ').toUpperCase()}
                    </div>
                  )}

                  {block.type === 'options' && block.options.length > 0 && (
                    <div className="mt-2 space-y-0.5 pt-1.5 border-t border-white/5 text-[7px] text-slate-500 font-mono">
                      {block.options.slice(0, 2).map((opt, oIdx) => {
                        const targetBlock = blocks.find(b => b.id === opt.destinationBlockId);
                        return (
                          <div key={oIdx} className="flex items-center justify-between">
                            <span className="truncate max-w-[85px] text-slate-400">
                              {block.optionType === 'numeric' ? idxLabel(oIdx) : `"${opt.trigger}"`}: {opt.label}
                            </span>
                            <span className="text-indigo-400 font-bold shrink-0">
                              → {targetBlock ? targetBlock.title.substring(0, 10) : opt.destinationBlockId}
                            </span>
                          </div>
                        );
                      })}
                      {block.options.length > 2 && (
                        <div className="text-center font-bold text-[6.5px] text-indigo-400">
                          + {block.options.length - 2} outras conexões de rota
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

function notificationDisplay(notif: string) {
  if (!notif) return null;
  return (
    <div className="p-3 bg-indigo-950/40 border border-indigo-550/20 text-indigo-300 text-xs text-center rounded-xl font-sans animate-fade">
      {notif}
    </div>
  );
}

function idxLabel(idx: number) {
  return String(idx + 1);
}
