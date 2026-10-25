import { describe, expect, it } from "vitest";
import {
  addToCart,
  availableSlots,
  canTransition,
  CartStoreConflictError,
  cartSubtotalCents,
  checkoutProblems,
  computeOrderTotals,
  distanceKm,
  emptyCart,
  formatBRL,
  nextStatus,
  setQuantity,
  type Store,
} from "./index";

const store: Store = {
  id: "s1",
  slug: "loja",
  name: "Loja",
  description: "",
  logoUrl: null,
  status: "approved",
  address: "",
  location: { lat: -23.55, lng: -46.63 },
  offersDelivery: true,
  offersPickup: true,
  deliveryRadiusKm: 5,
  deliveryFeeCents: 799,
  freeDeliveryFromCents: 15000,
  minOrderCents: 2000,
  commissionBps: 1000,
  slotMinutes: 60,
  prepMinutes: 60,
  hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "08:00", closes: "12:00" })),
};

const arroz = { id: "p1", storeId: "s1", name: "Arroz", priceCents: 2500 };
const feijao = { id: "p2", storeId: "s1", name: "Feijão", priceCents: 900 };
const outraLoja = { id: "p3", storeId: "s2", name: "Leite", priceCents: 500 };

describe("carrinho", () => {
  it("soma quantidades do mesmo produto", () => {
    const cart = addToCart(addToCart(emptyCart, arroz), arroz, 2);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
    expect(cartSubtotalCents(cart)).toBe(7500);
  });

  it("não mistura lojas sem permissão", () => {
    const cart = addToCart(emptyCart, arroz);
    expect(() => addToCart(cart, outraLoja)).toThrow(CartStoreConflictError);
    const trocado = addToCart(cart, outraLoja, 1, { replaceStore: true });
    expect(trocado.storeId).toBe("s2");
    expect(trocado.items).toHaveLength(1);
  });

  it("remove item com quantidade zero e esvazia a loja", () => {
    const cart = setQuantity(addToCart(emptyCart, arroz), "p1", 0);
    expect(cart).toEqual(emptyCart);
  });
});

describe("valores do pedido", () => {
  it("cobra frete abaixo do mínimo para frete grátis e calcula a comissão", () => {
    const t = computeOrderTotals(store, [{ unitPriceCents: 2500, quantity: 2 }], "delivery");
    expect(t).toEqual({
      subtotalCents: 5000,
      deliveryFeeCents: 799,
      totalCents: 5799,
      platformFeeCents: 500,
      storePayoutCents: 5299,
    });
  });

  it("frete grátis acima do limite e na retirada", () => {
    expect(computeOrderTotals(store, [{ unitPriceCents: 15000, quantity: 1 }], "delivery").deliveryFeeCents).toBe(0);
    expect(computeOrderTotals(store, [{ unitPriceCents: 100, quantity: 1 }], "pickup").deliveryFeeCents).toBe(0);
  });

  it("formata em reais", () => {
    expect(formatBRL(5799).replace(/\s/g, " ")).toBe("R$ 57,99");
  });
});

describe("status do pedido", () => {
  it("segue o fluxo de entrega e de retirada", () => {
    expect(nextStatus("delivery", "picking")).toBe("out_for_delivery");
    expect(nextStatus("pickup", "picking")).toBe("ready_for_pickup");
    expect(nextStatus("pickup", "completed")).toBeNull();
  });

  it("não pula etapas nem cancela pedido concluído", () => {
    expect(canTransition("delivery", "received", "completed")).toBe(false);
    expect(canTransition("delivery", "received", "cancelled")).toBe(true);
    expect(canTransition("delivery", "completed", "cancelled")).toBe(false);
  });
});

describe("área e horários", () => {
  it("calcula distância aproximada", () => {
    // Praça da Sé até a Av. Paulista (MASP): ~2,8 km
    const d = distanceKm({ lat: -23.5503, lng: -46.6339 }, { lat: -23.5614, lng: -46.6559 });
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(3);
  });

  it("respeita o tempo de preparo e o horário de fechamento", () => {
    const now = new Date(2026, 9, 25, 9, 30);
    const slots = availableSlots(store, now, 1);
    expect(slots.map((s) => new Date(s.start).getHours())).toEqual([11]);
  });
});

describe("checkout", () => {
  const cart = addToCart(emptyCart, arroz);
  const perto = {
    label: "Casa", street: "Rua A", number: "1", neighborhood: "Centro",
    city: "São Paulo", state: "SP", zip: "01000-000", location: { lat: -23.56, lng: -46.64 },
  };
  const longe = { ...perto, location: { lat: -22.9, lng: -43.2 } };

  it("aceita um pedido válido", () => {
    expect(checkoutProblems({ cart, store, fulfillment: "delivery", address: perto, slotStart: "x" })).toEqual([]);
  });

  it("aponta valor mínimo, área de entrega e horário", () => {
    const pequeno = addToCart(emptyCart, feijao);
    const problems = checkoutProblems({ cart: pequeno, store, fulfillment: "delivery", address: longe, slotStart: null });
    expect(problems).toEqual([
      "O pedido não atingiu o valor mínimo da loja.",
      "O endereço está fora da área de entrega da loja.",
      "Escolha um horário.",
    ]);
  });
});
