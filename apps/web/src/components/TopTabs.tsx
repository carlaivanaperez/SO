"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canManage, type SessionUser } from "@/lib/auth";

// Pestañas de sección. Se arman según el rol: el vendedor (CASHIER) no ve
// "Ventas" (historial/facturación del negocio) ni "Equipo".
export function TopTabs({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const manage = canManage(user);
  const tabs = [
    { href: "/", label: "Panel" },
    { href: "/pos", label: "Vender" },
    ...(manage ? [{ href: "/ventas", label: "Ventas" }] : []),
    { href: "/clientes", label: "Clientes" },
    ...(user?.role === "ADMIN"
      ? [
          { href: "/usuarios", label: "Equipo" },
          { href: "/configuracion", label: "Ajustes" },
        ]
      : []),
  ];
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="top-tabs">
      <div className="top-tabs-inner">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`tt-item ${isActive(t.href) ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
