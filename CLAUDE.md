# Ma routine — contexte du projet

Application iPad personnelle qui guide quatre enfants dans leurs routines du matin et du soir.
Usage familial privé, pas de distribution publique.

## Contraintes techniques

- PWA : HTML + CSS + JavaScript pur. **Aucun framework, aucune étape de compilation, aucune dépendance npm.**
- Cible unique : Safari sur iPad, installée depuis l'écran d'accueil (`display: standalone`).
- Hébergement : GitHub Pages — dépôt `alexandrecasabon/ma-routine`, app servie sur
  https://alexandrecasabon.github.io/ma-routine/ . Toute modification doit quand même
  fonctionner en ouvrant `index.html` directement.
- Stockage : `localStorage`, clé `ma-routine-v2`. Aucun serveur, aucun compte, aucune télémétrie.
- Polices système uniquement (`ui-rounded`). Ne jamais ajouter Google Fonts : l'app doit fonctionner hors ligne.
- Le service worker (`sw.js`) met en cache la coquille de l'app. **Incrémenter `VERSION` à chaque
  modification d'un fichier mis en cache**, sinon l'iPad servira l'ancienne version.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Les cinq écrans, tous présents dans le DOM, un seul porte `.ecran--actif` |
| `styles.css` | Palette, typographie, styles des écrans |
| `app.js` | État, navigation, ciel animé, minuteurs, réglages |
| `sw.js` | Cache hors ligne |
| `manifest.webmanifest` | Métadonnées PWA |

## Les enfants

| Prénom | Âge | `niveau` | Effet |
|---|---|---|---|
| Chloé | 7 | `guide` | Une tâche à la fois, rien d'autre à l'écran |
| Charlotte | 7 | `guide` | Idem |
| Elliot | 9 | `apercu` | Une tâche à la fois + la suivante annoncée |
| Édouard | 12 | `liste` | Toutes les tâches visibles, ordre libre, ton sobre |

Chloé et Charlotte sont jumelles. Leurs routines sont identiques mais leurs données sont
strictement séparées.

## Règles inviolables

1. **Aucun score d'un enfant n'est visible depuis le profil d'un autre.** L'écran de sélection
   n'affiche que prénom, avatar et couleur. Séries et records n'apparaissent qu'à l'intérieur
   d'un profil ouvert. Le panneau parent affiche un enfant à la fois, jamais de tableau comparatif.
2. **Jamais de classement entre les enfants.** Les deux seules mécaniques autorisées sont la série
   personnelle (chacun contre son propre record) et la jauge familiale collective (total agrégé,
   jamais ventilé par enfant). Fondement : Roseth, Johnson & Johnson 2008, *Psychological Bulletin*
   — les structures coopératives battent la compétition interpersonnelle sur la performance
   comme sur les relations entre pairs.
3. **Pas de récompenses matérielles annoncées d'avance.** Le retour est informationnel
   (« 4 jours d'affilée »), jamais monnayable. Deci, Koestner & Ryan 1999 : les récompenses
   tangibles attendues minent la motivation intrinsèque, davantage chez les enfants.
4. **Repère visuel : un enfant de 10 ans.** Ni ton bébé, ni ton ado. La différenciation par âge
   se fait après l'entrée dans le profil, via `niveau`, pas dans la coquille commune.
5. **Aucune donnée ne quitte l'appareil.** Pas d'analytics, pas de synchronisation, pas de CDN.

## Signature visuelle

Le soleil parcourt un arc pointillé en haut de l'écran et le dégradé du ciel avance avec la
progression : aube → plein jour le matin, crépuscule → nuit le soir. C'est le retour de
progression pour les enfants qui ne lisent pas encore. Ne pas le remplacer par une barre de
progression classique.

Palette : encre `#182747`, craie `#FFFCF5`, menthe `#1FB584`, soleil `#FFC93C`, corail `#FF6B5A`.
Chaque enfant a une couleur d'accent injectée via la variable CSS `--accent`.

## Conventions de code

- Tout est nommé en français, y compris les fonctions et les variables.
- Commentaires en français, seulement là où l'intention n'est pas évidente à la lecture.
- Pas de `innerHTML` avec du contenu saisi par l'utilisateur sans passer par `echapper()`.
- Une fonction de rendu par écran : `rendreEnfants`, `rendreListe`, `rendreReglages`, etc.

## Avant de déclarer une tâche terminée

- Vérifier que l'app fonctionne encore en ouvrant `index.html` sans serveur.
- Vérifier la lisibilité du texte posé sur le ciel en fin de routine du soir (fond sombre) :
  `peindreCiel()` bascule `--sur-ciel` selon la luminance, ne pas coder de couleur en dur.
- Incrémenter `VERSION` dans `sw.js`.

## Horaire de la semaine d'école

- Réveil 6 h 00, départ visé 6 h 50, retour vers 18 h 00. Heures réglables dans le panneau parent.
- Les matins de semaine (lundi-vendredi), le soleil suit l'heure réelle entre le réveil et le
  départ — pas la progression des tâches — et le bandeau « École dans MM:SS » devient
  « DÉPART ÉCOLE » à l'heure dite (une annonce sonore, une seule fois). Le soir et la fin de
  semaine, le soleil reste lié à la progression de la routine.
- Les routines par défaut suivent cet horaire (boîte à lunch, collations, devoirs).

## Mécanique des données (v4)

- `journal` : une entrée par routine complétée, avec `moment` depuis la v3 ; les entrées plus
  anciennes retrouvent leur moment via `routineId`, donc ne pas supprimer les routines à la légère.
- `avancement` : tâches cochées de la journée (`date|routineId` → ids), purgé au chargement.
  Permet de reprendre une routine interrompue et de décocher une tâche marquée par erreur
  depuis l'écran de l'enfant (cumulatif du jour). Décocher retire l'entrée du journal du jour
  et recalcule série et record via `recalculerSerie()` — jamais de retouche des jours passés.
- `reglages` : `heureReveil`, `heureDepart`, `pin`. Le code parent (4 chiffres, pavé après
  l'appui long sur ⚙) est une barrière d'accès pour enfants, pas un coffre-fort ; il survit
  à « Tout effacer ».
- Minuteurs : plus de départ automatique. Bouton Démarrer, 30 s de préparation (anneau jaune),
  annonce vocale de début et de fin (`speechSynthesis` fr-CA, repli sur `bip()`).
- Sortie protégée : au niveau `guide` (les 7 ans), « ← Arrêter » exige un appui maintenu de
  1,5 s — le bouton se remplit pendant l'appui, un tap bref secoue et affiche un indice.
  Niveaux `apercu` et `liste` : tap normal. Quitter n'est jamais destructif, l'avancement
  du jour est persistant.

