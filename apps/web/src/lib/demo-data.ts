import type { Address, Category, OpeningHours, Product, Store, Unit } from "@mercado/shared";

// Dados de demonstração usados enquanto o Supabase não está conectado.

const everyDay = (opens: string, closes: string): OpeningHours[] =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes }));

export const categories: Category[] = [
  { id: "hortifruti", slug: "hortifruti", name: "Hortifrúti", emoji: "🥬" },
  { id: "padaria", slug: "padaria", name: "Padaria", emoji: "🥖" },
  { id: "acougue", slug: "acougue", name: "Açougue", emoji: "🥩" },
  { id: "laticinios", slug: "laticinios", name: "Laticínios", emoji: "🧀" },
  { id: "mercearia", slug: "mercearia", name: "Mercearia", emoji: "🥫" },
  { id: "bebidas", slug: "bebidas", name: "Bebidas", emoji: "🥤" },
  { id: "limpeza", slug: "limpeza", name: "Limpeza", emoji: "🧴" },
];

export const stores: Store[] = [
  {
    id: "st-verde", slug: "verde-vivo", name: "Verde Vivo Orgânicos",
    description: "Orgânicos de pequenos produtores, colhidos no dia.",
    logoUrl: "🌿", status: "approved", address: "Rua Augusta, 1500 · Consolação",
    location: { lat: -23.5587, lng: -46.6590 },
    offersDelivery: true, offersPickup: true, deliveryRadiusKm: 6,
    deliveryFeeCents: 990, freeDeliveryFromCents: 15000, minOrderCents: 3000,
    commissionBps: 1200, slotMinutes: 60, prepMinutes: 60, hours: everyDay("08:00", "21:00"),
  },
  {
    id: "st-nova", slug: "nova-era", name: "Supermercado Nova Era",
    description: "Tudo para a casa, com preço de atacado.",
    logoUrl: "🛒", status: "approved", address: "Av. Paulista, 900 · Bela Vista",
    location: { lat: -23.5646, lng: -46.6527 },
    offersDelivery: true, offersPickup: true, deliveryRadiusKm: 8,
    deliveryFeeCents: 699, freeDeliveryFromCents: 20000, minOrderCents: 2000,
    commissionBps: 1000, slotMinutes: 60, prepMinutes: 45, hours: everyDay("07:00", "23:00"),
  },
  {
    id: "st-bairro", slug: "mercadinho-do-bairro", name: "Mercadinho do Bairro",
    description: "Pão quentinho e o básico do dia a dia, pertinho de você.",
    logoUrl: "🏪", status: "approved", address: "Rua Harmonia, 300 · Vila Madalena",
    location: { lat: -23.5569, lng: -46.6880 },
    offersDelivery: true, offersPickup: true, deliveryRadiusKm: 3,
    deliveryFeeCents: 500, freeDeliveryFromCents: 8000, minOrderCents: 1500,
    commissionBps: 800, slotMinutes: 30, prepMinutes: 30, hours: everyDay("06:30", "20:00"),
  },
  {
    id: "st-atacado", slug: "atacadao-futuro", name: "Atacadão Futuro",
    description: "Compras grandes para retirar no drive-thru.",
    logoUrl: "📦", status: "approved", address: "Av. Marquês de São Vicente, 2000 · Barra Funda",
    location: { lat: -23.5195, lng: -46.6798 },
    offersDelivery: false, offersPickup: true, deliveryRadiusKm: 0,
    deliveryFeeCents: 0, freeDeliveryFromCents: null, minOrderCents: 5000,
    commissionBps: 700, slotMinutes: 60, prepMinutes: 120, hours: everyDay("08:00", "22:00"),
  },
  {
    id: "st-pendente", slug: "emporio-sabor", name: "Empório Sabor",
    description: "Cadastro aguardando aprovação da plataforma.",
    logoUrl: "🧺", status: "pending", address: "Rua Oscar Freire, 700 · Jardins",
    location: { lat: -23.5636, lng: -46.6705 },
    offersDelivery: true, offersPickup: false, deliveryRadiusKm: 4,
    deliveryFeeCents: 890, freeDeliveryFromCents: null, minOrderCents: 4000,
    commissionBps: 1000, slotMinutes: 60, prepMinutes: 60, hours: everyDay("09:00", "20:00"),
  },
];

