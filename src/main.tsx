import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { ElectionData, PartyResult } from './types';
import './styles.css';

type Language = 'en' | 'he';
type Sort = 'votes' | 'seats' | 'overflow';
const official = 'https://media26.bechirot.gov.il/files/expc.csv';
const STATIC_SNAPSHOT = import.meta.env.VITE_STATIC === 'true';
const agreementSource = 'https://en.wikipedia.org/wiki/2026_Israeli_legislative_election#Surplus-vote_agreements';
const law = 'https://he.wikisource.org/wiki/חוק_הבחירות_לכנסת#סעיף_81';

function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [data, setData] = useState<ElectionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [sort, setSort] = useState<Sort>('votes');
  const [auto, setAuto] = useState(true);
  const [tab, setTab] = useState<'results' | 'method'>('results');
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const he = language === 'he';
  const t = (en: string, hebrew: string) => he ? hebrew : en;
  const number = (value: number | null, digits = 0) => value === null ? '—' :
    new Intl.NumberFormat(he ? 'he-IL' : 'en-US', { maximumFractionDigits: digits }).format(value);
  const date = (value: string | null) => value ? new Date(value).toLocaleString(he ? 'he-IL' : 'en-GB', {
    timeZone: 'Asia/Jerusalem', dateStyle: 'medium', timeStyle: 'short',
  }) : t('Not supplied by source', 'לא סופק במקור');
  const name = (p: PartyResult) => he ? p.nameHe : p.name;

  async function refresh() {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const url = STATIC_SNAPSHOT ? `${import.meta.env.BASE_URL}results.json?t=${Date.now()}` : '/api/results';
      const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) {
        const body: { detail?: string } = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? `HTTP ${response.status}`);
      }
      const next: ElectionData = await response.json();
      if (next.knesset !== 26 || next.year !== 2026) throw new Error('Rejected results from a different election.');
      setData(next); setError(null);
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return;
      console.error('Election refresh failed:', failure);
      setError(failure instanceof Error ? failure.message : 'Unexpected results error.');
    } finally {
      busy.current = false; setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => window.clearInterval(timer);
  }, [auto]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = he ? 'rtl' : 'ltr';
  }, [language, he]);

  const a = data?.allocation;
  const parties = a ? [...a.parties].sort((x, y) => y.votes - x.votes) : [];
  const represented = parties.filter(p => (p.seats ?? 0) > 0);
  const shown = parties.filter(p => (!onlyEligible || p.eligible) &&
    `${p.name} ${p.nameHe} ${p.id}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()))
    .sort((x, y) => (y[sort] ?? -1) - (x[sort] ?? -1) || y.votes - x.votes);
  const stale = Boolean(data && now - Date.parse(data.fetchedAt) > (STATIC_SNAPSHOT ? 1_200_000 : 180_000));
  const sourceOld = Boolean(data?.sourceModifiedAt && now - Date.parse(data.sourceModifiedAt) > 900_000);
  const seats = represented.flatMap(p => Array.from({ length: p.seats ?? 0 }, () => p));
  const getPartner = (p: PartyResult) => parties.find(other => other.id === p.partner);

  return <div className="app">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Mandate home"><span className="brand-mark">m<span>.</span></span><span>MANDATE<small>{t('ISRAEL ELECTION MONITOR', 'מעקב אחר הבחירות בישראל')}</small></span></a>
      <div className="header-end"><span className="edition">26TH KNESSET <span>/</span> 2026</span><button className="language" onClick={() => setLanguage(he ? 'en' : 'he')}>{he ? 'English' : 'עברית'} <span>◎</span></button></div>
    </header>

    <main>
      <section className="heading">
        <div><div className="eyebrow"><span className="pulse" />{t('THE COUNT, EXPLAINED', 'המספרים שמאחורי הספירה')}</div>
          <h1>{t('Every vote. Every seat.', 'כל קול. כל מנדט.')}</h1>
          <p>{t('The 26th Knesset election · Official votes, transparent calculations.', 'הבחירות לכנסת ה־26 · קולות רשמיים, חישוב שקוף.')}</p>
        </div>
        <div className="refresh-area"><button className="refresh" disabled={loading} onClick={() => { void refresh(); }}><span className={loading ? 'spinning' : ''}>↻</span> {loading ? t('Fetching results…', 'טוען תוצאות…') : t('Refresh results', 'רענון תוצאות')}</button>
          <label className="auto"><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />{t('Auto-refresh every 60s', 'רענון אוטומטי כל 60 שניות')}</label>
        </div>
      </section>

      <div className="notice"><span className="info-icon">i</span><div><strong>{t('A snapshot of the count, not the final result.', 'תמונת מצב של הספירה, לא תוצאה סופית.')}</strong>{' '}{t('All 120 seats are provisionally allocated using votes reported so far. These are our calculations, not certified committee seat totals.', 'כל 120 המנדטים מחולקים באופן זמני על סמך הקולות שדווחו עד כה. זהו חישוב עצמאי, לא חלוקת מנדטים מאושרת של הוועדה.')}</div></div>

      {error && <div className="error" role="alert"><strong>{t('Official 2026 data could not be refreshed.', 'לא ניתן לרענן את הנתונים הרשמיים לשנת 2026.')}</strong><p>{error}</p>{data ? t('Showing the last successful fetch below. These results may be stale.', 'מוצגת המשיכה התקינה האחרונה. הנתונים עלולים להיות לא עדכניים.') : t('No substitute or 2022 results are shown. Use Refresh to retry.', 'לא מוצגים נתונים חלופיים או תוצאות 2022. ניתן לנסות שוב באמצעות רענון.')}</div>}
      {(stale || sourceOld) && <div className="warning" role="status">{t('Freshness warning: the fetch or source publication is older than expected. Check the timestamps before relying on these results.', 'אזהרת עדכניות: המשיכה או פרסום המקור ישנים מהצפוי. יש לבדוק את חותמות הזמן לפני שימוש בתוצאות.')}</div>}

      <section className="stats" aria-label={t('Election statistics', 'נתוני הבחירות')}>
        <Stat label={t('VALID VOTES COUNTED', 'קולות כשרים שנספרו')} value={a ? number(a.validVotes) : '—'} sub={t('From the official 2026 export', 'מתוך הייצוא הרשמי של 2026')} />
        <Stat label={t('VOTES PER BASE SEAT', 'קולות למנדט בסיסי')} value={number(a?.quota ?? null)} sub={t('Eligible votes ÷ 120, rounded down', 'קולות לרשימות שעברו ÷ 120, בעיגול מטה')} accent />
        <Stat label={t('ELECTORAL THRESHOLD', 'אחוז החסימה')} value="3.25%" sub={a ? `${number(a.thresholdVotes)} ${t('votes needed at this count', 'קולות נדרשים בספירה הנוכחית')}` : '—'} />
        <Stat label={t('SEATS TO ALLOCATE', 'מנדטים לחלוקה')} value="120" sub={a ? `${parties.filter(p => p.eligible).length} ${t('lists currently above threshold', 'רשימות מעל אחוז החסימה')}` : t('One nationwide constituency', 'אזור בחירה ארצי אחד')} />
      </section>

      <nav className="tabs" aria-label={t('Dashboard views', 'תצוגות')}>
        <button className={tab === 'results' ? 'active' : ''} onClick={() => setTab('results')}>{t('Results overview', 'תמונת התוצאות')} <span>01</span></button>
        <button className={tab === 'method' ? 'active' : ''} onClick={() => setTab('method')}>{t('How it’s calculated', 'איך מחשבים')} <span>02</span></button>
        <span className="tab-note"><span className="status-dot" />{t('2026 SOURCE ONLY', 'מקור 2026 בלבד')}</span>
      </nav>

      {tab === 'results' ? <>
        <section className="overview">
          <div className="panel chamber">
            <div className="panel-heading"><div><h2>{t('The shape of the Knesset', 'תמונת הכנסת')}</h2><p>{t('Provisional distribution · 120 seats', 'חלוקה זמנית · 120 מנדטים')}</p></div><span className="pill">{t('CALCULATED', 'מחושב')}</span></div>
            <div className="seat-chart" role="img" aria-label={t('120 seat chart. Party totals are listed in the table below.', 'תרשים של 120 מושבים. מספר המנדטים לכל רשימה מופיע בטבלה.')}>
              {Array.from({ length: 120 }, (_, i) => <span key={i} style={{ background: seats[i]?.color ?? '#e4e9ed' }} title={seats[i] ? name(seats[i]) : t('Not allocated', 'טרם חולק')} />)}
            </div>
            <div className="chart-caption"><strong>{a?.status === 'complete' ? '120' : '—'}<small>{t('seats', 'מנדטים')}</small></strong><span>{t('61 seats for a majority', '61 מנדטים לרוב')}<br /><small>{t('Each dot represents one seat', 'כל נקודה מייצגת מנדט אחד')}</small></span></div>
            <div className="legend">{represented.map(p => <span key={p.id}><i style={{ background: p.color }} />{name(p)} <b>{p.seats}</b></span>)}</div>
            {a && a.status !== 'complete' && <p className="warning">{a.status === 'tie' ? t(`An exact quotient tie requires a committee lottery (${a.tie.join(', ')}). Final projections are withheld.`, `שוויון מדויק דורש הגרלה של הוועדה (${a.tie.join(', ')}). תחזית המנדטים אינה מוצגת.`) : t('Not enough votes to calculate a reliable allocation yet.', 'עדיין אין מספיק קולות לחישוב חלוקה אמינה.')}</p>}
          </div>
          <aside className="panel count-panel">
            <div className="eyebrow">{t('BEHIND THE NUMBERS', 'מאחורי המספרים')}</div><h2>{t('Where the votes go', 'לאן הולכים הקולות')}</h2>
            <div className="count-row"><span>{t('Eligible-list votes', 'קולות לרשימות שעברו')}</span><strong>{a ? number(a.eligibleVotes) : '—'}</strong></div>
            <div className="count-row"><span>{t('Below-threshold votes', 'קולות מתחת לאחוז החסימה')}</span><strong>{a ? number(a.excludedVotes) : '—'}</strong></div>
            <div className="count-row"><span>{t('Invalid ballots', 'קולות פסולים')}</span><strong>{data ? number(data.invalidVotes) : '—'}</strong></div>
            <div className="count-row"><span>{t('Whole-quota seats', 'מנדטים לפי המודד')}</span><strong>{a?.quota ? number(a.baseSeatTotal) : '—'}</strong></div>
            <div className="count-row"><span>{t('Bader–Ofer seats', 'מנדטים בחלוקת עודפים')}</span><strong>{a?.quota ? number(120 - a.baseSeatTotal) : '—'}</strong></div>
            <p className="small-note">{t('Votes below 3.25% are excluded before calculating the seat quota. Surplus agreements only apply if both lists pass the threshold.', 'קולות של רשימות מתחת ל־3.25% אינם נכללים במודד. הסכמי עודפים חלים רק אם שתי הרשימות עברו את אחוז החסימה.')}</p>
          </aside>
        </section>

        <section className="panel results-panel">
          <div className="table-heading"><div><h2>{t('Party by party', 'רשימה אחר רשימה')}</h2><p>{t('Votes, seats, and the remainder that matters.', 'קולות, מנדטים והיתרה שמאחוריהם.')}</p></div><span className="pill">{number(shown.length)} {t('LISTS', 'רשימות')}</span></div>
          <div className="table-controls">
            <input className="search" aria-label={t('Search parties', 'חיפוש רשימה')} placeholder={t('Search a party or ballot letter…', 'חיפוש רשימה או אותיות…')} value={filter} onChange={e => setFilter(e.target.value)} />
            <div><label className="eligible"><input type="checkbox" checked={onlyEligible} onChange={e => setOnlyEligible(e.target.checked)} />{t('Above threshold only', 'מעל אחוז החסימה בלבד')}</label><select aria-label={t('Sort parties', 'מיון רשימות')} value={sort} onChange={e => setSort(e.target.value as Sort)}><option value="votes">{t('Sort: votes', 'מיון: קולות')}</option><option value="seats">{t('Sort: seats', 'מיון: מנדטים')}</option><option value="overflow">{t('Sort: overflow', 'מיון: יתרת קולות')}</option></select></div>
          </div>
          <div className="table-scroll"><table>
            <thead><tr><th>{t('PARTY / LIST', 'רשימה')}</th><th>{t('VOTES', 'קולות')}</th><th>{t('SHARE', 'שיעור')}</th><th>{t('BASE SEATS', 'מנדטי בסיס')}</th><th>{t('SEATS', 'מנדטים')}</th><th>{t('OVERFLOW VOTES', 'יתרת קולות')}</th><th>{t('SURPLUS PARTNER', 'שותפת עודפים')}</th></tr></thead>
            <tbody>{shown.map(p => {
              const partner = getPartner(p);
              const surplusSeats = p.seats !== null && p.baseSeats !== null ? p.seats - p.baseSeats : null;
              const seatDescription = surplusSeats !== null
                ? t(`${p.baseSeats} base seats + ${surplusSeats} surplus seats = ${p.seats} total seats`, `${p.baseSeats} מנדטי בסיס + ${surplusSeats} מנדטים מחלוקת עודפים = ${p.seats} מנדטים בסך הכול`)
                : t('Seat allocation unresolved', 'חלוקת המנדטים טרם הוכרעה');
              return <tr key={p.id} className={!p.eligible ? 'below' : ''}>
                <td><div className="party-cell"><span className="ballot" style={{ borderColor: p.color, color: p.color }}>{p.id}</span><div><strong>{name(p)}</strong><small>{p.eligible ? t('Above threshold', 'מעל אחוז החסימה') : t('Below threshold', 'מתחת לאחוז החסימה')}</small></div></div></td>
                <td className="numeric">{number(p.votes)}</td><td className="numeric">{number(a?.validVotes ? p.votes / a.validVotes * 100 : 0, 2)}%</td>
                <td className="numeric muted">{number(p.baseSeats)}</td>
                <td className="numeric seat-number" title={seatDescription} aria-label={seatDescription}>
                  {surplusSeats === null ? '—' : <bdi dir="ltr">{number(p.baseSeats)} <span className="surplus-seats">+ {number(surplusSeats)}</span></bdi>}
                </td>
                <td className="numeric"><strong>{number(p.overflow)}</strong>{p.overflow !== null && a?.quota && <div className="remainder-track"><span style={{ width: `${p.overflow / a.quota * 100}%`, background: p.color }} /></div>}</td>
                <td>{partner ? <span className="partner">{name(partner)}</span> : <span className="muted">—</span>}</td>
              </tr>;
            })}</tbody>
          </table></div>
          {!shown.length && <div className="empty" role="status">{loading && !data ? t('Connecting to the official 2026 results…', 'מתחבר לתוצאות הרשמיות של 2026…') : !data ? t('Waiting for official 2026 data.', 'ממתין לנתונים רשמיים לשנת 2026.') : t('No parties match your filters.', 'אין רשימות התואמות לחיפוש.')}</div>}
          <div className="table-footnote">
            <div>{t('Seats: base + surplus (e.g. 20 + 1 = 21 total). Surplus seats include Bader–Ofer allocation with applicable agreements, not the isolated benefit of an agreement.', 'מנדטים: בסיס + חלוקת עודפים (למשל 20 + 1 = 21 בסך הכול). מנדטי העודפים כוללים את חלוקת בדר–עופר עם ההסכמים החלים, ולא את התועלת הנפרדת של הסכם.')}</div>
            <div>{t('Overflow = votes − (base seats × integer quota). Below-threshold lists have no eligible overflow. This is not a “votes needed for the next seat” figure.', 'יתרת קולות = קולות פחות (מנדטי בסיס × המודד השלם). לרשימות מתחת לאחוז החסימה אין יתרה כשירה. זה אינו מספר הקולות הנדרש למנדט הבא.')}</div>
          </div>
        </section>
      </> : <section className="panel methodology">
        <div className="eyebrow">{t('TRANSPARENT BY DESIGN', 'שקיפות בכל שלב')}</div><h2>{t('From ballots to 120 seats', 'מהקולות ל־120 מנדטים')}</h2>
        <div className="method-grid">
          <Method n="01" title={t('Apply the threshold', 'אחוז החסימה')} text={t('A list participates only if its valid votes are at least 3.25% of all valid votes. Invalid ballots do not count toward the threshold.', 'רשימה משתתפת בחלוקה רק אם קיבלה לפחות 3.25% מכל הקולות הכשרים. קולות פסולים אינם נכללים בחישוב.')} formula="threshold = ceil(valid votes × 0.0325)" />
          <Method n="02" title={t('Find the base quota', 'המודד הכללי')} text={t('Sum the votes of qualifying lists, divide by 120 and discard the fraction. Divide each qualifying list’s votes by that integer quota and round down for its base seats.', 'מחברים את הקולות לרשימות שעברו, מחלקים ב־120 ומשמיטים את השבר. מחלקים את קולות הרשימה במודד השלם ומעגלים מטה לקבלת מנדטי הבסיס.')} formula="quota = floor(eligible votes / 120)" />
          <Method n="03" title={t('Measure the remainder', 'יתרת הקולות')} text={t('The displayed overflow is what remains after the base allocation. It is not necessarily wasted: the final allocation uses highest averages, not largest remainders.', 'היתרה המוצגת היא הקולות שנותרו לאחר החלוקה הבסיסית. הם אינם בהכרח מבוזבזים: החלוקה הסופית מבוססת על מודדי רשימה, לא על היתרה הגדולה ביותר.')} formula="overflow = votes − base seats × quota" />
          <Method n="04" title={t('Allocate Bader–Ofer seats', 'חלוקת בדר–עופר')} text={t('Award each remaining seat to the highest votes ÷ (seats + 1) quotient. Qualifying surplus partners compete together; then their total seats are re-apportioned with an internal integer quota and highest averages. Exact ties require a committee lottery; the app does not invent a winner.', 'כל מנדט שנותר ניתן למודד הגדול ביותר: קולות חלקי (מנדטים ועוד 1). שותפות עודפים שעברו מתחרות יחד, ואז מחלקות את מנדטיהן במודד פנימי ובמודדי רשימה. שוויון מדויק מחייב הגרלה של הוועדה; האפליקציה אינה ממציאה מנצחת.')} formula="next quotient = votes / (seats + 1)" />
        </div>
        <h3>{t('2026 surplus agreements', 'הסכמי עודפים לשנת 2026')}</h3>
        <p>{t('Together ↔ Yisrael Beiteinu · Yashar ↔ Democrats · Joint List ↔ Ra’am · Likud ↔ Religious Zionism–Zehut · Shas ↔ UTJ · Brit Olam ↔ Electoral & Governing Reform.', 'ביחד ↔ ישראל ביתנו · ישר ↔ הדמוקרטים · הרשימה המשותפת ↔ רע״ם · הליכוד ↔ הציונות הדתית–זהות · ש״ס ↔ יהדות התורה · ברית עולם ↔ תיקון שיטת הבחירות והממשל.')}</p>
        <p>{t('Agreement metadata is sourced separately from vote totals. Unmapped minor lists retain their official ballot letters instead of borrowing names from a past election.', 'פרטי ההסכמים מגיעים ממקור נפרד מספירת הקולות. רשימות קטנות שלא מופו מוצגות באותיותיהן הרשמיות, ולא בשמות ממערכת בחירות קודמת.')}</p>
        <div className="source-links"><a href={law} target="_blank" rel="noreferrer">{t('Election law · sections 81–82 ↗', 'חוק הבחירות · סעיפים 81–82 ↗')}</a><a href={agreementSource} target="_blank" rel="noreferrer">{t('2026 lists & agreements ↗', 'רשימות והסכמי 2026 ↗')}</a><a href="https://he.wikipedia.org/wiki/חוק_בדר_עופר" target="_blank" rel="noreferrer">{t('Bader–Ofer explanation ↗', 'הסבר על בדר–עופר ↗')}</a></div>
      </section>}

      <section className="provenance"><div><span className="eyebrow">{t('SOURCE & FRESHNESS', 'מקור ועדכניות')}</span><p><a href={official} target="_blank" rel="noreferrer">{t('Central Elections Committee · Knesset 26 CSV ↗', 'ועדת הבחירות המרכזית · ייצוא CSV לכנסת 26 ↗')}</a></p><small>{t('No verified public live REST endpoint. The server reads the official CSV directly. No previous-election fallback.', 'לא אומת ממשק REST ציבורי לתוצאות בזמן אמת. השרת קורא ישירות את ה־CSV הרשמי. אין שימוש בתוצאות ממערכת קודמת.')}</small></div>
        <div className="timestamps"><span>{t('Source published (Israel time)', 'פרסום המקור (שעון ישראל)')}<strong>{data ? date(data.sourceModifiedAt) : '—'}</strong></span><span>{t('Last successful fetch (Israel time)', 'משיכה תקינה אחרונה (שעון ישראל)')}<strong>{data ? date(data.fetchedAt) : '—'}</strong></span></div>
      </section>
      <footer><span className="footer-brand">MANDATE<span>.</span></span><span>{t('Independent calculations. Official source data. Built for clarity.', 'חישוב עצמאי. מקור נתונים רשמי. נבנה לבהירות.')}</span><span>KNESSET 26 / 2026</span></footer>
    </main>
  </div>;
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return <div className={`stat ${accent ? 'accent' : ''}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}
function Method({ n, title, text, formula }: { n: string; title: string; text: string; formula: string }) {
  return <article><span className="method-number">{n}</span><h3>{title}</h3><p>{text}</p><code dir="ltr">{formula}</code></article>;
}

createRoot(document.getElementById('root')!).render(<App />);
