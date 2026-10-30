// Páginas con vista previa para WhatsApp y Facebook (/n/<noticia>, /p/<página>).
import { escapeHtml, readList, stores } from "./util.mjs";
import { getSite } from "./sitio.mjs";
import { NEWS_KEY, esPublica } from "./noticias.mjs";
import { PAGES_KEY } from "./paginas.mjs";

export async function paginaCompartir(url, tipo, id) {
  const site = await getSite();
  let item = null;
  let destino = "/";
  if (tipo === "n") {
    item = (await readList(stores.contenido(), NEWS_KEY)).find((x) => x.id === id && esPublica(x));
    destino = item ? `/#noticia-${encodeURIComponent(item.id)}` : "/#noticias";
  } else {
    item = (await readList(stores.contenido(), PAGES_KEY)).find((x) => x.slug === id && x.estado === "publicada");
    destino = item ? `/#pagina-${encodeURIComponent(item.slug)}` : "/";
  }
  const titulo = item ? item.titulo : site.identidad.nombre;
  const descripcion = (item && item.resumen) || site.identidad.presentacion;
  const imagen = url.origin + (item?.portada?.url || "/assets/img/og-image.jpg");
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${escapeHtml(titulo)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${escapeHtml(site.identidad.nombre)}">
<meta property="og:title" content="${escapeHtml(titulo)}">
<meta property="og:description" content="${escapeHtml(descripcion)}">
<meta property="og:image" content="${escapeHtml(imagen)}">
<meta property="og:url" content="${escapeHtml(url.href)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${escapeHtml(destino)}">
</head><body><p><a href="${escapeHtml(destino)}">Abrir en el sitio</a></p>
<script>location.replace(${JSON.stringify(destino)})</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}
