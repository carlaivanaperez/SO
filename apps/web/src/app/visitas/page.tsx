"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { fetchVisits, ApiError, type VisitsReport } from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";

const fmtDate = (d: string) => {
  const parts = d.split("-");
  return `${parts[2]}/${parts[1]}`;
};

export default function VisitsPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [data, setData] = useState<VisitsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    // Métrica interna: solo ADMIN.
    if (u?.role !== "ADMIN") {
      router.replace("/panel");
      return;
    }
    setUser(u);
    fetchVisits()
      .then(setData)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudieron cargar las visitas");
        }
      });
  }, [router]);

  const maxCount = data ? Math.max(1, ...data.days.map((d) => d.count)) : 1;
  const reversedDays = data ? [...data.days].reverse() : [];

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <div className="page-head">
          <h1 style={{ margin: 0 }}>Visitas al catálogo</h1>
          <Link href="/panel" className="btn btn-outline">
            ← Volver al panel
          </Link>
        </div>
        <p className="muted">
          Contador propio del servidor (no depende del navegador del visitante, así que no lo puede
          bloquear ningún cliente). Cuenta cada vez que se abre el catálogo público.
        </p>

        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!data && !error && <p className="muted">Cargando…</p>}

        {data && (
          <>
            <div className="kpis" style={{ marginBottom: 16 }}>
              <div className="kpi">
                <div className="kpi-label">Hoy</div>
                <div className="kpi-value">{data.today}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Últimos 7 días</div>
                <div className="kpi-value">{data.last7}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Últimos 30 días</div>
                <div className="kpi-value">{data.last30}</div>
              </div>
              <div className="kpi kpi-money">
                <div className="kpi-label">Total histórico</div>
                <div className="kpi-value">{data.total}</div>
              </div>
            </div>

            <h3 style={{ marginBottom: 8 }}>Últimos días</h3>
            <div className="card">
              {reversedDays.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  Todavía no hay visitas registradas. Cuando alguien abra el catálogo, aparecen acá.
                </p>
              )}
              {reversedDays.map((d) => (
                <div
                  key={d.date}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}
                >
                  <span style={{ width: 52, fontSize: 13 }} className="muted">
                    {fmtDate(d.date)}
                  </span>
                  <div style={{ flex: 1, background: "var(--border)", borderRadius: 6, height: 18 }}>
                    <div
                      style={{
                        width: `${Math.round((d.count / maxCount) * 100)}%`,
                        background: "var(--yellow)",
                        height: "100%",
                        borderRadius: 6,
                        minWidth: d.count > 0 ? 6 : 0,
                      }}
                    />
                  </div>
                  <span style={{ width: 40, textAlign: "right", fontWeight: 700 }}>{d.count}</span>
                </div>
              ))}
            </div>

            <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Nota: cuenta aperturas del catálogo (incluye visitas del equipo y posibles recargas).
              Es una referencia de uso, no un número exacto de personas distintas.
            </p>
          </>
        )}
      </main>
    </>
  );
}
