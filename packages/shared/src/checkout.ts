import { deliversTo } from "./geo";
import type { Address, Cart, Fulfillment, Store } from "./types";
import { cartSubtotalCents } from "./cart";

export interface CheckoutInput {
  cart: Cart;
  store: Store;
  fulfillment: Fulfillment;
  address: Address | null;
  slotStart: string | null;
}

/** Lista os problemas que impedem fechar o pedido. Vazia = pode fechar. */
export function checkoutProblems({ cart, store, fulfillment, address, slotStart }: CheckoutInput): string[] {
  const problems: string[] = [];
  if (cart.items.length === 0) problems.push("O carrinho está vazio.");
  if (cart.storeId !== store.id) problems.push("O carrinho é de outra loja.");
  if (store.status !== "approved") problems.push("Esta loja não está aceitando pedidos.");
  const subtotal = cartSubtotalCents(cart);
  if (subtotal < store.minOrderCents) problems.push("O pedido não atingiu o valor mínimo da loja.");
  if (fulfillment === "delivery") {
    if (!store.offersDelivery) problems.push("Esta loja não faz entregas.");
    else if (!address) problems.push("Informe o endereço de entrega.");
    else if (!deliversTo(store, address.location)) problems.push("O endereço está fora da área de entrega da loja.");
  }
  if (fulfillment === "pickup" && !store.offersPickup) problems.push("Esta loja não oferece retirada.");
  if (!slotStart) problems.push("Escolha um horário.");
  return problems;
}
