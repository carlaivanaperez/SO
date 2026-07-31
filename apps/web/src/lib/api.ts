// Cliente HTTP hacia la API. Comparte tipos con el backend vía
// @ferrestock/shared, así el front y el back nunca se desincronizan.
import type {
  Paginated,
  AuthResponse,
  LoginInput,
  CreateSaleInput,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustmentInput,
  ProductUnitDTO,
} from "@ferrestock/shared";
import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  stockItems: { quantity: string; minQuantity: string }[];
};

export type SaleResult = {
  id: string;
  number: number;
  total: string;
};

// Detalle de producto (los Decimal de Prisma llegan como string por JSON).
export type ProductDetail = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  unit: ProductUnitDTO;
  costPrice: string;
  salePrice: string;
  taxRate: string;
  active: boolean;
};

export type Warehouse = {
  id: string;
  name: string;
  isDefault: boolean;
};

// Error con el status HTTP, para que la UI distinga 401 (relogin) de otros.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

// fetch autenticado: adjunta el Bearer token y normaliza errores.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) msg = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      /* respuesta sin body JSON */
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProducts(search = ""): Promise<Paginated<ProductRow>> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<Paginated<ProductRow>>(`/api/products${qs}`);
}

export async function createSale(input: CreateSaleInput): Promise<SaleResult> {
  return request<SaleResult>("/api/sales", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchProduct(id: string): Promise<ProductDetail> {
  return request<ProductDetail>(`/api/products/${id}`);
}

export async function createProduct(input: CreateProductInput): Promise<ProductDetail> {
  return request<ProductDetail>("/api/products", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<ProductDetail> {
  return request<ProductDetail>(`/api/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function adjustStock(id: string, input: StockAdjustmentInput): Promise<unknown> {
  return request(`/api/products/${id}/stock`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchWarehouses(): Promise<Warehouse[]> {
  return request<Warehouse[]>("/api/warehouses");
}
