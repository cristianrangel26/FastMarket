"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { cartItemCount } from "@mercado/shared";
import { api, useApp, useHydrated, type AppState } from "@/lib/app-store";

const NEW_ADDRESS = "__novo__";

export function Header() {
  const s = useApp();
  const hydrated = useHydrated();
  const router = useRouter();
  const count = hydrated ? cartItemCount(s.cart) : 0;
  const addressKey = (a: { id?: string; label: string }) => a.id ?? a.label;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Image src="/icon.svg" alt="" width={32} height={32} priority />
          <span>FastMarket</span>
        </Link>

        <label className="order-3 flex w-full items-center gap-2 text-sm sm:order-none sm:ml-4 sm:w-auto">
          <span aria-hidden>📍</span>
          <span className="sr-only">Endereço</span>
          {hydrated && s.addresses.length > 0 ? (
            <select
              className="input py-1.5"
              value={s.address ? addressKey(s.address) : ""}
              onChange={(e) => {
                if (e.target.value === NEW_ADDRESS) return router.push("/enderecos");
                api.setAddress(s.addresses.find((a) => addressKey(a) === e.target.value)!);
              }}
            >
              {s.addresses.map((a) => (
                <option key={addressKey(a)} value={addressKey(a)}>{a.label}</option>
              ))}
              <option value={NEW_ADDRESS}>+ Novo endereço</option>
            </select>
          ) : (
            <Link href="/enderecos" className="text-primary-strong underline">Informe seu endereço</Link>
          )}
        </label>

        <div className="ml-auto flex items-center gap-2">
          {hydrated && <Account s={s} />}
          <Link href="/carrinho" className="btn-primary" aria-label={`Carrinho, ${count} itens`}>
            🛒 <span>{count}</span>
          </Link>
        </div>

        <nav className="order-4 -mx-1 flex w-full gap-1 overflow-x-auto text-sm">
          <Suspense fallback={<NavLinks pathname={null} s={s} />}>
            <CurrentNavLinks s={s} />
          </Suspense>
        </nav>
      </div>
      {hydrated && s.mode === "demo" && (
        <p className="bg-accent/10 px-4 py-1 text-center text-xs text-accent">
          Modo demonstração: dados de exemplo e pagamento simulado.
        </p>
      )}
    </header>
  );
}

function Account({ s }: { s: AppState }) {
  if (s.mode === "demo") return null;
  if (!s.user) return <Link href="/entrar" className="btn-ghost">Entrar</Link>;
  return (
    <button className="btn-ghost" onClick={() => api.signOut()} title={s.user.email}>
      Sair
    </button>
  );
}

function CurrentNavLinks({ s }: { s: AppState }) {
  return <NavLinks pathname={usePathname()} s={s} />;
}

function NavLinks({ pathname, s }: { pathname: string | null; s: AppState }) {
  const nav = [
    { href: "/", label: "Lojas" },
    { href: "/pedidos", label: "Meus pedidos" },
    { href: "/painel", label: "Sou lojista" },
    ...(s.user?.role === "platform_admin" ? [{ href: "/admin", label: "Plataforma" }] : []),
  ];
  return nav.map((n) => {
    const active =
      pathname !== null &&
      (n.href === "/" ? pathname === "/" || pathname.startsWith("/loja") : pathname.startsWith(n.href));
    return (
      <Link
        key={n.href}
        href={n.href}
        className={`whitespace-nowrap rounded-full px-3 py-1 ${active ? "bg-primary-soft font-semibold text-primary-strong" : "text-muted hover:bg-surface-2"}`}
      >
        {n.label}
      </Link>
    );
  });
}
