import React, { useState } from 'react';
import { ShieldCheck, Mail, Lock, User, Key, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: { name: string; email: string }) => void;
}

export default function AdminLogin({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('info@modaexpress.com.br');
  const [password, setPassword] = useState('123456');
  const [name, setName] = useState('Guilherme');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [forgotMode, setForgotMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (forgotMode) {
      if (!email) {
        setError('Por favor, informe seu e-mail.');
        return;
      }
      setSuccess('Instruções de redefinição de senha enviadas para ' + email);
      setTimeout(() => setForgotMode(false), 2500);
      return;
    }

    if (isLogin) {
      // Direct credentials checking
      if (email === 'adminsuper@admin.com') {
        if (password === 'Admin123') {
          onLoginSuccess({ name: 'Super Administrador', email: 'adminsuper@admin.com' });
        } else {
          setError('Senha incorreta para o Super Administrador! Use "Admin123".');
        }
      } else if (email === 'info@modaexpress.com.br' && password === '123456') {
        onLoginSuccess({ name: 'Guilherme', email });
      } else if (password.length >= 6) {
        // Allow automatic login for test flexibility
        onLoginSuccess({ name: name || 'Lojista Convidado', email });
      } else {
        setError('Credenciais inválidas! Use e-mail "info@modaexpress.com.br" e senha "123456" ou preencha qualquer senha de 6 dígitos.');
      }
    } else {
      if (!name || !email || !password) {
        setError('Preencha todos os campos.');
        return;
      }
      if (password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
      setSuccess('Conta criada com sucesso! Redirecionando...');
      setTimeout(() => {
        onLoginSuccess({ name, email });
      }, 1200);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-md">
        {/* Background flares */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -ml-16 -mb-16" />

        <div className="flex flex-col items-center text-center mb-8 relative">
          <div className="w-12 h-12 rounded-2xl bg-indigo-650 flex items-center justify-center text-white mb-3 shadow-[0_0_15px_rgba(79,70,229,0.4)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {forgotMode ? 'Redefinir Senha' : isLogin ? 'Moda Express Premium' : 'Criar Conta de Lojista'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {forgotMode 
              ? 'Informe seu e-mail para receber as instruções' 
              : isLogin 
                ? 'Acesse o Painel Administrativo e Atendimento WhatsApp' 
                : 'Cadastre sua loja e inicie suas vendas automatizadas'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-rose-300 text-xs text-center font-sans">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs text-center font-sans">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {!isLogin && !forgotMode && (
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Nome do Lojista</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Ex: Guilherme"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="Ex: info@modaexpress.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                required
              />
            </div>
          </div>

          {!forgotMode && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Senha de Acesso</label>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setError(''); }}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 hover:underline font-semibold"
                  >
                    Esqueceu?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-650 focus:ring-1 focus:ring-indigo-500 focus:outline-hidden font-sans"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-indigo-650 hover:bg-indigo-500 active:scale-98 transition-all text-xs font-bold text-white rounded-xl shadow-lg shadow-indigo-950/50 cursor-pointer flex items-center justify-center gap-2 mt-2"
          >
            {forgotMode ? 'Enviar Instruções' : isLogin ? 'Entrar no Sistema' : 'Completar Cadastro'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/5 text-center">
          {forgotMode ? (
            <button
              onClick={() => { setForgotMode(false); setError(''); }}
              className="text-xs text-slate-400 hover:text-white transition-all underline"
            >
              Voltar para o Login
            </button>
          ) : (
            <p className="text-xs text-slate-400">
              {isLogin ? 'Novo por aqui?' : 'Já possui uma conta?'}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-indigo-400 hover:text-indigo-300 font-bold ml-1.5 underline cursor-pointer"
              >
                {isLogin ? 'Cadastre sua loja' : 'Acesse sua conta'}
              </button>
            </p>
          )}
        </div>

        {isLogin && (
          <div className="mt-4 p-2 bg-slate-950/40 rounded-xl border border-white/5 text-[10px] text-slate-500 text-center font-mono">
            💡 Credenciais Admin Padrão<br />
            E-mail: <span className="text-slate-350">info@modaexpress.com.br</span> • Senha: <span className="text-slate-350">123456</span>
          </div>
        )}
      </div>
    </div>
  );
}
