"use client";
// Sesión del panel guardada en localStorage. Simple a propósito: un token JWT
// + los datos del usuario logueado. Solo corre en el browser.
import type { AuthResponse } from "@ferrestock/shared";

const TOKEN_KEY = "ferrestock.token";
const USER_KEY = "ferrestock.user";

export type SessionUser = AuthResponse["user"];

export function saveSession(auth: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
