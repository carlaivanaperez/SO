"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ProductForm } from "@/components/ProductForm";
import { ProductPromotions } from "@/components/ProductPromotions";
import { fetchProduct, ApiError, type ProductDetail } from "@/lib/api";
import { getToken, getUser, canManage, clearSession, type SessionUser } from "@/lib/auth";
import { whatsappShareUrl, whatsappProductMessage } from "@ferrestock/shared";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

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
      router.replace("/panel");
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
        <Link href="/panel">← Volver al panel</Link>
        <div className="page-head" style={{ marginTop: 8 }}>
          <h1 style={{ margin: 0 }}>Editar producto</h1>
          {product && (
            <a
              href={whatsappShareUrl(whatsappProductMessage(product.name, Number(product.salePrice)))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-success"
              title="Compartir por WhatsApp (grupo/comunidad)"
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <WhatsAppIcon size={18} />
              Compartir
            </a>
          )}
        </div>
        {error && <p className="alert alert-error">⚠️ {error}</p>}
        {!product && !error && <p className="muted">Cargando…</p>}
        {product && <ProductForm initial={product} />}
        {product && <ProductPromotions productId={product.id} />}
      </main>
    </>
  );
}
