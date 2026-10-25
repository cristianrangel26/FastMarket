"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CartStoreConflictError, deliversTo, formatBRL, type Product } from "@mercado/shared";
import { api, useApp } from "@/lib/app-store";
import { Empty, Thumb } from "@/components/ui";

const UNIT_LABEL: Record<Product["unit"], string> = { un: "un", kg: "kg", g: "g", l: "L", ml: "ml", pct: "pct" };

export default function StorePage() {
  return (
    <Suspense>
      <StoreDetail />
    </Suspense>
  );
}

function StoreDetail() {
  const { slug } = useParams<{ slug: string }>();
  const s = useApp();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const store = useMemo(() => s.stores.find((st) => st.slug === slug), [s, slug]);
  const products = useMemo(() => (store ? s.products.filter((p) => p.storeId === store.id).filter((p) => p.active) : []), [s, store]);

  if (!s.ready) return <p className="text-muted">Carregando…</p>;
  if (!store || (store.status !== "approved" && store.ownerId !== s.user?.id)) {
    return (
      <Empty emoji="🔎" title="Loja não encontrada">
        <Link href="/" className="btn-ghost">Ver lojas</Link>
      </Empty>
    );
  }

  const storeCategories = s.categories.filter((c) => products.some((p) => p.categoryId === c.id));
  const q = query.trim().toLowerCase();
  const visible = products.filter(
    (p) => (!category || p.categoryId === category) && (!q || p.name.toLowerCase().includes(q)),
  );
  const qty = (id: string) => (s.cart.storeId === store.id ? s.cart.items.find((i) => i.productId === id)?.quantity ?? 0 : 0);
  const delivers = s.address ? deliversTo(store, s.address.location) : false;

  function add(p: Product) {
    try {
      api.addToCart(p);
    } catch (e) {
      if (!(e instanceof CartStoreConflictError)) throw e;
      if (confirm("Seu carrinho tem produtos de outra loja. Quer esvaziar e começar nesta?")) {
        api.addToCart(p, 1, true);
      }
    }
  }

  return (
    <div className="space-y-6 pb-16">
      <section className="card flex flex-wrap items-center gap-4 p-5">
        <Thumb src={store.logoUrl} alt={store.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-muted">{store.description}</p>
          <p className="mt-1 text-sm text-muted">{store.address}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`badge ${delivers ? "bg-primary-soft text-primary-strong" : ""}`}>
            🚚 {delivers || (!s.address && store.offersDelivery)
              ? `Entrega ${formatBRL(store.deliveryFeeCents)}`
              : store.offersDelivery ? "Não entrega no seu endereço" : "Sem entrega"}
          </span>
          {store.freeDeliveryFromCents !== null && delivers && (
            <span className="badge">Grátis acima de {formatBRL(store.freeDeliveryFromCents)}</span>
          )}
          {store.offersPickup && <span className="badge">🏬 Retirada grátis</span>}
          <span className="badge">Mínimo {formatBRL(store.minOrderCents)}</span>
        </div>
      </section>

      <Link
        href={`/loja/${store.slug}/3d`}
        className="card flex items-center gap-4 bg-gradient-to-r from-accent/15 to-primary-soft p-4 transition hover:border-accent"
      >
        <span className="text-4xl" aria-hidden>🕶️</span>
        <span className="flex-1">
          <span className="block font-semibold">Entrar na loja em 3D</span>
          <span className="block text-sm text-muted">Ande pelos corredores e pegue os produtos nas prateleiras, como no mercado de verdade.</span>
        </span>
        <span className="btn-primary hidden sm:inline-flex">Entrar</span>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <input className="input sm:w-72" placeholder="Buscar nesta loja" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto">
          <button onClick={() => setCategory(null)} className={`badge cursor-pointer ${!category ? "bg-primary text-on-primary" : ""}`}>
            Tudo
          </button>
          {storeCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`badge cursor-pointer whitespace-nowrap ${category === c.id ? "bg-primary text-on-primary" : ""}`}
            >
              {c.emoji} {c.name}
            </button>
          ))}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((p) => {
          const n = qty(p.id);
          return (
            <li key={p.id} className="card flex flex-col gap-2 p-3">
              <Thumb src={p.imageUrl} alt={p.name} size="lg" />
              <div className="flex-1">
                <h3 className="text-sm font-medium leading-snug">{p.name}</h3>
                {p.description && <p className="text-xs text-muted">{p.description}</p>}
              </div>
              <p className="font-bold">
                {formatBRL(p.priceCents)} <span className="text-xs font-normal text-muted">/ {UNIT_LABEL[p.unit]}</span>
              </p>
              {p.stock === 0 ? (
                <span className="badge justify-center">Esgotado</span>
              ) : n === 0 ? (
                <button className="btn-primary w-full" onClick={() => add(p)}>Adicionar</button>
              ) : (
                <div className="flex items-center justify-between rounded-full bg-primary-soft p-1">
                  <button className="btn h-8 w-8 p-0" aria-label="Diminuir" onClick={() => api.setQuantity(p.id, n - 1)}>−</button>
                  <span className="font-semibold">{n}</span>
                  <button
                    className="btn h-8 w-8 p-0"
                    aria-label="Aumentar"
                    disabled={n >= p.stock}
                    onClick={() => api.setQuantity(p.id, n + 1)}
                  >
                    +
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="text-muted">Nenhum produto encontrado.</p>}

      {s.cart.storeId === store.id && s.cart.items.length > 0 && (
        <Link href="/carrinho" className="btn-primary fixed inset-x-4 bottom-4 z-10 mx-auto max-w-md py-3 shadow-lg">
          Ver carrinho · {formatBRL(s.cart.items.reduce((t, i) => t + i.unitPriceCents * i.quantity, 0))}
        </Link>
      )}
    </div>
  );
}
