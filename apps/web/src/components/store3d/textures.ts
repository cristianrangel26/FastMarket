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
  drawPackLabel(ctx, p, color);
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

const EMOJI_FONT = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/** Rótulo no estilo de marca própria de supermercado: faixa da marca, "foto" do produto, nome e peso. */
function drawPackLabel(ctx: CanvasRenderingContext2D, p: Product, color: string) {
  const bg = ctx.createLinearGradient(0, 0, 0, 320);
  bg.addColorStop(0, shade(color, 0.18));
  bg.addColorStop(0.55, color);
  bg.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 320);
  // Faixa diagonal clara, comum em embalagens.
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(0, 210);
  ctx.lineTo(256, 160);
  ctx.lineTo(256, 205);
  ctx.lineTo(0, 255);
  ctx.fill();
  // Selo da marca própria
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(128, 30, 74, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, -0.3);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "italic 900 22px Georgia, 'Times New Roman', serif";
  ctx.fillText("Seleção", 128, 31);
  // "Foto" do produto com brilho atrás
  const glow = ctx.createRadialGradient(128, 118, 8, 128, 118, 92);
  glow.addColorStop(0, "rgba(255,255,255,0.85)");
  glow.addColorStop(0.6, "rgba(255,255,255,0.25)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(20, 30, 216, 180);
  if (!isUrl(p.imageUrl)) {
    ctx.font = `118px ${EMOJI_FONT}`;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;
    ctx.fillText(p.imageUrl ?? "🛍️", 128, 124);
    ctx.shadowColor = "transparent";
  }
  // Nome
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.font = "900 27px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  wrapText(ctx, p.name.toUpperCase(), 232, 2).forEach((l, i, all) => ctx.fillText(l, 128, (all.length > 1 ? 232 : 246) + i * 30, 236));
  ctx.shadowColor = "transparent";
  // Peso, num selo redondo
  if (p.description) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(78, 284, 100, 28, 14);
    ctx.fill();
    ctx.fillStyle = shade(color, -0.4);
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.fillText(p.description, 128, 299, 92);
  }
}

/** Clareia (amount > 0) ou escurece (amount < 0) uma cor #rrggbb. */
function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  if (amount > 0) c.lerp(new THREE.Color("#ffffff"), amount);
  else c.lerp(new THREE.Color("#000000"), -amount);
  return `#${c.getHexString()}`;
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

/** Porcelanato 60 × 60 cm (a textura cobre 1,2 m), com leve variação entre placas. */
export function tileTexture(): THREE.Texture {
  const key = "tile";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(512, 512);
  const tones = ["#dcd7ce", "#d6d1c7", "#dfdad2", "#d9d4ca"];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2) * 256;
    const y = Math.floor(i / 2) * 256;
    ctx.fillStyle = tones[i];
    ctx.fillRect(x, y, 256, 256);
    // Veios bem sutis, como pedra
    for (let k = 0; k < 220; k++) {
      ctx.fillStyle = `rgba(${k % 2 ? "255,255,255" : "120,110,95"},${0.04 + ((k * 37) % 7) / 200})`;
      const px = x + ((k * 97 + i * 31) % 256);
      const py = y + ((k * 53 + i * 71) % 256);
      ctx.fillRect(px, py, 2 + (k % 3), 1 + (k % 2));
    }
  }
  ctx.fillStyle = "#a9a194";
  ctx.fillRect(0, 0, 512, 3);
  ctx.fillRect(0, 255, 512, 3);
  ctx.fillRect(0, 0, 3, 512);
  ctx.fillRect(255, 0, 3, 512);
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Painel perfurado do fundo das gôndolas. */
export function pegboardTexture(): THREE.Texture {
  const key = "pegboard";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = "#e9ebee";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#9aa1a9";
  for (const [x, y] of [[16, 16], [48, 16], [16, 48], [48, 48]]) {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Grade de arame cromado (com transparência) para os carrinhos. */
export function wireTexture(): THREE.Texture {
  const key = "wire";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.strokeStyle = "#e9edf2";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Esteira do caixa: borracha escura com frisos. */
export function conveyorTexture(): THREE.Texture {
  const key = "conveyor";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = "#1d1f22";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#2a2d31";
  for (let y = 0; y < 64; y += 8) ctx.fillRect(0, y, 64, 3);
  const t = toTexture(key, c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Vista da rua pela fachada de vidro: céu claro, prédios e calçada. */
export function outsideTexture(): THREE.Texture {
  const key = "outside";
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(1024, 256);
  const sky = ctx.createLinearGradient(0, 0, 0, 256);
  sky.addColorStop(0, "#9fc8ef");
  sky.addColorStop(0.6, "#e3f0fb");
  sky.addColorStop(1, "#f6f4ef");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 256);
  // Prédios ao longe
  for (let i = 0; i < 18; i++) {
    const w = 40 + ((i * 53) % 50);
    const h = 60 + ((i * 89) % 90);
    const x = i * 58 - 10;
    ctx.fillStyle = ["#c9d3dc", "#d8dee3", "#bfc9d2", "#e1e4e6"][i % 4];
    ctx.fillRect(x, 190 - h, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let wy = 190 - h + 8; wy < 182; wy += 14) for (let wx = x + 6; wx < x + w - 6; wx += 12) ctx.fillRect(wx, wy, 6, 7);
  }
  // Árvores e calçada
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = "#7fae6a";
    ctx.beginPath();
    ctx.arc(60 + i * 115, 178, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#d9d6cf";
  ctx.fillRect(0, 196, 1024, 60);
  ctx.fillStyle = "#c8c4bb";
  ctx.fillRect(0, 196, 1024, 4);
  return toTexture(key, c);
}

/** Cabeceira de ponta de gôndola com a oferta. */
export function promoTexture(title: string): THREE.Texture {
  const key = `promo:${title}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, ctx] = canvas(512, 192);
  ctx.fillStyle = "#e3262f";
  ctx.fillRect(0, 0, 512, 192);
  ctx.fillStyle = "#ffd60a";
  ctx.beginPath();
  ctx.moveTo(0, 120);
  ctx.lineTo(512, 92);
  ctx.lineTo(512, 192);
  ctx.lineTo(0, 192);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 78px 'Arial Black', Arial, sans-serif";
  ctx.fillText("OFERTA", 256, 60);
  ctx.fillStyle = "#b3141c";
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillText(title, 256, 150, 470);
  return toTexture(key, c);
}
