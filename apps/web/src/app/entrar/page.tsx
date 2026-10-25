"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, useApp, useHydrated } from "@/lib/app-store";
import { Empty } from "@/components/ui";

export default function SignInPage() {
  return (
    <Suspense>
      <SignIn />
    </Suspense>
  );
}

function SignIn() {
  const s = useApp();
  const hydrated = useHydrated();
  const router = useRouter();
  const back = useSearchParams().get("voltar") ?? "/";
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!hydrated) return null;
  if (s.mode === "demo") {
    return (
      <Empty emoji="🧪" title="Na demonstração não é preciso entrar">
        <Link href="/" className="btn-primary">Ver lojas</Link>
      </Empty>
    );
  }
  if (s.user) {
    return (
      <Empty emoji="👋" title={`Olá${s.user.name ? `, ${s.user.name}` : ""}! Você já entrou.`}>
        <Link href={back} className="btn-primary">Continuar</Link>
      </Empty>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "criar") {
        const { needsConfirmation } = await api.signUp(name.trim(), email.trim(), password);
        if (needsConfirmation) {
          setNotice("Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre aqui.");
          setMode("entrar");
          return;
        }
      } else {
        await api.signIn(email.trim(), password);
      }
      router.push(back);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-bold">{mode === "entrar" ? "Entrar" : "Criar conta"}</h1>
      {notice && <p className="rounded-xl bg-primary-soft p-3 text-sm text-primary-strong">{notice}</p>}
      {mode === "criar" && (
        <label className="block space-y-1 text-sm">
          <span>Nome</span>
          <input className="input" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </label>
      )}
      <label className="block space-y-1 text-sm">
        <span>E-mail</span>
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Senha</span>
        <input
          className="input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "entrar" ? "current-password" : "new-password"}
        />
      </label>
      {error && <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full py-2.5" disabled={busy}>
        {mode === "entrar" ? "Entrar" : "Criar conta"}
      </button>
      <button
        type="button"
        className="w-full text-sm text-primary-strong"
        onClick={() => { setMode(mode === "entrar" ? "criar" : "entrar"); setError(null); }}
      >
        {mode === "entrar" ? "Não tem conta? Criar agora" : "Já tem conta? Entrar"}
      </button>
    </form>
  );
}
