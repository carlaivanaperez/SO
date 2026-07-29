import type { ReactNode } from "react";

export const metadata = {
  title: "FerreStock — Panel",
  description: "Gestión de ventas, stock y precios",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
