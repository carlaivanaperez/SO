"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchProducts,
  createSale,
  fetchCustomers,
  ApiError,
  type ProductRow,
  type SaleResult,
  type CustomerRow,
} from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleResult | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    fetchCustomers().then(setCustomers).catch(() => {});
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
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
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
    if (payment === "ACCOUNT" && !customerId) {
      setError("Para una venta a cuenta corriente elegí un cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: CreateSaleInput = {
        paymentMethod: payment,
        discount: 0,
        customerId: customerId || undefined,
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
    <>
      <AppHeader user={user} />
      <main className="container">
        <h1>🧾 Punto de venta</h1>

        {done && (
          <p className="alert alert-success">
            ✅ Venta #{done.number} registrada — total $
            {Number(done.total).toLocaleString("es-AR")}
          </p>
        )}

        <div className="grid-2" style={{ marginTop: 8 }}>
          {/* Buscador */}
          <section className="card">
            <h2 style={{ fontSize: 16 }}>Agregar producto</h2>
            <input
              className="input"
              placeholder="🔎 Buscar por nombre, SKU o código…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setDone(null);
              }}
            />
            <ul style={{ listStyle: "none", padding: 0, marginTop: 8 }}>
              {results.map((p) => (
                <li
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span>
                    <strong>{p.name}</strong> <span className="muted">({p.sku})</span>
                    <br />${Number(p.salePrice).toLocaleString("es-AR")}
                  </span>
                  <button onClick={() => addToCart(p)} className="btn btn-outline">
                    + Agregar
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Carrito */}
          <section className="card">
            <h2 style={{ fontSize: 16 }}>Venta actual</h2>
            {cart.length === 0 && <p className="muted">Todavía no agregaste productos.</p>}
            {cart.map((l) => (
              <div
                key={l.product.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{l.product.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    ${Number(l.product.salePrice).toLocaleString("es-AR")} c/u
                  </div>
                </div>

                {/* Controles de cantidad − [n] + */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setQty(l.product.id, l.quantity - 1)}
                    style={{ width: 34, minHeight: 34, padding: 0, fontSize: 18 }}
                    aria-label="Restar"
                  >
                    −
                  </button>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={l.quantity}
                    onChange={(e) => setQty(l.product.id, Number(e.target.value))}
                    style={{ width: 54, textAlign: "center", padding: "6px 4px" }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setQty(l.product.id, l.quantity + 1)}
                    style={{ width: 34, minHeight: 34, padding: 0, fontSize: 18 }}
                    aria-label="Sumar"
                  >
                    +
                  </button>
                </div>

                <span style={{ width: 92, textAlign: "right", fontWeight: 700 }}>
                  ${(Number(l.product.salePrice) * l.quantity).toLocaleString("es-AR")}
                </span>

                <button
                  type="button"
                  onClick={() => setQty(l.product.id, 0)}
                  title="Quitar"
                  aria-label="Quitar"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--danger)",
                    fontSize: 18,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}

            <div className="field" style={{ marginTop: 16 }}>
              <span className="label">Medio de pago</span>
              <select
                className="input"
                value={payment}
                onChange={(e) => setPayment(e.target.value as PaymentMethod)}
              >
                {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <span className="label">
                Cliente{" "}
                {payment === "ACCOUNT" ? (
                  <span style={{ color: "var(--danger)" }}>(obligatorio para cuenta corriente)</span>
                ) : (
                  <span className="muted">(opcional)</span>
                )}
              </span>
              <select
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— Sin cliente —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {Number(c.balance) > 0
                      ? ` (debe $${Number(c.balance).toLocaleString("es-AR")})`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
              Total: ${total.toLocaleString("es-AR")}
            </p>

            {error && <p className="alert alert-error">⚠️ {error}</p>}

            <button
              onClick={confirm}
              disabled={cart.length === 0 || saving}
              className="btn btn-success btn-block"
            >
              {saving ? "Registrando…" : "Confirmar venta"}
            </button>
          </section>
        </div>
      </main>
    </>
  );
}
