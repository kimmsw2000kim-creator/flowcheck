import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { UIUXTestScores } from '../../api/UIUXTestApi';

interface UIUXScoreBarChartProps {
  scores: UIUXTestScores;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'];

export default function UIUXScoreBarChart({ scores }: UIUXScoreBarChartProps) {
  const data = [
    { name: '사용성', score: scores.usability },
    { name: '접근성', score: scores.accessibility },
    { name: '효율성', score: scores.efficiency },
    { name: '성능', score: scores.performance },
  ];

  return (
    <div style={{ width: '100%', height: '350px', backgroundColor: 'var(--bg-secondary)', borderRadius: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>세부 지표 스코어 (Bar Distribution)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 13, fontWeight: 700 }} />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={28}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
            <LabelList dataKey="score" position="right" fill="var(--text-primary)" fontWeight={700} formatter={(val: number) => `${val}점`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
