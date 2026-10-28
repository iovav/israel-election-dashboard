# Mandate — 26th Knesset (2026)

A bilingual English/Hebrew dashboard for the **2026 election only**, built with React, TypeScript, Vite and Express. Hebrew switches the complete interface to RTL.

## Run

Requires Node.js 22 or newer.

```powershell
npm install
npm run dev
```

Open http://localhost:3000. For a production build:

```powershell
npm run build
npm start
```

The server binds to loopback by default. `PORT` overrides port 3000. Tests: `npm test`.

## Official data and API investigation

The server reads the committee's [26th-Knesset locality CSV](https://media26.bechirot.gov.il/files/expc.csv) directly. This source responded successfully in Node on 28 October 2026 and supplied a `Last-Modified` timestamp. The [ballot-level export](https://media26.bechirot.gov.il/files/expb.csv) also responded. HTTP clients produced differing results during research, so validate access in the deployment runtime.

A documented, publicly usable **live 2026 REST endpoint could not be verified**. The official government's [CKAN REST catalog](https://data.gov.il/api/3/action/package_show?id=votes-knesset) works, but its latest listed election was the 25th Knesset when checked. It is not used as a fallback. The application exposes its own `GET /api/results` JSON endpoint; it is not represented as a committee REST API.

Successful downloads are cached for 60 seconds; concurrent requests share one download. The browser refreshes every 60 seconds unless disabled. Refresh within the cache window may return the same fetch timestamp. The source publication and successful-fetch timestamps are displayed separately in Israel time. The page warns when the source publication is over 15 minutes old or the successful fetch is over 3 minutes old. Source age does not establish counting completion.

On an upstream error the server returns HTTP 502; it never replaces 2026 data with another election. An already-open browser retains its last successful results with a visible error/staleness warning. A new browser shows an explicit unavailable state. There is no fake dataset or silent success fallback.

The adapter parses quoted CSV, handles UTF-8/BOM or Windows-1255, checks the expected schema, rejects duplicate locality codes, and reconciles every row's list votes against valid/invalid/cast totals before publishing any results. The locality export is a snapshot of reported votes, not proof that all ballots have been counted. No national turnout or count-completion percentage is invented.

## Allocation and overflow

Implementation follows [Knesset Elections Law sections 81–82](https://he.wikisource.org/wiki/חוק_הבחירות_לכנסת#סעיף_81), with an accessible [Bader–Ofer explanation](https://he.wikipedia.org/wiki/חוק_בדר_עופר):

1. Only lists with at least **3.25% of all valid votes** participate. The required integer threshold is rounded up.
2. The general quota is **floor(qualifying votes / 120)**. This is the displayed “votes per base seat”; it is not a universal price for every final mandate.
3. Each qualifying list starts with `floor(list votes / quota)` base seats.
4. **Overflow** is `list votes − base seats × quota`. It is nonnegative and smaller than the quota. It is not recalculated against final seats, which could give a misleading negative remainder. Below-threshold lists have no eligible overflow and display a dash.
5. Remaining seats use greatest quotients: `votes / (current seats + 1)`. Signed partners are treated as one list only if both qualify.
6. A pair's entire seat total is then re-apportioned using its internal integer quota and greatest quotients, as required by section 82.
7. Section 81(d)(4)'s half-seat restriction is applied against participating-list votes. Comparisons use exact integer cross-multiplication (`BigInt`); real quotient ties are reported as requiring the committee's lottery rather than being broken by array order.

All **120 seats are provisional projections based solely on the reported snapshot**, not certified mandates or a prediction of uncounted ballots. If the count is too small for a meaningful integer quota, no allocation is published.

The **Seats** column displays **base + surplus**, for example `20 + 1` for 21 total seats. The surplus component is final seats minus base seats, including applicable agreements in the Bader–Ofer allocation; it is not a comparison against an allocation without agreements. Zero gains display `+ 0`, and unresolved allocations display a dash. Hovering over a seat breakdown shows its total. Sorting and the seat chart continue to use total seats. The expression remains left-to-right in the Hebrew interface.

### 2026 metadata

Ballot mappings and [surplus agreements](https://en.wikipedia.org/wiki/2026_Israeli_legislative_election#Surplus-vote_agreements) were researched separately from the official vote export. The agreement source is secondary, not committee certification:

- Together (`רק`) — Yisrael Beiteinu (`ל`)
- Yashar (`דרך`) — Democrats (`אמת`)
- Joint List (`ודם`) — Ra'am (`עם`)
- Likud (`מחל`) — Religious Zionism–Zehut (`ט`)
- Shas (`שס`) — United Torah Judaism (`ג`)
- Brit Olam (`זץ`) — Electoral & Governing Reform (`נקי`)

These are **not 2022 mappings**: for example `ב` is Otzma Yehudit and `אמת` is the Democrats in this cycle. Unmapped minor lists retain official ballot letters instead of guessing names. Cycle-specific metadata lives in [server/parties.ts](server/parties.ts).

## Validation

Unit tests cover the published Bader–Ofer numerical example, the threshold boundary, integer quota/remainders, paired redistribution, ineligible partners, tied quotients, insufficient votes, invalid inputs, CSV quoting/encoding, malformed or inconsistent exports, and upstream errors. `npm run build` runs strict TypeScript checking and builds both client and server. The server's `GET /api/health` reports the pinned Knesset number.

The production dashboard was also checked in an integrated browser: visible seats totaled 120, search and threshold filters worked, English/Hebrew and methodology navigation worked, and a 390px mobile viewport had no page-level horizontal overflow in either direction. A simulated HTTP 502 retained last-fetched data with an error on an open page and showed no invented data on a fresh page.
