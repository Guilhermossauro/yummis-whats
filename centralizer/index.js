/**
 * Servidor Centralizador
 * -----------------------
 * Reúne tudo numa ÚNICA origem (porta/host), o que torna a exposição via ngrok
 * trivial — basta um túnel apontando para este servidor.
 *
 *   /            -> redireciona para /sales/
 *   /sales/*     -> frontend (painel CRM) servido a partir de ../dist
 *                   (build feito com VITE_BASE=/sales/)
 *   /connection/*-> gateway WhatsApp (backend Baileys + painel + API)
 *                   proxy para http://localhost:3060 (prefixo /connection removido)
 *
 * Como o frontend e o painel do gateway resolvem a URL da API dinamicamente a
 * partir de window.location, ao abrir a URL pública do ngrok tudo aponta para a
 * mesma origem automaticamente — sem configurar IP/porta manualmente.
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;
const GATEWAY_TARGET = process.env.GATEWAY_URL || 'http://localhost:3060';
const FRONT_DIST = path.resolve(__dirname, '..', 'dist');

// ------------------------------------------------------------------
//  /connection -> Gateway WhatsApp (backend na 3060)
//  Remove o prefixo /connection antes de repassar (o backend serve em "/").
// ------------------------------------------------------------------
app.use(
  '/connection',
  createProxyMiddleware({
    target: GATEWAY_TARGET,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/connection': '' },
  })
);

// ------------------------------------------------------------------
//  /sales -> Frontend estático (build em ../dist com base /sales/)
// ------------------------------------------------------------------
if (!fs.existsSync(path.join(FRONT_DIST, 'index.html'))) {
  console.warn('⚠️  ../dist não encontrado. Rode o build do frontend com base /sales/:');
  console.warn('    (PowerShell)  $env:VITE_BASE="/sales/"; npm run build');
  console.warn('    (bash)        VITE_BASE=/sales/ npm run build');
}
app.use('/sales', express.static(FRONT_DIST));
// Também serve assets na raiz para evitar tela branca se alguém gerar o build
// padrão do Vite (com /assets/), em vez do build com base /sales/.
app.use('/assets', express.static(path.join(FRONT_DIST, 'assets')));
// Fallback SPA dentro de /sales
app.get('/sales/*', (req, res) => res.sendFile(path.join(FRONT_DIST, 'index.html')));

// ------------------------------------------------------------------
//  Raiz -> painel de vendas
// ------------------------------------------------------------------
app.get('/', (req, res) => res.redirect('/sales/'));

app.listen(PORT, () => {
  console.log('===================================================');
  console.log(`🧭 Centralizador ativo na porta ${PORT}`);
  console.log(`   /            -> redirect /sales/`);
  console.log(`   /sales/*     -> frontend (${FRONT_DIST})`);
  console.log(`   /connection/*-> gateway (${GATEWAY_TARGET})`);
  console.log('---------------------------------------------------');
  console.log(`   Exponha com:  ngrok http ${PORT}`);
  console.log('===================================================');
});
