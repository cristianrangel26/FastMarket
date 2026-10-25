"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, geocode } from "@/lib/app-store";
import { Gate } from "@/components/gate";

export default function NewStorePage() {
  return (
    <Gate back="/painel/nova-loja">
      <NewStoreForm />
    </Gate>
  );
}

const reais = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

function NewStoreForm() {
  const router = useRouter();
  const [f, setF] = useState({
    name: "", description: "", logo: "🏬", address: "", city: "",
    offersDelivery: true, offersPickup: true, radius: "5", fee: "7,90", freeFrom: "150", minOrder: "30",
    opens: "08:00", closes: "20:00",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const text = (k: keyof typeof f) => ({
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value }),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!f.offersDelivery && !f.offersPickup) throw new Error("Escolha entrega, retirada ou as duas.");
      const location = await geocode(`${f.address}, ${f.city}`);
      if (!location) throw new Error("Não encontramos o endereço da loja no mapa. Confira rua, número e cidade.");
      await api.createStore({
        name: f.name.trim(),
        description: f.description.trim(),
        logoUrl: f.logo.trim(),
        address: `${f.address} · ${f.city}`,
        location,
        offersDelivery: f.offersDelivery,
        offersPickup: f.offersPickup,
        deliveryRadiusKm: Number(f.radius.replace(",", ".")),
        deliveryFeeCents: f.offersDelivery ? reais(f.fee) : 0,
        freeDeliveryFromCents: f.freeFrom.trim() ? reais(f.freeFrom) : null,
        minOrderCents: reais(f.minOrder || "0"),
        opens: f.opens,
        closes: f.closes,
      });
      router.push("/painel");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold">Cadastrar meu supermercado</h1>
        <p className="text-sm text-muted">Depois do cadastro a plataforma analisa e aprova a loja. Enquanto isso você já pode cadastrar os produtos.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
        <label className="space-y-1 text-sm">
          <span>Nome da loja</span>
          <input className="input" required {...text("name")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Ícone</span>
          <input className="input text-center" maxLength={8} {...text("logo")} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Descrição curta</span>
          <textarea className="input" rows={2} {...text("description")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Endereço (rua e número)</span>
          <input className="input" required placeholder="Av. Paulista, 900" {...text("address")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Cidade</span>
          <input className="input" required placeholder="São Paulo" {...text("city")} />
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Entrega e retirada</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={f.offersDelivery} onChange={(e) => setF({ ...f, offersDelivery: e.target.checked })} />
            Faço entregas
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={f.offersPickup} onChange={(e) => setF({ ...f, offersPickup: e.target.checked })} />
            Cliente pode retirar na loja
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {f.offersDelivery && (
            <>
              <label className="space-y-1 text-sm">
                <span>Raio de entrega (km)</span>
                <input className="input" inputMode="decimal" {...text("radius")} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Taxa de entrega (R$)</span>
                <input className="input" inputMode="decimal" {...text("fee")} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Grátis acima de (R$)</span>
                <input className="input" inputMode="decimal" placeholder="opcional" {...text("freeFrom")} />
              </label>
            </>
          )}
          <label className="space-y-1 text-sm">
            <span>Pedido mínimo (R$)</span>
            <input className="input" inputMode="decimal" {...text("minOrder")} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Abre às</span>
            <input className="input" type="time" required {...text("opens")} />
          </label>
          <label className="space-y-1 text-sm">
            <span>Fecha às</span>
            <input className="input" type="time" required {...text("closes")} />
          </label>
        </div>
      </fieldset>

      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>Cadastrar loja</button>
    </form>
  );
}
