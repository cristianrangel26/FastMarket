"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { XR, XROrigin, useXR, useXRControllerLocomotion, type XRStore } from "@react-three/xr";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { formatBRL, type Product, type Store } from "@mercado/shared";
import { GONDOLA, SHELF_HEIGHTS, SLOT_WIDTH, collide, type StoreLayout } from "@/lib/store-layout";
import { brandColor, floorTexture, packTexture, priceTagTexture, signTexture } from "./textures";

/** Direção pedida pelo joystick, de -1 a 1. Mutável de propósito: é lida a cada quadro. */
export class MoveInput {
  forward = 0;
  strafe = 0;
  set(forward: number, strafe: number) {
    this.forward = forward;
    this.strafe = strafe;
  }
}

interface SceneProps {
  store: Store;
  layout: StoreLayout;
  products: Map<string, Product>;
  move: MoveInput;
  onPick: (product: Product) => void;
  onCheckout: () => void;
  xr: XRStore;
  /** Produto escolhido; nos óculos aparece um painel 3D em vez da janela da página. */
  picked: Product | null;
  pickedQuantity: number;
  onAdd: (product: Product) => void;
  onClosePicked: () => void;
}

const EYE_HEIGHT = 1.6;
const SPEED = 2.6; // m/s, passo de quem empurra um carrinho
const CEILING = 3.6;

export function StoreScene(props: SceneProps) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.75]}
      camera={{ fov: 70, near: 0.05, far: 80, position: [props.layout.entrance.x, EYE_HEIGHT, props.layout.entrance.z] }}
      gl={{ antialias: true }}
      style={{ touchAction: "none" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <XR store={props.xr}>
      <color attach="background" args={["#f3f1ec"]} />
      <fog attach="fog" args={["#f3f1ec", 18, 45]} />
      <Lights layout={props.layout} />
      <Room store={props.store} layout={props.layout} />
      {props.layout.gondolas.map((g) => (
        <GondolaMesh key={g.category.id} gondola={g} products={props.products} onPick={props.onPick} />
      ))}
      <Checkout layout={props.layout} onCheckout={props.onCheckout} />
      <PlayerControls layout={props.layout} move={props.move} />
      <VRPlayer layout={props.layout} />
      {props.picked && (
        <VRProductPanel
          key={props.picked.id}
          product={props.picked}
          quantity={props.pickedQuantity}
          onAdd={props.onAdd}
          onClose={props.onClosePicked}
        />
      )}
      </XR>
    </Canvas>
  );
}

function Lights({ layout }: { layout: StoreLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const panels: [number, number][] = [];
  for (let x = minX + 2; x < maxX - 1; x += 3.5) for (let z = minZ + 2; z < maxZ - 1; z += 4) panels.push([x, z]);
  return (
    <>
      <hemisphereLight args={["#ffffff", "#d8d2c4", 1.1]} />
      <directionalLight position={[4, 10, 6]} intensity={0.9} />
      {panels.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, CEILING - 0.01, z]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 0.4]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}
      {/* Reflexos suaves sem baixar nenhum arquivo de ambiente. */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer intensity={0.6} position={[0, 2, 10]} scale={[20, 4, 1]} />
        <Lightformer intensity={0.6} position={[0, 2, -10]} rotation-y={Math.PI} scale={[20, 4, 1]} />
      </Environment>
    </>
  );
}

