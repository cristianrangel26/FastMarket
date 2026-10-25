import * as THREE from "three";
import { formatBRL, type Product } from "@mercado/shared";

// Texturas desenhadas em canvas: embalagens, etiquetas de preço, placas e piso.
// Assim a loja funciona com qualquer catálogo, mesmo sem fotos dos produtos.

const cache = new Map<string, THREE.Texture>();

const PALETTE = ["#e63946", "#f4a261", "#2a9d8f", "#264653", "#e9c46a", "#8338ec", "#3a86ff", "#06d6a0", "#ef476f", "#118ab2", "#ff7f11", "#5f0f40"];

function hash(s: string): number {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function brandColor(name: string): string {
  return PALETTE[hash(name) % PALETTE.length];
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function toTexture(key: string, c: HTMLCanvasElement): THREE.Texture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] += "…";
  }
  return lines;
}

const isUrl = (s: string | null): s is string => !!s && /^https?:\/\//.test(s);

/** Frente da embalagem: foto do produto, se houver, ou um rótulo desenhado. */
export function packTexture(p: Product): THREE.Texture {
  const key = `pack:${p.id}:${p.imageUrl}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const [c, ctx] = canvas(256, 320);
  const color = brandColor(p.name);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 320);
  // Faixa clara com brilho, imitando embalagem impressa.
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, "rgba(255,255,255,0.25)");
  g.addColorStop(0.5, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 320);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.roundRect(18, 40, 220, 170, 24);
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (!isUrl(p.imageUrl)) {
    ctx.font = "110px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
    ctx.fillText(p.imageUrl ?? "🛍️", 128, 128);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 26px system-ui, sans-serif";
  wrapText(ctx, p.name, 228, 2).forEach((l, i) => ctx.fillText(l, 128, 242 + i * 30));
  if (p.description) {
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(p.description, 128, 300);
  }
  const tex = toTexture(key, c);

  if (isUrl(p.imageUrl)) {
    // Foto real da embalagem: ocupa a frente inteira, sobre fundo branco.
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 256, 320);
      const scale = Math.min(256 / img.width, 320 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, 128 - w / 2, 160 - h / 2, w, h);
      tex.needsUpdate = true;
    };
    img.src = p.imageUrl;
  }
  return tex;
}

export function priceTagTexture(p: Product): THREE.Texture {
  const key = `price:${p.id}:${p.priceCents}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(256, 96);
  ctx.fillStyle = "#ffe14d";
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = "#111";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(wrapText(ctx, p.name, 236, 1)[0], 10, 22);
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.fillText(formatBRL(p.priceCents), 10, 64);
  return toTexture(key, c);
}

export function signTexture(emoji: string, title: string, bg = "#0f9d58"): THREE.Texture {
  const key = `sign:${emoji}:${title}:${bg}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(512, 160);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, 512, 160, 28);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 60px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
  ctx.fillText(`${emoji} ${title}`, 256, 84, 480);
  return toTexture(key, c);
}

export function floorTexture(): THREE.Texture {
  const key = "floor";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = "#e9e6df";
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = "#dcd8cf";
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillRect(128, 128, 128, 128);
  ctx.strokeStyle = "#c9c4b8";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.strokeRect(0, 0, 128, 128);
  ctx.strokeRect(128, 128, 128, 128);
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function woodTexture(): THREE.Texture {
  const key = "wood";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = "#b8895a";
  ctx.fillRect(0, 0, 256, 256);
  // Tábuas com veios
  for (let plank = 0; plank < 4; plank++) {
    const y = plank * 64;
    ctx.fillStyle = plank % 2 ? "#ad7f50" : "#c09264";
    ctx.fillRect(0, y, 256, 62);
    ctx.strokeStyle = "rgba(90,55,25,0.25)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      const yy = y + 6 + i * 6 + Math.sin(i * 3 + plank) * 2;
      ctx.moveTo(0, yy);
      for (let x = 0; x <= 256; x += 16) ctx.lineTo(x, yy + Math.sin(x / 30 + i + plank * 2) * 2.5);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(60,35,15,0.45)";
    ctx.fillRect(0, y + 62, 256, 2);
  }
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Plaquinha de lousa com giz, como as do hortifrúti. */
export function chalkTagTexture(name: string, price: string): THREE.Texture {
  const key = `chalk:${name}:${price}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(320, 160);
  ctx.fillStyle = "#8a5a2b";
  ctx.fillRect(0, 0, 320, 160);
  ctx.fillStyle = "#26302b";
  ctx.fillRect(10, 10, 300, 140);
  ctx.fillStyle = "#f4f1e8";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "italic 28px 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
  ctx.fillText(wrapText(ctx, name, 280, 1)[0], 160, 52);
  ctx.font = "bold 42px 'Comic Sans MS', 'Segoe Print', cursive, sans-serif";
  ctx.fillStyle = "#ffe36b";
  ctx.fillText(price, 160, 108, 290);
  return toTexture(key, c);
}

/** Forro de teto em placas. */
export function ceilingTexture(): THREE.Texture {
  const key = "ceiling";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = "#f1f0ec";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#cfcac0";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, 128, 128);
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Mancha escura e suave para fingir a sombra de contato sob os móveis. */
export function shadowTexture(): THREE.Texture {
  const key = "shadow";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(key, c);
}
