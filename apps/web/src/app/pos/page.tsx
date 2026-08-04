"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchProducts,
  createSale,
  fetchCustomers,
  fetchActivePromotions,
  fetchFinanceConfig,
  ApiError,
  type ProductRow,
  type SaleResult,
  type CustomerRow,
  type ActivePromotion,
  type FinanceConfig,
} from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";
import {
  promoLineDiscount,
  promoAppliesToPayment,
  surchargeForInstallments,
  splitInstallmentAmounts,
  type CreateSaleInput,
} from "@ferrestock/shared";
import { CustomerPicker } from "@/components/CustomerPicker";

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
  const [promos, setPromos] = useState<Record<string, ActivePromotion>>({});
  // Financiación en cuotas (solo cuenta corriente).
  const [financeConfig, setFinanceConfig] = useState<FinanceConfig | null>(null);
  const [financed, setFinanced] = useState(false);
  const [installments, setInstallments] = useState(1);
  const [applySurcharge, setApplySurcharge] = useState(false);
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
    fetchActivePromotions()
      .then((list) => setPromos(Object.fromEntries(list.map((p) => [p.productId, p]))))
      .catch(() => {});
    fetchFinanceConfig()
      .then((cfg) => {
        setFinanceConfig(cfg);
        if (cfg.options[0]) setInstallments(cfg.options[0].installments);
      })
      .catch(() => {});
  }, [router]);

  // Recarga clientes al volver a la pestaña (ej. tras cargar uno nuevo).
  useEffect(() => {
    function onFocus() {
      if (getToken()) fetchCustomers().then(setCustomers).catch(() => {});
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // Info de una línea con su promoción aplicada (descuento congelado en la venta).
  // La promo solo se aplica si el medio de pago elegido está habilitado.
  function lineInfo(l: CartLine) {
    const unit = Number(l.product.salePrice);
    const gross = unit * l.quantity;
    const promo = promos[l.product.id];
    const applies = promo ? promoAppliesToPayment(promo.paymentMethods, payment) : false;
    const discount =
      promo && applies
        ? promoLineDiscount(promo.type, promo.percent ? Number(promo.percent) : null, unit, l.quantity)
        : 0;
    return { unit, gross, discount, total: gross - discount, promo, applies };
  }

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
    () => cart.reduce((sum, l) => sum + lineInfo(l).total, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cart, promos, payment]
  );

  // Preview de financiación (estimado; el total real lo calcula la API con IVA).
  const surchargePercent =
    financed && applySurcharge && financeConfig
      ? surchargeForInstallments(financeConfig.options, installments) ?? 0
      : 0;
  const financedTotal = Math.round(total * (1 + surchargePercent / 100) * 100) / 100;
  const perInstallment =
    financed && installments > 0 ? splitInstallmentAmounts(financedTotal, installments) : [];

  async function confirm() {
    if (cart.length === 0) return;
    if (payment === "ACCOUNT" && !customerId) {
      setError("Para una venta a cuenta corriente elegí un cliente.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const useFinancing = payment === "ACCOUNT" && financed;
      const input: CreateSaleInput = {
        paymentMethod: payment,
        discount: 0,
        customerId: customerId || undefined,
        installments: useFinancing ? installments : undefined,
        applyFinancingSurcharge: useFinancing ? applySurcharge : false,
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          discount: Math.round(lineInfo(l).discount * 100) / 100,
        })),
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
        <h1>Punto de venta</h1>

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
            {cart.map((l) => {
              const info = lineInfo(l);
              return (
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
                    ${info.unit.toLocaleString("es-AR")} c/u
                    {info.promo && info.applies && (
                      <span className="badge badge-warn" style={{ marginLeft: 6 }}>
                        {info.promo.type === "PERCENT"
                          ? `${Number(info.promo.percent ?? 0)}% off`
                          : "2x1"}
                      </span>
                    )}
                    {info.promo && !info.applies && (
                      <span style={{ marginLeft: 6, fontSize: 12, color: "var(--muted)" }}>
                        (promo no aplica a este pago)
                      </span>
                    )}
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

                <span style={{ width: 100, textAlign: "right", fontWeight: 700 }}>
                  {info.discount > 0 && (
                    <span
                      className="muted"
                      style={{ display: "block", fontSize: 12, textDecoration: "line-through", fontWeight: 400 }}
                    >
                      ${info.gross.toLocaleString("es-AR")}
                    </span>
                  )}
                  ${info.total.toLocaleString("es-AR")}
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
              );
            })}

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
              <CustomerPicker
                customers={customers}
                value={customerId}
                onChange={setCustomerId}
                onCreated={(c) => setCustomers((prev) => [c, ...prev])}
              />
            </div>

            {/* Financiación en cuotas (solo cuenta corriente) */}
            {payment === "ACCOUNT" && financeConfig && (
              <div className="card" style={{ padding: 12, marginTop: 4, background: "var(--bg)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={financed}
                    onChange={(e) => setFinanced(e.target.checked)}
                  />
                  <strong>Financiar en cuotas</strong>
                </label>

                {financed && (
                  <div style={{ marginTop: 10 }}>
                    <div className="field">
                      <span className="label">Cantidad de cuotas</span>
                      <select
                        className="input"
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                      >
                        {financeConfig.options.map((o) => (
                          <option key={o.installments} value={o.installments}>
                            {o.installments} {o.installments === 1 ? "pago" : "cuotas"}
                            {o.surchargePercent > 0 ? ` (+${o.surchargePercent}% si aplica recargo)` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 4 }}>
                      <input
                        type="checkbox"
                        checked={applySurcharge}
                        onChange={(e) => setApplySurcharge(e.target.checked)}
                      />
                      Aplicar recargo por financiación
                    </label>

                    {perInstallment.length > 0 && (
                      <div className="muted" style={{ fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
                        {surchargePercent > 0 && (
                          <div>
                            Recargo {surchargePercent}% → total ${financedTotal.toLocaleString("es-AR")}
                          </div>
                        )}
                        <div>
                          {installments === 1
                            ? `1 pago de $${(perInstallment[0] ?? 0).toLocaleString("es-AR")}`
                            : `${installments} cuotas de ~$${(perInstallment[0] ?? 0).toLocaleString("es-AR")}`}
                        </div>
                        <div>1ª cuota vence en 1 mes (luego una por mes).</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
              Total: ${total.toLocaleString("es-AR")}
              {payment === "ACCOUNT" && financed && surchargePercent > 0 && (
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--muted)" }}>
                  {" "}
                  · con recargo ${financedTotal.toLocaleString("es-AR")}
                </span>
              )}
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
