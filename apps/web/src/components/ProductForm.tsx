"use client";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
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
    // Campos opcionales vacíos → undefined (no mandar "").
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
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="SKU (código interno)">
          <input value={sku} onChange={(e) => setSku(e.target.value)} required style={input} />
        </Field>
        <Field label="Código de barras">
          <input value={barcode} onChange={(e) => setBarcode(e.target.value)} style={input} />
        </Field>
      </div>

      <Field label="Nombre">
        <input value={name} onChange={(e) => setName(e.target.value)} required style={input} />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Marca">
          <input value={brand} onChange={(e) => setBrand(e.target.value)} style={input} />
        </Field>
        <Field label="Unidad">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as ProductUnitDTO)}
            style={input}
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
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          style={input}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Precio de costo">
          <input
            type="number"
            step="0.01"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            style={input}
          />
        </Field>
        <Field label="Precio de venta">
          <input
            type="number"
            step="0.01"
            min="0"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            required
            style={input}
          />
        </Field>
        <Field label="IVA %">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            style={input}
          />
        </Field>
      </div>

      {editing && (
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>Producto activo</span>
        </label>
      )}

      {error && <p style={{ color: "crimson", margin: 0 }}>⚠️ {error}</p>}

      <button type="submit" disabled={saving} style={button}>
        {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 13, color: "#444" }}>{label}</span>
      {children}
    </label>
  );
}

const input: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const button: CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 6,
  background: "#1a56db",
  color: "white",
  fontSize: 15,
  cursor: "pointer",
  justifySelf: "start",
};
