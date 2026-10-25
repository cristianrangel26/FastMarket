import type { Fulfillment, OrderItem, OrderTotals, Store } from "./types";

type PricingStore = Pick<Store, "deliveryFeeCents" | "freeDeliveryFromCents" | "commissionBps">;

export function deliveryFeeCents(store: PricingStore, subtotalCents: number, fulfillment: Fulfillment): number {
  if (fulfillment === "pickup") return 0;
  if (store.freeDeliveryFromCents !== null && subtotalCents >= store.freeDeliveryFromCents) return 0;
  return store.deliveryFeeCents;
}

/**
 * Calcula os valores do pedido e a divisão entre loja e plataforma.
 * A comissão incide só sobre o subtotal dos produtos; o frete fica com a loja,
 * que é quem entrega no MVP.
 */
export function computeOrderTotals(
  store: PricingStore,
  items: Pick<OrderItem, "unitPriceCents" | "quantity">[],
  fulfillment: Fulfillment,
): OrderTotals {
  const subtotalCents = items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  const fee = deliveryFeeCents(store, subtotalCents, fulfillment);
  const totalCents = subtotalCents + fee;
  const platformFeeCents = Math.round((subtotalCents * store.commissionBps) / 10_000);
  return {
    subtotalCents,
    deliveryFeeCents: fee,
    totalCents,
    platformFeeCents,
    storePayoutCents: totalCents - platformFeeCents,
  };
}
