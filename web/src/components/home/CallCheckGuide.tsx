import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const repo = 'https://github.com/MurtLK/lapeace/blob/main/';
const sources = [
  { file: 'backend/public/call-check.html', label: 'Microphone recording and results interface' },
  { file: 'backend/src/callcheck.js', label: 'Scribe transcription and the backend request handler' },
  { file: 'backend/src/scamrules.js', label: 'Keyword rules, weights and verdict thresholds' },
  { file: 'backend/scripts/voice_detector.py', label: 'Optional synthetic-voice prototype' },
];

export function CallCheckGuide() {
  return (
    <section id="call-check" className="lp-section lp-section--tinted" aria-labelledby="call-check-heading">
      <div className="lp-container lp-editorial-split">
        <div className="lp-editorial-split__head">
          <h2 id="call-check-heading" className="lp-section__title">Call Check, explained.</h2>
          <p className="lp-section__lead">A separate demo that checks what a caller asks for. The accent study does not train its scam rules.</p>
          <Link to="/dashboard?tab=callcheck" className="lp-btn lp-btn--primary">Open Call Check<ArrowUpRight className="lp-icon" aria-hidden="true" /></Link>
          <p className="lp-guide-note">The interface and explanation work on this website. Live transcription requires the backend and its ElevenLabs key.</p>
        </div>
        <div className="lp-call-check-method">
          <dl className="lp-ledger">
            <div className="lp-ledger__row"><dt className="lp-ledger__term">Record a sample</dt><dd className="lp-ledger__desc">Use the browser microphone for up to 20 seconds, or choose a prerecorded demo when its audio is available. This does not monitor phone calls.</dd></div>
            <div className="lp-ledger__row"><dt className="lp-ledger__term">Read the transcript</dt><dd className="lp-ledger__desc">ElevenLabs Scribe v2 turns the audio into text. Transcription mistakes can change which phrases the rules find.</dd></div>
            <div className="lp-ledger__row"><dt className="lp-ledger__term">Inspect request flags</dt><dd className="lp-ledger__desc">Fixed English keyword rules flag phrases about codes, unusual payments, remote access and other requests. They can miss context or flag a harmless mention. Their points are not scam probabilities.</dd></div>
            <div className="lp-ledger__row"><dt className="lp-ledger__term">Keep the voice score separate</dt><dd className="lp-ledger__desc">The optional prototype learned from real recordings and built-in macOS voices. It was not trained on modern neural voice clones, and its score does not decide the request verdict.</dd></div>
          </dl>
          <p className="lp-call-check-limit"><strong>No red flags does not mean a caller is legitimate.</strong> Neither output verifies who is calling.</p>
          <details id="call-check-source" className="lp-source-details">
            <summary>View Call Check source code</summary>
            <ul>
              {sources.map(source => <li key={source.file}><a href={`${repo}${source.file}`} target="_blank" rel="noreferrer">{source.label}<span className="lp-source-path">{source.file}</span></a></li>)}
            </ul>
            <p className="lp-guide-note">The live handler, keyword rules and optional voice model run on the backend. The website includes the same browser interface during its build.</p>
          </details>
        </div>
      </div>
    </section>
  );
}
