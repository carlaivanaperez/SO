"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import {
  fetchFinanceConfig,
  updateFinanceConfig,
  fetchStoreSettings,
  updateStoreSettings,
  ApiError,
} from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";

type Row = { installments: string; surchargePercent: string };

export default function ConfigPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [lateFee, setLateFee] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  // Datos del negocio (para el catálogo público).
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeMsg, setStoreMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    // La config de tasas es solo para el ADMIN.
    if (u?.role !== "ADMIN") {
      router.replace("/panel");
      return;
    }
    setUser(u);
    fetchFinanceConfig()
      .then((cfg) => {
        setLateFee(String(cfg.lateFeeDailyPercent));
        setRows(
          cfg.options.map((o) => ({
            installments: String(o.installments),
            surchargePercent: String(o.surchargePercent),
          }))
        );
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudo cargar la configuración");
        }
      });
    fetchStoreSettings()
      .then((s) => {
        setStoreName(s.storeName);
        setStorePhone(s.whatsappPhone ?? "");
      })
      .catch(() => {});
  }, [router]);

  async function saveStore() {
    setStoreMsg(null);
    if (!storeName.trim()) {
      setStoreMsg({ ok: false, text: "El nombre del negocio no puede estar vacío." });
      return;
    }
    setStoreSaving(true);
    try {
      const s = await updateStoreSettings({
        storeName: storeName.trim(),
        whatsappPhone: storePhone.trim() || null,
      });
      setStorePhone(s.whatsappPhone ?? "");
      setStoreMsg({ ok: true, text: "Datos del negocio guardados." });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setStoreMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar" });
      }
    } finally {
      setStoreSaving(false);
    }
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { installments: "", surchargePercent: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError(null);
    setOk(false);
    const options = rows
      .filter((r) => r.installments.trim() !== "")
      .map((r) => ({
        installments: Number(r.installments),
        surchargePercent: Number(r.surchargePercent || 0),
      }));
    if (options.length === 0) {
      setError("Tiene que haber al menos una opción de cuotas.");
      return;
    }
    const seen = new Set<number>();
    for (const o of options) {
      if (!Number.isInteger(o.installments) || o.installments < 1) {
        setError("Las cuotas tienen que ser números enteros ≥ 1.");
        return;
      }
      if (seen.has(o.installments)) {
        setError(`Hay dos filas con ${o.installments} cuotas. Dejá una sola.`);
        return;
      }
      seen.add(o.installments);
    }
    setSaving(true);
    try {
      await updateFinanceConfig({ lateFeeDailyPercent: Number(lateFee || 0), options });
      setOk(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setError(e instanceof Error ? e.message : "No se pudo guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <h1>Configuración</h1>

        {/* Datos del negocio (catálogo público) */}
        <section className="card" style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 16 }}>Datos del negocio</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Se usan en el <strong>catálogo público</strong> (la página que ven los clientes, sin
            login). El WhatsApp es el número al que llegan los pedidos y consultas.
          </p>
          <label className="field">
            <span className="label">Nombre del negocio</span>
            <input
              className="input"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="field">
            <span className="label">WhatsApp del negocio</span>
            <input
              className="input"
              value={storePhone}
              onChange={(e) => setStorePhone(e.target.value)}
              placeholder="Ej: 3624721664"
              inputMode="tel"
            />
          </label>
          {storeMsg && (
            <p className={`alert ${storeMsg.ok ? "alert-success" : "alert-error"}`}>
              {storeMsg.ok ? "✅" : "⚠️"} {storeMsg.text}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveStore} disabled={storeSaving} className="btn btn-primary">
              {storeSaving ? "Guardando…" : "Guardar datos del negocio"}
            </button>
            <Link href="/" target="_blank" className="btn btn-outline">
              Ver catálogo público ↗
            </Link>
          </div>
        </section>

        <h1 style={{ marginTop: 28 }}>Cuenta corriente</h1>
        <p className="muted">
          Definí el recargo por financiar en cuotas y el interés por mora (atraso). Estos valores se
          usan al vender a cuenta corriente.
        </p>

        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {ok && <p className="alert alert-success">✅ Configuración guardada.</p>}

        <section className="card" style={{ marginTop: 8 }}>
          <h2 style={{ fontSize: 16 }}>Recargo por cuotas</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Cuántas cuotas se pueden elegir y qué recargo (%) se suma al total si el vendedor aplica
            el recargo. Ej: 1 pago = 0%, 3 cuotas = 10%.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Cuotas</th>
                <th>Recargo (%)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={r.installments}
                      onChange={(e) => setRow(i, { installments: e.target.value })}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      step="0.01"
                      value={r.surchargePercent}
                      onChange={(e) => setRow(i, { surchargePercent: e.target.value })}
                      style={{ width: 120 }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="btn btn-outline"
                      title="Quitar"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-outline" onClick={addRow} style={{ marginTop: 8 }}>
            + Agregar opción de cuotas
          </button>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16 }}>Interés por mora</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Porcentaje por día que suma una cuota vencida impaga. Ej: 0,3 = 0,3% por día (≈ 9% al
            mes). Poné 0 para no cobrar mora.
          </p>
          <label className="field" style={{ maxWidth: 220 }}>
            <span className="label">% por día</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={lateFee}
              onChange={(e) => setLateFee(e.target.value)}
            />
          </label>
        </section>

        <button
          onClick={save}
          disabled={saving}
          className="btn btn-primary"
          style={{ marginTop: 16 }}
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
      </main>
    </>
  );
}
