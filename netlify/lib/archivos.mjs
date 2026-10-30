// Archivos: documentos por carpetas, fotos de noticias y adjuntos.
// Se guardan en Netlify Blobs divididos en partes de 3 MB.
import { HttpError, json, newId, readJson, readList, slugify, stores, str, updateJson } from "./util.mjs";
import { requireUser } from "./usuarios.mjs";
import { puede } from "./roles.mjs";
import { registrar } from "./actividad.mjs";

export const FILES_KEY = "archivos";
const PART_SIZE = 3 * 1024 * 1024; // el límite de Netlify es 4,5 MB por petición
const MAX_FILE = 18 * 1024 * 1024;

// Tipos permitidos (por extensión) y su tipo MIME.
const TIPOS = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  rtf: "application/rtf",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
};
const INLINE = /^(application\/pdf|image\/|audio\/|video\/|text\/plain)/;

const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(name || "") || [, ""])[1].toLowerCase();

export function esDocumentoPublico(f) {
  return f.clase === "documento" && f.visible !== false && !f.revision;
}

function puedeModificar(usuario, f) {
  return puede(usuario, "editarTodo") || f.autor === usuario.usuario;
}

export async function rutasArchivos(req, method, id, sub, n, url) {
  const meta = stores.contenido();
  const blobs = stores.archivos();

  if (method === "GET" && !id) {
    const todos = url.searchParams.get("todos") === "1";
    if (todos) await requireUser(req);
    const list = (await readList(meta, FILES_KEY)).sort((a, b) => (b.creado || "").localeCompare(a.creado || ""));
    return json(todos ? list : list.filter(esDocumentoPublico));
  }

  const usuario = await requireUser(req);

  // 1) Iniciar la subida con los datos del archivo.
  if (method === "POST" && !id) {
    const body = await readJson(req, 10_000);
    const nombre = str(body.nombre, 180, { required: true, field: "nombre del archivo" });
    const ext = extOf(nombre);
    const tipo = TIPOS[ext];
    if (!tipo) throw new HttpError(400, `No se permiten archivos .${ext || "sin extensión"}. Usa PDF, Word, Excel, PowerPoint, imágenes, audio o video MP4.`);
    const tamano = Number(body.tamano);
    if (!Number.isFinite(tamano) || tamano <= 0) throw new HttpError(400, "El archivo está vacío.");
    if (tamano > MAX_FILE) throw new HttpError(400, `El archivo pesa más de ${MAX_FILE / 1048576} MB. Comprímelo o divídelo antes de subirlo.`);
    const fileId = newId(9);
    const clase = ["documento", "imagen", "medio"].includes(body.clase) ? body.clase : "documento";
    const record = {
      id: fileId,
      nombre,
      titulo: str(body.titulo, 160) || nombre.replace(/\.[^.]+$/, ""),
      descripcion: str(body.descripcion, 1000),
      categoria: str(body.categoria, 60) || "Documentos institucionales",
      tipo,
      ext,
      tamano,
      partes: Math.ceil(tamano / PART_SIZE),
      clase,
      visible: body.visible !== false,
      // Los documentos que sube un docente esperan aprobación.
      revision: clase === "documento" && !puede(usuario, "publicar"),
      autor: usuario.usuario,
      autorNombre: usuario.nombre,
      url: `/archivos/${fileId}/${slugify(nombre)}`,
    };
    await blobs.setJSON(`pendiente/${fileId}`, record);
    return json({ id: fileId, partes: record.partes, tamanoParte: PART_SIZE }, 201);
  }

  // 2) Recibir cada parte.
  if (method === "PUT" && id && sub === "partes") {
    const pending = await blobs.get(`pendiente/${id}`, { type: "json" });
    if (!pending) throw new HttpError(404, "Esta subida ya no existe. Vuelve a intentarlo.");
    if (pending.autor !== usuario.usuario) throw new HttpError(403, "Esta subida pertenece a otro usuario.");
    const index = Number(n);
    if (!Number.isInteger(index) || index < 0 || index >= pending.partes) throw new HttpError(400, "Parte del archivo no válida.");
    const data = await req.arrayBuffer();
    const expected = index === pending.partes - 1 ? pending.tamano - PART_SIZE * index : PART_SIZE;
    if (data.byteLength !== expected) throw new HttpError(400, "Una parte del archivo llegó incompleta. Vuelve a intentarlo.");
    await blobs.set(`partes/${id}/${index}`, data);
    return json({ ok: true, parte: index });
  }

  // 3) Terminar la subida.
  if (method === "POST" && id && sub === "completar") {
    const pending = await blobs.get(`pendiente/${id}`, { type: "json" });
    if (!pending) throw new HttpError(404, "Esta subida ya no existe. Vuelve a intentarlo.");
    if (pending.autor !== usuario.usuario) throw new HttpError(403, "Esta subida pertenece a otro usuario.");
    const { blobs: stored } = await blobs.list({ prefix: `partes/${id}/` });
    if (stored.length !== pending.partes) throw new HttpError(400, "Faltan partes del archivo. Vuelve a subirlo.");
    const record = { ...pending, creado: new Date().toISOString() };
    await updateJson(meta, FILES_KEY, () => [], (list) => [record, ...list.filter((f) => f.id !== id)], (list) => list.some((f) => f.id === id));
    await blobs.delete(`pendiente/${id}`);
    if (record.clase === "documento") {
      await registrar(usuario, record.revision ? "subió para revisión" : "subió", "el documento", record.titulo, id);
    }
    return json(record, 201);
  }

  // Editar datos, mover de carpeta o aprobar.
  if (method === "PATCH" && id) {
    const body = await readJson(req, 10_000);
    let saved;
    let aprobado = false;
    await updateJson(
      meta,
      FILES_KEY,
      () => [],
      (list) => {
        const i = list.findIndex((f) => f.id === id);
        if (i < 0) throw new HttpError(404, "Este archivo ya no existe.");
        const f = list[i];
        if (!puedeModificar(usuario, f)) throw new HttpError(403, "Solo puedes modificar los archivos que tú subiste.");
        const publicar = puede(usuario, "publicar");
        aprobado = publicar && body.revision === false && f.revision;
        saved = {
          ...f,
          titulo: body.titulo !== undefined ? str(body.titulo, 160) || f.titulo : f.titulo,
          descripcion: body.descripcion !== undefined ? str(body.descripcion, 1000) : f.descripcion,
          categoria: body.categoria !== undefined ? str(body.categoria, 60) || f.categoria : f.categoria,
          visible: publicar && body.visible !== undefined ? Boolean(body.visible) : aprobado ? true : f.visible,
          revision: aprobado ? false : f.revision,
          actualizado: new Date().toISOString(),
        };
        if (aprobado) saved.aprobadoPor = usuario.nombre;
        list[i] = saved;
        return list;
      },
      (list) => list.some((f) => f.id === id && f.actualizado === saved.actualizado)
    );
    if (saved.clase === "documento") await registrar(usuario, aprobado ? "aprobó" : "editó", "el documento", saved.titulo, id);
    return json(saved);
  }

  if (method === "DELETE" && id) {
    const f = (await readList(meta, FILES_KEY)).find((x) => x.id === id);
    if (f && !puedeModificar(usuario, f)) throw new HttpError(403, "Solo puedes eliminar los archivos que tú subiste.");
    await borrarArchivo(id);
    if (f && f.clase === "documento") await registrar(usuario, "eliminó", "el documento", f.titulo, id);
    return json({ ok: true });
  }

  throw new HttpError(405, "Método no permitido.");
}

