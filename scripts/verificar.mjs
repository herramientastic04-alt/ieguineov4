// Paso de compilación en Netlify: revisa que el proyecto esté completo y
// explica en español qué falta si algo está mal.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const requeridos = [
  "netlify.toml",
  "package.json",
  "public/index.html",
  "public/admin.html",
  "public/assets/js/api.js",
  "public/assets/js/site.js",
  "public/assets/js/panel/inicio.js",
  "public/assets/css/base.css",
  "netlify/functions/api.mjs",
  "netlify/lib/usuarios.mjs",
  "netlify/lib/noticias.mjs",
  "netlify/lib/archivos.mjs",
  "node_modules/@netlify/blobs/package.json",
];

console.log("I.E. El Guineo: revisando el proyecto…");
console.log(`Node.js ${process.version}`);

const faltan = requeridos.filter((r) => !existsSync(join(raiz, r)));
if (faltan.length) {
  console.error("\nFaltan estos archivos o carpetas:");
  faltan.forEach((f) => console.error("  - " + f));
  if (faltan.some((f) => f.startsWith("node_modules"))) {
    console.error("\nNo se instaló @netlify/blobs. Revisa que package.json esté en la raíz del repositorio.");
  } else {
    console.error(
      "\nRevisa en GitHub que la primera pantalla del repositorio muestre directamente las carpetas public, netlify y scripts" +
        " y el archivo netlify.toml. Si ves una carpeta llamada ie-el-guineo-web, entra a Netlify, Project configuration," +
        " Build & deploy, Build settings y pon ie-el-guineo-web en Base directory."
    );
  }
  process.exit(1);
}

const funciones = readdirSync(join(raiz, "netlify/functions")).filter((f) => f.endsWith(".mjs"));
console.log(`Funciones: ${funciones.join(", ")}`);
console.log("Proyecto completo. Netlify publicará la carpeta public y empaquetará las funciones.");
