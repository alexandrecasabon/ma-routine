/* =========================================================
   Ma routine — logique
   Données locales à cet appareil. Aucun score d'un enfant
   n'est visible depuis le profil d'un autre.
   ========================================================= */

const CLE = 'ma-routine-v2';
const $  = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const id = () => Math.random().toString(36).slice(2, 9);

/* ---------------------------------------------------------
   1. Contenu par défaut
   niveau : 'guide'  = une tâche à la fois
            'apercu' = une tâche à la fois + la suite annoncée
            'liste'  = toutes les tâches, ordre libre
   --------------------------------------------------------- */
const E = (emoji, titre, duree = 0) => ({ id: id(), emoji, titre, duree });

/* Semaine d'école : réveil 6 h, départ 7 h, retour vers 18 h. */
const matin7 = () => [
  E('🛏️','Faire son lit'), E('👕',"S'habiller"), E('🥣','Déjeuner'),
  E('🍽️','Ranger sa vaisselle'), E('🪥','Brosser les dents', 120),
  E('🎒','Boîte à lunch et sac à dos'), E('🧥',"S'habiller pour dehors")
];
const soir7 = () => [
  E('🥪','Défaire sa boîte à lunch'), E('🍎','Préparer ses collations'),
  E('🍽️','Souper et ranger sa vaisselle'), E('📚','Faire ses devoirs', 600),
  E('🧸','Ranger sa chambre', 300), E('🪥','Brosser les dents', 120), E('😴','Se coucher')
];
const matin9 = () => [
  E('🛏️','Faire son lit'), E('👕',"S'habiller"), E('🥣','Déjeuner'),
  E('🍽️','Ranger sa vaisselle'), E('🪥','Brosser les dents', 120),
  E('🎒','Boîte à lunch et sac à dos'), E('🧥',"S'habiller pour dehors")
];
const soir9 = () => [
  E('🥪','Défaire sa boîte à lunch'), E('🍎','Préparer ses collations'),
  E('🍽️','Souper et ranger sa vaisselle'), E('📚','Faire ses devoirs', 1200),
  E('🧹','Ranger sa chambre', 300), E('🪥','Brosser les dents', 120), E('😴','Se coucher')
];
const matin12 = () => [
  E('🛏️','Lit fait'), E('👕',"S'habiller"), E('🥣','Déjeuner, vaisselle rangée'),
  E('🪥','Brosser les dents', 120), E('🎒','Boîte à lunch et sac à dos'),
  E('🧥',"Prêt pour l'extérieur")
];
const soir12 = () => [
  E('🥪','Défaire son lunch'), E('🍎','Collations du lendemain'),
  E('🍽️','Souper, vaisselle rangée'), E('📚','Devoirs et étude', 2700),
  E('🧺','Chambre rangée'), E('🪥','Brosser les dents', 120), E('😴','Au lit')
];

const nouvelEnfant = (prenom, emoji, couleur, niveau) =>
  ({ id: id(), prenom, emoji, couleur, niveau, serie: 0, record: 0, dernierJour: null });

function parDefaut(){
  const c = nouvelEnfant('Chloé',    '🦊', '#FF8A5B', 'guide');
  const h = nouvelEnfant('Charlotte','🦉', '#8E7CFF', 'guide');
  const e = nouvelEnfant('Elliot',   '🦌', '#1FB584', 'apercu');
  const d = nouvelEnfant('Édouard',  '🦅', '#3E7BC4', 'liste');
  const R = (enf, nom, moment, etapes) => ({ id: id(), enfantId: enf.id, nom, moment, etapes });
  return {
    enfants: [c, h, e, d],
    routines: [
      R(c,'Matin','matin',matin7()),  R(c,'Soir','soir',soir7()),
      R(h,'Matin','matin',matin7()),  R(h,'Soir','soir',soir7()),
      R(e,'Matin','matin',matin9()),  R(e,'Soir','soir',soir9()),
      R(d,'Matin','matin',matin12()), R(d,'Soir','soir',soir12())
    ],
    famille: { objectif: 40 },
    reglages: { heureReveil: '06:00', heureDepart: '06:50', pin: null },
    journal: [],         // { date, enfantId, routineId, moment }
    avancement: {}       // 'date|routineId' -> [etapeId] : tâches cochées du jour
  };
}

/* ---------------------------------------------------------
   2. État
   --------------------------------------------------------- */
let etat;
try { etat = JSON.parse(localStorage.getItem(CLE)) || parDefaut(); }
catch { etat = parDefaut(); }
if (!etat.famille) etat.famille = { objectif: 40 };
if (!etat.reglages) etat.reglages = { heureReveil: '06:00', heureDepart: '06:50', pin: null };
if (!etat.avancement) etat.avancement = {};

const sauver = () => localStorage.setItem(CLE, JSON.stringify(etat));

let session = null;
let ongletParent = null;

/* ---------------------------------------------------------
   3. Dates : série personnelle et semaine familiale
   --------------------------------------------------------- */
