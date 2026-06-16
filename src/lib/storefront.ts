import {
  ProductSortMode,
  SQLProduct,
  StorefrontCartElementId,
  StoreLayoutType,
  StorefrontCategorySetting,
  StorefrontConfig,
  StorefrontPageElement,
  StorefrontProductElementId,
  StorefrontLabels,
  StorefrontLayoutSettings,
  StorefrontSection,
  StorefrontSectionId,
  StorefrontTheme,
} from '../types';

export type LayoutOption = {
  key: StoreLayoutType;
  label: string;
  title: string;
  subtitle: string;
  description: string;
};

type LayoutDefaults = {
  option: LayoutOption;
  theme: StorefrontTheme;
  labels: StorefrontLabels;
  layoutSettings: StorefrontLayoutSettings;
  sections: StorefrontSection[];
};

const DEFAULT_SECTION_IDS: StorefrontSectionId[] = ['categories', 'filters', 'featured', 'products', 'about', 'benefits', 'footer'];
const DEFAULT_PRODUCT_PAGE_ELEMENT_IDS: StorefrontProductElementId[] = ['detail_breadcrumb', 'detail_showcase', 'detail_specs', 'detail_actions', 'detail_trust'];
const DEFAULT_CART_PAGE_ELEMENT_IDS: StorefrontCartElementId[] = ['cart_header', 'cart_empty', 'cart_items', 'cart_summary'];

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || '').trim()).filter(Boolean)));
}

