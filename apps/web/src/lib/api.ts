// Cliente HTTP hacia la API. Comparte tipos con el backend vía
// @ferrestock/shared, así el front y el back nunca se desincronizan.
import type {
  Paginated,
  AuthResponse,
  LoginInput,
  RegisterInput,
  UpdateUserInput,
  StaffUser,
  CreateSaleInput,
  CreateProductInput,
  UpdateProductInput,
  StockAdjustmentInput,
  ProductUnitDTO,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerPaymentInput,
  CreditNoteInput,
  CreatePromotionInput,
  FinanceConfig,
  UpdateFinanceConfigInput,
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

export type DashboardSummary = {
  today: {
    count: number;
    revenue: string | null;
    profit: string | null; // ganancia estimada de hoy (solo gestión)
    profitPartial: boolean; // true si hay ítems sin costo cargado (estimación parcial)
  };
  lowStock: { count: number; items: { id: string; name: string; stock: string; min: string }[] };
  recentSales: {
    id: string;
    number: number;
    total: string;
    createdAt: string;
    paymentMethod: string | null;
    itemCount: number;
  }[];
};

export async function fetchSummary(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/api/reports/summary");
}

export type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  stock: string;
  min: string;
  toBuy: string;
};

export async function fetchLowStock(): Promise<LowStockItem[]> {
  return request<LowStockItem[]>("/api/reports/low-stock");
}

export type MarginRow = {
  id: string;
  name: string;
  sku: string;
  cost: number;
  price: number;
  profit: number;
  marginOnPrice: number;
  markupOnCost: number;
  hasCost: boolean;
};

export async function fetchMargins(): Promise<MarginRow[]> {
  return request<MarginRow[]>("/api/reports/margins");
}

export type MonthlyReport = {
  month: string;
  totals: {
    count: number;
    revenue: string;
    tax: string;
    profit: string;
    profitPartial: boolean;
    avgTicket: string;
    payments: string;
  };
  byPayment: { method: string | null; count: number; total: string }[];
  topProducts: { productId: string; name: string; sku: string; quantity: string; revenue: string }[];
};

export async function fetchMonthlyReport(month: string): Promise<MonthlyReport> {
  return request<MonthlyReport>(`/api/reports/monthly?month=${encodeURIComponent(month)}`);
}

// ── Historial de ventas ──────────────────────────────────────
export type SaleListRow = {
  id: string;
  number: number;
  total: string;
  createdAt: string;
  paymentMethod: string | null;
  user: { name: string } | null;
  customer: { name: string } | null;
  _count: { items: number };
};

export type SalesFilters = {
  from?: string;
  to?: string;
  paymentMethod?: string;
  product?: string;
  page?: number;
};

export async function fetchSales(filters: SalesFilters): Promise<Paginated<SaleListRow>> {
  const qs = new URLSearchParams();
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.paymentMethod) qs.set("paymentMethod", filters.paymentMethod);
  if (filters.product) qs.set("product", filters.product);
  if (filters.page) qs.set("page", String(filters.page));
  const q = qs.toString();
  return request<Paginated<SaleListRow>>(`/api/sales${q ? `?${q}` : ""}`);
}

export type SaleDetail = {
  id: string;
  number: number;
  createdAt: string;
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
  paymentMethod: string | null;
  customer: { name: string } | null;
  items: {
    id: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    total: string;
    product: { name: string; sku: string };
  }[];
};

export async function fetchSale(id: string): Promise<SaleDetail> {
  return request<SaleDetail>(`/api/sales/${id}`);
}

// ── Clientes y cuentas corrientes ────────────────────────────
export type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  taxId: string | null;
  balance: string; // saldo cta. corriente (positivo = nos debe)
};

export type CustomerMovement = {
  id: string;
  type: "SALE" | "PAYMENT" | "CREDIT";
  date: string;
  amount: string;
  detail: string;
  method: string | null;
};

export type CustomerInstallment = {
  saleNumber: number;
  number: number;
  amount: number;
  paid: number;
  dueDate: string;
  status: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE";
  lateFee: number;
  overdueDays: number;
};

export type CustomerDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  address: string | null;
  notes: string | null;
  balance: string; // saldo capital (sin mora)
  lateFee: string; // mora acumulada por cuotas vencidas
  totalDue: string; // capital + mora
  installments: CustomerInstallment[];
  movements: CustomerMovement[];
};

export async function fetchCustomers(search = ""): Promise<CustomerRow[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return request<CustomerRow[]>(`/api/customers${qs}`);
}

export async function fetchCustomer(id: string): Promise<CustomerDetail> {
  return request<CustomerDetail>(`/api/customers/${id}`);
}

export async function createCustomer(input: CreateCustomerInput): Promise<{ id: string }> {
  return request<{ id: string }>("/api/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateCustomer(
  id: string,
  input: UpdateCustomerInput
): Promise<{ id: string }> {
  return request<{ id: string }>(`/api/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function addCustomerPayment(
  id: string,
  input: CustomerPaymentInput
): Promise<unknown> {
  return request(`/api/customers/${id}/payments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function addCreditNote(id: string, input: CreditNoteInput): Promise<unknown> {
  return request(`/api/customers/${id}/credit-notes`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// ── Promociones ──────────────────────────────────────────────
export type ActivePromotion = {
  id: string;
  productId: string;
  type: "PERCENT" | "TWO_FOR_ONE";
  percent: string | null;
  paymentMethods: string[];
  endDate: string;
};

export type ProductPromotion = {
  id: string;
  type: "PERCENT" | "TWO_FOR_ONE";
  percent: string | null;
  paymentMethods: string[];
  startDate: string;
  endDate: string;
  active: boolean;
};

export async function fetchActivePromotions(): Promise<ActivePromotion[]> {
  return request<ActivePromotion[]>("/api/promotions/active");
}

export async function fetchProductPromotions(productId: string): Promise<ProductPromotion[]> {
  return request<ProductPromotion[]>(`/api/promotions?productId=${productId}`);
}

export async function createPromotion(input: CreatePromotionInput): Promise<{ id: string }> {
  return request<{ id: string }>("/api/promotions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deletePromotion(id: string): Promise<unknown> {
  return request(`/api/promotions/${id}`, { method: "DELETE" });
}

// ── Usuarios / staff (solo ADMIN) ────────────────────────────
export async function fetchUsers(): Promise<StaffUser[]> {
  return request<StaffUser[]>("/api/auth/users");
}

// Crea un usuario. La API devuelve un token del nuevo usuario que ignoramos
// (no cambiamos la sesión del admin).
export async function createUser(input: RegisterInput): Promise<unknown> {
  return request("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<unknown> {
  return request(`/api/auth/users/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

// ── Configuración de financiación (cuenta corriente) ─────────
export type { FinanceConfig } from "@ferrestock/shared";

export async function fetchFinanceConfig(): Promise<FinanceConfig> {
  return request<FinanceConfig>("/api/finance/config");
}

export async function updateFinanceConfig(input: UpdateFinanceConfigInput): Promise<FinanceConfig> {
  return request<FinanceConfig>("/api/finance/config", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
