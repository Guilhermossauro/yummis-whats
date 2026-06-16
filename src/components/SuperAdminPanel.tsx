import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Trash2, 
  Edit3, 
  PlusCircle, 
  UserPlus, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Check, 
  X, 
  Sliders, 
  LogOut, 
  Save, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { SQLSeller, GatewayUser } from '../types';

interface SuperAdminProps {
  sellers: SQLSeller[];
  employeeLimit: number;
  onAddSeller: (seller: Omit<SQLSeller, 'id' | 'criado_em'>) => boolean; // return success/fail
  onEditSeller: (id: string, updated: Partial<SQLSeller>) => void;
  onDeleteSeller: (id: string) => void;
  onUpdateLimit: (limit: number) => void;
  onLogout: () => void;
  gatewayUsers?: GatewayUser[];
  onRefreshGatewayUsers?: () => void;
  onSetGatewayUserStatus?: (id: string, status: 'active' | 'pending' | 'blocked') => void;
  onUpdateGatewayStoreName?: (id: string, storeName: string) => Promise<{ success: boolean; error?: string }>;
}

export default function SuperAdminPanel({
  sellers,
  employeeLimit,
  onAddSeller,
  onEditSeller,
  onDeleteSeller,
  onUpdateLimit,
  onLogout,
  gatewayUsers = [],
  onRefreshGatewayUsers,
  onSetGatewayUserStatus,
  onUpdateGatewayStoreName
}: SuperAdminProps) {
  
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newStoreName, setNewStoreName] = useState('');
  
  // Edit mode tracking
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editStoreName, setEditStoreName] = useState('');
  const [editingGatewayUserId, setEditingGatewayUserId] = useState<string | null>(null);
  const [editingGatewayStoreName, setEditingGatewayStoreName] = useState('');
  
  const [localLimit, setLocalLimit] = useState(employeeLimit);
  const [notif, setNotif] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);

  const triggerNotif = (type: 'success' | 'warning' | 'error', text: string) => {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 4000);
  };

  const handleCreateSeller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim() || !newStoreName.trim()) {
      triggerNotif('error', 'Por favor preencha todos os campos do vendedor, incluindo o nome da loja.');
      return;
    }
    if (sellers.some(s => s.store_name.trim().toLowerCase() === newStoreName.trim().toLowerCase())) {
      triggerNotif('error', 'Já existe outra loja cadastrada com esse nome.');
      return;
    }

    const success = onAddSeller({
      name: newName,
      email: newEmail,
      senha_hash: newPassword,
      store_name: newStoreName
    });

    if (success) {
      triggerNotif('success', `Vendedor "${newName}" da loja "${newStoreName}" cadastrado com sucesso!`);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewStoreName('');
    } else {
      triggerNotif('error', 'Ops! Já existe um usuário cadastrado com este e-mail.');
    }
  };

  const handleStartEdit = (seller: SQLSeller) => {
    setEditingId(seller.id);
    setEditName(seller.name);
    setEditEmail(seller.email);
    setEditPassword(seller.senha_hash);
    setEditStoreName(seller.store_name || '');
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim() || !editEmail.trim() || !editPassword.trim() || !editStoreName.trim()) {
      triggerNotif('error', 'Os campos não podem ser vazios.');
      return;
    }
    if (sellers.some(s => s.id !== id && s.store_name.trim().toLowerCase() === editStoreName.trim().toLowerCase())) {
      triggerNotif('error', 'Já existe outra loja cadastrada com esse nome.');
      return;
    }

    onEditSeller(id, {
      name: editName,
      email: editEmail,
      senha_hash: editPassword,
      store_name: editStoreName
    });

    setEditingId(null);
    triggerNotif('success', 'Cadastro do vendedor atualizado com sucesso!');
  };

  const handleSaveLimit = () => {
    if (localLimit < 1) {
      triggerNotif('error', 'O limite de funcionários deve ser de no mínimo 1.');
      return;
    }
    onUpdateLimit(localLimit);
    triggerNotif('success', `Limite global de funcionários atualizado para ${localLimit}.`);
  };

  const handleStartGatewayEdit = (user: GatewayUser) => {
    setEditingGatewayUserId(user.id);
    setEditingGatewayStoreName(user.storeName || user.username || '');
  };

  const handleCancelGatewayEdit = () => {
    setEditingGatewayUserId(null);
    setEditingGatewayStoreName('');
  };

  const handleSaveGatewayEdit = async (userId: string) => {
    const nextName = editingGatewayStoreName.trim();
    if (!nextName) {
      triggerNotif('error', 'Informe um nome válido para a loja.');
      return;
    }
    if (!onUpdateGatewayStoreName) return;
    const result = await onUpdateGatewayStoreName(userId, nextName);
    if (!result.success) {
      triggerNotif('error', result.error || 'Não foi possível atualizar a loja.');
      return;
    }
    handleCancelGatewayEdit();
    triggerNotif('success', 'Nome da loja atualizado com sucesso.');
  };

  return (
    <div className="space-y-6" id="super-admin-root-viewport">
      
      {/* HEADER BAR FOR SUPERADMIN */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 bg-slate-900/60 border border-white/10 rounded-3xl backdrop-blur-md gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-650 rounded-2xl flex items-center justify-center text-white border border-indigo-400/30 shadow-[0_0_15px_rgba(79,70,229,0.3)] animate-pulse">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight font-sans">PROVEDOR SUPER_ADMIN</h1>
            <p className="text-slate-400 text-xs font-sans">Acesso master irrestrito para controle de vendedores e logins do Moda Express</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-[10px] font-mono text-slate-505 bg-slate-950 px-2.5 py-1 rounded border border-white/5 uppercase">
            Sessão: Master Central
          </span>
          <button
            onClick={onLogout}
            className="px-3.5 py-1.5 bg-rose-955/40 text-rose-400 hover:bg-rose-900 border border-rose-500/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair do Master
          </button>
        </div>
      </div>

      {/* NOTIFICATIONS FEEDBACK DIALOG */}
      {notif && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3.5 rounded-2xl text-xs text-center border font-sans ${
            notif.type === 'success' 
              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20' 
              : notif.type === 'warning'
                ? 'bg-amber-950/40 text-amber-300 border-amber-500/20'
                : 'bg-rose-950/40 text-rose-350 border-rose-500/20'
          }`}
        >
          {notif.type === 'warning' && <AlertTriangle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />}
          {notif.text}
        </motion.div>
      )}

      <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Lojas do Gateway
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Cadastros criados pela tela inicial ficam pendentes até a aprovação do administrador.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshGatewayUsers}
            className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-white/10 text-xs text-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[...gatewayUsers]
            .sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1))
            .map(user => (
              <div key={user.id} className="bg-slate-950/70 border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {editingGatewayUserId === user.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingGatewayStoreName}
                          onChange={(e) => setEditingGatewayStoreName(e.target.value)}
                          className="w-full bg-slate-900 border border-indigo-500/20 rounded-lg px-2 py-1.5 text-xs text-white"
                          placeholder="Nome da loja"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveGatewayEdit(user.id)}
                            className="px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelGatewayEdit}
                            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-bold border border-white/10"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-white truncate">{user.storeName || user.username}</p>
                    )}
                    <p className="text-[10px] text-slate-500 truncate">{user.username}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[8px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                      user.status === 'pending'
                        ? 'bg-amber-950/50 text-amber-300 border-amber-500/20'
                        : user.status === 'blocked'
                          ? 'bg-rose-950/50 text-rose-300 border-rose-500/20'
                          : 'bg-emerald-950/50 text-emerald-300 border-emerald-500/20'
                    }`}>
                      {user.status === 'pending' ? 'Aguardando' : user.status === 'blocked' ? 'Bloqueada' : 'Aprovada'}
                    </span>
                    {editingGatewayUserId !== user.id && (
                      <button
                        type="button"
                        onClick={() => handleStartGatewayEdit(user)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-white/10"
                        title="Editar nome da loja"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSetGatewayUserStatus?.(user.id, 'active')}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900 text-emerald-300 text-[10px] font-bold border border-emerald-500/10 flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetGatewayUserStatus?.(user.id, 'blocked')}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900 text-rose-300 text-[10px] font-bold border border-rose-500/10 flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Bloquear
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL LEFT: CONTROLS & NEW SELLERS CREATOR - 4 cols */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* LIMIT CARD CONFIGURATOR */}
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-16 -mt-16" />
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5 font-sans">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Configuração de Limites
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
              Defina o limite global de colaboradores que a loja do comerciante pode criar na base SQLite ativa:
            </p>

            <div className="space-y-3">
              <label className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Limite Máximo de Contas</label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  min="1"
                  value={localLimit}
                  onChange={(e) => setLocalLimit(Number(e.target.value))}
                  className="flex-1 bg-slate-950 border border-white/5 rounded-xl px-3 py-2.5 text-xs text-white text-center font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleSaveLimit}
                  className="px-4 bg-indigo-650 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar
                </button>
              </div>

              {/* Progress counter status */}
              <div className="bg-slate-950/65 rounded-2xl p-3 border border-white/5 space-y-2 mt-2">
                <div className="flex justify-between text-[10px] font-mono text-slate-440">
                  <span>Sellers Cadastrados:</span>
                  <span className="text-indigo-400 font-bold">{sellers.length} de {employeeLimit}</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-500 h-full transition-all" 
                    style={{ width: `${Math.min(100, (sellers.length / employeeLimit) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* CREATION FORM CARD */}
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md">
            <h3 className="text-xs font-extrabold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5 font-sans">
              <UserPlus className="w-4 h-4 text-indigo-400" />
              Cadastrar Novo Vendedor
            </h3>

            <form onSubmit={handleCreateSeller} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Nome Completo</label>
                <input 
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Lucas Rossi"
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">E-mail de Login</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input 
                    type="email" 
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="lucas@modaexpress.com"
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Senha de Acesso</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 dígitos"
                    className="w-full bg-slate-950 border border-white/5 rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-slate-500 uppercase font-mono">Nome da Loja</label>
                <input 
                  type="text" 
                  value={newStoreName}
                  onChange={(e) => setNewStoreName(e.target.value)}
                  placeholder="Ex: Closet Elegante"
                  className="w-full bg-slate-950 border border-white/5 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans font-bold"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-650 hover:bg-indigo-550 active:scale-98 transition-all text-xs font-bold text-white rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-1.5 mt-2.5"
              >
                <PlusCircle className="w-4 h-4" />
                Registrar Vendedor
              </button>
            </form>
          </div>

        </div>

        {/* PANEL RIGHT: LIST & ACTIONS - 8 cols */}
        <div className="lg:col-span-8 flex flex-col">
          
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex-grow space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5 font-sans">
                <Users className="w-4 h-4 text-indigo-400" />
                Vendedores e Usuários Cadastrados
              </h3>
              <span className="text-[10px] bg-slate-955 text-slate-400 font-mono px-2 py-0.5 rounded border border-white/5">
                Sellers: {sellers.length} de {employeeLimit}
              </span>
            </div>

            {sellers.length === 0 ? (
              <div className="py-20 text-center text-slate-650 text-xs flex flex-col items-center justify-center space-y-2">
                <Users className="w-8 h-8 text-slate-800" />
                <span>Nenhum vendedor ou usuário cadastrado na base SQLite.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/5 text-slate-550 uppercase text-[9px] font-mono tracking-widest">
                      <th className="py-3 px-2">Nome</th>
                      <th className="py-3 px-2">Loja</th>
                      <th className="py-3 px-2">E-mail de Acesso</th>
                      <th className="py-3 px-2">Senha cadastrada</th>
                      <th className="py-3 px-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans text-slate-200">
                    {sellers.map((seller) => {
                      const isEditing = editingId === seller.id;
                      return (
                        <tr key={seller.id} className="hover:bg-white/10/3 transition-all">
                          <td className="py-3.5 px-2">
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-xs text-white max-w-[120px]"
                              />
                            ) : (
                              <span className="font-bold text-white">{seller.name}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2">
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={editStoreName}
                                onChange={(e) => setEditStoreName(e.target.value)}
                                className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-xs text-indigo-300 max-w-[120px]"
                              />
                            ) : (
                              <span className="text-indigo-400 font-semibold">{seller.store_name || 'Sem Loja'}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 font-mono text-slate-355">
                            {isEditing ? (
                              <input 
                                type="email" 
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-xs text-white max-w-[160px]"
                              />
                            ) : (
                              <span>{seller.email}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 font-mono">
                            {isEditing ? (
                              <input 
                                type="text" 
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                className="bg-slate-950 border border-white/5 rounded px-2 py-1 text-[11px] text-white max-w-[100px] font-mono"
                              />
                            ) : (
                              <span className="text-slate-500 font-mono tracking-widest">••••••</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              {isEditing ? (
                                <>
                                  <button
                                    onClick={() => handleSaveEdit(seller.id)}
                                    className="p-1 px-2.5 bg-indigo-650 hover:bg-indigo-500 rounded text-[10px] text-white font-bold flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    Confirmar
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="p-1 px-2.5 bg-slate-800 hover:bg-slate-705 rounded text-[10px] text-slate-300 flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleStartEdit(seller)}
                                    className="p-1 bg-slate-800 hover:bg-slate-705 text-indigo-400 rounded cursor-pointer"
                                    title="Editar Login/Senha"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => onDeleteSeller(seller.id)}
                                    className="p-1 bg-slate-800 hover:bg-rose-900 hover:text-rose-400 text-rose-450 rounded cursor-pointer"
                                    title="Excluir Vendedor"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
