"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, MeshReflectorMaterial } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { XR, XROrigin, useXR, useXRControllerLocomotion, type XRStore } from "@react-three/xr";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { formatBRL, type Product, type Store } from "@mercado/shared";
import { collide, type StoreLayout } from "@/lib/store-layout";
import { CEILING, Carts, CeilingLights, CheckoutLanes, CoolerMesh, GondolaMesh, StoreBanner, Storefront, ceilingLightPositions } from "./fixtures";
import { Sign } from "./parts";
import { ProduceSection } from "./produce";
import { ceilingTexture, signTexture, tileTexture } from "./textures";
import type { Navigator } from "./navigator";

/** Direção pedida pelo joystick, de -1 a 1. Mutável de propósito: é lida a cada quadro. */
export class MoveInput {
  forward = 0;
  strafe = 0;
  set(forward: number, strafe: number) {
    this.forward = forward;
    this.strafe = strafe;
  }
}

export type Quality = "alta" | "leve";

interface SceneProps {
  store: Store;
  layout: StoreLayout;
  products: Map<string, Product>;
  move: MoveInput;
  nav: Navigator;
  /** Onde a pessoa começa (a entrada, ou a seção pedida no link). */
  start: { x: number; z: number; yaw: number };
  /** "alta": sombras, reflexo no piso e efeitos de câmera; "leve": para celulares mais simples. */
  quality: Quality;
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

export function StoreScene(props: SceneProps) {
  const high = props.quality === "alta";
  // Alguns produtos embalados da loja, na esteira do caixa.
  const beltProducts = useMemo(
    () => props.layout.gondolas.flatMap((g) => g.endcap.slice(0, 1)).map((s) => props.products.get(s.productId)).filter((p): p is Product => !!p),
    [props.layout, props.products],
  );
  return (
    <Canvas
      key={props.quality}
      shadows={high ? "soft" : false}
      dpr={high ? [1, 2] : [1, 1.5]}
      camera={{ fov: 62, near: 0.05, far: 80, position: [props.start.x, EYE_HEIGHT, props.start.z] }}
      gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
      style={{ touchAction: "none" }}
    >
      <XR store={props.xr}>
      <color attach="background" args={["#f3f1ec"]} />
      <fog attach="fog" args={["#efece6", 22, 60]} />
      <Lights layout={props.layout} shadows={high} />
      <Room layout={props.layout} reflections={high} />
      <StoreBanner store={props.store} layout={props.layout} />
      <CeilingLights layout={props.layout} />
      <Storefront layout={props.layout} />
      {props.layout.gondolas.map((g) => (
        <GondolaMesh key={g.category.id} gondola={g} products={props.products} onPick={props.onPick} />
      ))}
      {props.layout.coolers.map((c) => (
        <CoolerMesh key={c.category.id} cooler={c} products={props.products} onPick={props.onPick} />
      ))}
      {props.layout.produce && (
        <>
          <ProduceSection tables={props.layout.produce.tables} products={props.products} onPick={props.onPick} />
          <Sign
            map={signTexture(props.layout.produce.category.emoji, props.layout.produce.category.name, "#2e7d32")}
            position={[0, 2.85, props.layout.produce.tables[0].z]}
            rotationY={0}
            size={[2.2, 0.69]}
            glow={1.1}
          />
        </>
      )}
      <Carts carts={props.layout.carts} />
      <CheckoutLanes layout={props.layout} products={beltProducts} onCheckout={props.onCheckout} />
      <PlayerControls layout={props.layout} move={props.move} nav={props.nav} startYaw={props.start.yaw} />
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
      <Effects quality={props.quality} />
      </XR>
    </Canvas>
  );
}

/**
 * Luz de mercado: forro cheio de luminárias. O reflexo (ambiente) é gerado com
 * retângulos de luz nas mesmas posições das luminárias, e uma luz de cima faz
 * as sombras das prateleiras sobre os produtos.
 */
function Lights({ layout, shadows }: { layout: StoreLayout; shadows: boolean }) {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const half = Math.max(maxX - minX, maxZ - minZ) / 2 + 1;
  const lights = useMemo(() => ceilingLightPositions(layout), [layout]);
  const [target] = useState(() => new THREE.Object3D());
  return (
    <>
      <hemisphereLight args={["#ffffff", "#bfb6a6", 0.35]} />
      <primitive object={target} position={[cx, 0, cz]} />
      <directionalLight
        position={[cx + 3, 14, cz + 5]}
        target={target}
        intensity={1.5}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-radius={6}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={1}
        shadow-camera-far={30}
      />
      {shadows && <StaticShadows />}
      <Environment resolution={256} frames={1} environmentIntensity={0.6}>
        <color attach="background" args={["#d9d4ca"]} />
        {lights.map(([x, z]) => (
          <Lightformer key={`${x}:${z}`} form="rect" intensity={4} position={[x - cx, CEILING - 1.6, z - cz]} rotation-x={Math.PI / 2} scale={[1.2, 0.6, 1]} />
        ))}
        <Lightformer intensity={0.8} position={[0, 1.5, half]} rotation-y={Math.PI} scale={[half * 2, 3, 1]} color="#fff8ee" />
        <Lightformer intensity={0.5} position={[0, 1.5, -half]} scale={[half * 2, 3, 1]} />
      </Environment>
    </>
  );
}

/** A loja é estática: calcula as sombras nos primeiros quadros e depois só reaproveita. */
function StaticShadows() {
  const frames = useRef(0);
  useFrame(({ gl }) => {
    // Alguns quadros a mais, para pegar os produtos que entram depois.
    if (frames.current > 30) return;
    frames.current++;
    setShadowRefresh(gl);
  });
  return null;
}

function setShadowRefresh(gl: THREE.WebGLRenderer) {
  gl.shadowMap.autoUpdate = false;
  gl.shadowMap.needsUpdate = true;
}

/** Oclusão de ambiente, brilho das luzes, cores naturais e antisserrilhado. Desligado nos óculos. */
function Effects({ quality }: { quality: Quality }) {
  const inXR = useXR((x) => x.session != null);
  if (inXR) return null;
  const high = quality === "alta";
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={1.2} distanceFalloff={0.5} intensity={high ? 4 : 3} quality={high ? "high" : "performance"} halfRes={!high} />
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.2} intensity={high ? 0.45 : 0.3} mipmapBlur />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.35} darkness={0.35} />
      <SMAA />
    </EffectComposer>
  );
}

