"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchLowStock, ApiError, type LowStockItem } from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";

const nf = (v: string) => Number(v).toLocaleString("es-AR");

export default function PurchaseListPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    fetchLowStock()
      .then(setItems)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "Error al cargar la planilla");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  function downloadCsv() {
    const header = ["Producto", "SKU", "Stock actual", "Mínimo", "A comprar"];
    const rows = items.map((i) => [i.name, i.sku, nf(i.stock), nf(i.min), nf(i.toBuy)]);
    const csv = [header, ...rows]
      .map((r) => r.map((f) => `"${String(f).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planilla-compra-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <div className="page-head no-print">
          <Link href="/panel">← Volver al panel</Link>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-outline" onClick={downloadCsv} disabled={items.length === 0}>
              Descargar (Excel)
            </button>
            <button className="btn btn-primary" onClick={() => window.print()} disabled={items.length === 0}>
              Imprimir
            </button>
          </div>
        </div>

        <h1>Planilla de compra</h1>
        <p className="muted">Productos por debajo del mínimo de reposición.</p>

        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {loading && <p className="muted">Cargando…</p>}
        {!loading && items.length === 0 && !error && (
          <p className="alert alert-success">✅ Todo el stock está por encima del mínimo. No hay nada que reponer.</p>
        )}

        {items.length > 0 && (
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>SKU</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>A comprar</th>
                  <th>Proveedor / precio</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <strong>{i.name}</strong>
                    </td>
                    <td className="muted">{i.sku}</td>
                    <td>{nf(i.stock)}</td>
                    <td>{nf(i.min)}</td>
                    <td>
                      <strong>{nf(i.toBuy)}</strong>
                    </td>
                    <td style={{ minWidth: 160 }}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
