"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { memo, useMemo } from "react";
import * as THREE from "three";
import type { Product, Store } from "@mercado/shared";
import { CART, COOLER, ENDCAP, GONDOLA, SHELF_HEIGHTS, type Cooler, type Gondola, type StoreLayout } from "@/lib/store-layout";
import { packageParts } from "./packaging";
import { Boxes, MAT, Merchandise, Sign, type BoxSpec, type PickHandler } from "./parts";
import {
  brandColor,
  conveyorTexture,
  outsideTexture,
  pegboardTexture,
  promoTexture,
  signTexture,
  wireTexture,
} from "./textures";

// Móveis e acabamentos da loja: gôndolas, balcões refrigerados, caixa,
// carrinhos, fachada de vidro e luminárias.

export const CEILING = 3.6;

function usePick(products: Map<string, Product>, onPick: (p: Product) => void): PickHandler {
  return (e: ThreeEvent<MouseEvent>, id: string) => {
    // Arrastar para olhar também solta um clique; só conta toque curto.
    if (e.delta > 8) return;
    e.stopPropagation();
    const p = products.get(id);
    if (p) onPick(p);
  };
}

const accentMaterials = new Map<string, THREE.MeshStandardMaterial>();
function accentMaterial(color: string): THREE.MeshStandardMaterial {
  let m = accentMaterials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1 });
    accentMaterials.set(color, m);
  }
  return m;
}

