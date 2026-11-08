import { Link } from 'react-router-dom';

const sections = [
  { tab: 'overview', name: 'Overview', detail: 'Compare error rates across accent groups and see the spread across recordings. The charts describe this sample, not everyone in a community.' },
  { tab: 'clips', name: 'Clip explorer', detail: 'Search a recording, compare its transcript with the shared passage, and play its imported source recording.' },
  { tab: 'review', name: 'Review queue', detail: 'Return to recordings you flagged and add notes. Reviews stay in this browser; export a workspace backup to share them.' },
  { tab: 'settings', name: 'Analysis settings', detail: 'Choose recalculated or supplied scores, adjust text normalization, optionally attach original audio, and restore a workspace backup.' },
  { tab: 'where', name: 'Who & where', detail: 'See 2021 Census home-language counts by Mississauga ward. These are community counts, not estimates of transcription errors.' },
  { tab: 'languages', name: 'Home languages', detail: 'Read the separate FLEURS multilingual speech results. Keep this test separate from the accented English recordings.' },
  { tab: 'callcheck', name: 'Call Check', detail: 'Try the caller-request demo. It flags phrases in a transcript and can show an optional voice prototype score. Live checks need a connected backend.' },
];

export function DashboardGuide() {
  return (
    <section id="dashboard-guide" className="lp-section" aria-labelledby="dashboard-guide-heading">
      <div className="lp-container lp-editorial-split">
        <div className="lp-editorial-split__head">
          <h2 id="dashboard-guide-heading" className="lp-section__title">What is the dashboard for?</h2>
          <p className="lp-section__lead">Start in Overview, then open a recording in Clip explorer to inspect the words behind the score.</p>
          <p className="lp-guide-note">Word error rate counts changed, missing and extra words relative to the reference. It can exceed 100%. Listen before marking an error because a speaker may depart from the script.</p>
        </div>
        <dl className="lp-ledger lp-dashboard-guide">
          {sections.map(section => (
            <div className="lp-ledger__row" key={section.tab}>
              <dt className="lp-ledger__term"><Link className="lp-guide-link" to={`/dashboard?tab=${section.tab}`}>{section.name}</Link></dt>
              <dd className="lp-ledger__desc">{section.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
