# ADR 0006 — Champs date/heure/nombre et règles entre champs du formulaire

Statut : accepté (usine 0.2.0) · 2026-11-24 · origine : premier site client (demande de trajet planifié)

## Contexte
Le contrat 0.1.0 ne connaissait que `text`, `email`, `tel`, `textarea`, `select`, et exigeait un e-mail obligatoire. Une demande de trajet a besoin d'une date et d'une heure de départ vérifiées **par le serveur**, d'un nombre de personnes borné, et peut reposer sur un rappel téléphonique sans e-mail. Une `min` de navigateur ou une regex sur un champ texte ne suffisent pas.

## Décision
- **Types** `date` (`AAAA-MM-JJ`, date civile réelle, années ≥ 1900), `time` (`HH:MM`, 24 h) et `integer` (`[0-9]{1,9}`, normalisé, bornes `min`/`max`). Les bornes sont des **limites de saisie**, pas une capacité ou une promesse métier.
- **Règles entre champs** (`rules:` du contrat, union discriminée par `kind` — point d'extension unique). Première règle : `datetime-future { date, time, timeZone, minLeadMinutes, maxDaysAhead }`.
  - Fuseau IANA **explicite** dans le contrat (ex. `Europe/Paris`), jamais celui du serveur ni du navigateur.
  - Heure murale → instants UTC par le même algorithme en JS (`Intl`) et PHP (`DateTimeZone`) : décalages 24 h avant/après, vérification de chaque candidat. 0 instant → `nonexistent_time` (passage à l'heure d'été) ; 2 → `ambiguous_time` (retour à l'heure d'hiver). **On demande une précision, on n'interprète jamais en silence.**
  - `in_the_past`, `too_soon` (délai minimal), `too_far` (horizon). Règle évaluée seulement si les deux champs sont présents et valides.
  - L'instant présent est un paramètre (`validateSubmission(c, input, now)`, `Contract::validate($input, $now)`) : tests déterministes ; le serveur utilise son horloge et fait foi.
- **Moyen de réponse** : la règle `form.reply-address` exige un champ obligatoire `email` **ou** `tel`. `Reply-To` n'est posé que si une adresse valide est fournie (sinon : identité d'envoi, comme avant).
- **Message transmis** : libellés de la langue principale (`serverContract(c, locale)`), et une ligne « Horaire interprété : … (fuseau, UTC±hh:mm) » pour chaque règle `datetime-future`.

## Preuves
`engine/tests/form-datetime.test.ts` : 35 vecteurs (dates impossibles, 29 février, formats, bornes, passé, délai, horizon, heure inexistante 2027-03-28 02:30, heure ambiguë 2027-10-31 02:30, injection CR/LF), exécutés en JS sous trois fuseaux de processus et en PHP sous deux `date.timezone` différents : résultats identiques. Rejets à la déclaration (règle sur un champ non date/time, fuseau inconnu, `min` hors `integer`, `min > max`). La parité historique (22 vecteurs) reste verte.

## Limites
Base de fuseaux : celle d'ICU (Node/navigateur) et celle de PHP ; une divergence de version de tzdata entre client et serveur est possible sur un changement de règle récent — le serveur fait foi. Fuseaux à plus d'une transition en 48 h : non pris en charge (aucun cas réel connu).
