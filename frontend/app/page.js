'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import AudioRecorder from '@/components/AudioRecorder';
import { Check, Plus, Sparkles, Sun, Moon, Volume2, Square, Bell } from 'lucide-react';
import { signIn, signOut, useSession } from 'next-auth/react';

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

  useEffect(() => {
    if (session) {
      syncCalendar();
    }
  }, [session]);

  const syncCalendar = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/calendar/sync');
      const data = await res.json();
      if (data.events) {
        setCalendarEvents(data.events);
        
        // Push notification logic for upcoming events
        const now = new Date();
        data.events.forEach(event => {
          const startTime = new Date(event.start);
          const timeDiffMins = (startTime - now) / 1000 / 60;
          
          // If event is starting in the next 30 mins
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
    // 1. Automatically tick off if the event end time has passed
    if (new Date() > new Date(event.end)) return true;
    
    // 2. Automatically tick off if the user mentioned the event in their voice check-ins today
    const eventWords = event.summary.toLowerCase().split(' ').filter(w => w.length > 3);
    const spoken = logs.some(log => {
      const logText = log.text.toLowerCase();
      // If the log contains a significant word from the event title, consider it spoken about
      return eventWords.some(word => logText.includes(word));
    });
    
    return spoken;
  };

  const completedCount = habits.filter((habit) => habit.completed).length;
  const ringOffset = RING_LENGTH * (1 - completedCount / (habits.length || 1));

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
      if (!response.ok) {
        throw new Error(result.error || 'Could not analyze this check-in.');
      }

      const completedNames = new Set(result.completedHabits);
      setHabits((currentHabits) => currentHabits.map((habit) => ({
        ...habit,
        completed: completedNames.has(habit.name),
      })));
      setSummary({ text: result.cumulativeSummary });

      if (result.partialHabits && Array.isArray(result.partialHabits) && result.partialHabits.length > 0) {
        console.log("Partial habits detected for notification:", result.partialHabits);
        result.partialHabits.forEach(ph => {
          const notifId = Date.now() + Math.random();
          setInAppNotifications(prev => [...prev, { id: notifId, title: ph.name, message: ph.message, fading: false }]);
          
          // Start fade-out after 10 seconds
          setTimeout(() => {
            setInAppNotifications(prev => prev.map(n => n.id === notifId ? { ...n, fading: true } : n));
          }, 10000);

          // Remove after 12 seconds (2s for fade animation)
          setTimeout(() => {
            setInAppNotifications(prev => prev.filter(n => n.id !== notifId));
          }, 12000);
        });
      } else {
        console.log("No partial habits detected. Full AI result:", result);
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
      if (!response.ok) {
        throw new Error(result.error || 'Could not generate daily review.');
      }
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

  return (
    <div className="wrap">
      {/* Top bar */}
      <header className="top">
        <div className="brand">
          <Image src="/casualhealth-minilogo.png" alt="CasualHealth mini logo" width={75} height={75} priority />
          <span className="wordmark">
            <span className="a">Casual</span>
            <span className="b">Health</span>
          </span>
        </div>
        <div className="top-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{session.user.name}</span>
              <button 
                type="button" 
                onClick={() => signOut()}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--leaf)', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', color: 'var(--leaf)', cursor: 'pointer' }}
              >
                Sign out
              </button>
            </div>
          ) : (
            <button 
              type="button"
              onClick={() => signIn('google')}
              style={{ background: 'var(--leaf)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path></svg>
              Connect Calendar
            </button>
          )}
          <span className="pill">Beta</span>
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label="Switch light or dark theme"
          >
            <Sun className="sun" />
            <Moon className="moon" />
          </button>
        </div>
      </header>

      {/* Hero: check-in + progress ring */}
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
        <div
          className="ring-wrap"
          role="img"
          aria-label={`${completedCount} of ${habits.length} habits completed`}
        >
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle className="ring-track" cx="100" cy="100" r={RING_RADIUS} />
            <circle
              className="ring-bar"
              cx="100"
              cy="100"
              r={RING_RADIUS}
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

      <div className="grid">
        {/* Habits */}
        <section className="card" aria-labelledby="h-habits">
          <h2 id="h-habits">Today&apos;s habits</h2>
          <p className="sub">
            Add what you want to do today. Say it in your check-in and it gets ticked off.
          </p>
          <form className="add" onSubmit={addHabit}>
            <input
              type="text"
              placeholder="Add a habit, like “Read 20 pages”"
              aria-label="New habit"
              maxLength={80}
              autoComplete="off"
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
            />
            <button
              type="submit"
              aria-label="Add habit"
              title="Add habit"
              disabled={!newHabit.trim()}
            >
              <Plus strokeWidth={2.4} />
            </button>
          </form>

          <ul className="habits">
            {habits.map((habit) => (
              <li key={habit.id} className={`habit${habit.completed ? ' done' : ''}`}>
                <span className="tick">
                  <Check strokeWidth={3} />
                </span>
                <span className="name">{habit.name}</span>
                <span className="status">{habit.completed ? 'Done' : 'Not yet'}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Calendar Events (New) */}
        {session && (
          <section className="card" aria-labelledby="calendar-title" style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 id="calendar-title">Google Calendar Events</h2>
              {isSyncing ? (
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Syncing...</span>
              ) : (
                <button onClick={syncCalendar} style={{ fontSize: '13px', color: 'var(--leaf)', cursor: 'pointer', background: 'none', border: 'none' }}>
                  Refresh
                </button>
              )}
            </div>
            
            {calendarEvents.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{isSyncing ? 'Loading today\'s events...' : 'No events scheduled for today.'}</p>
            ) : (
              <ul className="habits">
                {calendarEvents.map((event, idx) => {
                  const completed = isEventCompleted(event);
                  return (
                    <li key={event.id || idx} className={`habit${completed ? ' done' : ''}`}>
                      <span className="tick">
                        <Check strokeWidth={3} />
                      </span>
                      <span className="name" style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{event.summary}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                          {new Date(event.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(event.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

        <div className="col">
          {/* Summary */}
          <section className="card summary" aria-labelledby="h-sum">
            <h2 id="h-sum">
              <Sparkles aria-hidden="true" /> Your day so far
            </h2>
            {analysisError && (
              <p role="alert" className="err-text">
                {analysisError}
              </p>
            )}
            {analyzing ? (
              <div className="working" role="status">
                <span className="spin" aria-hidden="true" /> Reading your check-in&hellip;
              </div>
            ) : summary ? (
              <div>
                <p className="text">{summary.text}</p>
                <span className="chip">
                  {completedCount} of {habits.length} habits done
                </span>
                <p className="note">Habits are ticked from what you say. Worth a quick check.</p>
              </div>
            ) : (
              <p className="empty">Record a check-in and your summary will show up here.</p>
            )}
          </section>

          {/* Transcripts */}
          <section className="card" aria-labelledby="h-logs">
            <h2 id="h-logs">Today&apos;s check-ins</h2>
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
                      <time>
                        {log.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </time>
                      &ldquo;{log.text}&rdquo;
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>



          {/* Overall Daily Review */}
          <section className="card summary" aria-labelledby="h-review">
            <h2 id="h-review">
              <Sparkles aria-hidden="true" /> Overall Daily Review
            </h2>
            {reviewError && (
              <p role="alert" className="err-text">
                {reviewError}
              </p>
            )}
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
                <button
                  type="button"
                  className="btn btn-hero"
                  onClick={handleGenerateReview}
                >
                  Generate Daily Review
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Footer */}
      <footer className="site-foot">
        <svg className="leafbg" viewBox="0 0 100 100" aria-hidden="true">
          <path fill="currentColor" d={LEAF_PATH} />
        </svg>
        <div className="foot-inner">
          <div className="foot-brand">
            <Image src="/casualhealth-minilogo.png" alt="CasualHealth mini logo" width={90} height={90} />
            <div className="foot-wordmark">
              <span className="w1">Casual</span>
              <span className="w2">Health</span>
            </div>
            <div className="foot-tagline">Small habits. Bigger you.</div>
          </div>
          <div className="foot-divider" aria-hidden="true" />
          <div className="foot-text">
            <div className="foot-by">Built by</div>
            <p className="foot-team">
              Junction<span>Junkers</span>
            </p>
            <div className="foot-rule" aria-hidden="true" />
            <p className="foot-event">ASYNC 2026</p>
            <p className="foot-track">Wellness and Lifestyle track</p>
          </div>
        </div>
      </footer>
      {/* In-App Toast Notifications */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 9999 }}>
        {inAppNotifications.map(notification => (
          <div
            key={notification.id}
            className={`toast-notification ${notification.fading ? 'toast-fade-out' : 'toast-slide-in'}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Bell size={24} color="var(--leaf)" />
              <strong style={{ color: 'var(--text-color)', fontSize: '18px' }}>Keep going! 💪</strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', margin: 0, lineHeight: 1.5 }}>{notification.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}