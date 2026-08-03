"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, type SessionUser } from "@/lib/auth";
import { roleLabels } from "@ferrestock/shared";
import { ThemeToggle } from "./ThemeToggle";
import { BottomNav } from "./BottomNav";

// Encabezado con el logo del almacén y la navegación principal.
export function AppHeader({ user }: { user: SessionUser | null }) {
  const router = useRouter();

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <>
    <header className="app-header">
      <div className="inner">
        <Link href="/" className="brand" style={{ color: "#fff" }}>
          {/* El logo se sirve desde apps/web/public/logo.png */}
          <img
            src="/logo.png"
            alt="El Almacén del Ferretero"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <span className="brand-text">
            El Almacén del Ferretero
            <small>Gestión</small>
          </span>
        </Link>

        <nav className="nav">
          <span className="top-nav-links">
            <Link href="/" className="nav-btn">
              Panel
            </Link>
            <Link href="/pos" className="nav-btn">
              Punto de venta
            </Link>
            <Link href="/ventas" className="nav-btn">
              Ventas
            </Link>
            <Link href="/clientes" className="nav-btn">
              Clientes
            </Link>
            {user?.role === "ADMIN" && (
              <Link href="/usuarios" className="nav-btn">
                Usuarios
              </Link>
            )}
          </span>
          {user && (
            <span className="user">
              {user.name} · {roleLabels[user.role]}
            </span>
          )}
          <ThemeToggle />
          <button onClick={logout} className="btn btn-ghost">
            Salir
          </button>
        </nav>
      </div>
    </header>
    <BottomNav user={user} />
    </>
  );
}
