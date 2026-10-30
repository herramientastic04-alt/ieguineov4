// Usuarios, contraseñas y sesiones del panel.
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { HttpError, stores, str, updateJson } from "./util.mjs";
import { ROLES, permisosDe, puede } from "./roles.mjs";

const scryptAsync = promisify(scrypt);
const SESSION_HOURS = 12;
const MAX_FAILS = 8;
const LOCK_MINUTES = 15;
const USERS_KEY = "usuarios";

// Cuenta principal. Se puede cambiar con ADMIN_USER y ADMIN_PASSWORD en Netlify,
// o desde el panel (Mi cuenta) una vez dentro.
const INITIAL_USER = (process.env.ADMIN_USER || "admin").toLowerCase();
const INITIAL_PASSWORD = process.env.ADMIN_PASSWORD || "12345admin";

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const sha = (s) => createHash("sha256").update(String(s)).digest();

function safeEqual(a, b) {
  const x = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
  const y = Buffer.isBuffer(b) ? b : Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

async function hashPassword(password, salt) {
  return b64(await scryptAsync(String(password), salt, 32, { N: 16384, r: 8, p: 1 }));
}

async function newPasswordFields(clave) {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: await hashPassword(clave, salt) };
}

async function getSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) return process.env.SESSION_SECRET;
  const store = stores.config();
  let secret = await store.get("secret");
  if (secret) return secret;
  await store.set("secret", randomBytes(32).toString("hex"), { onlyIfNew: true });
  secret = await store.get("secret");
  return secret;
}

/* ------------------------------ Lista de usuarios ------------------------------ */

// Devuelve la lista de usuarios. La primera vez crea la cuenta principal
// (o la convierte desde la versión anterior del sitio, que tenía un solo acceso).
async function getUsuarios() {
  const store = stores.config();
  const list = await store.get(USERS_KEY, { type: "json" });
  if (Array.isArray(list) && list.length) return list;
  const legado = await store.get("auth", { type: "json" });
  const ahora = new Date().toISOString();
  const principal = legado && legado.hash
    ? { usuario: String(legado.usuario || INITIAL_USER).toLowerCase(), salt: legado.salt, hash: legado.hash, claveInicial: false }
    : { usuario: INITIAL_USER, ...(await newPasswordFields(INITIAL_PASSWORD)), claveInicial: true };
  const inicial = [
    {
      ...principal,
      nombre: "Administrador principal",
      cargo: "Rector",
      rol: "admin",
      principal: true,
      activo: true,
      version: 1,
      creado: ahora,
      actualizado: ahora,
    },
  ];
  await store.setJSON(USERS_KEY, inicial, { onlyIfNew: true });
  const saved = await store.get(USERS_KEY, { type: "json" });
  return Array.isArray(saved) && saved.length ? saved : inicial;
}

function publico(u) {
  return {
    usuario: u.usuario,
    nombre: u.nombre,
    cargo: u.cargo || "",
    rol: u.rol,
    rolNombre: (ROLES[u.rol] || {}).nombre || u.rol,
    principal: Boolean(u.principal),
    activo: u.activo !== false,
    claveInicial: Boolean(u.claveInicial),
    creado: u.creado,
    actualizado: u.actualizado,
    ultimoIngreso: u.ultimoIngreso || null,
  };
}

function sesionDe(u) {
  return { ...publico(u), permisos: permisosDe(u.rol) };
}

async function guardarUsuarios(mutate, verify) {
  return updateJson(stores.config(), USERS_KEY, () => [], mutate, verify);
}

/* --------------------------------- Ingreso --------------------------------- */

function ipKey(context, req) {
  const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || "local";
  return "intentos/" + createHash("sha256").update(ip).digest("hex").slice(0, 24);
}

async function assertNotLocked(key) {
  const entry = await stores.config().get(key, { type: "json" });
  if (entry && entry.n >= MAX_FAILS && Date.now() - entry.desde < LOCK_MINUTES * 60_000) {
    throw new HttpError(429, `Demasiados intentos fallidos. Espera ${LOCK_MINUTES} minutos e intenta de nuevo.`);
  }
  return entry;
}

async function registerFail(key, entry) {
  const now = Date.now();
  const fresh = !entry || now - entry.desde > LOCK_MINUTES * 60_000;
  await stores.config().setJSON(key, fresh ? { n: 1, desde: now } : { n: entry.n + 1, desde: entry.desde });
}

async function signToken(u) {
  const secret = await getSecret();
  const body = b64(JSON.stringify({ u: u.usuario, v: u.version || 1, exp: Date.now() + SESSION_HOURS * 3600_000 }));
  return `${body}.${b64(createHmac("sha256", secret).update(body).digest())}`;
}

