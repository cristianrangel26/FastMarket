"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ORDER_STATUS_LABEL, formatBRL, orderFlow, type OrderStatus } from "@mercado/shared";
import { api, useApp, useHydrated } from "@/lib/app-store";
import { Empty, StatusBadge, formatSlot } from "@/components/ui";
import { run } from "@/components/gate";

export default function OrderPage() {
  return (
    <Suspense>
      <OrderDetail />
    </Suspense>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const method = useSearchParams().get("pagar") === "card" ? "card" : "pix";
  const s = useApp();
  const hydrated = useHydrated();
  if (!hydrated || !s.ready) return <p className="text-muted">Carregando…</p>;

  const order = s.orders.find((o) => o.id === id);
  if (!order) {
    return (
      <Empty emoji="🔎" title="Pedido não encontrado">
        <Link href="/pedidos" className="btn-ghost">Meus pedidos</Link>
      </Empty>
    );
  }
  const store = s.stores.find((st) => st.id === order.storeId)!;
  const flow: OrderStatus[] = orderFlow(order.fulfillment).filter((x) => x !== "awaiting_payment");
  const current = flow.indexOf(order.status);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Pedido #{order.code}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-muted">
        {store.name} · {order.fulfillment === "delivery" ? "Entrega" : "Retirada"} {formatSlot(order.slot)}
      </p>

      {order.status === "awaiting_payment" && (
        <section className="card space-y-3 p-5 text-center">
          {method === "pix" ? (
            <>
              <h2 className="font-semibold">Pague com Pix para confirmar</h2>
              <div aria-hidden className="mx-auto grid h-40 w-40 grid-cols-8 gap-0.5 rounded-xl bg-surface-2 p-3">
                {Array.from({ length: 64 }, (_, i) => (
                  <span key={i} className={(i * 37 + order.code.charCodeAt(i % 6)) % 3 === 0 ? "bg-foreground" : ""} />
                ))}
              </div>
              <p className="text-sm text-muted">Escaneie o QR Code no app do seu banco. Total {formatBRL(order.totals.totalCents)}.</p>
            </>
          ) : (
            <h2 className="font-semibold">Aguardando aprovação do cartão</h2>
          )}
          {s.mode === "demo" ? (
            <button className="btn-primary" onClick={() => run(() => api.confirmPayment(order.id))}>
              Simular pagamento aprovado
            </button>
          ) : (
            <p className="text-sm text-muted">Fase de testes: a loja confirma o pagamento pelo painel e esta página atualiza sozinha.</p>
          )}
          <button
            className="block w-full text-sm text-danger"
            onClick={() => confirm("Cancelar este pedido?") && run(() => api.cancelMyOrder(order.id))}
          >
            Cancelar pedido
          </button>
        </section>
      )}

      {order.status === "cancelled" ? (
        <p className="card bg-danger-soft p-4 text-danger">
          Este pedido foi cancelado.{order.paymentStatus === "refunded" && " O valor será estornado."}
        </p>
      ) : (
        <ol className="card space-y-4 p-5">
          {flow.map((step, i) => {
            const done = current >= i;
            return (
              <li key={step} className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"}`}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span className={done ? "font-medium" : "text-muted"}>{ORDER_STATUS_LABEL[step]}</span>
              </li>
            );
          })}
        </ol>
      )}

      <section className="card space-y-2 p-4 text-sm">
        {order.address ? (
          <p><span className="text-muted">Entregar em:</span> {order.address.street}, {order.address.number} · {order.address.neighborhood}</p>
        ) : (
          <p><span className="text-muted">Retirar em:</span> {store.address}</p>
        )}
        <ul className="space-y-1 border-t border-border pt-2">
          {order.items.map((i) => (
            <li key={i.productId} className="flex justify-between">
              <span className="text-muted">{i.quantity}× {i.name}</span>
              <span>{formatBRL(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-border pt-2">
          <span className="text-muted">Entrega</span>
          <span>{order.totals.deliveryFeeCents === 0 ? "Grátis" : formatBRL(order.totals.deliveryFeeCents)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span>{formatBRL(order.totals.totalCents)}</span>
        </div>
      </section>
      {s.mode === "demo" && <p className="text-center text-xs text-muted">
        Dica da demonstração: abra <Link href="/painel" className="underline">Sou lojista</Link> para avançar o status deste pedido.
      </p>}
    </div>
  );
}
