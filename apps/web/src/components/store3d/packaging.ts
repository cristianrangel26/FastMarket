import * as THREE from "three";
import type { Product } from "@mercado/shared";
import { brandColor, packTexture } from "./textures";

// Formato 3D de cada embalagem, escolhido pelo nome e pela unidade do produto.
// Todas as peças têm a base em y = 0 e a frente virada para +z.

export interface PackagePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

type Shape = "bottle" | "carton" | "pouch" | "flat" | "box" | "can";

function shapeFor(p: Product): Shape {
  const n = p.name.toLowerCase();
  if (/leite|suco|creme de leite|bebida l[aá]ctea/.test(n) && (p.unit === "l" || p.unit === "ml" || /\bl\b|litro/.test(p.description))) return "carton";
  if (/lata|cerveja|energ[eé]tico|milho|ervilha|atum|sardinha|extrato/.test(n)) return "can";
  if (p.unit === "l" || p.unit === "ml" || /refrigerante|[aá]gua|[oó]leo|azeite|detergente|kombucha|vinagre|amaciante|shampoo/.test(n)) return "bottle";
  if (/ovos|queijo.*fatiado|presunto|bandeja/.test(n)) return "flat";
  if (/arroz|feij[aã]o|a[cç][uú]car|caf[eé]|farinha|macarr[aã]o|granola|sab[aã]o em p[oó]|biscoito|salgadinho|p[aã]o de forma/.test(n) || p.unit === "kg" || p.unit === "g") return "pouch";
  return "box";
}

/** Caixa com a frente e o verso estufados, como um pacote de arroz. */
function pouchGeometry(w: number, h: number, d: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 6, 8, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2);
    const y = p.getY(i) / (h / 2);
    const z = p.getZ(i);
    const bulge = 1 + 0.6 * (1 - x * x) * (1 - y ** 4);
    p.setZ(i, z * bulge);
    // Parte de cima mais fina, onde o pacote é selado.
    if (y > 0.85) p.setZ(i, p.getZ(i) * (1 - (y - 0.85) * 4));
  }
  g.computeVertexNormals();
  return g.translate(0, h / 2, 0);
}

const BOTTLE_PROFILE = [
  [0, 0], [0.04, 0], [0.046, 0.01], [0.046, 0.19], [0.04, 0.23], [0.022, 0.27], [0.015, 0.285], [0.015, 0.3], [0, 0.3],
].map(([x, y]) => new THREE.Vector2(x, y));

const geometries = {
  bottle: new THREE.LatheGeometry(BOTTLE_PROFILE, 24),
  bottleLabel: new THREE.CylinderGeometry(0.0475, 0.0475, 0.11, 24, 1, true, Math.PI, Math.PI * 2).translate(0, 0.11, 0),
  bottleCap: new THREE.CylinderGeometry(0.016, 0.016, 0.022, 16).translate(0, 0.31, 0),
  can: new THREE.CylinderGeometry(0.033, 0.033, 0.12, 24, 1, false, Math.PI, Math.PI * 2).translate(0, 0.06, 0),
  carton: new THREE.BoxGeometry(0.095, 0.2, 0.065).translate(0, 0.1, 0),
  cartonTop: new THREE.CylinderGeometry(0.001, 0.068, 0.03, 4, 1).rotateY(Math.PI / 4).scale(1, 1, 0.68).translate(0, 0.215, 0),
  pouch: pouchGeometry(0.2, 0.27, 0.06),
  flat: new THREE.BoxGeometry(0.26, 0.08, 0.13).translate(0, 0.04, 0),
  box: new THREE.BoxGeometry(0.2, 0.28, 0.07).translate(0, 0.14, 0),
};

const capMaterial = new THREE.MeshStandardMaterial({ color: "#f5f5f5", roughness: 0.4 });
const materialCache = new Map<string, PackagePart[]>();

/** Peças da embalagem; com foto do produto, a frente é a foto inteira. */
export function packageParts(p: Product): PackagePart[] {
  const key = `${p.id}:${p.imageUrl}:${p.name}:${p.unit}`;
  const hit = materialCache.get(key);
  if (hit) return hit;

  const shape = shapeFor(p);
  const front = new THREE.MeshStandardMaterial({ map: packTexture(p), roughness: 0.4 });
  const side = new THREE.MeshStandardMaterial({ color: brandColor(p.name), roughness: 0.45 });
  // Ordem das faces do BoxGeometry: +x, -x, +y, -y, +z (frente), -z
  const boxMaterials = [side, side, side, side, front, side];
  let parts: PackagePart[];
  switch (shape) {
    case "bottle": {
      const clear = /[aá]gua/.test(p.name.toLowerCase());
      const body = new THREE.MeshPhysicalMaterial({
        color: clear ? "#d8eef7" : brandColor(p.name),
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        transparent: clear,
        opacity: clear ? 0.55 : 1,
      });
      parts = [
        { geometry: geometries.bottle, material: body },
        { geometry: geometries.bottleLabel, material: front },
        { geometry: geometries.bottleCap, material: capMaterial },
      ];
      break;
    }
    case "can": {
      const metal = new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 0.8, roughness: 0.3 });
      parts = [{ geometry: geometries.can, material: [front, metal, metal] }];
      break;
    }
    case "carton":
      parts = [
        { geometry: geometries.carton, material: boxMaterials },
        { geometry: geometries.cartonTop, material: side },
      ];
      break;
    case "pouch":
      parts = [{ geometry: geometries.pouch, material: boxMaterials }];
      break;
    case "flat":
      parts = [{ geometry: geometries.flat, material: boxMaterials }];
      break;
    default:
      parts = [{ geometry: geometries.box, material: boxMaterials }];
  }
  materialCache.set(key, parts);
  return parts;
}
