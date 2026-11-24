# ADR 0002 — Formulaire, contrat partagé et transport e-mail

Statut : accepté (incrément 2) · 2026-11-24

## Décision
- **Contrat unique** par site (`<site>/content/form.yaml`, schéma `engine/form/contract.ts`). Deux validateurs aux règles identiques : `engine/form/validate.ts` (navigateur, sans dépendance) et `engine/form/php/src/Contract.php` (serveur, fait foi). Parité prouvée par 22 vecteurs communs (`engine/tests/form-parity.test.ts`), exécutés sur PHP 8.3.6 et 8.4.28.
- **Endpoint** `public/api/contact.php` (une ligne) ; logique hors racine dans `app/` : méthode, type de contenu, taille, origine (`Origin` puis `Referer`, liste explicite), piège, limitation de débit, validation, envoi.
- **Transport** : PHPMailer 7.2.0 via Composer, SMTP authentifié. Pas de `mail()`. `transport: capture` (démo) vise une boîte SMTP de capture locale, refusée en release pour un site réel.
- **Identités** : `From` = adresse d'envoi déclarée (doit appartenir à `sendingDomain`, contrôle d'alignement), `Reply-To` = adresse validée du demandeur, destinataire interne jamais publié.
- **Secrets** : seuls les noms de variables figurent dans `app/config/runtime.json` ; les valeurs viennent de l'environnement du pool PHP-FPM (`env[NOM] = $NOM`).
- **Limitation de débit** : fichier par clé (HMAC de l'adresse, sel aléatoire local), verrou `flock` → partagée entre processus PHP-FPM d'un même serveur. Limite : pas entre plusieurs serveurs.
- **Réponses** : JSON (`Accept: application/json`) ou 303 vers une page de résultat statique (parcours sans JavaScript). Codes publics stables ; détail technique dans le journal PHP uniquement, sans corps du message.
- **Niveaux de preuve** affichés honnêtement : « acceptée par notre serveur d'envoi … ne garantit pas encore sa réception ».

## Ce qui n'est pas prouvé
Réception dans une boîte réelle, SPF/DKIM/DMARC, TLS du serveur SMTP : `pending_external` tant qu'un domaine et une boîte autorisés n'existent pas.
