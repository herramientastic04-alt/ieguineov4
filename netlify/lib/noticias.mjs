// Noticias: eventos, comunicados y logros, con revisión para docentes.
import { HttpError, hoyColombia, json, limpiarAdjuntos, limpiarImagen, newId, readJson, readList, stores, str, updateJson, urlArchivo } from "./util.mjs";
import { optionalUser, requireUser } from "./usuarios.mjs";
import { puede } from "./roles.mjs";
import { registrar } from "./actividad.mjs";
import { borrarArchivo } from "./archivos.mjs";

export const NEWS_KEY = "noticias";
const ESTADOS = ["publicada", "borrador", "revision"];

const byDateDesc = (a, b) => (b.fecha || "").localeCompare(a.fecha || "") || (b.creada || "").localeCompare(a.creada || "");

export function esPublica(item) {
  return item.estado === "publicada" && item.fecha <= hoyColombia();
}

function limpiar(input, usuario, previa = {}) {
  const fecha = str(input.fecha, 10) || hoyColombia();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new HttpError(400, "La fecha debe tener el formato AAAA-MM-DD.");
  const cuerpo = typeof input.cuerpo === "string" ? input.cuerpo : "";
  if (cuerpo.length > 400_000) throw new HttpError(400, "El texto de la noticia es demasiado largo.");
  let estado = ESTADOS.includes(input.estado) ? input.estado : "publicada";
  // Un docente no publica directamente: su noticia queda en revisión.
  if (!puede(usuario, "publicar") && estado === "publicada") estado = "revision";
  const galeria = (Array.isArray(input.galeria) ? input.galeria : [])
    .filter((g) => g && urlArchivo(g.url))
    .slice(0, 60)
    .map((g) => ({ url: g.url, id: String(g.id || "").slice(0, 40), pie: str(g.pie, 200) }));
  return {
    ...previa,
    titulo: str(input.titulo, 200, { required: true, field: "título" }),
    resumen: str(input.resumen, 600),
    cuerpo,
    categoria: str(input.categoria, 60) || "Noticias",
    fecha,
    estado,
    destacada: puede(usuario, "publicar") ? Boolean(input.destacada) : Boolean(previa.destacada),
    portada: limpiarImagen(input.portada),
    galeria,
    adjuntos: limpiarAdjuntos(input.adjuntos),
  };
}

function puedeModificar(usuario, item) {
  if (puede(usuario, "editarTodo")) return true;
  return item.autor === usuario.usuario && item.estado !== "publicada";
}

export async function rutasNoticias(req, method, id, url) {
  const store = stores.contenido();

  if (method === "GET" && !id) {
    const todas = url.searchParams.get("todas") === "1";
    if (todas) await requireUser(req);
    const list = (await readList(store, NEWS_KEY)).sort(byDateDesc);
    return json(todas ? list : list.filter(esPublica));
  }

  if (method === "GET" && id) {
    const item = (await readList(store, NEWS_KEY)).find((x) => x.id === id);
    if (!item) throw new HttpError(404, "No encontramos esta noticia. Puede que la hayan retirado.");
    if (!esPublica(item) && !(await optionalUser(req))) throw new HttpError(404, "Esta noticia aún no está publicada.");
    return json(item);
  }

  const usuario = await requireUser(req);

  if (method === "POST" && !id) {
    const body = await readJson(req);
    const ahora = new Date().toISOString();
    const item = {
      id: newId(6),
      ...limpiar(body, usuario),
      autor: usuario.usuario,
      autorNombre: usuario.nombre,
      creada: ahora,
      actualizada: ahora,
    };
    if (item.estado === "publicada") Object.assign(item, { publicadaPor: usuario.nombre });
    await updateJson(store, NEWS_KEY, () => [], (list) => (list.some((x) => x.id === item.id) ? list : [item, ...list]), (list) =>
      list.some((x) => x.id === item.id)
    );
    await registrar(usuario, item.estado === "revision" ? "envió a revisión" : item.estado === "borrador" ? "creó un borrador de" : "publicó", "la noticia", item.titulo, item.id);
    return json(item, 201);
  }

  if (method === "PUT" && id) {
    const body = await readJson(req);
    let saved;
    let antes;
    await updateJson(
      store,
      NEWS_KEY,
      () => [],
      (list) => {
        const i = list.findIndex((x) => x.id === id);
        if (i < 0) throw new HttpError(404, "Esta noticia ya no existe.");
        antes = antes || list[i];
        if (!puedeModificar(usuario, list[i])) throw new HttpError(403, "Solo puedes editar tus propias noticias mientras no estén publicadas.");
        saved = { ...limpiar(body, usuario, list[i]), id, actualizada: new Date().toISOString(), editadaPor: usuario.nombre };
        if (saved.estado === "publicada" && list[i].estado !== "publicada") saved.publicadaPor = usuario.nombre;
        list[i] = saved;
        return list;
      },
      (list) => list.some((x) => x.id === id && x.actualizada === saved.actualizada)
    );
    const accion =
      saved.estado === "publicada" && antes.estado !== "publicada"
        ? antes.estado === "revision" && antes.autor !== usuario.usuario
          ? "aprobó y publicó"
          : "publicó"
        : saved.estado === "revision" && antes.estado !== "revision"
        ? "envió a revisión"
        : "editó";
    await registrar(usuario, accion, "la noticia", saved.titulo, id);
    return json(saved);
  }

  if (method === "DELETE" && id) {
    let removed;
    const list = await updateJson(
      store,
      NEWS_KEY,
      () => [],
      (list) => {
        const found = list.find((x) => x.id === id);
        if (!found && !removed) throw new HttpError(404, "Esta noticia ya no existe.");
        if (found && !puedeModificar(usuario, found)) throw new HttpError(403, "Solo puedes eliminar tus propias noticias mientras no estén publicadas.");
        removed = removed || found;
        return list.filter((x) => x.id !== id);
      },
      (list) => !list.some((x) => x.id === id)
    );
    // Borra las fotos que solo usaba esta noticia.
    const enUso = new Set(list.flatMap((n) => [n.portada?.url, ...(n.galeria || []).map((g) => g.url)]));
    const paginas = await readList(store, "paginas");
    paginas.forEach((p) => enUso.add(p.portada?.url));
    const fotos = [removed.portada, ...(removed.galeria || [])].filter((m) => m && m.url && !enUso.has(m.url));
    const archivos = await readList(store, "archivos");
    for (const m of fotos) {
      const f = archivos.find((x) => x.url === m.url);
      if (f && f.clase === "imagen") await borrarArchivo(f.id).catch(() => {});
    }
    await registrar(usuario, "eliminó", "la noticia", removed.titulo, id);
    return json({ ok: true });
  }

  throw new HttpError(405, "Método no permitido.");
}
