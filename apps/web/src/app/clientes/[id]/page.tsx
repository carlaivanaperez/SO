"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchCustomer,
  addCustomerPayment,
  addCreditNote,
  ApiError,
  type CustomerDetail,
} from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";
import { whatsappUrl } from "@ferrestock/shared";

const PAYMENTS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
];
const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Formulario de pago
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Formulario de nota de crédito
  const [cnAmount, setCnAmount] = useState("");
  const [cnReason, setCnReason] = useState("");
  const [cnSaving, setCnSaving] = useState(false);
  const [cnError, setCnError] = useState<string | null>(null);

  const handleErr = useCallback(
    (e: unknown, setter: (m: string) => void) => {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setter(e instanceof Error ? e.message : "Ocurrió un error");
      }
    },
    [router]
  );

  const load = useCallback(() => {
    fetchCustomer(params.id)
      .then(setCustomer)
      .catch((e) => handleErr(e, setError));
  }, [params.id, handleErr]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    load();
  }, [router, load]);

  async function registerPayment(e: FormEvent) {
    e.preventDefault();
    setPayError(null);
    setSaving(true);
    try {
      await addCustomerPayment(params.id, {
        amount: Number(amount),
        method: method as "CASH" | "CARD" | "TRANSFER",
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      load();
    } catch (e) {
      handleErr(e, setPayError);
    } finally {
      setSaving(false);
    }
  }

  async function registerCreditNote(e: FormEvent) {
    e.preventDefault();
    setCnError(null);
    setCnSaving(true);
    try {
      await addCreditNote(params.id, {
        amount: Number(cnAmount),
        reason: cnReason.trim() || undefined,
      });
      setCnAmount("");
      setCnReason("");
      load();
    } catch (e) {
      handleErr(e, setCnError);
    } finally {
      setCnSaving(false);
    }
  }

  const manage = canManage(user);
  const balance = customer ? Number(customer.balance) : 0;

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 820 }}>
        <Link href="/clientes">← Volver a clientes</Link>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!customer && !error && <p className="muted">Cargando…</p>}

        {customer && (
          <>
            <div className="page-head" style={{ marginTop: 8 }}>
              <div>
                <h1 style={{ margin: 0 }}>{customer.name}</h1>
                <p className="muted" style={{ margin: 0 }}>
                  {[customer.phone, customer.taxId].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {whatsappUrl(customer.phone) && (
                  <a
                    href={whatsappUrl(customer.phone)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success"
                    title="Escribirle por WhatsApp"
                  >
                    WhatsApp
                  </a>
                )}
                {manage && (
                  <Link href={`/clientes/${customer.id}/edit`} className="btn btn-outline">
                    Editar
                  </Link>
                )}
              </div>
            </div>

            {/* Saldo */}
            <div
              className="kpi"
              style={{
                borderLeftColor:
                  balance > 0 ? "var(--danger)" : balance < 0 ? "var(--warn)" : "var(--success)",
                marginBottom: 16,
              }}
            >
              <div className="kpi-label">Saldo de cuenta corriente</div>
              <div className="kpi-value">
                {balance > 0
                  ? `Debe ${money(balance)}`
                  : balance < 0
                    ? `A favor ${money(-balance)}`
                    : "Al día ✓"}
              </div>
            </div>

            <div className="grid-2">
              {/* Registrar pago + Nota de crédito */}
              {manage && (
                <div style={{ display: "grid", gap: 16 }}>
                <section className="card">
                  <h2 style={{ fontSize: 16 }}>Registrar pago</h2>
                  <form onSubmit={registerPayment}>
                    <label className="field">
                      <span className="label">Monto</span>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="label">Medio</span>
                      <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                        {PAYMENTS.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="label">Nota (opcional)</span>
                      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    {payError && <p className="alert alert-error">⚠️ {payError}</p>}
                    <button type="submit" disabled={saving} className="btn btn-success">
                      {saving ? "Registrando…" : "Registrar pago"}
                    </button>
                  </form>
                </section>

                <section className="card">
                  <h2 style={{ fontSize: 16 }}>Nota de crédito</h2>
                  <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                    Crédito a favor del cliente (devolución, ajuste). Baja su saldo.
                  </p>
                  <form onSubmit={registerCreditNote}>
                    <label className="field">
                      <span className="label">Monto</span>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        min="0"
                        value={cnAmount}
                        onChange={(e) => setCnAmount(e.target.value)}
                        required
                      />
                    </label>
                    <label className="field">
                      <span className="label">Motivo (opcional)</span>
                      <input
                        className="input"
                        value={cnReason}
                        onChange={(e) => setCnReason(e.target.value)}
                        placeholder="Ej: devolución venta #12"
                      />
                    </label>
                    {cnError && <p className="alert alert-error">⚠️ {cnError}</p>}
                    <button type="submit" disabled={cnSaving} className="btn btn-outline">
                      {cnSaving ? "Registrando…" : "Emitir nota de crédito"}
                    </button>
                  </form>
                </section>
                </div>
              )}

              {/* Movimientos */}
              <section className="card" style={{ gridColumn: manage ? "auto" : "1 / -1" }}>
                <h2 style={{ fontSize: 16 }}>Movimientos</h2>
                {customer.movements.length === 0 && (
                  <p className="muted">Sin movimientos en la cuenta.</p>
                )}
                {customer.movements.map((m) => {
                  const icon = m.type === "SALE" ? "🧾" : m.type === "PAYMENT" ? "💵" : "📝";
                  const color =
                    m.type === "SALE"
                      ? "var(--danger)"
                      : m.type === "PAYMENT"
                        ? "var(--success)"
                        : "var(--warn)";
                  return (
                    <div key={m.id} className="list-row">
                      <span>
                        <strong>{icon} </strong>
                        {m.detail}
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          {fmtDate(m.date)}
                        </span>
                      </span>
                      <strong style={{ color }}>
                        {m.type === "SALE" ? "+" : "−"}
                        {money(m.amount)}
                      </strong>
                    </div>
                  );
                })}
              </section>
            </div>
          </>
        )}
      </main>
    </>
  );
}
