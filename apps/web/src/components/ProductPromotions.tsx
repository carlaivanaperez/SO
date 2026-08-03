"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchProductPromotions,
  createPromotion,
  deletePromotion,
  type ProductPromotion,
} from "@/lib/api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR");

type PayMethod = "CASH" | "CARD" | "TRANSFER" | "ACCOUNT";
const PAYMENT_METHODS: { value: PayMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta (débito/crédito)" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "ACCOUNT", label: "Cuenta corriente" },
];
const PM_SHORT: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ACCOUNT: "Cta. corriente",
};

function label(p: ProductPromotion): string {
  return p.type === "PERCENT" ? `${Number(p.percent ?? 0)}% de descuento` : "2x1";
}

function methodsLabel(methods: string[]): string {
  if (!methods || methods.length === 0) return "Todos los medios de pago";
  return methods.map((m) => PM_SHORT[m] ?? m).join(", ");
}

export function ProductPromotions({ productId }: { productId: string }) {
  const [promos, setPromos] = useState<ProductPromotion[]>([]);
  const [type, setType] = useState<"PERCENT" | "TWO_FOR_ONE">("PERCENT");
  const [percent, setPercent] = useState("10");
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchProductPromotions(productId)
      .then(setPromos)
      .catch(() => {});
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createPromotion({
        productId,
        type,
        percent: type === "PERCENT" ? Number(percent) : undefined,
        paymentMethods: methods,
        startDate,
        endDate,
      });
      setStartDate("");
      setEndDate("");
      setMethods([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la promoción");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await deletePromotion(id).catch(() => {});
    load();
  }

  const now = Date.now();

  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: 16 }}>Promociones</h2>

      {promos.length === 0 && <p className="muted">Sin promociones para este producto.</p>}
      {promos.map((p) => {
        const vigente =
          p.active && new Date(p.startDate).getTime() <= now && new Date(p.endDate).getTime() >= now;
        return (
          <div key={p.id} className="list-row">
            <span>
              <strong>{label(p)}</strong>{" "}
              {vigente ? (
                <span className="badge badge-ok">Vigente</span>
              ) : (
                <span className="badge">Programada / vencida</span>
              )}
              <br />
              <span className="muted" style={{ fontSize: 12 }}>
                {fmtDate(p.startDate)} → {fmtDate(p.endDate)} · 💳 {methodsLabel(p.paymentMethods)}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(p.id)}
              title="Quitar"
              style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: 18 }}
            >
              ×
            </button>
          </div>
        );
      })}

      <form onSubmit={add} style={{ marginTop: 12 }}>
        <div className="grid-2">
          <label className="field">
            <span className="label">Tipo</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as "PERCENT" | "TWO_FOR_ONE")}
            >
              <option value="PERCENT">% de descuento</option>
              <option value="TWO_FOR_ONE">2x1</option>
            </select>
          </label>
          {type === "PERCENT" && (
            <label className="field">
              <span className="label">% de descuento</span>
              <input
                className="input"
                type="number"
                min="1"
                max="100"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
              />
            </label>
          )}
        </div>
        <div className="grid-2">
          <label className="field">
            <span className="label">Desde</span>
            <input
              className="input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="label">Hasta</span>
            <input
              className="input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </label>
        </div>

        <div className="field">
          <span className="label">Válida con estos medios de pago</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {PAYMENT_METHODS.map((pm) => (
              <label key={pm.value} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={methods.includes(pm.value)}
                  onChange={(e) =>
                    setMethods((prev) =>
                      e.target.checked
                        ? [...prev, pm.value]
                        : prev.filter((m) => m !== pm.value)
                    )
                  }
                />
                <span>{pm.label}</span>
              </label>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 12 }}>
            Si no marcás ninguno, la promo aplica a <strong>todos</strong> los medios.
          </span>
        </div>

        {error && <p className="alert alert-error">⚠️ {error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando…" : "Agregar promoción"}
        </button>
      </form>
    </section>
  );
}
