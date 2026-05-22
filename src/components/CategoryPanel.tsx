import React, { useState } from 'react';
import { CategoryScore } from '../types/assessment';
import { ScoreGauge } from './ScoreGauge';
import { DebtItemCard } from './DebtItemCard';

interface CategoryPanelProps {
  category: CategoryScore;
}

export const CategoryPanel: React.FC<CategoryPanelProps> = ({ category }) => {
  const [expanded, setExpanded] = useState(false);

  const sortedItems = [...category.items].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: '12px',
      padding: '24px',
      backgroundColor: 'white',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
    }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <ScoreGauge percentage={category.percentage} label="" size="small" />
          <div>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>{category.category}</h3>
            <p style={{ margin: '4px 0 0', color: '#7f8c8d', fontSize: '0.85rem' }}>
              {category.items.length} issue{category.items.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
        <span style={{ fontSize: '1.5rem', color: '#bdc3c7' }}>
          {expanded ? '−' : '+'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '20px', borderTop: '1px solid #ecf0f1', paddingTop: '16px' }}>
          {sortedItems.length === 0 ? (
            <p style={{ color: '#27ae60', fontStyle: 'italic' }}>
              No issues found — this category is healthy!
            </p>
          ) : (
            sortedItems.map(item => <DebtItemCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </div>
  );
};
