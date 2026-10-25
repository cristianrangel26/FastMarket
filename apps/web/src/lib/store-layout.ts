import type { Category, Product } from "@mercado/shared";

// Monta a planta da loja 3D a partir do catálogo: um hortifrúti com bancas e
// cestos logo depois da entrada e, ao fundo, uma gôndola dupla por categoria,
// com os produtos repetidos nas prateleiras como num mercado real.
// Unidades em metros. O eixo z é o comprimento dos corredores; a entrada fica em +z.

export const GONDOLA = { length: 7.2, height: 1.9, depth: 0.9 };
export const SHELF_HEIGHTS = [0.12, 0.55, 0.98, 1.41];
export const SLOT_WIDTH = 0.3;
export const AISLE_WIDTH = 2.6;
/** Banca do hortifrúti: dois cestos lado a lado. */
export const TABLE = { width: 1.9, depth: 1.1, height: 0.75 };
export const CRATE = { width: 0.8, depth: 0.6, height: 0.22 };
const TABLE_GAP = { x: 1.5, z: 1.7 };
const MARGIN = { back: 3, side: 2.5, entrance: 4.5 };

/** Categorias exibidas em cestos em vez de prateleiras. */
export function isProduce(c: Category): boolean {
  return /hortifruti|hortifrúti|frutas|verduras|legumes/i.test(`${c.slug} ${c.name}`);
}

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

export interface Crate {
  productId: string;
  x: number;
  z: number;
}

export interface ProduceTable {
  x: number;
  z: number;
  crates: Crate[];
}

/** Retângulo no chão que não pode ser atravessado. */
export interface Obstacle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Ponto de parada da navegação fácil: onde ficar e para onde olhar. */
export interface Stop {
  id: string;
  label: string;
  emoji: string;
  x: number;
  z: number;
  /** Rotação em y da câmera (0 = olhando para -z). */
  yaw: number;
}

