"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ORDER_STATUS_LABEL, formatBRL, nextStatus, type Order, type Product } from "@mercado/shared";
import { api, useApp, useHydrated } from "@/lib/app-store";
import { Empty, StatusBadge, Thumb, formatSlot } from "@/components/ui";
import { Gate, run } from "@/components/gate";
import { sampleCatalog } from "@/lib/demo-data";
import { PHOTO_CREDIT, firstPhoto, searchPhotos, type PhotoResult } from "@/lib/product-photos";

type Tab = "pedidos" | "produtos" | "resumo";

export default function StorePanelPage() {
  return (
    <Gate back="/painel">
      <StorePanel />
    </Gate>
  );
}

function StorePanel() {
  const s = useApp();
  const hydrated = useHydrated();
  const stores = useMemo(
    () => (s.mode === "demo" || s.user?.role === "platform_admin" ? s.stores : s.stores.filter((st) => st.ownerId === s.user?.id)),
    [s.mode, s.stores, s.user],
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("pedidos");
  const store = stores.find((st) => st.id === chosen) ?? stores[0];

  if (!store) {
    return (
      <Empty emoji="🏬" title="Venda no FastMarket">
        <p className="max-w-sm text-sm text-muted">Cadastre seu supermercado para receber pedidos de clientes da sua região.</p>
        <Link href="/painel/nova-loja" className="btn-primary">Cadastrar minha loja</Link>
      </Empty>
    );
  }
  const orders = s.orders.filter((o) => o.storeId === store.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <p className="text-sm text-muted">Painel do lojista</p>
          <h1 className="text-2xl font-bold">{store.name}</h1>
        </div>
        {stores.length > 1 && (
          <label className="text-sm">
            <span className="sr-only">Loja</span>
            <select className="input" value={store.id} onChange={(e) => setChosen(e.target.value)}>
              {stores.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </label>
        )}
        <Link href={`/loja/${store.slug}`} className="btn-ghost text-sm">Ver loja</Link>
        <Link href={`/loja/${store.slug}/3d`} className="btn-ghost text-sm">🕶️ Ver em 3D</Link>
        <Link href="/painel/nova-loja" className="btn-ghost text-sm">+ Nova loja</Link>
      </div>
      {store.status !== "approved" && (
        <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
          {store.status === "pending"
            ? "Sua loja está aguardando aprovação da plataforma e ainda não aparece para os clientes. Já dá para cadastrar os produtos."
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
      {hydrated && tab === "produtos" && <ProductsTable storeId={store.id} />}
      {hydrated && tab === "resumo" && <Summary orders={orders} />}
    </div>
  );
}

const COLUMNS: { title: string; statuses: Order["status"][] }[] = [
  { title: "Aguardando pagamento", statuses: ["awaiting_payment"] },
  { title: "Novos", statuses: ["received"] },
  { title: "Separando", statuses: ["picking"] },
  { title: "Prontos / a caminho", statuses: ["ready_for_pickup", "out_for_delivery"] },
  { title: "Finalizados", statuses: ["completed", "cancelled"] },
];

function OrdersBoard({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <Empty emoji="📭" title="Nenhum pedido ainda">
      <p className="text-sm text-muted">Faça um pedido nesta loja pela área do cliente para vê-lo aqui.</p>
    </Empty>;
  }
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
  const next = order.status === "awaiting_payment" ? null : nextStatus(order.fulfillment, order.status);
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
      {order.customerName && <p className="text-xs">Cliente: {order.customerName}</p>}
      <p className="font-semibold">{formatBRL(order.totals.totalCents)}</p>
      {open && (
        <div className="flex gap-2">
          {order.status === "awaiting_payment" && (
            <button className="btn-primary flex-1 px-2 py-1.5 text-xs" onClick={() => run(() => api.confirmPayment(order.id))}>
              Confirmar pagamento
            </button>
          )}
          {next && (
            <button className="btn-primary flex-1 px-2 py-1.5 text-xs" onClick={() => run(() => api.advanceOrder(order.id, next))}>
              {ORDER_STATUS_LABEL[next]}
            </button>
          )}
          <button
            className="btn-ghost px-2 py-1.5 text-xs text-danger"
            onClick={() => confirm("Cancelar este pedido e devolver os itens ao estoque?") && run(() => api.advanceOrder(order.id, "cancelled"))}
          >
            Cancelar
          </button>
        </div>
      )}
    </li>
  );
}

function ProductsTable({ storeId }: { storeId: string }) {
  const s = useApp();
  const products = useMemo(() => s.products.filter((p) => p.storeId === storeId), [s, storeId]);
  return (
    <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      <NewProductForm storeId={storeId} />
      {products.length < 10 && <SampleCatalogButton storeId={storeId} existing={products} />}
    </div>
    {products.length === 0 && <p className="text-sm text-muted">Nenhum produto cadastrado ainda.</p>}
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
              <td className="p-3 text-muted">{s.categories.find((c) => c.id === p.categoryId)?.name}</td>
              <td className="p-3">
                <input
                  className="input w-24"
                  type="number"
                  min={0.01}
                  step={0.01}
                  defaultValue={(p.priceCents / 100).toFixed(2)}
                  onBlur={(e) => {
                    const cents = Math.round(Number(e.target.value) * 100);
                    if (cents > 0 && cents !== p.priceCents) run(() => api.patchProduct(p.id, { priceCents: cents }));
                  }}
                />
              </td>
              <td className="p-3">
                <input
                  className={`input w-20 ${p.stock === 0 ? "border-danger" : ""}`}
                  type="number"
                  min={0}
                  value={p.stock}
                  onChange={(e) => run(() => api.patchProduct(p.id, { stock: Math.max(0, Math.floor(Number(e.target.value))) }))}
                />
              </td>
              <td className="p-3">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[var(--primary)]"
                  checked={p.active}
                  onChange={(e) => run(() => api.patchProduct(p.id, { active: e.target.checked }))}
                  aria-label={`${p.name} à venda`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </div>
  );
}

const UNITS: Product["unit"][] = ["un", "kg", "g", "l", "ml", "pct"];

function NewProductForm({ storeId }: { storeId: string }) {
  const s = useApp();
  const [open, setOpen] = useState(false);
  const blank = { name: "", description: "", emoji: "", price: "", unit: "un" as Product["unit"], stock: "10", categoryId: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn-primary" onClick={() => setOpen(true)}>+ Novo produto</button>;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.createProduct({
        storeId,
        categoryId: f.categoryId || s.categories[0].id,
        name: f.name.trim(),
        description: f.description.trim(),
        priceCents: Math.round(Number(f.price.replace(",", ".")) * 100),
        unit: f.unit,
        imageUrl: f.emoji.trim() || null,
        stock: Math.max(0, Math.floor(Number(f.stock))),
        active: true,
      });
      setF(blank);
      setOpen(false);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card grid basis-full gap-3 p-4 sm:grid-cols-6">
      <label className="space-y-1 text-sm sm:col-span-3">
        <span>Nome</span>
        <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label className="space-y-1 text-sm sm:col-span-2">
        <span>Detalhe (ex.: 500 g)</span>
        <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <label className="space-y-1 text-sm">
        <span>Ícone ou URL da foto</span>
        <input className="input" placeholder="🍎" value={f.emoji} onChange={(e) => setF({ ...f, emoji: e.target.value })} />
      </label>
      <PhotoSearch initial={f.name} onPick={(url) => setF({ ...f, emoji: url })} />
      <label className="space-y-1 text-sm sm:col-span-2">
        <span>Categoria</span>
        <select className="input" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
          {s.categories.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Preço (R$)</span>
        <input className="input" required inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      </label>
      <label className="space-y-1 text-sm">
        <span>Unidade</span>
        <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Product["unit"] })}>
          {UNITS.map((u) => <option key={u}>{u}</option>)}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <span>Estoque</span>
        <input className="input" type="number" min={0} value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
      </label>
      <div className="flex items-end gap-2">
        <button className="btn-primary flex-1" disabled={busy}>Salvar</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>✕</button>
      </div>
    </form>
  );
}

/** Procura a foto da embalagem original pelo nome ou pelo código de barras. */
function PhotoSearch({ initial, onPick }: { initial: string; onPick: (url: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PhotoResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    const term = (q || initial).trim();
    if (!term) return;
    setBusy(true);
    setError("");
    try {
      setResults(await searchPhotos(term));
    } catch {
      setError("Não foi possível buscar agora. Tente de novo ou cole o endereço da foto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-primary-soft/50 p-3 text-sm sm:col-span-6">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-48 flex-1 space-y-1">
          <span>Foto da embalagem: nome ou código de barras</span>
          <input
            className="input"
            placeholder={initial || "ex.: café pilão 500g ou 7896089012453"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
          />
        </label>
        <button type="button" className="btn-ghost" onClick={() => void search()} disabled={busy}>
          {busy ? "Buscando…" : "📷 Buscar foto"}
        </button>
      </div>
      {error && <p className="text-danger">{error}</p>}
      {results && results.length === 0 && <p className="text-muted">Nenhuma foto encontrada. Tente outro nome ou o código de barras.</p>}
      {results && results.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {results.map((r) => (
              <button
                type="button"
                key={r.imageUrl}
                onClick={() => { onPick(r.imageUrl); setResults(null); }}
                className="w-24 shrink-0 rounded-lg border border-border bg-white p-1 text-left text-xs hover:border-primary"
                title={`${r.name} ${r.brand}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.imageUrl} alt={r.name} className="h-20 w-full object-contain" loading="lazy" />
                <span className="line-clamp-2">{r.name || "Sem nome"}{r.brand && ` · ${r.brand}`}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{PHOTO_CREDIT}. Toque na foto certa para usar.</p>
        </>
      )}
    </div>
  );
}

/**
 * Copia o catálogo de exemplo para a loja, buscando a foto da embalagem de cada
 * produto, para o lojista ver a loja 3D completa sem cadastrar tudo à mão.
 */
function SampleCatalogButton({ storeId, existing }: { storeId: string; existing: Product[] }) {
  const s = useApp();
  const [progress, setProgress] = useState<string | null>(null);

  async function fill() {
    if (!confirm("Adicionar uns 25 produtos de exemplo (com fotos das embalagens) a esta loja? Você pode editar ou desativar depois.")) return;
    const bySlug = new Map(s.categories.map((c) => [c.slug, c.id]));
    const have = new Set(existing.map((p) => p.name.toLowerCase()));
    const todo = sampleCatalog.filter((p) => !have.has(p.name.toLowerCase()) && bySlug.has(p.categorySlug));
    let done = 0;
    let photos = 0;
    setProgress(`0 de ${todo.length}`);
    try {
      // Em pequenos lotes, para não sobrecarregar a busca de fotos.
      for (let i = 0; i < todo.length; i += 4) {
        await Promise.all(
          todo.slice(i, i + 4).map(async (p) => {
            const photo = p.search ? await firstPhoto(p.search) : null;
            if (photo) photos++;
            await api.createProduct({
              storeId,
              categoryId: bySlug.get(p.categorySlug)!,
              name: p.name,
              description: p.description,
              priceCents: p.priceCents,
              unit: p.unit,
              imageUrl: photo ?? p.emoji,
              stock: 30,
              active: true,
            });
            done++;
            setProgress(`${done} de ${todo.length}`);
          }),
        );
      }
      alert(`Pronto: ${done} produtos adicionados, ${photos} com foto da embalagem. ${PHOTO_CREDIT}.`);
    } catch (err) {
      alert(`Parou em ${done} de ${todo.length}: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <button className="btn-ghost" onClick={() => void fill()} disabled={progress !== null}>
      {progress ? `Adicionando… ${progress}` : "✨ Preencher com catálogo de exemplo"}
    </button>
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
