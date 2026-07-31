"use client";
import { useEffect, useState } from "react";

const KEY = "ferrestock.theme";
type Theme = "light" | "dark";

// Botón para alternar tema claro/oscuro. El tema inicial lo aplica un script
// en el layout (antes de pintar) leyendo localStorage / preferencia del sistema.
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* localStorage no disponible */
    }
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      className={`theme-toggle ${className ?? ""}`}
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label="Cambiar tema"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