type Row = [name: string, emoji: string, category: string, priceCents: number, unit: Unit, description?: string];

const catalog: Record<string, Row[]> = {
  "st-verde": [
    ["Alface crespa orgânica", "🥬", "hortifruti", 450, "un"],
    ["Tomate orgânico", "🍅", "hortifruti", 1290, "kg"],
    ["Banana prata orgânica", "🍌", "hortifruti", 890, "kg"],
    ["Cenoura orgânica", "🥕", "hortifruti", 690, "kg"],
    ["Abacate", "🥑", "hortifruti", 790, "un"],
    ["Ovos caipira (12)", "🥚", "laticinios", 1890, "pct"],
    ["Iogurte natural integral", "🥛", "laticinios", 1150, "un", "500 g"],
    ["Pão de fermentação natural", "🍞", "padaria", 2400, "un"],
    ["Granola artesanal", "🥣", "mercearia", 2690, "pct", "500 g"],
    ["Kombucha de gengibre", "🧃", "bebidas", 1490, "un", "500 ml"],
  ],
  "st-nova": [
    ["Arroz branco tipo 1", "🍚", "mercearia", 2690, "pct", "5 kg"],
    ["Feijão carioca", "🫘", "mercearia", 899, "pct", "1 kg"],
    ["Macarrão espaguete", "🍝", "mercearia", 549, "pct", "500 g"],
    ["Azeite extravirgem", "🫒", "mercearia", 3990, "un", "500 ml"],
    ["Café torrado e moído", "☕", "mercearia", 1890, "pct", "500 g"],
    ["Leite integral", "🥛", "laticinios", 549, "l"],
    ["Queijo muçarela fatiado", "🧀", "laticinios", 1299, "pct", "200 g"],
    ["Peito de frango", "🍗", "acougue", 1990, "kg"],
    ["Patinho moído", "🥩", "acougue", 4290, "kg"],
    ["Maçã gala", "🍎", "hortifruti", 1090, "kg"],
    ["Batata", "🥔", "hortifruti", 690, "kg"],
    ["Refrigerante cola", "🥤", "bebidas", 999, "un", "2 l"],
    ["Água mineral", "💧", "bebidas", 299, "un", "1,5 l"],
    ["Detergente", "🧴", "limpeza", 279, "un", "500 ml"],
    ["Sabão em pó", "🧼", "limpeza", 2190, "pct", "1,6 kg"],
    ["Papel higiênico (12)", "🧻", "limpeza", 2290, "pct"],
  ],
  "st-bairro": [
    ["Pão francês", "🥖", "padaria", 1690, "kg"],
    ["Pão de queijo", "🧀", "padaria", 3990, "kg"],
    ["Bolo de fubá", "🍰", "padaria", 1800, "un"],
    ["Leite integral", "🥛", "laticinios", 589, "l"],
    ["Manteiga", "🧈", "laticinios", 1390, "un", "200 g"],
    ["Banana nanica", "🍌", "hortifruti", 690, "kg"],
    ["Café torrado e moído", "☕", "mercearia", 1990, "pct", "500 g"],
    ["Água com gás", "💧", "bebidas", 349, "un", "500 ml"],
  ],
  "st-atacado": [
    ["Arroz branco tipo 1 (fardo)", "🍚", "mercearia", 12990, "pct", "6 × 5 kg"],
    ["Óleo de soja (caixa)", "🫗", "mercearia", 8990, "pct", "20 × 900 ml"],
    ["Açúcar refinado (fardo)", "🍬", "mercearia", 4990, "pct", "10 × 1 kg"],
    ["Refrigerante cola (fardo)", "🥤", "bebidas", 4990, "pct", "6 × 2 l"],
    ["Papel higiênico (64)", "🧻", "limpeza", 8990, "pct"],
    ["Leite integral (caixa)", "🥛", "laticinios", 5990, "pct", "12 × 1 l"],
  ],
  "st-pendente": [
    ["Azeite português", "🫒", "mercearia", 5990, "un", "750 ml"],
    ["Queijo canastra", "🧀", "laticinios", 8990, "kg"],
  ],
};

/**
 * Catálogo de exemplo que o lojista pode copiar para a própria loja com um
 * clique. `search` é o termo usado para achar a foto da embalagem; frutas e
 * verduras não têm, porque aparecem em 3D nos cestos.
 */
