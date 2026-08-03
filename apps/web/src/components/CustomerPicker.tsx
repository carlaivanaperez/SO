"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { CustomerRow } from "@/lib/api";

// Selector de cliente con búsqueda. Muestra coincidencias mientras escribís y
// un acceso para cargar un cliente nuevo (en otra pestaña).
export function CustomerPicker({
  customers,
  value,
  onChange,
}: {
  customers: CustomerRow[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
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

  return (
    <div>
      <input
        className="input"
        placeholder="🔎 Buscar cliente por nombre, teléfono o DNI…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim() !== "" && (
        <div
          className="card"
          style={{ padding: 6, marginTop: 4, maxHeight: 220, overflowY: "auto" }}
        >
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
              <strong>{c.name}</strong>{" "}
              <span className="muted">{c.phone ?? c.taxId ?? ""}</span>
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
        <Link href="/clientes/new" target="_blank" style={{ fontSize: 14 }}>
          + Cargar un cliente nuevo
        </Link>
      </div>
    </div>
  );
}
