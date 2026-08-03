"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  createCustomer,
  updateCustomer,
  ApiError,
  type CustomerDetail,
} from "@/lib/api";
import { clearSession } from "@/lib/auth";

export function CustomerForm({ initial }: { initial: CustomerDetail | null }) {
  const router = useRouter();
  const editing = initial !== null;

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [taxId, setTaxId] = useState(initial?.taxId ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || undefined,
      taxId: taxId.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    try {
      const saved = editing
        ? await updateCustomer(initial.id, payload)
        : await createCustomer(payload);
      router.push(`/clientes/${saved.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setError(err instanceof Error ? err.message : "No se pudo guardar el cliente");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card">
      <Field label="Nombre">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid-2">
        <Field label="Teléfono (WhatsApp, ej: +5491122334455)">
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="CUIT / DNI">
          <input className="input" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Dirección">
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      </div>
      <Field label="Notas">
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {error && <p className="alert alert-error">⚠️ {error}</p>}

      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear cliente"}
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
