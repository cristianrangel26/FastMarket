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
  type Category,
  type Fulfillment,
  type Order,
  type OrderStatus,
  type Product,
  type Store,
  type TimeSlot,
} from "@mercado/shared";
import * as seed from "./demo-data";
import { fromAddress, toAddress, toCategory, toOrder, toProduct, toStore } from "./mappers";
import { friendlyError, supabase, supabaseConfigured } from "./supabase";

// Estado do app no navegador. Com o Supabase configurado, catálogo, pedidos e
// conta vêm do banco e só o carrinho e o endereço escolhido ficam guardados aqui.
// Sem ele, tudo roda em modo demonstração com os dados de demo-data.ts.

export type Role = "customer" | "store_owner" | "platform_admin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface AppState {
  mode: "demo" | "supabase";
  /** Catálogo carregado. */
  ready: boolean;
  user: User | null;
  cart: Cart;
  address: Address | null;
  addresses: Address[];
  categories: Category[];
  stores: Store[];
  products: Product[];
  orders: Order[];
}

const KEY = "mercado-futuro:v2";
const demoUser: User = { id: seed.demoCustomer.id, email: "", name: seed.demoCustomer.name, role: "platform_admin" };

const initial: AppState = supabaseConfigured
  ? {
      mode: "supabase", ready: false, user: null, cart: emptyCart, address: null,
      addresses: [], categories: [], stores: [], products: [], orders: [],
    }
  : {
      mode: "demo", ready: true, user: demoUser, cart: emptyCart, address: seed.demoAddresses[0],
      addresses: seed.demoAddresses, categories: seed.categories, stores: seed.stores, products: seed.products, orders: [],
    };

/** O que fica salvo no navegador em cada modo. */
function persisted(s: AppState): Partial<AppState> {
  if (s.mode === "supabase") return { cart: s.cart, address: s.address };
  const { cart, address, stores, products, orders } = s;
  return { cart, address, stores, products, orders };
}

