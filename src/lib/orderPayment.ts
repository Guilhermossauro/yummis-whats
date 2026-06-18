import { SQLCart, SQLLead, SQLOrder } from '../types';

type PaidItem = { id: string; quantidade: number };

export type OrderPaymentResolution = {
  paidItems: PaidItem[];
  nextOrders: SQLOrder[];
  nextLeads: SQLLead[];
  nextCarts: SQLCart[];
  shouldDecrementStock: boolean;
};

export function resolveOrderPaymentTransition(
  leadId: string,
  orders: SQLOrder[],
  leads: SQLLead[],
  carts: SQLCart[],
  paidAt = new Date().toISOString(),
): OrderPaymentResolution {
  const hasPendingOrder = orders.some((order) => order.lead_id === leadId && order.status_pagamento !== 'PAGO');
  const paidItems = hasPendingOrder
    ? carts
      .filter((item) => item.lead_id === leadId)
      .map((item) => ({ id: item.product_id, quantidade: item.quantidade }))
    : [];

  return {
    paidItems,
    nextOrders: orders.map((order) => (
      order.lead_id === leadId ? { ...order, status_pagamento: 'PAGO' } : order
    )),
    nextLeads: leads.map((lead) => (
      lead.id === leadId ? { ...lead, status_funil: 'PAGO', ultimo_gatilho: paidAt } : lead
    )),
    nextCarts: hasPendingOrder ? carts.filter((item) => item.lead_id !== leadId) : carts,
    shouldDecrementStock: hasPendingOrder && paidItems.length > 0,
  };
}
