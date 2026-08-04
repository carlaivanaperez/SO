import { z } from "zod";

// ─── Datos del negocio (editable por ADMIN) ──────────────────────────
export const updateStoreSettingsSchema = z.object({
  storeName: z.string().trim().min(1, "El nombre no puede estar vacío").max(80),
  // Los teléfonos se normalizan a E.164 en la API; acá aceptamos texto libre o vacío.
  whatsappPhone: z.string().trim().optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  hours: z.string().trim().max(300).optional().nullable(),
  supportPhone: z.string().trim().optional().nullable(),
});
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;

export type StoreSettings = {
  storeName: string;
  whatsappPhone: string | null; // E.164 o null si no se cargó
  address: string | null; // dirección para el catálogo público
  hours: string | null; // horarios de atención
  supportPhone: string | null; // WhatsApp del administrador (soporte al staff, NO público)
};

// Datos del negocio que SÍ se exponen en el catálogo público (sin el soporte).
export type PublicStore = Pick<StoreSettings, "storeName" | "whatsappPhone" | "address" | "hours">;

// ─── Catálogo público (sin login, para clientes) ─────────────────────
export type PublicCatalogItem = {
  id: string;
  name: string;
  brand: string | null;
  price: string; // precio final con IVA incluido
  available: boolean; // hay stock (sin exponer la cantidad exacta)
  promoLabel: string | null; // ej: "20% off" o "2x1"
  category: { id: string; name: string } | null; // rubro
};

export type PublicCatalog = {
  store: PublicStore;
  items: PublicCatalogItem[];
};
