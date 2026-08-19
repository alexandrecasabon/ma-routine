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
  matin: { debut:['#F9A26C','#FFD9A0'], fin:['#7FC9E8','#D6EEF9'], astre:'#FFC93C', halo:'rgba(255,255,255,.28)' },
  soir:  { debut:['#6E8BC4','#FFC08A'], fin:['#1B2050','#3E4478'], astre:'#F4F1E4', halo:'rgba(255,255,255,.13)' }
};
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
  $('#disque').setAttribute('fill', c.astre);
  $('#halo').setAttribute('fill', c.halo);
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
  const zone = $('#depart');
  if (!matinEcole()){ zone.hidden = true; departAnnonce = false; return; }

  const { mnt, fin } = fenetreMatin();
  const reste = Math.round((fin - mnt) * 60);
  zone.hidden = false;
  if (reste > 0){
    zone.classList.remove('depart--maintenant');
    zone.textContent = `École dans ${mmss(reste)}`;
    departAnnonce = false;
  } else {
    zone.classList.add('depart--maintenant');
    zone.textContent = 'DÉPART ÉCOLE';
    if (!departAnnonce){ departAnnonce = true; bip(); annoncer("Départ pour l'école !"); }
  }

  // Le soleil suit l'heure sauf pendant une routine du soir
  if (!session || !session.routine || session.routine.moment === 'matin')
    peindreCiel(progresMatin(), 'matin');
}
setInterval(majDepart, 1000);

/* ---------------------------------------------------------
   5. Navigation
   --------------------------------------------------------- */
function aller(idEcran){
  $$('.ecran').forEach(e => e.classList.remove('ecran--actif'));
  $('#' + idEcran).classList.add('ecran--actif');
  if (idEcran !== 'ecran-etape' && idEcran !== 'ecran-liste') arreterMinuteur();
  if (idEcran === 'ecran-enfants'){
    libererEcran(); session = null;
    $('#jalons').innerHTML = '';
    peindreCielAccueil();
    rendreJaugeFamille();
  }
}
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
    b.innerHTML = `<div class="carte__emoji">${enf.emoji}</div>
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
  arreterMinuteur();                 // avant de remplacer session, sinon le minuteur fuit
  session = { enfant: enf };
  $('#titre-routines').textContent = `Bonjour ${enf.prenom}`;
  const s = serieCourante(enf);
  $('#serie-perso').textContent = s > 0
    ? `Ta série : ${s} jour${s > 1 ? 's' : ''} d'affilée · ton record : ${enf.record}`
    : 'Nouvelle série à démarrer aujourd\u2019hui.';

  const zone = $('#liste-routines'); zone.innerHTML = '';
  etat.routines.filter(r => r.enfantId === enf.id).forEach(r => {
    const faite = etat.journal.some(x => x.date === jourISO() && x.routineId === r.id);
    const b = document.createElement('button');
    b.className = 'carte';
    b.style.setProperty('--accent', enf.couleur);
    b.innerHTML = `<div class="carte__emoji">${r.moment === 'soir' ? '🌙' : '☀️'}</div>
                   <div class="carte__nom">${echapper(r.nom)}</div>
                   <div class="carte__note">${faite ? 'Déjà faite aujourd\u2019hui' : r.etapes.length + ' tâches'}</div>`;
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
  session = { enfant: enf, routine, index: premier < 0 ? routine.etapes.length : premier,
              faites, minuteur: null, pastilleActive: null };
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
  arreterMinuteur();
  const btn = $('#etape-demarrer');
  $('#jauge').classList.remove('anneau__jauge--prep');
  if (etape.duree > 0){
    // Le chrono ne part pas tout seul : l'enfant appuie quand il est prêt
    $('#etape-chrono').textContent = mmss(etape.duree);
    $('#jauge').style.transition = 'none';
    regler(0);
    btn.hidden = false;
    btn.onclick = () => { btn.hidden = true; lancerPreparation(etape); };
  } else {
    $('#etape-chrono').textContent = ''; regler(1); btn.hidden = true;
  }
}

/* 30 s pour se préparer, annonce de début, minuteur, annonce de fin */
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
    speechSynthesis.speak(u);
  } catch { bip(); }
}

