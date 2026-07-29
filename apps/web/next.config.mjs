/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Permite importar el paquete compartido en TS sin pre-compilar.
  transpilePackages: ["@ferrestock/shared"],
  env: {
    NEXT_PUBLIC_API_URL: process.env.API_PUBLIC_URL ?? "http://localhost:3001",
  },
};

export default nextConfig;
