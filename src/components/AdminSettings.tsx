import React, { useState } from 'react';
import { Settings, User, Key, KeyRound, Wifi, Database, Check, Phone, ShieldCheck, Mail, Bot, Plus, Trash2, Edit3, Users, X } from 'lucide-react';
import { WhatsAppConfig, SQLEmployee, SQLSeller } from '../types';
import BotFlowBuilder from './BotFlowBuilder';
import { getSendMessageURL, isGatewayMode } from '../lib/gateway';

interface SettingsProps {
  whatsAppConfig: WhatsAppConfig;
  onUpdateWhatsAppConfig: (config: WhatsAppConfig) => void;
  lojista: { name: string; email: string; store_name?: string } | null;
  onUpdateProfile: (name: string, email: string, storeName?: string) => void;
  onResetPassword: (password: string) => void;
  employees?: SQLEmployee[];
  employeeLimit?: number;
  sellers?: SQLSeller[];
  onAddEmployee?: (name: string, email: string, senha_hash: string, sellerId: string) => { success: boolean; msg: string };
  onEditEmployee?: (id: string, updated: Partial<SQLEmployee>) => void;
  onDeleteEmployee?: (id: string) => void;
}

export default function AdminSettings({
  whatsAppConfig,
  onUpdateWhatsAppConfig,
  lojista,
  onUpdateProfile,
  onResetPassword,
  employees = [],
  employeeLimit = 5,
  sellers = [],
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee
}: SettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'whatsapp' | 'profile' | 'bot_flow' | 'employees'>('bot_flow');

  // Employee CRUD states
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState('');
  const [editEmpEmail, setEditEmpEmail] = useState('');
  const [editEmpPassword, setEditEmpPassword] = useState('');

  
  // WhatsApp settings states
  const [mode, setMode] = useState<WhatsAppConfig['mode']>(whatsAppConfig.mode);
  const [apiKey, setApiKey] = useState(whatsAppConfig.apiKey);
  const [instanceName, setInstanceName] = useState(whatsAppConfig.instanceName);
  // Vazio = usa a URL dinâmica do gateway (Yummis API) detectada pela origem atual.
  const [apiURL, setApiURL] = useState(whatsAppConfig.apiURL || '');

  // Profile states
  const [name, setName] = useState(lojista?.name || '');
  const [email, setEmail] = useState(lojista?.email || '');
  const [storeName, setStoreName] = useState(lojista?.store_name || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [notif, setNotif] = useState({ type: '', msg: '' });

  const handleWhatsAppSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateWhatsAppConfig({
      mode,
      apiKey,
      instanceName,
      apiURL
    });
    setNotif({ type: 'success', msg: 'Configurações do WhatsApp atualizadas com sucesso!' });
    setTimeout(() => setNotif({ type: '', msg: '' }), 3000);
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setNotif({ type: 'error', msg: 'Favor preencher nome e e-mail.' });
      return;
    }
    onUpdateProfile(name, email, storeName);
    setNotif({ type: 'success', msg: 'Informações de perfil atualizadas com sucesso!' });
    setTimeout(() => setNotif({ type: '', msg: '' }), 3000);
  };

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) {
      setNotif({ type: 'error', msg: 'Digite a nova senha.' });
      return;
    }
    if (newPassword.length < 6) {
      setNotif({ type: 'error', msg: 'A senha deve possuir pelo menos 6 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setNotif({ type: 'error', msg: 'As senhas não coincidem.' });
      return;
    }
    onResetPassword(newPassword);
    setNewPassword('');
    setConfirmPassword('');
    setNotif({ type: 'success', msg: 'Sua senha foi redefinida com sucesso!' });
    setTimeout(() => setNotif({ type: '', msg: '' }), 3000);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6" id="settings-component-root">
      
      {/* Sidebar sub-nav */}
      <div className="md:col-span-3 space-y-2 bg-slate-950/40 p-4 border border-white/5 rounded-2xl">
        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-2 font-mono">Configurações Gerais</span>
        
        <button
          onClick={() => setActiveSubTab('whatsapp')}
          className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
            activeSubTab === 'whatsapp'
              ? 'bg-indigo-650/25 text-indigo-400 border border-indigo-500/10'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Wifi className="w-4 h-4" />
          Conexão WhatsApp
        </button>

        <button
          onClick={() => setActiveSubTab('profile')}
          className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
            activeSubTab === 'profile'
              ? 'bg-indigo-650/25 text-indigo-400 border border-indigo-500/10'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <User className="w-4 h-4" />
          Perfil & Segurança
        </button>

        <button
          onClick={() => setActiveSubTab('bot_flow')}
          className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
            activeSubTab === 'bot_flow'
              ? 'bg-indigo-650/25 text-indigo-400 border border-indigo-500/10'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Bot className="w-4 h-4" />
          Fluxo do Chatbot
        </button>

        <button
          onClick={() => setActiveSubTab('employees')}
          className={`w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
            activeSubTab === 'employees'
              ? 'bg-indigo-650/25 text-indigo-400 border border-indigo-500/10'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400" />
          Cadastrar Funcionários
        </button>
      </div>

      {/* Settings Form Body area */}
      <div className="md:col-span-9 space-y-6">
        {notif.msg && (
          <div className={`p-3 rounded-xl text-xs text-center border font-sans ${
            notif.type === 'success' 
              ? 'bg-emerald-950/40 border-emerald-500/25 text-emerald-300' 
              : 'bg-rose-950/40 border-rose-500/25 text-rose-300'
          }`}>
            {notif.msg}
          </div>
        )}

        {activeSubTab === 'whatsapp' && (
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-6">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                <Wifi className="w-5 h-5 text-indigo-400" />
                Mecanismo de Mensagens & Envio
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Selecione como os disparos do chatbot de faturamento Pix e lembretes de abandono serão processados pelo sistema:
              </p>
            </div>

            {/* Selector boxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Sandbox */}
              <button
                type="button"
                onClick={() => setMode('sandbox')}
                className={`p-4 text-left rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  mode === 'sandbox'
                    ? 'border-indigo-550 bg-indigo-950/20 shadow-inner'
                    : 'border-white/5 hover:border-slate-700 bg-slate-950/20'
                }`}
              >
                <span className="text-[11px] font-extrabold text-white uppercase tracking-wide">1. Modo Sandbox</span>
                <p className="text-[10px] text-slate-400 font-sans mt-1.5 leading-relaxed">
                  Cria logs locais instantâneos na tela. Perfeito para demonstrar e ensaiar o fluxo sem taxas de mensagens reais.
                </p>
                <span className={`text-[8px] font-mono font-bold mt-3 uppercase px-1.5 py-0.2 rounded-full self-start ${
                  mode === 'sandbox' ? 'bg-indigo-650 text-white' : 'bg-slate-900 text-slate-550'
                }`}> Ativo no Painel </span>
              </button>

              {/* Baileys */}
              <button
                type="button"
                onClick={() => setMode('baileys')}
                className={`p-4 text-left rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  mode === 'baileys'
                    ? 'border-indigo-550 bg-indigo-950/20 shadow-inner'
                    : 'border-white/5 hover:border-slate-700 bg-slate-950/20'
                }`}
              >
                <span className="text-[11px] font-extrabold text-white uppercase tracking-wide">2. Simulado Baileys</span>
                <p className="text-[10px] text-slate-400 font-sans mt-1.5 leading-relaxed">
                  Estrutura inputs e logs no console. Pronto para plugar bibliotecas Node Baileys locais ou Docker VPS.
                </p>
                <span className={`text-[8px] font-mono font-bold mt-3 uppercase px-1.5 py-0.2 rounded-full self-start ${
                  mode === 'baileys' ? 'bg-indigo-650 text-white' : 'bg-slate-900 text-slate-550'
                }`}> Pré-Emulado </span>
              </button>

              {/* Yummis API (nosso gateway) */}
              <button
                type="button"
                onClick={() => setMode('yummis')}
                className={`p-4 text-left rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                  isGatewayMode(mode)
                    ? 'border-indigo-550 bg-indigo-950/20 shadow-inner'
                    : 'border-white/5 hover:border-slate-700 bg-slate-950/20'
                }`}
              >
                <span className="text-[11px] font-extrabold text-white uppercase tracking-wide">3. Yummis API</span>
                <p className="text-[10px] text-slate-400 font-sans mt-1.5 leading-relaxed">
                  Dispara mensagens reais pelo nosso Gateway WhatsApp (Baileys). A URL é detectada automaticamente pelo endereço atual.
                </p>
                <span className={`text-[8px] font-mono font-bold mt-3 uppercase px-1.5 py-0.2 rounded-full self-start ${
                  isGatewayMode(mode) ? 'bg-indigo-650 text-white' : 'bg-slate-900 text-slate-550'
                }`}> Gateway Ativo </span>
              </button>
            </div>

            {/* Inputs do nosso Gateway (Yummis API) */}
            {isGatewayMode(mode) && (
              <form onSubmit={handleWhatsAppSave} className="space-y-4 pt-4 border-t border-white/5 animate-fadeIn">
                <div className="space-y-1.5 font-mono">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Token de Acesso (API Token Yummis)</label>
                  <input
                    type="text"
                    required
                    placeholder="Cole o API token gerado no painel do Gateway (/connection)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider font-mono">
                    Endpoint da Yummis API (detectado automaticamente)
                  </label>
                  <input
                    type="text"
                    placeholder={getSendMessageURL()}
                    value={apiURL}
                    onChange={(e) => setApiURL(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white placeholder-slate-700 font-sans"
                  />
                  <p className="text-[10px] text-slate-500 font-sans">
                    Deixe em branco para usar a URL dinâmica: <code className="text-indigo-400">{getSendMessageURL()}</code>
                  </p>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-white/5 text-[10px] text-slate-450 leading-relaxed font-mono">
                  <span className="text-slate-300 font-bold block mb-1">Como funciona a Yummis API:</span>
                  1. POST para o gateway com o cabeçalho <code className="text-indigo-400">Authorization: Bearer [API_Token]</code>.<br />
                  2. A URL acompanha o endereço atual do navegador — funciona igual em localhost ou exposto via ngrok (sob <code className="text-indigo-400">/connection</code>).<br />
                  3. Garanta que o WhatsApp esteja conectado no painel do Gateway.
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white cursor-pointer"
                >
                  Salvar Credenciais Yummis API
                </button>
              </form>
            )}

            {!isGatewayMode(mode) && (
              <div className="flex justify-end pt-4 border-t border-white/5">
                <button
                  onClick={handleWhatsAppSave}
                  className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white cursor-pointer"
                >
                  Salvar Modo de Operação
                </button>
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profile editing form */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-5 h-5 text-indigo-400" />
                  Editar Conta do Lojista
                </h3>
                <p className="text-xs text-slate-400 mt-1">Atualize seus dados pessoais cadastrados de administrador:</p>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Nome de Operador</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">E-mail Administrativo</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Nome da Loja</label>
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                      placeholder="Ex: Moda Express Premium"
                    />
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-white/5 flex">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Salvar Perfil de Lojista
                  </button>
                </div>
              </form>
            </div>

            {/* Redefinição de Senha */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-400" />
                  Redefinir Senha
                </h3>
                <p className="text-xs text-slate-400 mt-1">Crie uma nova credencial segura para seu login de painel:</p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-4 h-full flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Nova Senha (mín. 6 dígitos)</label>
                    <input
                      type="password"
                      required
                      placeholder="Sua senha forte de segurança"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Confirmar Nova Senha</label>
                    <input
                      type="password"
                      required
                      placeholder="Confirme a senha forte"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 mt-6 border-t border-white/5 flex">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-650 hover:bg-indigo-500 transition-all rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    Mudar Senha de Acesso
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeSubTab === 'bot_flow' && (
          <BotFlowBuilder />
        )}

        {activeSubTab === 'employees' && (
          <div className="space-y-6" id="settings-employees-section">
            {/* Header and stats */}
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  Módulo de Registro de Funcionários
                </h3>
                <p className="text-xs text-slate-400 mt-1">Crie e gerencie contas adicionais de equipe para operar o WhatsApp em sua loja.</p>
              </div>

              <div className="bg-slate-950 px-4 py-2 rounded-xl border border-white/5 text-center shrink-0">
                <span className="text-[10px] text-slate-500 block font-mono uppercase">Limite da Loja</span>
                <span className="text-sm font-extrabold text-white">
                  {employees.filter(e => e.seller_id === sellers.find(s => s.email.toLowerCase() === lojista.email.toLowerCase())?.id).length} / {employeeLimit} ativos
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form to Create */}
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4 lg:col-span-5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono block">Cadastrar Novo Acesso</span>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!empName.trim() || !empEmail.trim() || !empPassword.trim()) {
                      setNotif({ type: 'error', msg: 'Favor preencher todos os campos do funcionário.' });
                      return;
                    }
                    const sId = sellers.find(s => s.email.toLowerCase() === lojista.email.toLowerCase())?.id;
                    if (!sId) {
                      setNotif({ type: 'error', msg: 'Erro técnico: Vendedor de origem não localizado.' });
                      return;
                    }
                    if (onAddEmployee) {
                      const res = onAddEmployee(empName, empEmail, empPassword, sId);
                      if (res.success) {
                        setNotif({ type: 'success', msg: res.msg });
                        setEmpName('');
                        setEmpEmail('');
                        setEmpPassword('');
                      } else {
                        setNotif({ type: 'error', msg: res.msg });
                      }
                    }
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-mono font-bold tracking-wider">Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Oliveira"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-mono font-bold tracking-wider">E-mail para Login</label>
                    <input
                      type="email"
                      required
                      placeholder="Ex: carlos@sualoja.com"
                      value={empEmail}
                      onChange={(e) => setEmpEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 uppercase font-mono font-bold tracking-wider">Senha de Acesso</label>
                    <input
                      type="password"
                      required
                      placeholder="Mínimo 6 dígitos"
                      value={empPassword}
                      onChange={(e) => setEmpPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 px-3 text-xs text-white font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-550 active:scale-98 transition-all text-xs font-bold text-white rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-1.5 mt-2.5"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Funcionário
                  </button>
                </form>
              </div>

              {/* Table / List */}
              <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-xl lg:col-span-7 space-y-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono block">Colaboradores Cadastrados</span>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 text-slate-500 uppercase text-[9px] font-mono tracking-widest pb-2">
                        <th className="py-2.5">Nome</th>
                        <th className="py-2.5">E-mail</th>
                        <th className="py-2.5">Senha</th>
                        <th className="py-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {employees.filter(e => e.seller_id === sellers.find(s => s.email.toLowerCase() === lojista.email.toLowerCase())?.id).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-650 text-xs font-mono">
                            Nenhum funcionário cadastrado nesta filial comercial ainda.
                          </td>
                        </tr>
                      ) : (
                        employees.filter(e => e.seller_id === sellers.find(s => s.email.toLowerCase() === lojista.email.toLowerCase())?.id).map((emp) => {
                          const isEditing = editingEmpId === emp.id;
                          return (
                            <tr key={emp.id} className="text-xs hover:bg-white/1.5 transition-colors">
                              <td className="py-3">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editEmpName}
                                    onChange={(e) => setEditEmpName(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded px-2 py-0.5 max-w-[120px] text-white"
                                  />
                                ) : (
                                  <span className="font-bold text-white">{emp.name}</span>
                                )}
                              </td>
                              <td className="py-3 font-sans text-slate-400">
                                {isEditing ? (
                                  <input
                                    type="email"
                                    value={editEmpEmail}
                                    onChange={(e) => setEditEmpEmail(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded px-2 py-0.5 max-w-[120px] text-white font-mono text-[11px]"
                                  />
                                ) : (
                                  <span>{emp.email}</span>
                                )}
                              </td>
                              <td className="py-3 font-mono text-slate-500">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editEmpPassword}
                                    onChange={(e) => setEditEmpPassword(e.target.value)}
                                    className="bg-slate-950 border border-white/10 rounded px-2 py-0.5 max-w-[80px] text-white font-mono text-[11px]"
                                  />
                                ) : (
                                  <span>{emp.senha_hash}</span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => {
                                          if (onEditEmployee) {
                                            onEditEmployee(emp.id, { name: editEmpName, email: editEmpEmail, senha_hash: editEmpPassword });
                                          }
                                          setEditingEmpId(null);
                                        }}
                                        className="p-1 hover:bg-white/10 rounded text-emerald-400 cursor-pointer"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingEmpId(null)}
                                        className="p-1 hover:bg-white/10 rounded text-slate-450 cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingEmpId(emp.id);
                                          setEditEmpName(emp.name);
                                          setEditEmpEmail(emp.email);
                                          setEditEmpPassword(emp.senha_hash);
                                         }}
                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                                        title="Editar funcionário"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (onDeleteEmployee && confirm(`Tem certeza que deseja remover o funcionário ${emp.name}?`)) {
                                            onDeleteEmployee(emp.id);
                                          }
                                        }}
                                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-rose-500 cursor-pointer"
                                        title="Deletar funcionário"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
