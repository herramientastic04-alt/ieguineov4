// Tipos de usuario del panel y lo que puede hacer cada uno.

export const ROLES = {
  admin: {
    nombre: "Administrador",
    descripcion: "Rector y coordinadores. Control total: contenido, información institucional y usuarios.",
  },
  editor: {
    nombre: "Editor",
    descripcion: "Publica y edita noticias, páginas y documentos, también los de otros usuarios.",
  },
  docente: {
    nombre: "Docente",
    descripcion: "Escribe noticias y sube documentos. Un editor o administrador los revisa antes de publicarlos.",
  },
};

const PERMISOS = {
  publicar: ["admin", "editor"], // publicar y aprobar contenido
  editarTodo: ["admin", "editor"], // modificar contenido de otros usuarios
  paginas: ["admin", "editor"],
  carpetas: ["admin", "editor"],
  sitio: ["admin"], // institución, símbolos, contacto y aviso
  usuarios: ["admin"],
  actividad: ["admin"],
};

export function puede(usuario, accion) {
  return Boolean(usuario && PERMISOS[accion] && PERMISOS[accion].includes(usuario.rol));
}

export function permisosDe(rol) {
  return Object.keys(PERMISOS).filter((k) => PERMISOS[k].includes(rol));
}
