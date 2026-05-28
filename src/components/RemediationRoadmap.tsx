import React from 'react';
import { AssessmentResult, DebtItem } from '../types/assessment';

interface Props {
  assessment: AssessmentResult;
  onClose: () => void;
}

const PHASES = [
  { key: 'critical', label: 'Phase 1 — Critical', subtitle: 'Address immediately', color: '#c0392b', bg: '#fdf0ed', border: '#c0392b' },
  { key: 'high',     label: 'Phase 2 — High',     subtitle: 'Within 30 days',      color: '#d35400', bg: '#fef5e7', border: '#d35400' },
  { key: 'medium',   label: 'Phase 3 — Medium',   subtitle: 'Within 90 days',      color: '#f39c12', bg: '#fef9e7', border: '#f39c12' },
  { key: 'low',      label: 'Phase 4 — Low',       subtitle: 'Ongoing hygiene',     color: '#27ae60', bg: '#eafaf1', border: '#27ae60' },
] as const;

function groupByCategory(items: DebtItem[]): Record<string, DebtItem[]> {
  return items.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, DebtItem[]>);
}

function recordCount(item: DebtItem): number {
  return item.metadata?.records?.length || 0;
}

export const RemediationRoadmap: React.FC<Props> = ({ assessment, onClose }) => {
  const allItems = assessment.categories.flatMap(c => c.items);
  const totalCritical = allItems.filter(i => i.severity === 'critical').length;
  const totalHigh     = allItems.filter(i => i.severity === 'high').length;
  const totalMedium   = allItems.filter(i => i.severity === 'medium').length;
  const totalLow      = allItems.filter(i => i.severity === 'low').length;

  // Map category id → display name
  const categoryNames: Record<string, string> = {};
  assessment.categories.forEach(c => {
    c.items.forEach(item => { categoryNames[item.category] = c.category; });
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(0,0,0,0.5)',
      overflowY: 'auto'
    }}>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .roadmap-page { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }
        @page { margin: 15mm; }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10,
        backgroundColor: '#2c3e50',
        padding: '12px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '1rem' }}>
          Remediation Roadmap
        </span>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => window.print()}
            style={{
              backgroundColor: '#3498db', color: 'white', border: 'none',
              padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem'
            }}
          >
            Print / Save as PDF
          </button>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent', color: 'white',
              border: '1px solid rgba(255,255,255,0.4)',
              padding: '8px 20px', borderRadius: '6px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.9rem'
            }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Roadmap content */}
      <div className="roadmap-page" style={{
        maxWidth: '900px', margin: '24px auto 48px',
        backgroundColor: 'white', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        padding: '48px'
      }}>

        {/* Header */}
        <div style={{ borderBottom: '3px solid #2c3e50', paddingBottom: '24px', marginBottom: '32px' }}>
          <h1 style={{ margin: '0 0 6px', color: '#2c3e50', fontSize: '1.8rem' }}>
            Salesforce Technical Debt — Remediation Roadmap
          </h1>
          <p style={{ margin: '0 0 16px', color: '#7f8c8d', fontSize: '0.9rem' }}>
            Generated: {new Date(assessment.timestamp).toLocaleDateString()}
            {assessment.orgName && <> &nbsp;|&nbsp; <strong>{assessment.orgName}</strong>{assessment.isSandbox ? ' (Sandbox)' : ''}</>}
            {assessment.orgId && <> &nbsp;|&nbsp; Org ID: {assessment.orgId}</>}
            {assessment.instanceUrl && <><br />{assessment.instanceUrl}</>}
          </p>

          {/* Summary chips */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <SummaryChip label="Overall Score" value={`${assessment.overallPercentage}%`} color="#2c3e50" />
            {totalCritical > 0 && <SummaryChip label="Critical" value={String(totalCritical)} color="#c0392b" />}
            {totalHigh > 0     && <SummaryChip label="High"     value={String(totalHigh)}     color="#d35400" />}
            {totalMedium > 0   && <SummaryChip label="Medium"   value={String(totalMedium)}   color="#f39c12" />}
            {totalLow > 0      && <SummaryChip label="Low"      value={String(totalLow)}      color="#27ae60" />}
          </div>
        </div>

        {/* Phases */}
        {PHASES.map(phase => {
          const phaseItems = allItems.filter(i => i.severity === phase.key);
          if (phaseItems.length === 0) return null;
          const grouped = groupByCategory(phaseItems);

          return (
            <div key={phase.key} style={{ marginBottom: '40px' }}>
              {/* Phase header */}
              <div style={{
                backgroundColor: phase.bg,
                border: `2px solid ${phase.border}`,
                borderRadius: '8px',
                padding: '14px 20px',
                marginBottom: '16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: 0, color: phase.color, fontSize: '1.15rem' }}>{phase.label}</h2>
                  <p style={{ margin: '2px 0 0', color: '#888', fontSize: '0.82rem' }}>{phase.subtitle}</p>
                </div>
                <span style={{
                  backgroundColor: phase.color, color: 'white',
                  borderRadius: '20px', padding: '4px 14px',
                  fontSize: '0.85rem', fontWeight: 700
                }}>
                  {phaseItems.length} issue{phaseItems.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Categories within phase */}
              {Object.entries(grouped).map(([catKey, items]) => (
                <div key={catKey} style={{ marginBottom: '20px', marginLeft: '8px' }}>
                  <h3 style={{
                    margin: '0 0 10px',
                    color: '#2c3e50',
                    fontSize: '0.95rem',
                    borderBottom: '1px solid #ecf0f1',
                    paddingBottom: '6px'
                  }}>
                    {categoryNames[catKey] || catKey}
                  </h3>

                  {items.map((item, idx) => (
                    <div key={idx} style={{
                      marginBottom: '12px',
                      paddingLeft: '12px',
                      borderLeft: `3px solid ${phase.border}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#2c3e50', fontSize: '0.88rem' }}>
                            {item.title}
                          </p>
                          <p style={{ margin: '0 0 4px', color: '#555', fontSize: '0.82rem' }}>
                            {item.description}
                          </p>
                          <p style={{ margin: 0, color: '#2980b9', fontSize: '0.82rem' }}>
                            <strong>Action:</strong> {item.recommendation}
                          </p>
                        </div>
                        {recordCount(item) > 0 && (
                          <span style={{
                            whiteSpace: 'nowrap',
                            backgroundColor: '#ecf0f1',
                            color: '#555',
                            borderRadius: '12px',
                            padding: '2px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            flexShrink: 0
                          }}>
                            {recordCount(item)} record{recordCount(item) !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })}

        {/* Footer */}
        <div style={{
          borderTop: '1px solid #ecf0f1',
          paddingTop: '20px',
          marginTop: '8px',
          color: '#bdc3c7',
          fontSize: '0.75rem',
          textAlign: 'center'
        }}>
          Generated by SF Tech Debt Assessor &nbsp;|&nbsp; {new Date(assessment.timestamp).toLocaleString()}
          {assessment.orgId && <> &nbsp;|&nbsp; Org ID: {assessment.orgId}</>}
        </div>
      </div>
    </div>
  );
};

const SummaryChip: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    backgroundColor: '#f8f9fa', border: `1px solid ${color}`,
    borderRadius: '20px', padding: '4px 12px'
  }}>
    <span style={{ fontWeight: 700, color, fontSize: '0.95rem' }}>{value}</span>
    <span style={{ color: '#888', fontSize: '0.8rem' }}>{label}</span>
  </div>
);
