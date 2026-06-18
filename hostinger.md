# Deploy simplificado na Hostinger Business

## 1. Preparar o projeto local

1. Rode `npm install`.
2. Rode `npm run build`.
3. Confirme que a pasta `dist/` foi criada sem erros.

## 2. Apontar domínio

1. Entre no `hPanel`.
2. Abra o site do plano Business.
3. Em `Domains` ou `DNS`, aponte o domínio/subdomínio para a hospedagem.
4. Ative o SSL gratuito.

## 3. Publicar o frontend

1. No `hPanel`, abra `Files` -> `File Manager`.
2. Entre em `public_html`.
3. Apague os arquivos padrão da página inicial.
4. Envie todo o conteúdo da pasta `dist/` para `public_html`.

## 4. Publicar o backend Node

1. No `hPanel`, abra a área de `Node.js` do site.
2. Crie uma aplicação Node.
3. Selecione a versão atual de Node compatível com o projeto.
4. Defina a pasta da aplicação apontando para este projeto.
5. Configure o arquivo inicial como `backend/server.js`.
6. Rode a instalação das dependências pelo painel ou terminal da Hostinger.

## 5. Variáveis de ambiente

Configure no painel da aplicação Node:

- `PORT`
- `DATABASE_PATH`
- quaisquer chaves/tokens do WhatsApp e integrações usadas no projeto

Exemplo comum:

- `PORT=3060`
- `DATABASE_PATH=/home/SEU_USUARIO/app/backend/db/database.db`

## 6. Banco e persistência

1. Garanta que a pasta do banco tenha permissão de escrita.
2. No primeiro start, o backend cria as tabelas automaticamente.
3. Se já existir banco antigo, faça backup antes de subir.

## 7. Ligar frontend no backend

1. Aponte a URL base do gateway/API para o domínio da aplicação Node.
2. Se usar subdomínio, um formato comum é:
   - frontend: `https://seudominio.com`
   - backend: `https://api.seudominio.com`
3. Ajuste CORS e URLs públicas se necessário.

## 8. Subir e testar

1. Inicie a aplicação Node pelo painel.
2. Abra o site público.
3. Faça um teste simples:
   - abrir catálogo
   - adicionar item
   - gerar pedido
   - marcar como pago
   - validar que o estoque cai uma vez

## 9. Checklist rápido

- `dist/` enviado para `public_html`
- SSL ativo
- app Node iniciando sem erro
- banco com permissão de escrita
- domínio do frontend abrindo
- API respondendo
- fluxo de pagamento baixando estoque só uma vez

## 10. Se a Hostinger do painel não mostrar Node.js

1. Verifique no hPanel se o recurso de app Node está liberado no seu plano Business.
2. Se não estiver disponível na sua conta, use:
   - frontend na hospedagem Business
   - backend em VPS/Cloud/serviço Node separado
3. Nesse cenário, mantenha apenas a API externa apontada no frontend.
