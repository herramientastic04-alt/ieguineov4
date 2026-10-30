// Registro de actividad: quién hizo qué y cuándo (visible para administradores).
import { readList, stores, updateJson } from "./util.mjs";

const KEY = "actividad";
const MAX = 400;

export async function registrar(usuario, accion, tipo, titulo, id) {
  const entrada = {
    fecha: new Date().toISOString(),
    usuario: usuario.usuario,
    nombre: usuario.nombre,
    accion,
    tipo,
    titulo: String(titulo || "").slice(0, 200),
    id: id || null,
  };
  try {
    await updateJson(stores.contenido(), KEY, () => [], (list) => [entrada, ...list].slice(0, MAX));
  } catch (e) {
    console.error("No se pudo registrar la actividad", e);
  }
}

export async function listarActividad() {
  return readList(stores.contenido(), KEY);
}