function lancerPreparation(etape){
  const msg = messagesPour(etape);
  $('#etape-rang').textContent = 'Prépare-toi…';
  $('#jauge').classList.add('anneau__jauge--prep');
  lancerMinuteur(PREPARATION, null, () => {
    $('#etape-rang').textContent = `Tâche ${session.index + 1} sur ${session.routine.etapes.length}`;
    $('#jauge').classList.remove('anneau__jauge--prep');
    annoncer(msg.debut);
    lancerMinuteur(etape.duree, null, () => { bip(); annoncer(msg.fin); });
  });
}

const CIRC = 553;                                     // 2π × 88
const regler = f => { $('#jauge').style.strokeDashoffset = CIRC * (1 - f); };

function lancerMinuteur(secondes, surTic = null, surFin = null){
  session.restant = secondes;
  if (surTic){ surTic(secondes); }
  else {
    afficherChrono();
    $('#jauge').style.transition = 'none';
    regler(0);
    requestAnimationFrame(() => { $('#jauge').style.transition = 'stroke-dashoffset 1s linear'; });
  }
  session.minuteur = setInterval(() => {
    session.restant--;
    if (surTic) surTic(session.restant);
    else { afficherChrono(); regler(1 - session.restant / secondes); }
    if (session.restant <= 0){ arreterMinuteur(); if (surFin) surFin(); else bip(); }
  }, 1000);
}

const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const afficherChrono = () => { $('#etape-chrono').textContent = mmss(session.restant); };
function arreterMinuteur(){ if (session && session.minuteur){ clearInterval(session.minuteur); session.minuteur = null; } }

$('#bouton-fait').onclick = () => {
  if (!session || !session.routine) return;
  arreterMinuteur();
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
    if (pastille) pastille.onclick = ev => { ev.stopPropagation(); minuteurListe(et, pastille); };
    ul.appendChild(li);
  });
}

function majSousTitreListe(){
  const n = session.routine.etapes.length;
  $('#liste-sous').textContent = `${session.faites.size} / ${n} · dans l'ordre que tu veux`;
}

function basculer(etape, li){
  if (session.faites.has(etape.id)) session.faites.delete(etape.id);
  else session.faites.add(etape.id);
  sauverAvancement(session.routine, session.faites);
  li.classList.toggle('tache--faite', session.faites.has(etape.id));
  majSousTitreListe();
  avancerCiel();
  if (session.faites.size === session.routine.etapes.length) setTimeout(terminer, 450);
}

function minuteurListe(etape, pastille){
  const dejaActive = session.minuteur && session.pastilleActive === pastille;
  arreterMinuteur();
  if (session.pastilleActive){
    session.pastilleActive.classList.remove('tache__duree--actif');
    session.pastilleActive = null;
  }
  if (dejaActive){ pastille.textContent = mmss(etape.duree); return; }
  session.pastilleActive = pastille;
  pastille.classList.add('tache__duree--actif');
  const msg = messagesPour(etape);
  lancerMinuteur(PREPARATION, reste => { pastille.textContent = `⏳ ${mmss(reste)}`; }, () => {
    annoncer(msg.debut);
    lancerMinuteur(etape.duree, reste => { pastille.textContent = mmss(reste); }, () => {
      bip(); annoncer(msg.fin);
      pastille.classList.remove('tache__duree--actif');
      if (session) session.pastilleActive = null;
      pastille.textContent = mmss(etape.duree);
    });
  });
}

/* ---------------------------------------------------------
   8. Fin de routine
   --------------------------------------------------------- */
function terminer(){
  if (!session || !session.routine) return;
  const { enfant: enf, routine } = session;
  arreterMinuteur();

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

function bip(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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

async function garderEcranAllume(){ try { session.verrou = await navigator.wakeLock.request('screen'); } catch {} }
function libererEcran(){ try { if (session && session.verrou) session.verrou.release(); } catch {} }

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
