/**
 * Servidor Centralizador — UMA única porta/origem para tudo.
 *
 *   /                      -> redireciona para /store/
 *   /store/*               -> CRM (frontend, build com VITE_BASE=/store/)
 *                             inclui a vitrine pública /store/<nome-da-loja>
 *   /gateway/*             -> Gateway WhatsApp (proxy p/ backend :3060)
 *
 * Compatibilidade: /sales -> /store ; /connection -> proxy (igual /gateway).
 *
 * Como o CRM e o painel do gateway resolvem a URL da API dinamicamente a partir
 * de window.location, ao expor via ngrok tudo aponta para a mesma origem.
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
//  /gateway (e /connection legado) -> Gateway WhatsApp (backend :3060)
//  Remove o prefixo antes de repassar (o backend serve em "/").
// ------------------------------------------------------------------
const gatewayProxy = createProxyMiddleware({
  target: GATEWAY_TARGET,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/gateway': '', '^/connection': '' },
});
app.use('/gateway', gatewayProxy);
app.use('/connection', gatewayProxy); // compatibilidade

// ------------------------------------------------------------------
//  /store -> CRM (build em ../dist com base /store/)
//  Inclui a vitrine pública: /store/<nome-da-loja> também cai no SPA.
// ------------------------------------------------------------------
if (!fs.existsSync(path.join(FRONT_DIST, 'index.html'))) {
  console.warn('⚠️  ../dist não encontrado. Gere o build do CRM com base /store/:');
  console.warn('    (PowerShell)  $env:VITE_BASE="/store/"; npm run build');
  console.warn('    (bash)        VITE_BASE=/store/ npm run build');
}
app.use('/store', express.static(FRONT_DIST));
// Assets também na raiz (evita tela branca se o build sair com /assets/).
app.use('/assets', express.static(path.join(FRONT_DIST, 'assets')));
// Fallback SPA: /store/ e /store/<slug> servem o index do CRM.
app.get('/store/*', (req, res) => res.sendFile(path.join(FRONT_DIST, 'index.html')));

// ------------------------------------------------------------------
//  Compatibilidade e raiz
// ------------------------------------------------------------------
app.get('/sales', (req, res) => res.redirect('/store/'));
app.get('/sales/*', (req, res) => res.redirect('/store/'));
app.get('/', (req, res) => res.redirect('/store/'));

app.listen(PORT, () => {
  console.log('===================================================');
  console.log(`🧭 Centralizador ativo na porta ${PORT}`);
  console.log(`   /            -> redirect /store/`);
  console.log(`   /store/*     -> CRM + vitrine (${FRONT_DIST})`);
  console.log(`   /gateway/*   -> gateway (${GATEWAY_TARGET})`);
  console.log('---------------------------------------------------');
  console.log(`   Exponha com:  ngrok http ${PORT}`);
  console.log('===================================================');
});
