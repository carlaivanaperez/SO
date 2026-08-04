"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchSale, ApiError, type SaleDetail } from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cuenta corriente",
};
const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" });

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    fetchSale(params.id)
      .then(setSale)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudo cargar la venta");
        }
      });
  }, [params.id, router]);

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <Link href="/ventas">← Volver al historial</Link>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!sale && !error && <p className="muted">Cargando…</p>}

        {sale && (
          <>
            <div className="page-head" style={{ marginTop: 8 }}>
              <div>
                <h1 style={{ margin: 0 }}>Venta #{sale.number}</h1>
                <p className="muted" style={{ margin: 0 }}>{fmtDate(sale.createdAt)}</p>
              </div>
              <button className="btn btn-outline" onClick={() => window.print()}>
                Imprimir
              </button>
            </div>

            <div className="card table-wrap" style={{ padding: 0, marginBottom: 16 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant.</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((it) => (
                    <tr key={it.id}>
                      <td>
                        <strong>{it.product.name}</strong>{" "}
                        <span className="muted">({it.product.sku})</span>
                      </td>
                      <td>{Number(it.quantity).toLocaleString("es-AR")}</td>
                      <td>{money(it.unitPrice)}</td>
                      <td>{money(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card" style={{ maxWidth: 320, marginLeft: "auto" }}>
              <div className="list-row">
                <span className="muted">Subtotal</span>
                <span>{money(sale.subtotal)}</span>
              </div>
              <div className="list-row">
                <span className="muted">IVA</span>
                <span>{money(sale.tax)}</span>
              </div>
              {Number(sale.discount) > 0 && (
                <div className="list-row">
                  <span className="muted">Descuento</span>
                  <span>-{money(sale.discount)}</span>
                </div>
              )}
              <div className="list-row">
                <strong>Total</strong>
                <strong style={{ fontSize: 18 }}>{money(sale.total)}</strong>
              </div>
              <div className="list-row">
                <span className="muted">Pago</span>
                <span>
                  {sale.paymentMethod
                    ? PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod
                    : "—"}
                </span>
              </div>
              {sale.customer && (
                <div className="list-row">
                  <span className="muted">Cliente</span>
                  <span>{sale.customer.name}</span>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