function titleCase(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function sectionLibrary(layout: StoreLayoutType): Record<StorefrontSectionId, { title: string; subtitle: string }> {
  const common = {
    filters: { title: 'Busca e filtros', subtitle: 'Facilite a navegação pelos itens.' },
    featured: { title: 'Faixa de destaques', subtitle: 'Produtos e categorias priorizados no topo.' },
    products: { title: 'Lista de produtos', subtitle: 'Área principal de compra da página inicial.' },
    about: { title: 'História da loja', subtitle: 'Bloco institucional para reforçar a marca.' },
    benefits: { title: 'Benefícios da compra', subtitle: 'Argumentos comerciais e diferenciais.' },
    footer: { title: 'Rodapé', subtitle: 'Mensagem final e reforço de atendimento.' },
  } satisfies Record<Exclude<StorefrontSectionId, 'hero' | 'categories'>, { title: string; subtitle: string }>;

  if (layout === 'restaurant') {
    return {
      hero: { title: 'Capa do restaurante', subtitle: 'Banner, chamada principal e horário.' },
      categories: { title: 'Menu de categorias', subtitle: 'Entradas, pratos, bebidas e combos.' },
      ...common,
    };
  }

  if (layout === 'fashion') {
    return {
      hero: { title: 'Capa da coleção', subtitle: 'Bloco principal com banner e destaques visuais.' },
      categories: { title: 'Sessões da coleção', subtitle: 'Looks, peças e tendências da marca.' },
      ...common,
    };
  }

  if (layout === 'market') {
    return {
      hero: { title: 'Promoção do corredor', subtitle: 'Capa com ofertas e atalhos rápidos.' },
      categories: { title: 'Corredores do mercado', subtitle: 'Categorias para navegar como um supermercado.' },
      ...common,
    };
  }

  if (layout === 'beauty') {
    return {
      hero: { title: 'Ritual em destaque', subtitle: 'Capa aspiracional com foco em autocuidado.' },
      categories: { title: 'Linhas de beleza', subtitle: 'Skincare, maquiagem, cabelos e kits.' },
      ...common,
    };
  }

  if (layout === 'electronics') {
    return {
      hero: { title: 'Vitrine tech', subtitle: 'Destaque produtos, specs e lançamentos.' },
      categories: { title: 'Setores de tecnologia', subtitle: 'Aparelhos, acessórios e setups.' },
      ...common,
    };
  }

  if (layout === 'services') {
    return {
      hero: { title: 'Capa de serviços', subtitle: 'Resumo da proposta e chamada de agendamento.' },
      categories: { title: 'Áreas de atendimento', subtitle: 'Especialidades e pacotes do negócio.' },
      ...common,
    };
  }

  return {
    hero: { title: 'Hero principal', subtitle: 'Capa com banner, frase principal e CTA.' },
    categories: { title: 'Categorias em destaque', subtitle: 'Abas visíveis para navegar no catálogo.' },
    ...common,
  };
}

function productPageElementLibrary(): Record<StorefrontProductElementId, { title: string; subtitle: string }> {
  return {
    detail_breadcrumb: { title: 'Breadcrumb do produto', subtitle: 'Caminho e navegação de volta para a vitrine.' },
    detail_showcase: { title: 'Showcase do produto', subtitle: 'Imagem, categoria, nome, preço e avaliação.' },
    detail_specs: { title: 'Especificações', subtitle: 'Entrega, disponibilidade e descrição detalhada.' },
    detail_actions: { title: 'Ações de compra', subtitle: 'Quantidade, adicionar ao carrinho e comprar agora.' },
    detail_trust: { title: 'Faixa de confiança', subtitle: 'Selos e reforços comerciais do produto.' },
  };
}

function cartPageElementLibrary(): Record<StorefrontCartElementId, { title: string; subtitle: string }> {
  return {
    cart_header: { title: 'Cabeçalho do carrinho', subtitle: 'Topo da página com título e navegação.' },
    cart_empty: { title: 'Estado vazio', subtitle: 'Mensagem exibida quando ainda não existem itens no carrinho.' },
    cart_items: { title: 'Lista de itens', subtitle: 'Produtos adicionados, quantidades e totais parciais.' },
    cart_summary: { title: 'Resumo e checkout', subtitle: 'Total consolidado e botões de continuar ou finalizar.' },
  };
}

function createDefaultPageElements<TElementId extends string>(
  elementIds: TElementId[],
  library: Record<TElementId, { title: string; subtitle: string }>,
) {
  return elementIds.map((id, index) => ({
    id,
    title: library[id].title,
    subtitle: library[id].subtitle,
    enabled: true,
    order: index,
  })) satisfies StorefrontPageElement<TElementId>[];
}

const LAYOUT_DEFAULTS: Record<StoreLayoutType, LayoutDefaults> = {
  restaurant: {
    option: {
      key: 'restaurant',
      label: '🍽️ Restaurante',
      title: 'Menu com foco em pedidos rápidos',
      subtitle: 'Listagem em estilo cardápio com atalhos por categoria',
      description: 'Ideal para hamburguerias, pizzarias, açaí, lanchonetes e operações com menu visual.',
    },
    theme: {
      primary: '#ea580c',
      secondary: '#f97316',
      accent: '#fb7185',
      background: '#fff7ed',
      surface: '#ffffff',
      card: '#fff1e8',
      text: '#431407',
      muted: '#9a3412',
      border: '#fed7aa',
      topbar: 'linear-gradient(135deg, #431407 0%, #ea580c 52%, #f97316 100%)',
    },
    labels: {
      topTitle: 'Menu Oficial',
      heroBadge: 'Pedidos no WhatsApp',
      heroTitle: 'Seu cardápio digital pronto para vender no WhatsApp',
      heroSubtitle: 'Destaque seus pratos mais pedidos, facilite a escolha e transforme cliques em pedidos confirmados.',
      searchPlaceholder: 'Buscar pratos, bebidas ou combos',
      minOrderText: 'Pedido mínimo: R$ 15,00',
      deliveryText: 'Delivery e retirada',
      contactText: 'Atendimento direto no WhatsApp',
      featuredTitle: 'Mais pedidos hoje',
      featuredSubtitle: 'Use esta faixa para empurrar combos, sobremesas e pratos carro-chefe.',
      homeTitle: 'Cardápio do restaurante',
      homeSubtitle: 'itens do cardápio disponíveis',
      offerLabel: 'Especial da casa',
      priceSupport: 'com confirmação humana pelo WhatsApp',
      cartTitle: 'Meu pedido',
      cartSubtitle: 'Revise os itens antes de enviar para a cozinha.',
      emptyCartTitle: 'Seu pedido ainda está vazio',
      emptyCartText: 'Volte ao cardápio e adicione os itens que deseja pedir.',
      continueText: 'Continuar no cardápio',
      checkoutText: 'Enviar pedido no WhatsApp',
      addCartText: 'Adicionar ao pedido',
      buyNowText: 'Pedir agora',
      detailBackText: 'Voltar ao menu',
      detailInfoTitle: 'Detalhes do prato',
      detailShippingLabel: 'Entrega',
      detailShippingText: 'Combine delivery, retirada ou mesa pelo WhatsApp.',
      detailAvailabilityLabel: 'Disponibilidade',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Sobre o restaurante',
      aboutText: 'Conte o que torna o seu cardápio especial, qual é o seu diferencial e como a loja atende o cliente.',
      benefitsTitle: 'Por que pedir aqui',
      benefitsText: 'Atendimento ágil, confirmação humana e facilidade para finalizar seu pedido no WhatsApp.',
      footerNote: 'Atendimento humanizado direto pelo WhatsApp após a seleção dos itens.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'sidebar',
      productCardStyle: 'list',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: true,
      showStock: false,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('restaurant')[id], enabled: true })),
  },
  ecommerce: {
    option: {
      key: 'ecommerce',
      label: '🛒 E-commerce',
      title: 'Marketplace moderno com foco em catálogo',
      subtitle: 'Grade de produtos, busca forte e destaques comerciais',
      description: 'Ideal para catálogos gerais, revendas, multimarcas e vitrines de alto volume.',
    },
    theme: {
      primary: '#6d28d9',
      secondary: '#7c3aed',
      accent: '#c026d3',
      background: '#f7f3ff',
      surface: '#ffffff',
      card: '#f5f0ff',
      text: '#2e1065',
      muted: '#6b21a8',
      border: '#ddd6fe',
      topbar: 'linear-gradient(135deg, #3b0764 0%, #7c3aed 48%, #c026d3 100%)',
    },
    labels: {
      topTitle: 'Vitrine Oficial',
      heroBadge: 'Loja online integrada',
      heroTitle: 'Transforme seu catálogo em uma vitrine que vende no WhatsApp',
      heroSubtitle: 'Mostre seus produtos, destaque campanhas e direcione o cliente para o atendimento com contexto completo.',
      searchPlaceholder: 'Buscar por produto, código ou descrição',
      minOrderText: 'Compra mínima: R$ 15,00',
      deliveryText: 'Entrega combinada com a loja',
      contactText: 'Atendimento via WhatsApp',
      featuredTitle: 'Destaques da vitrine',
      featuredSubtitle: 'Promova lançamentos, kits e itens com maior margem.',
      homeTitle: 'Catálogo de produtos',
      homeSubtitle: 'produtos visíveis na vitrine',
      offerLabel: 'Oferta da loja',
      priceSupport: 'com atendimento personalizado da loja',
      cartTitle: 'Meu carrinho',
      cartSubtitle: 'Revise o carrinho antes de confirmar tudo no WhatsApp.',
      emptyCartTitle: 'Seu carrinho está vazio',
      emptyCartText: 'Volte para a vitrine e escolha os produtos que deseja comprar.',
      continueText: 'Continuar comprando',
      checkoutText: 'Confirmar no WhatsApp',
      addCartText: 'Adicionar ao carrinho',
      buyNowText: 'Comprar agora',
      detailBackText: 'Voltar para a loja',
      detailInfoTitle: 'Informações do produto',
      detailShippingLabel: 'Envio',
      detailShippingText: 'Combine entrega, retirada e condições comerciais pelo WhatsApp.',
      detailAvailabilityLabel: 'Disponibilidade',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Sobre a loja',
      aboutText: 'Use este espaço para reforçar confiança, curadoria de produtos, diferenciais e atendimento.',
      benefitsTitle: 'O que o cliente encontra aqui',
      benefitsText: 'Compra assistida, catálogo atualizado e atendimento ágil para fechar o pedido.',
      footerNote: 'Ao finalizar, o cliente segue para o WhatsApp com os itens selecionados automaticamente.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'tabs',
      productCardStyle: 'grid',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: true,
      showStock: true,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('ecommerce')[id], enabled: true })),
  },
  fashion: {
    option: {
      key: 'fashion',
      label: '👗 Loja de modas',
      title: 'Loja de modas com clima premium',
      subtitle: 'Hero forte, cards altos e visual de marca',
      description: 'Ideal para boutiques, lojas femininas, roupas, acessórios e coleções cápsula.',
    },
    theme: {
      primary: '#db2777',
      secondary: '#ec4899',
      accent: '#a855f7',
      background: '#fff1f8',
      surface: '#ffffff',
      card: '#fdf2f8',
      text: '#500724',
      muted: '#9d174d',
      border: '#fbcfe8',
      topbar: 'linear-gradient(135deg, #500724 0%, #db2777 48%, #a855f7 100%)',
    },
    labels: {
      topTitle: 'Closet Oficial',
      heroBadge: 'Coleção em destaque',
      heroTitle: 'Crie uma vitrine que valoriza sua marca e o desejo de compra',
      heroSubtitle: 'Mostre lançamentos, destaque looks completos e mantenha o atendimento consultivo no WhatsApp.',
      searchPlaceholder: 'Buscar looks, tamanhos ou coleções',
      minOrderText: 'Compra mínima: R$ 15,00',
      deliveryText: 'Envio e retirada',
      contactText: 'Consultoria via WhatsApp',
      featuredTitle: 'Looks em evidência',
      featuredSubtitle: 'Use esta área para montar composições, tendências e campanhas da estação.',
      homeTitle: 'Coleção da loja',
      homeSubtitle: 'looks e peças em destaque',
      offerLabel: 'Look em destaque',
      priceSupport: 'com consultoria de estilo no WhatsApp',
      cartTitle: 'Minha sacola',
      cartSubtitle: 'Revise seus looks antes de chamar o atendimento.',
      emptyCartTitle: 'Sua sacola está vazia',
      emptyCartText: 'Escolha as peças favoritas para seguir com o atendimento.',
      continueText: 'Continuar vendo looks',
      checkoutText: 'Enviar sacola no WhatsApp',
      addCartText: 'Adicionar à sacola',
      buyNowText: 'Comprar look',
      detailBackText: 'Voltar para a coleção',
      detailInfoTitle: 'Detalhes da peça',
      detailShippingLabel: 'Entrega',
      detailShippingText: 'Combine prova, retirada, entrega e troca diretamente pelo WhatsApp.',
      detailAvailabilityLabel: 'Estoque',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Identidade da marca',
      aboutText: 'Apresente a proposta da marca, o estilo da coleção e o posicionamento da loja.',
      benefitsTitle: 'Experiência de compra',
      benefitsText: 'Atendimento consultivo, sugestão de looks e finalização humanizada no WhatsApp.',
      footerNote: 'Seu catálogo vira uma extensão da experiência da marca antes do atendimento humano.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'pills',
      productCardStyle: 'mosaic',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: false,
      showStock: true,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('fashion')[id], enabled: true })),
  },
  market: {
    option: {
      key: 'market',
      label: '🛍️ Mercado',
      title: 'Corredores e compras rápidas',
      subtitle: 'Layout compacto para alto volume de itens',
      description: 'Ideal para mercearias, hortifruti, conveniência e mercados de bairro.',
    },
    theme: {
      primary: '#059669',
      secondary: '#10b981',
      accent: '#14b8a6',
      background: '#ecfdf5',
      surface: '#ffffff',
      card: '#dffaf0',
      text: '#064e3b',
      muted: '#047857',
      border: '#a7f3d0',
      topbar: 'linear-gradient(135deg, #064e3b 0%, #059669 52%, #14b8a6 100%)',
    },
    labels: {
      topTitle: 'Mercado Online',
      heroBadge: 'Compra prática',
      heroTitle: 'Monte sua compra com rapidez e envie a lista direto no WhatsApp',
      heroSubtitle: 'Organize os corredores, simplifique a busca e acelere pedidos recorrentes.',
      searchPlaceholder: 'Buscar alimentos, utilidades ou ofertas',
      minOrderText: 'Compra mínima: R$ 15,00',
      deliveryText: 'Entrega da sua compra',
      contactText: 'Atendimento via WhatsApp',
      featuredTitle: 'Ofertas do corredor',
      featuredSubtitle: 'Empurre ofertas relâmpago, packs e itens de giro rápido.',
      homeTitle: 'Corredores do mercado',
      homeSubtitle: 'itens disponíveis na loja',
      offerLabel: 'Oferta da semana',
      priceSupport: 'para montar sua compra com assistência humana',
      cartTitle: 'Minha cesta',
      cartSubtitle: 'Confira os itens antes de enviar a cesta.',
      emptyCartTitle: 'Sua cesta está vazia',
      emptyCartText: 'Volte aos corredores e adicione os produtos da sua compra.',
      continueText: 'Continuar comprando',
      checkoutText: 'Enviar cesta no WhatsApp',
      addCartText: 'Adicionar à cesta',
      buyNowText: 'Comprar item',
      detailBackText: 'Voltar ao mercado',
      detailInfoTitle: 'Detalhes do item',
      detailShippingLabel: 'Entrega',
      detailShippingText: 'Combine taxa, rota e horário diretamente pelo WhatsApp.',
      detailAvailabilityLabel: 'Disponibilidade',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Sobre o mercado',
      aboutText: 'Explique o tipo de mix, diferenciais da operação e a proposta de conveniência da loja.',
      benefitsTitle: 'Vantagens para o cliente',
      benefitsText: 'Compra rápida, filtros simples e confirmação final com atendimento humano.',
      footerNote: 'O cliente chega ao WhatsApp com a cesta organizada e pronta para fechamento.',
    },
    layoutSettings: {
      productSort: 'stock_desc',
      categoryMenuStyle: 'tabs',
      productCardStyle: 'compact',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: false,
      showStock: true,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('market')[id], enabled: true })),
  },
  beauty: {
    option: {
      key: 'beauty',
      label: '✨ Beleza',
      title: 'Vitrine emocional para autocuidado',
      subtitle: 'Cards elegantes, destaque de rituais e kits',
      description: 'Ideal para maquiagem, skincare, perfumaria, estética e autocuidado.',
    },
    theme: {
      primary: '#c026d3',
      secondary: '#d946ef',
      accent: '#fb7185',
      background: '#fdf4ff',
      surface: '#ffffff',
      card: '#fae8ff',
      text: '#581c87',
      muted: '#a21caf',
      border: '#f5d0fe',
      topbar: 'linear-gradient(135deg, #581c87 0%, #c026d3 48%, #fb7185 100%)',
    },
    labels: {
      topTitle: 'Beauty Store',
      heroBadge: 'Curadoria especializada',
      heroTitle: 'Encante com uma vitrine mais sensorial e consultiva',
      heroSubtitle: 'Destaque rituais, kits e linhas de produtos com mais contexto visual.',
      searchPlaceholder: 'Buscar cosméticos, kits ou autocuidado',
      minOrderText: 'Compra mínima: R$ 15,00',
      deliveryText: 'Entrega delicada',
      contactText: 'Especialista via WhatsApp',
      featuredTitle: 'Rituais em destaque',
      featuredSubtitle: 'Aponte kits, linhas e combinações de produtos para elevar o ticket.',
      homeTitle: 'Vitrine de beleza',
      homeSubtitle: 'produtos e kits visíveis',
      offerLabel: 'Ritual em destaque',
      priceSupport: 'com orientação personalizada via WhatsApp',
      cartTitle: 'Minha nécessaire',
      cartSubtitle: 'Revise sua seleção antes de continuar no atendimento.',
      emptyCartTitle: 'Sua nécessaire está vazia',
      emptyCartText: 'Adicione seus itens para montar o seu ritual de compra.',
      continueText: 'Continuar na vitrine',
      checkoutText: 'Enviar seleção no WhatsApp',
      addCartText: 'Adicionar à nécessaire',
      buyNowText: 'Quero este produto',
      detailBackText: 'Voltar para a beleza',
      detailInfoTitle: 'Informações do produto',
      detailShippingLabel: 'Entrega',
      detailShippingText: 'Combine envio, retirada e orientação especializada pelo WhatsApp.',
      detailAvailabilityLabel: 'Disponibilidade',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Sobre a marca',
      aboutText: 'Use este bloco para falar sobre curadoria, propósito e a experiência de autocuidado da loja.',
      benefitsTitle: 'Experiência de compra',
      benefitsText: 'Consultoria, kits bem posicionados e transição suave para o atendimento humano.',
      footerNote: 'O cliente conclui a seleção e segue para o WhatsApp com contexto completo do que escolheu.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'pills',
      productCardStyle: 'grid',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: true,
      showStock: true,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('beauty')[id], enabled: true })),
  },
  electronics: {
    option: {
      key: 'electronics',
      label: '📱 Eletrônicos',
      title: 'Catálogo tech com linguagem de performance',
      subtitle: 'Hero mais técnico, destaque de specs e comparação visual',
      description: 'Ideal para celulares, informática, acessórios, gadgets e lojas de tecnologia.',
    },
    theme: {
      primary: '#2563eb',
      secondary: '#3b82f6',
      accent: '#06b6d4',
      background: '#eff6ff',
      surface: '#ffffff',
      card: '#dbeafe',
      text: '#172554',
      muted: '#1d4ed8',
      border: '#bfdbfe',
      topbar: 'linear-gradient(135deg, #172554 0%, #2563eb 48%, #06b6d4 100%)',
    },
    labels: {
      topTitle: 'Tech Store',
      heroBadge: 'Tecnologia em destaque',
      heroTitle: 'Mostre specs, destaque ofertas e leve o cliente para o WhatsApp com contexto',
      heroSubtitle: 'Organize o catálogo por categorias técnicas e use o layout para vender mais com clareza.',
      searchPlaceholder: 'Buscar aparelhos, acessórios ou tecnologia',
      minOrderText: 'Compra mínima: R$ 15,00',
      deliveryText: 'Envio seguro',
      contactText: 'Suporte via WhatsApp',
      featuredTitle: 'Ofertas tech',
      featuredSubtitle: 'Promova lançamentos, bundles e acessórios de alto giro.',
      homeTitle: 'Tecnologia em destaque',
      homeSubtitle: 'produtos tech visíveis',
      offerLabel: 'Oferta tech',
      priceSupport: 'com suporte consultivo no WhatsApp',
      cartTitle: 'Carrinho tech',
      cartSubtitle: 'Revise os itens antes de chamar a equipe.',
      emptyCartTitle: 'Seu carrinho tech está vazio',
      emptyCartText: 'Explore o catálogo e adicione os produtos desejados.',
      continueText: 'Continuar explorando',
      checkoutText: 'Enviar carrinho no WhatsApp',
      addCartText: 'Adicionar ao carrinho',
      buyNowText: 'Comprar tecnologia',
      detailBackText: 'Voltar para tecnologia',
      detailInfoTitle: 'Especificações e detalhes',
      detailShippingLabel: 'Envio',
      detailShippingText: 'Combine prazo, garantia e suporte diretamente pelo WhatsApp.',
      detailAvailabilityLabel: 'Estoque',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Sobre a loja tech',
      aboutText: 'Fale sobre assistência, origem dos produtos, suporte e diferenciais da operação.',
      benefitsTitle: 'O que diferencia sua loja',
      benefitsText: 'Comparação rápida, itens bem organizados e atendimento humano para fechar a venda.',
      footerNote: 'O catálogo vira um funil técnico que leva o cliente com contexto pronto ao WhatsApp.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'tabs',
      productCardStyle: 'grid',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: true,
      showStock: true,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('electronics')[id], enabled: true })),
  },
  services: {
    option: {
      key: 'services',
      label: '🧰 Serviços',
      title: 'Portfólio com foco em agendamento',
      subtitle: 'Layout orientado a pacotes, etapas e solicitação',
      description: 'Ideal para consultorias, clínicas, agências, oficinas e negócios de serviços.',
    },
    theme: {
      primary: '#4f46e5',
      secondary: '#6366f1',
      accent: '#f59e0b',
      background: '#f5f3ff',
      surface: '#ffffff',
      card: '#ede9fe',
      text: '#312e81',
      muted: '#4338ca',
      border: '#c4b5fd',
      topbar: 'linear-gradient(135deg, #312e81 0%, #4f46e5 48%, #f59e0b 100%)',
    },
    labels: {
      topTitle: 'Serviços Online',
      heroBadge: 'Atendimento consultivo',
      heroTitle: 'Apresente seus serviços com clareza e direcione a conversa para o WhatsApp',
      heroSubtitle: 'Mostre especialidades, pacotes e etapas do atendimento em uma vitrine clara e profissional.',
      searchPlaceholder: 'Buscar serviços, pacotes ou orçamentos',
      minOrderText: 'Atendimento inicial pelo WhatsApp',
      deliveryText: 'Agenda combinada',
      contactText: 'Consultor via WhatsApp',
      featuredTitle: 'Pacotes em destaque',
      featuredSubtitle: 'Use esta área para empurrar serviços premium, recorrentes ou mais rentáveis.',
      homeTitle: 'Serviços disponíveis',
      homeSubtitle: 'serviços e pacotes ativos',
      offerLabel: 'Pacote recomendado',
      priceSupport: 'com alinhamento consultivo pelo WhatsApp',
      cartTitle: 'Minha solicitação',
      cartSubtitle: 'Revise os serviços escolhidos antes de falar com a equipe.',
      emptyCartTitle: 'Nenhum serviço selecionado',
      emptyCartText: 'Escolha um serviço para iniciar o atendimento.',
      continueText: 'Ver mais serviços',
      checkoutText: 'Solicitar pelo WhatsApp',
      addCartText: 'Adicionar serviço',
      buyNowText: 'Solicitar agora',
      detailBackText: 'Voltar aos serviços',
      detailInfoTitle: 'Detalhes do serviço',
      detailShippingLabel: 'Atendimento',
      detailShippingText: 'Combine data, formato, escopo e orçamento diretamente pelo WhatsApp.',
      detailAvailabilityLabel: 'Disponibilidade',
      detailDescriptionLabel: 'Descrição',
      aboutTitle: 'Como a loja atende',
      aboutText: 'Explique sua metodologia, especialidades e como funciona o primeiro contato comercial.',
      benefitsTitle: 'Por que contratar',
      benefitsText: 'Mais contexto antes do atendimento, melhor qualificação e transição direta para o WhatsApp.',
      footerNote: 'Depois da seleção, o cliente segue para o WhatsApp com a intenção de serviço pronta para o time.',
    },
    layoutSettings: {
      productSort: 'featured',
      categoryMenuStyle: 'pills',
      productCardStyle: 'list',
      showSearch: true,
      showFilters: true,
      showFeaturedStrip: true,
      showAbout: true,
      showBenefits: true,
      showRatings: false,
      showStock: false,
    },
    sections: DEFAULT_SECTION_IDS.map((id) => ({ id, ...sectionLibrary('services')[id], enabled: true })),
  },
};

