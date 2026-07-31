"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchProducts, ApiError, type ProductRow } from "@/lib/api";
import { getToken, getUser, clearSession, canManage, type SessionUser } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    const t = setTimeout(() => {
      fetchProducts(search)
        .then((res) => {
          setProducts(res.items);
          setError(null);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            clearSession();
            router.replace("/login");
          } else {
            setError(e instanceof Error ? e.message : "Error al cargar el catálogo");
          }
        });
    }, 250);
    return () => clearTimeout(t);
  }, [search, router]);

  const manage = canManage(user);

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <div className="page-head">
          <div>
            <h1 style={{ marginBottom: 2 }}>Catálogo y stock</h1>
            <p className="muted" style={{ margin: 0 }}>
              {products.length} producto{products.length === 1 ? "" : "s"}
            </p>
          </div>
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

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
                return (
                  <tr key={p.id}>
                    <td className="muted">{p.sku}</td>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>${Number(p.salePrice).toLocaleString("es-AR")}</td>
                    <td>
                      <span className={`badge ${stock <= 0 ? "badge-low" : "badge-ok"}`}>
                        {stock}
                      </span>
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
