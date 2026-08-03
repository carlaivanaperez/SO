"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { CustomerForm } from "@/components/CustomerForm";
import { fetchCustomer, ApiError, type CustomerDetail } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";

export default function EditCustomerPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    if (!canManage(u)) {
      router.replace("/clientes");
      return;
    }
    setUser(u);
    fetchCustomer(params.id)
      .then(setCustomer)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudo cargar el cliente");
        }
      });
  }, [params.id, router]);

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <Link href={`/clientes/${params.id}`}>← Volver al cliente</Link>
        <h1 style={{ marginTop: 8 }}>Editar cliente</h1>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!customer && !error && <p className="muted">Cargando…</p>}
        {customer && <CustomerForm initial={customer} />}
      </main>
    </>
  );
}
