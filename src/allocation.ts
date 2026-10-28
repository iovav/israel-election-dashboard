import type { Agreement, Allocation, Party, PartyResult } from './types';

const SEATS = 120;

function sum(values: number[]) {
  const total = values.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(total)) throw new Error('Vote totals exceed safe integer precision.');
  return total;
}

function greatest<T>(items: T[], votes: (item: T) => number, seats: (item: T) => number): T[] {
  let best: T[] = [];
  for (const item of items) {
    if (!best.length) {
      best = [item];
      continue;
    }
    const difference = BigInt(votes(item)) * BigInt(seats(best[0]) + 1)
      - BigInt(votes(best[0])) * BigInt(seats(item) + 1);
    if (difference > 0n) best = [item];
    else if (difference === 0n) best.push(item);
  }
  return best;
}

export function allocate(parties: Party[], agreements: readonly Agreement[] = []): Allocation {
  const ids = new Set<string>();
  for (const party of parties) {
    if (!party.id || ids.has(party.id)) throw new Error('Party IDs must be unique and nonempty.');
    if (!Number.isSafeInteger(party.votes) || party.votes < 0) throw new Error('Votes must be nonnegative safe integers.');
    ids.add(party.id);
  }
  const partners = new Map<string, string>();
  for (const [a, b] of agreements) {
    if (a === b || !ids.has(a) || !ids.has(b) || partners.has(a) || partners.has(b)) {
      throw new Error('Invalid or overlapping surplus agreement.');
    }
    partners.set(a, b); partners.set(b, a);
  }
  const validVotes = sum(parties.map(p => p.votes));
  const thresholdVotes = Number((BigInt(validVotes) * 325n + 9999n) / 10000n);
  const eligible = parties.filter(p => p.votes > 0 && p.votes >= thresholdVotes);
  const eligibleVotes = sum(eligible.map(p => p.votes));
  const quota = eligibleVotes >= SEATS ? Math.floor(eligibleVotes / SEATS) : null;
  const eligibleIds = new Set(eligible.map(p => p.id));
  const results: PartyResult[] = parties.map(p => {
    const isEligible = eligibleIds.has(p.id);
    const baseSeats = isEligible && quota ? Math.floor(p.votes / quota) : 0;
    const partner = partners.get(p.id);
    return {
      ...p, eligible: isEligible, baseSeats: quota ? baseSeats : null, seats: quota ? baseSeats : null,
      overflow: isEligible && quota ? p.votes - baseSeats * quota : null,
      nextQuotient: null,
      partner: partner && eligibleIds.has(partner) && isEligible ? partner : null,
    };
  });
  const baseSeatTotal = sum(results.map(p => p.baseSeats ?? 0));
  const output: Allocation = {
    validVotes, eligibleVotes, excludedVotes: validVotes - eligibleVotes, thresholdVotes,
    quota, baseSeatTotal, allocatedSeats: 0, status: 'insufficient', tie: [], parties: results, rounds: [],
  };
  if (!quota || baseSeatTotal > SEATS) {
    output.quota = null;
    results.forEach(p => { p.seats = null; p.baseSeats = null; p.overflow = null; });
    return output;
  }

  const groups: { members: PartyResult[]; votes: number; seats: number }[] = [];
  const grouped = new Set<string>();
  for (const party of results.filter(p => p.eligible)) {
    if (grouped.has(party.id)) continue;
    const partner = results.find(p => p.id === party.partner);
    const members = partner ? [party, partner] : [party];
    members.forEach(p => grouped.add(p.id));
    groups.push({ members, votes: sum(members.map(p => p.votes)), seats: sum(members.map(p => p.baseSeats ?? 0)) });
  }

  function unresolved(tie: string[]): Allocation {
    output.status = 'tie'; output.tie = tie;
    results.forEach(p => { if (p.eligible) p.seats = null; });
    return output;
  }

  // Section 81(d)(4) refers to votes of participating lists, not all valid votes.
  const canReceive = (votes: number, seats: number, totalVotes: number, totalSeats: number) =>
    seats < totalSeats / 2 || BigInt(votes) * 2n > BigInt(totalVotes);

  let total = baseSeatTotal;
  while (total < SEATS) {
    const candidates = groups.filter(g => canReceive(g.votes, g.seats, eligibleVotes, SEATS));
    const winners = greatest(candidates, g => g.votes, g => g.seats);
    if (!winners.length) throw new Error('No eligible list can receive the remaining seats.');
    if (winners.length > 1) return unresolved(winners.flatMap(g => g.members.map(p => p.id)));
    const winner = winners[0];
    output.rounds.push({ seat: total + 1, group: winner.members.map(p => p.id), quotient: winner.votes / (winner.seats + 1) });
    winner.seats++; total++;
  }

  for (const group of groups) {
    if (group.members.length === 1) {
      group.members[0].seats = group.seats;
      continue;
    }
    // Section 82 re-apportions the pair's entire seat total using its own quota.
    const pairQuota = Math.floor(group.votes / group.seats);
    for (const party of group.members) party.seats = Math.floor(party.votes / pairQuota);
    let assigned = sum(group.members.map(p => p.seats ?? 0));
    if (assigned > group.seats) throw new Error('Insufficient vote precision for an internal integer-quota allocation.');
    while (assigned < group.seats) {
      const candidates = group.members.filter(p => canReceive(p.votes, p.seats ?? 0, group.votes, group.seats));
      const winners = greatest(candidates, p => p.votes, p => p.seats ?? 0);
      if (winners.length !== 1) return unresolved(winners.map(p => p.id));
      winners[0].seats = (winners[0].seats ?? 0) + 1; assigned++;
    }
  }
  for (const party of results) {
    if (party.eligible) party.nextQuotient = party.votes / ((party.seats ?? 0) + 1);
  }
  output.allocatedSeats = sum(results.map(p => p.seats ?? 0));
  if (output.allocatedSeats !== SEATS) throw new Error('Allocation must total exactly 120 seats.');
  output.status = 'complete';
  return output;
}
