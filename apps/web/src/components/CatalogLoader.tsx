"use client";
import { useEffect, useState } from "react";
import { CatalogView } from "./CatalogView";
import type { PublicCatalog } from "@ferrestock/shared";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// Fallback cuando la carga en el servidor no trajo datos (típico: el servidor
// gratuito "dormido" que tarda en despertar). Reintenta solo desde el navegador
// mostrando un mensaje, en vez de dejar la pantalla en blanco.
export function CatalogLoader() {
  const [data, setData] = useState<PublicCatalog | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const attempt = async () => {
      tries++;
      try {
        const res = await fetch(`${API}/api/public/catalog`, { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as PublicCatalog;
          if (!cancelled) setData(d);
          return;
        }
      } catch {
        /* reintentamos abajo */
      }
      if (!cancelled) {
        if (tries < 15) setTimeout(attempt, 4000);
        else setFailed(true);
      }
    };
    attempt();
    return () => {
      cancelled = true;
    };
  }, []);

  if (data) return <CatalogView store={data.store} items={data.items} />;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
      {!failed ? (
        <>
          <div
            style={{
              width: 46,
              height: 46,
              margin: "0 auto 20px",
              border: "5px solid var(--border, #e5e5e5)",
              borderTopColor: "var(--yellow, #f5b301)",
              borderRadius: "50%",
              animation: "catspin 0.9s linear infinite",
            }}
          />
          <h2 style={{ margin: 0 }}>Abriendo el catálogo…</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            La primera vez del día puede tardar unos segundos. ¡Ya casi! 🧰
          </p>
          <style>{"@keyframes catspin{to{transform:rotate(360deg)}}"}</style>
        </>
      ) : (
        <>
          <h2 style={{ margin: 0 }}>No pudimos abrir el catálogo</h2>
          <p className="muted" style={{ marginTop: 8 }}>
            Probá de nuevo en un ratito.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => location.reload()}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
