"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@ferreteria.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = await login({ email, password });
      saveSession(auth);
      router.push("/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <ThemeToggle className="auth-toggle" />
      <div className="auth-card">
        <img
          src="/logo.png"
          alt="El Almacén del Ferretero"
          className="logo"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <h1 style={{ marginBottom: 2 }}>El Almacén del Ferretero</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Ingresá para acceder al panel
        </p>

        <form onSubmit={onSubmit} style={{ textAlign: "left", marginTop: 20 }}>
          <div className="field">
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <span className="label">Contraseña</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="alert alert-error">⚠️ {error}</p>}

          <button type="submit" disabled={loading} className="btn btn-primary btn-block">
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
