import type { Address, Category, Order, Product, Store } from "@mercado/shared";

// Conversão entre as linhas do banco (snake_case) e os tipos do app.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const hhmm = (t: string) => t.slice(0, 5);

export function toCategory(r: Row): Category {
  return { id: r.id, slug: r.slug, name: r.name, emoji: r.emoji };
}

export function toStore(r: Row): Store {
  return {
    id: r.id,
    ownerId: r.owner_id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    logoUrl: r.logo_url,
    status: r.status,
    address: r.address,
    location: { lat: r.lat, lng: r.lng },
    offersDelivery: r.offers_delivery,
    offersPickup: r.offers_pickup,
    deliveryRadiusKm: Number(r.delivery_radius_km),
    deliveryFeeCents: r.delivery_fee_cents,
    freeDeliveryFromCents: r.free_delivery_from_cents,
    minOrderCents: r.min_order_cents,
    commissionBps: r.commission_bps,
    slotMinutes: r.slot_minutes,
    prepMinutes: r.prep_minutes,
    hours: (r.store_hours ?? []).map((h: Row) => ({ weekday: h.weekday, opens: hhmm(h.opens), closes: hhmm(h.closes) })),
  };
}

export function toProduct(r: Row): Product {
  return {
    id: r.id,
    storeId: r.store_id,
    categoryId: r.category_id,
    name: r.name,
    description: r.description,
    priceCents: r.price_cents,
    unit: r.unit,
    imageUrl: r.image_url,
    stock: r.stock,
    active: r.active,
  };
}

export function toAddress(r: Row): Address {
  return {
    id: r.id,
    label: r.label,
    street: r.street,
    number: r.number,
    complement: r.complement ?? undefined,
    neighborhood: r.neighborhood,
    city: r.city,
    state: r.state,
    zip: r.zip,
    location: { lat: r.lat, lng: r.lng },
  };
}

export function fromAddress(a: Address, userId: string): Row {
  return {
    user_id: userId,
    label: a.label,
    street: a.street,
    number: a.number,
    complement: a.complement || null,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    zip: a.zip,
    lat: a.location.lat,
    lng: a.location.lng,
  };
}

export function toOrder(r: Row): Order {
  return {
    id: r.id,
    code: r.code,
    storeId: r.store_id,
    customerId: r.customer_id,
    customerName: r.customer?.full_name ?? "",
    fulfillment: r.fulfillment,
    deliveryProvider: r.delivery_provider,
    address: r.address ? toAddress(r.address) : null,
    slot: { start: r.slot_start, end: r.slot_end },
    items: (r.order_items ?? []).map((i: Row) => ({
      productId: i.product_id,
      name: i.name,
      unitPriceCents: i.unit_price_cents,
      quantity: i.quantity,
    })),
    totals: {
      subtotalCents: r.subtotal_cents,
      deliveryFeeCents: r.delivery_fee_cents,
      totalCents: r.total_cents,
      platformFeeCents: r.platform_fee_cents,
      storePayoutCents: r.store_payout_cents,
    },
    status: r.status,
    paymentStatus: r.payment_status,
    createdAt: r.created_at,
  };
}
