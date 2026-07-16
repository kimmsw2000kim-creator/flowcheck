import React from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { UIUXTestScores } from '../../api/UIUXTestApi';

interface UIUXScoreRadarChartProps {
  scores: UIUXTestScores;
}

const brandColor = 'var(--color-action-primary)';
const neutralGridColor = 'var(--color-border-default)';
const neutralTextColor = 'var(--color-text-secondary)';

function renderAngleTick({ x, y, textAnchor, index, payload }: any) {
  const adjustedY = index === 0 ? Number(y) - 12 : index === 2 || index === 3 ? Number(y) + 10 : Number(y);

  return (
    <text x={x} y={adjustedY} textAnchor={textAnchor} className="uiux-radar-axis-label">
      <tspan>{payload.value}</tspan>
    </text>
  );
}

export default function UIUXScoreRadarChart({ scores }: UIUXScoreRadarChartProps) {
  const data = [
    { subject: '사용성', score: scores.usability },
    { subject: '접근성', score: scores.accessibility },
    { subject: '탐색 효율', score: scores.efficiency },
    { subject: '성능', score: scores.performance },
    { subject: '기술 품질', score: scores.bestPractices ?? 0 },
  ];

  const overall = scores.overall ?? Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length);

  return (
    <div className="uiux-score-chart">
      <div className="uiux-score-chart-header">
        <div>
          <span className="uiux-eyebrow">Overview</span>
          <h3>종합 균형 지표</h3>
          <p>자동 분석 도구와 실제 브라우저 탐색 결과를 함께 반영합니다.</p>
        </div>
        <div className="uiux-score-average">
          <span>종합</span>
          <strong>{overall}점</strong>
        </div>
      </div>

      <div className="uiux-score-chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart
            cx="50%"
            cy="50%"
            outerRadius="72%"
            data={data}
            margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <PolarGrid stroke={neutralGridColor} radialLines />
            <PolarAngleAxis
              dataKey="subject"
              tick={renderAngleTick}
              tickLine={false}
              axisLine={false}
              stroke={neutralTextColor}
            />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: brandColor, strokeWidth: 2 }}
              formatter={(value: number) => [`${value}점`, '점수']}
              labelStyle={{ color: 'var(--color-text-primary)', fontWeight: 700 }}
              contentStyle={{
                border: '1px solid var(--color-border-default)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface)',
                boxShadow: 'var(--shadow-raised)',
                color: 'var(--color-text-primary)',
              }}
            />
            <Radar
              isAnimationActive={false}
              name="UI/UX Score"
              dataKey="score"
              stroke={brandColor}
              strokeWidth={2}
              strokeLinejoin="round"
              fill={brandColor}
              fillOpacity={0.18}
              activeDot={{ fill: 'var(--color-bg-surface)', stroke: brandColor, strokeWidth: 2, r: 4 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
