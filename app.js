/* =========================================================
   Ma routine — logique
   Tout l'état vit dans localStorage, sur cet appareil seulement.
   ========================================================= */

const CLE = 'ma-routine-v1';
const $  = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

/* ---------------------------------------------------------
   1. Données par défaut (modifiables dans Réglages)
   --------------------------------------------------------- */
const parDefaut = () => ({
  enfants: [
    { id: 'e1', prenom: 'Enfant 1', emoji: '🦊', couleur: '#FF8A5B', etoiles: 0 },
    { id: 'e2', prenom: 'Enfant 2', emoji: '🦉', couleur: '#5BB0FF', etoiles: 0 }
  ],
  routines: [
    { id:'r1', enfantId:'e1', nom:'Matin',  moment:'matin', etapes: etapesMatin() },
    { id:'r2', enfantId:'e1', nom:'Soir',   moment:'soir',  etapes: etapesSoir()  },
    { id:'r3', enfantId:'e2', nom:'Matin',  moment:'matin', etapes: etapesMatin() },
    { id:'r4', enfantId:'e2', nom:'Soir',   moment:'soir',  etapes: etapesSoir()  }
  ],
  journal: []   // { date, enfantId, routineId, etoiles }
});

function etapesMatin(){ return [
  { id:id(), emoji:'🛏️', titre:'Faire son lit',        duree:0   },
  { id:id(), emoji:'👕', titre:"S'habiller",            duree:0   },
  { id:id(), emoji:'🥣', titre:'Déjeuner',              duree:0   },
  { id:id(), emoji:'🪥', titre:'Brosser les dents',     duree:120 },
  { id:id(), emoji:'🎒', titre:'Préparer le sac',       duree:0   },
  { id:id(), emoji:'👟', titre:'Souliers et manteau',   duree:0   }
];}

function etapesSoir(){ return [
  { id:id(), emoji:'🧸', titre:'Ranger les jouets',     duree:300 },
  { id:id(), emoji:'🛁', titre:'Bain',                  duree:0   },
  { id:id(), emoji:'🌙', titre:'Pyjama',                duree:0   },
  { id:id(), emoji:'🪥', titre:'Brosser les dents',     duree:120 },
  { id:id(), emoji:'📖', titre:'Lecture',               duree:600 },
  { id:id(), emoji:'😴', titre:'Dodo',                  duree:0   }
];}

function id(){ return Math.random().toString(36).slice(2, 9); }

/* ---------------------------------------------------------
   2. État
   --------------------------------------------------------- */
let etat;
try { etat = JSON.parse(localStorage.getItem(CLE)) || parDefaut(); }
catch { etat = parDefaut(); }

function sauver(){ localStorage.setItem(CLE, JSON.stringify(etat)); }

// Session en cours
let session = null;   // { enfant, routine, index, minuteur, restant, verrou }

/* ---------------------------------------------------------
   3. Le ciel
   --------------------------------------------------------- */
const CIELS = {
  matin: { debut:['#F9A26C','#FFD9A0'], fin:['#7FC9E8','#D6EEF9'], astre:'#FFC93C', halo:'rgba(255,255,255,.30)' },
  soir:  { debut:['#6E8BC4','#FFC08A'], fin:['#1B2050','#3E4478'], astre:'#F4F1E4', halo:'rgba(255,255,255,.14)' }
};

const hex2rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
const rgb2hex = c => '#' + c.map(v => Math.round(v).toString(16).padStart(2,'0')).join('');
const melange = (a, b, t) => rgb2hex(hex2rgb(a).map((v,i) => v + (hex2rgb(b)[i] - v) * t));

// Point sur la courbe quadratique du trajet : P0(60,178) P1(500,-70) P2(940,178)
function pointArc(t){
  const u = 1 - t;
  return {
    x: u*u*60 + 2*u*t*500 + t*t*940,
    y: u*u*178 + 2*u*t*(-70) + t*t*178
  };
}

