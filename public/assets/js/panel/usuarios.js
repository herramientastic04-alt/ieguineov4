/* Panel El Guineo: usuarios, actividad y mi cuenta. */
(function (P) {
  "use strict";
  const { G, esc, $, $$ } = P;
  let usuarios = [];
  let formulario = null; // null | "nuevo" | usuario en edición
  let credencialesNuevas = null;

  // Contraseña fácil de dictar: palabra + número (sin letras confusas).
  function generarClave() {
    const palabras = ["guineo", "canalete", "cordoba", "estudio", "progreso", "sinu", "ceiba", "palma", "rio", "sabana"];
    const p = palabras[Math.floor(Math.random() * palabras.length)];
    const n = String(Math.floor(1000 + Math.random() * 9000));
    return p.charAt(0).toUpperCase() + p.slice(1) + n;
  }

  function sugerirUsuario(nombre) {
    const partes = String(nombre || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
    if (!partes.length) return "";
    return (partes[0] + (partes[1] ? "." + partes[1] : "")).slice(0, 40);
  }

  const pillRol = (u) => `<span class="rol rol-${esc(u.rol)}">${esc(u.rolNombre || G.ROLES[u.rol].nombre)}</span>`;

  /* -------------------------------- Usuarios -------------------------------- */
  P.ruta("usuarios", async function () {
    P.titulo("Usuarios");
    P.vista.innerHTML = '<p class="cargando-panel">Cargando usuarios…</p>';
    try {
      usuarios = await G.usuarios();
    } catch (e) {
      P.vista.innerHTML = `<div class="vacio-panel"><strong>No se pudieron cargar los usuarios</strong>${esc(e.message)}</div>`;
      return;
    }
    pintar();
  });

  function pintar() {
    const yo = P.st.sesion;
    P.vista.innerHTML = `
      <div class="vista-cabeza">
        <div><h1>Usuarios</h1><p>Crea las cuentas de quienes publican en el sitio. Cada persona entra con su propio usuario y contraseña.</p></div>
        <button class="boton rojo" type="button" id="nuevo-usuario">Nuevo usuario</button>
      </div>
      ${credencialesNuevas ? credencialesHtml(credencialesNuevas) : ""}
      <div id="form-usuario-cont">${formulario ? formularioHtml() : ""}</div>
      <div class="tabla-contenedor"><table class="tabla">
        <thead><tr><th scope="col">Nombre</th><th scope="col">Usuario</th><th scope="col">Tipo</th><th scope="col">Último ingreso</th><th scope="col"><span class="visualmente-oculto">Acciones</span></th></tr></thead>
        <tbody>${usuarios
          .map(
            (u) => `<tr class="${u.activo ? "" : "inactivo"}">
          <td class="titulo-celda"><strong>${esc(u.nombre)}</strong><small>${esc(u.cargo || "")}${u.principal ? (u.cargo ? ", " : "") + "cuenta principal" : ""}${u.usuario === yo.usuario ? " (tú)" : ""}</small></td>
          <td class="fecha-celda">${esc(u.usuario)}</td>
          <td>${pillRol(u)}${u.activo ? "" : ' <span class="estado oculto">Desactivado</span>'}${u.claveInicial ? ' <span class="estado programada" title="Aún no ha cambiado la contraseña que le asignaron">Clave asignada</span>' : ""}</td>
          <td class="fecha-celda">${u.ultimoIngreso ? esc(G.fechaHora(u.ultimoIngreso)) : "Nunca"}</td>
          <td class="acciones-celda">
            ${u.principal && u.usuario === yo.usuario ? `<a class="boton discreto" href="#mi-cuenta">Mi cuenta</a>` : u.principal ? "" : `<button class="boton discreto" type="button" data-editar-usuario="${esc(u.usuario)}">Editar</button>`}
            ${!u.principal && u.usuario !== yo.usuario ? `<button class="boton discreto" type="button" data-activar="${esc(u.usuario)}">${u.activo ? "Desactivar" : "Activar"}</button><button class="boton discreto" type="button" data-borrar-usuario="${esc(u.usuario)}">Eliminar</button>` : ""}
          </td></tr>`
          )
          .join("")}</tbody></table></div>
      <section class="roles-explicacion">
        <h2 class="subtitulo">Qué puede hacer cada tipo de usuario</h2>
        <div class="tabla-contenedor"><table class="tabla tabla-permisos">
          <thead><tr><th scope="col">Acción</th><th scope="col">Administrador</th><th scope="col">Editor</th><th scope="col">Docente</th></tr></thead>
          <tbody>
            ${[
              ["Escribir noticias y subir documentos", "Sí", "Sí", "Sí, quedan en revisión"],
              ["Publicar y aprobar lo que envían los docentes", "Sí", "Sí", "No"],
              ["Editar o eliminar contenido de otros", "Sí", "Sí", "No, solo lo suyo sin publicar"],
              ["Crear páginas y organizar carpetas", "Sí", "Sí", "No"],
              ["Cambiar misión, visión, símbolos, contacto y aviso", "Sí", "No", "No"],
              ["Crear usuarios y ver la actividad", "Sí", "No", "No"],
            ]
              .map((f) => `<tr><td>${f[0]}</td>${f.slice(1).map((c) => `<td class="${c === "No" ? "no" : c === "Sí" ? "si" : ""}">${c}</td>`).join("")}</tr>`)
              .join("")}
          </tbody></table></div>
        <p class="nota">La cuenta principal (${esc(usuarios.find((u) => u.principal)?.usuario || "admin")}) no se puede eliminar ni desactivar. Úsala para el rector y crea una cuenta de Administrador para cada coordinador.</p>
      </section>`;

    $("#nuevo-usuario").addEventListener("click", () => {
      formulario = "nuevo";
      credencialesNuevas = null;
      pintar();
      $("#u-nombre").focus();
    });
    $$("[data-editar-usuario]").forEach((b) =>
      b.addEventListener("click", () => {
        formulario = b.dataset.editarUsuario;
        credencialesNuevas = null;
        pintar();
        $("#form-usuario").scrollIntoView({ block: "start" });
        $("#u-nombre").focus();
      })
    );
    $$("[data-activar]").forEach((b) =>
      b.addEventListener("click", async () => {
        const u = usuarios.find((x) => x.usuario === b.dataset.activar);
        if (u.activo && !(await P.confirmar("¿Desactivar este usuario?", `${u.nombre} no podrá entrar al panel hasta que lo actives de nuevo. Su contenido se conserva.`, "Desactivar"))) return;
        try {
          const r = await G.actualizarUsuario(u.usuario, { activo: !u.activo });
          Object.assign(u, r);
          G.toast(r.activo ? "Usuario activado" : "Usuario desactivado");
          pintar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
    $$("[data-borrar-usuario]").forEach((b) =>
      b.addEventListener("click", async () => {
        const u = usuarios.find((x) => x.usuario === b.dataset.borrarUsuario);
        if (!(await P.confirmar("¿Eliminar este usuario?", `${u.nombre} ya no podrá entrar. Las noticias y documentos que publicó se conservan.`, "Eliminar usuario"))) return;
        try {
          await G.eliminarUsuario(u.usuario);
          usuarios = usuarios.filter((x) => x.usuario !== u.usuario);
          G.toast("Usuario eliminado");
          pintar();
        } catch (e) {
          G.toast(e.message, "error");
        }
      })
    );
    const copiar = $("#copiar-credenciales");
    if (copiar) copiar.addEventListener("click", () => P.copiar(copiar.dataset.texto, "Datos copiados"));
    const cerrarCred = $("#cerrar-credenciales");
    if (cerrarCred)
      cerrarCred.addEventListener("click", () => {
        credencialesNuevas = null;
        pintar();
      });
    if (formulario) enlazarFormulario();
  }

  function credencialesHtml(c) {
    const texto = `Panel de la I.E. El Guineo\nDirección: ${location.origin}/admin\nUsuario: ${c.usuario}\nContraseña: ${c.clave}`;
    return `<div class="credenciales" role="status">
      <div>
        <h2>${esc(c.titulo)}</h2>
        <p>Entrégale estos datos a ${esc(c.nombre)}. La contraseña no se volverá a mostrar; al entrar, puede cambiarla en Mi cuenta.</p>
        <dl><div><dt>Usuario</dt><dd>${esc(c.usuario)}</dd></div><div><dt>Contraseña</dt><dd>${esc(c.clave)}</dd></div></dl>
      </div>
      <div class="acciones-fila"><button class="boton" type="button" id="copiar-credenciales" data-texto="${esc(texto)}">Copiar datos</button><button class="boton secundario" type="button" id="cerrar-credenciales">Listo</button></div>
    </div>`;
  }

  function formularioHtml() {
    const nuevo = formulario === "nuevo";
    const u = nuevo ? { nombre: "", cargo: "", usuario: "", rol: "docente" } : usuarios.find((x) => x.usuario === formulario);
    if (!u) return "";
    return `<form class="caja form-usuario" id="form-usuario" novalidate>
      <h2>${nuevo ? "Nuevo usuario" : "Editar a " + esc(u.nombre)}</h2>
      <div class="dos-columnas">
        <div class="campo"><label for="u-nombre">Nombre completo</label><input type="text" id="u-nombre" value="${esc(u.nombre)}" maxlength="80" required></div>
        <div class="campo"><label for="u-cargo">Cargo</label><input type="text" id="u-cargo" value="${esc(u.cargo || "")}" maxlength="80" placeholder="Coordinador, docente de 3.°, secretaria…"></div>
      </div>
      ${
        nuevo
          ? `<div class="campo"><label for="u-usuario">Usuario para entrar</label><input type="text" id="u-usuario" maxlength="40" autocapitalize="none" spellcheck="false" placeholder="por ejemplo: ana.perez"><span class="ayuda">Letras sin tilde, números, punto o guion. Sin espacios.</span></div>`
          : `<p class="nota">Usuario: <strong>${esc(u.usuario)}</strong></p>`
      }
      <fieldset class="tipos-usuario">
        <legend>Tipo de usuario</legend>
        ${Object.entries(G.ROLES)
          .map(
            ([k, r]) => `<label class="opcion"><input type="radio" name="u-rol" value="${k}" ${u.rol === k ? "checked" : ""}><span>${esc(r.nombre)}<small>${esc(r.descripcion)}</small></span></label>`
          )
          .join("")}
      </fieldset>
      <div class="campo">
        <label for="u-clave">${nuevo ? "Contraseña" : "Nueva contraseña (opcional)"}</label>
        <div class="clave-fila"><input type="text" id="u-clave" autocomplete="new-password" spellcheck="false" ${nuevo ? `value="${esc(generarClave())}"` : 'placeholder="Déjala vacía para no cambiarla"'}><button type="button" class="boton secundario" id="u-generar">Generar</button></div>
        <span class="ayuda">Mínimo 8 caracteres. ${nuevo ? "Al guardar te mostramos los datos para entregárselos." : "Si la cambias, su sesión actual se cierra."}</span>
      </div>
      <p class="error-form" id="u-error" role="alert" hidden></p>
      <div class="acciones-fila"><button class="boton" type="submit" id="u-guardar">${nuevo ? "Crear usuario" : "Guardar cambios"}</button><button class="boton secundario" type="button" id="u-cancelar">Cancelar</button></div>
    </form>`;
  }

  function enlazarFormulario() {
    const nuevo = formulario === "nuevo";
    const form = $("#form-usuario");
    if (!form) return;
    const usuarioInput = $("#u-usuario");
    let tocado = false;
    if (usuarioInput) {
      usuarioInput.addEventListener("input", () => (tocado = true));
      $("#u-nombre").addEventListener("input", (e) => {
        if (!tocado) usuarioInput.value = sugerirUsuario(e.target.value);
      });
    }
    $("#u-generar").addEventListener("click", () => ($("#u-clave").value = generarClave()));
    $("#u-cancelar").addEventListener("click", () => {
      formulario = null;
      pintar();
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#u-error");
      err.hidden = true;
      const datos = {
        nombre: $("#u-nombre").value.trim(),
        cargo: $("#u-cargo").value.trim(),
        rol: ($('input[name="u-rol"]:checked') || {}).value,
      };
      const clave = $("#u-clave").value.trim();
      if (!datos.nombre) {
        err.hidden = false;
        err.textContent = "Escribe el nombre completo.";
        return;
      }
      if ((nuevo || clave) && clave.length < 8) {
        err.hidden = false;
        err.textContent = "La contraseña debe tener al menos 8 caracteres.";
        return;
      }
      const b = $("#u-guardar");
      b.disabled = true;
      try {
        if (nuevo) {
          const u = await G.crearUsuario({ ...datos, usuario: $("#u-usuario").value.trim().toLowerCase(), clave });
          usuarios.push(u);
          credencialesNuevas = { titulo: "Usuario creado", nombre: u.nombre, usuario: u.usuario, clave };
          G.toast(`Usuario ${u.usuario} creado`);
        } else {
          const r = await G.actualizarUsuario(formulario, clave ? { ...datos, clave } : datos);
          Object.assign(usuarios.find((x) => x.usuario === formulario), r);
          if (clave) credencialesNuevas = { titulo: "Contraseña restablecida", nombre: r.nombre, usuario: r.usuario, clave };
          G.toast("Cambios guardados");
        }
        formulario = null;
        pintar();
      } catch (ex) {
        err.hidden = false;
        err.textContent = ex.message;
        b.disabled = false;
      }
    });
  }

  /* -------------------------------- Actividad -------------------------------- */
  P.ruta("actividad", async function () {
    P.titulo("Actividad");
    P.vista.innerHTML = '<p class="cargando-panel">Cargando actividad…</p>';
    let lista;
    try {
      lista = await G.actividad();
    } catch (e) {
      P.vista.innerHTML = `<div class="vacio-panel"><strong>No se pudo cargar la actividad</strong>${esc(e.message)}</div>`;
      return;
    }
    const personas = Array.from(new Map(lista.map((a) => [a.usuario, a.nombre])).entries());
    P.vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Actividad</h1><p>Lo que ha hecho cada usuario en el panel, del más reciente al más antiguo. Se guardan los últimos 400 movimientos.</p></div></div>
      <div class="herramientas">
        <label class="visualmente-oculto" for="act-usuario">Usuario</label>
        <select id="act-usuario"><option value="">Todas las personas</option>${personas.map(([u, n]) => `<option value="${esc(u)}">${esc(n)}</option>`).join("")}</select>
      </div>
      <div id="lista-actividad"></div>`;
    const pintarLista = () => {
      const quien = $("#act-usuario").value;
      const l = lista.filter((a) => !quien || a.usuario === quien);
      if (!l.length) {
        $("#lista-actividad").innerHTML = '<div class="tabla-contenedor"><div class="vacio-panel"><strong>Sin actividad todavía</strong>Aquí verás quién publica, edita o aprueba contenido.</div></div>';
        return;
      }
      let dia = "";
      $("#lista-actividad").innerHTML = `<ol class="actividad">${l
        .map((a) => {
          const d = new Date(new Date(a.fecha).getTime() - 5 * 3600000).toISOString().slice(0, 10);
          const cabeza = d !== dia ? `<li class="actividad-dia">${d === P.hoy() ? "Hoy" : esc(P.fecha(d))}</li>` : "";
          dia = d;
          const hora = G.fechaHora(a.fecha).split(", ")[1] || "";
          return `${cabeza}<li><time>${esc(hora)}</time><p><strong>${esc(a.nombre)}</strong> ${esc(a.accion)} ${esc(a.tipo)}${a.titulo ? ` «${esc(a.titulo)}»` : ""}</p></li>`;
        })
        .join("")}</ol>`;
    };
    $("#act-usuario").addEventListener("change", pintarLista);
    pintarLista();
  });

  /* -------------------------------- Mi cuenta -------------------------------- */
  P.ruta("mi-cuenta", function () {
    P.titulo("Mi cuenta");
    const s = P.st.sesion;
    const rol = G.ROLES[s.rol];
    P.vista.innerHTML = `
      <div class="vista-cabeza"><div><h1>Mi cuenta</h1><p>Entras como <strong>${esc(s.usuario)}</strong>, con tipo de usuario ${pillRol(s)}. ${esc(rol.descripcion)}</p></div></div>
      ${s.claveInicial ? `<div class="aviso-panel alerta" style="margin-bottom:1.5rem"><p><strong>Estás usando la contraseña que te asignaron.</strong> Cámbiala por una que solo tú conozcas.</p></div>` : ""}
      <form class="grupo" id="form-cuenta" novalidate style="max-width:52rem">
        <div class="grupo-cabeza"><h2>Datos y contraseña</h2><p>Al cambiar la contraseña, las demás sesiones abiertas con tu usuario se cierran.</p></div>
        <div class="grupo-campos">
          <div class="campo"><label for="c-nombre">Tu nombre</label><input type="text" id="c-nombre" value="${esc(s.nombre)}" maxlength="80"><span class="ayuda">Aparece como autor de lo que publicas.</span></div>
          <div class="campo"><label for="c-actual">Contraseña actual</label><input type="password" id="c-actual" autocomplete="current-password"></div>
          <div class="dos-columnas">
            <div class="campo"><label for="c-nueva">Nueva contraseña</label><input type="password" id="c-nueva" autocomplete="new-password" minlength="8"></div>
            <div class="campo"><label for="c-repetir">Repite la nueva contraseña</label><input type="password" id="c-repetir" autocomplete="new-password" minlength="8"></div>
          </div>
          <span class="ayuda">Deja las contraseñas vacías si solo quieres cambiar tu nombre.</span>
          <p class="error-form" id="c-error" role="alert" hidden></p>
          <div><button class="boton" type="submit" id="c-guardar">Guardar</button></div>
        </div>
      </form>`;
    $("#form-cuenta").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#c-error");
      const mostrar = (m) => {
        err.hidden = false;
        err.textContent = m;
      };
      err.hidden = true;
      const nombre = $("#c-nombre").value.trim();
      const claveActual = $("#c-actual").value;
      const claveNueva = $("#c-nueva").value;
      if (!nombre) return mostrar("Escribe tu nombre.");
      if (claveNueva || claveActual) {
        if (!claveActual) return mostrar("Escribe tu contraseña actual.");
        if (claveNueva.length < 8) return mostrar("La nueva contraseña debe tener al menos 8 caracteres.");
        if (claveNueva !== $("#c-repetir").value) return mostrar("Las dos contraseñas nuevas no coinciden.");
      }
      const b = $("#c-guardar");
      b.disabled = true;
      try {
        const n = await G.miCuenta(claveNueva ? { nombre, claveActual, claveNueva } : { nombre });
        P.st.sesion = n;
        P.pintarUsuario();
        G.toast(claveNueva ? "Contraseña actualizada" : "Datos guardados");
        P.enrutar();
      } catch (ex) {
        mostrar(ex.message);
        b.disabled = false;
      }
    });
  });
})(window.Panel);