function Room({ store, layout }: { store: Store; layout: StoreLayout }) {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const floor = useMemo(() => {
    const t = floorTexture().clone();
    t.repeat.set(w / 1.2, d / 1.2);
    t.needsUpdate = true;
    return t;
  }, [w, d]);
  const banner = useMemo(() => signTexture(store.logoUrl && store.logoUrl.length <= 4 ? store.logoUrl : "🛒", store.name), [store]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={floor} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, CEILING, cz]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#e9e7e2" />
      </mesh>
      {/* Paredes */}
      <Wall position={[cx, CEILING / 2, minZ]} size={[w, CEILING]} rotationY={0} color="#f6f3ea" />
      <Wall position={[cx, CEILING / 2, maxZ]} size={[w, CEILING]} rotationY={Math.PI} color="#f6f3ea" />
      <Wall position={[minX, CEILING / 2, cz]} size={[d, CEILING]} rotationY={Math.PI / 2} color="#eef3ec" />
      <Wall position={[maxX, CEILING / 2, cz]} size={[d, CEILING]} rotationY={-Math.PI / 2} color="#eef3ec" />
      {/* Faixa verde na base das paredes */}
      <mesh position={[cx, 0.25, minZ + 0.01]}>
        <planeGeometry args={[w, 0.5]} />
        <meshStandardMaterial color="#0f9d58" />
      </mesh>
      <mesh position={[cx, 2.7, minZ + 0.02]}>
        <planeGeometry args={[4.2, 1.3]} />
        <meshBasicMaterial map={banner} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Wall({ position, size, rotationY, color }: { position: [number, number, number]; size: [number, number]; rotationY: number; color: string }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

const boxGeo = new THREE.BoxGeometry(0.22, 0.3, 0.16);
const bottleGeo = new THREE.CylinderGeometry(0.075, 0.085, 0.32, 20);
const bagGeo = new THREE.BoxGeometry(0.26, 0.24, 0.12);
const tagGeo = new THREE.PlaneGeometry(0.26, 0.1);

function geometryFor(p: Product): THREE.BufferGeometry {
  if (p.unit === "l" || p.unit === "ml") return bottleGeo;
  if (p.unit === "kg" || p.unit === "g") return bagGeo;
  return boxGeo;
}

function heightOf(geo: THREE.BufferGeometry): number {
  geo.computeBoundingBox();
  return geo.boundingBox!.max.y - geo.boundingBox!.min.y;
}

const GondolaMesh = memo(function GondolaMesh({
  gondola,
  products,
  onPick,
}: {
  gondola: StoreLayout["gondolas"][number];
  products: Map<string, Product>;
  onPick: (p: Product) => void;
}) {
  const accent = brandColor(gondola.category.name);
  const sign = useMemo(() => signTexture(gondola.category.emoji, gondola.category.name, accent), [gondola.category, accent]);

  // Materiais por produto (frente com a embalagem, laterais na cor da marca).
  const materials = useMemo(() => {
    const m = new Map<string, THREE.Material | THREE.Material[]>();
    for (const id of new Set(gondola.slots.map((s) => s.productId))) {
      const p = products.get(id);
      if (!p) continue;
      const front = new THREE.MeshStandardMaterial({ map: packTexture(p), roughness: 0.45 });
      const side = new THREE.MeshStandardMaterial({ color: brandColor(p.name), roughness: 0.5 });
      if (p.unit === "l" || p.unit === "ml") m.set(id, [front, side, side]);
      // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z (frente), -z
      else m.set(id, [side, side, side, side, front, side]);
    }
    return m;
  }, [gondola.slots, products]);

  // Etiqueta de preço só na primeira frente de cada produto em cada prateleira.
  const tags = useMemo(() => {
    return gondola.slots.filter((s, i, all) => {
      const prev = all[i - 1];
      return !prev || prev.productId !== s.productId || prev.y !== s.y || prev.facing !== s.facing;
    });
  }, [gondola.slots]);

  function pick(e: ThreeEvent<MouseEvent>, id: string) {
    // Arrastar para olhar também solta um clique; só conta toque curto.
    if (e.delta > 8) return;
    e.stopPropagation();
    const p = products.get(id);
    if (p) onPick(p);
  }

  return (
    <group>
      {/* Estrutura */}
      <mesh position={[gondola.x, GONDOLA.height / 2, 0]}>
        <boxGeometry args={[0.06, GONDOLA.height, GONDOLA.length]} />
        <meshStandardMaterial color="#d9dde2" metalness={0.3} roughness={0.5} />
      </mesh>
      <mesh position={[gondola.x, 0.05, 0]}>
        <boxGeometry args={[GONDOLA.depth, 0.1, GONDOLA.length]} />
        <meshStandardMaterial color="#3d4650" />
      </mesh>
      {SHELF_HEIGHTS.map((y) => (
        <mesh key={y} position={[gondola.x, y - 0.015, 0]}>
          <boxGeometry args={[GONDOLA.depth, 0.03, GONDOLA.length]} />
          <meshStandardMaterial color="#eef0f2" metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
      {[GONDOLA.length / 2, -GONDOLA.length / 2].map((z) => (
        <mesh key={z} position={[gondola.x, GONDOLA.height / 2, z]}>
          <boxGeometry args={[GONDOLA.depth + 0.04, GONDOLA.height, 0.05]} />
          <meshStandardMaterial color={accent} roughness={0.6} />
        </mesh>
      ))}
      {/* Placas da categoria: na ponta do corredor e no meio, legíveis dos dois lados */}
      <Sign map={sign} position={[gondola.x, 2.75, GONDOLA.length / 2 - 0.4]} rotationY={0} size={[1.8, 0.56]} />
      <Sign map={sign} position={[gondola.x, 2.75, 0]} rotationY={Math.PI / 2} size={[1.8, 0.56]} />

      {/* Produtos */}
      {gondola.slots.map((s, i) => {
        const p = products.get(s.productId);
        if (!p) return null;
        const geo = geometryFor(p);
        return (
          <mesh
            key={i}
            geometry={geo}
            material={materials.get(p.id)}
            position={[s.x, s.y + heightOf(geo) / 2 + 0.002, s.z]}
            rotation={[0, (s.facing * Math.PI) / 2, 0]}
            onClick={(e) => pick(e, p.id)}
            onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = ""; }}
          />
        );
      })}
      {tags.map((s, i) => {
        const p = products.get(s.productId)!;
        return (
          <mesh
            key={`t${i}`}
            geometry={tagGeo}
            position={[s.x + s.facing * 0.157, s.y - 0.05, s.z - SLOT_WIDTH / 2 + 0.14]}
            rotation={[0, (s.facing * Math.PI) / 2, 0]}
            onClick={(e) => pick(e, p.id)}
          >
            <meshBasicMaterial map={priceTagTexture(p)} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
});

/** Placa pendurada: duas faces costas com costas, para o texto nunca aparecer espelhado. */
function Sign({ map, position, rotationY, size }: { map: THREE.Texture; position: [number, number, number]; rotationY: number; size: [number, number] }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[0, Math.PI].map((r) => (
        <mesh key={r} rotation={[0, r, 0]} position={[0, 0, r ? -0.005 : 0.005]}>
          <planeGeometry args={size} />
          <meshBasicMaterial map={map} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function Checkout({ layout, onCheckout }: { layout: StoreLayout; onCheckout: () => void }) {
  const sign = useMemo(() => signTexture("💳", "Caixa", "#6d4aff"), []);
  const { x, z } = layout.checkout;
  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        if (e.delta > 8) return;
        e.stopPropagation();
        onCheckout();
      }}
    >
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.8, 0.9, 2.2]} />
        <meshStandardMaterial color="#2f3640" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.91, 0]}>
        <boxGeometry args={[0.7, 0.02, 2.1]} />
        <meshStandardMaterial color="#111" roughness={0.8} />
      </mesh>
      <mesh position={[0.1, 1.15, -0.8]}>
        <boxGeometry args={[0.3, 0.25, 0.05]} />
        <meshStandardMaterial color="#222" emissive="#3a86ff" emissiveIntensity={0.4} />
      </mesh>
      <Sign map={sign} position={[0, 2.3, 0]} rotationY={Math.PI / 2} size={[1.4, 0.44]} />
    </group>
  );
}

/**
 * Câmera em primeira pessoa: arrastar para olhar (mouse ou dedo), WASD/setas
 * ou joystick para andar. Colisão com gôndolas e paredes.
 */
function PlayerControls({ layout, move }: { layout: StoreLayout; move: MoveInput }) {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: 0, pitch: -0.05 });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const el = gl.domElement;
    const drag = { id: -1, x: 0, y: 0 };
    const down = (e: PointerEvent) => Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY });
    const moveFn = (e: PointerEvent) => {
      if (drag.id !== e.pointerId) return;
      const sensitivity = e.pointerType === "touch" ? 0.006 : 0.004;
      look.current.yaw -= (e.clientX - drag.x) * sensitivity;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch - (e.clientY - drag.y) * sensitivity, -1.1, 0.9);
      Object.assign(drag, { x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      if (drag.id === e.pointerId) drag.id = -1;
    };
    const kd = (e: KeyboardEvent) => keys.current.add(e.key.toLowerCase());
    const ku = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", moveFn);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", moveFn);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [gl]);

  const inXR = useXR((x) => x.session != null);

  useFrame((_, dt) => {
    if (inXR) return; // Nos óculos quem move a câmera é o próprio headset.
    const k = keys.current;
    const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + move.forward;
    const strafe = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + move.strafe;
    const { yaw, pitch } = look.current;
    const step = Math.min(dt, 0.05) * SPEED;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const nx = camera.position.x + (-sin * forward + cos * strafe) * step;
    const nz = camera.position.z + (-cos * forward - sin * strafe) * step;
    const p = collide(layout, nx, nz);
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  });

  return null;
}

