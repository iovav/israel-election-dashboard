import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseResults, loadElection, SOURCE_URL } from '../server/source';
import { agreements } from '../server/parties';

const ids = [...new Set(agreements.flat())];
const header = ['סמל ועדה', 'שם ישוב', 'סמל ישוב', 'בזב', 'מצביעים', 'פסולים', 'כשרים', ...ids];
function row(code = '1', name = '"Town, with comma"', votes = 1200000) {
  return ['1', name, code, '2000000', String(votes + 10), '10', String(votes), ...ids.map((_, i) => String(i === 0 ? votes : 0))].join(',');
}
const csv = (rows = [row()], trailing = true) => [header.join(','), ...rows].map(line => line + (trailing ? ',' : '')).join('\r\n');
const mockFetch = (response: Response): typeof fetch => async () => response;

test('quoted official CSV with trailing blank column reconciles all totals', () => {
  const totals = parseResults(csv());
  assert.equal(totals.validVotes, 1200000);
  assert.equal(totals.invalidVotes, 10);
  assert.equal(totals.castVotes, 1200010);
  assert.equal(totals.reportedLocalities, 1);
  assert.equal(totals.votes[ids[0]], 1200000);
});

test('CSV without a trailing blank column and UTF-8 BOM are accepted', () => {
  assert.equal(parseResults('\ufeff' + csv([row()], false)).validVotes, 1200000);
});

test('multiple locality rows are aggregated once', () => {
  const totals = parseResults(csv([row('1'), row('2')]));
  assert.equal(totals.validVotes, 2400000);
  assert.equal(totals.reportedLocalities, 2);
});

test('duplicate localities, invalid columns and non-reconciling votes are rejected', () => {
  assert.throws(() => parseResults(csv([row(), row()])), /Duplicate locality/);
  assert.throws(() => parseResults(csv().replace('1200010', '1200011')), /reconcile/);
  assert.throws(() => parseResults(csv().replace('כשרים', 'unknown')), /Missing official/);
  assert.throws(() => parseResults(csv().replace('1200010', '-1')), /numeric/);
  assert.throws(() => parseResults(csv().replace('שם ישוב', 'סמל ועדה')), /Duplicate CSV/);
  assert.throws(() => parseResults('<html>maintenance</html>'), /empty/);
  assert.throws(() => parseResults(''), /empty/);
});

test('unexpected trailing content and incomplete rows cannot produce partial results', () => {
  assert.throws(() => parseResults(csv().replace(/,$/, ',99')), /trailing/);
  assert.throws(() => parseResults(csv().replace(/,0,$/, ',')), /Invalid Record Length/);
});

test('application is pinned to official Knesset 26 URL and never falls back', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (url) => {
    calls++;
    assert.equal(url, SOURCE_URL);
    assert.ok(String(url).includes('media26.bechirot.gov.il'));
    return new Response(csv(), { headers: { 'last-modified': 'Wed, 28 Oct 2026 12:23:10 GMT' } });
  };
  const data = await loadElection(fetcher);
  assert.equal(data.knesset, 26);
  assert.equal(data.year, 2026);
  assert.equal(data.allocation.allocatedSeats, 120);
  assert.equal(data.sourceModifiedAt, '2026-10-28T12:23:10.000Z');
  assert.equal(calls, 1);
});

test('HTTP errors, invalid publication timestamps and HTML errors are explicit', async () => {
  await assert.rejects(loadElection(mockFetch(new Response('Unavailable', { status: 404 }))), /HTTP 404/);
  await assert.rejects(loadElection(mockFetch(new Response(csv(), { headers: { 'last-modified': 'invalid' } }))), /timestamp/);
  await assert.rejects(loadElection(mockFetch(new Response('<html>maintenance</html>'))), /empty/);
});

test('Windows-1255 encoded official column names are decoded', async () => {
  const bytes = Uint8Array.from(csv(), c => {
    const code = c.charCodeAt(0);
    return code >= 0x05d0 && code <= 0x05ea ? code - 0x05d0 + 0xe0 : code;
  });
  const data = await loadElection(mockFetch(new Response(bytes)));
  assert.equal(data.validVotes, 1200000);
  assert.equal(data.sourceModifiedAt, null);
});