function peindreCiel(progres, moment = 'matin'){
  const c = CIELS[moment];
  const haut = melange(c.debut[0], c.fin[0], progres);
  const bas  = melange(c.debut[1], c.fin[1], progres);

  document.body.style.setProperty('--ciel-haut', haut);
  document.body.style.setProperty('--ciel-bas',  bas);

  // Texte posé directement sur le ciel : clair ou foncé selon la luminance
  const [r,g,b] = hex2rgb(melange(haut, bas, .5));
  const clair = (0.299*r + 0.587*g + 0.114*b) > 150;
  document.body.style.setProperty('--sur-ciel', clair ? '#182747' : '#FFFCF5');
  document.body.style.setProperty('--sur-ciel-fond', clair ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.16)');

  const p = pointArc(progres);
  $('#astre').setAttribute('transform', `translate(${p.x}, ${p.y})`);
  $('#disque').setAttribute('fill', c.astre);
  $('#halo').setAttribute('fill', c.halo);
}

function poserJalons(nb, faits = 0){
  const g = $('#jalons');
  g.innerHTML = '';
  for (let i = 1; i <= nb; i++){
    const p = pointArc(i / nb);
    const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
    c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
    c.setAttribute('r', i <= faits ? 8 : 5);
    c.setAttribute('fill', i <= faits ? '#FFFCF5' : 'rgba(255,255,255,.35)');
    g.appendChild(c);
  }
}

/* ---------------------------------------------------------
   4. Navigation
   --------------------------------------------------------- */
function aller(idEcran){
  $$('.ecran').forEach(e => e.classList.remove('ecran--actif'));
  $('#' + idEcran).classList.add('ecran--actif');
  if (idEcran !== 'ecran-etape') arreterMinuteur();
  if (idEcran === 'ecran-enfants'){
    session = null;
    $('#jalons').innerHTML = '';
    peindreCiel(0, momentDuJour());
  }
}

function momentDuJour(){ const h = new Date().getHours(); return (h >= 15) ? 'soir' : 'matin'; }

document.addEventListener('click', e => {
  const cible = e.target.closest('[data-vers]');
  if (cible) aller(cible.dataset.vers);
});

/* ---------------------------------------------------------
   5. Écran « Qui commence ? »
   --------------------------------------------------------- */
function rendreEnfants(){
  const zone = $('#liste-enfants');
  zone.innerHTML = '';
  etat.enfants.forEach(enf => {
    const b = document.createElement('button');
    b.className = 'carte';
    b.style.setProperty('--accent', enf.couleur);
    b.innerHTML = `<div class="carte__emoji">${enf.emoji}</div>
                   <div class="carte__nom">${echapper(enf.prenom)}</div>
                   <div class="carte__note">⭐ ${enf.etoiles}</div>`;
    b.onclick = () => ouvrirRoutines(enf);
    zone.appendChild(b);
  });
}

function ouvrirRoutines(enfant){
  session = { enfant };
  $('#titre-routines').textContent = `Bonjour ${enfant.prenom}`;
  const zone = $('#liste-routines');
  zone.innerHTML = '';
  etat.routines.filter(r => r.enfantId === enfant.id).forEach(r => {
    const b = document.createElement('button');
    b.className = 'carte';
    b.style.setProperty('--accent', enfant.couleur);
    b.innerHTML = `<div class="carte__emoji">${r.moment === 'soir' ? '🌙' : '☀️'}</div>
                   <div class="carte__nom">${echapper(r.nom)}</div>
                   <div class="carte__note">${r.etapes.length} étapes</div>`;
    b.onclick = () => demarrer(enfant, r);
    zone.appendChild(b);
  });
  peindreCiel(0, momentDuJour());
  aller('ecran-routines');
}

/* ---------------------------------------------------------
   6. Le cœur : une étape à la fois
   --------------------------------------------------------- */
function demarrer(enfant, routine){
  if (!routine.etapes.length) return;
  session = { enfant, routine, index: 0 };
  document.documentElement.style.setProperty('--accent', enfant.couleur);
  poserJalons(routine.etapes.length, 0);
  garderEcranAllume();
  aller('ecran-etape');
  montrerEtape();
}

