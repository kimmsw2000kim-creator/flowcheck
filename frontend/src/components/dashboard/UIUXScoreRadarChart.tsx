import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { UIUXTestScores } from '../../api/UIUXTestApi';

interface UIUXScoreRadarChartProps {
  scores: UIUXTestScores;
}

export default function UIUXScoreRadarChart({ scores }: UIUXScoreRadarChartProps) {
  const data = [
    {
      subject: '사용성 (Usability)',
      A: scores.usability,
      fullMark: 100,
    },
    {
      subject: '접근성 (Accessibility)',
      A: scores.accessibility,
      fullMark: 100,
    },
    {
      subject: '효율성 (Efficiency)',
      A: scores.efficiency,
      fullMark: 100,
    },
    {
      subject: '성능 (Performance)',
      A: scores.performance,
      fullMark: 100,
    },
  ];

  return (
    <div style={{ width: '100%', height: '350px', backgroundColor: 'var(--bg-secondary)', borderRadius: '1rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', alignSelf: 'flex-start' }}>종합 밸런스 지표 (Radar)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)' }}
            itemStyle={{ color: 'var(--accent)' }}
          />
          <Radar name="AI Score" dataKey="A" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.4} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
