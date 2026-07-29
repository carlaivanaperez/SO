"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchProducts, ApiError, type ProductRow } from "@/lib/api";
import { getToken, getUser, clearSession, canManage, type SessionUser } from "@/lib/auth";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sin token → al login.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  // Carga (y recarga por búsqueda, con debounce simple).
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

  function logout() {
    clearSession();
    router.replace("/login");
  }

  const manage = canManage(user);

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0 }}>FerreStock 🛠️</h1>
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/pos" style={{ fontWeight: 600 }}>
            🧾 Punto de venta
          </Link>
          {user && <span style={{ color: "#666" }}>{user.name}</span>}
          <button onClick={logout} style={{ cursor: "pointer" }}>
            Salir
          </button>
        </nav>
      </header>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <p style={{ color: "#666" }}>Catálogo y stock</p>
        {manage && (
          <Link
            href="/products/new"
            style={{
              background: "#1a56db",
              color: "white",
              padding: "8px 12px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            + Nuevo producto
          </Link>
        )}
      </div>

      <input
        placeholder="Buscar por nombre, SKU o código de barras…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "8px 10px",
          border: "1px solid #ccc",
          borderRadius: 6,
          marginBottom: 16,
        }}
      />

      {error && <p style={{ color: "crimson" }}>⚠️ {error}</p>}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
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
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>${Number(p.salePrice).toLocaleString("es-AR")}</td>
                <td>{stock}</td>
                {manage && (
                  <td style={{ display: "flex", gap: 12 }}>
                    <Link href={`/products/${p.id}/edit`}>Editar</Link>
                    <Link href={`/products/${p.id}/stock`}>Stock</Link>
                  </td>
                )}
              </tr>
            );
          })}
          {products.length === 0 && !error && (
            <tr>
              <td colSpan={manage ? 5 : 4} style={{ padding: 16, color: "#888" }}>
                No hay productos para mostrar.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
