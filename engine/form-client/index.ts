/**
 * Interface publique « formulaire » utilisable DANS LE NAVIGATEUR : aucune
 * dépendance Node. Mêmes règles que le serveur (voir engine/form/contract.ts).
 */
export { validateSubmission, type ServerContract, type ValidationResult, type ErrorCode } from '../form/validate.ts';
export { FORM_ENDPOINT } from '../form/rules.ts';
