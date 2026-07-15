import React from 'react';
import { UIUXTestScores } from '../../api/UIUXTestApi';

interface UIUXScoreBarChartProps {
  scores: UIUXTestScores;
}

export default function UIUXScoreBarChart({ scores }: UIUXScoreBarChartProps) {
  const data = [
    { name: '사용성', score: scores.usability },
    { name: '접근성', score: scores.accessibility },
    { name: '탐색 효율', score: scores.efficiency },
    { name: '성능', score: scores.performance },
    { name: '기술 품질', score: scores.bestPractices ?? 0 },
  ];

  const overall = scores.overall ?? Math.round(data.reduce((sum, item) => sum + item.score, 0) / data.length);

  return (
    <div className="uiux-score-chart uiux-score-chart-pure">
      <div className="uiux-score-chart-header">
        <div>
          <span className="uiux-eyebrow">Metrics</span>
          <h3>세부 지표 스코어</h3>
          <p>Lighthouse, axe-core, Playwright 규칙 기반 점수입니다.</p>
        </div>
        <div className="uiux-score-average">
          <span>종합</span>
          <strong>{overall}점</strong>
        </div>
      </div>

      <div className="uiux-pure-bars" aria-label="세부 지표 스코어 막대 그래프">
        {data.map((item) => (
          <div className="uiux-pure-bar-row" key={item.name}>
            <span className="uiux-pure-bar-label">{item.name}</span>
            <div className="uiux-pure-bar-track" aria-hidden="true">
              <span className="uiux-pure-bar-fill" style={{ width: `${Math.max(0, Math.min(item.score, 100))}%` }} />
            </div>
            <strong className="uiux-pure-bar-value">{item.score}점</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
