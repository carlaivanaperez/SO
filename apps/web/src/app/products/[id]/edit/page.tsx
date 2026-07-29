"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ProductForm } from "@/components/ProductForm";
import { fetchProduct, ApiError, type ProductDetail } from "@/lib/api";
import { getToken, getUser, canManage, clearSession } from "@/lib/auth";

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    if (!canManage(getUser())) {
      router.replace("/");
      return;
    }
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
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <Link href="/">← Volver al panel</Link>
      <h1>Editar producto</h1>
      {error && <p style={{ color: "crimson" }}>⚠️ {error}</p>}
      {!product && !error && <p style={{ color: "#888" }}>Cargando…</p>}
      {product && <ProductForm initial={product} />}
    </main>
  );
}
