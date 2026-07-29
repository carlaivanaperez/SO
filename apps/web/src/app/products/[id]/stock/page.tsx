"use client";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchProduct,
  fetchWarehouses,
  adjustStock,
  ApiError,
  type ProductDetail,
  type Warehouse,
} from "@/lib/api";
import { getToken, getUser, canManage, clearSession } from "@/lib/auth";
import type { StockAdjustmentInput } from "@ferrestock/shared";

type MovementType = StockAdjustmentInput["type"];

const TYPES: { value: MovementType; label: string }[] = [
  { value: "PURCHASE", label: "Compra (ingreso)" },
  { value: "ADJUSTMENT", label: "Ajuste manual" },
  { value: "RETURN", label: "Devolución de cliente (ingreso)" },
  { value: "TRANSFER", label: "Transferencia" },
];

export default function StockPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState<MovementType>("PURCHASE");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (!canManage(getUser())) {
      router.replace("/");
      return;
    }
    Promise.all([fetchProduct(params.id), fetchWarehouses()])
      .then(([p, whs]) => {
        setProduct(p);
        setWarehouses(whs);
        if (whs[0]) setWarehouseId(whs[0].id);
      })
      .catch(handleError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  function handleError(e: unknown) {
    if (e instanceof ApiError && e.status === 401) {
      clearSession();
      router.replace("/login");
    } else {
      setError(e instanceof Error ? e.message : "Ocurrió un error");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    setSaving(true);
    try {
      await adjustStock(params.id, {
        warehouseId,
        type,
        quantity: Number(quantity),
        reason: reason.trim() || undefined,
      });
      setOk(true);
      setQuantity("1");
      setReason("");
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 560, margin: "0 auto" }}>
      <Link href="/">← Volver al panel</Link>
      <h1>Ajustar stock</h1>
      {product && (
        <p style={{ color: "#444" }}>
          <strong>{product.name}</strong> ({product.sku})
        </p>
      )}

      {ok && (
        <p style={{ background: "#e7f8ec", border: "1px solid #9fdcb3", padding: 12, borderRadius: 6 }}>
          ✅ Movimiento registrado.
        </p>
      )}

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#444" }}>Depósito</span>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} style={input}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#444" }}>Tipo de movimiento</span>
          <select value={type} onChange={(e) => setType(e.target.value as MovementType)} style={input}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#444" }}>
            Cantidad <span style={{ color: "#888" }}>(negativo = egreso)</span>
          </span>
          <input
            type="number"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
            style={input}
          />
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, color: "#444" }}>Motivo (opcional)</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={input} />
        </label>

        {error && <p style={{ color: "crimson", margin: 0 }}>⚠️ {error}</p>}

        <button type="submit" disabled={saving || !warehouseId} style={button}>
          {saving ? "Registrando…" : "Registrar movimiento"}
        </button>
      </form>
    </main>
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
  background: "#1a7f37",
  color: "white",
  fontSize: 15,
  cursor: "pointer",
  justifySelf: "start",
};
