import type { Store, TimeSlot } from "./types";

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Gera as próximas janelas de entrega/retirada a partir dos horários da loja.
 * Os horários são interpretados no fuso local de `now`.
 */
export function availableSlots(
  store: Pick<Store, "hours" | "slotMinutes" | "prepMinutes">,
  now: Date,
  days = 2,
): TimeSlot[] {
  const earliest = now.getTime() + store.prepMinutes * 60_000;
  const slots: TimeSlot[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    for (const h of store.hours.filter((x) => x.weekday === day.getDay())) {
      const close = minutesOf(h.closes);
      for (let m = minutesOf(h.opens); m + store.slotMinutes <= close; m += store.slotMinutes) {
        const start = new Date(day.getTime() + m * 60_000);
        if (start.getTime() < earliest) continue;
        const end = new Date(start.getTime() + store.slotMinutes * 60_000);
        slots.push({ start: start.toISOString(), end: end.toISOString() });
      }
    }
  }
  return slots;
}
