import React, { useState } from 'react';
import { DebtItem } from '../types/assessment';

interface DebtItemCardProps {
  item: DebtItem;
}

const severityStyles: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: '#fdf0ed', border: '#c0392b', text: '#c0392b' },
  high:     { bg: '#fef5e7', border: '#d35400', text: '#d35400' },
  medium:   { bg: '#fef9e7', border: '#f39c12', text: '#f39c12' },
  low:      { bg: '#eafaf1', border: '#27ae60', text: '#27ae60' }
};

export const DebtItemCard: React.FC<DebtItemCardProps> = ({ item }) => {
  const style = severityStyles[item.severity];
  const [showDetails, setShowDetails] = useState(false);

  const records: { name: string; detail?: string }[] = item.metadata?.records || [];

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
          fontWeight: 'bold' as const,
          textTransform: 'uppercase' as const
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

      {records.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={() => setShowDetails(!showDetails)}
            style={{
              background: 'none',
              border: `1px solid ${style.border}`,
              borderRadius: '4px',
              color: style.text,
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '3px 10px'
            }}
          >
            {showDetails ? `Hide ${records.length} affected records` : `Show ${records.length} affected records`}
          </button>
          {showDetails && (
            <div style={{
              marginTop: '8px',
              backgroundColor: 'rgba(255,255,255,0.85)',
              borderRadius: '6px',
              padding: '8px 12px',
              maxHeight: '300px',
              overflowY: 'auto' as const
            }}>
              {records.map((r, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: i < records.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: '#2c3e50', fontFamily: 'monospace' }}>{r.name}</span>
                  {r.detail && (
                    <span style={{ color: '#888', marginLeft: '12px', fontSize: '0.75rem', fontStyle: 'italic', textAlign: 'right' }}>
                      {r.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
