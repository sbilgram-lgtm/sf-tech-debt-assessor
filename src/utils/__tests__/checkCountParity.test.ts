/**
 * Layer 1 — Check count parity
 *
 * Counts createDebtItem calls per scoring function and asserts they match
 * the checks: values declared in LoginPage's CATEGORIES array.
 *
 * This test fails automatically whenever a check is added or removed from
 * scoring.ts but the UI count is not updated (or vice versa).
 */

import * as fs from 'fs';
import * as path from 'path';

const scoringPath = path.resolve(__dirname, '../scoring.ts');
const loginPagePath = path.resolve(__dirname, '../../pages/LoginPage.tsx');

// Parse the actual createDebtItem count per function from scoring.ts source
function countDebtItemsPerFunction(src: string): Record<string, number> {
  const funcRe = /^export function (assess\w+)\b/gm;
  const matches: { name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = funcRe.exec(src)) !== null) {
    matches.push({ name: m[1], index: m.index });
  }

  const counts: Record<string, number> = {};
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = matches[i + 1]?.index ?? src.length;
    const body = src.slice(start, end);
    counts[matches[i].name] = (body.match(/\bcreateDebtItem\s*\(/g) || []).length;
  }
  return counts;
}

// Parse the checks: values from the CATEGORIES array in LoginPage.tsx
function parseCategoryCounts(src: string): Record<string, number> {
  const rows: Record<string, number> = {};
  const re = /name:\s*'([^']+)'[\s\S]*?checks:\s*(\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    rows[m[1]] = parseInt(m[2], 10);
  }
  return rows;
}

// Map scoring function name → LoginPage category name
const FUNCTION_TO_CATEGORY: Record<string, string> = {
  assessConfiguration:      'Configuration',
  assessCodeQuality:        'Code Quality',
  assessDataModel:          'Data Model',
  assessServiceCloud:       'Service Cloud',
  assessSharingSecurity:    'Sharing & Security',
  assessIntegrations:       'Integrations',
  assessTestCoverage:       'Test Coverage',
  assessOrgLimits:          'Org Limits',
  assessDuplicateRules:     'Duplicate Rules',
  assessReportsDashboards:  'Reports & Dashboards',
  assessEmailTemplates:     'Email Templates',
  assessPlatformEvents:     'Platform Events',
  assessManagedPackages:    'Managed Packages',
  assessCustomMetadata:     'Custom Metadata',
  assessRecordTypesLayouts: 'Record Types & Layouts',
  assessEinsteinAI:         'Einstein & AI',
  assessExperienceCloud:    'Experience Cloud',
  assessConnectedAppSecurity: 'Connected App Security',
  assessLwc:                'LWC & Components',
  assessOmniStudio:         'OmniStudio',
  assessPerformance:        'Performance',
  assessNotesAttachments:   'Notes & Attachments',
  assessFlowQuality:        'Flow Quality',
};

describe('Check count parity — scoring.ts vs LoginPage CATEGORIES', () => {
  const scoringSrc = fs.readFileSync(scoringPath, 'utf8');
  const loginSrc = fs.readFileSync(loginPagePath, 'utf8');
  const actual = countDebtItemsPerFunction(scoringSrc);
  const declared = parseCategoryCounts(loginSrc);

  test('all 23 scoring functions are mapped', () => {
    const missing = Object.keys(actual).filter(fn => !FUNCTION_TO_CATEGORY[fn]);
    expect(missing).toEqual([]);
  });

  test('total declared checks equals sum of actual createDebtItem calls', () => {
    const totalDeclared = Object.values(declared).reduce((a, b) => a + b, 0);
    const totalActual = Object.values(actual).reduce((a, b) => a + b, 0);
    expect(totalDeclared).toBe(totalActual);
  });

  for (const [fn, category] of Object.entries(FUNCTION_TO_CATEGORY)) {
    test(`${category}: declared ${declared[category]} matches actual ${actual[fn]}`, () => {
      expect(declared[category]).toBe(actual[fn]);
    });
  }
});
