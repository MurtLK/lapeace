import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, AudioLines, MapPin, Menu, MessageSquareCheck, X } from 'lucide-react';
import { BlurFade } from '../components/home/BlurFade';
import { ShimmerButton } from '../components/home/ShimmerButton';
import { BentoCard, BentoGrid } from '../components/home/BentoGrid';
import './home.css';

interface UtteranceSegment {
  id: string;
  label: string;
  phrase: string;
  acousticFocus: string;
  transcriptDetail: string;
  civicContext: string;
  bars: number[];
}

const STELLA_SEGMENTS: UtteranceSegment[] = [
  {
    id: 'stella-call',
    label: 'Opening',
    phrase: 'Please call Stella. Ask her to bring these things with her from the store:',
    acousticFocus: 'A name at the beginning of a request.',
    transcriptDetail:
      'Listen to the recording before deciding whether a changed word is a recognition error.',
    civicContext:
      'A short follow-up can help a caller clarify a name.',
    bars: [28, 44, 62, 50, 36, 74, 88, 64, 42, 58, 76, 52, 38, 68, 84, 48, 34, 60],
  },
  {
    id: 'snow-peas',
    label: 'The list',
    phrase: 'Six spoons of fresh snow peas, five thick slabs of blue cheese, and maybe a snack for her brother Bob.',
    acousticFocus: 'Similar sounds in a longer list.',
    transcriptDetail:
      'Check which words the transcript keeps, changes, adds or leaves out.',
    civicContext:
      'Details matter when someone explains what they need.',
    bars: [46, 72, 86, 54, 66, 92, 78, 48, 64, 82, 90, 58, 40, 70, 84, 62, 50, 74],
  },
  {
    id: 'toy-frog',
    label: 'For the kids',
    phrase: 'We also need a small plastic snake and a big toy frog for the kids.',
    acousticFocus: 'Everyday words with similar sounds.',
    transcriptDetail:
      'Read the supplied passage beside the actual transcript. The speaker may also depart from the script.',
    civicContext:
      'Reading a request back gives the caller a chance to correct it.',
    bars: [34, 52, 68, 80, 46, 60, 76, 58, 42, 72, 88, 66, 48, 54, 70, 62, 38, 44],
  },
  {
    id: 'train-station',
    label: 'The meeting',
    phrase: 'She can scoop these things into three red bags, and we will go meet her Wednesday at the train station.',
    acousticFocus: 'A day and a destination at the end.',
    transcriptDetail:
      'Check whether the transcript preserves the time and place.',
    civicContext:
      'Confirmation helps check the details before a request moves forward.',
    bars: [40, 64, 78, 52, 44, 70, 86, 60, 48, 82, 94, 68, 54, 76, 62, 46, 58, 36],
  },
];