export const STOREFRONT_LAYOUT_OPTIONS: LayoutOption[] = Object.values(LAYOUT_DEFAULTS).map(layout => layout.option);

export function getLayoutDefaults(layout: StoreLayoutType) {
  return LAYOUT_DEFAULTS[layout] || LAYOUT_DEFAULTS.ecommerce;
}

export function inferProductCategory(product: SQLProduct, layout: StoreLayoutType) {
  const text = `${product.nome} ${product.descricao}`.toLowerCase();
  if (layout === 'restaurant') {
    if (/bebida|suco|refrigerante|drink|agua|cafe/.test(text)) return 'Bebidas';
    if (/doce|sobremesa|bolo|acai|sorvete/.test(text)) return 'Sobremesas';
    if (/combo|promocao|kit/.test(text)) return 'Combos';
    if (/lanche|burger|pizza|prato|massa/.test(text)) return 'Pratos';
    return 'Especiais';
  }
  if (layout === 'market') {
    if (/bebida|suco|refrigerante|agua/.test(text)) return 'Bebidas';
    if (/limpeza|utilidade|casa/.test(text)) return 'Casa';
    if (/fruta|verdura|legume|hortifruti/.test(text)) return 'Hortifruti';
    return 'Mercado';
  }
  if (layout === 'beauty') {
    if (/perfume|creme|skin|maquiagem|batom/.test(text)) return 'Beleza';
    if (/kit|combo|promocao/.test(text)) return 'Kits';
    return 'Cuidados';
  }
  if (layout === 'electronics') {
    if (/fone|cabo|carregador|case|acessorio/.test(text)) return 'Acessórios';
    if (/celular|phone|notebook|tablet|monitor/.test(text)) return 'Dispositivos';
    return 'Tecnologia';
  }
  if (layout === 'services') {
    if (/consultoria|agenda|aula|sessao|pacote|servico/.test(text)) return 'Serviços';
    return 'Pacotes';
  }
  if (/vestido|saia|moda|look|conjunto/.test(text)) return 'Moda';
  if (/blusa|cropped|camisa|camiseta/.test(text)) return 'Blusas';
  if (/calca|pantalona|jeans|short/.test(text)) return 'Calças';
  if (/tenis|sandalia|sapato|bolsa|acessorio/.test(text)) return 'Acessórios';
  if (/combo|kit|promocao|promo/.test(text)) return 'Promoções';
  return 'Destaques';
}