export const GondolaMesh = memo(function GondolaMesh({ gondola, products, onPick }: {
  gondola: Gondola;
  products: Map<string, Product>;
  onPick: (p: Product) => void;
}) {
  const accent = brandColor(gondola.category.name);
  const sign = useMemo(() => signTexture(gondola.category.emoji, gondola.category.name, accent), [gondola.category, accent]);
  const promo = useMemo(() => promoTexture(gondola.category.name), [gondola.category.name]);
  const pegboard = useMemo(() => {
    const t = pegboardTexture().clone();
    t.repeat.set(GONDOLA.length / 0.1, GONDOLA.height / 0.1);
    t.needsUpdate = true;
    return t;
  }, []);
  const pick = usePick(products, onPick);
  const { x } = gondola;
  const L = GONDOLA.length;
  const D = GONDOLA.depth;
  const endZ = L / 2 + ENDCAP.depth;

  const structure = useMemo(() => {
    const steel: BoxSpec[] = [];
    const shelves: BoxSpec[] = [];
    const rails: BoxSpec[] = [];
    // Colunas a cada 1,2 m, dos dois lados do painel
    for (let z = -L / 2; z <= L / 2 + 0.001; z += 1.2) {
      for (const f of [1, -1]) steel.push({ position: [x + f * 0.05, GONDOLA.height / 2, z], size: [0.03, GONDOLA.height, 0.05] });
    }
    // Tampo
    steel.push({ position: [x, GONDOLA.height + 0.02, 0], size: [0.14, 0.04, L] });
    for (const y of SHELF_HEIGHTS) {
      for (const f of [1, -1]) {
        shelves.push({ position: [x + f * (D / 4 + 0.03), y - 0.015, 0], size: [D / 2 - 0.06, 0.025, L - 0.02] });
        // Canaleta de preço na beirada da prateleira
        rails.push({ position: [x + f * (D / 2 - 0.005), y - 0.04, 0], size: [0.012, 0.05, L - 0.02] });
      }
    }
    // Ponta de gôndola
    for (const y of SHELF_HEIGHTS) {
      shelves.push({ position: [x, y - 0.015, L / 2 + ENDCAP.depth / 2], size: [D, 0.025, ENDCAP.depth] });
      rails.push({ position: [x, y - 0.04, endZ - 0.005], size: [D, 0.05, 0.012] });
    }
    return { steel, shelves, rails };
  }, [x, L, D, endZ]);

  return (
    <group>
      {/* Rodapé e painel perfurado */}
      <mesh position={[x, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[D, 0.12, L]} />
        <primitive object={MAT.plinth} attach="material" />
      </mesh>
      <mesh position={[x, GONDOLA.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.06, GONDOLA.height, L]} />
        <meshStandardMaterial map={pegboard} roughness={0.6} metalness={0.2} />
      </mesh>
      <Boxes boxes={structure.steel} material={MAT.darkSteel} />
      <Boxes boxes={structure.shelves} material={MAT.shelf} />
      <Boxes boxes={structure.rails} material={MAT.priceRail} />

      {/* Fundo da ponta de gôndola, laterais coloridas e cabeceira de oferta */}
      <mesh position={[x, 0.06, L / 2 + ENDCAP.depth / 2]} receiveShadow>
        <boxGeometry args={[D, 0.12, ENDCAP.depth]} />
        <primitive object={MAT.plinth} attach="material" />
      </mesh>
      {[1, -1].map((f) => (
        <mesh key={f} position={[x + f * (D / 2 + 0.015), GONDOLA.height / 2 + 0.05, L / 2 + ENDCAP.depth / 2 - 0.02]} castShadow receiveShadow>
          <boxGeometry args={[0.03, GONDOLA.height + 0.1, ENDCAP.depth + 0.04]} />
          <primitive object={accentMaterial(accent)} attach="material" />
        </mesh>
      ))}
      <mesh position={[x, GONDOLA.height + 0.25, endZ - 0.02]}>
        <planeGeometry args={[D + 0.06, 0.34]} />
        <meshBasicMaterial map={promo} toneMapped={false} color={new THREE.Color(1.15, 1.15, 1.15)} />
      </mesh>
      {/* Lateral do fundo do corredor */}
      <mesh position={[x, GONDOLA.height / 2, -L / 2 - 0.02]} castShadow receiveShadow>
        <boxGeometry args={[D + 0.04, GONDOLA.height, 0.04]} />
        <primitive object={accentMaterial(accent)} attach="material" />
      </mesh>

      {/* Placas da categoria, penduradas no teto */}
      <SignHanger x={x} z={L / 2 - 0.6} />
      <Sign map={sign} position={[x, 2.8, L / 2 - 0.6]} rotationY={0} size={[1.8, 0.56]} glow={1.1} />
      <SignHanger x={x} z={0} />
      <Sign map={sign} position={[x, 2.8, 0]} rotationY={Math.PI / 2} size={[1.8, 0.56]} glow={1.1} />

      <Merchandise slots={gondola.slots} products={products} onPick={pick} tagOffset={0.162} depthRows={2} />
      <Merchandise slots={gondola.endcap} products={products} onPick={pick} tagOffset={0.162} />
    </group>
  );
});

/** Cabos finos que seguram as placas. */
function SignHanger({ x, z }: { x: number; z: number }) {
  return (
    <>
      {[-0.7, 0.7].map((o) => (
        <mesh key={o} position={[x + (z === 0 ? 0 : o), (CEILING + 3.08) / 2, z + (z === 0 ? o : 0)]}>
          <cylinderGeometry args={[0.004, 0.004, CEILING - 3.08, 4]} />
          <primitive object={MAT.darkSteel} attach="material" />
        </mesh>
      ))}
    </>
  );
}

/** Balcão refrigerado aberto, com luz de LED em cada prateleira. */
export const CoolerMesh = memo(function CoolerMesh({ cooler, products, onPick }: {
  cooler: Cooler;
  products: Map<string, Product>;
  onPick: (p: Product) => void;
}) {
  const pick = usePick(products, onPick);
  const sign = useMemo(() => signTexture(cooler.category.emoji, cooler.category.name, "#16324f"), [cooler.category]);
  const { x, z, length: L } = cooler;
  const D = COOLER.depth;
  const H = COOLER.height;
  const back = z - D / 2;
  const front = z + D / 2;

  const parts = useMemo(() => {
    const body: BoxSpec[] = [
      { position: [x, H / 2, back + 0.03], size: [L, H, 0.06] }, // fundo
      { position: [x, H - 0.03, z - 0.05], size: [L, 0.06, D - 0.1] }, // teto
      ...[1, -1].map((f): BoxSpec => ({ position: [x + f * (L / 2 - 0.025), H / 2, z], size: [0.05, H, D] })), // laterais
    ];
    const shelves: BoxSpec[] = [];
    const rails: BoxSpec[] = [];
    const leds: BoxSpec[] = [];
    COOLER.shelves.forEach((y, i) => {
      const depth = i === 0 ? D - 0.12 : D - 0.2;
      shelves.push({ position: [x, y - 0.015, back + 0.06 + depth / 2], size: [L - 0.1, 0.02, depth] });
      rails.push({ position: [x, y - 0.04, back + 0.06 + depth + 0.005], size: [L - 0.1, 0.05, 0.012] });
      // LED sob a prateleira de cima, iluminando os produtos
      const above = COOLER.shelves[i + 1] ?? H - 0.2;
      leds.push({ position: [x, above - 0.035, back + 0.06 + (depth - 0.06)], size: [L - 0.14, 0.012, 0.025] });
    });
    // Para-choque inox na frente e base com grade
    rails.push({ position: [x, 0.27, front - 0.02], size: [L, 0.06, 0.04] });
    return { body, shelves, rails, leds };
  }, [x, z, L, D, H, back, front]);

  return (
    <group>
      <mesh position={[x, 0.13, z + 0.02]} receiveShadow>
        <boxGeometry args={[L, 0.26, D - 0.04]} />
        <primitive object={MAT.plinth} attach="material" />
      </mesh>
      <Boxes boxes={parts.body} material={MAT.white} />
      <Boxes boxes={parts.shelves} material={MAT.shelf} />
      <Boxes boxes={parts.rails} material={MAT.steel} />
      <Boxes boxes={parts.leds} material={MAT.led} castShadow={false} />
      {/* Interior levemente iluminado pelo frio */}
      <mesh position={[x, H / 2 + 0.1, back + 0.065]}>
        <planeGeometry args={[L - 0.1, H - 0.6]} />
        <meshStandardMaterial color="#eef5fb" emissive="#dcecff" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      {/* Testeira com o nome da seção, iluminada */}
      <mesh position={[x, H - 0.2, z - 0.05 + (D - 0.1) / 2 + 0.002]}>
        <planeGeometry args={[Math.min(L - 0.2, 2.4), 0.34]} />
        <meshBasicMaterial map={sign} toneMapped={false} color={new THREE.Color(1.2, 1.2, 1.2)} transparent />
      </mesh>
      <Merchandise slots={cooler.slots} products={products} onPick={pick} tagOffset={0.2} depthRows={3} rowGap={0.12} />
    </group>
  );
});

/** Caixa com esteira, leitor, monitor, maquininha e poste com o número. */
export function CheckoutLanes({ layout, products, onCheckout }: { layout: StoreLayout; products: Product[]; onCheckout: () => void }) {
  return (
    <>
      {layout.checkoutLanes.map((x, i) => (
        <CheckoutLane key={x} x={x} z={layout.checkout.z} number={i + 1} onBelt={i === 0 ? products.slice(0, 4) : []} onCheckout={onCheckout} />
      ))}
    </>
  );
}

function CheckoutLane({ x, z, number, onBelt, onCheckout }: { x: number; z: number; number: number; onBelt: Product[]; onCheckout: () => void }) {
  const belt = useMemo(() => {
    const t = conveyorTexture().clone();
    t.repeat.set(4, 12);
    t.needsUpdate = true;
    return t;
  }, []);
  const sign = useMemo(() => signTexture("💳", `Caixa ${number}`, "#6d4aff"), [number]);
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        if (e.delta > 8) return;
        e.stopPropagation();
        onCheckout();
      }}
    >
      {/* Balcão */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.88, 2.2]} />
        <meshStandardMaterial color="#f2f2f0" roughness={0.4} />
      </mesh>
      <mesh position={[0.401, 0.62, 0]}>
        <planeGeometry args={[2.2, 0.12]} />
        <meshStandardMaterial color="#6d4aff" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.885, 0]} receiveShadow>
        <boxGeometry args={[0.82, 0.02, 2.22]} />
        <primitive object={MAT.steel} attach="material" />
      </mesh>
      {/* Esteira */}
      <mesh position={[0.05, 0.9, 0.4]} receiveShadow>
        <boxGeometry args={[0.52, 0.012, 1.3]} />
        <meshStandardMaterial map={belt} roughness={0.85} />
      </mesh>
      {/* Compras de alguém na esteira */}
      {onBelt.map((p, i) => (
        <group key={p.id} position={[0.05 + (i % 2 ? 0.1 : -0.1), 0.906, 0.9 - i * 0.28]} rotation={[0, 0.3 + i * 0.9, 0]}>
          {packageParts(p).map((part, k) => (
            <mesh key={k} geometry={part.geometry} material={part.material} castShadow />
          ))}
        </group>
      ))}
      {/* Leitor de código de barras com vidro e brilho vermelho */}
      <mesh position={[0.05, 0.897, -0.45]}>
        <boxGeometry args={[0.36, 0.006, 0.3]} />
        <meshStandardMaterial color="#111" roughness={0.05} metalness={0.2} emissive="#ff2020" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[0.05, 1.03, -0.62]} castShadow>
        <boxGeometry args={[0.36, 0.26, 0.05]} />
        <meshStandardMaterial color="#202326" roughness={0.3} />
      </mesh>
      {/* Área de ensacar */}
      <mesh position={[0.05, 0.9, -0.92]}>
        <boxGeometry args={[0.6, 0.01, 0.34]} />
        <primitive object={MAT.steel} attach="material" />
      </mesh>
      {/* Monitor do operador */}
      <mesh position={[-0.28, 1.05, -0.3]}>
        <cylinderGeometry args={[0.02, 0.02, 0.32, 8]} />
        <primitive object={MAT.darkSteel} attach="material" />
      </mesh>
      <group position={[-0.28, 1.28, -0.3]} rotation={[0, Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.38, 0.26, 0.03]} />
          <meshStandardMaterial color="#1b1d20" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.016]}>
          <planeGeometry args={[0.34, 0.22]} />
          <meshBasicMaterial color={new THREE.Color(0.55, 0.75, 1.3)} toneMapped={false} />
        </mesh>
      </group>
      {/* Maquininha de cartão */}
      <mesh position={[0.32, 0.96, -0.15]} rotation={[-0.4, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[0.08, 0.14, 0.03]} />
        <meshStandardMaterial color="#222" roughness={0.4} />
      </mesh>
      {/* Poste com o número do caixa aceso */}
      <mesh position={[-0.33, 1.55, 1.0]}>
        <cylinderGeometry args={[0.025, 0.025, 1.3, 10]} />
        <primitive object={MAT.steel} attach="material" />
      </mesh>
      <Sign map={sign} position={[-0.33, 2.3, 1.0]} rotationY={Math.PI / 2} size={[0.9, 0.28]} glow={1.3} />
    </group>
  );
}

