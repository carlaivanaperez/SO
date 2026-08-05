import type { PublicCatalog } from "@ferrestock/shared";
import { CatalogView } from "@/components/CatalogView";
import { CatalogLoader } from "@/components/CatalogLoader";

// Página PÚBLICA (sin login) para clientes. Server component → el HTML se arma
// en el servidor (bueno para SEO). La parte interactiva (filtros + carrito de
// pedido) vive en <CatalogView> (client component), que igual se renderiza en
// el servidor para el primer pintado.
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const metadata = {
  title: "Catálogo — El Almacén del Ferretero",
  description: "Mirá precios y disponibilidad, armá tu pedido y enviálo por WhatsApp.",
};

async function getCatalog(): Promise<PublicCatalog | null> {
  try {
    const res = await fetch(`${API}/api/public/catalog`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicCatalog;
  } catch {
    return null;
  }
}

export default async function CatalogoPage() {
  const data = await getCatalog();

  // Si el servidor no respondió (típico: servidor gratuito "dormido"), dejamos
  // que el navegador reintente solo con un mensaje amable (no pantalla en blanco).
  if (!data) return <CatalogLoader />;

  return <CatalogView store={data.store} items={data.items} />;
}