export function resolveProductCategories(product: SQLProduct, layout: StoreLayoutType) {
  const explicit = uniqueStrings(Array.isArray(product.categories) ? product.categories : []);
  if (explicit.length) return explicit.map(titleCase);
  return [inferProductCategory(product, layout)];
}

function buildDefaultCategorySettings(products: SQLProduct[], layout: StoreLayoutType): StorefrontCategorySetting[] {
  return uniqueStrings(products.flatMap(product => resolveProductCategories(product, layout))).map((name, index) => ({
    name,
    label: name,
    visible: true,
    featured: index < 4,
    order: index,
  }));
}

function normalizeCategorySettings(
  products: SQLProduct[],
  layout: StoreLayoutType,
  input: StorefrontCategorySetting[] | undefined,
) {
  const defaults = buildDefaultCategorySettings(products, layout);
  const byName = new Map(defaults.map(item => [item.name.toLowerCase(), item]));

  for (const item of Array.isArray(input) ? input : []) {
    const rawName = titleCase(item?.name || item?.label || '');
    if (!rawName) continue;
    byName.set(rawName.toLowerCase(), {
      name: rawName,
      label: titleCase(item?.label || rawName),
      visible: item?.visible !== false,
      featured: !!item?.featured,
      order: Number.isFinite(item?.order) ? Number(item.order) : byName.size,
    });
  }

  return Array.from(byName.values()).sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'pt-BR'));
}

