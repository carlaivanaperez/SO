"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchProducts,
  fetchSummary,
  fetchActivePromotions,
  ApiError,
  type ProductRow,
  type DashboardSummary,
  type ActivePromotion,
} from "@/lib/api";
import { getToken, getUser, clearSession, canManage, type SessionUser } from "@/lib/auth";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cta. corriente",
};

const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [promoMap, setPromoMap] = useState<Record<string, ActivePromotion>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  // Carga el resumen del dashboard (y lo refresca al volver a la pestaña).
  const loadSummary = useCallback(() => {
    if (!getToken()) return;
    fetchSummary()
      .then(setSummary)
      .catch((e) => {
        if (!handleAuthError(e)) {
          /* si falla el resumen no rompemos la pantalla */
        }
      });
  }, [handleAuthError]);

  useEffect(() => {
    loadSummary();
    window.addEventListener("focus", loadSummary);
    return () => window.removeEventListener("focus", loadSummary);
  }, [loadSummary]);

  // Promos vigentes → para marcar productos con promo en el catálogo.
  useEffect(() => {
    if (!getToken()) return;
    fetchActivePromotions()
      .then((list) => setPromoMap(Object.fromEntries(list.map((p) => [p.productId, p]))))
      .catch(() => {});
  }, []);

  // Catálogo (con búsqueda + debounce).
  useEffect(() => {
    if (!getToken()) return;
    const t = setTimeout(() => {
      fetchProducts(search)
        .then((res) => {
          setProducts(res.items);
          setError(null);
        })
        .catch((e) => {
          if (!handleAuthError(e)) {
            setError(e instanceof Error ? e.message : "Error al cargar el catálogo");
          }
        });
    }, 250);
    return () => clearTimeout(t);
  }, [search, handleAuthError]);

  useEffect(() => {
    function onFocus() {
      if (!getToken()) return;
      fetchProducts(search)
        .then((res) => setProducts(res.items))
        .catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [search]);

  const manage = canManage(user);

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <div className="page-head">
          <h1 style={{ margin: 0 }}>Panel</h1>
          <Link href="/pos" className="btn btn-primary">
            Nueva venta
          </Link>
        </div>

        {/* Indicadores del día. El vendedor no ve la facturación (dinero del día). */}
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">Ventas de hoy</div>
            <div className="kpi-value">{summary ? summary.today.count : "…"}</div>
          </div>
          {manage && (
            <div className="kpi kpi-money">
              <div className="kpi-label">Dinero ingresado hoy</div>
              <div className="kpi-value">
                {summary ? money(summary.today.revenue ?? 0) : "…"}
              </div>
            </div>
          )}
          <div className="kpi kpi-danger">
            <div className="kpi-label">Productos con poco stock</div>
            <div className="kpi-value">{summary ? summary.lowStock.count : "…"}</div>
          </div>
        </div>

        {/* Últimas ventas (solo gestión) + Poco stock */}
        <div className={manage ? "grid-2" : ""} style={{ marginBottom: 20 }}>
          {manage && (
            <section className="card">
              <h2 style={{ fontSize: 16 }}>Últimas ventas</h2>
              {summary?.recentSales.length === 0 && <p className="muted">Todavía no hay ventas.</p>}
              {summary?.recentSales.map((s) => (
                <div key={s.id} className="list-row">
                  <span>
                    <strong>#{s.number}</strong>{" "}
                    <span className="muted">
                      · {s.itemCount} ít.{" "}
                      {s.paymentMethod ? `· ${PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod}` : ""}
                    </span>
                  </span>
                  <strong>{money(s.total)}</strong>
                </div>
              ))}
              {!summary && <p className="muted">Cargando…</p>}
            </section>
          )}

          <section className="card">
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
            >
              <h2 style={{ fontSize: 16, margin: 0 }}>Poco stock</h2>
              {summary && summary.lowStock.count > 0 && (
                <Link href="/compras" className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 13 }}>
                  Planilla de compra
                </Link>
              )}
            </div>
            {summary?.lowStock.items.length === 0 && (
              <p className="muted" style={{ marginTop: 12 }}>
                Todo el stock está por encima del mínimo. 👍
              </p>
            )}
            {summary?.lowStock.items.map((p) => (
              <div key={p.id} className="list-row">
                <span>{p.name}</span>
                <span className={`badge ${Number(p.stock) <= 0 ? "badge-low" : "badge-warn"}`}>
                  {Number(p.stock).toLocaleString("es-AR")}
                </span>
              </div>
            ))}
            {!summary && <p className="muted">Cargando…</p>}
          </section>
        </div>

        {/* Catálogo */}
        <div className="page-head">
          <h2 style={{ margin: 0 }}>Catálogo y stock</h2>
          {manage && (
            <Link href="/products/new" className="btn btn-primary">
              + Nuevo producto
            </Link>
          )}
        </div>

        <input
          className="input"
          placeholder="🔎 Buscar por nombre, SKU o código de barras…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ marginBottom: 16 }}
        />

        {error && <p className="alert alert-error">⚠️ {error}</p>}

        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Stock</th>
                {manage && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const stock = p.stockItems.reduce((s, i) => s + Number(i.quantity), 0);
                const minQty = p.stockItems.reduce((s, i) => s + Number(i.minQuantity), 0);
                // Semáforo: rojo=sin stock, amarillo=bajo el mínimo, verde=ok.
                const badge =
                  stock <= 0 ? "badge-low" : stock <= minQty ? "badge-warn" : "badge-ok";
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.sku}</td>
                    <td>
                      <strong>{p.name}</strong>
                      {promoMap[p.id] && (
                        <span className="badge badge-warn" style={{ marginLeft: 8 }}>
                          🏷️{" "}
                          {promoMap[p.id]!.type === "PERCENT"
                            ? `${Number(promoMap[p.id]!.percent ?? 0)}% off`
                            : "2x1"}
                        </span>
                      )}
                    </td>
                    <td>{money(p.salePrice)}</td>
                    <td>
                      <span className={`badge ${badge}`}>{stock}</span>
                    </td>
                    {manage && (
                      <td style={{ display: "flex", gap: 14 }}>
                        <Link href={`/products/${p.id}/edit`}>Editar</Link>
                        <Link href={`/products/${p.id}/stock`}>Stock</Link>
                      </td>
                    )}
                  </tr>
                );
              })}
              {products.length === 0 && !error && (
                <tr>
                  <td colSpan={manage ? 5 : 4} className="muted" style={{ padding: 24 }}>
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
