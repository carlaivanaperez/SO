import { fetchProducts } from "@/lib/api";

// Server Component: lista el catálogo con stock. Punto de partida del panel.
export default async function DashboardPage() {
  let products: Awaited<ReturnType<typeof fetchProducts>>["items"] = [];
  let error: string | null = null;

  try {
    products = (await fetchProducts()).items;
  } catch (e) {
    error = e instanceof Error ? e.message : "Error desconocido";
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1>FerreStock 🛠️</h1>
      <p>Panel de administración — catálogo y stock</p>

      {error && <p style={{ color: "crimson" }}>⚠️ {error} (¿está corriendo la API?)</p>}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
            <th>SKU</th>
            <th>Producto</th>
            <th>Precio</th>
            <th>Stock</th>
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