function normalizeSections(layout: StoreLayoutType, input: StorefrontSection[] | undefined) {
  const defaults = LAYOUT_DEFAULTS[layout].sections;
  const inputList = Array.isArray(input) ? input : [];
  const validIds = new Set(DEFAULT_SECTION_IDS);
  const byId = new Map(defaults.map(section => [section.id, section]));

  const merged = inputList
    .filter(section => section && validIds.has(section.id))
    .map((section) => {
      const base = byId.get(section.id) || defaults[0];
      return {
        id: section.id,
        title: String(section.title || base.title),
        subtitle: String(section.subtitle || base.subtitle),
        enabled: section.enabled !== false,
      } satisfies StorefrontSection;
    });

  for (const base of defaults) {
    if (!merged.some(section => section.id === base.id)) {
      merged.push({ ...base });
    }
  }

  return merged;
}

function normalizeHiddenCodes(input: string[] | undefined) {
  return uniqueStrings(Array.isArray(input) ? input : []).map(code => code.toUpperCase());
}

function normalizePageElements<TElementId extends string>(
  defaults: StorefrontPageElement<TElementId>[],
  input?: StorefrontPageElement<TElementId>[] | null,
) {
  const inputList = Array.isArray(input) ? input : [];
  const byId = new Map(defaults.map(element => [element.id, element]));

  const merged = inputList
    .filter(element => element && byId.has(element.id))
    .map((element) => {
      const base = byId.get(element.id) || defaults[0];
      return {
        id: element.id,
        title: String(element.title || base.title),
        subtitle: String(element.subtitle || base.subtitle),
        enabled: element.enabled !== false,
        order: Number.isFinite(Number(element.order)) ? Number(element.order) : base.order,
      } satisfies StorefrontPageElement<TElementId>;
    });

  for (const base of defaults) {
    if (!merged.some(element => element.id === base.id)) {
      merged.push({ ...base });
    }
  }

  return merged.sort((left, right) => left.order - right.order).map((element, index) => ({ ...element, order: index }));
}

