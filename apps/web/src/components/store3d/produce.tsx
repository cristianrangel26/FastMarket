"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { formatBRL, type Product } from "@mercado/shared";
import { CRATE, TABLE, type ProduceTable } from "@/lib/store-layout";
import { chalkTagTexture, woodTexture } from "./textures";

// Hortifrúti: bancas de madeira inclinadas com cestos, e frutas e verduras
// modeladas em 3D, empilhadas como na feira.

const TILT = 0.2; // inclinação da banca para a frente, em radianos

interface Kind {
  geometry: THREE.BufferGeometry;
  color: string;
  /** Espaço que cada unidade ocupa no cesto, em metros. */
  size: number;
  roughness: number;
  /** Variação de cor entre unidades (0 a 1). */
  vary: number;
  randomSpin?: boolean;
}

function lumpy(radius: number, detail: number, amount: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + amount * Math.sin(v.x * 60) * Math.cos(v.y * 50) * Math.sin(v.z * 40);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function ellipsoid(r: number, sx: number, sy: number, sz: number): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, 18, 14).scale(sx, sy, sz);
}

const KINDS: [RegExp, () => Kind][] = [
  [/banana/i, () => ({ geometry: new THREE.TorusGeometry(0.085, 0.019, 8, 14, 1.7).rotateX(Math.PI / 2), color: "#f2cf3a", size: 0.13, roughness: 0.55, vary: 0.08, randomSpin: true })],
  [/alface|couve|r[uú]cula|agri[aã]o|espinafre/i, () => ({ geometry: lumpy(0.085, 3, 0.12), color: "#6fb54a", size: 0.18, roughness: 0.7, vary: 0.15 })],
  [/cenoura/i, () => ({ geometry: new THREE.ConeGeometry(0.022, 0.19, 10).rotateZ(Math.PI / 2), color: "#ef7d1a", size: 0.07, roughness: 0.6, vary: 0.1, randomSpin: true })],
  [/tomate/i, () => ({ geometry: ellipsoid(0.042, 1, 0.82, 1), color: "#d7261e", size: 0.085, roughness: 0.3, vary: 0.12 })],
  [/ma[cç][aã]/i, () => ({ geometry: ellipsoid(0.042, 1, 0.92, 1), color: "#c8232c", size: 0.088, roughness: 0.32, vary: 0.2 })],
  [/laranja|tangerina|mexerica/i, () => ({ geometry: lumpy(0.044, 2, 0.02), color: "#f39019", size: 0.09, roughness: 0.55, vary: 0.08 })],
  [/lim[aã]o/i, () => ({ geometry: ellipsoid(0.03, 1, 1, 1.25), color: "#7fbf2a", size: 0.065, roughness: 0.45, vary: 0.12, randomSpin: true })],
  [/abacate/i, () => ({ geometry: ellipsoid(0.045, 0.85, 1.2, 0.85), color: "#3c5a1e", size: 0.1, roughness: 0.6, vary: 0.12, randomSpin: true })],
  [/batata/i, () => ({ geometry: lumpy(0.04, 2, 0.06).scale(1.35, 0.85, 0.95), color: "#b98a52", size: 0.1, roughness: 0.85, vary: 0.12, randomSpin: true })],
  [/cebola/i, () => ({ geometry: ellipsoid(0.04, 1, 0.9, 1), color: "#c99a5b", size: 0.085, roughness: 0.5, vary: 0.1 })],
  [/uva/i, () => ({ geometry: lumpy(0.05, 1, 0.15).scale(0.9, 1.3, 0.9), color: "#5b2a6e", size: 0.11, roughness: 0.35, vary: 0.1, randomSpin: true })],
  [/abacaxi/i, () => ({ geometry: lumpy(0.06, 2, 0.08).scale(1, 1.6, 1), color: "#c9952e", size: 0.14, roughness: 0.8, vary: 0.08, randomSpin: true })],
  [/mam[aã]o|manga|melancia|mel[aã]o/i, () => ({ geometry: ellipsoid(0.06, 1.4, 0.9, 0.9), color: "#e3a72f", size: 0.15, roughness: 0.5, vary: 0.15, randomSpin: true })],
  [/br[oó]colis|couve-flor/i, () => ({ geometry: lumpy(0.07, 2, 0.15), color: "#3f7d2c", size: 0.15, roughness: 0.85, vary: 0.1 })],
  [/piment[aã]o/i, () => ({ geometry: lumpy(0.045, 2, 0.08).scale(1, 1.15, 1), color: "#2f8f2f", size: 0.1, roughness: 0.3, vary: 0.4 })],
];

function kindFor(p: Product): Kind {
  for (const [re, make] of KINDS) if (re.test(p.name)) return make();
  return { geometry: lumpy(0.042, 2, 0.04), color: "#8bbf4a", size: 0.09, roughness: 0.5, vary: 0.15 };
}