// Recuperación: si RESTABLECER_ACCESO tiene un código nuevo, entrar con la
// contraseña inicial restablece la cuenta principal. Cada código sirve una vez.
async function maybeReset(usuario, clave) {
  const code = process.env.RESTABLECER_ACCESO;
  if (!code || usuario !== INITIAL_USER || !safeEqual(sha(clave), sha(INITIAL_PASSWORD))) return;
  const store = stores.config();
  const marca = sha(code).toString("hex");
  if ((await store.get("restablecer-usado")) === marca) return;
  const campos = await newPasswordFields(INITIAL_PASSWORD);
  await getUsuarios();
  await guardarUsuarios((list) => {
    const p = list.find((u) => u.principal) || list[0];
    Object.assign(p, campos, { usuario: INITIAL_USER, activo: true, rol: "admin", claveInicial: true, version: (p.version || 1) + 1 });
    return list;
  });
  await store.set("restablecer-usado", marca);
}

export async function login(req, context, body) {
  const usuario = String(body.usuario || "").trim().toLowerCase();
  const clave = String(body.clave || "");
  if (!usuario || !clave) throw new HttpError(400, "Escribe el usuario y la contraseña.");
  const key = ipKey(context, req);
  const fails = await assertNotLocked(key);
  await maybeReset(usuario, clave);
  const list = await getUsuarios();
  const u = list.find((x) => x.usuario === usuario);
  const ok = u ? safeEqual(await hashPassword(clave, u.salt), u.hash) : (await hashPassword(clave, "x"), false);
  if (!ok) {
    await registerFail(key, fails);
    await new Promise((r) => setTimeout(r, 500));
    throw new HttpError(401, "El usuario o la contraseña no son correctos.");
  }
  if (u.activo === false) throw new HttpError(403, "Tu usuario está desactivado. Pide al administrador que lo active.");
  if (fails) await stores.config().delete(key);
  const ahora = new Date().toISOString();
  await guardarUsuarios((l) => {
    const x = l.find((y) => y.usuario === u.usuario);
    if (x) x.ultimoIngreso = ahora;
    return l;
  }).catch(() => {});
  return { token: await signToken(u), expira: Date.now() + SESSION_HOURS * 3600_000, ...sesionDe(u) };
}

// Valida el token de la petición y devuelve el usuario.
export async function requireUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [body, sig] = token.split(".");
  if (!body || !sig) throw new HttpError(401, "Entra con tu usuario para continuar.");
  const expected = b64(createHmac("sha256", await getSecret()).update(body).digest());
  if (!safeEqual(sig, expected)) throw new HttpError(401, "Tu sesión no es válida. Entra de nuevo.");
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    throw new HttpError(401, "Tu sesión no es válida. Entra de nuevo.");
  }
  if (!payload.exp || payload.exp < Date.now()) throw new HttpError(401, "Tu sesión terminó. Entra de nuevo.");
  const u = (await getUsuarios()).find((x) => x.usuario === payload.u);
  if (!u) throw new HttpError(401, "Tu usuario ya no existe.");
  if (u.activo === false) throw new HttpError(401, "Tu usuario fue desactivado.");
  if ((u.version || 1) !== payload.v) throw new HttpError(401, "Tu contraseña o tus permisos cambiaron. Entra de nuevo.");
  return sesionDe(u);
}

// Intenta leer la sesión sin exigirla (para vistas previas de borradores).
export async function optionalUser(req) {
  if (!req.headers.get("authorization")) return null;
  try {
    return await requireUser(req);
  } catch {
    return null;
  }
}

export function exigir(usuario, accion, mensaje) {
  if (!puede(usuario, accion)) throw new HttpError(403, mensaje || "Tu tipo de usuario no tiene permiso para hacer esto.");
}

/* --------------------------------- Mi cuenta --------------------------------- */

export async function cambiarMiCuenta(actual, { claveActual, claveNueva, nombre }) {
  const list = await getUsuarios();
  const u = list.find((x) => x.usuario === actual.usuario);
  if (!u) throw new HttpError(404, "Tu usuario ya no existe.");
  const nuevoNombre = nombre !== undefined ? str(nombre, 80, { required: true, field: "nombre" }) : u.nombre;
  let campos = {};
  if (claveNueva) {
    if (!safeEqual(await hashPassword(String(claveActual || ""), u.salt), u.hash)) throw new HttpError(400, "La contraseña actual no es correcta.");
    if (String(claveNueva).length < 8) throw new HttpError(400, "La nueva contraseña debe tener al menos 8 caracteres.");
    campos = { ...(await newPasswordFields(claveNueva)), claveInicial: false, version: (u.version || 1) + 1 };
  }
  let saved;
  await guardarUsuarios(
    (l) => {
      const x = l.find((y) => y.usuario === u.usuario);
      Object.assign(x, campos, { nombre: nuevoNombre, actualizado: new Date().toISOString() });
      saved = x;
      return l;
    },
    (l) => l.some((y) => y.usuario === u.usuario && y.actualizado === saved.actualizado)
  );
  return { token: await signToken(saved), expira: Date.now() + SESSION_HOURS * 3600_000, ...sesionDe(saved) };
}