export function createDefaultStorefrontConfig(layout: StoreLayoutType, storeName: string, products: SQLProduct[] = []): StorefrontConfig {
  const defaults = getLayoutDefaults(layout);
  return {
    theme: { ...defaults.theme },
    labels: {
      ...defaults.labels,
      heroTitle: defaults.labels.heroTitle.replace(/sua loja|sua marca|seu cardápio/gi, storeName ? `${storeName}` : '$&'),
    },
    sections: defaults.sections.map(section => ({ ...section })),
    categorySettings: buildDefaultCategorySettings(products, layout),
    layoutSettings: { ...defaults.layoutSettings },
    highlightCodes: [],
    hiddenProductCodes: [],
    productPageElements: createDefaultPageElements(DEFAULT_PRODUCT_PAGE_ELEMENT_IDS, productPageElementLibrary()),
    cartPageElements: createDefaultPageElements(DEFAULT_CART_PAGE_ELEMENT_IDS, cartPageElementLibrary()),
  };
}

export function normalizeStorefrontConfig(
  layout: StoreLayoutType,
  storeName: string,
  products: SQLProduct[] = [],
  input?: Partial<StorefrontConfig> | null,
): StorefrontConfig {
  const base = createDefaultStorefrontConfig(layout, storeName, products);
  return {
    theme: { ...base.theme, ...(input?.theme || {}) },
    labels: { ...base.labels, ...(input?.labels || {}) },
    sections: normalizeSections(layout, input?.sections),
    categorySettings: normalizeCategorySettings(products, layout, input?.categorySettings),
    layoutSettings: { ...base.layoutSettings, ...(input?.layoutSettings || {}) },
    highlightCodes: uniqueStrings(input?.highlightCodes || []).map(code => code.toUpperCase()),
    hiddenProductCodes: normalizeHiddenCodes(input?.hiddenProductCodes),
    productPageElements: normalizePageElements(base.productPageElements, input?.productPageElements),
    cartPageElements: normalizePageElements(base.cartPageElements, input?.cartPageElements),
  };
}

