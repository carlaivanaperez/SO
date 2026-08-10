import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata = {
  title: "El Almacén del Ferretero — Gestión",
  description: "Ventas, stock y precios",
};

// Aplica el tema guardado (o el del sistema) antes de pintar, sin parpadeo.
const themeScript = `
(function(){try{
  var t = localStorage.getItem('ferrestock.theme');
  if(!t){ t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  document.documentElement.setAttribute('data-theme', t);
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        {/* Métricas de uso (visitas) para los desarrolladores — se ven en el panel
            de Vercel, no en la app. Requiere activar "Web Analytics" en Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
