import type { GeoPoint, Store } from "./types";

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function deliversTo(store: Pick<Store, "offersDelivery" | "location" | "deliveryRadiusKm">, point: GeoPoint): boolean {
  return store.offersDelivery && distanceKm(store.location, point) <= store.deliveryRadiusKm;
}
