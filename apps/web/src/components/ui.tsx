import type { OrderStatus } from "@mercado/shared";
import { ORDER_STATUS_LABEL } from "@mercado/shared";

/** No modo demonstração a imagem do produto/loja é um emoji. */
export function Thumb({ src, alt, size = "md" }: { src: string | null; alt: string; size?: "sm" | "md" | "lg" }) {
  const box = { sm: "h-10 w-10 text-xl", md: "h-16 w-16 text-3xl", lg: "h-20 w-20 text-5xl" }[size];
  if (src && /^https?:\/\//.test(src)) {
    return <img src={src} alt={alt} className={`${box} rounded-xl object-cover`} />;
  }
  return (
    <span role="img" aria-label={alt} className={`${box} flex shrink-0 items-center justify-center rounded-xl bg-surface-2`}>
      {src ?? "🛍️"}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  awaiting_payment: "bg-warning-soft text-warning",
  received: "bg-primary-soft text-primary-strong",
  picking: "bg-primary-soft text-primary-strong",
  ready_for_pickup: "bg-primary text-on-primary",
  out_for_delivery: "bg-primary text-on-primary",
  completed: "bg-surface-2 text-muted",
  cancelled: "bg-danger-soft text-danger",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`badge ${STATUS_TONE[status]}`}>{ORDER_STATUS_LABEL[status]}</span>;
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="text-5xl" aria-hidden>{emoji}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function formatSlot(slot: { start: string; end: string }): string {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const day =
    start.toDateString() === today.toDateString()
      ? "Hoje"
      : start.toDateString() === tomorrow.toDateString()
        ? "Amanhã"
        : start.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
  const t = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day}, ${t(start)}–${t(end)}`;
}
