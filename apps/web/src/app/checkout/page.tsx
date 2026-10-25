"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  availableSlots,
  checkoutProblems,
  computeOrderTotals,
  deliversTo,
  formatBRL,
  type Fulfillment,
} from "@mercado/shared";
import { api, useApp, useHydrated } from "@/lib/app-store";
import { Empty, formatSlot } from "@/components/ui";

type PaymentMethod = "pix" | "card";

export default function CheckoutPage() {
  const s = useApp();
  const hydrated = useHydrated();
  const router = useRouter();
  const store = s.stores.find((st) => st.id === s.cart.storeId);
  const delivers = store && s.address ? deliversTo(store, s.address.location) : false;

  const [choice, setChoice] = useState<Fulfillment | null>(null);
  const fulfillment: Fulfillment = choice ?? (delivers ? "delivery" : "pickup");
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("pix");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula só quando a loja muda
  const slots = useMemo(() => (store && hydrated ? availableSlots(store, new Date(), 2) : []), [store?.id, hydrated]);

  if (!hydrated || !s.ready) return null;
  if (!s.user) {
    return (
      <Empty emoji="🔐" title="Entre na sua conta para finalizar o pedido">
        <Link href="/entrar?voltar=/checkout" className="btn-primary">Entrar ou criar conta</Link>
      </Empty>
    );
  }
  if (!store || s.cart.items.length === 0) {
    return (
      <Empty emoji="🛒" title="Nada para pagar ainda">
        <Link href="/" className="btn-primary">Escolher uma loja</Link>
      </Empty>
    );
  }

  const totals = computeOrderTotals(store, s.cart.items, fulfillment);
  const problems = checkoutProblems({
    cart: s.cart,
    store,
    fulfillment,
    address: fulfillment === "delivery" ? s.address : null,
    slotStart,
  });

  async function submit() {
    const slot = slots.find((x) => x.start === slotStart);
    if (!store || !slot) return;
    setSending(true);
    setError(null);
    try {
      const order = await api.placeOrder(store, fulfillment, slot);
      router.push(`/pedidos/${order.id}?pagar=${payment}`);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Finalizar pedido</h1>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Como você quer receber?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Option
              active={fulfillment === "delivery"}
              disabled={!delivers}
              onClick={() => { setChoice("delivery"); setSlotStart(null); }}
              title="🚚 Receber em casa"
              detail={
                !store.offersDelivery
                  ? "Esta loja não faz entregas"
                  : !s.address
                    ? "Cadastre um endereço para receber em casa"
                    : delivers
                      ? `${s.address.street}, ${s.address.number} · ${s.address.neighborhood}`
                      : "Seu endereço está fora da área desta loja"
              }
            />
            <Option
              active={fulfillment === "pickup"}
              disabled={!store.offersPickup}
              onClick={() => { setChoice("pickup"); setSlotStart(null); }}
              title="🏬 Retirar na loja"
              detail={store.offersPickup ? store.address : "Esta loja não oferece retirada"}
            />
          </div>
          {store.offersDelivery && (
            <Link href="/enderecos?voltar=/checkout" className="text-sm text-primary-strong underline">
              {s.address ? "Usar outro endereço" : "Cadastrar endereço"}
            </Link>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{fulfillment === "delivery" ? "Horário de entrega" : "Horário de retirada"}</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-muted">A loja não tem horários disponíveis nos próximos dias.</p>
          ) : (
            <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => setSlotStart(slot.start)}
                  className={`rounded-xl border px-3 py-2 text-sm ${slotStart === slot.start ? "border-primary bg-primary-soft font-semibold text-primary-strong" : "border-border bg-surface"}`}
                >
                  {formatSlot(slot)}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Pagamento</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Option active={payment === "pix"} onClick={() => setPayment("pix")} title="⚡ Pix" detail="Aprovação na hora" />
            <Option active={payment === "card"} onClick={() => setPayment("card")} title="💳 Cartão de crédito" detail="Em até 3x sem juros" />
          </div>
          <p className="text-xs text-muted">
            Pagamento processado pelo Mercado Pago.{" "}
            {s.mode === "demo" ? "Nesta demonstração ele é simulado." : "Enquanto a integração não entra, a loja confirma o pagamento manualmente."}
          </p>
        </section>
      </div>

      <aside className="card h-fit space-y-3 p-4 lg:sticky lg:top-28">
        <h2 className="font-semibold">{store.name}</h2>
        <ul className="space-y-1 text-sm">
          {s.cart.items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span className="truncate text-muted">{i.quantity}× {i.name}</span>
              <span>{formatBRL(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-border pt-3 text-sm">
          <Row label="Subtotal" value={formatBRL(totals.subtotalCents)} />
          <Row
            label={fulfillment === "delivery" ? "Entrega" : "Retirada"}
            value={totals.deliveryFeeCents === 0 ? "Grátis" : formatBRL(totals.deliveryFeeCents)}
          />
          <div className="flex justify-between pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatBRL(totals.totalCents)}</dd>
          </div>
        </dl>
        {(error || problems.length > 0) && (
          <ul className="space-y-1 rounded-xl bg-warning-soft p-3 text-sm text-warning">
            {error && <li>{error}</li>}
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <button className="btn-primary w-full py-3" disabled={problems.length > 0 || sending} onClick={submit}>
          {payment === "pix" ? "Pagar com Pix" : "Pagar com cartão"} · {formatBRL(totals.totalCents)}
        </button>
      </aside>
    </div>
  );
}

function Option(props: { active: boolean; disabled?: boolean; onClick: () => void; title: string; detail: string }) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      className={`rounded-xl border p-3 text-left transition disabled:opacity-50 ${props.active ? "border-primary bg-primary-soft" : "border-border bg-surface hover:bg-surface-2"}`}
    >
      <span className="block font-semibold">{props.title}</span>
      <span className="block text-xs text-muted">{props.detail}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
