import React, { useState } from 'react';
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

const DISPLAY_FIELDS = ['Name', 'name', 'MasterLabel', 'DeveloperName', 'developerName', 'title', 'EndpointUrl', 'Domain', 'domain', 'Username', 'username'];
const SECONDARY_FIELDS = ['version', 'state', 'ApiVersion', 'ProcessType', 'SobjectType', 'TemplateType', 'template', 'guestProfile', 'LastLoginDate', 'status', 'Status'];

function getDisplayField(obj: Record<string, any>): string | null {
  for (const f of DISPLAY_FIELDS) {
    if (obj[f] != null && obj[f] !== '') return f;
  }
  return null;
}

function getSecondaryField(obj: Record<string, any>): string | null {
  for (const f of SECONDARY_FIELDS) {
    if (obj[f] != null && obj[f] !== '') return f;
  }
  return null;
}

function renderMetadataValue(key: string, value: any): React.ReactNode {
  if (key === 'count') return null;
  if (value == null) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const capped = value.slice(0, 20);
    const overflow = value.length - 20;

    if (typeof capped[0] === 'string') {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
          {capped.map((s: string, i: number) => (
            <span key={i} style={{
              backgroundColor: 'rgba(0,0,0,0.07)',
              borderRadius: '4px',
              padding: '1px 7px',
              fontSize: '0.75rem',
              fontFamily: 'monospace'
            }}>{s}</span>
          ))}
          {overflow > 0 && <span style={{ fontSize: '0.75rem', color: '#888', alignSelf: 'center' }}>+{overflow} more</span>}
        </div>
      );
    }

    if (typeof capped[0] === 'object' && capped[0] !== null) {
      return (
        <div style={{ marginTop: '2px' }}>
          {capped.map((obj: Record<string, any>, i: number) => {
            const df = getDisplayField(obj);
            const sf = getSecondaryField(obj);
            const label = df ? obj[df] : JSON.stringify(obj).slice(0, 60);
            const secondary = sf ? obj[sf] : null;
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 0',
                borderBottom: i < capped.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                fontSize: '0.78rem'
              }}>
                <span style={{ fontFamily: 'monospace', color: '#2c3e50' }}>{label}</span>
                {secondary && (
                  <span style={{ color: '#888', fontStyle: 'italic' }}>{String(secondary)}</span>
                )}
              </div>
            );
          })}
          {overflow > 0 && (
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>+{overflow} more</div>
          )}
        </div>
      );
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return <span style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{value}</span>;
  }

  return null;
}

function MetadataSection({ metadata }: { metadata: Record<string, any> }) {
  const entries = Object.entries(metadata).filter(([k, v]) => {
    if (k === 'count') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return v != null;
  });

  if (entries.length === 0) return null;

  const labelMap: Record<string, string> = {
    items: 'Records',
    flows: 'Flows',
    classes: 'Classes',
    triggers: 'Triggers',
    profiles: 'Profiles',
    permSets: 'Permission Sets',
    users: 'Users',
    sites: 'Sites',
    apps: 'Connected Apps',
    credentials: 'Named Credentials',
    domains: 'Domains',
    packages: 'Packages',
    rules: 'Rules',
    queues: 'Queues',
    objects: 'Objects',
    fields: 'Fields',
    templates: 'Templates',
    types: 'Types',
  };

  return (
    <div style={{ marginTop: '10px' }}>
      {entries.map(([key, value]) => {
        const rendered = renderMetadataValue(key, value);
        if (!rendered) return null;
        const label = labelMap[key] || key.charAt(0).toUpperCase() + key.slice(1);
        return (
          <div key={key} style={{ marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {label}
            </span>
            <div style={{ marginTop: '2px' }}>{rendered}</div>
          </div>
        );
      })}
    </div>
  );
}

export const DebtItemCard: React.FC<DebtItemCardProps> = ({ item }) => {
  const style = severityStyles[item.severity];
  const [showDetails, setShowDetails] = useState(false);

  const hasDetails = item.metadata && Object.entries(item.metadata).some(([k, v]) => {
    if (k === 'count') return false;
    if (Array.isArray(v)) return v.length > 0;
    return v != null;
  });

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

      {hasDetails && (
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
            {showDetails ? 'Hide affected records' : 'Show affected records'}
          </button>
          {showDetails && (
            <div style={{
              marginTop: '8px',
              backgroundColor: 'rgba(255,255,255,0.8)',
              borderRadius: '6px',
              padding: '10px 12px'
            }}>
              <MetadataSection metadata={item.metadata!} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
