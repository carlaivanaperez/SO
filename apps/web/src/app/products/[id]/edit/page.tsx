"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProductForm } from "@/components/ProductForm";
import { ProductPromotions } from "@/components/ProductPromotions";
import { fetchProduct, ApiError, type ProductDetail } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    fetchProduct(params.id)
      .then(setProduct)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          clearSession();
          router.replace("/login");
        } else {
          setError(e instanceof Error ? e.message : "No se pudo cargar el producto");
        }
      });
  }, [params.id, router]);

  return (
    <>
      <AppHeader user={user} />
      <main className="container" style={{ maxWidth: 720 }}>
        <Link href="/">← Volver al panel</Link>
        <h1 style={{ marginTop: 8 }}>Editar producto</h1>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!product && !error && <p className="muted">Cargando…</p>}
        {product && <ProductForm initial={product} />}
        {product && <ProductPromotions productId={product.id} />}
      </main>
    </>
  );
}
