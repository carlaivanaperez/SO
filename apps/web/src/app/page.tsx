import { whatsappUrl, type PublicCatalog } from "@ferrestock/shared";

// Página PÚBLICA (sin login) para clientes. Server component → se renderiza en
// el servidor (bueno para que Google la encuentre). Reusa el diseño del sitio.
export const dynamic = "force-dynamic";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;

export const metadata = {
  title: "Catálogo — El Almacén del Ferretero",
  description: "Mirá precios y disponibilidad, y pedí por WhatsApp.",
};

async function getCatalog(search: string): Promise<PublicCatalog | null> {
  try {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`${API}/api/public/catalog${qs}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicCatalog;
  } catch {
    return null;
  }
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const search = (searchParams.q ?? "").trim();
  const data = await getCatalog(search);
  const store = data?.store;
  const items = data?.items ?? [];

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "24px 16px 40px" }}>
      {/* Encabezado del negocio */}
      <header
        style={{
          background: "var(--yellow)",
          color: "#141414",
          borderRadius: 16,
          padding: "22px 24px",
          marginBottom: 20,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26 }}>{store?.storeName ?? "Catálogo"}</h1>
        <p style={{ margin: "4px 0 0", fontWeight: 600 }}>
          Mirá precios y disponibilidad. ¿Te interesa algo? Pedilo por WhatsApp. 🧰
        </p>
      </header>

      {/* Buscador (formulario simple, se resuelve en el servidor) */}
      <form method="get" style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          className="input"
          type="search"
          name="q"
          defaultValue={search}
          placeholder="🔎 Buscar producto…"
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary">
          Buscar
        </button>
      </form>

      {!data && (
        <p className="alert alert-error">
          ⚠️ No pudimos cargar el catálogo en este momento. Probá de nuevo en un ratito.
        </p>
      )}

      {data && items.length === 0 && (
        <p className="muted" style={{ padding: 24, textAlign: "center" }}>
          {search ? `No encontramos productos para “${search}”.` : "Todavía no hay productos cargados."}
        </p>
      )}

      {/* Grilla de productos */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        {items.map((p) => {
          const msg = `Hola! Quiero reservar/pedir: ${p.name}${
            p.brand ? ` (${p.brand})` : ""
          } — ${money(p.price)}. ¿Está disponible?`;
          const wa = store?.whatsappPhone ? whatsappUrl(store.whatsappPhone, msg) : null;
          return (
            <div
              key={p.id}
              className="card"
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  {p.promoLabel && <span className="badge badge-warn">🏷️ {p.promoLabel}</span>}
                  <span className={`badge ${p.available ? "badge-ok" : "badge-low"}`}>
                    {p.available ? "Disponible" : "Sin stock"}
                  </span>
                </div>
                <strong style={{ display: "block", fontSize: 16 }}>{p.name}</strong>
                {p.brand && (
                  <span className="muted" style={{ fontSize: 13 }}>
                    {p.brand}
                  </span>
                )}
                <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{money(p.price)}</div>
              </div>

              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success btn-block"
                >
                  Reservar / pedir por WhatsApp
                </a>
              ) : (
                <span className="muted" style={{ fontSize: 12 }}>
                  (Configurá el WhatsApp del negocio para recibir pedidos)
                </span>
              )}
            </div>
          );
        })}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 24, textAlign: "center" }}>
        Los precios incluyen IVA. La disponibilidad puede variar; confirmá por WhatsApp.
      </p>
    </div>
  );
}
