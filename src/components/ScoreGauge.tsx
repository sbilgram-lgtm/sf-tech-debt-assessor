import React from 'react';

interface ScoreGaugeProps {
  percentage: number;
  label: string;
  size?: 'small' | 'large';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ percentage, label, size = 'small' }) => {
  const radius = size === 'large' ? 80 : 50;
  const stroke = size === 'large' ? 12 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const svgSize = (radius + stroke) * 2;

  const getColor = () => {
    if (percentage >= 80) return '#27ae60';
    if (percentage >= 60) return '#f39c12';
    if (percentage >= 40) return '#d35400';
    return '#c0392b';
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke="#ecf0f1"
          strokeWidth={stroke}
        />
        <circle
          cx={radius + stroke}
          cy={radius + stroke}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div style={{ marginTop: -svgSize / 2 - (size === 'large' ? 15 : 10), position: 'relative' }}>
        <div style={{
          fontSize: size === 'large' ? '2.5rem' : '1.5rem',
          fontWeight: 'bold',
          color: getColor()
        }}>
          {percentage}%
        </div>
      </div>
      <div style={{
        marginTop: size === 'large' ? 40 : 25,
        fontSize: size === 'large' ? '1rem' : '0.85rem',
        color: '#7f8c8d',
        fontWeight: 500
      }}>
        {label}
      </div>
    </div>
  );
};
