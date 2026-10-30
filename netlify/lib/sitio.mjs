// Contenido institucional del sitio (textos, símbolos, contacto, carpetas).
import { DEFAULT_SITE, mergeDefaults } from "./defaults.mjs";
import { HttpError, readList, stores, str, updateJson } from "./util.mjs";

const SITE_KEY = "sitio";

export async function getSite() {
  const saved = await stores.contenido().get(SITE_KEY, { type: "json" });
  return mergeDefaults(DEFAULT_SITE, saved || {});
}

export async function saveSite(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "El contenido enviado no es válido.");
  const merged = mergeDefaults(DEFAULT_SITE, body);
  merged.actualizado = new Date().toISOString();
  await stores.contenido().setJSON(SITE_KEY, merged);
  return merged;
}

// Carpetas de documentos: crear, renombrar (mueve los archivos) y eliminar (solo vacías).
export async function cambiarCarpetas(body) {
  const accion = body.accion;
  const nombre = str(body.nombre, 60, { required: true, field: "nombre de la carpeta" });
  const site = await getSite();
  const carpetas = site.documentos.categorias.slice();
  const existe = (n) => carpetas.some((c) => c.toLowerCase() === n.toLowerCase());

  if (accion === "crear") {
    if (existe(nombre)) throw new HttpError(409, `Ya existe la carpeta «${nombre}».`);
    carpetas.push(nombre);
  } else if (accion === "renombrar") {
    const nuevo = str(body.nuevo, 60, { required: true, field: "nuevo nombre" });
    if (nuevo.toLowerCase() !== nombre.toLowerCase() && existe(nuevo)) throw new HttpError(409, `Ya existe la carpeta «${nuevo}».`);
    const i = carpetas.indexOf(nombre);
    if (i >= 0) carpetas[i] = nuevo;
    else carpetas.push(nuevo);
    await updateJson(stores.contenido(), "archivos", () => [], (list) =>
      list.map((f) => (f.categoria === nombre ? { ...f, categoria: nuevo } : f))
    );
  } else if (accion === "eliminar") {
    const archivos = await readList(stores.contenido(), "archivos");
    const n = archivos.filter((f) => f.clase === "documento" && f.categoria === nombre).length;
    if (n) throw new HttpError(400, `La carpeta «${nombre}» tiene ${n} documento${n === 1 ? "" : "s"}. Muévelos o elimínalos antes de borrarla.`);
    const i = carpetas.indexOf(nombre);
    if (i >= 0) carpetas.splice(i, 1);
  } else if (accion === "ordenar") {
    const orden = Array.isArray(body.orden) ? body.orden.map((c) => str(c, 60)).filter(Boolean) : [];
    if (orden.length !== carpetas.length || !orden.every((c) => carpetas.includes(c))) throw new HttpError(400, "El orden de carpetas no es válido.");
    carpetas.splice(0, carpetas.length, ...orden);
  } else {
    throw new HttpError(400, "Acción no válida.");
  }
  site.documentos.categorias = carpetas;
  return saveSite(site);
}
