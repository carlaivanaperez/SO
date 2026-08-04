"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

// Pestañas de sección con un subrayado que se DESLIZA a la sección activa.
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

  const innerRef = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  // Reposiciona el subrayado bajo la pestaña activa (y anima el deslizado).
  useEffect(() => {
    function place() {
      const el = innerRef.current?.querySelector<HTMLElement>(".tt-item.active");
      if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [path, tabs.length]);

  return (
    <div className="top-tabs">
      <div className="top-tabs-inner" ref={innerRef}>
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`tt-item ${isActive(t.href) ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
        <span className="tt-underline" style={{ left: bar.left, width: bar.width }} />
      </div>
    </div>
  );
}
