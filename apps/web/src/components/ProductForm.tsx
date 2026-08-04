"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct, ApiError, type ProductDetail } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import { computeMargin, priceFromMargin, type ProductUnitDTO } from "@ferrestock/shared";

const money = (n: number) => `$${n.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

const UNITS: { value: ProductUnitDTO; label: string }[] = [
  { value: "UNIT", label: "Unidad" },
  { value: "KG", label: "Kilo" },
  { value: "METER", label: "Metro" },
  { value: "LITER", label: "Litro" },
  { value: "BOX", label: "Caja" },
];

// Alta si `initial` es null; edición si trae un producto.
export function ProductForm({ initial }: { initial: ProductDetail | null }) {
  const router = useRouter();
  const editing = initial !== null;

  const [sku, setSku] = useState(initial?.sku ?? "");
  const [barcode, setBarcode] = useState(initial?.barcode ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [unit, setUnit] = useState<ProductUnitDTO>(initial?.unit ?? "UNIT");
  const [costPrice, setCostPrice] = useState(initial?.costPrice ?? "0");
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? "");
  const [taxRate, setTaxRate] = useState(initial?.taxRate ?? "21");
  const [active, setActive] = useState(initial?.active ?? true);
  const [desiredMargin, setDesiredMargin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Ganancia y margen (neto contra neto). Solo se muestra si hay costo y precio.
  const cost = Number(costPrice);
  const price = Number(salePrice);
  const rate = Number(taxRate) || 0;
  const showMargin = cost > 0 && price > 0;
  const margin = showMargin ? computeMargin(cost, price, rate) : null;

  function applyMarginSuggestion() {
    const m = Number(desiredMargin);
    if (!cost || !m || m <= 0 || m >= 100) return;
    const suggested = priceFromMargin(cost, m);
    if (suggested > 0) setSalePrice(String(suggested));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      sku: sku.trim(),
      barcode: barcode.trim() || undefined,
      name: name.trim(),
      brand: brand.trim() || undefined,
      description: description.trim() || undefined,
      unit,
      costPrice: Number(costPrice),
      salePrice: Number(salePrice),
      taxRate: Number(taxRate),
    };
    try {
      if (editing) {
        await updateProduct(initial.id, { ...payload, active });
      } else {
        await createProduct(payload);
      }
      router.push("/panel");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el producto");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <div className="grid-2">
        <Field label="SKU (código interno)">
          <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} required />
        </Field>
        <Field label="Código de barras">
          <input className="input" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </Field>
      </div>

      <Field label="Nombre">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>

      <div className="grid-2">
        <Field label="Marca">
          <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label="Unidad">
          <select
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnitDTO)}
          >
            {UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Descripción">
        <textarea
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>

      <div className="grid-3">
        <Field label="Precio de costo">
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
          />
        </Field>
        <Field label="Precio de venta (IVA incluido)">
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            required
          />
        </Field>
        <Field label="IVA % (ya incluido)">
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </Field>
      </div>
      <p className="muted" style={{ marginTop: -4, fontSize: 13 }}>
        Poné el precio final que paga el cliente y el costo como viene en la factura del proveedor
        (ambos con IVA). El IVA se calcula solo; la ganancia se saca sin IVA en los dos.
      </p>

      {/* Ganancia y margen en vivo */}
      {margin && (
        <div
          className="card"
          style={{ background: "var(--bg)", padding: 12, marginBottom: 12 }}
        >
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Ganancia (sin IVA)</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: margin.profit >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {money(margin.profit)}
              </div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Margen (sobre la venta)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{margin.marginOnPrice}%</div>
            </div>
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Recargo (sobre el costo)</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{margin.markupOnCost}%</div>
            </div>
          </div>
          {margin.profit < 0 && (
            <p className="muted" style={{ margin: "8px 0 0", color: "var(--danger)", fontSize: 13 }}>
              ⚠️ Estás vendiendo por debajo del costo.
            </p>
          )}
        </div>
      )}

      {/* Sugerir precio a partir del margen deseado */}
      <div
        style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}
      >
        <label className="field" style={{ marginBottom: 0, maxWidth: 220 }}>
          <span className="label">¿Qué margen querés? (%)</span>
          <input
            className="input"
            type="number"
            min="0"
            max="99"
            step="0.1"
            value={desiredMargin}
            onChange={(e) => setDesiredMargin(e.target.value)}
            placeholder="Ej: 40"
          />
        </label>
        <button
          type="button"
          className="btn btn-outline"
          onClick={applyMarginSuggestion}
          disabled={!cost || !desiredMargin}
          title="Calcula el precio de venta para ese margen (necesita el costo cargado)"
        >
          Sugerir precio
        </button>
      </div>

      {editing && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Producto activo</span>
        </label>
      )}

      {error && <p className="alert alert-error">⚠️ {error}</p>}

      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
