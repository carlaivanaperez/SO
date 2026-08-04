"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchCustomers, ApiError, type CustomerRow } from "@/lib/api";
import { getToken, getUser, clearSession, canManage, type SessionUser } from "@/lib/auth";
import { whatsappUrl, whatsappGreeting, whatsappDebtMessage } from "@ferrestock/shared";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const money = (v: string | number) => `$${Number(v).toLocaleString("es-AR")}`;

export default function CustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [onlyDebt, setOnlyDebt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setUser(getUser());
  }, [router]);

  useEffect(() => {
    if (!getToken()) return;
    const t = setTimeout(() => {
      fetchCustomers(search)
        .then((res) => {
          setRows(res);
          setError(null);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            clearSession();
            router.replace("/login");
          } else {
            setError(e instanceof Error ? e.message : "Error al cargar clientes");
          }
        });
    }, 250);
    return () => clearTimeout(t);
  }, [search, router]);

  const manage = canManage(user);
  const visible = onlyDebt ? rows.filter((c) => Number(c.balance) > 0) : rows;

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <div className="page-head">
          <h1 style={{ margin: 0 }}>Clientes</h1>
          {manage && (
            <Link href="/clientes/new" className="btn btn-primary">
              + Nuevo cliente
            </Link>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 16,
          }}
        >
          <input
            className="input"
            placeholder="🔎 Buscar por nombre, teléfono o CUIT/DNI…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 220, marginBottom: 0 }}
          />
          <label
            style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          >
            <input
              type="checkbox"
              checked={onlyDebt}
              onChange={(e) => setOnlyDebt(e.target.checked)}
            />
            Solo con deuda
          </label>
        </div>

        {error && <p className="alert alert-error">⚠️ {error}</p>}

        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>WhatsApp</th>
                <th>Saldo (cta. cte.)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const bal = Number(c.balance);
                // Si el cliente debe, el mensaje precargado recuerda la deuda.
                const waText =
                  bal > 0 ? whatsappDebtMessage(c.name, bal) : whatsappGreeting(c.name);
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                    </td>
                    <td>
                      {whatsappUrl(c.phone) ? (
                        <a
                          href={whatsappUrl(c.phone, waText)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={bal > 0 ? "Recordar deuda por WhatsApp" : "Escribirle por WhatsApp"}
                          aria-label={bal > 0 ? "Recordar deuda por WhatsApp" : "Escribirle por WhatsApp"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "#25D366",
                            color: "#fff",
                          }}
                        >
                          <WhatsAppIcon size={22} />
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {bal > 0 ? (
                        <span className="badge badge-low">Debe {money(bal)}</span>
                      ) : (
                        <span className="badge badge-ok">Al día</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/clientes/${c.id}`}>Ver</Link>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && !error && (
                <tr>
                  <td colSpan={4} className="muted" style={{ padding: 24 }}>
                    {onlyDebt ? "Ningún cliente tiene deuda. 👍" : "No hay clientes todavía."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
