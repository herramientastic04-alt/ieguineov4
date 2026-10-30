/* Cliente de datos del sitio I.E. El Guineo.
   En Netlify habla con /api (Netlify Functions + Netlify Blobs).
   Sin servidor (vista previa) funciona en "modo demostración" y guarda
   los cambios solo en este navegador. */
(function () {
  "use strict";

  const TOKEN_KEY = "guineo.sesion";
  const DEMO_KEY = "guineo.demo.v2";
  const PART_RETRIES = 3;

  const ROLES = {
    admin: { nombre: "Administrador", descripcion: "Rector y coordinadores. Control total: contenido, información institucional y usuarios." },
    editor: { nombre: "Editor", descripcion: "Publica y edita noticias, páginas y documentos, también los de otros usuarios." },
    docente: { nombre: "Docente", descripcion: "Escribe noticias y sube documentos. Un editor o administrador los revisa antes de publicarlos." },
  };
  const PERMISOS = {
    publicar: ["admin", "editor"],
    editarTodo: ["admin", "editor"],
    paginas: ["admin", "editor"],
    carpetas: ["admin", "editor"],
    sitio: ["admin"],
    usuarios: ["admin"],
    actividad: ["admin"],
  };
  const permisosDe = (rol) => Object.keys(PERMISOS).filter((k) => PERMISOS[k].includes(rol));

  let modo = null; // "servidor" | "demo"
  let detectando = null;

  const safe = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
    }
  }

  function detectar() {
    if (modo) return Promise.resolve(modo);
    if (detectando) return detectando;
    detectando = fetch("/api/estado", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (modo = d && d.ok ? "servidor" : "demo"))
      .catch(() => (modo = "demo"));
    return detectando;
  }

  /* ------------------------------- Sesión ------------------------------- */
  function sesion() {
    const raw = safe.get(TOKEN_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw);
      if (!s.expira || s.expira < Date.now()) {
        safe.remove(TOKEN_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  }
  const guardarSesion = (s) => safe.set(TOKEN_KEY, JSON.stringify(s));
  const actualizarSesion = (datos) => {
    const s = sesion();
    if (s) guardarSesion({ ...s, ...datos });
  };
  const puede = (accion) => {
    const s = sesion();
    return Boolean(s && (s.permisos || []).includes(accion));
  };

  /* --------------------------- Modo servidor --------------------------- */
  async function pedir(method, path, body, opts = {}) {
    const headers = {};
    const s = sesion();
    if (s && s.token) headers.authorization = "Bearer " + s.token;
    let payload;
    if (body instanceof ArrayBuffer || body instanceof Blob) {
      headers["content-type"] = "application/octet-stream";
      payload = body;
    } else if (body !== undefined) {
      headers["content-type"] = "application/json";
      payload = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, { method, headers, body: payload, cache: "no-store" });
    } catch {
      throw new ApiError("No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.", 0);
    }
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok) {
      if (res.status === 401 && !opts.login) {
        safe.remove(TOKEN_KEY);
        window.dispatchEvent(new CustomEvent("guineo:sesion-cerrada", { detail: data && data.error }));
      }
      throw new ApiError((data && data.error) || `El servidor respondió con un error (${res.status}).`, res.status);
    }
    return data;
  }

  const id = encodeURIComponent;

  const servidor = {
    sitio: () => pedir("GET", "/api/sitio"),
    guardarSitio: (s) => pedir("PUT", "/api/sitio", s),
    carpetas: (datos) => pedir("POST", "/api/carpetas", datos),

    noticias: (todas) => pedir("GET", "/api/noticias" + (todas ? "?todas=1" : "")),
    noticia: (n) => pedir("GET", "/api/noticias/" + id(n)),
    crearNoticia: (n) => pedir("POST", "/api/noticias", n),
    actualizarNoticia: (i, n) => pedir("PUT", "/api/noticias/" + id(i), n),
    eliminarNoticia: (i) => pedir("DELETE", "/api/noticias/" + id(i)),

    paginas: (todas) => pedir("GET", "/api/paginas" + (todas ? "?todas=1" : "")),
    pagina: (p) => pedir("GET", "/api/paginas/" + id(p)),
    crearPagina: (p) => pedir("POST", "/api/paginas", p),
    actualizarPagina: (i, p) => pedir("PUT", "/api/paginas/" + id(i), p),
    eliminarPagina: (i) => pedir("DELETE", "/api/paginas/" + id(i)),

    archivos: (todos) => pedir("GET", "/api/archivos" + (todos ? "?todos=1" : "")),
    actualizarArchivo: (i, d) => pedir("PATCH", "/api/archivos/" + id(i), d),
    eliminarArchivo: (i) => pedir("DELETE", "/api/archivos/" + id(i)),
    async subirArchivo(file, datos = {}, onProgress = () => {}) {
      const inicio = await pedir("POST", "/api/archivos", {
        nombre: file.name,
        tamano: file.size,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        categoria: datos.categoria,
        clase: datos.clase,
        visible: datos.visible,
      });
      const { partes, tamanoParte } = inicio;
      for (let i = 0; i < partes; i++) {
        const trozo = file.slice(i * tamanoParte, Math.min(file.size, (i + 1) * tamanoParte));
        let error;
        for (let intento = 0; intento < PART_RETRIES; intento++) {
          try {
            await pedir("PUT", `/api/archivos/${id(inicio.id)}/partes/${i}`, await trozo.arrayBuffer());
            error = null;
            break;
          } catch (e) {
            error = e;
            if (e.status && e.status < 500) break;
            await new Promise((r) => setTimeout(r, 700 * (intento + 1)));
          }
        }
        if (error) throw error;
        onProgress((i + 1) / partes);
      }
      return pedir("POST", `/api/archivos/${id(inicio.id)}/completar`);
    },

    async login(usuario, clave) {
      const s = await pedir("POST", "/api/login", { usuario, clave }, { login: true });
      guardarSesion(s);
      return s;
    },
    async verificarSesion() {
      const d = await pedir("GET", "/api/sesion");
      actualizarSesion(d);
      return d;
    },
    async miCuenta(datos) {
      const s = await pedir("POST", "/api/mi-cuenta", datos);
      guardarSesion(s);
      return s;
    },

    usuarios: () => pedir("GET", "/api/usuarios"),
    crearUsuario: (u) => pedir("POST", "/api/usuarios", u),
    actualizarUsuario: (u, d) => pedir("PUT", "/api/usuarios/" + id(u), d),
    eliminarUsuario: (u) => pedir("DELETE", "/api/usuarios/" + id(u)),
    actividad: () => pedir("GET", "/api/actividad"),

    enlaceNoticia: (n) => location.origin + "/n/" + id(n),
    enlacePagina: (slug) => location.origin + "/p/" + id(slug),
  };

  /* ------------------------- Modo demostración ------------------------- */
  // Reproduce las reglas principales del servidor para poder probar el panel.
  const hoyColombia = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
  const demoId = () => Math.random().toString(36).slice(2, 10);
  const pausa = () => new Promise((r) => setTimeout(r, 100));

  function diaAtras(n) {
    const d = new Date(Date.now() - 5 * 3600000 - n * 86400000);
    return d.toISOString().slice(0, 10);
  }

  function demoInicial() {
    const ahora = new Date().toISOString();
    const base = { portada: null, galeria: [], adjuntos: [], autor: "admin", autorNombre: "Administrador principal", creada: ahora, actualizada: ahora, destacada: false, estado: "publicada" };
    return {
      sitio: null,
      usuarios: [
        { usuario: "admin", clave: "12345admin", nombre: "Administrador principal", cargo: "Rector", rol: "admin", principal: true, activo: true, claveInicial: true, creado: ahora, actualizado: ahora },
      ],
      noticias: [
        {
          ...base,
          id: "ejemplo-1",
          titulo: "Ejemplo: jornada de siembra en la huerta escolar",
          resumen: "Noticia de ejemplo. Los estudiantes de básica primaria sembraron plántulas como parte del Proyecto Ambiental Escolar.",
          cuerpo:
            "<p>Esta es una <strong>noticia de ejemplo</strong> para mostrar cómo se ve una publicación. Puedes editarla o eliminarla desde el panel.</p><h2>Una mañana en la huerta</h2><p>Los grupos de tercero y cuarto trabajaron con sus docentes en la preparación de las eras, la siembra y el riego.</p><blockquote>La huerta es un aula al aire libre.</blockquote><ul><li>Preparación del terreno</li><li>Siembra de plántulas</li><li>Turnos de riego por grado</li></ul>",
          categoria: "Eventos",
          fecha: diaAtras(1),
          destacada: true,
        },
        {
          ...base,
          id: "ejemplo-2",
          titulo: "Ejemplo: reunión de padres de familia del cuarto periodo",
          resumen: "Comunicado de ejemplo. Se invita a los acudientes a la entrega de informes académicos en la sede principal.",
          cuerpo: "<p>Comunicado de ejemplo para la entrega de informes.</p>",
          categoria: "Comunicados",
          fecha: diaAtras(6),
        },
        {
          ...base,
          id: "ejemplo-3",
          titulo: "Ejemplo: el grupo de pitos y tambores se presenta en Canalete",
          resumen: "Logro de ejemplo. El proyecto de pitos y tambores representó a la institución en el encuentro cultural municipal.",
          cuerpo: "<p>Publicación de ejemplo sobre un logro institucional.</p>",
          categoria: "Logros",
          fecha: diaAtras(12),
        },
      ],
      paginas: [
        {
          id: "pag-ejemplo",
          slug: "matriculas",
          titulo: "Matrículas",
          resumen: "Página de ejemplo: requisitos y fechas para matricular a los estudiantes.",
          cuerpo:
            "<p>Esta es una <strong>página de ejemplo</strong>. Las páginas sirven para cualquier información que la institución quiera publicar.</p><h2>Requisitos</h2><table><tbody><tr><td><strong>Documento</strong></td><td><strong>Observación</strong></td></tr><tr><td>Registro civil o tarjeta de identidad</td><td>Copia legible</td></tr><tr><td>Certificado de estudios</td><td>Para estudiantes nuevos</td></tr><tr><td>Carné de salud o EPS</td><td>Copia</td></tr></tbody></table><h2>Fechas</h2><p>Escribe aquí las fechas de matrícula de cada grado.</p>",
          portada: null,
          adjuntos: [],
          menu: "principal",
          orden: 1,
          estado: "publicada",
          autor: "admin",
          autorNombre: "Administrador principal",
          creada: ahora,
          actualizada: ahora,
        },
      ],
      archivos: [],
      actividad: [],
    };
  }

  function db() {
    const raw = safe.get(DEMO_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {}
    }
    return demoInicial();
  }

  function guardarDb(d) {
    if (!safe.set(DEMO_KEY, JSON.stringify(d))) {
      throw new ApiError("La vista previa no tiene más espacio en este navegador. En el sitio publicado no existe este límite.", 507);
    }
  }

  function yo() {
    const s = sesion();
    if (!s) {
      window.dispatchEvent(new CustomEvent("guineo:sesion-cerrada"));
      throw new ApiError("Entra con tu usuario para continuar.", 401);
    }
    return s;
  }
  function exigir(accion, mensaje) {
    const s = yo();
    if (!(s.permisos || []).includes(accion)) throw new ApiError(mensaje || "Tu tipo de usuario no tiene permiso para hacer esto.", 403);
    return s;
  }
  const tiene = (s, accion) => (s.permisos || []).includes(accion);
  function registrar(d, s, accion, tipo, titulo) {
    d.actividad.unshift({ fecha: new Date().toISOString(), usuario: s.usuario, nombre: s.nombre, accion, tipo, titulo });
    d.actividad = d.actividad.slice(0, 200);
  }
  const publico = (u) => ({
    usuario: u.usuario,
    nombre: u.nombre,
    cargo: u.cargo || "",
    rol: u.rol,
    rolNombre: ROLES[u.rol].nombre,
    principal: Boolean(u.principal),
    activo: u.activo !== false,
    claveInicial: Boolean(u.claveInicial),
    creado: u.creado,
    actualizado: u.actualizado,
    ultimoIngreso: u.ultimoIngreso || null,
  });
  const sesionDe = (u) => ({ ...publico(u), permisos: permisosDe(u.rol), token: "demo", expira: Date.now() + 12 * 3600000 });
  const esPublica = (n) => n.estado === "publicada" && n.fecha <= hoyColombia();
  const slugify = (t) =>
    String(t || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "pagina";

  const demo = {
    async sitio() {
      await pausa();
      return window.GuineoDefaults.merge(window.GuineoDefaults.sitio, db().sitio || {});
    },
    async guardarSitio(s) {
      const u = exigir("sitio", "Solo los administradores pueden cambiar la información institucional.");
      const d = db();
      d.sitio = { ...s, actualizado: new Date().toISOString() };
      registrar(d, u, "actualizó", "la información institucional", "");
      guardarDb(d);
      return d.sitio;
    },
    async carpetas({ accion, nombre, nuevo }) {
      const u = exigir("carpetas", "Solo los administradores y editores pueden organizar carpetas.");
      const d = db();
      const sitio = window.GuineoDefaults.merge(window.GuineoDefaults.sitio, d.sitio || {});
      const c = sitio.documentos.categorias;
      if (accion === "crear") {
        if (c.some((x) => x.toLowerCase() === nombre.toLowerCase())) throw new ApiError(`Ya existe la carpeta «${nombre}».`, 409);
        c.push(nombre);
      } else if (accion === "renombrar") {
        const i = c.indexOf(nombre);
        if (i >= 0) c[i] = nuevo;
        d.archivos.forEach((f) => f.categoria === nombre && (f.categoria = nuevo));
      } else if (accion === "eliminar") {
        const n = d.archivos.filter((f) => f.clase === "documento" && f.categoria === nombre).length;
        if (n) throw new ApiError(`La carpeta «${nombre}» tiene ${n} documento${n === 1 ? "" : "s"}. Muévelos o elimínalos antes de borrarla.`, 400);
        c.splice(c.indexOf(nombre), 1);
      }
      d.sitio = sitio;
      registrar(d, u, { crear: "creó", renombrar: "renombró", eliminar: "eliminó" }[accion], "la carpeta", nuevo || nombre);
      guardarDb(d);
      return c;
    },

    async noticias(todas) {
      await pausa();
      const l = db().noticias.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
      if (todas) yo();
      return todas ? l : l.filter(esPublica);
    },
    async noticia(i) {
      await pausa();
      const n = db().noticias.find((x) => x.id === i);
      if (!n || (!esPublica(n) && !sesion())) throw new ApiError("No encontramos esta noticia. Puede que la hayan retirado.", 404);
      return n;
    },
    async crearNoticia(n) {
      const s = yo();
      const d = db();
      const ahora = new Date().toISOString();
      const estado = !tiene(s, "publicar") && n.estado === "publicada" ? "revision" : n.estado;
      const item = { ...n, estado, destacada: tiene(s, "publicar") && n.destacada, id: demoId(), autor: s.usuario, autorNombre: s.nombre, creada: ahora, actualizada: ahora };
      d.noticias.unshift(item);
      registrar(d, s, estado === "revision" ? "envió a revisión" : estado === "borrador" ? "creó un borrador de" : "publicó", "la noticia", item.titulo);
      guardarDb(d);
      return item;
    },
    async actualizarNoticia(i, n) {
      const s = yo();
      const d = db();
      const k = d.noticias.findIndex((x) => x.id === i);
      if (k < 0) throw new ApiError("Esta noticia ya no existe.", 404);
      const antes = d.noticias[k];
      if (!tiene(s, "editarTodo") && (antes.autor !== s.usuario || antes.estado === "publicada")) {
        throw new ApiError("Solo puedes editar tus propias noticias mientras no estén publicadas.", 403);
      }
      const estado = !tiene(s, "publicar") && n.estado === "publicada" ? "revision" : n.estado;
      d.noticias[k] = { ...antes, ...n, estado, destacada: tiene(s, "publicar") ? n.destacada : antes.destacada, id: i, actualizada: new Date().toISOString(), editadaPor: s.nombre };
      if (estado === "publicada" && antes.estado !== "publicada") d.noticias[k].publicadaPor = s.nombre;
      registrar(d, s, estado === "publicada" && antes.estado === "revision" ? "aprobó y publicó" : "editó", "la noticia", n.titulo);
      guardarDb(d);
      return d.noticias[k];
    },
    async eliminarNoticia(i) {
      const s = yo();
      const d = db();
      const n = d.noticias.find((x) => x.id === i);
      if (n && !tiene(s, "editarTodo") && (n.autor !== s.usuario || n.estado === "publicada")) {
        throw new ApiError("Solo puedes eliminar tus propias noticias mientras no estén publicadas.", 403);
      }
      d.noticias = d.noticias.filter((x) => x.id !== i);
      if (n) registrar(d, s, "eliminó", "la noticia", n.titulo);
      guardarDb(d);
      return { ok: true };
    },

    async paginas(todas) {
      await pausa();
      const l = db().paginas.slice().sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || a.titulo.localeCompare(b.titulo));
      return todas ? l : l.filter((p) => p.estado === "publicada");
    },
    async pagina(i) {
      await pausa();
      const p = db().paginas.find((x) => x.id === i || x.slug === i);
      if (!p || (p.estado !== "publicada" && !sesion())) throw new ApiError("No encontramos esta página.", 404);
      return p;
    },
    async crearPagina(p) {
      const s = exigir("paginas", "Solo los administradores y editores pueden crear páginas.");
      const d = db();
      let slug = slugify(p.slug || p.titulo);
      const raiz = slug;
      let k = 2;
      while (d.paginas.some((x) => x.slug === slug)) slug = `${raiz}-${k++}`;
      const ahora = new Date().toISOString();
      const item = { ...p, slug, id: demoId(), autor: s.usuario, autorNombre: s.nombre, creada: ahora, actualizada: ahora };
      d.paginas.push(item);
      registrar(d, s, p.estado === "borrador" ? "creó un borrador de" : "publicó", "la página", p.titulo);
      guardarDb(d);
      return item;
    },
    async actualizarPagina(i, p) {
      const s = exigir("paginas", "Solo los administradores y editores pueden modificar páginas.");
      const d = db();
      const k = d.paginas.findIndex((x) => x.id === i);
      if (k < 0) throw new ApiError("Esta página ya no existe.", 404);
      let slug = d.paginas[k].slug;
      if (p.slug && p.slug !== slug) {
        slug = slugify(p.slug);
        const raiz = slug;
        let n = 2;
        while (d.paginas.some((x) => x.slug === slug && x.id !== i)) slug = `${raiz}-${n++}`;
      }
      d.paginas[k] = { ...d.paginas[k], ...p, slug, id: i, actualizada: new Date().toISOString(), editadaPor: s.nombre };
      registrar(d, s, "editó", "la página", p.titulo);
      guardarDb(d);
      return d.paginas[k];
    },
    async eliminarPagina(i) {
      const s = exigir("paginas");
      const d = db();
      const p = d.paginas.find((x) => x.id === i);
      d.paginas = d.paginas.filter((x) => x.id !== i);
      if (p) registrar(d, s, "eliminó", "la página", p.titulo);
      guardarDb(d);
      return { ok: true };
    },

    async archivos(todos) {
      await pausa();
      const l = db().archivos;
      return todos ? l : l.filter((f) => f.clase === "documento" && f.visible !== false && !f.revision);
    },
    async actualizarArchivo(i, datos) {
      const s = yo();
      const d = db();
      const f = d.archivos.find((x) => x.id === i);
      if (!f) throw new ApiError("Este archivo ya no existe.", 404);
      if (!tiene(s, "editarTodo") && f.autor !== s.usuario) throw new ApiError("Solo puedes modificar los archivos que tú subiste.", 403);
      const aprobado = tiene(s, "publicar") && datos.revision === false && f.revision;
      Object.assign(f, {
        titulo: datos.titulo !== undefined ? datos.titulo || f.titulo : f.titulo,
        descripcion: datos.descripcion !== undefined ? datos.descripcion : f.descripcion,
        categoria: datos.categoria !== undefined ? datos.categoria || f.categoria : f.categoria,
        visible: tiene(s, "publicar") && datos.visible !== undefined ? datos.visible : aprobado ? true : f.visible,
        revision: aprobado ? false : f.revision,
        actualizado: new Date().toISOString(),
      });
      if (aprobado) f.aprobadoPor = s.nombre;
      if (f.clase === "documento") registrar(d, s, aprobado ? "aprobó" : "editó", "el documento", f.titulo);
      guardarDb(d);
      return f;
    },
    async eliminarArchivo(i) {
      const s = yo();
      const d = db();
      const f = d.archivos.find((x) => x.id === i);
      if (f && !tiene(s, "editarTodo") && f.autor !== s.usuario) throw new ApiError("Solo puedes eliminar los archivos que tú subiste.", 403);
      d.archivos = d.archivos.filter((x) => x.id !== i);
      if (f && f.clase === "documento") registrar(d, s, "eliminó", "el documento", f.titulo);
      guardarDb(d);
      return { ok: true };
    },
    async subirArchivo(file, datos = {}, onProgress = () => {}) {
      const s = yo();
      if (file.size > 1.5 * 1024 * 1024) {
        throw new ApiError("En la vista previa solo se pueden subir archivos de hasta 1,5 MB. En el sitio publicado el límite es 18 MB.", 413);
      }
      const url = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new ApiError("No se pudo leer el archivo.", 400));
        r.readAsDataURL(file);
      });
      onProgress(1);
      const ext = (/\.([a-z0-9]{1,5})$/i.exec(file.name) || [, ""])[1].toLowerCase();
      const clase = datos.clase || "documento";
      const rec = {
        id: demoId(),
        nombre: file.name,
        titulo: datos.titulo || file.name.replace(/\.[^.]+$/, ""),
        descripcion: datos.descripcion || "",
        categoria: datos.categoria || "Documentos institucionales",
        tipo: file.type || "application/octet-stream",
        ext,
        tamano: file.size,
        partes: 1,
        clase,
        visible: datos.visible !== false,
        revision: clase === "documento" && !tiene(s, "publicar"),
        autor: s.usuario,
        autorNombre: s.nombre,
        url,
        creado: new Date().toISOString(),
      };
      const d = db();
      d.archivos.unshift(rec);
      if (clase === "documento") registrar(d, s, rec.revision ? "subió para revisión" : "subió", "el documento", rec.titulo);
      guardarDb(d);
      return rec;
    },

    async login(usuario, clave) {
      await pausa();
      const d = db();
      const u = d.usuarios.find((x) => x.usuario === usuario.trim().toLowerCase());
      if (!u || u.clave !== clave) throw new ApiError("El usuario o la contraseña no son correctos.", 401);
      if (u.activo === false) throw new ApiError("Tu usuario está desactivado. Pide al administrador que lo active.", 403);
      u.ultimoIngreso = new Date().toISOString();
      guardarDb(d);
      const s = sesionDe(u);
      guardarSesion(s);
      return s;
    },
    async verificarSesion() {
      const s = yo();
      const u = db().usuarios.find((x) => x.usuario === s.usuario);
      if (!u || u.activo === false) {
        safe.remove(TOKEN_KEY);
        throw new ApiError("Tu sesión terminó. Entra de nuevo.", 401);
      }
      const n = sesionDe(u);
      actualizarSesion({ ...n, token: s.token, expira: s.expira });
      return n;
    },
    async miCuenta({ claveActual, claveNueva, nombre }) {
      const s = yo();
      const d = db();
      const u = d.usuarios.find((x) => x.usuario === s.usuario);
      if (claveNueva) {
        if (claveActual !== u.clave) throw new ApiError("La contraseña actual no es correcta.", 400);
        if (claveNueva.length < 8) throw new ApiError("La nueva contraseña debe tener al menos 8 caracteres.", 400);
        u.clave = claveNueva;
        u.claveInicial = false;
      }
      if (nombre) u.nombre = nombre;
      u.actualizado = new Date().toISOString();
      guardarDb(d);
      const n = sesionDe(u);
      guardarSesion(n);
      return n;
    },

    async usuarios() {
      exigir("usuarios");
      return db().usuarios.map(publico);
    },
    async crearUsuario(datos) {
      const s = exigir("usuarios", "Solo los administradores pueden crear usuarios.");
      const d = db();
      const usuario = String(datos.usuario || "").trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) throw new ApiError("El usuario debe tener entre 3 y 40 caracteres: letras sin tilde, números, punto, guion o guion bajo.", 400);
      if (d.usuarios.some((u) => u.usuario === usuario)) throw new ApiError(`Ya existe un usuario llamado «${usuario}». Elige otro.`, 409);
      if (!datos.nombre) throw new ApiError("Falta el nombre.", 400);
      if (!datos.clave || datos.clave.length < 8) throw new ApiError("La contraseña debe tener al menos 8 caracteres.", 400);
      const ahora = new Date().toISOString();
      const u = { usuario, clave: datos.clave, nombre: datos.nombre, cargo: datos.cargo || "", rol: datos.rol, principal: false, activo: true, claveInicial: true, creado: ahora, actualizado: ahora };
      d.usuarios.push(u);
      registrar(d, s, "creó", "el usuario", `${u.nombre} (${ROLES[u.rol].nombre})`);
      guardarDb(d);
      return publico(u);
    },
    async actualizarUsuario(usuario, datos) {
      const s = exigir("usuarios");
      const d = db();
      const u = d.usuarios.find((x) => x.usuario === usuario);
      if (!u) throw new ApiError("Este usuario ya no existe.", 404);
      if (datos.rol && datos.rol !== u.rol && (u.principal || u.usuario === s.usuario)) throw new ApiError("No se puede cambiar el tipo de este usuario.", 400);
      if (datos.activo === false && (u.principal || u.usuario === s.usuario)) throw new ApiError("Este usuario no se puede desactivar.", 400);
      if (datos.clave && datos.clave.length < 8) throw new ApiError("La contraseña debe tener al menos 8 caracteres.", 400);
      if (datos.clave && u.principal && !s.principal) throw new ApiError("Solo la cuenta principal puede cambiar su propia contraseña.", 403);
      Object.assign(u, {
        nombre: datos.nombre ?? u.nombre,
        cargo: datos.cargo ?? u.cargo,
        rol: datos.rol ?? u.rol,
        activo: datos.activo ?? u.activo,
        actualizado: new Date().toISOString(),
      });
      if (datos.clave) Object.assign(u, { clave: datos.clave, claveInicial: true });
      registrar(d, s, "modificó", "el usuario", `${u.nombre} (${ROLES[u.rol].nombre})`);
      guardarDb(d);
      return publico(u);
    },
    async eliminarUsuario(usuario) {
      const s = exigir("usuarios");
      const d = db();
      const u = d.usuarios.find((x) => x.usuario === usuario);
      if (!u) throw new ApiError("Este usuario ya no existe.", 404);
      if (u.principal || u.usuario === s.usuario) throw new ApiError("Este usuario no se puede eliminar.", 400);
      d.usuarios = d.usuarios.filter((x) => x.usuario !== usuario);
      registrar(d, s, "eliminó", "el usuario", u.nombre);
      guardarDb(d);
      return { ok: true };
    },
    async actividad() {
      exigir("actividad");
      return db().actividad;
    },

    enlaceNoticia: (n) => location.href.split("#")[0].replace(/admin\.html$/, "") + "#noticia-" + id(n),
    enlacePagina: (slug) => location.href.split("#")[0].replace(/admin\.html$/, "") + "#pagina-" + id(slug),
  };

  /* ----------------------------- Utilidades ----------------------------- */
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function fecha(iso, corta) {
    if (!iso) return "";
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return "";
    return corta ? `${d} ${MESES[m - 1].slice(0, 3)}. ${y}` : `${d} de ${MESES[m - 1]} de ${y}`;
  }

  // Fecha y hora en Colombia a partir de un ISO en UTC.
  function fechaHora(iso) {
    if (!iso) return "";
    const local = new Date(new Date(iso).getTime() - 5 * 3600000).toISOString();
    const [h, mi] = local.slice(11, 16).split(":").map(Number);
    const ampm = h >= 12 ? "p. m." : "a. m.";
    return `${fecha(local, true)}, ${((h + 11) % 12) + 1}:${String(mi).padStart(2, "0")} ${ampm}`;
  }

  function tamano(bytes) {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1).replace(".", ",") + " MB";
  }

  function familia(ext) {
    ext = (ext || "").toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["doc", "docx", "odt", "rtf", "txt"].includes(ext)) return "texto";
    if (["xls", "xlsx", "ods", "csv"].includes(ext)) return "hoja";
    if (["ppt", "pptx", "odp"].includes(ext)) return "presentacion";
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "imagen";
    if (["mp3", "m4a", "ogg", "wav", "mp4"].includes(ext)) return "medio";
    return "otro";
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function limpiarHtml(html) {
    if (!window.DOMPurify) return esc(html);
    return window.DOMPurify.sanitize(html || "", {
      ADD_TAGS: ["iframe"],
      ADD_ATTR: ["allow", "allowfullscreen", "frameborder", "target", "data-list"],
    });
  }

  if (window.DOMPurify && !window.__guineoPurify) {
    window.__guineoPurify = true;
    window.DOMPurify.addHook("uponSanitizeElement", (node, data) => {
      if (data.tagName === "iframe") {
        const src = node.getAttribute("src") || "";
        if (!/^https:\/\/(www\.youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/|drive\.google\.com\/file\/)/.test(src)) {
          node.parentNode && node.parentNode.removeChild(node);
        }
      }
    });
    window.DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A" && node.getAttribute("href") && /^https?:/i.test(node.getAttribute("href"))) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      }
    });
  }

  function toast(mensaje, tipo) {
    let zona = document.querySelector(".toasts");
    if (!zona) {
      zona = document.createElement("div");
      zona.className = "toasts";
      zona.setAttribute("role", "status");
      zona.setAttribute("aria-live", "polite");
      document.body.appendChild(zona);
    }
    const t = document.createElement("div");
    t.className = "toast" + (tipo === "error" ? " error" : "");
    t.textContent = mensaje;
    zona.appendChild(t);
    setTimeout(() => t.remove(), tipo === "error" ? 6500 : 3500);
  }

  // Reduce imágenes grandes antes de subirlas (máximo 1600 px).
  async function prepararImagen(file, maximo = 1600) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
      if (escala === 1 && file.size < 700 * 1024) return file;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * escala);
      canvas.height = Math.round(bitmap.height * escala);
      const ctx = canvas.getContext("2d");
      const conTransparencia = file.type === "image/png" && file.size < 900 * 1024;
      if (!conTransparencia) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const tipo = conTransparencia ? "image/png" : "image/jpeg";
      const blob = await new Promise((r) => canvas.toBlob(r, tipo, 0.85));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + (tipo === "image/png" ? ".png" : ".jpg"), { type: tipo });
    } catch {
      return file;
    }
  }

  const metodos = [
    "sitio", "guardarSitio", "carpetas",
    "noticias", "noticia", "crearNoticia", "actualizarNoticia", "eliminarNoticia",
    "paginas", "pagina", "crearPagina", "actualizarPagina", "eliminarPagina",
    "archivos", "actualizarArchivo", "eliminarArchivo", "subirArchivo",
    "login", "verificarSesion", "miCuenta",
    "usuarios", "crearUsuario", "actualizarUsuario", "eliminarUsuario", "actividad",
  ];

  const Guineo = {
    detectar,
    get modo() {
      return modo;
    },
    sesion,
    puede,
    cerrarSesion: () => safe.remove(TOKEN_KEY),
    enlaceNoticia: (n) => (modo === "servidor" ? servidor : demo).enlaceNoticia(n),
    enlacePagina: (s) => (modo === "servidor" ? servidor : demo).enlacePagina(s),
    ROLES,
    fecha,
    fechaHora,
    tamano,
    familia,
    esc,
    limpiarHtml,
    toast,
    prepararImagen,
    ApiError,
  };
  metodos.forEach((m) => {
    Guineo[m] = async (...a) => {
      await detectar();
      return (modo === "servidor" ? servidor : demo)[m](...a);
    };
  });
  window.Guineo = Guineo;
})();
