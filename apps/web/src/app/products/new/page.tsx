"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProductForm } from "@/components/ProductForm";
import { getToken, getUser, canManage } from "@/lib/auth";

export default function NewProductPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (!canManage(getUser())) {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <Link href="/">← Volver al panel</Link>
      <h1>Nuevo producto</h1>
      <ProductForm initial={null} />
    </main>
  );
}