let state: AppState = initial;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  start();
  state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(persisted(state)));
  } catch {
    // Navegação privada ou armazenamento bloqueado: segue só em memória.
  }
  emit();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...state, ...JSON.parse(raw) };
  } catch {}
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      state = { ...state, ...JSON.parse(e.newValue) };
      emit();
    } catch {}
  });
  if (state.mode === "supabase") void connect();
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Estado inteiro; derive listas com useMemo para não recalcular a cada render. */
export function useApp(): AppState {
  return useSyncExternalStore(
    subscribe,
    () => {
      start();
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

// Supabase --------------------------------------------------------------------

async function connect() {
  const sb = supabase();
  sb.auth.onAuthStateChange((_event, session) => {
    // Recarrega fora do callback, como recomenda o supabase-js.
    setTimeout(() => void loadAll(session?.user ?? null), 0);
  });
  sb.channel("orders")
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void loadOrders())
    .subscribe();
}

async function loadAll(authUser: { id: string; email?: string } | null) {
  const sb = supabase();
  let user: User | null = null;
  if (authUser) {
    const { data } = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
    user = { id: authUser.id, email: authUser.email ?? "", name: data?.full_name ?? "", role: data?.role ?? "customer" };
  }
  const [categories, stores, products, addresses] = await Promise.all([
    sb.from("categories").select("*").order("sort"),
    sb.from("stores").select("*, store_hours(*)").order("name"),
    sb.from("products").select("*").order("name"),
    user ? sb.from("addresses").select("*").eq("user_id", user.id) : Promise.resolve({ data: [] as never[] }),
  ]);
  const saved = (addresses.data ?? []).map(toAddress);
  set((s) => ({
    ready: true,
    user,
    categories: (categories.data ?? []).map(toCategory),
    stores: (stores.data ?? []).map(toStore),
    products: (products.data ?? []).map(toProduct),
    addresses: saved,
    // Mantém o endereço escolhido se ele ainda existir na conta.
    address: saved.find((a) => a.id === s.address?.id) ?? saved[0] ?? null,
  }));
  await loadOrders();
}

async function loadOrders() {
  if (!state.user) return set({ orders: [] });
  const { data } = await supabase()
    .from("orders")
    .select("*, order_items(*), customer:profiles!orders_customer_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  set({ orders: (data ?? []).map(toOrder) });
}

async function reloadCatalog() {
  await loadAll(state.user ? { id: state.user.id, email: state.user.email } : null);
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw friendlyError(res.error);
  return res.data;
}

/** Busca as coordenadas de um endereço no OpenStreetMap. */
export async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const [hit] = (await res.json()) as { lat: string; lon: string }[];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
}

// Ações -------------------------------------------------------------------------

export interface NewStore {
  name: string;
  description: string;
  logoUrl: string;
  address: string;
  location: { lat: number; lng: number };
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  deliveryFeeCents: number;
  freeDeliveryFromCents: number | null;
  minOrderCents: number;
  opens: string;
  closes: string;
}

export type NewProduct = Omit<Product, "id">;

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const api = {
  addToCart(product: Product, quantity = 1, replaceStore = false) {
    set((s) => ({ cart: addToCart(s.cart, product, quantity, { replaceStore }) }));
  },
  setQuantity(productId: string, quantity: number) {
    set((s) => ({ cart: setQuantity(s.cart, productId, quantity) }));
  },
  clearCart() {
    set({ cart: emptyCart });
  },
  setAddress(address: Address) {
    set({ address });
  },

  async signUp(name: string, email: string, password: string): Promise<{ needsConfirmation: boolean }> {
    const { data, error } = await supabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin },
    });
    if (error) throw friendlyError(error);
    return { needsConfirmation: !data.session };
  },
  async signIn(email: string, password: string) {
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    if (error) throw friendlyError(error);
  },
  async signOut() {
    await supabase().auth.signOut();
  },

  async saveAddress(address: Address): Promise<Address> {
    if (state.mode === "demo") {
      set((s) => ({ addresses: [...s.addresses, address], address }));
      return address;
    }
    const user = state.user;
    if (!user) throw friendlyError({ message: "not_authenticated" });
    const row = check(await supabase().from("addresses").insert(fromAddress(address, user.id)).select().single());
    const saved = toAddress(row);
    set((s) => ({ addresses: [...s.addresses, saved], address: saved }));
    return saved;
  },

  /** No banco, `place_order` recalcula preços, frete e comissão e reserva o estoque. */
  async placeOrder(store: Store, fulfillment: Fulfillment, slot: TimeSlot): Promise<Order> {
    if (state.mode === "supabase") {
      const row = check(
        await supabase().rpc("place_order", {
          p_store_id: store.id,
          p_items: state.cart.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
          p_fulfillment: fulfillment,
          p_address_id: fulfillment === "delivery" ? state.address?.id ?? null : null,
          p_slot_start: slot.start,
        }),
      ) as { id: string };
      set({ cart: emptyCart });
      await Promise.all([loadOrders(), reloadCatalog()]);
      return state.orders.find((o) => o.id === row.id)!;
    }

    const products = state.products.filter((p) => p.storeId === store.id);
    const items = state.cart.items.map((i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p || !p.active) throw new Error(`${i.name} não está mais disponível.`);
      if (p.stock < i.quantity) throw new Error(`Estoque insuficiente de ${p.name}.`);
      return { productId: p.id, name: p.name, unitPriceCents: p.priceCents, quantity: i.quantity };
    });
    const order: Order = {
      id: crypto.randomUUID(),
      code: Math.random().toString(36).slice(2, 8).toUpperCase(),
      storeId: store.id,
      customerId: demoUser.id,
      customerName: demoUser.name,
      fulfillment,
      deliveryProvider: fulfillment === "delivery" ? "store" : null,
      address: fulfillment === "delivery" ? state.address : null,
      slot,
      items,
      totals: computeOrderTotals(store, items, fulfillment),
      status: "awaiting_payment",
      paymentStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    set((s) => ({
      cart: emptyCart,
      orders: [order, ...s.orders],
      products: s.products.map((p) => {
        const item = items.find((i) => i.productId === p.id);
        return item ? { ...p, stock: p.stock - item.quantity } : p;
      }),
    }));
    return order;
  },

  /**
   * Demonstração: simula a aprovação do pagamento. Supabase: a loja ou o admin
   * confirma manualmente até o webhook do Mercado Pago entrar.
   */
  async confirmPayment(orderId: string) {
    if (state.mode === "supabase") {
      check(await supabase().rpc("mark_order_paid", { p_order_id: orderId }));
      return loadOrders();
    }
    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId && o.status === "awaiting_payment" ? { ...o, paymentStatus: "approved", status: "received" } : o,
      ),
    }));
  },

  async cancelMyOrder(orderId: string) {
    if (state.mode === "supabase") {
      check(await supabase().rpc("cancel_my_order", { p_order_id: orderId }));
      return Promise.all([loadOrders(), reloadCatalog()]);
    }
    return api.advanceOrder(orderId, "cancelled");
  },

  async advanceOrder(orderId: string, to: OrderStatus) {
    if (state.mode === "supabase") {
      check(await supabase().rpc("advance_order", { p_order_id: orderId, p_status: to }));
      await loadOrders();
      if (to === "cancelled") await reloadCatalog();
      return;
    }
    set((s) => {
      const order = s.orders.find((o) => o.id === orderId);
      if (!order || !canTransition(order.fulfillment, order.status, to)) return {};
      return {
        products:
          to === "cancelled"
            ? s.products.map((p) => {
                const item = order.items.find((i) => i.productId === p.id);
                return item ? { ...p, stock: p.stock + item.quantity } : p;
              })
            : s.products,
        orders: s.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: to, paymentStatus: to === "cancelled" && o.paymentStatus === "approved" ? "refunded" : o.paymentStatus }
            : o,
        ),
      };
    });
  },

  async createStore(input: NewStore): Promise<Store> {
    const slug = slugify(input.name);
    const base = {
      slug,
      name: input.name,
      description: input.description,
      logo_url: input.logoUrl || null,
      address: input.address,
      lat: input.location.lat,
      lng: input.location.lng,
      offers_delivery: input.offersDelivery,
      offers_pickup: input.offersPickup,
      delivery_radius_km: input.deliveryRadiusKm,
      delivery_fee_cents: input.deliveryFeeCents,
      free_delivery_from_cents: input.freeDeliveryFromCents,
      min_order_cents: input.minOrderCents,
    };
    const hours = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: input.opens, closes: input.closes }));

    if (state.mode === "demo") {
      const store: Store = {
        ...seed.stores[0],
        id: crypto.randomUUID(),
        slug,
        name: input.name,
        description: input.description,
        logoUrl: input.logoUrl || "🏬",
        status: "pending",
        address: input.address,
        location: input.location,
        offersDelivery: input.offersDelivery,
        offersPickup: input.offersPickup,
        deliveryRadiusKm: input.deliveryRadiusKm,
        deliveryFeeCents: input.deliveryFeeCents,
        freeDeliveryFromCents: input.freeDeliveryFromCents,
        minOrderCents: input.minOrderCents,
        commissionBps: 1000,
        hours,
      };
      set((s) => ({ stores: [...s.stores, store] }));
      return store;
    }

    const user = state.user;
    if (!user) throw friendlyError({ message: "not_authenticated" });
    const sb = supabase();
    const row = check(await sb.from("stores").insert({ ...base, owner_id: user.id }).select().single()) as { id: string };
    check(await sb.from("store_hours").insert(hours.map((h) => ({ ...h, store_id: row.id }))));
    await reloadCatalog();
    return state.stores.find((s) => s.id === row.id)!;
  },

  async createProduct(input: NewProduct) {
    if (state.mode === "demo") {
      set((s) => ({ products: [...s.products, { ...input, id: crypto.randomUUID() }] }));
      return;
    }
    check(
      await supabase().from("products").insert({
        store_id: input.storeId,
        category_id: input.categoryId,
        name: input.name,
        description: input.description,
        price_cents: input.priceCents,
        unit: input.unit,
        image_url: input.imageUrl,
        stock: input.stock,
        active: input.active,
      }),
    );
    await reloadCatalog();
  },

  async patchProduct(productId: string, patch: Partial<Pick<Product, "priceCents" | "stock" | "active">>) {
    set((s) => ({ products: s.products.map((p) => (p.id === productId ? { ...p, ...patch } : p)) }));
    if (state.mode === "demo") return;
    const row: Record<string, unknown> = {};
    if (patch.priceCents !== undefined) row.price_cents = patch.priceCents;
    if (patch.stock !== undefined) row.stock = patch.stock;
    if (patch.active !== undefined) row.active = patch.active;
    const res = await supabase().from("products").update(row).eq("id", productId);
    if (res.error) {
      await reloadCatalog();
      throw friendlyError(res.error);
    }
  },

  async patchStore(storeId: string, patch: Partial<Pick<Store, "status" | "commissionBps">>) {
    set((s) => ({ stores: s.stores.map((st) => (st.id === storeId ? { ...st, ...patch } : st)) }));
    if (state.mode === "demo") return;
    const row: Record<string, unknown> = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.commissionBps !== undefined) row.commission_bps = patch.commissionBps;
    const res = await supabase().from("stores").update(row).eq("id", storeId);
    if (res.error) {
      await reloadCatalog();
      throw friendlyError(res.error);
    }
  },

  reset() {
    set({ ...initial, ready: state.ready, user: state.user });
  },
};
