# Sitio web de la Institución Educativa El Guineo

Sitio oficial de la I.E. El Guineo (Canalete, Córdoba) con un gestor de contenido propio.

- **Sitio público:** inicio, institución (historia, misión, visión, filosofía, valores, perfil, proyectos), símbolos, noticias, documentos por carpetas, contacto y las páginas que se creen desde el panel.
- **Botón Entrar** en la cabecera del sitio: lleva al panel en `/admin`.
- **Gestor de contenido:** noticias con fotos, galería, tablas, colores, videos y adjuntos; páginas nuevas con cualquier texto; documentos organizados en carpetas; información institucional; aviso urgente; usuarios con tres tipos de permiso; registro de actividad.
- **Base de datos:** Netlify Blobs, incluida en Netlify. No hay que crear ni configurar nada.

## Acceso inicial

| Usuario | Contraseña | Tipo |
|---|---|---|
| `admin` | `12345admin` | Administrador principal (rector) |

Desde **Usuarios**, el administrador principal crea las cuentas de los coordinadores y docentes. Mientras alguien use la contraseña que le asignaron, el panel le recuerda cambiarla en **Mi cuenta y contraseña**.

## Tipos de usuario

| Acción | Administrador | Editor | Docente |
|---|---|---|---|
| Escribir noticias y subir documentos | Sí | Sí | Sí, quedan en revisión |
| Publicar y aprobar lo que envían los docentes | Sí | Sí | No |
| Editar o eliminar contenido de otros | Sí | Sí | No, solo lo suyo sin publicar |
| Crear páginas y organizar carpetas | Sí | Sí | No |
| Cambiar misión, visión, símbolos, contacto y aviso | Sí | No | No |
| Crear usuarios y ver la actividad | Sí | No | No |

- **Administrador:** el rector y los coordinadores.
- **Editor:** quien maneja las comunicaciones (por ejemplo, una docente de lenguaje o la secretaría).
- **Docente:** escribe noticias de sus clases y proyectos y sube documentos. Lo que envía aparece en **Para revisar**, en el resumen de editores y administradores.

La cuenta principal no se puede eliminar ni desactivar. Al cambiar el tipo de un usuario, desactivarlo o restablecer su contraseña, su sesión abierta se cierra.

---

## Cómo publicarlo en Netlify

> No uses la opción de arrastrar y soltar la carpeta (Netlify Drop): esa vía no prepara las funciones del panel y el sitio quedaría sin base de datos. Usa una de estas dos opciones.

### Opción A: con GitHub (recomendada, todo desde el navegador)