export function syncCategorySettings(
  layout: StoreLayoutType,
  config: StorefrontConfig,
  products: SQLProduct[],
  storeName: string,
) {
  return normalizeStorefrontConfig(layout, storeName, products, config);
}

export function getVisibleCategories(settings: StorefrontCategorySetting[]) {
  return settings.filter(item => item.visible);
}

export function getFeaturedCategories(settings: StorefrontCategorySetting[]) {
  return settings.filter(item => item.visible && item.featured);
}

export function sortStoreProducts(
  products: SQLProduct[],
  layout: StoreLayoutType,
  config: StorefrontConfig,
) {
  const featuredCategories = new Set(getFeaturedCategories(config.categorySettings).map(item => item.name.toLowerCase()));
  const highlightedCodes = new Set(config.highlightCodes.map(code => code.toUpperCase()));

  return [...products].sort((left, right) => {
    const leftCategories = resolveProductCategories(left, layout).map(item => item.toLowerCase());
    const rightCategories = resolveProductCategories(right, layout).map(item => item.toLowerCase());
    const leftFeatured = highlightedCodes.has(left.codigo.toUpperCase()) || leftCategories.some(category => featuredCategories.has(category));
    const rightFeatured = highlightedCodes.has(right.codigo.toUpperCase()) || rightCategories.some(category => featuredCategories.has(category));

    if (config.layoutSettings.productSort === 'featured' && leftFeatured !== rightFeatured) {
      return leftFeatured ? -1 : 1;
    }

    switch (config.layoutSettings.productSort) {
      case 'name_asc':
        return left.nome.localeCompare(right.nome, 'pt-BR');
      case 'price_asc':
        return Number(left.preco || 0) - Number(right.preco || 0);
      case 'price_desc':
        return Number(right.preco || 0) - Number(left.preco || 0);
      case 'stock_desc':
        return Number(right.estoque || 0) - Number(left.estoque || 0);
      case 'newest':
        return Number(right.id || 0) - Number(left.id || 0);
      default:
        return (leftFeatured === rightFeatured ? 0 : leftFeatured ? -1 : 1)
          || Number(right.estoque || 0) - Number(left.estoque || 0)
          || left.nome.localeCompare(right.nome, 'pt-BR');
    }
  });
}

