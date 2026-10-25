"use client";

import { useSyncExternalStore } from "react";
import {
  addToCart,
  canTransition,
  computeOrderTotals,
  emptyCart,
  setQuantity,
  type Address,
  type Cart,
  type Fulfillment,
  type Order,
  type OrderStatus,
  type Product,
  type Store,
  type TimeSlot,
} from "@mercado/shared";
import * as seed from "./demo-data";

// Estado da demonstração, guardado no navegador. Quando o Supabase estiver
// conectado, catálogo e pedidos passam a vir do banco e só o carrinho fica aqui.

export interface DemoState {
  cart: Cart;
  address: Address;
  orders: Order[];
  storePatches: Record<string, Partial<Pick<Store, "status" | "commissionBps">>>;
  productPatches: Record<string, Partial<Pick<Product, "priceCents" | "stock" | "active">>>;
}

const KEY = "mercado-futuro:demo:v1";

const initial: DemoState = {
  cart: emptyCart,
  address: seed.demoAddresses[0],
  orders: [],
  storePatches: {},
  productPatches: {},
};

let state: DemoState = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...initial, ...JSON.parse(raw) };
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue só em memória.
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = { ...initial, ...JSON.parse(e.newValue) };
      listeners.forEach((l) => l());
    } catch {}
  });
}

function update(fn: (s: DemoState) => DemoState) {
  load();
  state = fn(state);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Estado inteiro; derive listas com useMemo para não recalcular a cada render. */
export function useDemo(): DemoState {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => initial,
  );
}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// Catálogo ------------------------------------------------------------------

export function allStores(s: DemoState): Store[] {
  return seed.stores.map((st) => ({ ...st, ...s.storePatches[st.id] }));
}

export function storeProducts(s: DemoState, storeId: string): Product[] {
  return seed.products
    .filter((p) => p.storeId === storeId)
    .map((p) => ({ ...p, ...s.productPatches[p.id] }));
}

export const categories = seed.categories;
export const demoAddresses = seed.demoAddresses;

// Ações ---------------------------------------------------------------------

export const demo = {
  addToCart(product: Product, quantity = 1, replaceStore = false) {
    update((s) => ({ ...s, cart: addToCart(s.cart, product, quantity, { replaceStore }) }));
  },
  setQuantity(productId: string, quantity: number) {
    update((s) => ({ ...s, cart: setQuantity(s.cart, productId, quantity) }));
  },
  clearCart() {
    update((s) => ({ ...s, cart: emptyCart }));
  },
  setAddress(address: Address) {
    update((s) => ({ ...s, address }));
  },

  /** Faz o que o `place_order` do banco faz: recalcula preços e reserva o estoque. */
  placeOrder(store: Store, fulfillment: Fulfillment, slot: TimeSlot): Order {
    let order!: Order;
    update((s) => {
      const products = storeProducts(s, store.id);
      const items = s.cart.items.map((i) => {
        const p = products.find((x) => x.id === i.productId);
        if (!p || !p.active) throw new Error(`${i.name} não está mais disponível.`);
        if (p.stock < i.quantity) throw new Error(`Estoque insuficiente de ${p.name}.`);
        return { productId: p.id, name: p.name, unitPriceCents: p.priceCents, quantity: i.quantity };
      });
      order = {
        id: crypto.randomUUID(),
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        storeId: store.id,
        customerId: seed.demoCustomer.id,
        customerName: seed.demoCustomer.name,
        fulfillment,
        deliveryProvider: fulfillment === "delivery" ? "store" : null,
        address: fulfillment === "delivery" ? s.address : null,
        slot,
        items,
        totals: computeOrderTotals(store, items, fulfillment),
        status: "awaiting_payment",
        paymentStatus: "pending",
        createdAt: new Date().toISOString(),
      };
      const productPatches = { ...s.productPatches };
      for (const i of items) {
        const p = products.find((x) => x.id === i.productId)!;
        productPatches[p.id] = { ...productPatches[p.id], stock: p.stock - i.quantity };
      }
      return { ...s, cart: emptyCart, orders: [order, ...s.orders], productPatches };
    });
    return order;
  },

  /** Simula a confirmação do pagamento que chega pelo webhook do Mercado Pago. */
  confirmPayment(orderId: string) {
    update((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId && o.status === "awaiting_payment"
          ? { ...o, paymentStatus: "approved", status: "received" }
          : o,
      ),
    }));
  },

  advanceOrder(orderId: string, to: OrderStatus) {
    update((s) => {
      const order = s.orders.find((o) => o.id === orderId);
      if (!order || !canTransition(order.fulfillment, order.status, to)) return s;
      const productPatches = { ...s.productPatches };
      if (to === "cancelled") {
        const products = storeProducts(s, order.storeId);
        for (const i of order.items) {
          const p = products.find((x) => x.id === i.productId);
          if (p) productPatches[p.id] = { ...productPatches[p.id], stock: p.stock + i.quantity };
        }
      }
      return {
        ...s,
        productPatches,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: to, paymentStatus: to === "cancelled" && o.paymentStatus === "approved" ? "refunded" : o.paymentStatus }
            : o,
        ),
      };
    });
  },

  patchStore(storeId: string, patch: DemoState["storePatches"][string]) {
    update((s) => ({ ...s, storePatches: { ...s.storePatches, [storeId]: { ...s.storePatches[storeId], ...patch } } }));
  },
  patchProduct(productId: string, patch: DemoState["productPatches"][string]) {
    update((s) => ({
      ...s,
      productPatches: { ...s.productPatches, [productId]: { ...s.productPatches[productId], ...patch } },
    }));
  },
  reset() {
    update(() => initial);
  },
};
