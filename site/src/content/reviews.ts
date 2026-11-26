/**
 * Avis clients affichés sur le site. VIDE par défaut : un avis n'est ajouté
 * qu'après vérification sur la fiche Google (texte exact, date) et accord de
 * son auteur ou de l'exploitant ; prénom + initiale seulement. Aucune note
 * moyenne ni nombre d'avis n'est affiché sans fait confirmé et daté.
 */
export interface Review {
  author: string; // ex. « Sophie L. »
  date: string; // AAAA-MM-JJ, date de l'avis sur Google
  text: string;
}

export const reviews: Review[] = [];
