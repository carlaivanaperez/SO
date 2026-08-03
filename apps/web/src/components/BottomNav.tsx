"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

// Barra de pestañas inferior, estilo app de celular. Solo se ve en mobile
// (el CSS la oculta en pantallas grandes, donde queda el menú de arriba).
const TABS = [
  { href: "/", icon: "🏠", label: "Panel" },
  { href: "/pos", icon: "🧾", label: "Vender" },
  { href: "/ventas", icon: "📋", label: "Ventas" },
  { href: "/clientes", icon: "👥", label: "Clientes" },
];

export function BottomNav({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const tabs = user?.role === "ADMIN" ? [...TABS, { href: "/usuarios", icon: "⚙️", label: "Equipo" }] : TABS;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav className="bottom-nav">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={`bn-item ${isActive(t.href) ? "active" : ""}`}>
          <span className="bn-icon">{t.icon}</span>
          <span className="bn-label">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
