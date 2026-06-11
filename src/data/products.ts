import { Product } from '../types';

export const PRODUCTS: Product[] = [
  {
    id: '101',
    code: '101',
    name: 'Vestido Midi Floral Ravena',
    price: 189.90,
    description: 'Vestido midi confeccionado em crepe soft premium, estampa floral exclusiva, alças reguláveis e lástex posterior para ajuste perfeito. Fluido, fresco e super romântico.',
    category: 'Vestidos',
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&auto=format&fit=crop&q=60',
    link: 'https://seuecommerce.com.br/produtos/vestido_midi_floral_ravena',
    sizes: ['P', 'M', 'G']
  },
  {
    id: '102',
    code: '102',
    name: 'Blusa Algodão Suedine Premium',
    price: 79.90,
    description: 'T-shirt básica alfaiataria em 100% algodão egípcio penteado. Toque extremamente aveludado, caimento impecável e gola de ribana canelada que não deforma com as lavagens.',
    category: 'Blusas',
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=60',
    link: 'https://seuecommerce.com.br/produtos/blusa_algodao_suedine_premium',
    sizes: ['P', 'M', 'G', 'GG']
  },
  {
    id: '103',
    code: '103',
    name: 'Calça Jeans Slouchy High Blue',
    price: 169.90,
    description: 'Calça modelagem slouchy com cintura super alta, pregas frontais refinadas e barra levemente afunilada. Jeans 100% algodão de alta gramatura com lavagem média vintage.',
    category: 'Jeans',
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=800&auto=format&fit=crop&q=60',
    link: 'https://seuecommerce.com.br/produtos/calca_jeans_slouchy_high_blue',
    sizes: ['36', '38', '40', '42']
  },
  {
    id: '104',
    code: '104',
    name: 'Cropped Knit Verão Atenas',
    price: 64.90,
    description: 'Cropped regata confeccionado em knit de tricot premium com padronagem canelada e decote halter redondo. Caimento justo que valoriza a silhueta, ideal para dias quentes.',
    category: 'Tops',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=60',
    link: 'https://seuecommerce.com.br/produtos/cropped_knit_verao_atenas',
    sizes: ['U']
  },
  {
    id: '105',
    code: '105',
    name: 'Jaqueta Couro Vegano Classic',
    price: 259.90,
    description: 'Jaqueta estilo biker tradicional confeccionada em material ecológico premium. Zíperes frontais robustos e bolsos funcionais. Modelagem clássica atemporal com toque super macio.',
    category: 'Jaquetas',
    image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=60',
    link: 'https://seuecommerce.com.br/produtos/jaqueta_couro_vegano_classic',
    sizes: ['M', 'G', 'GG']
  }
];