const jourISO = (d = new Date()) => {
  const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
function veille(){ const d = new Date(); d.setDate(d.getDate() - 1); return jourISO(d); }

// L'avancement ne sert qu'à la journée en cours : on purge les autres jours
Object.keys(etat.avancement).forEach(k => { if (!k.startsWith(jourISO())) delete etat.avancement[k]; });

/* Tâches cochées aujourd'hui pour une routine, persistées pour
   pouvoir reprendre une routine interrompue et corriger une erreur. */
const cleAvancement = r => `${jourISO()}|${r.id}`;
const avancementDuJour = r => new Set(etat.avancement[cleAvancement(r)] || []);
function sauverAvancement(r, faites){
  etat.avancement[cleAvancement(r)] = [...faites];
  sauver();
}

function estLendemain(a, b){
  const d = new Date(a + 'T12:00:00'); d.setDate(d.getDate() + 1);
  return jourISO(d) === b;
}

// Recalcule série, record et dernier jour depuis le journal (après une correction)
function recalculerSerie(enf){
  const jours = [...new Set(etat.journal.filter(x => x.enfantId === enf.id).map(x => x.date))].sort();
  let serie = 0, record = 0, prec = null;
  jours.forEach(j => {
    serie = (prec && estLendemain(prec, j)) ? serie + 1 : 1;
    if (serie > record) record = serie;
    prec = j;
  });
  enf.serie = serie; enf.record = record;
  enf.dernierJour = jours.length ? jours[jours.length - 1] : null;
}

// Semaine ISO : la jauge familiale se remet à zéro le lundi
function cleSemaine(dateStr = jourISO()){
  const d = new Date(dateStr + 'T12:00:00');
  const j = (d.getDay() + 6) % 7;                   // lundi = 0
  d.setDate(d.getDate() - j + 3);                   // jeudi de cette semaine
  const premierJeudi = new Date(d.getFullYear(), 0, 4);
  const n = 1 + Math.round(((d - premierJeudi) / 86400000 - 3 + ((premierJeudi.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-S${String(n).padStart(2, '0')}`;
}

const routinesDeLaSemaine = () =>
  etat.journal.filter(x => cleSemaine(x.date) === cleSemaine()).length;

function majSerie(enf){
  const auj = jourISO();
  if (enf.dernierJour === auj) return;               // déjà compté aujourd'hui
  enf.serie = (enf.dernierJour === veille()) ? enf.serie + 1 : 1;
  enf.dernierJour = auj;
  if (enf.serie > enf.record) enf.record = enf.serie;
}

// La série tombe si le dernier jour actif n'est ni aujourd'hui ni hier
function serieCourante(enf){
  if (!enf.dernierJour) return 0;
  return (enf.dernierJour === jourISO() || enf.dernierJour === veille()) ? enf.serie : 0;
}

/* ---------------------------------------------------------
   4. Le ciel
   --------------------------------------------------------- */
const CIELS = {
  matin: { debut:['#F9A26C','#FFD9A0'], fin:['#7FC9E8','#D6EEF9'] },
  soir:  { debut:['#6E8BC4','#FFC08A'], fin:['#1B2050','#3E4478'] }
};

/* L'astre : rayons tournants le matin, croissant et étoiles le soir */
const SVGNS = 'http://www.w3.org/2000/svg';

(function construireRayons(){
  const g = $('#rayons');
  for (let i = 0; i < 12; i++){
    const a = i * Math.PI / 6;
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('x1', (Math.cos(a) * 28).toFixed(1)); l.setAttribute('y1', (Math.sin(a) * 28).toFixed(1));
    l.setAttribute('x2', (Math.cos(a) * 37).toFixed(1)); l.setAttribute('y2', (Math.sin(a) * 37).toFixed(1));
    g.appendChild(l);
  }
})();

(function construireEtoiles(){
  const g = $('#etoiles');
  const points = [[60,32],[140,84],[215,20],[330,62],[425,16],[505,74],[585,28],[665,88],
                  [735,18],[815,58],[885,92],[945,36],[262,112],[702,124],[382,104],[118,132]];
  points.forEach(([x, y], i) => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y);
    c.setAttribute('r', i % 3 === 0 ? 2.2 : 1.4);
    c.setAttribute('class', 'etoile');
    c.style.animationDelay = `${(i * 0.43) % 3}s`;
    g.appendChild(c);
  });
})();
const hex2rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
const melange = (a,b,t) => rgb2hex(hex2rgb(a).map((v,i) => v + (hex2rgb(b)[i] - v) * t));

function pointArc(t){
  const u = 1 - t;
  return { x: u*u*60 + 2*u*t*500 + t*t*940, y: u*u*178 + 2*u*t*(-70) + t*t*178 };
}

function peindreCiel(progres, moment = 'matin'){
  const c = CIELS[moment];
  const haut = melange(c.debut[0], c.fin[0], progres);
  const bas  = melange(c.debut[1], c.fin[1], progres);
  document.body.style.setProperty('--ciel-haut', haut);
  document.body.style.setProperty('--ciel-bas',  bas);

  const [r,g,b] = hex2rgb(melange(haut, bas, .5));
  const clair = (0.299*r + 0.587*g + 0.114*b) > 150;
  document.body.style.setProperty('--sur-ciel', clair ? '#182747' : '#FFFCF5');
  document.body.style.setProperty('--sur-ciel-fond', clair ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.15)');

  const p = pointArc(progres);
  $('#astre').setAttribute('transform', `translate(${p.x}, ${p.y})`);

  // Soleil rayonnant le matin ; croissant de lune et étoiles le soir
  const soir = moment === 'soir';
  $('#disque').setAttribute('fill', soir ? 'url(#grad-lune)' : 'url(#grad-soleil)');
  if (soir) $('#disque').setAttribute('mask', 'url(#masque-lune)');
  else $('#disque').removeAttribute('mask');
  $('#rayons').setAttribute('opacity', soir ? '0' : '1');
  // Le halo de lune s'intensifie à mesure que la nuit avance
  $('#halo').setAttribute('r', soir ? 46 : 52);
  $('#halo').setAttribute('opacity', soir ? String(.4 + .5 * progres) : '1');
  $('#etoiles').style.opacity = soir ? String(progres) : '0';
  $('#nuages').style.opacity = soir ? '0' : '.26';
}

function poserJalons(nb, faits = 0){
  const g = $('#jalons'); g.innerHTML = '';
  for (let i = 1; i <= nb; i++){
    const p = pointArc(i / nb);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', i <= faits ? 8 : 5);
    c.setAttribute('fill', i <= faits ? '#FFFCF5' : 'rgba(255,255,255,.32)');
    g.appendChild(c);
  }
}

const momentDuJour = () => (new Date().getHours() >= 15) ? 'soir' : 'matin';

/* ---------------------------------------------------------
   4b. Matin d'école : le soleil suit l'heure réelle entre le
   réveil et le départ, avec compte à rebours. Lundi à vendredi.
   --------------------------------------------------------- */
const jourEcole = () => { const j = new Date().getDay(); return j >= 1 && j <= 5; };
const minutesDe = h => { const [a, b] = String(h).split(':').map(Number); return a * 60 + b; };

function fenetreMatin(){
  const m = new Date();
  return {
    mnt:   m.getHours() * 60 + m.getMinutes() + m.getSeconds() / 60,
    debut: minutesDe(etat.reglages.heureReveil),
    fin:   minutesDe(etat.reglages.heureDepart)
  };
}

// Position du soleil selon l'heure, de l'heure de réveil à l'heure de départ
function progresMatin(){
  const { mnt, debut, fin } = fenetreMatin();
  return Math.min(1, Math.max(0, (mnt - debut) / Math.max(1, fin - debut)));
}

// Le compte à rebours vit du réveil jusqu'à 30 minutes après le départ
function matinEcole(){
  const { mnt, fin } = fenetreMatin();
  return jourEcole() && momentDuJour() === 'matin' && mnt < fin + 30;
}

// Peinture du ciel hors routine : heure réelle les matins d'école, sinon repos
function peindreCielAccueil(){
  if (matinEcole()) peindreCiel(progresMatin(), 'matin');
  else peindreCiel(0, momentDuJour());
}

let departAnnonce = false;
function majDepart(){
  // L'heure, toujours visible — le premier repère de temps des enfants
  $('#horloge').textContent = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  const zone = $('#depart');
  if (!matinEcole()){ zone.hidden = true; departAnnonce = false; return; }

  const { mnt, fin } = fenetreMatin();
  const reste = Math.round((fin - mnt) * 60);
  zone.hidden = false;
  zone.classList.remove('depart--bientot', 'depart--urgent', 'depart--maintenant');
  if (reste > 0){
    zone.textContent = `École dans ${mmss(reste)}`;
    if (reste <= 300)      zone.classList.add('depart--urgent');    // 5 dernières minutes
    else if (reste <= 900) zone.classList.add('depart--bientot');   // le quart d'heure final
    departAnnonce = false;
  } else {
    zone.classList.add('depart--maintenant');
    zone.textContent = 'DÉPART ÉCOLE';
    if (!departAnnonce){ departAnnonce = true; bip(); annoncer("Départ pour l'école !"); }
  }

  // Le soleil suit l'heure sauf pendant une routine du soir,
  // et son halo grossit à mesure que le départ approche
  if (!session || !session.routine || session.routine.moment === 'matin'){
    peindreCiel(progresMatin(), 'matin');
    $('#halo').setAttribute('r', reste <= 0 || reste > 900 ? 52 : reste <= 300 ? 66 : 58);
  }
}
setInterval(majDepart, 1000);

/* ---------------------------------------------------------
   5. Navigation
   --------------------------------------------------------- */
function aller(idEcran){
  $$('.ecran').forEach(e => e.classList.remove('ecran--actif'));
  $('#' + idEcran).classList.add('ecran--actif');
  if (idEcran === 'ecran-enfants'){
    if (!chronos.size) libererEcran();   // un chrono en cours garde l'écran allumé
    session = null;
    $('#jalons').innerHTML = '';
    peindreCielAccueil();
    rendreJaugeFamille();
  }
  armerInactivite();
}
/* Profil laissé ouvert : retour à l'écran de sélection après 30 s sans toucher.
   Jamais pendant l'exécution d'une routine — l'enfant travaille loin de l'iPad. */
let chronoInactivite = null;
function armerInactivite(){
  clearTimeout(chronoInactivite);
  const actif = $('.ecran--actif');
  if (!actif || (actif.id !== 'ecran-routines' && actif.id !== 'ecran-fin')) return;
  chronoInactivite = setTimeout(() => aller('ecran-enfants'), 30000);
}
document.addEventListener('pointerdown', armerInactivite);

document.addEventListener('click', e => {
  const c = e.target.closest('[data-vers]');
  if (!c) return;
  // Retour à l'écran des routines : repasser par ouvrirRoutines pour rafraîchir
  // les cartes et le cumulatif du jour
  if (c.dataset.vers === 'ecran-routines' && session && session.enfant) ouvrirRoutines(session.enfant);
  else aller(c.dataset.vers);
});

/* ---------------------------------------------------------
   6. Écran des profils — aucun score visible ici
   --------------------------------------------------------- */
function rendreEnfants(){
  const zone = $('#liste-enfants'); zone.innerHTML = '';
  etat.enfants.forEach(enf => {
    const b = document.createElement('button');
    b.className = 'carte';
    b.style.setProperty('--accent', enf.couleur);
    b.innerHTML = `<div class="carte__avatar" style="background:${enf.couleur}29">${enf.emoji}</div>
                   <div class="carte__nom">${echapper(enf.prenom)}</div>`;
    b.onclick = () => ouvrirRoutines(enf);
    zone.appendChild(b);
  });
}

function rendreJaugeFamille(){
  const fait = routinesDeLaSemaine();
  const but  = Math.max(1, etat.famille.objectif);
  const reste = but - fait;
  $('#famille-compte').textContent = `${fait} / ${but}`;
  $('#famille-barre').style.width = `${Math.min(100, fait / but * 100)}%`;
  $('#famille-note').textContent = reste <= 0
    ? 'Objectif atteint. Bravo à toute la famille.'
    : `Encore ${reste} routine${reste > 1 ? 's' : ''} d'ici dimanche.`;
}

function ouvrirRoutines(enf){
  session = { enfant: enf };
  $('#titre-routines').textContent = `Bonjour ${enf.prenom}`;
  const s = serieCourante(enf);
  $('#serie-perso').textContent = s > 0
    ? `Ta série : ${s} jour${s > 1 ? 's' : ''} d'affilée · ton record : ${enf.record}`
    : 'Nouvelle série à démarrer aujourd\u2019hui.';

  const ICONE_SOLEIL = '<svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="13" fill="#FFC93C"/><g stroke="#FFC93C" stroke-width="4" stroke-linecap="round"><line x1="26" y1="3" x2="26" y2="9"/><line x1="26" y1="43" x2="26" y2="49"/><line x1="3" y1="26" x2="9" y2="26"/><line x1="43" y1="26" x2="49" y2="26"/><line x1="10" y1="10" x2="14" y2="14"/><line x1="38" y1="38" x2="42" y2="42"/><line x1="38" y1="14" x2="42" y2="10"/><line x1="10" y1="42" x2="14" y2="38"/></g></svg>';
  const ICONE_LUNE   = '<svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="16" fill="#8FA6D9"/><circle cx="33" cy="20" r="13" fill="#FFFCF5"/></svg>';

  const zone = $('#liste-routines'); zone.innerHTML = '';
  etat.routines.filter(r => r.enfantId === enf.id).forEach(r => {
    const faite = etat.journal.some(x => x.date === jourISO() && x.routineId === r.id);
    const enCours = avancementDuJour(r).size;
    const note = faite ? 'Déjà faite aujourd\u2019hui'
      : enCours > 0 ? `${enCours} tâche${enCours > 1 ? 's' : ''} sur ${r.etapes.length} déjà faite${enCours > 1 ? 's' : ''}`
      : `${r.etapes.length} tâches`;
    const b = document.createElement('button');
    b.className = 'carte';
    b.style.setProperty('--accent', enf.couleur);
    b.innerHTML = `<div class="carte__icone">${r.moment === 'soir' ? ICONE_LUNE : ICONE_SOLEIL}</div>
                   <div class="carte__nom">${echapper(r.nom)}</div>
                   <div class="carte__note">${note}</div>`;
    b.onclick = () => demarrer(enf, r);
    zone.appendChild(b);
  });
  rendreTachesJour(enf);
  peindreCielAccueil();
  aller('ecran-routines');
}

/* ----- 6b. Cumulatif du jour : l'enfant peut retirer une tâche cochée par erreur ----- */
function rendreTachesJour(enf){
  const zone = $('#taches-jour'); zone.innerHTML = '';
  let indicePose = false;
  etat.routines.filter(r => r.enfantId === enf.id).forEach(r => {
    const faites = avancementDuJour(r);
    if (!faites.size) return;
    const bloc = document.createElement('div');
    bloc.className = 'jour__bloc';
    bloc.innerHTML = `<h3 class="jour__titre">${r.moment === 'soir' ? '🌙' : '☀️'} ${echapper(r.nom)} — aujourd’hui</h3>`;
    r.etapes.forEach(et => {
      const faite = faites.has(et.id);
      const b = document.createElement('button');
      b.className = 'jour__tache' + (faite ? ' jour__tache--faite' : '');
      b.innerHTML = `<span class="jour__case">${faite ? '✓' : ''}</span>
                     <span>${et.emoji} ${echapper(et.titre)}</span>`;
      if (faite) b.onclick = () => decocher(enf, r, et);
      else b.disabled = true;
      bloc.appendChild(b);
    });
    zone.appendChild(bloc);
    if (!indicePose){
      indicePose = true;
      const indice = document.createElement('p');
      indice.className = 'jour__note';
      indice.textContent = 'Touche une tâche cochée par erreur pour la retirer.';
      bloc.appendChild(indice);
    }
  });
}

function decocher(enf, routine, etape){
  if (!confirm(`${etape.titre} : pas encore fait ?`)) return;
  const faites = avancementDuJour(routine);
  faites.delete(etape.id);
  sauverAvancement(routine, faites);

  // Si la routine était comptée au journal, elle ne l'est plus : tout est recalculé
  const idx = etat.journal.findIndex(x => x.date === jourISO() && x.routineId === routine.id);
  if (idx >= 0){
    etat.journal.splice(idx, 1);
    recalculerSerie(enf);
    sauver();
  }
  ouvrirRoutines(enf);
}

/* ---------------------------------------------------------
   7. Démarrage d'une routine
   --------------------------------------------------------- */
function demarrer(enf, routine){
  if (!routine.etapes.length) return;
  // Reprend l'avancement du jour : une routine interrompue ou corrigée continue où elle en était
  const faites = avancementDuJour(routine);
  const premier = routine.etapes.findIndex(e => !faites.has(e.id));
  session = { enfant: enf, routine, index: premier < 0 ? routine.etapes.length : premier, faites };
  garderEcranAllume();

  if (enf.niveau === 'liste'){ avancerCiel(); aller('ecran-liste'); rendreListe(); }
  else if (session.index >= routine.etapes.length){ terminer(); }
  else {
    protegerSortie(enf.niveau === 'guide');
    avancerCiel(); aller('ecran-etape'); montrerEtape();
  }
}

/* ----- Sortie accidentelle : chez les 7 ans, « Arrêter » demande
   un appui maintenu de 1,5 s. Le bouton se remplit pendant l'appui. ----- */
const arretEtape = $('#arret-etape');
let chronoArret = null;

function protegerSortie(actif){
  arretEtape.classList.toggle('retour--verrou', actif);
  if (actif) arretEtape.removeAttribute('data-vers');   // le tap simple ne navigue plus
  else arretEtape.setAttribute('data-vers', 'ecran-routines');
}

arretEtape.addEventListener('pointerdown', () => {
  if (!arretEtape.classList.contains('retour--verrou')) return;
  arretEtape.classList.add('retour--appui');
  chronoArret = setTimeout(() => {
    chronoArret = null;
    arretEtape.classList.remove('retour--appui');
    if (session && session.enfant) ouvrirRoutines(session.enfant);
  }, 1500);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  arretEtape.addEventListener(ev, () => {
    if (!arretEtape.classList.contains('retour--verrou')) return;
    arretEtape.classList.remove('retour--appui');
    if (chronoArret){                                    // relâché trop tôt : indice
      clearTimeout(chronoArret); chronoArret = null;
      if (ev === 'pointerup'){
        arretEtape.classList.add('retour--rate');
        const indice = $('#indice-arret');
        indice.hidden = false;
        clearTimeout(indice._chrono);
        indice._chrono = setTimeout(() => { indice.hidden = true; }, 2500);
        setTimeout(() => arretEtape.classList.remove('retour--rate'), 450);
      }
    }
  }));

const progression = () => session.faites.size / session.routine.etapes.length;

function avancerCiel(){
  if (session.routine.moment === 'matin' && matinEcole()) peindreCiel(progresMatin(), 'matin');
  else peindreCiel(progression(), session.routine.moment);
  poserJalons(session.routine.etapes.length, session.faites.size);
}

/* ----- 7a. Vue guidée ----- */
function montrerEtape(){
  const { routine, index, enfant: enf } = session;
  const etape = routine.etapes[index];

  $('#etape-emoji').textContent = etape.emoji;
  $('#etape-titre').textContent = etape.titre;
  $('#etape-rang').textContent  = `Tâche ${index + 1} sur ${routine.etapes.length}`;
  $('.carte-etape').style.setProperty('--accent', enf.couleur);

  const suivante = routine.etapes[index + 1];
  $('#apercu-suite').textContent =
    (enf.niveau === 'apercu' && suivante) ? `Ensuite : ${suivante.emoji}  ${suivante.titre}` : '';

  avancerCiel();
  const btn = $('#etape-demarrer');
  const chrono = chronos.get(etape.id);
  $('#etape-chrono').classList.remove('etape-chrono--pause');
  $('#jauge').classList.remove('anneau__jauge--prep');
  $('#indice-pause').hidden = true;
  if (chrono){
    btn.hidden = true; btn.onclick = null;
    majAffichageChronos();                    // un chrono tournait déjà : on le raccroche
  } else if (etape.duree > 0){
    // Le chrono ne part pas tout seul : l'enfant appuie quand il est prêt
    $('#etape-chrono').textContent = mmss(etape.duree);
    regler(0);
    btn.hidden = false;
    btn.onclick = () => { btn.hidden = true; demarrerChrono(etape); };
  } else {
    $('#etape-chrono').textContent = ''; regler(1);
    btn.hidden = true; btn.onclick = null;
  }
}

const PREPARATION = 30;

function messagesPour(etape){
  return /dent/i.test(etape.titre)
    ? { debut: 'Débute le brossage !', fin: 'Super, tes dents sont brossées !' }
    : { debut: "C'est parti !", fin: "Bravo, c'est fait !" };
}

function annoncer(texte){
  try {
    if (!('speechSynthesis' in window)) throw new Error('muet');
    const u = new SpeechSynthesisUtterance(texte);
    u.lang = 'fr-CA'; u.rate = .95;
    const voix = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith('fr'));
    if (voix) u.voice = voix;
    speechSynthesis.speak(u);
  } catch { bip(); }
}

const CIRC = 553;                                     // 2π × 88
const regler = f => { $('#jauge').style.strokeDashoffset = CIRC * (1 - f); };
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/* ---------------------------------------------------------
   7c. Chronos — basés sur l'horloge et détachés de l'écran :
   un minuteur continue pendant qu'un autre enfant navigue
   dans son portail, et plusieurs peuvent tourner à la fois.
   Cycle : 30 s de préparation → annonce → tâche → annonce.
   --------------------------------------------------------- */
const chronos = new Map();           // etapeId -> { phase, finA, duree, reste, enPause, etape }
let pastillesParEtape = new Map();   // vue liste : etapeId -> { pastille, etape }

const resteDe = c => c.enPause ? c.reste : Math.max(0, Math.ceil((c.finA - Date.now()) / 1000));

function demarrerChrono(etape){
  debloquerAudio();                  // geste utilisateur : le moment de déverrouiller le son iOS
  chronos.set(etape.id, { phase: 'prep', finA: Date.now() + PREPARATION * 1000,
                          duree: PREPARATION, reste: 0, enPause: false, etape });
  garderEcranAllume();
  majAffichageChronos();
}

// Toucher le chrono met en pause ; un autre toucher repart
function basculerPause(id){
  const c = chronos.get(id); if (!c) return;
  if (c.enPause){ c.finA = Date.now() + c.reste * 1000; c.enPause = false; }
  else { c.reste = resteDe(c); c.enPause = true; }
  majAffichageChronos();
}

setInterval(() => {
  chronos.forEach((c, id) => {
    if (c.enPause || resteDe(c) > 0) return;
    if (c.phase === 'prep'){
      c.phase = 'tache'; c.duree = Math.max(1, c.etape.duree);
      c.finA = Date.now() + c.duree * 1000;
      annoncer(messagesPour(c.etape).debut);
    } else {
      chronos.delete(id);
      bip(); annoncer(messagesPour(c.etape).fin);
    }
  });
  majAffichageChronos();
}, 250);

function majAffichageChronos(){
  // Vue guidée : le chrono de la tâche affichée
  if (session && session.routine && $('#ecran-etape').classList.contains('ecran--actif')){
    const etape = session.routine.etapes[session.index];
    const c = etape && chronos.get(etape.id);
    if (c){
      const reste = resteDe(c);
      $('#etape-chrono').textContent = (c.enPause ? '⏸ ' : '') + mmss(reste);
      $('#etape-chrono').classList.toggle('etape-chrono--pause', c.enPause);
      $('#jauge').classList.toggle('anneau__jauge--prep', c.phase === 'prep');
      $('#etape-rang').textContent = c.phase === 'prep'
        ? 'Prépare-toi…'
        : `Tâche ${session.index + 1} sur ${session.routine.etapes.length}`;
      regler(1 - reste / Math.max(1, c.duree));
      $('#etape-demarrer').hidden = true;
      $('#indice-pause').hidden = false;
    } else {
      $('#indice-pause').hidden = true;
    }
  }
  // Vue liste : chaque pastille reflète l'état de son chrono
  pastillesParEtape.forEach(({ pastille, etape }, id) => {
    if (!pastille.isConnected) return;
    const c = chronos.get(id);
    if (!c){
      pastille.textContent = mmss(etape.duree);
      pastille.classList.remove('tache__duree--actif');
      return;
    }
    const reste = resteDe(c);
    pastille.textContent = (c.enPause ? '⏸ ' : c.phase === 'prep' ? '⏳ ' : '') + mmss(reste);
    pastille.classList.add('tache__duree--actif');
  });
}

$('#etape-chrono').onclick = () => {
  if (!session || !session.routine) return;
  const etape = session.routine.etapes[session.index];
  if (etape) basculerPause(etape.id);
};

$('#bouton-fait').onclick = () => {
  if (!session || !session.routine) return;
  chronos.delete(session.routine.etapes[session.index].id);
  session.faites.add(session.routine.etapes[session.index].id);
  sauverAvancement(session.routine, session.faites);
  // Saute les tâches déjà cochées (reprise après correction)
  while (session.index < session.routine.etapes.length &&
         session.faites.has(session.routine.etapes[session.index].id)) session.index++;
  if (session.index < session.routine.etapes.length) montrerEtape();
  else { avancerCiel(); terminer(); }
};

/* ----- 7b. Vue liste, ordre libre ----- */
function rendreListe(){
  const { routine, enfant: enf } = session;
  $('#liste-titre').textContent = `${routine.nom} — ${enf.prenom}`;
  $('.panneau-liste').style.setProperty('--accent', enf.couleur);
  majSousTitreListe();

  const ul = $('#taches'); ul.innerHTML = '';
  pastillesParEtape = new Map();
  routine.etapes.forEach(et => {
    const li = document.createElement('li');
    li.className = 'tache' + (session.faites.has(et.id) ? ' tache--faite' : '');
    li.innerHTML = `<div class="tache__case">✓</div>
                    <div class="tache__nom">${echapper(et.titre)}</div>` +
      (et.duree ? `<button class="tache__duree">${mmss(et.duree)}</button>` : '');

    const bascule = () => basculer(et, li);
    li.querySelector('.tache__nom').onclick = bascule;
    li.querySelector('.tache__case').onclick = bascule;
    const pastille = li.querySelector('.tache__duree');
    if (pastille){
      pastillesParEtape.set(et.id, { pastille, etape: et });
      pastille.onclick = ev => {
        ev.stopPropagation();
        if (chronos.has(et.id)) basculerPause(et.id);
        else demarrerChrono(et);
      };
    }
    ul.appendChild(li);
  });
  majAffichageChronos();
}

function majSousTitreListe(){
  const n = session.routine.etapes.length;
  $('#liste-sous').textContent = `${session.faites.size} / ${n} · dans l'ordre que tu veux`;
}

function basculer(etape, li){
  if (session.faites.has(etape.id)) session.faites.delete(etape.id);
  else { session.faites.add(etape.id); chronos.delete(etape.id); }
  sauverAvancement(session.routine, session.faites);
  li.classList.toggle('tache--faite', session.faites.has(etape.id));
  majSousTitreListe();
  avancerCiel();
  if (session.faites.size === session.routine.etapes.length) setTimeout(terminer, 450);
}

/* ---------------------------------------------------------
   8. Fin de routine
   --------------------------------------------------------- */
function terminer(){
  if (!session || !session.routine) return;
  const { enfant: enf, routine } = session;
  routine.etapes.forEach(e => chronos.delete(e.id));

  const dejaFaite = etat.journal.some(x => x.date === jourISO() && x.routineId === routine.id);
  if (!dejaFaite){
    etat.journal.push({ date: jourISO(), enfantId: enf.id, routineId: routine.id, moment: routine.moment });
    majSerie(enf);
  }
  sauver();

  if (routine.moment === 'matin' && matinEcole()) peindreCiel(progresMatin(), 'matin');
  else peindreCiel(1, routine.moment);
  poserJalons(routine.etapes.length, routine.etapes.length);

  const s = serieCourante(enf);
  $('#titre-fin').textContent = `${routine.nom} terminé`;
  $('#sous-titre-fin').textContent = `${routine.etapes.length} tâches faites, ${enf.prenom}.`;
  $('#record-fin').textContent = (s >= enf.record && s > 1)
    ? `${s} jours d'affilée — c'est ton meilleur résultat.`
    : `Série en cours : ${s} jour${s > 1 ? 's' : ''} · record : ${enf.record}`;

  libererEcran();
  aller('ecran-fin');
}

/* iOS n'autorise le son qu'après un geste : on déverrouille l'AudioContext
   et la synthèse vocale au premier toucher, puis on les réutilise. */
let ctxAudio = null;
function debloquerAudio(){
  try {
    if (!ctxAudio) ctxAudio = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxAudio.state === 'suspended') ctxAudio.resume();
    if (!debloquerAudio.parole && 'speechSynthesis' in window){
      debloquerAudio.parole = true;
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch {}
}
document.addEventListener('pointerdown', debloquerAudio, true);

function bip(){
  try{
    debloquerAudio();
    const ctx = ctxAudio;
    [0, .18].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i ? 880 : 660;
      g.gain.setValueAtTime(.001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(.22, ctx.currentTime + d + .02);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .4);
    });
  } catch {}
}

let verrouEcran = null;
async function garderEcranAllume(){ try { verrouEcran = await navigator.wakeLock.request('screen'); } catch {} }
function libererEcran(){ try { if (verrouEcran){ verrouEcran.release(); verrouEcran = null; } } catch {} }

/* ---------------------------------------------------------
   9. Réglages — appui long de 1,5 s, puis code parent
   --------------------------------------------------------- */
let chronoAppui;
const cleParent = $('#cle-parent');
cleParent.addEventListener('pointerdown', () => {
  chronoAppui = setTimeout(demanderPin, 1500);
});
['pointerup','pointerleave','pointercancel'].forEach(ev =>
  cleParent.addEventListener(ev, () => clearTimeout(chronoAppui)));

/* ----- 9a. Code parent : barrière d'accès, pas un coffre-fort ----- */
let pinSaisie = '', pinTampon = '', pinMode = 'verifier';

function demanderPin(){
  if (etat.reglages.pin){ pinMode = 'verifier'; $('#pin-titre').textContent = 'Code parent'; }
  else { pinMode = 'definir'; $('#pin-titre').textContent = 'Choisis un code à 4 chiffres'; }
  ouvrirPave();
}

function ouvrirPave(){
  pinSaisie = '';
  const grille = $('#pin-grille');
  if (!grille.childElementCount){
    ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(t => {
      const b = document.createElement('button');
      b.className = 'pave__touche'; b.textContent = t;
      if (t === '') b.disabled = true;
      else b.onclick = () => toucherPin(t);
      grille.appendChild(b);
    });
  }
  majPointsPin();
  $('#voile-pin').hidden = false;
}

function toucherPin(t){
  if (t === '⌫'){ pinSaisie = pinSaisie.slice(0, -1); majPointsPin(); return; }
  if (pinSaisie.length >= 4) return;
  pinSaisie += t; majPointsPin();
  if (pinSaisie.length < 4) return;

  if (pinMode === 'verifier'){
    if (pinSaisie === etat.reglages.pin) reussirPin();
    else refuserPin();
  } else if (pinMode === 'definir'){
    pinTampon = pinSaisie; pinSaisie = ''; pinMode = 'confirmer';
    $('#pin-titre').textContent = 'Refais le même code';
    majPointsPin();
  } else {
    if (pinSaisie === pinTampon){ etat.reglages.pin = pinSaisie; sauver(); reussirPin(); }
    else {
      pinMode = 'definir';
      $('#pin-titre').textContent = 'Différent. Choisis un code à 4 chiffres';
      refuserPin();
    }
  }
}

function majPointsPin(){
  $('#pin-points').innerHTML = [0,1,2,3].map(i =>
    `<span class="pave__point${i < pinSaisie.length ? ' pave__point--plein' : ''}"></span>`).join('');
}

function reussirPin(){
  $('#voile-pin').hidden = true;
  rendreReglages(); aller('ecran-parent');
}

function refuserPin(){
  pinSaisie = '';
  const p = $('#pin-points');
  p.classList.add('pave__points--erreur');
  setTimeout(() => { p.classList.remove('pave__points--erreur'); majPointsPin(); }, 450);
}

$('#pin-annuler').onclick = () => { $('#voile-pin').hidden = true; };

const NIVEAUX = [['guide','Guidé'], ['apercu','Guidé + aperçu'], ['liste','Liste libre']];

function rendreReglages(){
  const ze = $('#reglages-enfants'); ze.innerHTML = '';
  etat.enfants.forEach(enf => {
    const l = document.createElement('div');
    l.className = 'ligne';
    l.innerHTML = `
      <input class="champ-emoji" type="text" value="${enf.emoji}" maxlength="4">
      <input class="champ-nom" type="text" value="${echapper(enf.prenom)}">
      <select>${NIVEAUX.map(([v,t]) =>
        `<option value="${v}"${enf.niveau === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <input type="color" value="${enf.couleur}">
      <button class="btn-suppr">Supprimer</button>`;
    const emo  = l.querySelector('.champ-emoji');
    const nom  = l.querySelector('.champ-nom');
    const niv  = l.querySelector('select');
    const coul = l.querySelector('input[type=color]');
    emo.oninput  = () => { enf.emoji   = emo.value;  sauver(); rendreEnfants(); };
    nom.oninput  = () => { enf.prenom  = nom.value;  sauver(); rendreEnfants(); rendreOnglets(); };
    niv.onchange = () => { enf.niveau  = niv.value;  sauver(); };
    coul.oninput = () => { enf.couleur = coul.value; sauver(); rendreEnfants(); };
    l.querySelector('.btn-suppr').onclick = () => {
      if (!confirm(`Supprimer ${enf.prenom} et ses routines ?`)) return;
      etat.enfants  = etat.enfants.filter(x => x.id !== enf.id);
      etat.routines = etat.routines.filter(r => r.enfantId !== enf.id);
      if (ongletParent === enf.id) ongletParent = null;
      sauver(); rendreReglages(); rendreEnfants();
    };
    ze.appendChild(l);
  });

  const obj = $('#objectif-famille');
  obj.value = etat.famille.objectif;
  obj.oninput = () => { etat.famille.objectif = Math.max(1, +obj.value || 1); sauver(); rendreJaugeFamille(); };

  const hr = $('#heure-reveil'), hd = $('#heure-depart');
  hr.value = etat.reglages.heureReveil;
  hd.value = etat.reglages.heureDepart;
  hr.onchange = () => { etat.reglages.heureReveil = hr.value || '06:00'; sauver(); majDepart(); };
  hd.onchange = () => { etat.reglages.heureDepart = hd.value || '06:50'; sauver(); majDepart(); };

  $('#changer-pin').onclick = () => {
    pinMode = 'definir';
    $('#pin-titre').textContent = 'Nouveau code à 4 chiffres';
    ouvrirPave();
  };

  rendreOnglets();
  rendreRoutinesParent();
  rendreHistorique();
}

function rendreOnglets(){
  if (!etat.enfants.some(e => e.id === ongletParent)) ongletParent = etat.enfants.length ? etat.enfants[0].id : null;
  const z = $('#onglets-routines'); z.innerHTML = '';
  etat.enfants.forEach(enf => {
    const b = document.createElement('button');
    b.className = 'onglet' + (enf.id === ongletParent ? ' onglet--actif' : '');
    b.textContent = enf.prenom;
    b.onclick = () => { ongletParent = enf.id; rendreOnglets(); rendreRoutinesParent(); rendreHistorique(); };
    z.appendChild(b);
  });
}

function rendreRoutinesParent(){
  const zr = $('#reglages-routines'); zr.innerHTML = '';
  const enf = etat.enfants.find(e => e.id === ongletParent);
  if (!enf) return;
  etat.routines.filter(r => r.enfantId === enf.id).forEach(r => {
    const bloc = document.createElement('div');
    bloc.className = 'sous-panneau';
    bloc.innerHTML = `<h3>${r.moment === 'soir' ? '🌙' : '☀️'} ${echapper(r.nom)}</h3>`;
    r.etapes.forEach(et => bloc.appendChild(ligneEtape(r, et)));
    const plus = document.createElement('button');
    plus.className = 'btn-ajout'; plus.textContent = '+ Tâche';
    plus.onclick = () => { r.etapes.push(E('✅','Nouvelle tâche')); sauver(); rendreRoutinesParent(); };
    bloc.appendChild(plus);
    zr.appendChild(bloc);
  });
}

function ligneEtape(routine, etape){
  const l = document.createElement('div');
  l.className = 'ligne';
  l.innerHTML = `
    <input class="champ-emoji" type="text" value="${etape.emoji}" maxlength="4">
    <input class="champ-nom" type="text" value="${echapper(etape.titre)}">
    <input class="champ-duree" type="number" min="0" step="30" value="${etape.duree}">
    <span class="ligne__unite">s · 0 = sans minuteur</span>
    <button class="btn-suppr">✕</button>`;
  const emo   = l.querySelector('.champ-emoji');
  const titre = l.querySelector('.champ-nom');
  const duree = l.querySelector('.champ-duree');
  emo.oninput   = () => { etape.emoji = emo.value;   sauver(); };
  titre.oninput = () => { etape.titre = titre.value; sauver(); };
  duree.oninput = () => { etape.duree = Math.max(0, +duree.value || 0); sauver(); };
  l.querySelector('.btn-suppr').onclick = () => {
    routine.etapes = routine.etapes.filter(x => x.id !== etape.id);
    sauver(); rendreRoutinesParent();
  };
  return l;
}

/* ---------------------------------------------------------
   9b. Historique — 4 semaines, un seul enfant à la fois
   --------------------------------------------------------- */
function rendreHistorique(){
  const zone = $('#historique-enfant'); zone.innerHTML = '';
  const enf = etat.enfants.find(e => e.id === ongletParent);
  if (!enf) return;

  // Moments complétés par jour. Les vieilles entrées sans moment passent par la routine.
  const momentParRoutine = new Map(etat.routines.map(r => [r.id, r.moment]));
  const faits = new Map();
  etat.journal.forEach(x => {
    if (x.enfantId !== enf.id) return;
    const m = x.moment || momentParRoutine.get(x.routineId);
    if (!m) return;
    if (!faits.has(x.date)) faits.set(x.date, new Set());
    faits.get(x.date).add(m);
  });

  // Grille de 4 semaines, lundi → dimanche, semaine courante en bas
  const auj = jourISO();
  const d = new Date(auj + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 21);

  const grille = document.createElement('div');
  grille.className = 'historique';
  ['L','M','M','J','V','S','D'].forEach(n => {
    const t = document.createElement('div');
    t.className = 'historique__jour-nom'; t.textContent = n;
    grille.appendChild(t);
  });

  let total = 0;
  for (let i = 0; i < 28; i++){
    const dateStr = jourISO(d);
    const m = faits.get(dateStr) || new Set();
    if (dateStr <= auj) total += m.size;

    const cellule = document.createElement('div');
    cellule.className = 'historique__jour';
    if (dateStr === auj) cellule.classList.add('historique__jour--auj');
    if (dateStr > auj)   cellule.classList.add('historique__jour--futur');
    cellule.innerHTML = `<span class="historique__date">${d.getDate()}</span>` +
      (dateStr > auj ? '' :
        `<span class="historique__pastille${m.has('matin') ? ' historique__pastille--fait' : ''}">☀️</span>
         <span class="historique__pastille${m.has('soir')  ? ' historique__pastille--fait' : ''}">🌙</span>`);
    grille.appendChild(cellule);
    d.setDate(d.getDate() + 1);
  }
  zone.appendChild(grille);

  const note = document.createElement('p');
  note.className = 'note';
  note.textContent = total > 0
    ? `${total} routine${total > 1 ? 's' : ''} complétée${total > 1 ? 's' : ''} en 4 semaines.`
    : 'Aucune routine complétée sur les 4 dernières semaines.';
  zone.appendChild(note);
}

$('#ajout-enfant').onclick = () => {
  const n = nouvelEnfant('Nouvel enfant', '🐣', '#8E7CFF', 'guide');
  etat.enfants.push(n);
  etat.routines.push(
    { id: id(), enfantId: n.id, nom:'Matin', moment:'matin', etapes: matin9() },
    { id: id(), enfantId: n.id, nom:'Soir',  moment:'soir',  etapes: soir9()  }
  );
  sauver(); rendreReglages(); rendreEnfants();
};

$('#exporter').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(etat, null, 2)], { type:'application/json' }));
  a.download = `ma-routine-${jourISO()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
};

$('#importer').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const donnees = JSON.parse(await f.text());
    if (!Array.isArray(donnees.enfants)) throw new Error('format');
    etat = donnees;
    if (!etat.famille) etat.famille = { objectif: 40 };
    if (!etat.reglages) etat.reglages = { heureReveil: '06:00', heureDepart: '06:50', pin: null };
    if (!etat.avancement) etat.avancement = {};
    sauver(); rendreReglages(); rendreEnfants(); rendreJaugeFamille();
    alert('Sauvegarde importée.');
  } catch { alert("Fichier illisible. Choisis un fichier exporté par l'app."); }
};

$('#reinitialiser').onclick = () => {
  if (!confirm('Effacer tous les profils, routines et séries ?')) return;
  const pin = etat.reglages.pin;             // le code parent survit à la remise à zéro
  etat = parDefaut(); etat.reglages.pin = pin; ongletParent = null;
  sauver(); rendreReglages(); rendreEnfants(); rendreJaugeFamille();
};

/* ---------------------------------------------------------
   10. Démarrage
   --------------------------------------------------------- */
function echapper(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

rendreEnfants();
rendreJaugeFamille();
peindreCielAccueil();
majDepart();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
