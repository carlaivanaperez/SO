"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchMonthlyReport, ApiError, type MonthlyReport } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";

const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;
const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cuenta corriente",
};

// Mes actual en formato YYYY-MM.
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const parts = month.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export default function MonthlyReportPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    (m: string) => {
      if (!getToken()) return;
      setLoading(true);
      fetchMonthlyReport(m)
        .then((r) => {
          setReport(r);
          setError(null);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            clearSession();
            router.replace("/login");
          } else {
            setError(e instanceof Error ? e.message : "No se pudo cargar el informe");
          }
        })
        .finally(() => setLoading(false));
    },
    [router]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    if (!canManage(u)) {
      router.replace("/panel");
      return;
    }
    setUser(u);
    load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const t = report?.totals;

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 820 }}>
        <div className="no-print">
          <div className="page-head">
            <h1 style={{ margin: 0 }}>Informe mensual</h1>
            <Link href="/panel" className="btn btn-outline">
              ← Volver al panel
            </Link>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="label">Mes</span>
              <input
                className="input"
                type="month"
                value={month}
                max={currentMonth()}
                onChange={(e) => {
                  setMonth(e.target.value);
                  if (e.target.value) load(e.target.value);
                }}
              />
            </label>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={!report}>
              🖨️ Imprimir
            </button>
          </div>
          {error && <p className="alert alert-error">⚠️ {error}</p>}
          {loading && <p className="muted">Cargando…</p>}
        </div>

        {report && t && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ margin: 0, textTransform: "capitalize" }}>{monthLabel(report.month)}</h2>
              <p className="muted" style={{ margin: 0 }}>El Almacén del Ferretero — Informe mensual</p>
            </div>

            {/* Resumen */}
            <div className="kpis" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="kpi-label">Ventas</div>
                <div className="kpi-value">{t.count}</div>
              </div>
              <div className="kpi kpi-money">
                <div className="kpi-label">Facturación</div>
                <div className="kpi-value">{money(t.revenue)}</div>
              </div>
              <div className="kpi kpi-money">
                <div className="kpi-label">
                  Ganancia estimada {t.profitPartial && <span title="Hay ítems sin costo cargado">⚠️</span>}
                </div>
                <div className="kpi-value">{money(t.profit)}</div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="list-row">
                <span className="muted">IVA (incluido en la facturación)</span>
                <span>{money(t.tax)}</span>
              </div>
              <div className="list-row">
                <span className="muted">Ticket promedio</span>
                <span>{money(t.avgTicket)}</span>
              </div>
              <div className="list-row">
                <span className="muted">Cobranzas de cuenta corriente</span>
                <span>{money(t.payments)}</span>
              </div>
            </div>

            {/* Ventas por medio de pago */}
            <h3 style={{ marginBottom: 8 }}>Ventas por medio de pago</h3>
            <div className="card table-wrap" style={{ padding: 0, marginBottom: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Medio de pago</th>
                    <th>Ventas</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byPayment.map((p) => (
                    <tr key={p.method ?? "—"}>
                      <td>{p.method ? PAYMENT_LABELS[p.method] ?? p.method : "—"}</td>
                      <td>{p.count}</td>
                      <td>{money(p.total)}</td>
                    </tr>
                  ))}
                  {report.byPayment.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted" style={{ padding: 16 }}>
                        No hubo ventas en el mes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Top productos */}
            <h3 style={{ marginBottom: 8 }}>Productos más vendidos</h3>
            <div className="card table-wrap" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Facturación</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.productId}>
                      <td>
                        <strong>{p.name}</strong> <span className="muted">({p.sku})</span>
                      </td>
                      <td>{Number(p.quantity).toLocaleString("es-AR")}</td>
                      <td>{money(p.revenue)}</td>
                    </tr>
                  ))}
                  {report.topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted" style={{ padding: 16 }}>
                        Sin datos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
              La ganancia es estimada (calculada sin IVA, con el costo actual de cada producto).
            </p>
          </div>
        )}
      </main>
    </>
  );
}
