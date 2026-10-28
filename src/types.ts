export interface Party {
  id: string;
  name: string;
  nameHe: string;
  color: string;
  votes: number;
}

export type Agreement = readonly [string, string];

export interface PartyResult extends Party {
  eligible: boolean;
  baseSeats: number | null;
  seats: number | null;
  overflow: number | null;
  nextQuotient: number | null;
  partner: string | null;
}

export interface Allocation {
  validVotes: number;
  eligibleVotes: number;
  excludedVotes: number;
  thresholdVotes: number;
  quota: number | null;
  baseSeatTotal: number;
  allocatedSeats: number;
  status: 'complete' | 'insufficient' | 'tie';
  tie: string[];
  parties: PartyResult[];
  rounds: { seat: number; group: string[]; quotient: number }[];
}

export interface ElectionData {
  knesset: 26;
  year: 2026;
  validVotes: number;
  invalidVotes: number;
  castVotes: number;
  reportedElectorate: number;
  reportedLocalities: number;
  sourceUrl: string;
  sourceModifiedAt: string | null;
  fetchedAt: string;
  agreements: Agreement[];
  allocation: Allocation;
}
