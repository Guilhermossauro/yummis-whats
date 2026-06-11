import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Aplica o tema antes de renderizar (evita flash). Padrão: escuro;
// claro só quando o usuário escolher explicitamente.
if (localStorage.getItem('yms_theme') !== 'light') {
  document.documentElement.classList.add('dark');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
