/**
 * Textes du parcours de demande. Ils distinguent trois niveaux, sans jamais
 * les confondre : saisie VALIDÉE, demande ACCEPTÉE par le serveur d'envoi,
 * course CONFIRMÉE (uniquement par le chauffeur, hors du site).
 */
import type { ErrorCode } from '@engine/form-client';

export const request = {
  title: 'Contact et demande de trajet — AFR TAXI',
  description: 'Appelez directement, ou décrivez votre trajet : départ, destination, date et heure. Le chauffeur vous rappelle pour confirmer.',
  h1: 'Appeler ou demander un trajet',
  intro: 'Pour un départ dans moins d’une heure, appelez. Pour un trajet à venir, remplissez la demande : le chauffeur vous recontacte.',
  formTitle: 'Demander un trajet',
  formIntro: 'Envoyez votre demande par WhatsApp ou par e-mail : le chauffeur vous confirme la disponibilité et le tarif.',
  optional: '(facultatif)',
  notice: 'Votre demande ne vaut pas réservation :',
  noticeDetail: 'le chauffeur vous recontacte pour la confirmer.',
  submitEmail: 'Envoyer par e-mail',
  submitEmailHelp: 'Pas de WhatsApp ? Envoyez la même demande par e-mail.',
  sending: 'Envoi en cours…',
  whatsapp: 'Continuer sur WhatsApp',
  whatsappNoJs: 'Écrire sur WhatsApp',
  whatsappHelp: 'Votre message sera préparé dans WhatsApp. Appuyez sur Envoyer pour transmettre la demande.',
  whatsappUnavailable: 'WhatsApp n’est pas encore proposé : le numéro et l’accord du chauffeur pour ce canal restent à confirmer.',
  summary: 'La demande n’a pas été envoyée. À corriger :',
  errors: {
    required: 'Ce champ est obligatoire.',
    too_long: 'Ce texte est trop long.',
    invalid_email: 'Cette adresse e-mail n’est pas valide.',
    invalid_tel: 'Indiquez un numéro de téléphone (chiffres, espaces, + au début si international).',
    invalid_option: 'Choisissez une valeur de la liste.',
    invalid_chars: 'Ce champ contient des caractères non acceptés.',
    unexpected_field: 'Champ inattendu.',
    not_a_string: 'Valeur non acceptée.',
    invalid_date: 'Cette date n’existe pas (format attendu : jour, mois, année).',
    invalid_time: 'Indiquez une heure au format 14:30.',
    invalid_number: 'Indiquez un nombre entier.',
    out_of_range: 'Indiquez un nombre entre 1 et 99.',
    in_the_past: 'Cette date et cette heure sont déjà passées.',
    too_soon: 'Départ dans moins d’une heure : appelez directement le chauffeur.',
    too_far: 'Les demandes sont acceptées jusqu’à un an à l’avance.',
    nonexistent_time: 'Cette heure n’existe pas ce jour-là (passage à l’heure d’été) : choisissez 03:00 ou plus tard.',
    ambiguous_time: 'Cette heure existe deux fois cette nuit-là (retour à l’heure d’hiver) : choisissez une heure avant 02:00 ou à partir de 03:00, ou appelez.',
  } satisfies Record<ErrorCode, string>,
  accepted: 'Votre demande a bien été envoyée (référence {ref}). Le chauffeur vous recontacte pour confirmer le trajet. Sans nouvelles de sa part, appelez.',
  unavailable: 'L’envoi est momentanément impossible. Vos saisies sont conservées : réessayez plus tard, ou appelez.',
  network: 'La connexion a échoué. Vos saisies sont conservées : réessayez, ou appelez.',
  recapTitle: 'Message préparé pour WhatsApp',
  recapIntro: 'Vérifiez le texte. En ouvrant WhatsApp, ce message et le numéro du chauffeur sont transmis à WhatsApp (Meta). Rien n’est envoyé tant que vous n’appuyez pas sur Envoyer dans WhatsApp.',
  recapOpen: 'Ouvrir WhatsApp',
  recapCopy: 'Copier le récapitulatif',
  recapCopied: 'Récapitulatif copié.',
  recapCopyFailed: 'Copie impossible : sélectionnez le texte ci-dessus.',
  recapAfter: 'Le chauffeur vous répond sur WhatsApp pour confirmer le trajet. Si le message n’a pas pu partir, envoyez la demande par e-mail ou appelez.',
  privacyTitle: 'Vos données',
  privacy: 'Ces informations servent uniquement à organiser votre trajet. N’indiquez aucune information médicale (ni diagnostic, ni ordonnance, ni numéro de sécurité sociale) : pour un transport de patient, appelez.',
};

export const results = {
  accepted: {
    title: 'Demande envoyée — AFR TAXI',
    h1: 'Votre demande a bien été envoyée',
    body: [
      'Le chauffeur vous recontacte pour confirmer le trajet et vous indiquer le tarif.',
      'Sans nouvelles de sa part, appelez directement.',
    ],
  },
  invalid: {
    title: 'Demande à corriger — AFR TAXI',
    h1: 'Certaines informations n’ont pas été acceptées',
    body: [
      'Rien n’a été envoyé : un champ obligatoire est vide ou incorrect, ou le départ est passé, dans moins d’une heure ou à une heure ambiguë (changement d’heure).',
      'Revenez à la page précédente : votre navigateur conserve généralement vos saisies. Pour un départ imminent, appelez.',
    ],
  },
  unavailable: {
    title: 'Envoi impossible — AFR TAXI',
    h1: 'L’envoi est momentanément impossible',
    body: ['Votre demande n’a pas pu être transmise. Rien n’a été envoyé.', 'Réessayez plus tard, ou appelez directement.'],
  },
};