function montrerEtape(){
  const { routine, index } = session;
  const etape = routine.etapes[index];

  $('#etape-emoji').textContent = etape.emoji;
  $('#etape-titre').textContent = etape.titre;
  $('#etape-rang').textContent  = `Étape ${index + 1} sur ${routine.etapes.length}`;
  $('.carte-etape').style.setProperty('--accent', session.enfant.couleur);

  peindreCiel(index / routine.etapes.length, routine.moment);
  poserJalons(routine.etapes.length, index);

  arreterMinuteur();
  if (etape.duree > 0) lancerMinuteur(etape.duree);
  else { $('#etape-chrono').textContent = ''; regler(1); }
}

const CIRC = 553;                                   // 2π × 88
const regler = f => $('#jauge').style.strokeDashoffset = CIRC * (1 - f);

function lancerMinuteur(secondes){
  session.restant = secondes;
  afficherChrono();
  $('#jauge').style.transition = 'none';
  regler(0);
  requestAnimationFrame(() => { $('#jauge').style.transition = 'stroke-dashoffset 1s linear'; });

  session.minuteur = setInterval(() => {
    session.restant--;
    afficherChrono();
    regler(1 - session.restant / secondes);
    if (session.restant <= 0){ arreterMinuteur(); bip(); }
  }, 1000);
}

function afficherChrono(){
  const s = Math.max(0, session.restant);
  $('#etape-chrono').textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function arreterMinuteur(){ if (session?.minuteur){ clearInterval(session.minuteur); session.minuteur = null; } }

$('#bouton-fait').onclick = () => {
  if (!session?.routine) return;
  arreterMinuteur();
  session.enfant.etoiles += 1;
  session.index++;

  if (session.index < session.routine.etapes.length){
    sauver();
    montrerEtape();
  } else {
    terminer();
  }
};

function terminer(){
  const { enfant, routine } = session;
  enfant.etoiles += 3;                                // bonus routine complète
  etat.journal.push({
    date: new Date().toISOString().slice(0,10),
    enfantId: enfant.id, routineId: routine.id,
    etoiles: routine.etapes.length + 3
  });
  sauver();

  peindreCiel(1, routine.moment);
  poserJalons(routine.etapes.length, routine.etapes.length);

  const zone = $('#etoiles-gagnees');
  zone.innerHTML = '';
  for (let i = 0; i < 3; i++){
    const s = document.createElement('span');
    s.textContent = '⭐';
    s.style.animationDelay = `${i * 140}ms`;
    zone.appendChild(s);
  }
  $('#titre-fin').textContent = `Bravo ${enfant.prenom} !`;
  $('#sous-titre-fin').textContent =
    `Routine ${routine.nom.toLowerCase()} terminée · ${enfant.etoiles} étoiles en tout`;

  libererEcran();
  aller('ecran-fin');
  rendreEnfants();
}

/* Petit son de fin de minuteur, sans fichier audio */
function bip(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, .18].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = i ? 880 : 660; o.type = 'sine';
      g.gain.setValueAtTime(.001, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(.25, ctx.currentTime + d + .02);
      g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + d + .35);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + .4);
    });
  } catch {}
}

/* Garder l'écran allumé pendant une routine */
async function garderEcranAllume(){
  try { session.verrou = await navigator.wakeLock.request('screen'); } catch {}
}
function libererEcran(){ try { session?.verrou?.release(); } catch {} }

/* ---------------------------------------------------------
   7. Réglages (parent) — accès par appui long
   --------------------------------------------------------- */
let chronoAppui;
const cle = $('#cle-parent');
const debutAppui = () => { chronoAppui = setTimeout(() => { rendreReglages(); aller('ecran-parent'); }, 1500); };
const finAppui   = () => clearTimeout(chronoAppui);
['pointerdown'].forEach(ev => cle.addEventListener(ev, debutAppui));
['pointerup','pointerleave','pointercancel'].forEach(ev => cle.addEventListener(ev, finAppui));

