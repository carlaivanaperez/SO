"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManage, type SessionUser } from "@/lib/auth";

// Pestañas de sección. Se arman según el rol: el vendedor (CASHIER) no ve
// "Ventas" (historial/facturación del negocio) ni "Equipo".
export function TopTabs({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const manage = canManage(user);
  const tabs: { href: string; label: string; external?: boolean }[] = [
    { href: "/panel", label: "Panel" },
    { href: "/pos", label: "Vender" },
    ...(manage ? [{ href: "/ventas", label: "Ventas" }] : []),
    { href: "/clientes", label: "Clientes" },
    // Catálogo público (uso de todos): abre en otra pestaña para no cerrar la sesión.
    { href: "/", label: "Catálogo ↗", external: true },
    ...(user?.role === "ADMIN"
      ? [
          { href: "/usuarios", label: "Equipo" },
          { href: "/configuracion", label: "Ajustes" },
        ]
      : []),
    { href: "/ayuda", label: "Ayuda" },
  ];
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);

  return (
    <div className="top-tabs">
      <div className="top-tabs-inner">
        {tabs.map((t) =>
          t.external ? (
            <a
              key={t.label}
              href={t.href}
              target="_blank"
              rel="noopener noreferrer"
              className="tt-item"
            >
              {t.label}
            </a>
          ) : (
            <Link key={t.href} href={t.href} className={`tt-item ${isActive(t.href) ? "active" : ""}`}>
              {t.label}
            </Link>
          )
        )}
      </div>
    </div>
  );
}
