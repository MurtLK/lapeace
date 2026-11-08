import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, AudioLines, Building2, FileAudio, MessageCircle, RotateCcw } from 'lucide-react';
import { formatWer, isCensus, isClarification, isSamples, resolveAudio, type CensusResponse, type ClarificationCase, type ClarificationResponse, type SamplesResponse } from '../lib/api';
import { useEvidence, type EvidenceState } from '../lib/useEvidence';
import './dashboard.css';

const VIEWS = [
  { id: 'evidence', label: 'Evidence', Icon: FileAudio },
  { id: 'community', label: 'Community', Icon: Building2 },
  { id: 'clarification', label: 'Clarification', Icon: MessageCircle },
] as const;

function DataRegion<T>({ state, retry, children }: { state: EvidenceState<T>; retry: () => void; children: (data: T) => ReactNode }) {
  if (state.status === 'loading') return <div className="dashboard-state" role="status"><AudioLines size={24} aria-hidden="true" /><p>Loading the evidence…</p></div>;
  if (state.status === 'error') return <div className="dashboard-state dashboard-state-error" role="alert"><h2>{state.unavailable ? 'Evidence is unavailable.' : 'We couldn’t load this evidence.'}</h2><p>{state.message}</p><p className="dashboard-note">The rest of the website is still available. No results have been substituted.</p><button className="dashboard-button" onClick={retry}><RotateCcw size={17} aria-hidden="true" />Try again</button></div>;
  return children(state.data);
}

function EmptyData({ children }: { children: ReactNode }) {
  return <div className="dashboard-state"><h2>No evidence to show yet.</h2><p>{children}</p></div>;
}

function SamplesContent({ data }: { data: SamplesResponse }) {
  const [selectedId, setSelectedId] = useState(data.featured_clip_id ?? '');
  const [audioFailed, setAudioFailed] = useState(false);
  const sample = data.samples.find((s) => s.clip_id === selectedId) ?? data.samples[0];
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    setAudioFailed(false);
    const player = audio.current;
    return () => { player?.pause(); };
  }, [sample?.clip_id]);
  if (!sample) return <EmptyData>The connected service has not supplied any recordings.</EmptyData>;
  const source = resolveAudio(sample.audio_url);
  const simulated = data.source === 'fixture' || sample.scribe_transcript_is_simulated;
  return (
    <div className="dashboard-evidence">
      <div className="dashboard-section-heading"><div><h2>Hear the original.</h2><p>Compare one English recording with the text Scribe returned.</p></div><span className="dashboard-badge">{simulated ? 'Fixture — simulated transcript' : 'Scribe transcript'}</span></div>
      <div className="dashboard-recording-toolbar">
        <label className="dashboard-field">Recording<select value={sample.clip_id} onChange={(event) => { audio.current?.pause(); setSelectedId(event.target.value); }}>{data.samples.map((s) => <option key={s.clip_id} value={s.clip_id}>{s.clip_id} — {s.speaker_group}</option>)}</select></label>
        <div><span className="dashboard-meta-label">Speaker background</span><strong>{sample.speaker_group}</strong></div>
        <div><span className="dashboard-meta-label">Word error rate</span><strong>{formatWer(simulated ? null : sample.wer)}</strong></div>
      </div>
      <p className="dashboard-note">All archive recordings are spoken English. Background describes the speaker’s first-language group.</p>
      {source && !audioFailed ? <audio key={sample.clip_id} ref={audio} className="dashboard-audio" controls preload="none" src={source} aria-label={`Play recording ${sample.clip_id}`} onError={() => setAudioFailed(true)} /> : <p className="dashboard-media-notice" role="status">Audio is unavailable on this connection. The transcript evidence remains readable.</p>}
      <div className="dashboard-transcripts">
        <section><h3>Reference passage</h3><p>{sample.reference_transcript}</p></section>
        <section><h3>{simulated ? 'Simulated Scribe transcript' : 'Scribe heard'}</h3><p>{sample.scribe_transcript || 'The service returned an empty transcript.'}</p></section>
      </div>
      <details className="dashboard-details"><summary>About this evidence</summary><p>{data.notice}</p><p>WER measures words changed, missed or added relative to the supplied reference. It is not a measure of intent understanding or caller legitimacy. Scores can exceed 100% when insertions dominate.</p></details>
    </div>
  );
}

function EvidencePanel() {
  const { state, retry } = useEvidence('/api/samples', isSamples);
  return <DataRegion state={state} retry={retry}>{(data) => <SamplesContent data={data} />}</DataRegion>;
}

