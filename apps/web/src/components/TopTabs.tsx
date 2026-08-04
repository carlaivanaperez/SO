"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

// Pestañas de sección: la activa se pinta de amarillo con un recuadro que se
// DESLIZA a la sección seleccionada.
const TABS = [
  { href: "/", label: "Panel" },
  { href: "/pos", label: "Vender" },
  { href: "/ventas", label: "Ventas" },
  { href: "/clientes", label: "Clientes" },
];

type Box = { left: number; top: number; width: number; height: number; ready: boolean };

export function TopTabs({ user }: { user: SessionUser | null }) {
  const path = usePathname();
  const tabs = user?.role === "ADMIN" ? [...TABS, { href: "/usuarios", label: "Equipo" }] : TABS;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  const innerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  // Reposiciona el recuadro sobre la pestaña activa (y anima el deslizado).
  useEffect(() => {
    function place() {
      const el = innerRef.current?.querySelector<HTMLElement>(".tt-item.active");
      if (el) {
        setBox({
          left: el.offsetLeft,
          top: el.offsetTop + 5,
          width: el.offsetWidth,
          height: el.offsetHeight - 10,
          ready: true,
        });
      }
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [path, tabs.length]);

  return (
    <div className="top-tabs">
      <div className="top-tabs-inner" ref={innerRef}>
        <span
          className="tt-pill"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            opacity: box.ready ? 1 : 0,
          }}
        />
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={`tt-item ${isActive(t.href) ? "active" : ""}`}>
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
