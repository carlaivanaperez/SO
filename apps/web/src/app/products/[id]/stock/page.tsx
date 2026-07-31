"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchProduct,
  fetchWarehouses,
  adjustStock,
  ApiError,
  type ProductDetail,
  type Warehouse,
} from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";
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
  const [user, setUser] = useState<SessionUser | null>(null);
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
    const u = getUser();
    if (!canManage(u)) {
      router.replace("/");
      return;
    }
    setUser(u);
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
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 560 }}>
        <Link href="/">← Volver al panel</Link>
        <h1 style={{ marginTop: 8 }}>Ajustar stock</h1>
        {product && (
          <p className="muted">
            <strong style={{ color: "var(--text)" }}>{product.name}</strong> ({product.sku})
          </p>
        )}

        {ok && <p className="alert alert-success">✅ Movimiento registrado.</p>}

        <form onSubmit={onSubmit} className="card">
          <div className="field">
            <span className="label">Depósito</span>
            <select
              className="input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">Tipo de movimiento</span>
            <select
              className="input"
              value={type}
              onChange={(e) => setType(e.target.value as MovementType)}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="label">
              Cantidad <span className="muted">(negativo = egreso)</span>
            </span>
            <input
              className="input"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <span className="label">Motivo (opcional)</span>
            <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {error && <p className="alert alert-error">⚠️ {error}</p>}

          <button type="submit" disabled={saving || !warehouseId} className="btn btn-success">
            {saving ? "Registrando…" : "Registrar movimiento"}
          </button>
        </form>
      </main>
    </>
  );
}
