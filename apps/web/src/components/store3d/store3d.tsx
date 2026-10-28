"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartStoreConflictError, cartItemCount, cartSubtotalCents, formatBRL, type Product, type Store } from "@mercado/shared";
import { api, useApp } from "@/lib/app-store";
import { buildLayout, findPath, type Stop } from "@/lib/store-layout";
import { Thumb } from "@/components/ui";
import { createXRStore, useXRSessionModeSupported } from "@react-three/xr";
import { Navigator } from "./navigator";
import { MoveInput, StoreScene, type Quality } from "./scene";

export default function Store3D({ store }: { store: Store }) {
  const s = useApp();
  const router = useRouter();
  const [move] = useState(() => new MoveInput());
  const [picked, setPicked] = useState<Product | null>(null);
  const [help, setHelp] = useState(true);
  const [nav] = useState(() => new Navigator());
  /** Seção atual; -1 enquanto a pessoa ainda está onde começou. */
  const [stopIndex, setStopIndex] = useState(-1);
  const [freeWalk, setFreeWalk] = useState(false);
  const [tour, setTour] = useState(false);
  // Qualidade alta no computador; leve no celular, que esquenta e gasta bateria.
  const [quality, setQuality] = useState<Quality>(() =>
    window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 900 ? "alta" : "leve",
  );
  const [xr] = useState(() => createXRStore({ emulate: false, hand: { teleportPointer: false }, controller: { teleportPointer: false } }));
  const vrSupported = useXRSessionModeSupported("immersive-vr");

  const storeProducts = useMemo(() => s.products.filter((p) => p.storeId === store.id), [s.products, store.id]);
  // A planta só muda quando muda o sortimento, não a cada alteração de estoque.
  const assortmentKey = storeProducts.filter((p) => p.active && p.stock > 0).map((p) => p.id).join();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layout = useMemo(() => buildLayout(s.categories, storeProducts), [s.categories, assortmentKey]);
  const byId = useMemo(() => new Map(storeProducts.map((p) => [p.id, p])), [storeProducts]);
  const inCart = s.cart.storeId === store.id;
  // Link direto para uma seção: /loja/<slug>/3d?secao=laticinios
  const [start] = useState(() => {
    const wanted = new URLSearchParams(window.location.search).get("secao");
    const i = layout.stops.findIndex((st) => st.id === wanted || st.label.toLowerCase() === wanted?.toLowerCase());
    const stop = layout.stops[Math.max(0, i)];
    return { index: Math.max(0, i), x: stop.x, z: stop.z, yaw: stop.yaw };
  });
  const current = stopIndex === -1 ? start.index : stopIndex;

  /** Leva a pessoa sozinha até a seção, já de frente para as prateleiras. */
  function goTo(index: number) {
    const stops = layout.stops;
    const i = (index + stops.length) % stops.length;
    const stop = stops[i];
    nav.go(findPath(layout, nav.position, stop), stop.yaw);
    setStopIndex(i);
    setHelp(false);
    setPicked(null);
  }

  // Tour de apresentação: passa por todas as seções sozinho, com uma pausa em cada.
  const tourState = useRef({ index: current, waitUntil: 0 });
  useEffect(() => {
    if (!tour) return;
    tourState.current.index = current;
    tourState.current.waitUntil = 0;
    const timer = setInterval(() => {
      const st = tourState.current;
      if (nav.path.length || nav.finalYaw !== null) return;
      const now = Date.now();
      if (!st.waitUntil) {
        st.waitUntil = now + 2500;
        return;
      }
      if (now < st.waitUntil) return;
      st.waitUntil = 0;
      st.index = (st.index + 1) % layout.stops.length;
      const stop = layout.stops[st.index];
      nav.go(findPath(layout, nav.position, stop), stop.yaw);
      setStopIndex(st.index);
    }, 200);
    return () => clearInterval(timer);
    // Só reinicia quando liga/desliga o tour.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, layout, nav]);

  if (!layout.gondolas.length && !layout.coolers.length && !layout.produce) {
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
        nav={nav}
        quality={quality}
        start={start}
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

      {tour ? (
        <>
          <button
            className="absolute right-3 top-3 rounded-full bg-black/45 px-4 py-2 text-base text-white backdrop-blur"
            onClick={() => { setTour(false); nav.cancel(); }}
          >
            ✕ Sair do tour
          </button>
          <div key={current} className="pointer-events-none absolute bottom-10 left-8 animate-[fadein_0.8s_ease-out] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
            <p className="text-sm uppercase tracking-[0.3em] text-white/80">{store.name}</p>
            <p className="text-4xl font-bold sm:text-5xl">{layout.stops[current].emoji} {layout.stops[current].label}</p>
          </div>
        </>
      ) : (
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 p-3">
        <Link href={`/loja/${store.slug}`} className="btn-ghost pointer-events-auto px-4 py-3 text-lg shadow-sm">← Ver como lista</Link>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
          <button className="btn-ghost px-3 py-3 text-base shadow-sm" onClick={() => { setTour(true); setHelp(false); setPicked(null); }} title="Passeio automático pela loja, bom para apresentar">
            🎬 Tour
          </button>
          <button
            className="btn-ghost px-3 py-3 text-base shadow-sm"
            onClick={() => setQuality((q) => (q === "alta" ? "leve" : "alta"))}
            title="Qualidade da imagem"
          >
            {quality === "alta" ? "✨ Alta" : "⚡ Leve"}
          </button>
          <Link href="/carrinho" className="btn-primary px-4 py-3 text-lg shadow-md">
            🛒 {inCart ? cartItemCount(s.cart) : 0} · {formatBRL(inCart ? cartSubtotalCents(s.cart) : 0)}
          </Link>
        </div>
      </div>
      )}

      {help && !tour && (
        <button
          onClick={() => setHelp(false)}
          className="absolute left-1/2 top-20 z-10 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl bg-black/75 p-5 text-left text-lg leading-snug text-white backdrop-blur"
        >
          <p className="mb-2 text-xl font-semibold">Bem-vindo ao {store.name}!</p>
          <p>Toque no nome de uma seção lá embaixo e você será levado até ela. Toque num produto para ver o preço e colocar no carrinho.</p>
          <p className="mt-2">Quando terminar, toque em <b>💳 Caixa</b>.</p>
          <p className="mt-3 text-base text-white/70">Toque aqui para fechar</p>
        </button>
      )}

      {freeWalk && !picked && !tour && <Joystick move={move} />}

      {!picked && !tour && (
        <EasyNav
          stops={layout.stops}
          current={current}
          freeWalk={freeWalk}
          onGo={goTo}
          onTurn={(d) => nav.turn(d)}
          onToggleFree={() => setFreeWalk((v) => !v)}
        />
      )}

      {vrSupported && !tour && (
        <button className="btn-primary absolute right-3 top-20 py-3 text-lg shadow-lg" onClick={() => void xr.enterVR()}>
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
            <h2 className="text-xl font-semibold leading-snug">{product.name}</h2>
            {product.description && <p className="text-base text-muted">{product.description}</p>}
            <p className="mt-1 text-2xl font-bold">{formatBRL(product.priceCents)}</p>
            <p className="text-sm text-muted">{product.stock} em estoque</p>
          </div>
          <button className="-m-2 self-start p-2 text-2xl text-muted" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        {quantity === 0 ? (
          <button className="btn-primary w-full py-4 text-lg" onClick={add}>🛒 Colocar no carrinho</button>
        ) : (
          <div className="flex items-center justify-between rounded-full bg-primary-soft p-1">
            <button className="btn h-14 w-14 p-0 text-2xl" aria-label="Diminuir" onClick={() => api.setQuantity(product.id, quantity - 1)}>−</button>
            <span className="text-lg font-semibold">{quantity} no carrinho</span>
            <button className="btn h-14 w-14 p-0 text-2xl" aria-label="Aumentar" disabled={quantity >= product.stock} onClick={() => api.setQuantity(product.id, quantity + 1)}>+</button>
          </div>
        )}
        <button className="btn-ghost w-full py-3 text-lg" onClick={onClose}>Continuar comprando</button>
      </div>
    </div>
  );
}

/**
 * Navegação simples (padrão): botões grandes com o nome de cada seção, que levam
 * a pessoa sozinha até lá, e setas de virar e de próxima seção. Pensado para
 * quem não tem prática com jogos.
 */
function EasyNav({
  stops,
  current,
  freeWalk,
  onGo,
  onTurn,
  onToggleFree,
}: {
  stops: Stop[];
  current: number;
  freeWalk: boolean;
  onGo: (index: number) => void;
  onTurn: (delta: number) => void;
  onToggleFree: () => void;
}) {
  const big = "flex min-h-14 items-center justify-center gap-1 rounded-2xl bg-white/95 px-3 text-lg font-semibold shadow-md active:scale-95";
  return (
    <nav className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/45 to-transparent p-3 pt-8" aria-label="Ir para uma seção">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {stops.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onGo(i)}
            aria-current={i === current ? "location" : undefined}
            className={`flex min-h-16 shrink-0 flex-col items-center justify-center rounded-2xl px-4 text-base font-semibold shadow-md active:scale-95 ${
              i === current ? "bg-primary text-white" : "bg-white/95"
            }`}
          >
            <span className="text-2xl leading-none">{s.emoji}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
      <div className={`grid gap-2 ${freeWalk ? "grid-cols-3" : "grid-cols-5"}`}>
        {!freeWalk && <button className={big} onClick={() => onGo(current - 1)} aria-label="Seção anterior">◀ <span className="hidden sm:inline">Anterior</span></button>}
        <button className={big} onClick={() => onTurn(Math.PI / 4)} aria-label="Virar para a esquerda">↺ <span className="hidden sm:inline">Virar</span></button>
        <button className={`${big} text-base`} onClick={onToggleFree} aria-pressed={freeWalk}>
          {freeWalk ? "✋ Botões" : "🕹️ Andar livre"}
        </button>
        <button className={big} onClick={() => onTurn(-Math.PI / 4)} aria-label="Virar para a direita"><span className="hidden sm:inline">Virar</span> ↻</button>
        {!freeWalk && <button className={big} onClick={() => onGo(current + 1)} aria-label="Próxima seção"><span className="hidden sm:inline">Próximo</span> ▶</button>}
      </div>
    </nav>
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
      className="absolute bottom-48 left-3 z-[1] h-32 w-32 touch-none rounded-full border-2 border-white/70 bg-black/20 backdrop-blur-sm"
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
