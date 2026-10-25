import type { Category, Product } from "@mercado/shared";

// Monta a planta da loja 3D a partir do catálogo: uma gôndola dupla por
// categoria, com os produtos repetidos nas prateleiras como num mercado real.
// Unidades em metros. O eixo z é o comprimento dos corredores; a entrada fica em +z.

export const GONDOLA = { length: 7.2, height: 1.9, depth: 0.9 };
export const SHELF_HEIGHTS = [0.12, 0.55, 0.98, 1.41];
export const SLOT_WIDTH = 0.3;
export const AISLE_WIDTH = 2.6;
/** Distância livre entre o fim dos corredores e as paredes. */
export const MARGIN = { front: 6, back: 3, side: 2.5 };

export interface Slot {
  productId: string;
  x: number;
  y: number;
  z: number;
  /** 1 = frente virada para +x, -1 = para -x. */
  facing: 1 | -1;
}

export interface Gondola {
  category: Category;
  x: number;
  slots: Slot[];
}

export interface StoreLayout {
  gondolas: Gondola[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  entrance: { x: number; z: number };
  checkout: { x: number; z: number };
}

/** Quantas frentes de cada produto, para as prateleiras parecerem cheias. */
function facingsFor(count: number, slotsPerFace: number): number {
  return Math.max(1, Math.min(4, Math.floor(slotsPerFace / Math.max(1, count))));
}

export function buildLayout(categories: Category[], products: Product[]): StoreLayout {
  const available = products.filter((p) => p.active && p.stock > 0);
  const used = categories.filter((c) => available.some((p) => p.categoryId === c.id));
  const spacing = GONDOLA.depth + AISLE_WIDTH;
  const offset = ((used.length - 1) * spacing) / 2;
  const perShelf = Math.floor(GONDOLA.length / SLOT_WIDTH);
  const slotsPerFace = perShelf * SHELF_HEIGHTS.length;

  const gondolas = used.map((category, gi): Gondola => {
    const x = gi * spacing - offset;
    const items = available.filter((p) => p.categoryId === category.id);
    const facings = facingsFor(items.length, slotsPerFace);
    // Sequência de produtos que enche uma face, do topo para baixo e da entrada para o fundo.
    const sequence: string[] = [];
    while (sequence.length < slotsPerFace) {
      for (const p of items) for (let f = 0; f < facings && sequence.length < slotsPerFace; f++) sequence.push(p.id);
    }
    const slots: Slot[] = [];
    for (const facing of [1, -1] as const) {
      sequence.forEach((productId, i) => {
        const shelf = SHELF_HEIGHTS.length - 1 - Math.floor(i / perShelf);
        const col = i % perShelf;
        slots.push({
          productId,
          x: x + facing * (GONDOLA.depth / 2 - 0.15),
          y: SHELF_HEIGHTS[shelf],
          z: GONDOLA.length / 2 - SLOT_WIDTH / 2 - col * SLOT_WIDTH,
          facing,
        });
      });
    }
    return { category, x, slots };
  });

  const halfWidth = Math.max(offset + spacing / 2 + MARGIN.side, 6);
  return {
    gondolas,
    bounds: {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -GONDOLA.length / 2 - MARGIN.back,
      maxZ: GONDOLA.length / 2 + MARGIN.front,
    },
    entrance: { x: 0, z: GONDOLA.length / 2 + MARGIN.front - 1 },
    checkout: { x: -halfWidth + 2, z: GONDOLA.length / 2 + MARGIN.front - 2.2 },
  };
}

/** Empurra o ponto para fora das gôndolas e para dentro das paredes. */
export function collide(layout: StoreLayout, x: number, z: number, radius = 0.3): { x: number; z: number } {
  const { bounds } = layout;
  x = Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x));
  z = Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z));
  const hx = GONDOLA.depth / 2 + radius;
  const hz = GONDOLA.length / 2 + radius;
  for (const g of layout.gondolas) {
    const dx = x - g.x;
    if (Math.abs(dx) < hx && Math.abs(z) < hz) {
      // Sai pelo lado mais próximo.
      const pushX = hx - Math.abs(dx);
      const pushZ = hz - Math.abs(z);
      if (pushX < pushZ) x = g.x + Math.sign(dx || 1) * hx;
      else z = Math.sign(z || 1) * hz;
    }
  }
  return { x, z };
}