/* ------------------------- Administración de usuarios ------------------------- */

function validarRol(rol) {
  if (!ROLES[rol]) throw new HttpError(400, "Elige un tipo de usuario válido: Administrador, Editor o Docente.");
  return rol;
}

export async function listarUsuarios() {
  return (await getUsuarios()).map(publico).sort((a, b) => Number(b.principal) - Number(a.principal) || a.nombre.localeCompare(b.nombre));
}

export async function crearUsuario(admin, body) {
  const usuario = String(body.usuario || "").trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    throw new HttpError(400, "El usuario debe tener entre 3 y 40 caracteres: letras sin tilde, números, punto, guion o guion bajo.");
  }
  const nombre = str(body.nombre, 80, { required: true, field: "nombre" });
  const cargo = str(body.cargo, 80);
  const rol = validarRol(body.rol);
  const clave = String(body.clave || "");
  if (clave.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
  const ahora = new Date().toISOString();
  const nuevo = {
    usuario,
    nombre,
    cargo,
    rol,
    ...(await newPasswordFields(clave)),
    claveInicial: true,
    principal: false,
    activo: true,
    version: 1,
    creado: ahora,
    actualizado: ahora,
    creadoPor: admin.usuario,
  };
  await getUsuarios();
  await guardarUsuarios(
    (l) => {
      if (l.some((x) => x.usuario === usuario && x.creado !== ahora)) throw new HttpError(409, `Ya existe un usuario llamado «${usuario}». Elige otro.`);
      return l.some((x) => x.usuario === usuario) ? l : [...l, nuevo];
    },
    (l) => l.some((x) => x.usuario === usuario)
  );
  return publico(nuevo);
}

export async function actualizarUsuario(admin, usuario, body) {
  const list = await getUsuarios();
  const u = list.find((x) => x.usuario === usuario);
  if (!u) throw new HttpError(404, "Este usuario ya no existe.");
  const cambios = {};
  if (body.nombre !== undefined) cambios.nombre = str(body.nombre, 80, { required: true, field: "nombre" });
  if (body.cargo !== undefined) cambios.cargo = str(body.cargo, 80);
  let invalidar = false;
  if (body.rol !== undefined && body.rol !== u.rol) {
    if (u.principal) throw new HttpError(400, "La cuenta principal siempre es Administrador.");
    if (u.usuario === admin.usuario) throw new HttpError(400, "No puedes cambiar tu propio tipo de usuario.");
    cambios.rol = validarRol(body.rol);
    invalidar = true;
  }
  if (body.activo !== undefined && Boolean(body.activo) !== (u.activo !== false)) {
    if (u.principal) throw new HttpError(400, "La cuenta principal no se puede desactivar.");
    if (u.usuario === admin.usuario) throw new HttpError(400, "No puedes desactivar tu propio usuario.");
    cambios.activo = Boolean(body.activo);
    invalidar = true;
  }
  if (body.clave) {
    if (u.principal && !admin.principal) throw new HttpError(403, "Solo la cuenta principal puede cambiar su propia contraseña.");
    if (String(body.clave).length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
    Object.assign(cambios, await newPasswordFields(body.clave), { claveInicial: true });
    invalidar = true;
  }
  let saved;
  await guardarUsuarios(
    (l) => {
      const x = l.find((y) => y.usuario === usuario);
      if (!x) throw new HttpError(404, "Este usuario ya no existe.");
      Object.assign(x, cambios, { actualizado: new Date().toISOString() });
      if (invalidar) x.version = (x.version || 1) + 1;
      saved = x;
      return l;
    },
    (l) => l.some((y) => y.usuario === usuario && y.actualizado === saved.actualizado)
  );
  return publico(saved);
}

export async function eliminarUsuario(admin, usuario) {
  const list = await getUsuarios();
  const u = list.find((x) => x.usuario === usuario);
  if (!u) throw new HttpError(404, "Este usuario ya no existe.");
  if (u.principal) throw new HttpError(400, "La cuenta principal no se puede eliminar.");
  if (u.usuario === admin.usuario) throw new HttpError(400, "No puedes eliminar tu propio usuario.");
  await guardarUsuarios((l) => l.filter((x) => x.usuario !== usuario), (l) => !l.some((x) => x.usuario === usuario));
  return publico(u);
}
