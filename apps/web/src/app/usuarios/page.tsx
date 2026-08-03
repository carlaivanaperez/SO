"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { fetchUsers, createUser, updateUser, ApiError } from "@/lib/api";
import { getToken, getUser, clearSession, type SessionUser } from "@/lib/auth";
import { roleLabels, roleDescriptions, type UserRoleDTO, type StaffUser } from "@ferrestock/shared";

const ROLES: UserRoleDTO[] = ["CASHIER", "MANAGER", "ADMIN"];

export default function UsersPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Alta de usuario
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRoleDTO>("CASHIER");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleErr = useCallback(
    (e: unknown, setter: (m: string) => void) => {
      if (e instanceof ApiError && e.status === 401) {
        clearSession();
        router.replace("/login");
      } else {
        setter(e instanceof Error ? e.message : "Ocurrió un error");
      }
    },
    [router]
  );

  const load = useCallback(() => {
    fetchUsers()
      .then(setUsers)
      .catch((e) => handleErr(e, setError));
  }, [handleErr]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getUser();
    if (u?.role !== "ADMIN") {
      router.replace("/");
      return;
    }
    setUser(u);
    load();
  }, [router, load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      await createUser({ name: name.trim(), email: email.trim(), password, role });
      setName("");
      setEmail("");
      setPassword("");
      setRole("CASHIER");
      load();
    } catch (e) {
      handleErr(e, setFormError);
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(id: string, newRole: UserRoleDTO) {
    await updateUser(id, { role: newRole }).catch((e) => handleErr(e, setError));
    load();
  }

  async function toggleActive(u: StaffUser) {
    await updateUser(u.id, { active: !u.active }).catch((e) => handleErr(e, setError));
    load();
  }

  return (
    <>
      <AppHeader user={user} />
      <main className="container">
        <h1>Usuarios y permisos</h1>

        {/* Explicación de roles */}
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16 }}>¿Qué puede hacer cada rol?</h2>
          {ROLES.map((r) => (
            <div key={r} className="list-row">
              <span>
                <strong>{roleLabels[r]}</strong>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>
                  {roleDescriptions[r]}
                </span>
              </span>
            </div>
          ))}
        </div>

        {error && <p className="alert alert-error">⚠️ {error}</p>}

        <div className="grid-2">
          {/* Alta */}
          <section className="card">
            <h2 style={{ fontSize: 16 }}>Crear usuario</h2>
            <form onSubmit={create}>
              <label className="field">
                <span className="label">Nombre</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="field">
                <span className="label">Email</span>
                <input
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span className="label">Contraseña (mínimo 8 caracteres)</span>
                <input
                  className="input"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label className="field">
                <span className="label">Rol</span>
                <select
                  className="input"
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRoleDTO)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              {formError && <p className="alert alert-error">⚠️ {formError}</p>}
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? "Creando…" : "Crear usuario"}
              </button>
            </form>
          </section>

          {/* Lista */}
          <section className="card">
            <h2 style={{ fontSize: 16 }}>Personal</h2>
            {users.map((u) => (
              <div key={u.id} className="list-row">
                <span>
                  <strong>{u.name}</strong>
                  {!u.active && <span className="badge badge-low" style={{ marginLeft: 6 }}>Inactivo</span>}
                  <br />
                  <span className="muted" style={{ fontSize: 13 }}>{u.email}</span>
                </span>
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <select
                    className="input"
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as UserRoleDTO)}
                    style={{ width: "auto", padding: "6px 8px" }}
                    disabled={u.id === user?.id}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabels[r]}
                      </option>
                    ))}
                  </select>
                  {u.id !== user?.id && (
                    <button
                      className="btn btn-outline"
                      onClick={() => toggleActive(u)}
                      style={{ padding: "6px 10px" }}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </section>
        </div>
      </main>
    </>
  );
}
