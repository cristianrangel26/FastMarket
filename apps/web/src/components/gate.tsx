"use client";

import Link from "next/link";
import { useApp, useHydrated, type Role } from "@/lib/app-store";
import { Empty } from "./ui";

/** Mostra o conteúdo só para quem entrou na conta (e tem o papel exigido, se houver). */
export function Gate({ back, role, children }: { back: string; role?: Role; children: React.ReactNode }) {
  const s = useApp();
  const hydrated = useHydrated();
  if (!hydrated || !s.ready) return <p className="text-muted">Carregando…</p>;
  if (!s.user) {
    return (
      <Empty emoji="🔐" title="Entre na sua conta para continuar">
        <Link href={`/entrar?voltar=${encodeURIComponent(back)}`} className="btn-primary">Entrar ou criar conta</Link>
      </Empty>
    );
  }
  if (role && s.user.role !== role) {
    return <Empty emoji="🚫" title="Esta área é só para a administração da plataforma" />;
  }
  return <>{children}</>;
}

/** Repassa erros das ações assíncronas para o usuário. */
export function run(action: () => Promise<unknown>) {
  action().catch((e: Error) => alert(e.message));
}
