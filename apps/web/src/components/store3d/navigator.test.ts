import { describe, expect, it } from "vitest";
import { buildLayout, collide, findPath } from "@/lib/store-layout";
import { categories, products } from "@/lib/demo-data";
import { Navigator, angleDiff } from "./navigator";

const layout = buildLayout(categories, products.filter((p) => p.storeId === "st-nova"));

/** Simula a câmera a 20 quadros por segundo até a navegação terminar. */
function walk(nav: Navigator, from: { x: number; z: number }, look = { yaw: 0, pitch: 0 }) {
  let pos = from;
  for (let frame = 0; frame < 20 * 120; frame++) {
    pos = collide(layout, ...(Object.values(nav.step(pos, look, 0.05)) as [number, number]));
    nav.track(pos, look.yaw);
    if (!nav.path.length && nav.finalYaw === null && !nav.pendingTurn) return { pos, look, seconds: frame / 20 };
  }
  throw new Error("não chegou");
}

describe("navegação fácil", () => {
  it("leva da entrada até cada seção, de frente para ela", () => {
    for (const stop of layout.stops) {
      const nav = new Navigator();
      nav.go(findPath(layout, layout.entrance, stop), stop.yaw);
      const { pos, look, seconds } = walk(nav, layout.entrance);
      expect(Math.hypot(pos.x - stop.x, pos.z - stop.z)).toBeLessThan(0.1);
      expect(Math.abs(angleDiff(look.yaw, stop.yaw))).toBeLessThan(0.02);
      expect(seconds).toBeLessThan(30);
    }
  });

  it("vira 45 graus quando pedido", () => {
    const nav = new Navigator();
    nav.turn(Math.PI / 4);
    const { look } = walk(nav, layout.entrance);
    expect(look.yaw).toBeCloseTo(Math.PI / 4, 3);
  });
});
