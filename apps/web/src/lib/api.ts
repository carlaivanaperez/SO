// Cliente HTTP mínimo hacia la API. Comparte tipos con el backend vía
// @ferrestock/shared, así el front y el back nunca se desincronizan.
import type { Paginated } from "@ferrestock/shared";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  stockItems: { quantity: string }[];
};

export async function fetchProducts(search = ""): Promise<Paginated<ProductRow>> {
  const url = new URL(`${BASE}/api/products`);
  if (search) url.searchParams.set("search", search);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar el catálogo");
  return res.json();
}
