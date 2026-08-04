import { redirect } from "next/navigation";

// El catálogo público ahora vive en la raíz "/". Mantenemos /catalogo como
// redirección por si quedó algún link viejo.
export default function CatalogoRedirect() {
  redirect("/");
}
