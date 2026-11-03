// Enrutador por hash: #/, #/auto, #/hipoteca, #/seguro, #/impuestos[/sub], #/fuentes
import { todos } from './datos.js';
import { esc } from './util.js';
import * as inicio from './vistas/inicio.js';
import * as auto from './vistas/auto.js';
import * as hipoteca from './vistas/hipoteca.js';
import * as seguro from './vistas/seguro.js';
import * as impuestos from './vistas/impuestos.js';
import * as fuentes from './vistas/fuentes.js';

const VISTAS = { '': inicio, auto, hipoteca, seguro, impuestos, fuentes };
const main = document.getElementById('main');
const nav = document.getElementById('nav');

nav.innerHTML = inicio.CALCULADORAS.map((c) => `<a href="#/${c.ruta}" data-ruta="${c.ruta}" data-tema="${c.tema}">${inicio.icono(c)}<span class="largo">${c.titulo}</span><span class="corto">${c.corto}</span></a>`).join('');

let ctx;
async function router() {
  const [ruta = '', sub] = location.hash.replace(/^#\/?/, '').split('/');
  const vista = VISTAS[ruta] ?? inicio;
  document.body.dataset.tema = ruta in VISTAS && ruta !== 'fuentes' ? ruta || 'inicio' : 'inicio';
  nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.ruta === ruta));
  try {
    ctx ??= await todos();
    vista.render(main, ctx, sub);
  } catch (e) {
    main.innerHTML = `<section class="card"><p class="aviso">No se pudieron cargar los datos oficiales: ${esc(e.message)}</p></section>`;
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

addEventListener('hashchange', router);
router();
