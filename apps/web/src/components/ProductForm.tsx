"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct, ApiError, type ProductDetail } from "@/lib/api";
import { clearSession } from "@/lib/auth";
import type { ProductUnitDTO } from "@ferrestock/shared";

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

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      router.push("/");
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
        <Field label="Precio de venta">
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
        <Field label="IVA %">
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
