# Confirmations à obtenir d'AFR TAXI

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
12. **WhatsApp** : numéro actif et accord du chauffeur pour ce canal (`contact.whatsapp`). Tant qu'il manque, le site l'indique et propose e-mail et appel.
13. Délai minimal d'une demande en ligne (proposé : 60 min, sinon « appelez ») et horizon (365 jours) — `site/content/form.yaml`.

## Actifs
14. Logo original et autorisation d'usage ; photos du véhicule (plaque masquée ou non) et, s'il le souhaite, du chauffeur, avec autorisation écrite. Les fichiers de l'ancien site ne sont pas repris.

## Hébergement et publication (externe)
15. Hébergement cible réel (VPS ? mutualisé Apache ? proxy ?), accès, PHP disponible ; domaine et DNS (www / apex).
16. Search Console de l'ancien site si disponible (décision sur les anciennes URL).
17. Autorisation de publication explicite pour la cible et la version (après relecture).
