"use client";

import { useMemo } from "react";
import { formatBRL, type StoreStatus } from "@mercado/shared";
import { api, useApp, useHydrated } from "@/lib/app-store";
import { Thumb } from "@/components/ui";
import { Gate, run } from "@/components/gate";

const STATUS_LABEL: Record<StoreStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  suspended: "Suspensa",
};

export default function AdminPage() {
  return (
    <Gate back="/admin" role="platform_admin">
      <Admin />
    </Gate>
  );
}

function Admin() {
  const s = useApp();
  const hydrated = useHydrated();
  const stores = useMemo(() => s.stores, [s]);
  const paid = hydrated ? s.orders.filter((o) => o.paymentStatus === "approved") : [];

  const tiles = [
    { label: "Lojas ativas", value: String(stores.filter((st) => st.status === "approved").length) },
    { label: "Pedidos pagos", value: String(paid.length) },
    { label: "Volume vendido", value: formatBRL(paid.reduce((t, o) => t + o.totals.totalCents, 0)) },
    { label: "Receita da plataforma", value: formatBRL(paid.reduce((t, o) => t + o.totals.platformFeeCents, 0)) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted">Administração da plataforma</p>
          <h1 className="text-2xl font-bold">Visão geral</h1>
        </div>
        {s.mode === "demo" && <button
          className="btn-ghost text-sm"
          onClick={() => confirm("Apagar pedidos, carrinho e alterações da demonstração?") && api.reset()}
        >
          Reiniciar demonstração
        </button>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="card p-4">
            <p className="text-sm text-muted">{t.label}</p>
            <p className="mt-1 text-2xl font-bold">{t.value}</p>
          </div>
        ))}
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-border">
              <th className="p-3 font-medium">Loja</th>
              <th className="p-3 font-medium">Situação</th>
              <th className="p-3 font-medium">Comissão (%)</th>
              <th className="p-3 font-medium">Vendas pagas</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((st) => {
              const sales = paid.filter((o) => o.storeId === st.id).reduce((t, o) => t + o.totals.totalCents, 0);
              return (
                <tr key={st.id} className="border-b border-border last:border-0">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Thumb src={st.logoUrl} alt={st.name} size="sm" />
                      <div>
                        <p className="font-medium">{st.name}</p>
                        <p className="text-xs text-muted">{st.address}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      className="input w-auto"
                      value={st.status}
                      onChange={(e) => run(() => api.patchStore(st.id, { status: e.target.value as StoreStatus }))}
                    >
                      {(Object.keys(STATUS_LABEL) as StoreStatus[]).map((k) => (
                        <option key={k} value={k}>{STATUS_LABEL[k]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input
                      className="input w-20"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={st.commissionBps / 100}
                      onChange={(e) =>
                        run(() => api.patchStore(st.id, { commissionBps: Math.min(10000, Math.max(0, Math.round(Number(e.target.value) * 100))) }))
                      }
                    />
                  </td>
                  <td className="p-3">{formatBRL(sales)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">
        A comissão incide sobre o valor dos produtos. O frete fica com a loja, que faz a entrega nesta fase.
      </p>
    </div>
  );
}