/** Posições das unidades num monte: camadas cada vez menores para o centro. */
function pilePositions(size: number, seed: number): THREE.Vector3[] {
  const rand = mulberry32(seed);
  const innerW = CRATE.width - 0.08;
  const innerD = CRATE.depth - 0.08;
  const out: THREE.Vector3[] = [];
  for (let layer = 0; layer < 4; layer++) {
    const shrink = layer * size * 0.9;
    const w = innerW - shrink * 2;
    const d = innerD - shrink * 2;
    if (w < size || d < size) break;
    const cols = Math.floor(w / size);
    const rows = Math.floor(d / size);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        out.push(new THREE.Vector3(
          -w / 2 + size / 2 + c * (w / cols) + (rand() - 0.5) * size * 0.35,
          0.03 + layer * size * 0.72 + rand() * size * 0.15,
          -d / 2 + size / 2 + r * (d / rows) + (rand() - 0.5) * size * 0.35,
        ));
      }
    }
  }
  return out;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Pile({ product, seed, onPick }: { product: Product; seed: number; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const kind = useMemo(() => kindFor(product), [product]);
  const positions = useMemo(() => pilePositions(kind.size, seed), [kind.size, seed]);
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = mulberry32(seed * 7 + 1);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const base = new THREE.Color(kind.color);
    const c = new THREE.Color();
    positions.forEach((pos, i) => {
      e.set(kind.randomSpin ? rand() * 0.6 - 0.3 : 0, rand() * Math.PI * 2, kind.randomSpin ? rand() * 0.6 - 0.3 : 0);
      q.setFromEuler(e);
      const s = 0.9 + rand() * 0.2;
      m.compose(pos, q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
      c.copy(base).offsetHSL((rand() - 0.5) * kind.vary * 0.3, (rand() - 0.5) * kind.vary, (rand() - 0.5) * kind.vary * 0.6);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [positions, kind, seed]);

  return (
    <instancedMesh ref={ref} args={[kind.geometry, undefined, positions.length]} onClick={onPick}>
      <meshStandardMaterial roughness={kind.roughness} />
    </instancedMesh>
  );
}

function CrateMesh({ product, x, z, seed, onPick }: { product: Product; x: number; z: number; seed: number; onPick: (p: Product) => void }) {
  const wood = useMemo(() => woodTexture(), []);
  const tag = useMemo(() => chalkTagTexture(product.name, `${formatBRL(product.priceCents)} / ${product.unit}`), [product]);
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return;
    e.stopPropagation();
    onPick(product);
  };
  const w = CRATE.width;
  const d = CRATE.depth;
  const h = CRATE.height;
  const t = 0.02;
  // Frente e fundo do cesto (as laterais vêm logo abaixo).
  const sides: [number, number, number, number, number][] = [
    [0, h / 2, d / 2 - t / 2, w, t],
    [0, h / 2, -d / 2 + t / 2, w, t],
  ];
  return (
    <group position={[x, 0.04, z]}>
      <mesh position={[0, t / 2, 0]} onClick={pick}>
        <boxGeometry args={[w, t, d]} />
        <meshStandardMaterial map={wood} roughness={0.8} />
      </mesh>
      {sides.map(([sx, sy, sz, sw, st], i) => (
        <mesh key={i} position={[sx, sy, sz]} onClick={pick}>
          <boxGeometry args={[sw, h, st]} />
          <meshStandardMaterial map={wood} roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (w - t)) / 2, h / 2, 0]} onClick={pick}>
          <boxGeometry args={[t, h, d]} />
          <meshStandardMaterial map={wood} roughness={0.8} />
        </mesh>
      ))}
      <Pile product={product} seed={seed} onPick={pick} />
      {/* Plaquinha de preço espetada na frente do cesto */}
      <group position={[0, h + 0.09, d / 2 + 0.01]} rotation={[-0.25, 0, 0]}>
        <mesh onClick={pick}>
          <planeGeometry args={[0.34, 0.17]} />
          <meshStandardMaterial map={tag} roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

export function ProduceSection({
  tables,
  products,
  onPick,
}: {
  tables: ProduceTable[];
  products: Map<string, Product>;
  onPick: (p: Product) => void;
}) {
  const wood = useMemo(() => woodTexture(), []);
  return (
    <group>
      {tables.map((t, ti) => (
        <group key={ti} position={[t.x, 0, t.z]}>
          {/* Pernas e saia da banca */}
          <mesh position={[0, TABLE.height / 2 - 0.05, 0]}>
            <boxGeometry args={[TABLE.width - 0.1, TABLE.height - 0.1, TABLE.depth - 0.1]} />
            <meshStandardMaterial map={wood} color="#9c7a52" roughness={0.85} />
          </mesh>
          {/* Tampo inclinado para a frente, com os cestos */}
          <group position={[0, TABLE.height, 0]} rotation={[TILT, 0, 0]}>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[TABLE.width, 0.04, TABLE.depth]} />
              <meshStandardMaterial map={wood} roughness={0.75} />
            </mesh>
            {t.crates.map((c, ci) => {
              const p = products.get(c.productId);
              if (!p) return null;
              return <CrateMesh key={c.productId} product={p} x={c.x - t.x} z={0} seed={ti * 31 + ci * 7 + 3} onPick={onPick} />;
            })}
          </group>
        </group>
      ))}
    </group>
  );
}
