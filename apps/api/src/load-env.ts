import { config } from "dotenv";
import { resolve } from "path";

// El .env vive en la raíz del monorepo, pero cada proceso corre desde su
// paquete (apps/api). Cargamos el .env de la raíz antes de instanciar nada.
config({ path: resolve(process.cwd(), "../../.env") });