export interface SampleProduct {
  name: string;
  emoji: string;
  categorySlug: string;
  priceCents: number;
  unit: Unit;
  description: string;
  search?: string;
}

export const sampleCatalog: SampleProduct[] = [
  ...catalog["st-verde"].slice(0, 5),
  ...catalog["st-nova"].filter(([, , c]) => c === "hortifruti"),
].map(([name, emoji, categorySlug, priceCents, unit, description]) => ({ name, emoji, categorySlug, priceCents, unit, description: description ?? "" }))
  .concat(
    ([
      ["Arroz branco tipo 1", "🍚", "mercearia", 2690, "pct", "5 kg", "arroz tipo 1 5kg"],
      ["Feijão carioca", "🫘", "mercearia", 899, "pct", "1 kg", "feijão carioca"],
      ["Macarrão espaguete", "🍝", "mercearia", 549, "pct", "500 g", "macarrão espaguete"],
      ["Café torrado e moído", "☕", "mercearia", 1890, "pct", "500 g", "café torrado e moído"],
      ["Açúcar refinado", "🍬", "mercearia", 499, "pct", "1 kg", "açúcar refinado"],
      ["Azeite extravirgem", "🫒", "mercearia", 3990, "un", "500 ml", "azeite extra virgem"],
      ["Óleo de soja", "🫗", "mercearia", 799, "un", "900 ml", "óleo de soja"],
      ["Biscoito recheado", "🍪", "mercearia", 349, "pct", "130 g", "biscoito recheado"],
      ["Leite integral", "🥛", "laticinios", 549, "l", "1 l", "leite integral"],
      ["Manteiga", "🧈", "laticinios", 1390, "un", "200 g", "manteiga"],
      ["Iogurte natural", "🥛", "laticinios", 1150, "un", "500 g", "iogurte natural"],
      ["Pão de forma", "🍞", "padaria", 899, "pct", "500 g", "pão de forma"],
      ["Refrigerante cola", "🥤", "bebidas", 999, "un", "2 l", "coca-cola 2l"],
      ["Refrigerante guaraná", "🥤", "bebidas", 849, "un", "2 l", "guaraná antarctica"],
      ["Água mineral", "💧", "bebidas", 299, "un", "1,5 l", "água mineral"],
      ["Suco de uva integral", "🧃", "bebidas", 1590, "un", "1 l", "suco de uva integral"],
      ["Cerveja lata", "🍺", "bebidas", 449, "un", "350 ml", "cerveja lata"],
      ["Detergente", "🧴", "limpeza", 279, "un", "500 ml", "detergente"],
      ["Sabão em pó", "🧼", "limpeza", 2190, "pct", "1,6 kg", "sabão em pó"],
    ] as const).map(([name, emoji, categorySlug, priceCents, unit, description, search]) => ({
      name, emoji, categorySlug, priceCents, unit, description, search,
    })),
  );

export const products: Product[] = Object.entries(catalog).flatMap(([storeId, rows]) =>
  rows.map(([name, emoji, categoryId, priceCents, unit, description], i) => ({
    id: `${storeId}-p${i + 1}`,
    storeId,
    categoryId,
    name,
    description: description ?? "",
    priceCents,
    unit,
    imageUrl: emoji,
    stock: 20 + ((i * 7) % 30),
    active: true,
  })),
);

export const demoAddresses: Address[] = [
  {
    label: "Casa · Consolação", street: "Rua da Consolação", number: "2200", neighborhood: "Consolação",
    city: "São Paulo", state: "SP", zip: "01302-000", location: { lat: -23.5531, lng: -46.6580 },
  },
  {
    label: "Trabalho · Pinheiros", street: "Rua dos Pinheiros", number: "500", neighborhood: "Pinheiros",
    city: "São Paulo", state: "SP", zip: "05422-001", location: { lat: -23.5663, lng: -46.6826 },
  },
  {
    label: "Casa · Mooca", street: "Rua da Mooca", number: "1000", neighborhood: "Mooca",
    city: "São Paulo", state: "SP", zip: "03104-000", location: { lat: -23.5577, lng: -46.6100 },
  },
];

export const demoCustomer = { id: "cliente-demo", name: "Cliente de demonstração" };
