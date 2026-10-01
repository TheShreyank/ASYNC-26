'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import AudioRecorder from '@/components/AudioRecorder';
import CameraBox from '@/components/CameraBox';
import { Check, Plus, Sparkles, Sun, Moon, Volume2, Square, Bell } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import confetti from 'canvas-confetti';

const RING_RADIUS = 86;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const LEAF_PATH =
  'M88 6C50 8 18 30 14 66c-1 9 1 18 6 26 2-14 8-27 20-38 10-9 22-14 36-16-16 6-28 16-36 32 34 6 58-14 62-48 1-8 0-14-2-16-4-1-8 0-12 0z';

export default function Dashboard() {
  const { data: session } = useSession();

  const [habits, setHabits] = useState([
    { id: 1, name: 'Wake up at 6 a.m.', completed: false },
    { id: 2, name: 'Finish 10k steps', completed: false },
    { id: 3, name: 'Go to the gym', completed: false },
    { id: 4, name: 'Sleep at 10 p.m.', completed: false },
  ]);

  const [newHabit, setNewHabit] = useState('');
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [dailyReview, setDailyReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [isPlayingReview, setIsPlayingReview] = useState(false);
  const [inAppNotifications, setInAppNotifications] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSection, setActiveSection] = useState('habits');
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (session) {
      syncCalendar();
    }
  }, [session]);

  // Track which section is in view for the nav highlight
  useEffect(() => {
    const sections = ['habits', 'calendar', 'instants', 'timeline', 'review'];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setDrawerOpen(false);
  };

  const syncCalendar = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync');
      const data = await res.json();
      if (data.events) {
        setCalendarEvents(data.events);
        const now = new Date();
        data.events.forEach(event => {
          const startTime = new Date(event.start);
          const timeDiffMins = (startTime - now) / 1000 / 60;
          if (timeDiffMins > 0 && timeDiffMins <= 30) {
            const notifId = Date.now() + Math.random();
            setInAppNotifications(prev => [...prev, {
              id: notifId,
              title: 'Upcoming Event',
              message: `Your Google Calendar event "${event.summary}" starts in ${Math.round(timeDiffMins)} minutes!`,
              fading: false
            }]);
            setTimeout(() => {
              setInAppNotifications(prev => prev.map(n => n.id === notifId ? { ...n, fading: true } : n));
            }, 10000);
            setTimeout(() => {
              setInAppNotifications(prev => prev.filter(n => n.id !== notifId));
            }, 12000);
          }
        });
      }
    } catch (err) {
      console.error("Failed to sync calendar", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const isEventCompleted = (event) => {
    if (new Date() > new Date(event.end)) return true;
    const eventWords = event.summary.toLowerCase().split(' ').filter(w => w.length > 3);
    return logs.some(log => {
      const logText = log.text.toLowerCase();
      return eventWords.some(word => logText.includes(word));
    });
  };

  const completedCount = habits.filter((habit) => habit.completed).length;
  const ringOffset = RING_LENGTH * (1 - completedCount / (habits.length || 1));

  useEffect(() => {
    if (habits.length > 0 && completedCount === habits.length) {
      let leafShape;
      try {
        leafShape = confetti.shapeFromPath({ path: LEAF_PATH });
      } catch (e) {
        // Fallback if shapeFromPath is not supported
      }
      
      confetti({
        particleCount: 120,
        spread: 120,
        origin: { y: 0.5 },
        colors: ['#4caf50', '#81c784', '#388e3c', '#2e7d32', '#1b5e20', '#aed581'],
        shapes: leafShape ? [leafShape] : ['circle'],
        scalar: leafShape ? 3 : 1.2,
        ticks: 300,
        gravity: 0.8,
        drift: 0.2,
      });
    }
  }, [completedCount, habits.length]);

  const toggleTheme = () => {
    const root = document.documentElement;
    let current = root.getAttribute('data-theme');
    if (!current) {
      current = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark');
  };

  const addHabit = (e) => {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setHabits((currentHabits) => [
      ...currentHabits,
      { id: Date.now(), name, completed: false },
    ]);
    setNewHabit('');
  };

  const handleTranscript = async (newTranscript) => {
    const updatedLogs = [...logs, { text: newTranscript, time: new Date() }];
    setLogs(updatedLogs);
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const habitNames = habits.map((h) => h.name);
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habits: habitNames, logs: updatedLogs.map((l) => l.text) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not analyze this check-in.');
      const completedNames = new Set(result.completedHabits);
      setHabits((currentHabits) => currentHabits.map((habit) => ({
        ...habit,
        completed: completedNames.has(habit.name),
      })));
      setSummary({ text: result.cumulativeSummary });
      if (result.partialHabits && Array.isArray(result.partialHabits) && result.partialHabits.length > 0) {
        result.partialHabits.forEach(ph => {
          const notifId = Date.now() + Math.random();
          setInAppNotifications(prev => [...prev, { id: notifId, title: ph.name, message: ph.message, fading: false }]);
          setTimeout(() => {
            setInAppNotifications(prev => prev.map(n => n.id === notifId ? { ...n, fading: true } : n));
          }, 10000);
          setTimeout(() => {
            setInAppNotifications(prev => prev.filter(n => n.id !== notifId));
          }, 12000);
        });
      }
    } catch (err) {
      setAnalysisError(err.message || 'Could not analyze this check-in.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateReview = async () => {
    if (logs.length === 0) {
      setReviewError('Please record at least one check-in before generating a daily review.');
      return;
    }
    setIsReviewing(true);
    setReviewError('');
    try {
      const response = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logs: logs.map((l) => ({
            time: l.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
            text: l.text
          })),
          habits: habits.map((h) => ({ name: h.name, completed: h.completed }))
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not generate daily review.');
      setDailyReview(result.dailyReview);
    } catch (err) {
      setReviewError(err.message || 'Could not generate daily review.');
    } finally {
      setIsReviewing(false);
    }
  };

  const playReview = () => {
    if (!dailyReview) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(dailyReview);
    utterance.rate = 1.5;
    utterance.onend = () => setIsPlayingReview(false);
    utterance.onerror = () => setIsPlayingReview(false);
    setIsPlayingReview(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopReview = () => {
    window.speechSynthesis.cancel();
    setIsPlayingReview(false);
  };

  const navLinks = [
    { id: 'habits', label: 'Habits' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'instants', label: 'Instants' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'review', label: 'Review' },
  ];

  return (
    <div className="wrap">
      {/* ── Top nav bar ── */}
      <header className="top">
        <div className="brand">
          <Image src="/casualhealth-minilogo.png" alt="CasualHealth mini logo" width={75} height={75} priority />
          <span className="wordmark">
            <span className="a">Casual</span>
            <span className="b">Health</span>
          </span>
        </div>

        {/* Hamburger button — visible on mobile only */}
        <button
          type="button"
          className={`hamburger-btn${drawerOpen ? ' open' : ''}`}
          onClick={() => setDrawerOpen(o => !o)}
          aria-label="Open navigation menu"
        >
          <span /><span /><span />
        </button>

        {/* Inline nav links — visible on desktop only */}
        <nav className="dash-nav" aria-label="Page sections">
          {navLinks.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className={`dash-nav-link${activeSection === id ? ' active' : ''}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="top-actions">
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>{session.user.name}</span>
              <Link
                href="/progress"
                style={{ background: 'var(--leaf)', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', color: 'white', cursor: 'pointer', textDecoration: 'none', fontWeight: '700' }}
              >
                Progress
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', color: 'var(--ink-2)', cursor: 'pointer' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => signIn('google')}
              style={{ background: 'var(--leaf)', color: 'white', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontWeight: '700' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path></svg>
              Sign in with Google
            </button>
          )}
          <span className="pill">Beta</span>
          <button type="button" className="icon-btn" onClick={toggleTheme} aria-label="Switch theme">
            <Sun className="sun" /><Moon className="moon" />
          </button>
        </div>
      </header>

      {/* ── Mobile drawer ── */}
      <div
        className={`mobile-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <nav className={`mobile-drawer${drawerOpen ? ' open' : ''}`} aria-label="Mobile navigation">
        <p className="mobile-drawer-title">Navigation</p>
        {navLinks.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollTo(id)}
            className={`mobile-drawer-link${activeSection === id ? ' active' : ''}`}
          >
            {label}
          </button>
        ))}
        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
          {session ? (
            <>
              <div style={{ fontSize: '13px', color: 'var(--ink-2)', padding: '0 8px 12px' }}>{session.user.name}</div>
              <button
                type="button"
                onClick={() => signOut()}
                className="mobile-drawer-link"
                style={{ color: 'var(--coral)' }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button type="button" onClick={() => signIn('google')} className="mobile-drawer-link">
              Sign in with Google
            </button>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero" aria-labelledby="hero-title">
        <svg className="leafbg" viewBox="0 0 100 100" aria-hidden="true">
          <path fill="currentColor" d={LEAF_PATH} />
        </svg>
        <div className="hero-copy">
          <p className="date" suppressHydrationWarning>
            {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 id="hero-title">Small habits. Bigger you.</h1>
          <p className="lede">
            Talk through your day out loud. CasualHealth listens, ticks off the habits you
            mentioned, and sums up how it went.
          </p>
          <AudioRecorder onTranscriptReceived={handleTranscript} />
        </div>
        <div className="ring-wrap" role="img" aria-label={`${completedCount} of ${habits.length} habits completed`}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle className="ring-track" cx="100" cy="100" r={RING_RADIUS} />
            <circle
              className="ring-bar"
              cx="100" cy="100" r={RING_RADIUS}
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <div className="ring-label">
            <b>{completedCount}/{habits.length}</b>
            <span>habits completed</span>
          </div>
        </div>
      </section>

      {/* ── Scrollable sections ── */}
      <div className="dash-sections">

        {/* Section 1: Habits */}
        <section id="habits" className="card dash-section" aria-labelledby="h-habits">
          <h2 id="h-habits">Today&apos;s habits</h2>
          <p className="sub">Add what you want to do today. Say it in your check-in and it gets ticked off.</p>
          <form className="add" onSubmit={addHabit}>
            <input
              type="text"
              placeholder={'Add a habit, like \u201cRead 20 pages\u201d'}
              aria-label="New habit"
              maxLength={80}
              autoComplete="off"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
            />
            <button type="submit" aria-label="Add habit" title="Add habit" disabled={!newHabit.trim()}>
              <Plus strokeWidth={2.4} />
            </button>
          </form>
          <ul className="habits">
            {habits.map((habit) => (
              <li key={habit.id} className={`habit${habit.completed ? ' done' : ''}`}>
                <span className="tick"><Check strokeWidth={3} /></span>
                <span className="name">{habit.name}</span>
                <span className="status">{habit.completed ? 'Done' : 'Not yet'}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Section 2: Calendar */}
        {session && (
          <section id="calendar" className="card dash-section" aria-labelledby="calendar-title">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h2 id="calendar-title">Google Calendar Events</h2>
              {isSyncing ? (
                <span style={{ fontSize: '14px', color: 'var(--ink-2)' }}>Syncing…</span>
              ) : (
                <button onClick={syncCalendar} style={{ fontSize: '13px', fontWeight: '700', color: 'var(--leaf)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  Refresh
                </button>
              )}
            </div>
            <p className="sub">Your Google Calendar events for today. They auto-tick when the time passes or when you mention them.</p>
            {calendarEvents.length === 0 ? (
              <p className="empty">{isSyncing ? 'Loading today\'s events…' : 'No events scheduled for today.'}</p>
            ) : (
              <ul className="habits">
                {calendarEvents.map((event, idx) => {
                  const completed = isEventCompleted(event);
                  return (
                    <li key={event.id || idx} className={`habit${completed ? ' done' : ''}`}>
                      <span className="tick"><Check strokeWidth={3} /></span>
                      <span className="name" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{event.summary}</span>
                        <span style={{ fontSize: '12px', color: 'var(--ink-2)', fontWeight: 'normal' }}>
                          {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <span className="status">{completed ? 'Done' : 'Pending'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <CameraBox />

        {/* Section 3 + 4: Timeline — left col (Your day so far + Review), right col (Check-ins) */}
        <section id="timeline" className="dash-section" aria-labelledby="timeline-title">
          <h2 id="timeline-title" className="dash-section-label">Timeline</h2>
          <div className="timeline-grid">

            {/* Left column: Your day so far + Overall Daily Review stacked */}
            <div className="col">
              <div className="card summary">
                <h2 id="h-sum" style={{ marginBottom: '12px' }}>
                  <Sparkles aria-hidden="true" /> Your day so far
                </h2>
                {analysisError && <p role="alert" className="err-text">{analysisError}</p>}
                {analyzing ? (
                  <div className="working" role="status">
                    <span className="spin" aria-hidden="true" /> Reading your check-in&hellip;
                  </div>
                ) : summary ? (
                  <div>
                    <p className="text">{summary.text}</p>
                    <span className="chip">{completedCount} of {habits.length} habits done</span>
                    <p className="note">Habits are ticked from what you say. Worth a quick check.</p>
                  </div>
                ) : (
                  <p className="empty">Record a check-in and your summary will show up here.</p>
                )}
              </div>

              <div id="review" className="card summary" aria-labelledby="h-review" style={{ scrollMarginTop: '90px' }}>
                <h2 id="h-review" style={{ marginBottom: '12px' }}>
                  <Sparkles aria-hidden="true" /> Overall Daily Review
                </h2>
                {reviewError && <p role="alert" className="err-text">{reviewError}</p>}
                {isReviewing ? (
                  <div className="working" role="status">
                    <span className="spin" aria-hidden="true" /> Reviewing your entire day&hellip;
                  </div>
                ) : dailyReview ? (
                  <div>
                    <p className="text">{dailyReview}</p>
                    <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
                      {!isPlayingReview ? (
                        <button type="button" className="btn btn-hero" onClick={playReview} style={{ padding: '10px 16px', fontSize: '15px' }}>
                          <Volume2 size={18} /> Listen to Review
                        </button>
                      ) : (
                        <button type="button" className="btn btn-ghost" onClick={stopReview} style={{ padding: '10px 16px', fontSize: '15px', color: 'var(--coral)', borderColor: 'var(--coral)' }}>
                          <Square size={18} /> Stop Listening
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="sub" style={{ marginBottom: '16px' }}>
                      Get a comprehensive summary of your entire day based on all your check-ins.
                    </p>
                    <button type="button" className="btn btn-hero" onClick={handleGenerateReview}>
                      Generate Daily Review
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right column: Today's check-ins — stays compact, anchored top */}
            <div className="card" style={{ alignSelf: 'start' }}>
              <h2 id="h-logs" style={{ marginBottom: '12px' }}>Today&apos;s check-ins</h2>
              {logs.length === 0 ? (
                <p className="empty">Nothing yet. Your first check-in will appear here.</p>
              ) : (
                <details className="logs-accordion">
                  <summary className="logs-summary">
                    View {logs.length} check-in{logs.length > 1 ? 's' : ''}
                  </summary>
                  <ul className="logs">
                    {logs.map((log, i) => (
                      <li key={i}>
                        <time>{log.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                        &ldquo;{log.text}&rdquo;
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>

          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="site-foot">
        <svg className="leafbg" viewBox="0 0 100 100" aria-hidden="true">
          <path fill="currentColor" d={LEAF_PATH} />
        </svg>
        <div className="foot-inner">
          <div className="foot-brand">
            <Image src="/casualhealth-minilogo.png" alt="CasualHealth mini logo" width={90} height={90} />
            <div className="foot-wordmark"><span className="w1">Casual</span><span className="w2">Health</span></div>
            <div className="foot-tagline">Small habits. Bigger you.</div>
          </div>
          <div className="foot-divider" aria-hidden="true" />
          <div className="foot-text">
            <div className="foot-by">Built by</div>
            <p className="foot-team">Junction<span>Junkers</span></p>
            <div className="foot-rule" aria-hidden="true" />
            <p className="foot-event">ASYNC 2026</p>
            <p className="foot-track">Wellness and Lifestyle track</p>
          </div>
        </div>
      </footer>

      {/* ── Toast Notifications ── */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 9999 }}>
        {inAppNotifications.map(notification => (
          <div key={notification.id} className={`toast-notification ${notification.fading ? 'toast-fade-out' : 'toast-slide-in'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Bell size={24} color="var(--leaf)" />
              <strong style={{ color: 'var(--ink)', fontSize: '18px' }}>Keep going! 💪</strong>
            </div>
            <p style={{ color: 'var(--ink-2)', fontSize: '16px', margin: 0, lineHeight: 1.5 }}>{notification.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}