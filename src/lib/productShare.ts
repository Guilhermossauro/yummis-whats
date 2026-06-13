import { PASSPHRASE_PREFIX } from './botProcessor';
import { SQLProduct } from '../types';

type ShareableProduct = Pick<SQLProduct, 'codigo' | 'nome'>;

export function buildProductInterestText(product: ShareableProduct): string {
  return `Olá! Tenho interesse no produto *${product.nome}* (cód ${product.codigo}). ${PASSPHRASE_PREFIX}${product.codigo}`;
}

export function buildWhatsAppProductLink(product: ShareableProduct, gatewayPhone?: string | null): string {
  const phone = (gatewayPhone || '').replace(/\D/g, '');
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(buildProductInterestText(product))}`;
}