export function HomePage() {
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(STELLA_SEGMENTS[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const firstMobileLinkRef = useRef<HTMLAnchorElement | null>(null);
  const mobileMenuId = useId();

  const activeSegment =
    STELLA_SEGMENTS.find((segment) => segment.id === selectedSegmentId) ?? STELLA_SEGMENTS[0];

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      firstMobileLinkRef.current?.focus();
    }
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  return (
    <div className="lp-home" id="top">
      <a className="lp-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="lp-header">
        <div className="lp-container lp-header__inner">
          <Link to="/" className="lp-brand-link" aria-label="LaPeace home">
            <span className="lp-brand-mark" aria-hidden="true">
              <img
                src="/brand/lapeace-logo.png"
                alt=""
                width={1536}
                height={1024}
                className="lp-brand-mark__img"
              />
            </span>
          </Link>

          <nav className="lp-nav" aria-label="Primary navigation">
            <ul className="lp-nav__list">
              <li>
                <a className="lp-nav__link" href="#how-it-works">
                  How it works
                </a>
              </li>
              <li>
                <a className="lp-nav__link" href="#why-it-matters">
                  Why it matters
                </a>
              </li>
              <li>
                <a className="lp-nav__link" href="#about-sources">
                  About
                </a>
              </li>
            </ul>
          </nav>

          <div className="lp-header__actions">
            <Link to="/dashboard" className="lp-btn lp-btn--quiet">
              Open dashboard
            </Link>

            <button
              ref={menuButtonRef}
              type="button"
              className="lp-menu-toggle"
              aria-expanded={mobileMenuOpen}
              aria-controls={mobileMenuId}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              {mobileMenuOpen ? (
                <X className="lp-icon" aria-hidden="true" />
              ) : (
                <Menu className="lp-icon" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div
          id={mobileMenuId}
          className={`lp-mobile-drawer ${mobileMenuOpen ? 'is-open' : ''}`}
          hidden={!mobileMenuOpen}
        >
          <nav className="lp-container lp-mobile-nav" aria-label="Mobile navigation">
            <a
              ref={firstMobileLinkRef}
              className="lp-mobile-nav__link"
              href="#how-it-works"
              onClick={closeMobileMenu}
            >
              How it works
            </a>
            <a
              className="lp-mobile-nav__link"
              href="#why-it-matters"
              onClick={closeMobileMenu}
            >
              Why it matters
            </a>
            <a
              className="lp-mobile-nav__link"
              href="#about-sources"
              onClick={closeMobileMenu}
            >
              About
            </a>
            <Link
              to="/dashboard"
              className="lp-mobile-nav__cta"
              onClick={closeMobileMenu}
            >
              Open dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="lp-hero" aria-labelledby="hero-heading">
          <div className="lp-container lp-hero__grid">
            <BlurFade className="lp-hero__copy">
              <h1 id="hero-heading" className="lp-hero__title">
                How well does AI understand accented English?
              </h1>
              <p className="lp-hero__lede">
                We study English speech recognition alongside Mississauga language data and a 311 clarification demo.
              </p>
              <div className="lp-hero__actions">
                <ShimmerButton to="/dashboard">
                  <span>Open dashboard</span>
                  <ArrowUpRight className="lp-icon" aria-hidden="true" />
                </ShimmerButton>
                <a href="#about-sources" className="lp-text-link">
                  Read the sources
                </a>
              </div>
            </BlurFade>

            <div className="lp-hero__brand-card">
              <div className="lp-hero__logo-frame">
                <img
                  src="/brand/lapeace-logo.png"
                  alt="LaPeace dove and speech-wave mark"
                  width={1536}
                  height={1024}
                  className="lp-hero__logo-img"
                />
              </div>
              <p className="lp-hero__brand-caption">
                A Sheridan Datathon study using English recordings from the Speech Accent Archive.
              </p>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="lp-section lp-section--tinted" aria-labelledby="how-heading">
          <div className="lp-container">
            <div className="lp-section__head-split">
              <h2 id="how-heading" className="lp-section__title">
                Explore the research.
              </h2>
              <p className="lp-section__lead">
                How the study connects speech recognition to local services.
              </p>
            </div>

            <BentoGrid aria-label="Voice access evidence and context modules">
              <BentoCard
                name="Compare the words"
                description="The study compares English recordings with ElevenLabs Scribe transcripts."
                Icon={AudioLines}
                className="lp-bento-card--dominant"
              >
                <figure
                  className="lp-utterance-stage"
                  aria-label="Interactive reference passage inspector from the Speech Accent Archive"
                >
                  <div className="lp-utterance-stage__header">
                    <span className="lp-utterance-stage__title">
                      One shared reference passage
                    </span>
                    <span className="lp-utterance-stage__note">
                      Illustrative waveform
                    </span>
                  </div>

                  <div
                    className="lp-utterance-stage__passage"
                    role="group"
                    aria-label="Select a sentence from the reference passage"
                  >
                    {STELLA_SEGMENTS.map((segment) => {
                      const isSelected = segment.id === activeSegment.id;
                      return (
                        <button
                          key={segment.id}
                          type="button"
                          className={`lp-utterance-segment ${isSelected ? 'is-selected' : ''}`}
                          aria-pressed={isSelected}
                          aria-label={`${segment.label}. ${segment.phrase}`}
                          onClick={() => setSelectedSegmentId(segment.id)}
                        >
                          <span className="lp-utterance-segment__text">{segment.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <blockquote className="lp-reference-quote" aria-live="polite">
                    {activeSegment.id === 'stella-call' ? 'Please call Stella.' : activeSegment.phrase}
                  </blockquote>

                  <div className="lp-utterance-stage__geometry" aria-hidden="true">
                    <svg
                      className="lp-sound-svg"
                      viewBox="0 0 360 64"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      {activeSegment.bars.map((heightPct, idx) => {
                        const barHeight = Math.round((heightPct / 100) * 52);
                        const y = Math.round((64 - barHeight) / 2);
                        const x = idx * 20 + 4;
                        return (
                          <rect
                            key={idx}
                            x={x}
                            y={y}
                            width="8"
                            height={barHeight}
                            rx="4"
                            className={idx % 3 === 0 ? 'lp-sound-bar--accent' : 'lp-sound-bar'}
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <dl className="lp-utterance-stage__inspector">
                    <div className="lp-inspector-row">
                      <dt>Listen for</dt>
                      <dd>{activeSegment.acousticFocus}</dd>
                    </div>
                    <div className="lp-inspector-row">
                      <dt>Compare</dt>
                      <dd>{activeSegment.transcriptDetail}</dd>
                    </div>
                    <div className="lp-inspector-row">
                      <dt>Why it matters</dt>
                      <dd>{activeSegment.civicContext}</dd>
                    </div>
                  </dl>

                  <figcaption className="lp-utterance-stage__caption">
                    Supplied reference passage; actual speaker readings may vary. Waveform is illustrative, not a live or measured audio signal.
                  </figcaption>
                </figure>
              </BentoCard>

              <BentoCard
                name="Language in Mississauga"
                description="The 2021 Census describes home-language use across 11 Mississauga wards."
                Icon={MapPin}
                className="lp-bento-card--supporting"
              >
                <div className="lp-bento-meta">
                  <p className="lp-bento-meta__note">
                    These counts describe the community. They do not measure how accurately an AI transcribes English.
                  </p>
                </div>
              </BentoCard>

              <BentoCard
                name="Confirm the request"
                description="The scripted 311 demo asks a caller to confirm uncertain details."
                Icon={MessageSquareCheck}
                className="lp-bento-card--supporting lp-bento-card--teal"
              >
                <div className="lp-bento-steps" aria-label="Clarification sequence">
                  <div className="lp-bento-steps__item">
                    <span className="lp-bento-steps__label">Initial intake</span>
                    <span className="lp-bento-steps__desc">Record the request and identify unclear details.</span>
                  </div>
                  <div className="lp-bento-steps__item">
                    <span className="lp-bento-steps__label">Read-back check</span>
                    <span className="lp-bento-steps__desc">Read the details back so the resident can correct them.</span>
                  </div>
                </div>
              </BentoCard>
            </BentoGrid>
          </div>
        </section>

        <section id="why-it-matters" className="lp-section" aria-labelledby="why-heading">
          <div className="lp-container lp-editorial-split">
            <div className="lp-editorial-split__head">
              <h2 id="why-heading" className="lp-section__title">
                A transcript needs context.
              </h2>
              <p className="lp-section__lead">
                Listen to each recording before deciding whether the transcript is wrong.
              </p>
              <a href="#about-sources" className="lp-btn lp-btn--secondary">
                <span>Read the sources</span>
                <ArrowDown className="lp-icon" aria-hidden="true" />
              </a>
            </div>

            <dl className="lp-ledger">
              <div className="lp-ledger__row">
                <dt className="lp-ledger__term">Check the spoken words</dt>
                <dd className="lp-ledger__desc">
                  Speakers read a shared English passage, but may change a word. Check the recording against the reference before counting a transcription error.
                </dd>
              </div>
              <div className="lp-ledger__row">
                <dt className="lp-ledger__term">Keep the measures separate</dt>
                <dd className="lp-ledger__desc">
                  A speaker's first language and the language they speak in a recording are different facts. Census home-language counts add local context. They are not transcription scores.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section id="about-sources" className="lp-section lp-section--tinted" aria-labelledby="sources-heading">
          <div className="lp-container">
            <div className="lp-section__head-split">
              <h2 id="sources-heading" className="lp-section__title">
                Where the data comes from.
              </h2>
              <p className="lp-section__lead">
                The study uses archive recordings, transcription tools and census data.
              </p>
            </div>

            <div className="lp-sources-table" role="region" aria-label="Dataset and tool provenance">
              <div className="lp-sources-table__row">
                <div className="lp-sources-table__name">Speech Accent Archive</div>
                <div className="lp-sources-table__detail">
                  George Mason University's English recordings. Audio: CC BY-NC-SA 4.0.
                </div>
                <div className="lp-sources-table__action">
                  <a
                    href="https://accent.gmu.edu"
                    target="_blank"
                    rel="noreferrer"
                    className="lp-external-link"
                  >
                    <span>accent.gmu.edu</span>
                    <ArrowUpRight className="lp-icon" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="lp-sources-table__row">
                <div className="lp-sources-table__name">Transcription evaluation</div>
                <div className="lp-sources-table__detail">
                  Scribe v2 transcripts, with separate Whisper comparisons on a selected subset.
                </div>
                <div className="lp-sources-table__action">
                  <a
                    href="https://elevenlabs.io"
                    target="_blank"
                    rel="noreferrer"
                    className="lp-external-link"
                  >
                    <span>elevenlabs.io</span>
                    <ArrowUpRight className="lp-icon" aria-hidden="true" />
                  </a>
                </div>
              </div>

              <div className="lp-sources-table__row">
                <div className="lp-sources-table__name">2021 Census of Population</div>
                <div className="lp-sources-table__detail">
                  Mississauga home-language counts, kept separate from recognition scores.
                </div>
                <div className="lp-sources-table__action">
                  <span>Mississauga ward profiles</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer__inner">
          <div className="lp-footer__brand">
            <Link to="/" className="lp-footer__logo-link" aria-label="LaPeace home">
              <span className="lp-footer__logo-frame" aria-hidden="true">
                <img
                  src="/brand/lapeace-logo.png"
                  alt=""
                  width={1536}
                  height={1024}
                  className="lp-footer__logo-img"
                />
              </span>
            </Link>
            <p className="lp-footer__note">
              A Sheridan Datathon project exploring voice access in Mississauga.
            </p>
          </div>

          <nav className="lp-footer__nav" aria-label="Footer navigation">
            <a href="#how-it-works" className="lp-footer__link">
              How it works
            </a>
            <a href="#why-it-matters" className="lp-footer__link">
              Why it matters
            </a>
            <a href="#about-sources" className="lp-footer__link">
              Sources
            </a>
            <a href="#top" className="lp-footer__link">
              Back to top
            </a>
            <Link to="/dashboard" className="lp-footer__link">Open dashboard</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default HomePage;
