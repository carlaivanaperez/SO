"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchProducts, createSale, ApiError, type ProductRow, type SaleResult } from "@/lib/api";
import { getToken, clearSession } from "@/lib/auth";
import type { CreateSaleInput } from "@ferrestock/shared";

type CartLine = { product: ProductRow; quantity: number };
type PaymentMethod = CreateSaleInput["paymentMethod"];

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cuenta corriente",
};

export default function PosPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (!getToken() || !search) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetchProducts(search)
        .then((res) => setResults(res.items))
        .catch(handleError);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      clearSession();
      router.replace("/login");
    } else {
      setError(e instanceof Error ? e.message : "Ocurrió un error");
    }
  }

  function addToCart(p: ProductRow) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
    setSearch("");
    setResults([]);
  }

  function setQty(id: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== id));
      return;
    }
    setCart((prev) => prev.map((l) => (l.product.id === id ? { ...l, quantity } : l)));
  }

  const total = useMemo(
    () => cart.reduce((sum, l) => sum + Number(l.product.salePrice) * l.quantity, 0),
    [cart]
  );

  async function confirm() {
    if (cart.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const input: CreateSaleInput = {
        paymentMethod: payment,
        discount: 0,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, discount: 0 })),
      };
      const sale = await createSale(input);
      setDone(sale);
      setCart([]);
    } catch (e) {
      handleError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>🧾 Punto de venta</h1>
        <Link href="/">← Volver al panel</Link>
      </header>

      {done && (
        <p
          style={{
            background: "#e7f8ec",
            border: "1px solid #9fdcb3",
            padding: 12,
            borderRadius: 6,
          }}
        >
          ✅ Venta #{done.number} registrada — total ${Number(done.total).toLocaleString("es-AR")}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 16 }}>
        {/* Buscador de productos */}
        <section>
          <h2 style={{ fontSize: 16 }}>Agregar producto</h2>
          <input
            placeholder="Buscar por nombre, SKU o código…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setDone(null);
            }}
            style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 }}
          />
          <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
            {results.map((p) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                <span>
                  <strong>{p.name}</strong> <span style={{ color: "#888" }}>({p.sku})</span>
                  <br />${Number(p.salePrice).toLocaleString("es-AR")}
                </span>
                <button onClick={() => addToCart(p)} style={{ cursor: "pointer" }}>
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Carrito */}
        <section>
          <h2 style={{ fontSize: 16 }}>Venta actual</h2>
          {cart.length === 0 && <p style={{ color: "#888" }}>Todavía no agregaste productos.</p>}
          {cart.map((l) => (
            <div
              key={l.product.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid #eee",
              }}
            >
              <span style={{ flex: 1 }}>{l.product.name}</span>
              <input
                type="number"
                min={0}
                value={l.quantity}
                onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                style={{ width: 56, padding: 4 }}
              />
              <span style={{ width: 90, textAlign: "right" }}>
                ${(Number(l.product.salePrice) * l.quantity).toLocaleString("es-AR")}
              </span>
            </div>
          ))}

          <div style={{ marginTop: 16 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Medio de pago</span>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentMethod)}
                style={{ padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
              >
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p style={{ fontSize: 20, fontWeight: 700, marginTop: 16 }}>
            Total: ${total.toLocaleString("es-AR")}
          </p>

          {error && <p style={{ color: "crimson" }}>⚠️ {error}</p>}

          <button
            onClick={confirm}
            disabled={cart.length === 0 || saving}
            style={{
              width: "100%",
              padding: "12px",
              border: "none",
              borderRadius: 6,
              background: cart.length === 0 ? "#aaa" : "#1a7f37",
              color: "white",
              fontSize: 16,
              cursor: cart.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "Registrando…" : "Confirmar venta"}
          </button>
        </section>
      </div>
    </main>
  );
}
