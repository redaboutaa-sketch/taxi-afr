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
  intro: 'Pour un départ dans moins d’une heure, appelez. Pour un trajet planifié, remplissez la demande : le chauffeur vous recontacte.',
  formTitle: 'Demander un trajet',
  formIntro: 'Envoi par WhatsApp ou e-mail ; le chauffeur confirme disponibilité et tarif. Heure de Paris.',
  optional: '(facultatif)',
  notice: 'Votre demande ne vaut pas confirmation de réservation.',
  noticeDetail: 'Le chauffeur vous recontacte pour confirmer, ou non, la possibilité du trajet.',
  submitEmail: 'Envoyer par e-mail',
  submitEmailHelp: 'Sans WhatsApp : la demande est transmise par notre serveur.',
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
  accepted: 'Demande acceptée par notre serveur d’envoi (référence {ref}). Cela ne garantit pas encore sa réception par le chauffeur, et ce n’est pas une confirmation de course : il vous rappelle pour confirmer. Sans nouvelles, appelez.',
  unavailable: 'L’envoi est momentanément impossible. Vos saisies sont conservées : réessayez plus tard, ou appelez.',
  network: 'La connexion a échoué. Vos saisies sont conservées : réessayez, ou appelez.',
  recapTitle: 'Message préparé pour WhatsApp',
  recapIntro: 'Vérifiez le texte. En ouvrant WhatsApp, ce message et le numéro du chauffeur sont transmis à WhatsApp (Meta). Rien n’est envoyé tant que vous n’appuyez pas sur Envoyer dans WhatsApp.',
  recapOpen: 'Ouvrir WhatsApp',
  recapCopy: 'Copier le récapitulatif',
  recapCopied: 'Récapitulatif copié.',
  recapCopyFailed: 'Copie impossible : sélectionnez le texte ci-dessus.',
  recapAfter: 'Une fois revenu ici, rien n’indique que le message est parti : seul le chauffeur peut confirmer le trajet. Vous pouvez aussi envoyer la même demande par e-mail ou appeler.',
  privacyTitle: 'Vos données',
  privacy: 'Ces informations servent uniquement à organiser votre trajet. N’indiquez aucune information médicale (ni diagnostic, ni ordonnance, ni numéro de sécurité sociale) : pour un transport de patient, appelez.',
};

export const results = {
  accepted: {
    title: 'Demande transmise — AFR TAXI',
    h1: 'Demande transmise à notre serveur d’envoi',
    body: [
      'Votre demande a été acceptée par notre serveur d’envoi. Cela ne garantit pas encore sa réception par le chauffeur.',
      'Ce n’est pas une confirmation de course : le chauffeur vous rappelle pour confirmer, ou non, la possibilité du trajet. Sans nouvelles de sa part, appelez.',
    ],
  },
  invalid: {
    title: 'Demande à corriger — AFR TAXI',
    h1: 'Certaines informations n’ont pas été acceptées',
    body: [
      'Rien n’a été envoyé. Un champ obligatoire est vide ou incorrect, ou la date et l’heure sont passées, trop proches (moins d’une heure) ou ambiguës.',
      'Revenez à la page précédente : votre navigateur conserve généralement vos saisies. Pour un départ imminent, appelez.',
    ],
  },
  unavailable: {
    title: 'Envoi impossible — AFR TAXI',
    h1: 'L’envoi est momentanément impossible',
    body: ['Votre demande n’a pas pu être transmise. Rien n’a été envoyé.', 'Réessayez plus tard, ou appelez directement.'],
  },
};
