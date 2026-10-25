import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mercado do Futuro",
    short_name: "Mercado",
    description: "Os supermercados da sua região em um só app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f5",
    theme_color: "#0f9d58",
    lang: "pt-BR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
