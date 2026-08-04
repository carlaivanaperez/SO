"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchSales, ApiError, type SaleListRow } from "@/lib/api";
import { getToken, getUser, clearSession, canManage, type SessionUser } from "@/lib/auth";

const PAYMENTS: { value: string; label: string }[] = [
  { value: "", label: "Todos los pagos" },
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "ACCOUNT", label: "Cuenta corriente" },
];
const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cta. corriente",
};

const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

export default function SalesHistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [product, setProduct] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<SaleListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    // El historial de ventas es facturación del negocio: el vendedor no entra.
    if (!canManage(u)) {
      router.replace("/");
      return;
    }
    setUser(u);
  }, [router]);

  const load = useCallback(() => {
    if (!getToken()) return;
    setLoading(true);
    fetchSales({ from, to, paymentMethod, product, page })
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
        setPageSize(res.pageSize);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "Error al cargar las ventas");
        }
      })
      .finally(() => setLoading(false));
  }, [from, to, paymentMethod, product, page, router]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Al cambiar un filtro, volvemos a la página 1.
  function onFilter(setter: (v: string) => void, v: string) {
    setter(v);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <h1>Historial de ventas</h1>

        {/* Filtros */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="grid-2">
            <label className="field">
              <span className="label">Desde</span>
              <input
                className="input"
                type="date"
                value={from}
                onChange={(e) => onFilter(setFrom, e.target.value)}
              />
            </label>
            <label className="field">
              <span className="label">Hasta</span>
              <input
                className="input"
                type="date"
                value={to}
                onChange={(e) => onFilter(setTo, e.target.value)}
              />
            </label>
          </div>
          <div className="grid-2">
            <label className="field">
              <span className="label">Medio de pago</span>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => onFilter(setPaymentMethod, e.target.value)}
              >
                {PAYMENTS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Producto (nombre o SKU)</span>
              <input
                className="input"
                placeholder="Ej: Martillo"
                value={product}
                onChange={(e) => onFilter(setProduct, e.target.value)}
              />
            </label>
          </div>
        </div>

        {error && <p className="alert alert-error">⚠️ {error}</p>}

        <p className="muted" style={{ marginBottom: 8 }}>
          {total} venta{total === 1 ? "" : "s"} encontrada{total === 1 ? "" : "s"}
          {loading ? " · cargando…" : ""}
        </p>

        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Ítems</th>
                <th>Pago</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>#{s.number}</strong>
                  </td>
                  <td className="muted">{fmtDate(s.createdAt)}</td>
                  <td>{s._count.items}</td>
                  <td>{s.paymentMethod ? PAYMENT_LABELS[s.paymentMethod] ?? s.paymentMethod : "—"}</td>
                  <td>
                    <strong>{money(s.total)}</strong>
                  </td>
                  <td>
                    <Link href={`/ventas/${s.id}`}>Ver</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="muted" style={{ padding: 24 }}>
                    No hay ventas con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div
            style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "center", marginTop: 16 }}
          >
            <button
              className="btn btn-outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Anterior
            </button>
            <span className="muted">
              Página {page} de {totalPages}
            </span>
            <button
              className="btn btn-outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente →
            </button>
          </div>
        )}
      </main>
    </>
  );
}
