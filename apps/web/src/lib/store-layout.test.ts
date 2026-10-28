import { describe, expect, it } from "vitest";
import type { Category, Product } from "@mercado/shared";
import { COOLER, GONDOLA, buildLayout, collide, findPath } from "./store-layout";

const cat = (id: string, name = id): Category => ({ id, slug: id, name, emoji: "🛒" });
const prod = (id: string, categoryId: string, extra: Partial<Product> = {}): Product => ({
  id, storeId: "s", categoryId, name: id, description: "", priceCents: 100, unit: "un",
  imageUrl: null, stock: 5, active: true, ...extra,
});

describe("planta da loja 3D", () => {
  const categories = [cat("hortifruti", "Hortifrúti"), cat("a"), cat("b"), cat("vazia")];
  const products = [
    prod("banana", "hortifruti"), prod("maca", "hortifruti"), prod("alface", "hortifruti"),
    prod("a1", "a"), prod("a2", "a"), prod("b1", "b"), prod("b2", "b", { stock: 0 }), prod("b3", "b", { active: false }),
  ];
  const layout = buildLayout(categories, products);

  it("cria uma gôndola por categoria de prateleira com produtos à venda", () => {
    expect(layout.gondolas.map((g) => g.category.id)).toEqual(["a", "b"]);
  });

  it("enche as duas faces só com produtos disponíveis", () => {
    const b = layout.gondolas[1];
    expect(new Set(b.slots.map((s) => s.productId))).toEqual(new Set(["b1"]));
    expect(b.slots.filter((s) => s.facing === 1).length).toBe(b.slots.filter((s) => s.facing === -1).length);
    expect(b.slots.every((s) => Math.abs(s.z) <= GONDOLA.length / 2)).toBe(true);
  });

  it("põe frutas e verduras em cestos, um produto por cesto, entre a entrada e os corredores", () => {
    const crates = layout.produce!.tables.flatMap((t) => t.crates);
    expect(crates.map((c) => c.productId)).toEqual(["banana", "maca", "alface"]);
    expect(layout.produce!.tables.every((t) => t.z > GONDOLA.length / 2 && t.z < layout.entrance.z)).toBe(true);
  });

  it("tem uma parada da navegação fácil por seção, fora dos obstáculos", () => {
    expect(layout.stops.map((s) => s.id)).toEqual(["entrada", "hortifruti", "a", "b", "caixa"]);
    for (const s of layout.stops) expect(collide(layout, s.x, s.z)).toEqual({ x: s.x, z: s.z });
  });

  it("não deixa atravessar gôndolas, bancas nem paredes", () => {
    const g = layout.gondolas[0];
    const inside = collide(layout, g.x + 0.1, 0);
    expect(Math.abs(inside.x - g.x)).toBeGreaterThanOrEqual(GONDOLA.depth / 2);
    const t = layout.produce!.tables[0];
    const onTable = collide(layout, t.x, t.z);
    expect(onTable).not.toEqual({ x: t.x, z: t.z });
    const out = collide(layout, 1000, 1000);
    expect(out.x).toBeLessThan(layout.bounds.maxX);
    expect(out.z).toBeLessThan(layout.bounds.maxZ);
  });
});

describe("caminho automático", () => {
  const layout = buildLayout(
    [cat("hortifruti", "Hortifrúti"), cat("a"), cat("b"), cat("c")],
    [prod("banana", "hortifruti"), prod("maca", "hortifruti"), prod("uva", "hortifruti"), prod("a1", "a"), prod("b1", "b"), prod("c1", "c")],
  );

  it("vai da entrada até um corredor sem atravessar bancas nem gôndolas", () => {
    const target = layout.stops.find((s) => s.id === "b")!;
    const path = findPath(layout, layout.entrance, target);
    expect(path.at(-1)).toEqual(target);
    let prev = layout.entrance;
    for (const p of path) {
      const steps = Math.ceil(Math.hypot(p.x - prev.x, p.z - prev.z) / 0.05);
      for (let i = 0; i <= steps; i++) {
        const x = prev.x + ((p.x - prev.x) * i) / steps;
        const z = prev.z + ((p.z - prev.z) * i) / steps;
        expect(collide(layout, x, z, 0.25)).toEqual({ x, z });
      }
      prev = p;
    }
  });
});

describe("balcões refrigerados e pontas de gôndola", () => {
  const layout = buildLayout(
    [cat("hortifruti", "Hortifrúti"), cat("mercearia"), cat("laticinios", "Laticínios"), cat("acougue", "Açougue")],
    [prod("banana", "hortifruti"), prod("arroz", "mercearia"), prod("feijao", "mercearia"), prod("leite", "laticinios"), prod("carne", "acougue")],
  );

  it("põe laticínios e açougue nos balcões da parede do fundo, não nas gôndolas", () => {
    expect(layout.gondolas.map((g) => g.category.id)).toEqual(["mercearia"]);
    expect(layout.coolers.map((c) => c.category.id)).toEqual(["laticinios", "acougue"]);
    for (const c of layout.coolers) {
      expect(c.z - COOLER.depth / 2).toBeGreaterThanOrEqual(layout.bounds.minZ);
      expect(c.slots.every((s) => s.rotY === 0 && Math.abs(s.x - c.x) <= c.length / 2)).toBe(true);
    }
  });

  it("tem ponta de gôndola com os produtos em destaque", () => {
    const ids = new Set(layout.gondolas[0].endcap.map((s) => s.productId));
    expect(ids).toEqual(new Set(["arroz", "feijao"]));
  });

  it("chega a todas as seções, inclusive aos balcões, sem atravessar nada", () => {
    expect(layout.stops.map((s) => s.id)).toEqual(["entrada", "hortifruti", "mercearia", "laticinios", "acougue", "caixa"]);
    for (const s of layout.stops) {
      expect(collide(layout, s.x, s.z)).toEqual({ x: s.x, z: s.z });
      expect(findPath(layout, layout.entrance, s).at(-1)).toEqual(s);
    }
  });
});