function Room({ layout, reflections }: { layout: StoreLayout; reflections: boolean }) {
  const { minX, maxX, minZ, maxZ } = layout.bounds;
  const w = maxX - minX;
  const d = maxZ - minZ;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const floor = useMemo(() => {
    const t = tileTexture().clone();
    t.repeat.set(w / 1.2, d / 1.2);
    t.needsUpdate = true;
    return t;
  }, [w, d]);
  const ceiling = useMemo(() => {
    const t = ceilingTexture().clone();
    t.repeat.set(w / 0.625, d / 0.625);
    t.needsUpdate = true;
    return t;
  }, [w, d]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
        <planeGeometry args={[w, d]} />
        {reflections ? (
          <MeshReflectorMaterial
            map={floor}
            mirror={0}
            blur={[600, 200]}
            resolution={1024}
            mixBlur={1.5}
            mixStrength={0.35}
            mixContrast={1}
            depthScale={1}
            minDepthThreshold={0.6}
            maxDepthThreshold={1.4}
            roughness={0.45}
            metalness={0}
          />
        ) : (
          <meshStandardMaterial map={floor} roughness={0.22} metalness={0.02} />
        )}
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[cx, CEILING, cz]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial map={ceiling} color="#f4f3ef" roughness={0.95} />
      </mesh>
      {/* Paredes: fundo e laterais (a frente é a fachada de vidro) */}
      <Wall position={[cx, CEILING / 2, minZ]} size={[w, CEILING]} rotationY={0} />
      <Wall position={[minX, CEILING / 2, cz]} size={[d, CEILING]} rotationY={Math.PI / 2} />
      <Wall position={[maxX, CEILING / 2, cz]} size={[d, CEILING]} rotationY={-Math.PI / 2} />
    </group>
  );
}

function Wall({ position, size, rotationY }: { position: [number, number, number]; size: [number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial color="#f5f2ea" roughness={0.92} />
      </mesh>
      {/* Barrado mais escuro e rodapé, que sujam menos */}
      <mesh position={[0, -size[1] / 2 + 0.6, 0.005]} receiveShadow>
        <planeGeometry args={[size[0], 1.2]} />
        <meshStandardMaterial color="#d9e4dc" roughness={0.6} />
      </mesh>
      <mesh position={[0, -size[1] / 2 + 0.06, 0.012]}>
        <planeGeometry args={[size[0], 0.12]} />
        <meshStandardMaterial color="#2f6b4a" roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Câmera em primeira pessoa: arrastar para olhar (mouse ou dedo), WASD/setas
 * ou joystick para andar. Colisão com gôndolas e paredes.
 */
function PlayerControls({ layout, move, nav, startYaw }: { layout: StoreLayout; move: MoveInput; nav: Navigator; startYaw: number }) {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: startYaw, pitch: -0.08 });
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const el = gl.domElement;
    const drag = { id: -1, x: 0, y: 0 };
    const down = (e: PointerEvent) => Object.assign(drag, { id: e.pointerId, x: e.clientX, y: e.clientY });
    const dragged = () => nav.cancel();
    const moveFn = (e: PointerEvent) => {
      if (drag.id !== e.pointerId) return;
      const sensitivity = e.pointerType === "touch" ? 0.006 : 0.004;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 2) dragged();
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
  }, [gl, nav]);

  const inXR = useXR((x) => x.session != null);

  useFrame((_, dt) => {
    if (inXR) return; // Nos óculos quem move a câmera é o próprio headset.
    const k = keys.current;
    const forward = (k.has("w") || k.has("arrowup") ? 1 : 0) - (k.has("s") || k.has("arrowdown") ? 1 : 0) + move.forward;
    const strafe = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0) + move.strafe;
    const t = Math.min(dt, 0.05);
    if (forward || strafe) nav.cancel();

    // Navegação fácil: segue o caminho, depois vira para a seção.
    const lk = look.current;
    const start = nav.step({ x: camera.position.x, z: camera.position.z }, lk, t);

    const { yaw, pitch } = lk;
    const step = t * SPEED;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const nx = start.x + (-sin * forward + cos * strafe) * step;
    const nz = start.z + (-cos * forward - sin * strafe) * step;
    const p = collide(layout, nx, nz);
    camera.position.set(p.x, EYE_HEIGHT, p.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    nav.track(p, yaw);
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