function CensusContent({ data }: { data: CensusResponse }) {
  const [selected, setSelected] = useState('');
  const language = data.languages.find((l) => l.language === selected) ?? data.languages[0];
  if (!language) return <EmptyData>The connected service has not supplied census language groups.</EmptyData>;
  return <section className="dashboard-census">
    <div className="dashboard-section-heading"><div><h2>Put the voices in context.</h2><p>2021 Census: residents who speak the language most often at home.</p></div><label className="dashboard-field">Language<select value={language.language} onChange={(event) => setSelected(event.target.value)}>{data.languages.map((l) => <option key={l.language}>{l.language}</option>)}</select></label></div>
    <p className="dashboard-census-intro"><strong>{language.city_total.toLocaleString('en-CA')}</strong> Mississauga residents speak {language.language} most often at home.</p>
    <p className="dashboard-note">These population counts are separate from transcription scores. They do not estimate how many residents voice AI misunderstands.</p>
    {data.problems.length > 0 && <p className="dashboard-media-notice" role="alert">The census source reports consistency issues. Review the source notes before drawing conclusions.</p>}
    <div className="dashboard-table-scroll" tabIndex={0} role="region" aria-label="Ward language population table"><table className="dashboard-table"><caption>{language.language}: counts by ward</caption><thead><tr><th scope="col">Ward</th><th scope="col">Residents</th><th scope="col">Share of ward</th><th scope="col">Share of city’s speakers</th></tr></thead><tbody>{language.wards.map((ward) => <tr key={ward.geo}><th scope="row">Ward {ward.geo}</th><td>{ward.residents.toLocaleString('en-CA')}</td><td>{ward.pct_of_geo.toFixed(1)}%</td><td>{ward.share_of_city_speakers.toFixed(1)}%</td></tr>)}</tbody></table></div>
    <details className="dashboard-details"><summary>Census source and limitations</summary><p>{data.source}</p><ul>{data.notes.map((note) => <li key={note}>{note}</li>)}</ul></details>
  </section>;
}

function CommunityPanel() {
  const { state, retry } = useEvidence('/api/census', isCensus);
  return <DataRegion state={state} retry={retry}>{(data) => <CensusContent data={data} />}</DataRegion>;
}

function Replay({ item }: { item: ClarificationCase }) {
  const [step, setStep] = useState(0);
  const turns = [
    { label: 'Caller request', text: item.request_script },
    { label: 'Scribe heard', text: item.scribe_heard },
    { label: 'First interpretation', text: item.first_interpretation_label },
    ...(item.correction_script ? [{ label: 'Scripted caller correction', text: item.correction_heard ?? item.correction_script }] : []),
    { label: 'Final confirmed request', text: item.final_confirmed_label },
  ];
  return <div className="dashboard-replay"><p className="dashboard-note">Intended request: {item.intended_label}</p><ol className="dashboard-turns">{turns.slice(0, step + 1).map((turn, index) => <li key={index}><h3>{turn.label}</h3><p>{turn.text}</p></li>)}</ol><p className="dashboard-note" role="status">Step {step + 1} of {turns.length}{step === turns.length - 1 ? '. Replay complete. No municipal request was submitted.' : ''}</p><div className="dashboard-replay-actions"><button className="dashboard-button" onClick={() => setStep((s) => Math.min(s + 1, turns.length - 1))} disabled={step === turns.length - 1}>Next step</button><button className="dashboard-button dashboard-button-secondary" onClick={() => setStep(0)}><RotateCcw size={16} aria-hidden="true" />Restart replay</button></div></div>;
}

function ClarificationContent({ data }: { data: ClarificationResponse }) {
  const [selected, setSelected] = useState('');
  const item = data.cases.find((c) => c.case_id === selected) ?? data.cases[0];
  if (!item) return <EmptyData>The connected service has not supplied any clarification cases.</EmptyData>;
  return <section><div className="dashboard-section-heading"><div><h2>A question can change the outcome.</h2><p>Follow an example from first interpretation to confirmation.</p></div><span className="dashboard-badge">Scripted replay</span></div><p className="dashboard-note">Synthetic caller voices and scripted corrections. This replays stored evidence; it does not analyse new speech or start a live agent.</p><label className="dashboard-field dashboard-case-field">Example<select value={item.case_id} onChange={(event) => setSelected(event.target.value)}>{data.cases.map((c) => <option key={c.case_id} value={c.case_id}>{c.case_id} — {c.intended_label}</option>)}</select></label><Replay key={item.case_id} item={item} /><details className="dashboard-details"><summary>What this demonstration can tell us</summary><p>{data.description}</p><ul>{data.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul></details></section>;
}

function ClarificationPanel() {
  const { state, retry } = useEvidence('/api/clarify311', isClarification);
  return <DataRegion state={state} retry={retry}>{(data) => <ClarificationContent data={data} />}</DataRegion>;
}

export function DashboardPage() {
  const [search] = useSearchParams();
  const candidate = search.get('tab');
  const view = VIEWS.some((v) => v.id === candidate) ? candidate : 'evidence';
  return <div className="dashboard-page"><a href="#dashboard-main" className="app-skip-link">Skip to dashboard content</a><header className="dashboard-header"><div className="dashboard-header-inner"><Link className="dashboard-wordmark" to="/" aria-label="LAPEACE home"><AudioLines size={25} strokeWidth={1.7} aria-hidden="true" /><span>LAPEACE</span></Link><Link className="dashboard-back" to="/"><ArrowLeft size={17} aria-hidden="true" />Back to website</Link></div></header><main className="dashboard-main" id="dashboard-main"><div className="dashboard-intro"><h1>Explore the evidence.</h1><p>Listen closely. Look at the context. See what clarification changes.</p></div><nav className="dashboard-views" aria-label="Dashboard views">{VIEWS.map(({ id, label, Icon }) => <Link key={id} to={`/dashboard?tab=${id}`} aria-current={view === id ? 'page' : undefined}><Icon size={18} strokeWidth={1.8} aria-hidden="true" />{label}</Link>)}</nav><div className="dashboard-content" key={view}>{view === 'community' ? <CommunityPanel /> : view === 'clarification' ? <ClarificationPanel /> : <EvidencePanel />}</div><footer className="dashboard-footer"><p>Speech evidence and community context, kept in perspective.</p><Link to="/">About LAPEACE</Link></footer></main></div>;
}
