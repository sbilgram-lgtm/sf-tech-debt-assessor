import React from 'react';
import { DebtItem } from '../types/assessment';

interface DebtItemCardProps {
  item: DebtItem;
}

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: '#fdf0ed', border: '#c0392b', text: '#c0392b' },
  high: { bg: '#fef5e7', border: '#d35400', text: '#d35400' },
  medium: { bg: '#fef9e7', border: '#f39c12', text: '#f39c12' },
  low: { bg: '#eafaf1', border: '#27ae60', text: '#27ae60' }
};

export const DebtItemCard: React.FC<DebtItemCardProps> = ({ item }) => {
  const style = severityStyles[item.severity];

  return (
    <div style={{
      border: `1px solid ${style.border}`,
      borderLeft: `4px solid ${style.border}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '12px',
      backgroundColor: style.bg
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h4 style={{ margin: 0, color: '#2c3e50', fontSize: '0.95rem' }}>{item.title}</h4>
        <span style={{
          backgroundColor: style.border,
          color: 'white',
          padding: '2px 8px',
          borderRadius: '12px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          textTransform: 'uppercase'
        }}>
          {item.severity}
        </span>
      </div>
      <p style={{ margin: '8px 0', color: '#555', fontSize: '0.85rem' }}>{item.description}</p>
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.7)',
        padding: '8px 12px',
        borderRadius: '4px',
        marginTop: '8px'
      }}>
        <strong style={{ fontSize: '0.8rem', color: '#2c3e50' }}>Recommendation: </strong>
        <span style={{ fontSize: '0.8rem', color: '#555' }}>{item.recommendation}</span>
      </div>
    </div>
  );
};
