'use client';
import { useState } from 'react';
import Image from 'next/image';
import AudioRecorder from '@/components/AudioRecorder';
import { Check, Plus, Sparkles, Sun, Moon } from 'lucide-react';

const RING_RADIUS = 86;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const LEAF_PATH =
  'M88 6C50 8 18 30 14 66c-1 9 1 18 6 26 2-14 8-27 20-38 10-9 22-14 36-16-16 6-28 16-36 32 34 6 58-14 62-48 1-8 0-14-2-16-4-1-8 0-12 0z';

export default function Dashboard() {
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
    } catch (err) {
      setAnalysisError(err.message || 'Could not analyze this check-in.');
    } finally {
      setAnalyzing(false);
    }
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
        <div className="top-actions">
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
    </div>
  );
}