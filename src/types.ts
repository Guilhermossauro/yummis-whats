export interface LojistaUser {
  id: number;
  nome: string;
  email: string;
  senha_hash: string;
  whatsapp_config_json: string; // Serialized settings
}

export interface SQLSeller {
  id: string;
  name: string;
  email: string;
  senha_hash: string;
  store_name: string;
  criado_em: string;
}

export interface SQLEmployee {
  id: string;
  seller_id: string; // parent store/seller reference
  name: string;
  email: string;
  senha_hash: string;
  criado_em: string;
}

export interface SQLProduct {
  id: string; // kept as string for react compatibility, mapped from integer
  codigo: string;
  nome: string;
  descricao: string;
  preco: number;
  foto_path: string;
  estoque: number;
  has_shipping?: boolean;
  shipping_type?: 'free' | 'paid';
  shipping_cost?: number;
}

// Canal de origem de uma conversa/mensagem vinda do gateway
export type MessageChannel = 'whatsapp' | 'telegram' | 'facebook' | 'instagram' | 'x';

export interface SQLLead {
  id: string;
  telefone: string;
  nome: string;
  status_funil: 'CARRINHO_ABERTO' | 'AGUARDANDO_PIX' | 'PAGO' | 'CONCLUIDO';
  ultimo_gatilho: string;
  bot_pausado: number; // 0 = false, 1 = true
  cadastrado?: number; // 0 = cadastro pendente, 1 = cliente confirmado
  email?: string;
  channel?: MessageChannel; // origem (preenchido quando o lead vem do gateway)
}

export interface SQLCart {
  id: string;
  lead_id: string;
  product_id: string;
  quantidade: number;
  size: string;
  atualizado_em: string;
}

export interface SQLOrder {
  id: string;
  lead_id: string;
  total: number;
  status_pagamento: 'PENDENTE' | 'PAGO' | 'CANCELADO';
  pix_copia_cola: string;
  transaction_id: string;
  data_criacao: string;
}

export interface SQLMessageLog {
  id: string;
  lead_id: string;
  direcao: 'in' | 'out';
  texto: string;
  data_envio: string;
  operator_name?: string; // Present if sent by a human operator
  channel?: MessageChannel; // origem da mensagem (gateway omnichannel)
  delivery_status?: 'sending' | 'sent' | 'failed';
}

export interface WhatsAppConfig {
  // 'yummis' = disparo via nosso Gateway (mesma origem, URL dinâmica).
  // 'apibrasil' e 'baileys_api' mantidos para compatibilidade com configs salvas.
  mode: 'sandbox' | 'baileys' | 'yummis' | 'apibrasil' | 'baileys_api';
  apiKey: string;
  instanceName: string;
  apiURL: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  description: string;
  category: string;
  image: string;
  link: string;
  sizes: string[];
}

export interface ArchitectureNode {
  id: string;
  title: string;
  type: string;
  description: string;
  inputs: string[];
  outputs: string[];
  role: string;
  howItWorks: string;
}

export interface FlowOption {
  trigger: string;
  label: string;
  destinationBlockId: string;
}

export interface FlowBlock {
  id: string;
  title: string;
  message: string;
  type: 'message_only' | 'options';
  optionType: 'numeric' | 'keyword';
  keywordMatchType?: 'exact' | 'contains'; // Match exact or contain
  actionType?: 'none' | 'pause_bot' | 'clear_cart' | 'set_status_carrinho' | 'set_status_aguardando' | 'set_status_pago' | 'set_status_concluido';
  options: FlowOption[];
  isStarting?: boolean;
  isGlobalTrigger?: boolean;
}
