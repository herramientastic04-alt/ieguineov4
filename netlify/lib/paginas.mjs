// Páginas libres: cualquier contenido nuevo (Matrículas, Horarios, PAE, Egresados…).
import { HttpError, json, limpiarAdjuntos, limpiarImagen, newId, readJson, readList, slugify, stores, str, updateJson } from "./util.mjs";
import { exigir, optionalUser, requireUser } from "./usuarios.mjs";
import { registrar } from "./actividad.mjs";

export const PAGES_KEY = "paginas";
const MENUS = ["principal", "pie", "ninguno"];

const porOrden = (a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.titulo.localeCompare(b.titulo);

function slugUnico(base, list, propio) {
  let slug = slugify(base, 60).replace(/\./g, "-") || "pagina";
  let n = 2;
  const raiz = slug;
  while (list.some((p) => p.slug === slug && p.id !== propio)) slug = `${raiz}-${n++}`;
  return slug;
}

function limpiar(input, previa = {}) {
  const cuerpo = typeof input.cuerpo === "string" ? input.cuerpo : "";
  if (cuerpo.length > 600_000) throw new HttpError(400, "El texto de la página es demasiado largo.");
  return {
    ...previa,
    titulo: str(input.titulo, 160, { required: true, field: "título" }),
    resumen: str(input.resumen, 500),
    cuerpo,
    portada: limpiarImagen(input.portada),
    adjuntos: limpiarAdjuntos(input.adjuntos, 40),
    menu: MENUS.includes(input.menu) ? input.menu : "principal",
    orden: Number.isFinite(Number(input.orden)) ? Math.max(0, Math.min(99, Math.round(Number(input.orden)))) : 10,
    estado: input.estado === "borrador" ? "borrador" : "publicada",
  };
}

export async function rutasPaginas(req, method, id, url) {
  const store = stores.contenido();

  if (method === "GET" && !id) {
    const todas = url.searchParams.get("todas") === "1";
    if (todas) await requireUser(req);
    const list = (await readList(store, PAGES_KEY)).sort(porOrden);
    // La lista pública no trae el texto completo, solo lo necesario para el menú.
    return json(
      todas
        ? list
        : list.filter((p) => p.estado === "publicada").map(({ cuerpo, adjuntos, ...resto }) => resto)
    );
  }

  if (method === "GET" && id) {
    const p = (await readList(store, PAGES_KEY)).find((x) => x.id === id || x.slug === id);
    if (!p) throw new HttpError(404, "No encontramos esta página.");
    if (p.estado !== "publicada" && !(await optionalUser(req))) throw new HttpError(404, "Esta página aún no está publicada.");
    return json(p);
  }

  const usuario = await requireUser(req);
  exigir(usuario, "paginas", "Solo los administradores y editores pueden crear o modificar páginas.");

  if (method === "POST" && !id) {
    const body = await readJson(req, 900_000);
    const ahora = new Date().toISOString();
    let item;
    await updateJson(
      store,
      PAGES_KEY,
      () => [],
      (list) => {
        if (item && list.some((x) => x.id === item.id)) return list;
        const datos = limpiar(body);
        item = item || { id: newId(6), autor: usuario.usuario, autorNombre: usuario.nombre, creada: ahora };
        Object.assign(item, datos, { slug: slugUnico(body.slug || datos.titulo, list, item.id), actualizada: ahora });
        return [...list, item];
      },
      (list) => list.some((x) => x.id === item.id)
    );
    await registrar(usuario, item.estado === "borrador" ? "creó un borrador de" : "publicó", "la página", item.titulo, item.id);
    return json(item, 201);
  }

  if (method === "PUT" && id) {
    const body = await readJson(req, 900_000);
    let saved;
    await updateJson(
      store,
      PAGES_KEY,
      () => [],
      (list) => {
        const i = list.findIndex((x) => x.id === id);
        if (i < 0) throw new HttpError(404, "Esta página ya no existe.");
        const datos = limpiar(body, list[i]);
        const slug = body.slug && body.slug !== list[i].slug ? slugUnico(body.slug, list, id) : list[i].slug;
        saved = { ...datos, slug, id, actualizada: new Date().toISOString(), editadaPor: usuario.nombre };
        list[i] = saved;
        return list;
      },
      (list) => list.some((x) => x.id === id && x.actualizada === saved.actualizada)
    );
    await registrar(usuario, "editó", "la página", saved.titulo, id);
    return json(saved);
  }

  if (method === "DELETE" && id) {
    let removed;
    await updateJson(
      store,
      PAGES_KEY,
      () => [],
      (list) => {
        removed = removed || list.find((x) => x.id === id);
        if (!removed) throw new HttpError(404, "Esta página ya no existe.");
        return list.filter((x) => x.id !== id);
      },
      (list) => !list.some((x) => x.id === id)
    );
    await registrar(usuario, "eliminó", "la página", removed.titulo, id);
    return json({ ok: true });
  }

  throw new HttpError(405, "Método no permitido.");
}
