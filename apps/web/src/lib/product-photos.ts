// Busca de fotos de embalagens no Open Food Facts (base aberta, licença CC BY-SA).
// A chamada sai do navegador; a API libera CORS e não pede chave.

export interface PhotoResult {
  name: string;
  brand: string;
  imageUrl: string;
}

const BASE = "https://world.openfoodfacts.org";
const FIELDS = "product_name,product_name_pt,brands,image_front_url,image_url";

interface OffProduct {
  product_name?: string;
  product_name_pt?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
}

function toResult(p: OffProduct): PhotoResult | null {
  const imageUrl = p.image_front_url || p.image_url;
  if (!imageUrl) return null;
  return { name: p.product_name_pt || p.product_name || "", brand: (p.brands ?? "").split(",")[0].trim(), imageUrl };
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Open Food Facts respondeu ${res.status}`);
  return (await res.json()) as T;
}

/** Busca por nome ("café pilão") ou por código de barras (EAN de 8 a 14 dígitos). */
export async function searchPhotos(query: string, signal?: AbortSignal): Promise<PhotoResult[]> {
  const q = query.trim();
  if (!q) return [];
  if (/^\d{8,14}$/.test(q)) {
    const r = await getJson<{ status: number; product?: OffProduct }>(`${BASE}/api/v2/product/${q}.json?fields=${FIELDS}`, signal);
    const one = r.product && toResult(r.product);
    return one ? [one] : [];
  }
  const params = new URLSearchParams({
    search_terms: q,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: "12",
    fields: FIELDS,
    tagtype_0: "countries",
    tag_contains_0: "contains",
    tag_0: "brazil",
  });
  const r = await getJson<{ products?: OffProduct[] }>(`${BASE}/cgi/search.pl?${params}`, signal);
  return (r.products ?? []).map(toResult).filter((x): x is PhotoResult => x !== null);
}

/** Primeira foto encontrada, ou null; nunca lança erro (usado no catálogo de exemplo). */
export async function firstPhoto(query: string, timeoutMs = 8000): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return (await searchPhotos(query, ctrl.signal))[0]?.imageUrl ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const PHOTO_CREDIT = "Fotos: Open Food Facts (CC BY-SA)";
