// Cliente HTTP hacia la API. Comparte tipos con el backend vía
// @ferrestock/shared, así el front y el back nunca se desincronizan.
import type {
  Paginated,
  AuthResponse,
  LoginInput,
  CreateSaleInput,
} from "@ferrestock/shared";
import { getToken } from "./auth";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  salePrice: string;
  stockItems: { quantity: string }[];
};

export type SaleResult = {
  id: string;
  number: number;
  total: string;
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
