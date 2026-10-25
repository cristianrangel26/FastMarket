"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { CartStoreConflictError, cartItemCount, cartSubtotalCents, formatBRL, type Product, type Store } from "@mercado/shared";
import { api, useApp } from "@/lib/app-store";
import { buildLayout } from "@/lib/store-layout";
import { Thumb } from "@/components/ui";
import { createXRStore, useXRSessionModeSupported } from "@react-three/xr";
import { MoveInput, StoreScene } from "./scene";

export default function Store3D({ store }: { store: Store }) {
  const s = useApp();
  const router = useRouter();
  const [move] = useState(() => new MoveInput());
  const [picked, setPicked] = useState<Product | null>(null);
  const [help, setHelp] = useState(true);
  const [xr] = useState(() => createXRStore({ emulate: false, hand: { teleportPointer: false }, controller: { teleportPointer: false } }));
  const vrSupported = useXRSessionModeSupported("immersive-vr");

  const storeProducts = useMemo(() => s.products.filter((p) => p.storeId === store.id), [s.products, store.id]);
  // A planta só muda quando muda o sortimento, não a cada alteração de estoque.
  const assortmentKey = storeProducts.filter((p) => p.active && p.stock > 0).map((p) => p.id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => buildLayout(s.categories, storeProducts), [s.categories, assortmentKey]);
  const byId = useMemo(() => new Map(storeProducts.map((p) => [p.id, p])), [storeProducts]);
  const inCart = s.cart.storeId === store.id;

  if (layout.gondolas.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p>Esta loja ainda não tem produtos à venda.</p>
        <Link href={`/loja/${store.slug}`} className="btn-ghost">Voltar</Link>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-[#f3f1ec]">
      <StoreScene
        store={store}
        layout={layout}
        products={byId}
        move={move}
        onPick={(p) => { setPicked(p); setHelp(false); }}
        onCheckout={() => {
          void xr.getState().session?.end();
          router.push("/carrinho");
        }}
        xr={xr}
        picked={picked}
        pickedQuantity={picked && inCart ? s.cart.items.find((i) => i.productId === picked.id)?.quantity ?? 0 : 0}
        onAdd={(p) => addProduct(p, true)}
        onClosePicked={() => setPicked(null)}
      />

      {/* Topo */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <Link href={`/loja/${store.slug}`} className="btn-ghost pointer-events-auto shadow-sm">← Ver como lista</Link>
        <Link href="/carrinho" className="btn-primary pointer-events-auto shadow-md">
          🛒 {inCart ? cartItemCount(s.cart) : 0} · {formatBRL(inCart ? cartSubtotalCents(s.cart) : 0)}
        </Link>
      </div>

      {help && (
        <button
          onClick={() => setHelp(false)}
          className="absolute left-1/2 top-16 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl bg-black/70 p-4 text-left text-sm text-white backdrop-blur"
        >
          <p className="mb-1 font-semibold">Bem-vindo ao {store.name}!</p>
          <p>Arraste a tela para olhar em volta. Ande com o joystick ou com W A S D. Toque num produto para ver o preço e colocar no carrinho. Quando terminar, vá até o <b>Caixa</b>.</p>
          <p className="mt-2 text-xs text-white/70">Toque para fechar</p>
        </button>
      )}

      <Joystick move={move} />

      {vrSupported && (
        <button className="btn-primary absolute bottom-6 right-6 py-3 shadow-lg" onClick={() => void xr.enterVR()}>
          🥽 Entrar em VR
        </button>
      )}

      {picked && (
        <ProductSheet
          product={byId.get(picked.id) ?? picked}
          quantity={inCart ? s.cart.items.find((i) => i.productId === picked.id)?.quantity ?? 0 : 0}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}

/** `inVR`: nos óculos não dá para mostrar a confirmação, então o carrinho de outra loja é trocado direto. */
function addProduct(product: Product, inVR = false) {
  try {
    api.addToCart(product);
  } catch (e) {
    if (!(e instanceof CartStoreConflictError)) throw e;
    if (inVR || confirm("Seu carrinho tem produtos de outra loja. Quer esvaziar e começar nesta?")) {
      api.addToCart(product, 1, true);
    }
  }
}

function ProductSheet({ product, quantity, onClose }: { product: Product; quantity: number; onClose: () => void }) {
  const add = () => addProduct(product);
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:left-auto sm:right-3 sm:w-96" role="dialog" aria-label={product.name}>
      <div className="card space-y-3 p-4 shadow-xl">
        <div className="flex gap-3">
          <Thumb src={product.imageUrl} alt={product.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-snug">{product.name}</h2>
            {product.description && <p className="text-sm text-muted">{product.description}</p>}
            <p className="mt-1 text-xl font-bold">{formatBRL(product.priceCents)}</p>
            <p className="text-xs text-muted">{product.stock} em estoque</p>
          </div>
          <button className="self-start text-muted" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {quantity === 0 ? (
          <button className="btn-primary w-full py-2.5" onClick={add}>Colocar no carrinho</button>
        ) : (
          <div className="flex items-center justify-between rounded-full bg-primary-soft p-1">
            <button className="btn h-9 w-9 p-0" aria-label="Diminuir" onClick={() => api.setQuantity(product.id, quantity - 1)}>−</button>
            <span className="font-semibold">{quantity} no carrinho</span>
            <button className="btn h-9 w-9 p-0" aria-label="Aumentar" disabled={quantity >= product.stock} onClick={() => api.setQuantity(product.id, quantity + 1)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Joystick virtual para andar pelo celular. */
function Joystick({ move }: { move: MoveInput }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const R = 44;

  function update(e: React.PointerEvent) {
    if (!origin.current || origin.current.id !== e.pointerId) return;
    let dx = e.clientX - origin.current.x;
    let dy = e.clientY - origin.current.y;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
    setKnob({ x: dx, y: dy });
    move.set(-dy / R, dx / R);
  }
  function end() {
    origin.current = null;
    setKnob({ x: 0, y: 0 });
    move.set(0, 0);
  }

  return (
    <div
      className="absolute bottom-6 left-6 h-32 w-32 touch-none rounded-full border-2 border-white/70 bg-black/20 backdrop-blur-sm"
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={update}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Joystick para andar"
    >
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/90 shadow-md"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
