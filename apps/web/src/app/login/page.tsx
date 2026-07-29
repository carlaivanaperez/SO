"use client";
import { useState, type CSSProperties, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/auth";

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
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 360, margin: "10vh auto", padding: 24 }}>
      <h1 style={{ marginBottom: 4 }}>FerreStock 🛠️</h1>
      <p style={{ color: "#666", marginTop: 0 }}>Ingresá para acceder al panel</p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 24 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </label>

        {error && <p style={{ color: "crimson", margin: 0 }}>⚠️ {error}</p>}

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}

const inputStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #ccc",
  borderRadius: 6,
  fontSize: 14,
};

const buttonStyle: CSSProperties = {
  padding: "10px 14px",
  border: "none",
  borderRadius: 6,
  background: "#1a56db",
  color: "white",
  fontSize: 15,
  cursor: "pointer",
};
