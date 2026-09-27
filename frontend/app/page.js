'use client';
import { useState } from 'react';
import AudioRecorder from '@/components/AudioRecorder';
import { CheckCircle2, XCircle, Sparkles, PlusCircle, Loader2 } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';

export default function Dashboard() {
  const [habits, setHabits] = useState([
    { id: 1, name: 'Wake up at 6 a.m.', completed: false },
    { id: 2, name: 'Finish 10k steps', completed: false },
    { id: 3, name: 'Go to the gym.', completed: false },
    { id: 4, name: 'Sleep at 10 p.m.', completed: false },
  ]);

  const [newHabit, setNewHabit] = useState('');
  const [summary, setSummary] = useState(null);
  const [logs, setLogs] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  const addHabit = (e) => {
    e.preventDefault();
    if (!newHabit.trim()) return;
    setHabits([...habits, { id: Date.now(), name: newHabit, completed: false }]);
    setNewHabit('');
  };

  const handleTranscript = async (newTranscript) => {
    const updatedLogs = [...logs, newTranscript];
    setLogs(updatedLogs);
    setAnalyzing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY });
      const habitNames = habits.map((h) => h.name);

      const prompt = `
        You are an intelligent wellness & daily habit tracker AI.
        
        Target Daily Habits: ${JSON.stringify(habitNames)}
        
        All Audio Logs Recorded Today:
        ${updatedLogs.map((log, idx) => `${idx + 1}. "${log}"`).join('\n')}
        
        Tasks:
        1. Understand the full contextual meaning of the audio logs.
        2. Evaluate which target habits were actually completed or explicitly performed according to the logs.
        3. Write an encouraging, reflective daily summary synthesizeing the overall progress, tone, and efforts described across all logs today.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              completedHabits: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of habit names from target habits that were completed in the logs.',
              },
              cumulativeSummary: {
                type: Type.STRING,
                description: 'A thoughtful 2-3 sentence AI summary synthesizing the day based on all logs so far.',
              },
            },
            required: ['completedHabits', 'cumulativeSummary'],
          },
        },
      });

      const result = JSON.parse(response.text);

      // Update habit states based on semantic contextual analysis
      const updatedHabits = habits.map((h) => ({
        ...h,
        completed: result.completedHabits.includes(h.name),
      }));

      setHabits(updatedHabits);
      setSummary({
        text: result.cumulativeSummary,
        completedCount: result.completedHabits.length,
      });
    } catch (err) {
      console.error("AI Analysis Error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="max-w-5xl mx-auto mb-10 flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Junction Junkers</h1>
          <p className="text-slate-400 text-sm">ASYNC 2026 — Wellness & Lifestyle Track</p>
        </div>
        <span className="bg-indigo-500/10 text-indigo-400 text-xs px-3 py-1.5 rounded-full border border-indigo-500/20">
          MVP Prototype
        </span>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-white">Daily Target Habits</h2>
            
            <form onSubmit={addHabit} className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Add a new habit..."
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-indigo-500"
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 p-2 rounded-lg text-white">
                <PlusCircle size={20} />
              </button>
            </form>

            <ul className="space-y-2">
              {habits.map((habit) => (
                <li
                  key={habit.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-800"
                >
                  <span className="text-slate-200">{habit.name}</span>
                  {habit.completed ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <CheckCircle2 size={16} /> Done
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <XCircle size={16} /> Pending
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <AudioRecorder onTranscriptReceived={handleTranscript} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-800 to-indigo-950/40 border border-indigo-500/30 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2 text-indigo-300">
              <Sparkles className="text-indigo-400" /> Daily AI Summary
            </h2>
            {analyzing ? (
              <div className="flex items-center gap-2 text-indigo-400 text-sm py-4">
                <Loader2 size={18} className="animate-spin" /> Synthesizing cumulative logs with Gemini...
              </div>
            ) : summary ? (
              <div className="space-y-3">
                <p className="text-slate-300 leading-relaxed text-sm">{summary.text}</p>
                <div className="inline-block bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-medium">
                  Progress: {summary.completedCount} / {habits.length} Goals Completed
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-sm italic">
                Record an audio log to generate your AI daily synthesis.
              </p>
            )}
          </div>

          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl shadow-xl">
            <h2 className="text-xl font-bold mb-4 text-white">Today's Audio Transcripts</h2>
            {logs.length === 0 ? (
              <p className="text-slate-500 text-sm italic">No entries logged yet today.</p>
            ) : (
              <ul className="space-y-3">
                {logs.map((log, i) => (
                  <li key={i} className="p-3 bg-slate-900 rounded-lg text-slate-300 text-xs leading-relaxed border-l-2 border-indigo-500">
                    "{log}"
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}