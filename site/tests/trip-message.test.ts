/**
 * Brouillon WhatsApp et récapitulatif : encodage, minimisation, bornes.
 * Numéro FICTIF de test (plage réservée à la fiction en France : +33 6 39 98).
 */
import { describe, expect, it } from 'vitest';
import { frenchDate, MAX_DRAFT_CHARS, tripSummary, whatsappLink, type TripInput } from '../src/lib/trip-message.ts';

const TEST_DIGITS = '33639980000';
const trip: TripInput = {
  pickup: 'Gare de Saint-Rambert-d’Albon',
  dropoff: "L'aéroport \"T1\" & co\nporte 2",
  date: '2027-03-01',
  time: '07:05',
  passengers: '2',
  travel_ref: 'TGV 6191',
  details: 'Rendez-vous chez le cardiologue',
  name: 'Zoé Ölçer',
  phone: '+44 20 7946 0000',
  email: 'zoe@example.org',
};

describe('récapitulatif', () => {
  it('date française calculée sans dépendre du fuseau', () => {
    expect(frenchDate('2027-03-01')).toBe('lundi 1er mars 2027');
    expect(frenchDate('2026-12-25')).toBe('vendredi 25 décembre 2026');
  });
  it('version tierce : ni e-mail ni précisions libres ; retours à la ligne aplatis dans les champs', () => {
    const s = tripSummary(trip, { forThirdParty: true });
    expect(s).not.toContain('zoe@example.org');
    expect(s).not.toContain('cardiologue');
    expect(s).toContain("Destination : L'aéroport \"T1\" & co porte 2");
    expect(s).toContain('Le lundi 1er mars 2027 à 07 h 05 (heure de Paris)');
    expect(s.startsWith('Bonjour, voici ma demande de trajet :')).toBe(true);
  });
  it('version complète (e-mail / copie) : contient les précisions', () => {
    expect(tripSummary(trip, { forThirdParty: false })).toContain('zoe@example.org');
  });
});

describe('lien de conversation WhatsApp', () => {
  it('encodage exact, aller-retour sans perte', () => {
    const text = tripSummary(trip, { forThirdParty: true });
    const link = whatsappLink(TEST_DIGITS, text)!;
    expect(link.startsWith(`https://wa.me/${TEST_DIGITS}?text=`)).toBe(true);
    const encoded = link.split('?text=')[1]!;
    expect(encoded).not.toMatch(/[\s"'&’\n]/);
    expect(encoded).toContain('%0A');
    expect(decodeURIComponent(encoded)).toBe(text);
    expect(new URL(link).searchParams.get('text')).toBe(text);
  });
  it('longueur bornée', () => {
    const link = whatsappLink(TEST_DIGITS, 'é'.repeat(5000))!;
    expect([...decodeURIComponent(link.split('?text=')[1]!)].length).toBe(MAX_DRAFT_CHARS);
  });
  it('numéro absent ou invalide : aucun lien', () => {
    expect(whatsappLink(null, 'x')).toBeNull();
    expect(whatsappLink('0614', 'x')).toBeNull();
    expect(whatsappLink('+33 6', 'x')).toBeNull();
  });
});
