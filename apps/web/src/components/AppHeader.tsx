"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession, type SessionUser } from "@/lib/auth";
import { roleLabels } from "@ferrestock/shared";
import { ThemeToggle } from "./ThemeToggle";
import { TopTabs } from "./TopTabs";

// Encabezado con el logo + datos del usuario, y debajo las pestañas de sección.
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
          <Link href="/panel" className="brand" style={{ color: "#fff" }}>
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

          <div className="header-right">
            {user && (
              <span className="user">
                {user.name} · {roleLabels[user.role]}
              </span>
            )}
            <ThemeToggle />
            <button onClick={logout} className="btn btn-ghost">
              Salir
            </button>
          </div>
        </div>
      </header>
      <TopTabs user={user} />
    </>
  );
}
