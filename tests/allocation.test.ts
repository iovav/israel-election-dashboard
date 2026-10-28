import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate } from '../src/allocation';
import type { Party } from '../src/types';

const parties = (votes: number[]): Party[] => votes.map((votes, index) => ({
  id: String(index), name: `Party ${index}`, nameHe: `Party ${index}`, color: '#000000', votes,
}));

test('published Bader–Ofer example uses highest averages, not largest remainder', () => {
  const result = allocate(parties([501000, 403000, 204000, 92000]));
  assert.equal(result.quota, 10000);
  assert.equal(result.baseSeatTotal, 119);
  assert.deepEqual(result.parties.map(p => p.seats), [50, 41, 20, 9]);
  assert.deepEqual(result.parties.map(p => p.overflow), [1000, 3000, 4000, 2000]);
  assert.equal(result.allocatedSeats, 120);
});

test('integer general quota discards fractions, preserving nonnegative remainders', () => {
  const result = allocate(parties([501001, 403000, 204000, 92000]));
  assert.equal(result.quota, 10000);
  assert.equal(result.parties[0].overflow, 1001);
  for (const p of result.parties) {
    assert.ok(p.overflow !== null && p.overflow >= 0 && p.overflow < result.quota!);
    assert.equal(p.votes, p.baseSeats! * result.quota! + p.overflow!);
  }
});

test('threshold includes exactly 3.25%, excludes one vote less, and excludes those votes from quota', () => {
  const result = allocate(parties([9351, 325, 324]));
  assert.equal(result.thresholdVotes, 325);
  assert.deepEqual(result.parties.map(p => p.eligible), [true, true, false]);
  assert.equal(result.eligibleVotes, 9676);
  assert.equal(result.excludedVotes, 324);
  assert.equal(result.quota, 80);
  assert.equal(result.parties[2].seats, 0);
  assert.equal(result.parties[2].overflow, null);
});

test('threshold rounds up a fractional required vote count', () => {
  const result = allocate(parties([9352, 325, 324]));
  assert.equal(result.thresholdVotes, 326);
  assert.equal(result.parties[1].eligible, false);
});

test('surplus agreement changes who receives the final seat', () => {
  const result = allocate(parties([501000, 403000, 204000, 92000]), [['2', '3']]);
  assert.deepEqual(result.parties.map(p => p.seats), [50, 40, 21, 9]);
  assert.equal(result.parties[2].partner, '3');
  assert.equal(result.rounds[0].group.join(','), '2,3');
  assert.equal(result.allocatedSeats, 120);
});

test('a below-threshold partner cannot transfer its votes', () => {
  const input = parties([501000, 403000, 204000, 92000, 10000]);
  const result = allocate(input, [['0', '4']]);
  assert.deepEqual(result.parties.map(p => p.seats), allocate(input).parties.map(p => p.seats));
  assert.equal(result.parties[0].partner, null);
  assert.equal(result.parties[4].seats, 0);
});

test('pair seats are re-apportioned with an internal quota, not simply added to base seats', () => {
  const input = parties([123001, 234567, 345678, 456789]);
  const result = allocate(input, [['0', '1'], ['2', '3']]);
  assert.equal(result.status, 'complete');
  assert.equal(result.allocatedSeats, 120);
  assert.deepEqual(result.parties.map(p => p.seats), [13, 24, 36, 47]);
  for (const pair of [['0', '1'], ['2', '3']]) {
    const lists = result.parties.filter(p => pair.includes(p.id));
    const seats = lists.reduce((n, p) => n + p.seats!, 0);
    const votes = lists.reduce((n, p) => n + p.votes, 0);
    const quota = Math.floor(votes / seats);
    assert.ok(lists.every(p => p.seats! >= Math.floor(p.votes / quota)));
  }
});

test('exact quotient tie is not broken by input order', () => {
  const input = parties([410000, 410000, 180000]);
  const result = allocate(input);
  assert.equal(result.status, 'tie');
  assert.deepEqual(new Set(result.tie), new Set(['0', '1']));
  assert.ok(result.parties.every(p => p.seats === null));
  assert.equal(allocate([...input].reverse()).status, 'tie');
});

test('a tied internal agreement allocation also requires a committee lottery', () => {
  const result = allocate(parties([205000, 205000, 590000]), [['0', '1']]);
  assert.equal(result.status, 'tie');
  assert.deepEqual(new Set(result.tie), new Set(['0', '1']));
  assert.ok(result.parties.every(p => p.seats === null));
});

test('zero or very small counts with invalid integer quota cannot invent seats', () => {
  for (const counts of [[], [0, 0], [1, 2], [61, 60]]) {
    const result = allocate(parties(counts));
    assert.equal(result.status, 'insufficient');
    assert.equal(result.allocatedSeats, 0);
    assert.ok(result.parties.every(p => p.seats === null && p.overflow === null));
  }
});

test('half-seat protection refers to participating votes and handles exactly half', () => {
  // Without the legal restriction, the first list's quotient would win seat 120.
  const result = allocate(parties([500000, 245000, 127500, 127500]));
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.parties.map(p => p.seats), [60, 30, 15, 15]);
  assert.equal(result.allocatedSeats, 120);
});

test('input and surplus agreement validation is explicit', () => {
  for (const counts of [[-1], [1.5], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER + 1]]) {
    assert.throws(() => allocate(parties(counts)), /Votes/);
  }
  assert.throws(() => allocate([...parties([1]), ...parties([2])]), /unique/);
  assert.throws(() => allocate(parties([100, 100]), [['0', 'missing']]), /agreement/);
  assert.throws(() => allocate(parties([100, 100]), [['0', '0']]), /agreement/);
  assert.throws(() => allocate(parties([100, 100, 100]), [['0', '1'], ['1', '2']]), /agreement/);
  assert.throws(() => allocate(parties([Number.MAX_SAFE_INTEGER, 1])), /precision/);
});

test('realistic deterministic snapshots preserve 120 seats and overflow identity', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const input = parties(Array.from({ length: 10 }, (_, i) => 50000 + ((seed * 7919 * (i + 1) + i * 104729) % 700001)));
    const result = allocate(input, [['0', '1'], ['2', '3']]);
    if (result.status === 'tie') continue;
    assert.equal(result.status, 'complete');
    assert.equal(result.allocatedSeats, 120);
    for (const p of result.parties.filter(p => p.eligible)) {
      assert.equal(p.votes, p.baseSeats! * result.quota! + p.overflow!);
      assert.ok(p.overflow! < result.quota!);
      assert.ok(Number.isInteger(p.seats) && p.seats! >= 0);
    }
  }
});
