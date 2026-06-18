/**
 * Resolve dinamicamente a URL do nosso Gateway WhatsApp ("Yummis API")
 * a partir do endereço atual digitado no navegador.
 *
 * Regras:
 *  - Vite dev isolado (porta 3050): aponta para o backend local na 3060.
 *  - Centralizador / produção / ngrok: o gateway fica no MESMO host, sob /connection.
 *
 * Assim, ao expor tudo por um único túnel ngrok, o painel CRM dispara para a
 * mesma origem pública sem nenhuma configuração manual de URL.
 */
export function getGatewayBaseURL(): string {
  if (typeof window === 'undefined') return 'http://localhost:3060';

  const { origin, port } = window.location;

  // Desenvolvimento local (Vite na 3050) -> backend direto.
  if (port === '3050') {
    return 'http://localhost:3060';
  }

  // Centralizador / produção / ngrok: gateway na MESMA origem sob /gateway.
  return `${origin}/gateway`;
}

/** Slug canônico da loja (nome-da-loja) usado na rota /store/<slug>. */
export function storeSlug(name?: string | null): string {
  return (name || 'loja')
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'loja';
}

/**
 * URL canônica da vitrine da loja: SEMPRE dominio/store/<slug>.
 * Independe de onde foi chamada (edição, dashboard, etc.).
 */
export function getStorefrontURL(name?: string | null): string {
  const slug = storeSlug(name);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/store/${slug}`;
}


/** Endpoint público de disparo de mensagens do gateway (Yummis API). */
export function getSendMessageURL(): string {
  return `${getGatewayBaseURL()}/api/send-message`;
}

/** True quando o modo de operação usa o nosso gateway (Yummis API). */
export function isGatewayMode(mode: string): boolean {
  return mode === 'yummis' || mode === 'baileys_api' || mode === 'apibrasil';
}

/** Metadados de exibição dos canais omnichannel (origem das mensagens). */
export const CHANNEL_META: Record<string, { label: string; emoji: string; color: string }> = {
  whatsapp:  { label: 'WhatsApp',  emoji: '💬', color: '#25D366' },
  telegram:  { label: 'Telegram',  emoji: '✈️', color: '#229ED9' },
  facebook:  { label: 'Facebook',  emoji: '📘', color: '#1877F2' },
  instagram: { label: 'Instagram', emoji: '📸', color: '#E1306C' },
  x:         { label: 'X',         emoji: '✖️', color: '#9ca3af' },
};

export function channelMeta(channel?: string) {
  return CHANNEL_META[channel || ''] || { label: channel || 'Desconhecido', emoji: '📨', color: '#9ca3af' };
}
