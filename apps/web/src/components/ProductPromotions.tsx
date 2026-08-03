"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  fetchProductPromotions,
  createPromotion,
  deletePromotion,
  type ProductPromotion,
} from "@/lib/api";

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-AR");

function label(p: ProductPromotion): string {
  return p.type === "PERCENT" ? `${Number(p.percent ?? 0)}% de descuento` : "2x1";
}

export function ProductPromotions({ productId }: { productId: string }) {
  const [promos, setPromos] = useState<ProductPromotion[]>([]);
  const [type, setType] = useState<"PERCENT" | "TWO_FOR_ONE">("PERCENT");
  const [percent, setPercent] = useState("10");
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
        startDate,
        endDate,
      });
      setStartDate("");
      setEndDate("");
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
                {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
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
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? "Guardando…" : "Agregar promoción"}
        </button>
      </form>
    </section>
  );
}
