import { parse } from 'csv-parse/sync';
import { allocate } from '../src/allocation';
import type { ElectionData } from '../src/types';
import { agreements, partyInfo } from './parties';

export const SOURCE_URL = 'https://media26.bechirot.gov.il/files/expc.csv';
const metadata = new Set(['סמל ועדה', 'שם ישוב', 'סמל ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים']);

function integer(value: unknown, label: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) throw new Error(`Invalid numeric column: ${label}.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Invalid nonnegative integer: ${label}.`);
  return number;
}

export function parseResults(text: string) {
  const rows: string[][] = parse(text, { bom: true, skip_empty_lines: true });
  const header = rows.shift();
  if (!header || rows.length === 0) throw new Error('The official export is empty.');
  // The official export has one trailing empty column.
  if (header.at(-1) === '') {
    header.pop();
    for (const row of rows) {
      if (row.pop() !== '') throw new Error('Unexpected nonempty trailing CSV column.');
    }
  }
  if (new Set(header).size !== header.length) throw new Error('Duplicate CSV columns.');
  for (const required of metadata) {
    if (!header.includes(required)) throw new Error(`Missing official column: ${required}.`);
  }
  const partyFields = header.filter(f => !metadata.has(f));
  if (!partyFields.length || partyFields.some(f => !/^[\u05d0-\u05ea]{1,4}$/u.test(f))) {
    throw new Error('Unrecognized 2026 election schema. Source adapter needs review.');
  }
  if (agreements.some(pair => pair.some(id => !partyFields.includes(id)))) {
    throw new Error('The 2026 agreement lists do not match the official export.');
  }
  const votes = Object.fromEntries(partyFields.map(f => [f, 0]));
  const seen = new Set<string>();
  let validVotes = 0, invalidVotes = 0, castVotes = 0, reportedElectorate = 0;
  for (const values of rows) {
    if (values.length !== header.length) throw new Error('Inconsistent CSV row width.');
    const row = Object.fromEntries(header.map((key, index) => [key, values[index]]));
    const code = String(integer(row['סמל ישוב'], 'סמל ישוב'));
    if (seen.has(code)) throw new Error(`Duplicate locality ${code}; refusing to double-count.`);
    seen.add(code);
    const valid = integer(row['כשרים'], 'כשרים');
    const invalid = integer(row['פסולים'], 'פסולים');
    const cast = integer(row['מצביעים'], 'מצביעים');
    const electorate = integer(row['בזב'], 'בזב');
    let rowVotes = 0;
    for (const field of partyFields) {
      const value = integer(row[field], field);
      votes[field] += value; rowVotes += value;
    }
    if (rowVotes !== valid || valid + invalid !== cast) {
      throw new Error(`Vote totals do not reconcile for locality ${code}.`);
    }
    validVotes += valid; invalidVotes += invalid; castVotes += cast; reportedElectorate += electorate;
  }
  for (const value of [...Object.values(votes), validVotes, invalidVotes, castVotes, reportedElectorate]) {
    if (!Number.isSafeInteger(value)) throw new Error('Source totals exceed safe integer precision.');
  }
  return { votes, validVotes, invalidVotes, castVotes, reportedElectorate, reportedLocalities: seen.size };
}

export async function loadElection(fetcher: typeof fetch = fetch): Promise<ElectionData> {
  const response = await fetcher(SOURCE_URL, {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: 'text/csv, application/octet-stream', 'User-Agent': 'Mozilla/5.0 (compatible; knesset-26-dashboard)' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`Official 2026 export returned HTTP ${response.status}.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 20_000_000) throw new Error('Official locality export exceeds the expected size.');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    text = new TextDecoder('windows-1255', { fatal: true }).decode(buffer);
  }
  const totals = parseResults(text);
  const parties = Object.entries(totals.votes).map(([id, votes]) => ({
    id, votes,
    ...(partyInfo[id] ?? { name: `List ${id}`, nameHe: `רשימה ${id}`, color: '#82939b' }),
  }));
  const modified = response.headers.get('last-modified');
  if (modified && !Number.isFinite(Date.parse(modified))) throw new Error('Invalid source publication timestamp.');
  return {
    knesset: 26, year: 2026, ...totals,
    sourceUrl: SOURCE_URL,
    sourceModifiedAt: modified ? new Date(modified).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    agreements,
    allocation: allocate(parties, agreements),
  };
}