/** Carrinhos de arame encaixados. */
export function Carts({ carts }: { carts: StoreLayout["carts"] }) {
  const wire = useMemo(() => {
    const t = wireTexture().clone();
    t.repeat.set(4, 3);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({
      map: t,
      alphaTest: 0.4,
      transparent: false,
      side: THREE.DoubleSide,
      metalness: 0.9,
      roughness: 0.25,
      color: "#ffffff",
    });
  }, []);
  return (
    <>
      {carts.map((c, i) => (
        <group key={i} position={[c.x, 0, c.z]} rotation={[0, c.rotY, 0]}>
          {/* Cesto: quatro lados e fundo de arame */}
          {[
            { p: [0, 0.68, -CART.length / 2 + 0.05], s: [CART.width, 0.42], r: [0, 0, 0] },
            { p: [0, 0.68, CART.length / 2 - 0.15], s: [CART.width, 0.42], r: [0, 0, 0] },
            { p: [CART.width / 2, 0.68, -0.05], s: [CART.length - 0.2, 0.42], r: [0, Math.PI / 2, 0] },
            { p: [-CART.width / 2, 0.68, -0.05], s: [CART.length - 0.2, 0.42], r: [0, Math.PI / 2, 0] },
            { p: [0, 0.47, -0.05], s: [CART.width, CART.length - 0.2], r: [-Math.PI / 2, 0, 0] },
            { p: [0, 0.2, 0], s: [CART.width - 0.08, CART.length - 0.25], r: [-Math.PI / 2, 0, 0] },
          ].map((f, k) => (
            <mesh key={k} position={f.p as [number, number, number]} rotation={f.r as [number, number, number]} castShadow material={wire}>
              <planeGeometry args={f.s as [number, number]} />
            </mesh>
          ))}
          {/* Alça vermelha */}
          <mesh position={[0, 0.98, CART.length / 2 - 0.08]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.018, 0.018, CART.width + 0.04, 10]} />
            <meshStandardMaterial color="#d62828" roughness={0.35} />
          </mesh>
          {/* Chassi e rodas */}
          {[1, -1].map((f) => (
            <mesh key={f} position={[f * (CART.width / 2 - 0.03), 0.5, 0.05]} rotation={[0.12, 0, 0]} castShadow>
              <boxGeometry args={[0.02, 0.9, 0.02]} />
              <primitive object={MAT.steel} attach="material" />
            </mesh>
          ))}
          {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([fx, fz]) => (
            <mesh key={`${fx}${fz}`} position={[fx * (CART.width / 2 - 0.05), 0.05, fz * (CART.length / 2 - 0.12)]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
              <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}

/** Fachada de vidro na entrada, com a rua lá fora. */
export function Storefront({ layout }: { layout: StoreLayout }) {
  const { minX, maxX, maxZ } = layout.bounds;
  const w = maxX - minX;
  const cx = (minX + maxX) / 2;
  const street = useMemo(() => outsideTexture(), []);
  const mullions = useMemo(() => {
    const b: BoxSpec[] = [];
    const n = Math.round(w / 1.5);
    for (let i = 0; i <= n; i++) b.push({ position: [minX + (i * w) / n, 1.3, maxZ], size: [0.06, 2.6, 0.1] });
    b.push({ position: [cx, 2.62, maxZ], size: [w, 0.08, 0.12] });
    b.push({ position: [cx, 0.04, maxZ], size: [w, 0.08, 0.12] });
    return b;
  }, [w, minX, cx, maxZ]);
  return (
    <group>
      {/* Faixa de parede acima do vidro */}
      <mesh position={[cx, (CEILING + 2.66) / 2, maxZ]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, CEILING - 2.66]} />
        <meshStandardMaterial color="#f6f3ea" roughness={0.9} />
      </mesh>
      {/* Vidro: quase transparente, só com reflexo */}
      <mesh position={[cx, 1.3, maxZ - 0.01]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w, 2.6]} />
        <meshStandardMaterial color="#d7e9f3" transparent opacity={0.12} roughness={0.02} metalness={0.1} depthWrite={false} />
      </mesh>
      <Boxes boxes={mullions} material={MAT.darkSteel} castShadow={false} />
      {/* Rua lá fora, bem clara como um dia de sol */}
      <mesh position={[cx, 2.6, maxZ + 7]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w + 24, 8]} />
        <meshBasicMaterial map={street} toneMapped={false} fog={false} color={new THREE.Color(1.25, 1.25, 1.25)} />
      </mesh>
      <mesh position={[cx, -0.01, maxZ + 3.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 24, 7]} />
        <meshBasicMaterial color={new THREE.Color(1.1, 1.08, 1.04)} toneMapped={false} fog={false} />
      </mesh>
      {/* Tapete da entrada */}
      <mesh position={[layout.entrance.x, 0.006, maxZ - 0.9]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.4, 1.4]} />
        <meshStandardMaterial color="#3b3f45" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Luminárias de embutir no forro, em grade. */
export function ceilingLightPositions(layout: StoreLayout): [number, number][] {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const out: [number, number][] = [];
  for (let x = minX + 1.8; x < maxX - 1; x += 3) for (let z = minZ + 1.6; z < maxZ - 1; z += 2.4) out.push([x, z]);
  return out;
}

export function CeilingLights({ layout }: { layout: StoreLayout }) {
  const positions = useMemo(() => ceilingLightPositions(layout), [layout]);
  const frames = useMemo(() => positions.map(([x, z]): BoxSpec => ({ position: [x, CEILING - 0.015, z], size: [1.24, 0.03, 0.64] })), [positions]);
  const panels = useMemo(() => positions.map(([x, z]): BoxSpec => ({ position: [x, CEILING - 0.032, z], size: [1.16, 0.004, 0.56] })), [positions]);
  return (
    <>
      <Boxes boxes={frames} material={MAT.white} castShadow={false} />
      <Boxes boxes={panels} material={MAT.led} castShadow={false} />
    </>
  );
}

export function StoreBanner({ store, layout }: { store: Store; layout: StoreLayout }) {
  const banner = useMemo(() => signTexture(store.logoUrl && store.logoUrl.length <= 4 ? store.logoUrl : "🛒", store.name), [store]);
  const { minX, maxX, minZ } = layout.bounds;
  return (
    <mesh position={[(minX + maxX) / 2, 2.85, minZ + 0.02]}>
      <planeGeometry args={[3.6, 1.12]} />
      <meshBasicMaterial map={banner} transparent toneMapped={false} color={new THREE.Color(1.1, 1.1, 1.1)} />
    </mesh>
  );
}
