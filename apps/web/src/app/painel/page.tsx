"use client";

import { useMemo, useState } from "react";
import { ORDER_STATUS_LABEL, formatBRL, nextStatus, type Order } from "@mercado/shared";
import { allStores, categories, demo, storeProducts, useDemo, useHydrated } from "@/lib/demo-store";
import { Empty, StatusBadge, Thumb, formatSlot } from "@/components/ui";

type Tab = "pedidos" | "produtos" | "resumo";

export default function StorePanel() {
  const s = useDemo();
  const hydrated = useHydrated();
  const stores = useMemo(() => allStores(s), [s]);
  const [storeId, setStoreId] = useState(stores[0].id);
  const [tab, setTab] = useState<Tab>("pedidos");
  const store = stores.find((st) => st.id === storeId)!;
  const orders = s.orders.filter((o) => o.storeId === storeId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted">Painel do lojista</p>
          <h1 className="text-2xl font-bold">{store.name}</h1>
        </div>
        <label className="text-sm">
          <span className="sr-only">Loja</span>
          <select className="input" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        </label>
      </div>
      {store.status !== "approved" && (
        <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
          {store.status === "pending"
            ? "Sua loja está aguardando aprovação da plataforma e ainda não aparece para os clientes."
            : "Sua loja está suspensa e não aparece para os clientes."}
        </p>
      )}

      <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm sm:w-fit">
        {(["pedidos", "produtos", "resumo"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-1.5 capitalize ${tab === t ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {hydrated && tab === "pedidos" && <OrdersBoard orders={orders} />}
      {hydrated && tab === "produtos" && <ProductsTable storeId={storeId} />}
      {hydrated && tab === "resumo" && <Summary orders={orders} />}
    </div>
  );
}

const COLUMNS: { title: string; statuses: Order["status"][] }[] = [
  { title: "Novos", statuses: ["received"] },
  { title: "Separando", statuses: ["picking"] },
  { title: "Prontos / a caminho", statuses: ["ready_for_pickup", "out_for_delivery"] },
  { title: "Finalizados", statuses: ["completed", "cancelled"] },
];

function OrdersBoard({ orders }: { orders: Order[] }) {
  const waiting = orders.filter((o) => o.status === "awaiting_payment").length;
  if (orders.length === 0) {
    return <Empty emoji="📭" title="Nenhum pedido ainda">
      <p className="text-sm text-muted">Faça um pedido nesta loja pela área do cliente para vê-lo aqui.</p>
    </Empty>;
  }
  return (
    <div className="space-y-3">
      {waiting > 0 && <p className="text-sm text-muted">{waiting} pedido(s) aguardando pagamento do cliente.</p>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = orders.filter((o) => col.statuses.includes(o.status));
          return (
            <section key={col.title} className="rounded-2xl bg-surface-2 p-3">
              <h2 className="mb-2 text-sm font-semibold">{col.title} <span className="text-muted">({list.length})</span></h2>
              <ul className="space-y-2">
                {list.map((o) => <OrderCard key={o.id} order={o} />)}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const next = nextStatus(order.fulfillment, order.status);
  const open = order.status !== "completed" && order.status !== "cancelled";
  return (
    <li className="card space-y-2 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-semibold">#{order.code}</span>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-muted">
        {order.fulfillment === "delivery" ? `🚚 ${order.address?.neighborhood}` : "🏬 Retirada"} · {formatSlot(order.slot)}
      </p>
      <ul className="text-xs text-muted">
        {order.items.map((i) => <li key={i.productId}>{i.quantity}× {i.name}</li>)}
      </ul>
      <p className="font-semibold">{formatBRL(order.totals.totalCents)}</p>
      {open && (
        <div className="flex gap-2">
          {next && (
            <button className="btn-primary flex-1 px-2 py-1.5 text-xs" onClick={() => demo.advanceOrder(order.id, next)}>
              {ORDER_STATUS_LABEL[next]}
            </button>
          )}
          <button
            className="btn-ghost px-2 py-1.5 text-xs text-danger"
            onClick={() => confirm("Cancelar este pedido e devolver os itens ao estoque?") && demo.advanceOrder(order.id, "cancelled")}
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}

function ProductsTable({ storeId }: { storeId: string }) {
  const s = useDemo();
  const products = useMemo(() => storeProducts(s, storeId), [s, storeId]);
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-muted">
          <tr className="border-b border-border">
            <th className="p-3 font-medium">Produto</th>
            <th className="p-3 font-medium">Categoria</th>
            <th className="p-3 font-medium">Preço (R$)</th>
            <th className="p-3 font-medium">Estoque</th>
            <th className="p-3 font-medium">À venda</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-0">
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <Thumb src={p.imageUrl} alt={p.name} size="sm" />
                  {p.name}
                </div>
              </td>
              <td className="p-3 text-muted">{categories.find((c) => c.id === p.categoryId)?.name}</td>
              <td className="p-3">
                <input
                  className="input w-24"
                  type="number"
                  min={0.01}
                  step={0.01}
                  defaultValue={(p.priceCents / 100).toFixed(2)}
                  onBlur={(e) => {
                    const cents = Math.round(Number(e.target.value) * 100);
                    if (cents > 0) demo.patchProduct(p.id, { priceCents: cents });
                  }}
                />
              </td>
              <td className="p-3">
                <input
                  className={`input w-20 ${p.stock === 0 ? "border-danger" : ""}`}
                  type="number"
                  min={0}
                  value={p.stock}
                  onChange={(e) => demo.patchProduct(p.id, { stock: Math.max(0, Math.floor(Number(e.target.value))) })}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--primary)]"
                  checked={p.active}
                  onChange={(e) => demo.patchProduct(p.id, { active: e.target.checked })}
                  aria-label={`${p.name} à venda`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Summary({ orders }: { orders: Order[] }) {
  const paid = orders.filter((o) => o.paymentStatus === "approved");
  const sum = (f: (o: Order) => number) => paid.reduce((t, o) => t + f(o), 0);
  const tiles = [
    { label: "Pedidos pagos", value: String(paid.length) },
    { label: "Vendido", value: formatBRL(sum((o) => o.totals.totalCents)) },
    { label: "Comissão da plataforma", value: formatBRL(sum((o) => o.totals.platformFeeCents)) },
    { label: "Você recebe", value: formatBRL(sum((o) => o.totals.storePayoutCents)) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="card p-4">
          <p className="text-sm text-muted">{t.label}</p>
          <p className="mt-1 text-2xl font-bold">{t.value}</p>
        </div>
      ))}
    </div>
  );
}
