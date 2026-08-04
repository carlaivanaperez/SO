"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

// Pestañas de sección: la activa queda marcada con un recuadro amarillo
// delineado y de puntas redondeadas (sin animación de deslizado).
const TABS = [
  { href: "/", label: "Panel" },
  { href: "/pos", label: "Vender" },
  { href: "/ventas", label: "Ventas" },
  { href: "/clientes", label: "Clientes" },
];

export function TopTabs({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const tabs = user?.role === "ADMIN" ? [...TABS, { href: "/usuarios", label: "Equipo" }] : TABS;
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
