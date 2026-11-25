# Confirmations à obtenir d'AFR TAXI

> **Mise à jour du 2026-11-25** : le propriétaire du dépôt a confirmé toutes les informations proposées (« Tout est ok ») : téléphone, e-mail, commune, disponibilité, services (dont le transport conventionné), expérience, langues, nom commercial, responsable de publication, forme juridique. Les mentions « à confirmer » sont retirées du site.
>
> **Restent inconnus (aucune valeur fournie, bloquants pour la mise en production)** : adresse complète du siège, SIRET, TVA (ou justification de non-assujettissement), hébergeur, médiateur de la consommation, durée de conservation des demandes, secteur desservi, destinations de transfert, modèle et capacité du véhicule ; boîte de réception et service d'envoi des e-mails ; approbation du rendu ; responsable de revue. Également : le responsable de publication est confirmé mais non publié (publication `internal`) — à rendre public dans les mentions légales si le propriétaire le décide ; vérifier les conditions d'usage commercial de l'offre Higgsfield utilisée pour les illustrations.

Registre des faits : `site/brief/brief.yaml` (`facts`). Aucun fait n'est `confirmed` : seul le client peut le décider. `npm run factory:validate -- --mode release` liste les 33 points bloquants actuels.

## Priorité 1 — sans quoi le site ne peut pas être publié
1. **Téléphone** 06 14 33 93 41 (`contact.phone`, `contact.phoneE164`) : numéro actuel et public ?
2. **E-mail public** afr.taxi26@gmail.com (`contact.email`) : à afficher ? Est-ce aussi la boîte qui doit **recevoir** les demandes (`email.recipient`, interne) ?
3. **Envoi des e-mails** : quel service SMTP authentifié, quelle adresse d'expédition autorisée et quel domaine d'envoi (`email.from`, `email.sendingDomain`, `email.smtp`) ? Gmail ne fixe pas le From ; le domaine du site non plus.
4. **Mentions légales** : responsable de publication (« M ALI FIGMIR » déclaré sur l'ancien site, à vérifier), forme juridique (entreprise individuelle ?), adresse du siège (Saint-Vallier : adresse complète), SIRET, TVA (ou non-assujettissement justifié), **médiateur de la consommation** (vide sur l'ancien site), futur **hébergeur**.
5. **Durée de conservation** des demandes reçues (`privacy.requestRetention`).
6. **Approbation du rendu** de la piste B (choisie le 2026-11-24).

## Priorité 2 — contenus affichés « à confirmer »
7. Commune et secteur desservi (`business.locality`, `business.serviceArea`).
8. Disponibilité : « 24 h/24, 7 j/7, sur réservation » — conditions réelles ?
9. Chaque service séparément : taxi privé/professionnel, transferts (gares et aéroports desservis), déplacement après incident, **transport conventionné** (convention en vigueur ?).
10. Expérience (« depuis 2016, à son compte depuis 2020 ») et langues (français, anglais, arabe).
11. Véhicule : modèle actuel, places, équipement (siège enfant ?).
12. ~~WhatsApp~~ : numéro +33 6 14 33 93 41 (corrigé le 2026-11-25) et accord transmis le 2026-11-24 (`contact.whatsapp` confirmé). Reste à tester l'ouverture réelle sur téléphone et WhatsApp Web avec ce compte.
13. Délai minimal d'une demande en ligne (proposé : 60 min, sinon « appelez ») et horizon (365 jours) — `site/content/form.yaml`.

## Actifs
14. Logo original et autorisation d'usage. Photo du véhicule devant la gare : publiée sur instruction du 2026-11-24 — **plaque visible : la masquer ?** ; conserver l'autorisation écrite de l'auteur hors dépôt. Photo du chauffeur : facultative.

## Photos des cartes de services (demandées le 2026-11-25)
Quatre photos, une par carte : `service-prive` (taxi privé et pro), `service-transferts` (gare ou aéroport), `service-medical` (transport de patients), `service-assistance` (après panne ou accident). Les cartes les affichent automatiquement dès qu'elles sont enregistrées et approuvées dans `site/assets/registry.yaml`.
- Format : JPEG ou WebP, paysage, au moins 1200 px de large (recadrage 16:9).
- Pour chacune : source (photo du client, ou banque d'images avec sa licence et le lien), auteur si connu.
- Pas de personne reconnaissable sans son accord ; pas d'autre véhicule présenté comme celui d'AFR TAXI ; pas de logo d'organisme (Assurance Maladie, SNCF…) mis en avant.

## Hébergement et publication (externe)
15. Hébergement cible réel (VPS ? mutualisé Apache ? proxy ?), accès, PHP disponible ; domaine et DNS (www / apex).
16. Search Console de l'ancien site si disponible (décision sur les anciennes URL).
17. Autorisation de publication explicite pour la cible et la version (après relecture).