function rendreReglages(){
  // --- Enfants ---
  const ze = $('#reglages-enfants');
  ze.innerHTML = '';
  etat.enfants.forEach(enf => {
    const l = document.createElement('div');
    l.className = 'ligne';
    l.innerHTML = `
      <input class="champ-emoji" type="text" value="${enf.emoji}" maxlength="4">
      <input class="champ-nom" type="text" value="${echapper(enf.prenom)}">
      <input type="color" value="${enf.couleur}">
      <button class="btn-suppr">Supprimer</button>`;
    const [emo, nom, coul] = l.querySelectorAll('input');
    emo.oninput  = () => { enf.emoji = emo.value; sauver(); rendreEnfants(); };
    nom.oninput  = () => { enf.prenom = nom.value; sauver(); rendreEnfants(); };
    coul.oninput = () => { enf.couleur = coul.value; sauver(); rendreEnfants(); };
    l.querySelector('.btn-suppr').onclick = () => {
      if (!confirm(`Supprimer ${enf.prenom} et ses routines ?`)) return;
      etat.enfants = etat.enfants.filter(x => x.id !== enf.id);
      etat.routines = etat.routines.filter(r => r.enfantId !== enf.id);
      sauver(); rendreReglages(); rendreEnfants();
    };
    ze.appendChild(l);
  });

  // --- Routines ---
  const zr = $('#reglages-routines');
  zr.innerHTML = '';
  etat.enfants.forEach(enf => {
    const bloc = document.createElement('div');
    bloc.className = 'sous-panneau';
    bloc.innerHTML = `<h3>${echapper(enf.prenom)}</h3>`;
    etat.routines.filter(r => r.enfantId === enf.id).forEach(r => {
      const t = document.createElement('div');
      t.innerHTML = `<div class="ligne"><strong>${r.moment === 'soir' ? '🌙' : '☀️'} ${echapper(r.nom)}</strong></div>`;
      r.etapes.forEach(et => t.appendChild(ligneEtape(r, et)));
      const plus = document.createElement('button');
      plus.className = 'btn-ajout';
      plus.textContent = '+ Étape';
      plus.onclick = () => {
        r.etapes.push({ id:id(), emoji:'✅', titre:'Nouvelle étape', duree:0 });
        sauver(); rendreReglages();
      };
      t.appendChild(plus);
      bloc.appendChild(t);
    });
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
    <span class="ligne__unite">s (0 = sans minuteur)</span>
    <button class="btn-suppr">✕</button>`;
  const [emo, titre, duree] = l.querySelectorAll('input');
  emo.oninput   = () => { etape.emoji = emo.value; sauver(); };
  titre.oninput = () => { etape.titre = titre.value; sauver(); };
  duree.oninput = () => { etape.duree = Math.max(0, +duree.value || 0); sauver(); };
  l.querySelector('.btn-suppr').onclick = () => {
    routine.etapes = routine.etapes.filter(x => x.id !== etape.id);
    sauver(); rendreReglages();
  };
  return l;
}

$('#ajout-enfant').onclick = () => {
  const nid = id();
  etat.enfants.push({ id:nid, prenom:'Nouvel enfant', emoji:'🐣', couleur:'#8E7CFF', etoiles:0 });
  etat.routines.push(
    { id:id(), enfantId:nid, nom:'Matin', moment:'matin', etapes: etapesMatin() },
    { id:id(), enfantId:nid, nom:'Soir',  moment:'soir',  etapes: etapesSoir()  }
  );
  sauver(); rendreReglages(); rendreEnfants();
};

/* --- Sauvegarde --- */
$('#exporter').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(etat, null, 2)], { type:'application/json' }));
  a.download = `ma-routine-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('#importer').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    etat = JSON.parse(await f.text());
    sauver(); rendreReglages(); rendreEnfants();
    alert('Sauvegarde importée.');
  } catch { alert("Fichier illisible. Choisis un fichier exporté par l'app."); }
};

$('#reinitialiser').onclick = () => {
  if (!confirm('Effacer tous les enfants, routines et étoiles ?')) return;
  etat = parDefaut(); sauver(); rendreReglages(); rendreEnfants();
};

/* ---------------------------------------------------------
   8. Utilitaires + démarrage
   --------------------------------------------------------- */
function echapper(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

rendreEnfants();
peindreCiel(0, momentDuJour());

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