/** Nos óculos: anda com o analógico esquerdo e gira com o direito, com a mesma colisão. */
function VRPlayer({ layout }: { layout: StoreLayout }) {
  const origin = useRef<THREE.Group>(null);
  useXRControllerLocomotion(
    (velocity, rotationVelocityY, dt) => {
      const o = origin.current;
      if (!o) return;
      o.rotation.y += rotationVelocityY * dt;
      const p = collide(layout, o.position.x + velocity.x * dt, o.position.z + velocity.z * dt);
      o.position.set(p.x, 0, p.z);
    },
    { speed: SPEED },
  );
  return <XROrigin ref={origin} position={[layout.entrance.x, 0, layout.entrance.z]} />;
}

function panelTexture(p: Product, quantity: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 320;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 320, 32);
  ctx.fill();
  ctx.fillStyle = "#14201a";
  ctx.textBaseline = "top";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.fillText(p.name, 28, 28, 456);
  ctx.fillStyle = "#5d6b63";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText(p.description || `${p.stock} em estoque`, 28, 76, 456);
  ctx.fillStyle = "#0b7a44";
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.fillText(formatBRL(p.priceCents), 28, 118);
  ctx.fillStyle = "#14201a";
  ctx.font = "26px system-ui, sans-serif";
  ctx.fillText(quantity > 0 ? `${quantity} no carrinho` : "Ainda não está no carrinho", 28, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Painel flutuante com o produto, à frente de quem está de óculos. */
function VRProductPanel({ product, quantity, onAdd, onClose }: { product: Product; quantity: number; onAdd: (p: Product) => void; onClose: () => void }) {
  const inXR = useXR((x) => x.session != null);
  const camera = useThree((st) => st.camera);
  // Posição fixada no momento da escolha, 1 m à frente do olhar.
  const [placement] = useState(() => {
    const pos = new THREE.Vector3();
    const dir = new THREE.Vector3();
    camera.getWorldPosition(pos);
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    return { position: pos.add(dir.multiplyScalar(0.9)).setY(pos.y - 0.15), rotationY: Math.atan2(-dir.x, -dir.z) };
  });
  const tex = useMemo(() => panelTexture(product, quantity), [product, quantity]);
  const addTex = useMemo(() => signTexture("🛒", "Adicionar", "#0f9d58"), []);
  const closeTex = useMemo(() => signTexture("✕", "Fechar", "#5d6b63"), []);
  useEffect(() => () => tex.dispose(), [tex]);
  if (!inXR) return null;
  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      <mesh>
        <planeGeometry args={[0.6, 0.375]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[-0.13, -0.24, 0.01]} onClick={(e) => { e.stopPropagation(); onAdd(product); }}>
        <planeGeometry args={[0.3, 0.094]} />
        <meshBasicMaterial map={addTex} transparent toneMapped={false} />
      </mesh>
      <mesh position={[0.18, -0.24, 0.01]} onClick={(e) => { e.stopPropagation(); onClose(); }}>
        <planeGeometry args={[0.22, 0.069]} />
        <meshBasicMaterial map={closeTex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

