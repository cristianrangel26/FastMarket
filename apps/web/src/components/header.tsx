"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cartItemCount } from "@mercado/shared";
import { demo, demoAddresses, useDemo, useHydrated } from "@/lib/demo-store";

const NAV = [
  { href: "/", label: "Lojas" },
  { href: "/pedidos", label: "Meus pedidos" },
  { href: "/painel", label: "Sou lojista" },
  { href: "/admin", label: "Plataforma" },
];

export function Header() {
  const s = useDemo();
  const hydrated = useHydrated();
  const count = hydrated ? cartItemCount(s.cart) : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Image src="/icon.svg" alt="" width={32} height={32} priority />
          <span>Mercado do Futuro</span>
        </Link>

        <label className="order-3 flex w-full items-center gap-2 text-sm sm:order-none sm:ml-4 sm:w-auto">
          <span aria-hidden>📍</span>
          <span className="sr-only">Endereço</span>
          <select
            className="input py-1.5"
            value={s.address.label}
            onChange={(e) => demo.setAddress(demoAddresses.find((a) => a.label === e.target.value)!)}
          >
            {demoAddresses.map((a) => (
              <option key={a.label}>{a.label}</option>
            ))}
          </select>
        </label>

        <Link href="/carrinho" className="btn-primary ml-auto" aria-label={`Carrinho, ${count} itens`}>
          🛒 <span>{count}</span>
        </Link>

        <nav className="order-4 -mx-1 flex w-full gap-1 overflow-x-auto text-sm">
          <Suspense fallback={<NavLinks pathname={null} />}>
            <CurrentNavLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return NAV.map((n) => {
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
