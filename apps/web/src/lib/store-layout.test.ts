import { describe, expect, it } from "vitest";
import type { Category, Product } from "@mercado/shared";
import { GONDOLA, buildLayout, collide } from "./store-layout";

const cat = (id: string): Category => ({ id, slug: id, name: id, emoji: "🛒" });
const prod = (id: string, categoryId: string, extra: Partial<Product> = {}): Product => ({
  id, storeId: "s", categoryId, name: id, description: "", priceCents: 100, unit: "un",
  imageUrl: null, stock: 5, active: true, ...extra,
});

describe("planta da loja 3D", () => {
  const categories = [cat("a"), cat("b"), cat("vazia")];
  const products = [prod("a1", "a"), prod("a2", "a"), prod("b1", "b"), prod("b2", "b", { stock: 0 }), prod("b3", "b", { active: false })];
  const layout = buildLayout(categories, products);

  it("cria uma gôndola por categoria com produtos à venda", () => {
    expect(layout.gondolas.map((g) => g.category.id)).toEqual(["a", "b"]);
  });

  it("enche as duas faces só com produtos disponíveis", () => {
    const b = layout.gondolas[1];
    expect(new Set(b.slots.map((s) => s.productId))).toEqual(new Set(["b1"]));
    expect(b.slots.filter((s) => s.facing === 1).length).toBe(b.slots.filter((s) => s.facing === -1).length);
    expect(b.slots.every((s) => Math.abs(s.z) <= GONDOLA.length / 2)).toBe(true);
  });

  it("não deixa atravessar gôndolas nem paredes", () => {
    const g = layout.gondolas[0];
    const inside = collide(layout, g.x + 0.1, 0);
    expect(Math.abs(inside.x - g.x)).toBeGreaterThanOrEqual(GONDOLA.depth / 2);
    const out = collide(layout, 1000, 1000);
    expect(out.x).toBeLessThan(layout.bounds.maxX);
    expect(out.z).toBeLessThan(layout.bounds.maxZ);
  });
});
