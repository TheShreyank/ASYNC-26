"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft, Flame, TrendingUp, Calendar as CalendarIcon } from 'lucide-react';
import { useSession } from "next-auth/react";

export default function ProgressPage() {
  const { data: session } = useSession();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      try {
        const res = await fetch('/api/progress');
        const json = await res.json();
        if (json.chartData) {
          setData(json.chartData);
        }
      } catch(err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchProgress();
  }, []);

  return (
    <div className="wrap" style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
      <header className="top" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-color)' }}>
          <ArrowLeft size={20} />
          <span style={{ fontWeight: '600' }}>Back to Dashboard</span>
        </Link>
        <div className="brand" style={{ marginLeft: 'auto' }}>
          <span className="wordmark">
            <span className="a">Casual</span>
            <span className="b">Health</span>
          </span>
        </div>
      </header>

      <div style={{ marginTop: '40px' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', fontWeight: '800' }}>Your Progress</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
          Track your consistency and watch your habits grow over time.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <div style={{ background: 'rgba(255, 107, 107, 0.1)', padding: '16px', borderRadius: '50%' }}>
              <Flame size={32} color="#ff6b6b" />
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Current Streak</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>7 Days</div>
            </div>
          </div>
          
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '16px', borderRadius: '50%' }}>
              <TrendingUp size={32} color="#38bdf8" />
            </div>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Habits Completed</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{data.reduce((acc, curr) => acc + curr.completed, 0)}</div>
            </div>
          </div>
        </div>

        <section className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <CalendarIcon size={20} color="var(--leaf)" />
            <h2 style={{ fontSize: '20px', margin: 0 }}>Weekly Consistency</h2>
          </div>
          
          {loading ? (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Loading chart data...</span>
            </div>
          ) : (
            <div style={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333333" />
                  <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333333', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="completed" fill="#10b981" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
