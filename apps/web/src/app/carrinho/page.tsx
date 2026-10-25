"use client";

import Link from "next/link";
import { cartSubtotalCents, formatBRL } from "@mercado/shared";
import { allStores, demo, useDemo, useHydrated } from "@/lib/demo-store";
import { Empty, Thumb } from "@/components/ui";
import { products as seedProducts } from "@/lib/demo-data";

export default function CartPage() {
  const s = useDemo();
  const hydrated = useHydrated();
  const store = allStores(s).find((st) => st.id === s.cart.storeId);

  if (!hydrated) return null;
  if (!store || s.cart.items.length === 0) {
    return (
      <Empty emoji="🛒" title="Seu carrinho está vazio">
        <Link href="/" className="btn-primary">Escolher uma loja</Link>
      </Empty>
    );
  }

  const subtotal = cartSubtotalCents(s.cart);
  const missing = Math.max(0, store.minOrderCents - subtotal);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Carrinho</h1>
        <button className="text-sm text-danger" onClick={() => demo.clearCart()}>Esvaziar</button>
      </div>
      <Link href={`/loja/${store.slug}`} className="text-sm text-primary-strong">← Continuar comprando em {store.name}</Link>

      <ul className="card divide-y divide-border">
        {s.cart.items.map((i) => (
          <li key={i.productId} className="flex items-center gap-3 p-3">
            <Thumb src={seedProducts.find((p) => p.id === i.productId)?.imageUrl ?? null} alt={i.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted">{formatBRL(i.unitPriceCents)} cada</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn-ghost h-8 w-8 p-0" aria-label="Diminuir" onClick={() => demo.setQuantity(i.productId, i.quantity - 1)}>−</button>
              <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
              <button className="btn-ghost h-8 w-8 p-0" aria-label="Aumentar" onClick={() => demo.setQuantity(i.productId, i.quantity + 1)}>+</button>
            </div>
            <p className="w-20 text-right text-sm font-semibold">{formatBRL(i.unitPriceCents * i.quantity)}</p>
          </li>
        ))}
      </ul>

      <div className="card space-y-3 p-4">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>{formatBRL(subtotal)}</span>
        </div>
        {missing > 0 && (
          <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
            Faltam {formatBRL(missing)} para o pedido mínimo desta loja ({formatBRL(store.minOrderCents)}).
          </p>
        )}
        {missing > 0 ? (
          <button className="btn-primary w-full py-3" disabled>Ir para o pagamento</button>
        ) : (
          <Link href="/checkout" className="btn-primary w-full py-3">Ir para o pagamento</Link>
        )}
      </div>
    </div>
  );
}
