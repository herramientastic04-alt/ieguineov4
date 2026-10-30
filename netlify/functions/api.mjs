// API del sitio de la I.E. El Guineo (Netlify Functions + Netlify Blobs).
// Cada sección vive en su propio módulo dentro de netlify/lib/.
import { HttpError, errorResponse, json, readJson } from "../lib/util.mjs";
import {
  actualizarUsuario,
  cambiarMiCuenta,
  crearUsuario,
  eliminarUsuario,
  exigir,
  listarUsuarios,
  login,
  requireUser,
} from "../lib/usuarios.mjs";
import { ROLES } from "../lib/roles.mjs";
import { cambiarCarpetas, getSite, saveSite } from "../lib/sitio.mjs";
import { rutasNoticias } from "../lib/noticias.mjs";
import { rutasPaginas } from "../lib/paginas.mjs";
import { rutasArchivos, servirArchivo } from "../lib/archivos.mjs";
import { listarActividad, registrar } from "../lib/actividad.mjs";
import { paginaCompartir } from "../lib/compartir.mjs";

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const method = req.method.toUpperCase();
    const parts = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean).map(decodeURIComponent);

    if (parts[0] === "archivos") return await servirArchivo(parts[1], url);
    if (parts[0] === "n" || parts[0] === "p") return await paginaCompartir(url, parts[0], parts[1]);
    if (parts[0] !== "api") throw new HttpError(404, "Ruta no encontrada.");

    const [, recurso, id, sub, n] = parts;

    switch (recurso) {
      case "estado":
        return json({ ok: true, servicio: "I.E. El Guineo", hora: new Date().toISOString() });

      // Sesión
      case "login":
        if (method !== "POST") break;
        return json(await login(req, context, await readJson(req, 5000)));
      case "sesion":
        return json(await requireUser(req));
      case "mi-cuenta": {
        if (method !== "POST") break;
        const usuario = await requireUser(req);
        return json(await cambiarMiCuenta(usuario, await readJson(req, 5000)));
      }

      // Usuarios (solo administradores)
      case "roles":
        return json(ROLES);
      case "usuarios": {
        const admin = await requireUser(req);
        exigir(admin, "usuarios", "Solo los administradores pueden gestionar usuarios.");
        if (method === "GET") return json(await listarUsuarios());
        if (method === "POST" && !id) {
          const u = await crearUsuario(admin, await readJson(req, 5000));
          await registrar(admin, "creó", "el usuario", `${u.nombre} (${u.rolNombre})`, u.usuario);
          return json(u, 201);
        }
        if (method === "PUT" && id) {
          const u = await actualizarUsuario(admin, id, await readJson(req, 5000));
          await registrar(admin, "modificó", "el usuario", `${u.nombre} (${u.rolNombre})`, u.usuario);
          return json(u);
        }
        if (method === "DELETE" && id) {
          const u = await eliminarUsuario(admin, id);
          await registrar(admin, "eliminó", "el usuario", u.nombre, u.usuario);
          return json({ ok: true });
        }
        break;
      }
      case "actividad": {
        const admin = await requireUser(req);
        exigir(admin, "actividad", "Solo los administradores pueden ver la actividad.");
        return json(await listarActividad());
      }

      // Contenido institucional
      case "sitio":
        if (method === "GET") return json(await getSite());
        if (method === "PUT") {
          const usuario = await requireUser(req);
          exigir(usuario, "sitio", "Solo los administradores pueden cambiar la información institucional.");
          const s = await saveSite(await readJson(req, 900_000));
          await registrar(usuario, "actualizó", "la información institucional", "");
          return json(s);
        }
        break;
      case "carpetas": {
        if (method !== "POST") break;
        const usuario = await requireUser(req);
        exigir(usuario, "carpetas", "Solo los administradores y editores pueden organizar carpetas.");
        const body = await readJson(req, 10_000);
        const s = await cambiarCarpetas(body);
        await registrar(usuario, { crear: "creó", renombrar: "renombró", eliminar: "eliminó", ordenar: "ordenó" }[body.accion] || "cambió", "la carpeta", body.nuevo || body.nombre);
        return json(s.documentos.categorias);
      }

      case "noticias":
        return await rutasNoticias(req, method, id, url);
      case "paginas":
        return await rutasPaginas(req, method, id, url);
      case "archivos":
        return await rutasArchivos(req, method, id, sub, n, url);
    }
    throw new HttpError(404, "Ruta no encontrada.");
  } catch (err) {
    return errorResponse(err);
  }
};

export const config = {
  path: ["/api/*", "/archivos/*", "/n/*", "/p/*"],
};