1. **Crea el repositorio.** Entra a [github.com](https://github.com), crea una cuenta si no tienes y pulsa **New repository**. Nómbralo `ie-el-guineo-web`, elige *Private* y pulsa **Create repository**.
2. **Sube los archivos.** En el repositorio vacío, pulsa **uploading an existing file**. Descomprime el ZIP, abre la carpeta `ie-el-guineo-web` y arrastra **todo su contenido** (las carpetas `public`, `netlify`, `scripts` y los archivos `netlify.toml`, `package.json`, `package-lock.json`, `README.md`). Espera a que carguen y pulsa **Commit changes**.
3. **Conecta Netlify.** Entra a [app.netlify.com](https://app.netlify.com) (puedes iniciar sesión con tu cuenta de GitHub). Pulsa **Add new project**, luego **Import an existing project**, elige **GitHub** y selecciona `ie-el-guineo-web`.
4. **Publica.** Netlify lee la configuración de `netlify.toml`, así que no cambies nada: pulsa **Deploy**. En uno o dos minutos el sitio queda en una dirección como `https://nombre-al-azar.netlify.app`.
5. **Pon un nombre fácil.** En **Project configuration**, **Change project name**, escribe por ejemplo `ieelguineo`. La dirección quedará `https://ieelguineo.netlify.app`.
6. **Entra** con el botón **Entrar** del sitio (o en `/admin`) con `admin` y `12345admin`, cambia la contraseña y crea los usuarios.

Cada vez que cambies un archivo en GitHub, Netlify vuelve a publicar solo. Las noticias, páginas, documentos y usuarios **no** se pierden al republicar: viven en Netlify Blobs, no en los archivos.

### Opción B: con la terminal (Netlify CLI)

Necesitas [Node.js](https://nodejs.org) 22 o superior.

```bash
npm install -g netlify-cli
netlify login
cd ie-el-guineo-web
npm install
netlify deploy --prod --site-name ieelguineo
```

La primera vez crea el proyecto en tu cuenta; las siguientes basta con `netlify deploy --prod`.

### Si la compilación falla en Netlify

1. **Revisa la estructura en GitHub.** La primera pantalla del repositorio debe mostrar directamente `netlify.toml`, `package.json` y las carpetas `public`, `netlify` y `scripts`. Si en cambio ves una sola carpeta llamada `ie-el-guineo-web`, tienes dos caminos: entrar a Netlify, **Project configuration**, **Build & deploy**, **Build settings** y escribir `ie-el-guineo-web` en **Base directory**, o volver a subir el contenido de la carpeta, no la carpeta.
2. **Revisa la configuración de compilación** en esa misma pantalla: **Build command** vacío o `npm run build`, **Publish directory** `public` y **Functions directory** `netlify/functions`. Si alguien puso `dist` o `build`, cámbialo.
3. **Vuelve a publicar sin caché:** **Deploys**, **Trigger deploy**, **Clear cache and deploy project**.
4. **Lee el registro.** En el registro de la compilación aparece la línea `I.E. El Guineo: revisando el proyecto…`. Si falta algo, debajo dice qué archivo falta y cómo arreglarlo.

---

## Uso diario del panel

| Quiero… | Dónde |
|---|---|
| Publicar una noticia, evento o comunicado | **Noticias**, **Nueva noticia** |
| Programar una noticia para otro día | En el editor, pon la fecha futura: se publica sola ese día |
| Crear una sección nueva (Matrículas, Horarios, PAE, Egresados…) | **Páginas**, **Nueva página**. Elige si aparece en el menú principal o en el pie |
| Subir el PEI, el manual de convivencia, circulares o formatos | **Documentos**, elige la carpeta y arrastra los archivos |
| Crear, renombrar o eliminar carpetas | **Documentos**, **Nueva carpeta** o los botones sobre cada carpeta |
| Aprobar lo que enviaron los docentes | **Resumen**, sección **Para revisar** |
| Cambiar misión, visión, valores, historia, rector | **Institución** |
| Agregar la bandera o el himno | **Símbolos** (aparecen en el sitio cuando tienen contenido) |
| Poner un aviso urgente en todas las páginas | **Contacto y aviso**, **Aviso destacado** |
| Crear cuentas o restablecer una contraseña | **Usuarios** |
| Ver quién publicó o cambió algo | **Actividad** |

El editor de texto permite títulos, negrita, cursiva, subrayado, tachado, colores, resaltado, listas, sangrías, alineación, citas, enlaces, imágenes, videos de YouTube y **tablas** (con filas y columnas que se agregan o quitan). También se puede pegar texto desde Word.

Las fotos se reducen automáticamente antes de subirlas. Los archivos grandes se envían por partes, hasta 18 MB cada uno.

Al compartir una noticia o una página con **WhatsApp** o **Copiar enlace**, la vista previa muestra el título, el resumen y la foto.

---

## Si olvidas la contraseña

- **Un coordinador o docente:** un administrador la restablece en **Usuarios**, **Editar**.
- **La cuenta principal:**
  1. En Netlify, abre el proyecto y entra a **Project configuration**, **Environment variables**.
  2. Crea la variable `RESTABLECER_ACCESO` con cualquier código, por ejemplo `nov2026`.
  3. Vuelve a publicar: **Deploys**, **Trigger deploy**, **Deploy project**.
  4. Entra con `admin` / `12345admin`. La contraseña olvidada se reemplaza y puedes crear una nueva en **Mi cuenta y contraseña**.

  Cada código sirve una sola vez. Si vuelves a olvidarla, cambia el valor de `RESTABLECER_ACCESO` por otro código y repite los pasos.

### Variables de entorno opcionales

| Variable | Para qué sirve |
|---|---|
| `ADMIN_USER` | Usuario de la cuenta principal, en lugar de `admin` (solo al crearla por primera vez) |
| `ADMIN_PASSWORD` | Contraseña inicial de la cuenta principal, en lugar de `12345admin` |
| `SESSION_SECRET` | Clave para firmar las sesiones. Si no la pones, se genera una al azar y se guarda en Blobs |
| `RESTABLECER_ACCESO` | Recupera la cuenta principal si olvidas la contraseña (ver arriba) |

---

## Dónde se guarda cada cosa

| Almacén de Netlify Blobs | Contenido |
|---|---|
| `guineo-contenido` | Textos institucionales (`sitio`), noticias (`noticias`), páginas (`paginas`), lista de archivos (`archivos`) y actividad (`actividad`) |
| `guineo-archivos` | Los archivos subidos, divididos en partes |
| `guineo-config` | Usuarios con sus contraseñas cifradas y la clave de sesiones |

En Netlify, **Data & Storage**, **Blobs** puedes revisar y descargar estos datos como copia de seguridad.

## Estructura del proyecto

```
public/                         Lo que ve el navegador
  index.html                    Sitio público
  admin.html                    Panel (gestor de contenido) en /admin
  assets/css/                   base.css (colores y tipografía), site.css (sitio), admin.css (panel)
  assets/js/api.js              Conexión con la base de datos (y modo de vista previa)
  assets/js/site.js             Sitio público
  assets/js/panel/              Panel, un archivo por sección:
    nucleo.js                   Estado, permisos, subidas, diálogos
    editor-texto.js             Editor de texto, tablas, portada, galería y adjuntos
    noticias.js  paginas.js  documentos.js  sitio.js  usuarios.js
    inicio.js                   Entrar, menú según el tipo de usuario, resumen y rutas
  assets/img/                   Escudo, íconos e imagen para compartir
  assets/vendor/                Editor Quill y limpiador de HTML DOMPurify
netlify/functions/api.mjs       Rutas de la API
netlify/lib/                    Lógica del servidor, un archivo por tema:
  usuarios.mjs  roles.mjs       Usuarios, contraseñas, sesiones y permisos
  noticias.mjs  paginas.mjs     Noticias (con revisión) y páginas
  archivos.mjs  sitio.mjs       Archivos por partes, carpetas e información institucional
  actividad.mjs compartir.mjs   Registro de actividad y vistas previas para WhatsApp
  defaults.mjs                  Contenido inicial tomado del PEI
  util.mjs                      Utilidades comunes
netlify.toml                    Configuración de Netlify
```

Para probarlo en tu computador: `npm install` y luego `npx netlify dev`, y abre `http://localhost:8888`.

Si cambias el contenido inicial en `netlify/lib/defaults.mjs`, ejecuta `npm run defaults` para actualizar la vista previa sin servidor.