export interface StoreLayout {
  gondolas: Gondola[];
  produce: { category: Category; tables: ProduceTable[] } | null;
  obstacles: Obstacle[];
  stops: Stop[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  entrance: { x: number; z: number };
  checkout: { x: number; z: number };
}

/** Quantas frentes de cada produto, para as prateleiras parecerem cheias. */
function facingsFor(count: number, slotsPerFace: number): number {
  return Math.max(1, Math.min(4, Math.floor(slotsPerFace / Math.max(1, count))));
}

/** Yaw para olhar de (x, z) na direção de (tx, tz). */
function yawTo(x: number, z: number, tx: number, tz: number): number {
  return Math.atan2(-(tx - x), -(tz - z));
}

export function buildLayout(categories: Category[], products: Product[]): StoreLayout {
  const available = products.filter((p) => p.active && p.stock > 0);
  const used = categories.filter((c) => available.some((p) => p.categoryId === c.id));
  const produceCategory = used.find(isProduce) ?? null;
  const shelved = used.filter((c) => c !== produceCategory);

  const spacing = GONDOLA.depth + AISLE_WIDTH;
  const offset = ((shelved.length - 1) * spacing) / 2;
  const perShelf = Math.floor(GONDOLA.length / SLOT_WIDTH);
  const slotsPerFace = perShelf * SHELF_HEIGHTS.length;

  const gondolas = shelved.map((category, gi): Gondola => {
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

  // Largura da loja: o que for maior entre os corredores e o hortifrúti.
  const produceItems = produceCategory ? available.filter((p) => p.categoryId === produceCategory.id) : [];
  const tableCount = Math.ceil(produceItems.length / 2);
  const gondolaHalf = shelved.length ? offset + spacing / 2 : 0;
  const perRow = Math.max(2, Math.min(4, tableCount));
  const produceHalf = (perRow * TABLE.width + (perRow - 1) * TABLE_GAP.x) / 2;
  const halfWidth = Math.max(gondolaHalf, produceHalf, 4) + MARGIN.side;

  // Hortifrúti: fileiras de bancas entre a entrada e os corredores.
  const produceStartZ = (shelved.length ? GONDOLA.length / 2 : 0) + 2.2;
  const rows = Math.ceil(tableCount / perRow);
  const tables: ProduceTable[] = [];
  for (let t = 0; t < tableCount; t++) {
    const row = Math.floor(t / perRow);
    const inRow = Math.min(perRow, tableCount - row * perRow);
    const col = t % perRow;
    const rowWidth = inRow * TABLE.width + (inRow - 1) * TABLE_GAP.x;
    const x = -rowWidth / 2 + TABLE.width / 2 + col * (TABLE.width + TABLE_GAP.x);
    const z = produceStartZ + TABLE.depth / 2 + row * (TABLE.depth + TABLE_GAP.z);
    const crates = produceItems.slice(t * 2, t * 2 + 2).map((p, i) => ({
      productId: p.id,
      x: x + (i === 0 ? -1 : 1) * (CRATE.width / 2 + 0.08),
      z,
    }));
    tables.push({ x, z, crates });
  }
  const produceDepth = rows ? rows * TABLE.depth + (rows - 1) * TABLE_GAP.z : 0;
  const maxZ = produceStartZ + produceDepth + MARGIN.entrance;
  const minZ = (shelved.length ? -GONDOLA.length / 2 : 0) - MARGIN.back;

  const obstacles: Obstacle[] = [
    ...gondolas.map((g) => ({
      minX: g.x - GONDOLA.depth / 2,
      maxX: g.x + GONDOLA.depth / 2,
      minZ: -GONDOLA.length / 2,
      maxZ: GONDOLA.length / 2,
    })),
    ...tables.map((t) => ({
      minX: t.x - TABLE.width / 2,
      maxX: t.x + TABLE.width / 2,
      minZ: t.z - TABLE.depth / 2,
      maxZ: t.z + TABLE.depth / 2,
    })),
  ];

  const entrance = { x: 0, z: maxZ - 1.2 };
  const checkout = { x: -halfWidth + 1.6, z: maxZ - 2.6 };
  obstacles.push({ minX: checkout.x - 0.4, maxX: checkout.x + 0.4, minZ: checkout.z - 1.1, maxZ: checkout.z + 1.1 });

  // Paradas da navegação fácil, na ordem de um passeio pela loja.
  const stops: Stop[] = [{ id: "entrada", label: "Entrada", emoji: "🚪", x: entrance.x, z: entrance.z, yaw: 0 }];
  if (produceCategory && tables.length) {
    const z = produceStartZ + produceDepth + 1.3;
    stops.push({ id: produceCategory.id, label: produceCategory.name, emoji: produceCategory.emoji, x: 0, z, yaw: yawTo(0, z, 0, produceStartZ) });
  }
  for (const g of gondolas) {
    // De pé no corredor, ao lado da gôndola, olhando para as prateleiras.
    const x = g.x + GONDOLA.depth / 2 + 1.1;
    stops.push({ id: g.category.id, label: g.category.name, emoji: g.category.emoji, x, z: 0.6, yaw: yawTo(x, 0.6, g.x, 0.2) });
  }
  stops.push({ id: "caixa", label: "Caixa", emoji: "💳", x: checkout.x + 1.6, z: checkout.z, yaw: yawTo(checkout.x + 1.6, checkout.z, checkout.x, checkout.z) });

  return {
    gondolas,
    produce: produceCategory && tables.length ? { category: produceCategory, tables } : null,
    obstacles,
    stops,
    bounds: { minX: -halfWidth, maxX: halfWidth, minZ, maxZ },
    entrance,
    checkout,
  };
}

/** Empurra o ponto para fora dos obstáculos e para dentro das paredes. */
export function collide(layout: StoreLayout, x: number, z: number, radius = 0.3): { x: number; z: number } {
  const { bounds } = layout;
  x = Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, x));
  z = Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, z));
  for (const o of layout.obstacles) {
    const minX = o.minX - radius;
    const maxX = o.maxX + radius;
    const minZ = o.minZ - radius;
    const maxZ = o.maxZ + radius;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      // Sai pelo lado mais próximo.
      const moves = [
        { d: x - minX, apply: () => (x = minX) },
        { d: maxX - x, apply: () => (x = maxX) },
        { d: z - minZ, apply: () => (z = minZ) },
        { d: maxZ - z, apply: () => (z = maxZ) },
      ];
      moves.sort((a, b) => a.d - b.d)[0].apply();
    }
  }
  return { x, z };
}