export function buildStoreCategoryChips(
  products: SQLProduct[],
  layout: StoreLayoutType,
  config: StorefrontConfig,
) {
  const sortedSettings = getVisibleCategories(config.categorySettings);
  const productCategories = new Map<string, string>();

  for (const product of products) {
    for (const category of resolveProductCategories(product, layout)) {
      const key = category.toLowerCase();
      if (!productCategories.has(key)) productCategories.set(key, category);
    }
  }

  return sortedSettings
    .filter(setting => productCategories.has(setting.name.toLowerCase()))
    .map(setting => ({
      name: setting.name,
      label: setting.label || setting.name,
      featured: setting.featured,
      order: setting.order,
    }));
}

export function getProductSuggestionCategories(products: SQLProduct[], layout: StoreLayoutType) {
  return uniqueStrings(products.flatMap(product => resolveProductCategories(product, layout))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function toggleSectionOrder(list: StorefrontSection[], fromIndex: number, toIndex: number) {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function toggleCategoryOrder(list: StorefrontCategorySetting[], fromIndex: number, toIndex: number) {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function togglePageElementOrder<TElementId extends string>(list: StorefrontPageElement<TElementId>[], fromIndex: number, toIndex: number) {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((item, index) => ({ ...item, order: index }));
}

export function normalizeThemeColor(value: string, fallback: string) {
  const trimmed = String(value || '').trim();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed) ? trimmed : fallback;
}
