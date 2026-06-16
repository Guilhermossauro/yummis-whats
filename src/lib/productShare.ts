import { CART_PASSPHRASE_PREFIX, PASSPHRASE_PREFIX } from './botProcessor';
import { SQLProduct } from '../types';

type ShareableProduct = Pick<SQLProduct, 'codigo' | 'nome'>;
export type StoreCartItem = { product: ShareableProduct; quantity: number };

export function buildProductInterestText(product: ShareableProduct): string {
  return `Olá! Tenho interesse no produto *${product.nome}* (cód ${product.codigo}). ${PASSPHRASE_PREFIX}${product.codigo}`;
}

export function buildWhatsAppProductLink(product: ShareableProduct, gatewayPhone?: string | null): string {
  const phone = (gatewayPhone || '').replace(/\D/g, '');
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(buildProductInterestText(product))}`;
}

export function buildStoreCartInterestText(items: StoreCartItem[], storeName?: string | null): string {
  const visibleList = items
    .map((item) => `• ${item.quantity}x ${item.product.nome} (cód ${item.product.codigo})`)
    .join('\n');
  const passphrase = items
    .map((item) => `${item.product.codigo}x${Math.max(1, item.quantity)}`)
    .join(',');
  return (
    `Olá! Quero comprar na loja ${storeName || 'online'}:\n\n` +
    `${visibleList}\n\n` +
    `${CART_PASSPHRASE_PREFIX}${passphrase}`
  );
}

export function buildWhatsAppStoreCartLink(items: StoreCartItem[], gatewayPhone?: string | null, storeName?: string | null): string {
  const phone = (gatewayPhone || '').replace(/\D/g, '');
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(buildStoreCartInterestText(items, storeName))}`;
}
