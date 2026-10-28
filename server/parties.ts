import type { Agreement } from '../src/types';

export const partyInfo: Record<string, { name: string; nameHe: string; color: string }> = {
  'מחל': { name: 'Likud', nameHe: 'הליכוד', color: '#3478c0' },
  'דרך': { name: 'Yashar', nameHe: 'ישר', color: '#2a9fa9' },
  'רק': { name: 'Together', nameHe: 'ביחד', color: '#6271b8' },
  'אמת': { name: 'The Democrats', nameHe: 'הדמוקרטים', color: '#d07869' },
  'ב': { name: 'Otzma Yehudit', nameHe: 'עוצמה יהודית', color: '#b79350' },
  'ט': { name: 'Religious Zionism–Zehut', nameHe: 'הציונות הדתית–זהות', color: '#a18b60' },
  'שס': { name: 'Shas', nameHe: 'ש״ס', color: '#70859b' },
  'ג': { name: 'United Torah Judaism', nameHe: 'יהדות התורה', color: '#9580b1' },
  'ל': { name: 'Yisrael Beiteinu', nameHe: 'ישראל ביתנו', color: '#bb6955' },
  'עם': { name: 'Ra’am', nameHe: 'רע״ם', color: '#559c78' },
  'ודם': { name: 'Joint List', nameHe: 'הרשימה המשותפת', color: '#bd5d70' },
  'די': { name: 'Reservists–Economic Party', nameHe: 'המילואימניקים–הכלכלית', color: '#789184' },
  'כן': { name: 'Blue and White (withdrawn)', nameHe: 'כחול לבן (פרשה)', color: '#95a1ac' },
  'זץ': { name: 'Brit Olam', nameHe: 'ברית עולם', color: '#95a1ac' },
  'נקי': { name: 'Electoral & Governing Reform', nameHe: 'תיקון שיטת הבחירות והממשל', color: '#95a1ac' },
};

// 2026 only. Both partners must independently clear the threshold.
export const agreements: Agreement[] = [
  ['רק', 'ל'], ['דרך', 'אמת'], ['ודם', 'עם'],
  ['מחל', 'ט'], ['שס', 'ג'], ['זץ', 'נקי'],
];
export const AGREEMENTS_SOURCE = 'https://en.wikipedia.org/wiki/2026_Israeli_legislative_election#Surplus-vote_agreements';
