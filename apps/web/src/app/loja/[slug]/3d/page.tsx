"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useApp, useHydrated } from "@/lib/app-store";

const Store3D = dynamic(() => import("@/components/store3d/store3d"), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  return <div className="flex h-full items-center justify-center text-muted">Abrindo as portas da loja…</div>;
}

export default function Store3DPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Store3DRoute />
    </Suspense>
  );
}

function Store3DRoute() {
  const { slug } = useParams<{ slug: string }>();
  const s = useApp();
  const hydrated = useHydrated();
  const store = s.stores.find((st) => st.slug === slug);

  // Ocupa a tela toda abaixo do cabeçalho, sem as margens do layout.
  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-h,112px)] z-10">
      {!hydrated || !s.ready ? (
        <Loading />
      ) : !store || (store.status !== "approved" && store.ownerId !== s.user?.id) ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <p>Loja não encontrada.</p>
          <Link href="/" className="btn-ghost">Ver lojas</Link>
        </div>
      ) : (
        <Store3D store={store} />
      )}
    </div>
  );
}
