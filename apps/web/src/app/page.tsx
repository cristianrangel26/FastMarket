"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deliversTo, distanceKm, formatBRL } from "@mercado/shared";
import { useApp } from "@/lib/app-store";
import { Thumb } from "@/components/ui";

type Filter = "todas" | "entrega" | "retirada";

export default function Home() {
  const s = useApp();
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");

  const stores = useMemo(() => {
    const q = query.trim().toLowerCase();
    return s.stores
      .filter((st) => st.status === "approved")
      .map((st) => ({
        store: st,
        km: s.address ? distanceKm(st.location, s.address.location) : null,
        delivers: s.address ? deliversTo(st, s.address.location) : false,
      }))
      .filter(({ store, delivers }) =>
        filter === "entrega" ? delivers : filter === "retirada" ? store.offersPickup : true,
      )
      .filter(({ store }) => !q || store.name.toLowerCase().includes(q) || store.description.toLowerCase().includes(q))
      .sort((a, b) => (a.km ?? 0) - (b.km ?? 0) || a.store.name.localeCompare(b.store.name));
  }, [s, filter, query]);

  return (
    <div className="space-y-8">
      <section className="card overflow-hidden bg-gradient-to-br from-primary-soft to-surface p-6 sm:p-10">
        <p className="text-sm font-semibold text-primary-strong">Supermercados da sua região</p>
        <h1 className="mt-2 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Faça as compras do mês sem sair de casa.
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Escolha a loja, monte o carrinho e decida: receber em casa no horário que quiser ou retirar pronto na loja.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {s.categories.map((c) => (
            <span key={c.id} className="badge bg-surface text-foreground">
              {c.emoji} {c.name}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto text-xl font-bold">
            {s.address ? `Lojas perto de ${s.address.neighborhood}` : "Lojas"}
          </h2>
          <input
            className="input sm:w-64"
            placeholder="Buscar loja"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
            {(["todas", "entrega", "retirada"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 capitalize ${filter === f ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {!s.ready && <p className="text-muted">Carregando lojas…</p>}
        {s.ready && stores.length === 0 && <p className="text-muted">Nenhuma loja encontrada com esses filtros.</p>}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map(({ store, km, delivers }) => (
            <li key={store.id}>
              <Link href={`/loja/${store.slug}`} className="card flex h-full gap-4 p-4 transition hover:border-primary">
                <Thumb src={store.logoUrl} alt={store.name} />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate font-semibold">{store.name}</h3>
                  <p className="line-clamp-2 text-sm text-muted">{store.description}</p>
                  <p className="text-xs text-muted">
                    {km !== null && `${km.toFixed(1).replace(".", ",")} km · `}mínimo {formatBRL(store.minOrderCents)}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {delivers ? (
                      <span className="badge bg-primary-soft text-primary-strong">
                        🚚 {store.deliveryFeeCents === 0 ? "Entrega grátis" : `Entrega ${formatBRL(store.deliveryFeeCents)}`}
                      </span>
                    ) : (
                      <span className="badge">
                        {!store.offersDelivery ? "Sem entrega" : s.address ? "Fora da área de entrega" : "🚚 Entrega"}
                      </span>
                    )}
                    {store.offersPickup && <span className="badge">🏬 Retirada</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
