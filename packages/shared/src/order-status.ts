import type { Fulfillment, OrderStatus } from "./types";

const FLOW: Record<Fulfillment, OrderStatus[]> = {
  delivery: ["awaiting_payment", "received", "picking", "out_for_delivery", "completed"],
  pickup: ["awaiting_payment", "received", "picking", "ready_for_pickup", "completed"],
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  received: "Pedido recebido",
  picking: "Separando produtos",
  ready_for_pickup: "Pronto para retirar",
  out_for_delivery: "Saiu para entrega",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function orderFlow(fulfillment: Fulfillment): OrderStatus[] {
  return FLOW[fulfillment];
}

/** Próximo status no fluxo normal, ou null se o pedido já terminou. */
export function nextStatus(fulfillment: Fulfillment, current: OrderStatus): OrderStatus | null {
  const flow = FLOW[fulfillment];
  const i = flow.indexOf(current);
  if (i === -1 || i === flow.length - 1) return null;
  return flow[i + 1];
}

export function canTransition(fulfillment: Fulfillment, from: OrderStatus, to: OrderStatus): boolean {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  return nextStatus(fulfillment, from) === to;
}
