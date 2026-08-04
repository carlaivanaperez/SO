"use client";
import { useMemo, useState, type FormEvent } from "react";
import { createCustomer, type CustomerRow } from "@/lib/api";
import { normalizeArPhone } from "@ferrestock/shared";

// Selector de cliente con búsqueda + alta rápida en el mismo lugar (para
// cargar un cliente sin salir de la venta).
export function CustomerPicker({
  customers,
  value,
  onChange,
  onCreated,
}: {
  customers: CustomerRow[];
  value: string;
  onChange: (id: string) => void;
  onCreated?: (c: CustomerRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = customers.find((c) => c.id === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.taxId ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customers, query]);

  async function saveNew(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let phone: string | undefined;
    if (newPhone.trim()) {
      const n = normalizeArPhone(newPhone);
      if (!n) {
        setError("Revisá el celular (ej: 3624721664)");
        return;
      }
      phone = n;
    }
    setSaving(true);
    try {
      const created = await createCustomer({ name: newName.trim(), phone });
      const row: CustomerRow = {
        id: created.id,
        name: newName.trim(),
        phone: phone ?? null,
        taxId: null,
        balance: "0",
      };
      onCreated?.(row);
      onChange(row.id);
      setAdding(false);
      setNewName("");
      setNewPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el cliente");
    } finally {
      setSaving(false);
    }
  }

  if (selected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="badge badge-ok" style={{ padding: "6px 12px" }}>
          {selected.name}
        </span>
        <button type="button" className="btn btn-outline" onClick={() => onChange("")}>
          Cambiar
        </button>
      </div>
    );
  }

  // Formulario de alta rápida
  if (adding) {
    return (
      <form onSubmit={saveNew} className="card" style={{ padding: 12 }}>
        <label className="field" style={{ marginBottom: 8 }}>
          <span className="label">Nombre del cliente</span>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus />
        </label>
        <label className="field" style={{ marginBottom: 8 }}>
          <span className="label">Celular (opcional)</span>
          <input
            className="input"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Ej: 3624721664"
            inputMode="tel"
          />
        </label>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? "Guardando…" : "Guardar y usar"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setAdding(false)}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <input
        className="input"
        placeholder="🔎 Buscar cliente por nombre, teléfono o DNI…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() !== "" && (
        <div className="card" style={{ padding: 6, marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.id);
                setQuery("");
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                padding: "8px 6px",
                cursor: "pointer",
                color: "var(--text)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <strong>{c.name}</strong> <span className="muted">{c.phone ?? c.taxId ?? ""}</span>
            </button>
          ))}
          {matches.length === 0 && (
            <p className="muted" style={{ padding: 8, margin: 0 }}>
              Sin coincidencias.
            </p>
          )}
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        <button type="button" className="btn btn-outline" onClick={() => setAdding(true)}>
          + Cargar cliente nuevo
        </button>
      </div>
    </div>
  );
}
