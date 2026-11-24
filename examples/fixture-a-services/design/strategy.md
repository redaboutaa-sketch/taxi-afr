# Stratégie éditoriale — Ostral Conseil (démonstration fictive)

Statut : **proposition** à valider par le propriétaire. Aucun fait client nouveau n'est introduit ici ; les éléments chiffrés renvoient aux faits du brief et à leur statut.

## Public prioritaire et tâche
- **Qui** : dirigeant ou responsable d'exploitation d'une PME industrielle de 50 à 500 salariés, sans acheteur dédié (brief : `market.audience`).
- **Tâche** : savoir en quelques minutes si Ostral peut aider, ce que contient concrètement une intervention, et comment engager un premier échange sans s'engager davantage.

## Objections à traiter
| Objection | Réponse de la page | Preuve disponible |
|---|---|---|
| « Encore un cabinet qui promet des économies » | Aucun pourcentage promis ; le livrable est décrit (cartographie, plan d'action) | Fait `offer.deliverable` — *proposed* |
| « Ça va mobiliser mes équipes » | Étape « Collecte » : export comptable, pas d'outil à installer | Contenu de méthode — à confirmer par le client |
| « Je ne sais pas combien de temps ça prend » | Durée du diagnostic affichée | Fait `offer.diagnosticDuration` — *proposed*, signalé « à confirmer » en preview |
| « Est-ce adapté à mon cas ? » | Section « Ce que nous ne faisons pas » (exclusions du brief) | `offer.exclusions` |

## Preuves de confiance
Disponibles : processus explicite, exclusions, livrable décrit, coordonnée de contact confirmée. **Absentes et non remplacées** : références clients, chiffres, logos, témoignages, photos d'équipe. Aucun emplacement factice n'est prévu pour elles.

## CTA principal
« Décrire votre situation » → formulaire de contact (brief : `market.primaryCta`, `form.enabled: true`). Action secondaire : consulter le contenu d'un diagnostic (ancre vers l'offre). Contact direct par e-mail confirmé en complément.

## Pages
| Page | Intention | Informations nécessaires | Action attendue |
|---|---|---|---|
| Accueil | Comprendre offre, cible, suite | Accroche, 3 prestations, méthode, exclusions | Décrire sa situation |
| Offre / service (gabarit de détail) | Évaluer une prestation | Pour qui, déroulé, livrable, durée (si confirmée), prérequis | Décrire sa situation |
| Contact | Envoyer une demande | Champs utiles seulement, traitement des données | Envoyer ; confirmation honnête |
| 404 | Se réorienter | Liens vers accueil et offre | Repartir |
| Mentions / confidentialité | Information légale | Faits juridiques du brief (ici fictifs, non publiables) | — |
