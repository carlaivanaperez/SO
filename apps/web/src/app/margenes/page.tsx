"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchMargins, ApiError, type MarginRow } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

export default function MarginsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<MarginRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    // El costo/margen es información sensible: solo ADMIN/MANAGER.
    if (!canManage(u)) {
      router.replace("/");
      return;
    }
    setUser(u);
    fetchMargins()
      .then(setRows)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudieron cargar los márgenes");
        }
      });
  }, [router]);

  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))
    : rows;

  // Color del margen: rojo si vende a pérdida o muy bajo, amarillo si flojo.
  function marginBadge(r: MarginRow): string {
    if (!r.hasCost) return "badge";
    if (r.profit < 0) return "badge badge-low";
    if (r.marginOnPrice < 15) return "badge badge-warn";
    return "badge badge-ok";
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <div className="page-head">
          <h1 style={{ margin: 0 }}>Márgenes y ganancia</h1>
          <Link href="/" className="btn btn-outline">
            ← Volver al panel
          </Link>
        </div>
        <p className="muted">
          Ganancia calculada <strong>sin IVA</strong> (costo y precio se cargan con IVA incluido). Los
          de menor margen aparecen primero.
        </p>

        <input
          className="input"
          placeholder="🔎 Buscar por nombre o SKU…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {error && <p className="alert alert-error">⚠️ {error}</p>}

        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Costo</th>
                <th>Venta</th>
                <th>Ganancia</th>
                <th>Margen</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong> <span className="muted">({r.sku})</span>
                  </td>
                  <td className="muted">{r.hasCost ? money(r.cost) : "—"}</td>
                  <td>{money(r.price)}</td>
                  <td style={{ color: r.profit < 0 ? "var(--danger)" : "var(--text)", fontWeight: 600 }}>
                    {r.hasCost ? money(r.profit) : "—"}
                  </td>
                  <td>
                    {r.hasCost ? (
                      <span className={marginBadge(r)}>{r.marginOnPrice}%</span>
                    ) : (
                      <span className="muted" title="Cargá el costo del producto para ver el margen">
                        sin costo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && !error && (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: 24 }}>
                    No hay productos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
