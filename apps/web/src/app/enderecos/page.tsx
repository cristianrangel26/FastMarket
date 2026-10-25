"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, geocode, useApp } from "@/lib/app-store";
import { Gate } from "@/components/gate";

export default function AddressesPage() {
  return (
    <Suspense>
      <Gate back="/enderecos">
        <AddressForm />
      </Gate>
    </Suspense>
  );
}

const empty = { label: "Casa", zip: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "" };

function AddressForm() {
  const s = useApp();
  const router = useRouter();
  const back = useSearchParams().get("voltar") ?? "/";
  const [f, setF] = useState(empty);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof empty) => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
  });

  /** Preenche rua, bairro e cidade pelo CEP (ViaCEP). */
  async function lookupZip() {
    const zip = f.zip.replace(/\D/g, "");
    if (zip.length !== 8) return;
    try {
      const r = await (await fetch(`https://viacep.com.br/ws/${zip}/json/`)).json();
      if (!r.erro) setF((x) => ({ ...x, street: r.logradouro || x.street, neighborhood: r.bairro || x.neighborhood, city: r.localidade, state: r.uf }));
    } catch {}
  }

  function captureLocation() {
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("Não foi possível obter sua localização. Vamos usar o endereço digitado."),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const location =
        coords ??
        (await geocode(`${f.street}, ${f.number}, ${f.city}, ${f.state}`)) ??
        (await geocode(`${f.street}, ${f.city}, ${f.state}`));
      if (!location) throw new Error("Não encontramos esse endereço no mapa. Confira os dados ou use sua localização.");
      await api.saveAddress({
        label: `${f.label} · ${f.neighborhood}`,
        street: f.street,
        number: f.number,
        complement: f.complement,
        neighborhood: f.neighborhood,
        city: f.city,
        state: f.state,
        zip: f.zip,
        location,
      });
      router.push(back);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-lg space-y-4 p-6">
      <h1 className="text-xl font-bold">Novo endereço</h1>
      {s.addresses.length > 0 && (
        <p className="text-sm text-muted">Endereços salvos: {s.addresses.map((a) => a.label).join(", ")}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span>Nome</span>
          <input className="input" required placeholder="Casa, Trabalho…" {...field("label")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>CEP</span>
          <input className="input" required inputMode="numeric" {...field("zip")} onBlur={lookupZip} />
        </label>
        <label className="col-span-2 space-y-1 text-sm">
          <span>Rua</span>
          <input className="input" required {...field("street")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Número</span>
          <input className="input" required {...field("number")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Complemento</span>
          <input className="input" {...field("complement")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Bairro</span>
          <input className="input" required {...field("neighborhood")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Cidade</span>
          <input className="input" required {...field("city")} />
        </label>
        <label className="space-y-1 text-sm">
          <span>UF</span>
          <input className="input" required maxLength={2} {...field("state")} />
        </label>
      </div>
      <button type="button" className="btn-ghost w-full" onClick={captureLocation}>
        {coords ? "✓ Localização atual capturada" : "📍 Usar minha localização atual (mais preciso)"}
      </button>
      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>Salvar endereço</button>
    </form>
  );
}
