/**
 * botConfig.js — Configuração do bot e do fluxo base.
 *
 * Tempos de inatividade CONFIGURÁVEIS por variáveis de ambiente:
 *   BOT_REMINDER_MINUTES  (padrão 15) — lembrete "ainda está em atendimento?"
 *   BOT_RESET_MINUTES     (padrão 30) — reseta a interação por inatividade
 *
 * O fluxo é declarativo. Cada bloco pode:
 *   - text: mensagem fixa (suporta {nome})
 *   - dynamic: nome de uma função de banco (resolvida no botEngine) que devolve texto
 *   - options: respostas numéricas que levam a outro bloco
 *   - action: efeito colateral ('pause_bot', 'register', 'reset')
 *   - next: próximo bloco (para passos sequenciais, ex.: cadastro)
 */

const minutes = (envKey, fallback) => {
  const v = parseInt(process.env[envKey], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

const CONFIG = {
  reminderMinutes: minutes('BOT_REMINDER_MINUTES', 15),
  resetMinutes: minutes('BOT_RESET_MINUTES', 30),
  // Permite alterar em runtime via endpoint (mantém override em memória)
  set(partial) {
    if (partial.reminderMinutes > 0) this.reminderMinutes = Number(partial.reminderMinutes);
    if (partial.resetMinutes > 0) this.resetMinutes = Number(partial.resetMinutes);
  },
};

// Bloco inicial para quem JÁ é cadastrado
const START_REGISTERED = 'menu';
// Bloco inicial para quem NÃO é cadastrado
const START_UNREGISTERED = 'cadastro_inicio';

const FLOW = {
  // ---------------- Cadastro (usuário não cadastrado) ----------------
  cadastro_inicio: {
    title: 'Boas-vindas / Cadastro',
    text:
      '👋 Olá! Seja bem-vindo(a) à *Moda Express Premium*!\n\n' +
      'Vejo que é sua primeira vez por aqui. Para um atendimento personalizado, ' +
      'preciso te cadastrar rapidinho. 😊\n\nQual é o seu *nome completo*?',
    expects: 'text',
    next: 'cadastro_email',
    capture: 'nome',
  },
  cadastro_email: {
    title: 'Cadastro — e-mail',
    text: 'Perfeito, {nome}! Agora me informe o seu *melhor e-mail*:',
    expects: 'text',
    next: 'cadastro_fim',
    capture: 'email',
  },
  cadastro_fim: {
    title: 'Cadastro concluído',
    text:
      '✅ Cadastro concluído, {nome}! Seus dados foram salvos no nosso banco.\n\n' +
      'Agora é só seguir. 👇',
    action: 'register',
    next: 'menu',
  },

  // ---------------- Menu principal (cadastrado) ----------------
  menu: {
    title: 'Menu principal',
    text:
      'Olá, {nome}! Como posso te ajudar hoje? 🛍️\n\n' +
      '*1* - 👗 Ver catálogo (consulta o banco)\n' +
      '*2* - 📦 Status dos meus pedidos (consulta o banco)\n' +
      '*3* - 🛒 Minha sacola\n' +
      '*4* - 👨‍💻 Falar com um atendente humano\n\n' +
      'Digite o número da opção desejada.',
    expects: 'option',
    options: {
      '1': 'catalogo',
      '2': 'meus_pedidos',
      '3': 'sacola',
      '4': 'suporte',
    },
  },

  // ---------------- Blocos que consultam o BANCO ----------------
  catalogo: {
    title: 'Catálogo (DB: products)',
    dynamic: 'listarProdutos', // resolve do SQLite
    next: 'menu',
  },
  meus_pedidos: {
    title: 'Status de pedidos (DB: orders)',
    dynamic: 'listarPedidos',
    next: 'menu',
  },
  sacola: {
    title: 'Sacola (DB: carts)',
    dynamic: 'listarSacola',
    next: 'menu',
  },

  // ---------------- Suporte humano (handoff) ----------------
  suporte: {
    title: 'Suporte humano',
    text:
      '👨‍💻 Certo! Já chamei um atendente humano. A automação foi *pausada* — ' +
      'a partir de agora você fala diretamente com nossa equipe.\n\n' +
      'Assim que o atendimento for encerrado, o assistente volta a responder. 🙌',
    action: 'pause_bot',
  },
};

module.exports = { CONFIG, FLOW, START_REGISTERED, START_UNREGISTERED };
