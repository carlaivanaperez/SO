"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProductForm } from "@/components/ProductForm";
import { getToken, getUser, canManage, type SessionUser } from "@/lib/auth";

export default function NewProductPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

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
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <Link href="/">← Volver al panel</Link>
        <h1 style={{ marginTop: 8 }}>Nuevo producto</h1>
        <ProductForm initial={null} />
      </main>
    </>
  );
}
