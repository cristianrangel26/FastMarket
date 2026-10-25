export type StoreStatus = "pending" | "approved" | "suspended";

export type Fulfillment = "delivery" | "pickup";

/** Quem leva o pedido até o cliente. No MVP só "store"; "platform" é a fase 2. */
export type DeliveryProvider = "store" | "platform";

export type OrderStatus =
  | "awaiting_payment"
  | "received"
  | "picking"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "completed"
  | "cancelled";

export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded";

export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Horário de funcionamento de um dia da semana (0 = domingo). Horas no formato "HH:MM". */
export interface OpeningHours {
  weekday: number;
  opens: string;
  closes: string;
}

export interface Store {
  id: string;
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  status: StoreStatus;
  address: string;
  location: GeoPoint;
  offersDelivery: boolean;
  offersPickup: boolean;
  deliveryRadiusKm: number;
  deliveryFeeCents: number;
  /** Subtotal a partir do qual a entrega é grátis. null = nunca grátis. */
  freeDeliveryFromCents: number | null;
  minOrderCents: number;
  /** Comissão da plataforma em basis points (1000 = 10%). */
  commissionBps: number;
  /** Duração de cada janela de entrega/retirada, em minutos. */
  slotMinutes: number;
  /** Tempo mínimo de preparo antes da primeira janela, em minutos. */
  prepMinutes: number;
  hours: OpeningHours[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  emoji: string;
}

export type Unit = "un" | "kg" | "g" | "l" | "ml" | "pct";

export interface Product {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  priceCents: number;
  unit: Unit;
  imageUrl: string | null;
  stock: number;
  active: boolean;
}

export interface CartItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Cart {
  storeId: string | null;
  items: CartItem[];
}

export interface TimeSlot {
  /** ISO 8601 */
  start: string;
  end: string;
}

export interface Address {
  label: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
  location: GeoPoint;
}

export interface OrderTotals {
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  /** Parte da plataforma (comissão sobre o subtotal). */
  platformFeeCents: number;
  /** O que a loja recebe: total menos a comissão. */
  storePayoutCents: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
}

export interface Order {
  id: string;
  code: string;
  storeId: string;
  customerId: string;
  customerName: string;
  fulfillment: Fulfillment;
  deliveryProvider: DeliveryProvider | null;
  address: Address | null;
  slot: TimeSlot;
  items: OrderItem[];
  totals: OrderTotals;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
}
