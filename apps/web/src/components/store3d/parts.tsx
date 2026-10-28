"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Product } from "@mercado/shared";
import type { Slot } from "@/lib/store-layout";
import { packageParts } from "./packaging";
import { priceTagTexture } from "./textures";

// Peças usadas por gôndolas, pontas de gôndola e balcões refrigerados.

export type PickHandler = (e: ThreeEvent<MouseEvent>, productId: string) => void;

/** Todas as unidades de um produto, desenhadas de uma vez (instancing). */
export function ProductInstances({ product, slots, onPick }: { product: Product; slots: Slot[]; onPick: (e: ThreeEvent<MouseEvent>) => void }) {
  const parts = useMemo(() => packageParts(product), [product]);
  const matrices = useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const one = new THREE.Vector3(1, 1, 1);
    return slots.map((s) => {
      q.setFromAxisAngle(up, s.rotY);
      return m.compose(new THREE.Vector3(s.x, s.y + 0.002, s.z), q, one).clone();
    });
  }, [slots]);
  return (
    <>
      {parts.map((part, i) => (
        <InstancedPart key={i} geometry={part.geometry} material={part.material} matrices={matrices} onPick={onPick} />
      ))}
    </>
  );
}

function InstancedPart({ geometry, material, matrices, onPick }: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  matrices: THREE.Matrix4[];
  onPick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow
      receiveShadow
      onClick={onPick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    />
  );
}

/** Produtos de um conjunto de vagas, agrupados por produto, com as etiquetas de preço. */
export function Merchandise({ slots, products, onPick, tagOffset, depthRows = 1, rowGap = 0.13 }: {
  slots: Slot[];
  products: Map<string, Product>;
  onPick: PickHandler;
  /** Distância da vaga até a beirada da prateleira, onde fica a etiqueta. */
  tagOffset: number;
  /** Fileiras do mesmo produto, uma atrás da outra, para a prateleira parecer funda e cheia. */
  depthRows?: number;
  rowGap?: number;
}) {
  const byProduct = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const sl of slots) {
      const group = m.get(sl.productId) ?? [];
      for (let r = 0; r < depthRows; r++) {
        group.push({ ...sl, x: sl.x - Math.sin(sl.rotY) * rowGap * r, z: sl.z - Math.cos(sl.rotY) * rowGap * r });
      }
      m.set(sl.productId, group);
    }
    return m;
  }, [slots, depthRows, rowGap]);
  // Uma etiqueta na primeira frente de cada produto em cada prateleira.
  const tags = useMemo(
    () => slots.filter((s, i, all) => {
      const prev = all[i - 1];
      return !prev || prev.productId !== s.productId || prev.y !== s.y || prev.rotY !== s.rotY;
    }),
    [slots],
  );
  return (
    <>
      {[...byProduct].map(([id, group]) => {
        const p = products.get(id);
        return p ? <ProductInstances key={id} product={p} slots={group} onPick={(e) => onPick(e, id)} /> : null;
      })}
      {tags.map((s, i) => {
        const p = products.get(s.productId);
        if (!p) return null;
        return (
          <mesh
            key={`t${i}`}
            geometry={tagGeo}
            position={[s.x + Math.sin(s.rotY) * tagOffset, s.y - 0.045, s.z + Math.cos(s.rotY) * tagOffset]}
            rotation={[0, s.rotY, 0]}
            onClick={(e) => onPick(e, p.id)}
          >
            <meshBasicMaterial map={priceTagTexture(p)} toneMapped={false} />
          </mesh>
        );
      })}
    </>
  );
}

const tagGeo = new THREE.PlaneGeometry(0.2, 0.075);

/** Placa pendurada: duas faces costas com costas, para o texto nunca aparecer espelhado. */
export function Sign({ map, position, rotationY, size, glow = 1 }: {
  map: THREE.Texture;
  position: [number, number, number];
  rotationY: number;
  size: [number, number];
  /** Acima de 1 a placa parece iluminada por dentro (e brilha com o bloom). */
  glow?: number;
}) {
  const color = useMemo(() => new THREE.Color(glow, glow, glow), [glow]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[0, Math.PI].map((r) => (
        <mesh key={r} rotation={[0, r, 0]} position={[0, 0, r ? -0.005 : 0.005]}>
          <planeGeometry args={size} />
          <meshBasicMaterial map={map} color={color} transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export interface BoxSpec {
  position: [number, number, number];
  size: [number, number, number];
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

/** Várias caixas com o mesmo material numa só chamada de desenho. */
export function Boxes({ boxes, material, castShadow = true }: { boxes: BoxSpec[]; material: THREE.Material; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    boxes.forEach((b, i) => mesh.setMatrixAt(i, m.compose(new THREE.Vector3(...b.position), q, new THREE.Vector3(...b.size))));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [boxes]);
  if (!boxes.length) return null;
  return <instancedMesh ref={ref} args={[unitBox, material, boxes.length]} castShadow={castShadow} receiveShadow />;
}

/** Materiais compartilhados, criados uma vez. */
export const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 0.85, roughness: 0.32 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: "#4a5058", metalness: 0.6, roughness: 0.45 }),
  shelf: new THREE.MeshStandardMaterial({ color: "#f1f2f4", metalness: 0.35, roughness: 0.4 }),
  priceRail: new THREE.MeshStandardMaterial({ color: "#d3d7dc", metalness: 0.2, roughness: 0.5 }),
  plinth: new THREE.MeshStandardMaterial({ color: "#2b2f34", metalness: 0.3, roughness: 0.6 }),
  white: new THREE.MeshStandardMaterial({ color: "#f4f5f6", roughness: 0.55 }),
  led: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.3), toneMapped: false }),
};