export async function borrarArchivo(id) {
  const blobs = stores.archivos();
  let found = false;
  await updateJson(
    stores.contenido(),
    FILES_KEY,
    () => [],
    (list) => {
      found = found || list.some((f) => f.id === id);
      return list.filter((f) => f.id !== id);
    },
    (list) => !list.some((f) => f.id === id)
  );
  const { blobs: stored } = await blobs.list({ prefix: `partes/${id}/` });
  await Promise.all(stored.map((b) => blobs.delete(b.key)));
  await blobs.delete(`pendiente/${id}`);
  if (!found && !stored.length) throw new HttpError(404, "Este archivo ya no existe.");
}

export async function servirArchivo(id, url) {
  if (!id) throw new HttpError(404, "Archivo no encontrado.");
  const file = (await readList(stores.contenido(), FILES_KEY)).find((f) => f.id === id);
  if (!file) {
    return new Response("Este archivo ya no está disponible.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const blobs = stores.archivos();
  const download = url.searchParams.has("descargar") || !INLINE.test(file.tipo);
  const safeName = file.nombre.replace(/["\\\r\n]/g, "");
  const headers = {
    "content-type": file.tipo,
    "content-length": String(file.tamano),
    "content-disposition": `${download ? "attachment" : "inline"}; filename="${slugify(safeName, 120)}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
  if (file.partes === 1) {
    const data = await blobs.get(`partes/${id}/0`, { type: "arrayBuffer" });
    if (!data) throw new HttpError(404, "Archivo no encontrado.");
    return new Response(data, { headers });
  }
  let i = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      if (i >= file.partes) return controller.close();
      const chunk = await blobs.get(`partes/${id}/${i}`, { type: "arrayBuffer" });
      if (!chunk) return controller.error(new Error("parte faltante"));
      controller.enqueue(new Uint8Array(chunk));
      i++;
    },
  });
  return new Response(stream, { headers });
}
