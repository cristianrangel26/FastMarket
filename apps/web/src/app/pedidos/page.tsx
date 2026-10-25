"use client";

import Link from "next/link";
import { formatBRL } from "@mercado/shared";
import { allStores, useDemo, useHydrated } from "@/lib/demo-store";
import { Empty, StatusBadge, formatSlot } from "@/components/ui";

export default function OrdersPage() {
  const s = useDemo();
  const hydrated = useHydrated();
  if (!hydrated) return null;

  const stores = allStores(s);
  if (s.orders.length === 0) {
    return (
      <Empty emoji="🧾" title="Você ainda não fez pedidos">
        <Link href="/" className="btn-primary">Começar a comprar</Link>
      </Empty>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Meus pedidos</h1>
      <ul className="space-y-3">
        {s.orders.map((o) => (
          <li key={o.id}>
            <Link href={`/pedidos/${o.id}`} className="card flex items-center gap-3 p-4 hover:border-primary">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{stores.find((st) => st.id === o.storeId)?.name}</p>
                <p className="text-sm text-muted">
                  #{o.code} · {o.fulfillment === "delivery" ? "Entrega" : "Retirada"} · {formatSlot(o.slot)}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge status={o.status} />
                <p className="mt-1 text-sm font-semibold">{formatBRL(o.totals.totalCents)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