function blocked(layout: StoreLayout, x: number, z: number, radius: number): boolean {
  const { bounds } = layout;
  if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return true;
  return layout.obstacles.some((o) => x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius);
}

function clearLine(layout: StoreLayout, a: { x: number; z: number }, b: { x: number; z: number }, radius: number): boolean {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked(layout, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, radius)) return false;
  }
  return true;
}

/**
 * Caminho livre de obstáculos entre dois pontos (A* numa grade de 25 cm,
 * depois encurtado em linhas retas), para o deslocamento automático.
 */
export function findPath(layout: StoreLayout, from: { x: number; z: number }, to: { x: number; z: number }, radius = 0.4): { x: number; z: number }[] {
  if (clearLine(layout, from, to, radius)) return [to];
  const cell = 0.25;
  const { minX, minZ, maxX, maxZ } = layout.bounds;
  const cols = Math.ceil((maxX - minX) / cell);
  const rows = Math.ceil((maxZ - minZ) / cell);
  const idx = (c: number, r: number) => r * cols + c;
  const center = (c: number, r: number) => ({ x: minX + (c + 0.5) * cell, z: minZ + (r + 0.5) * cell });
  const toCell = (p: { x: number; z: number }) => ({
    c: Math.min(cols - 1, Math.max(0, Math.floor((p.x - minX) / cell))),
    r: Math.min(rows - 1, Math.max(0, Math.floor((p.z - minZ) / cell))),
  });
  const free = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = center(c, r);
    free[idx(c, r)] = blocked(layout, p.x, p.z, radius) ? 0 : 1;
  }
  const s = toCell(from);
  const g = toCell(to);
  const goal = idx(g.c, g.r);
  const cost = new Float32Array(cols * rows).fill(Infinity);
  const came = new Int32Array(cols * rows).fill(-1);
  const open: number[] = [idx(s.c, s.r)];
  cost[open[0]] = 0;
  const h = (i: number) => Math.hypot((i % cols) - g.c, Math.floor(i / cols) - g.r);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (open.length) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (cost[open[i]] + h(open[i]) < cost[open[best]] + h(open[best])) best = i;
    const cur = open.splice(best, 1)[0];
    if (cur === goal) break;
    const cc = cur % cols;
    const cr = Math.floor(cur / cols);
    for (const [dc, dr] of dirs) {
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = idx(nc, nr);
      if (!free[n] && n !== goal) continue;
      const nCost = cost[cur] + Math.hypot(dc, dr);
      if (nCost < cost[n]) {
        cost[n] = nCost;
        came[n] = cur;
        if (!open.includes(n)) open.push(n);
      }
    }
  }
  if (came[goal] === -1) return [to];
  const cells: { x: number; z: number }[] = [];
  for (let i = goal; i !== -1 && i !== idx(s.c, s.r); i = came[i]) cells.unshift(center(i % cols, Math.floor(i / cols)));
  cells[cells.length - 1] = to;
  // Encurta: pula pontos intermediários enquanto houver linha livre.
  const path: { x: number; z: number }[] = [];
  let anchor = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(layout, anchor, cells[j], radius * 0.9)) j--;
    path.push(cells[j]);
    anchor = cells[j];
    i = j + 1;
  }
  return path;
}
