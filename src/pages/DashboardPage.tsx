import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ScoreGauge } from '../components/ScoreGauge';
import { CategoryPanel } from '../components/CategoryPanel';
import { getAuthStatus, getAutomationData, getValidationRules, getApexData, getDataModelData, getServiceCloudData, getSharingSecurityData, getIntegrationData, getTestCoverageData, getOrgLimitsData, getDuplicateRulesData, getReportsDashboardsData, getEmailTemplatesData, getPlatformEventsData, getManagedPackagesData, getCustomMetadataData, getRecordTypesLayoutsData, getEinsteinAIData, getTerritoryData, getExperienceCloudData, getConnectedAppSecurityData, getLwcData, getOmniStudioData } from '../services/api';
import { assessConfiguration, assessCodeQuality, assessDataModel, assessServiceCloud, assessSharingSecurity, assessIntegrations, assessTestCoverage, assessOrgLimits, assessDuplicateRules, assessReportsDashboards, assessEmailTemplates, assessPlatformEvents, assessManagedPackages, assessCustomMetadata, assessRecordTypesLayouts, assessEinsteinAI, assessTerritory, assessExperienceCloud, assessConnectedAppSecurity, assessLwc, assessOmniStudio, calculateOverallScore } from '../utils/scoring';
import { generatePDFReport, generateCSVReport, generateExcelReport } from '../utils/reportGenerator';
import { AssessmentResult } from '../types/assessment';
import { RemediationRoadmap } from '../components/RemediationRoadmap';

const COLORS = ['#27ae60', '#f39c12', '#d35400', '#c0392b'];

export const DashboardPage: React.FC = () => {
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [showRoadmap, setShowRoadmap] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getAuthStatus().then(status => {
      if (!status.authenticated) {
        navigate('/login');
      }
    }).catch(() => navigate('/login'));
  }, [navigate]);

  const runAssessment = async () => {
    setLoading(true);
    setError(null);

    try {
      setProgress('Analyzing automation...');
      const [automationData, validationData] = await Promise.all([
        getAutomationData(),
        getValidationRules()
      ]);

      setProgress('Scanning Apex code...');
      const apexData = await getApexData();

      setProgress('Evaluating data model...');
      const dataModelData = await getDataModelData();

      setProgress('Assessing Service Cloud...');
      const serviceCloudData = await getServiceCloudData();

      setProgress('Scanning sharing & security...');
      const sharingSecurityData = await getSharingSecurityData();

      setProgress('Evaluating integrations...');
      const integrationData = await getIntegrationData();

      setProgress('Analyzing test coverage...');
      const testCoverageData = await getTestCoverageData();

      setProgress('Checking org limits...');
      const orgLimitsData = await getOrgLimitsData();

      setProgress('Checking duplicate & matching rules...');
      const duplicateRulesData = await getDuplicateRulesData();

      setProgress('Analysing reports & dashboards...');
      const reportsDashboardsData = await getReportsDashboardsData();

      setProgress('Reviewing email templates...');
      const emailTemplatesData = await getEmailTemplatesData();

      setProgress('Checking platform events & CDC...');
      const platformEventsData = await getPlatformEventsData();

      setProgress('Scanning managed packages...');
      const managedPackagesData = await getManagedPackagesData();

      setProgress('Reviewing custom metadata & settings...');
      const customMetadataData = await getCustomMetadataData();

      setProgress('Checking record types & page layouts...');
      const recordTypesLayoutsData = await getRecordTypesLayoutsData();

      setProgress('Assessing Einstein & AI usage...');
      const einsteinAIData = await getEinsteinAIData();

      setProgress('Checking territory management...');
      const territoryData = await getTerritoryData();

      setProgress('Assessing Experience Cloud sites...');
      const experienceCloudData = await getExperienceCloudData();

      setProgress('Auditing Connected App security...');
      const connectedAppSecurityData = await getConnectedAppSecurityData();

      setProgress('Auditing Lightning Web Components...');
      const lwcData = await getLwcData();

      setProgress('Assessing OmniStudio components...');
      const omniStudioData = await getOmniStudioData();

      setProgress('Calculating scores...');
      const configScore = assessConfiguration(automationData, validationData);
      const codeScore = assessCodeQuality(apexData);
      const dataScore = assessDataModel(dataModelData);
      const serviceScore = assessServiceCloud(serviceCloudData);
      const sharingScore = assessSharingSecurity(sharingSecurityData);
      const integrationScore = assessIntegrations(integrationData);
      const testScore = assessTestCoverage(testCoverageData);
      const limitsScore = assessOrgLimits(orgLimitsData);
      const duplicateScore = assessDuplicateRules(duplicateRulesData);
      const reportsScore = assessReportsDashboards(reportsDashboardsData);
      const emailScore = assessEmailTemplates(emailTemplatesData);
      const platformEventsScore = assessPlatformEvents(platformEventsData);
      const packagesScore = assessManagedPackages(managedPackagesData);
      const customMetadataScore = assessCustomMetadata(customMetadataData);
      const recordTypesScore = assessRecordTypesLayouts(recordTypesLayoutsData);
      const einsteinScore = assessEinsteinAI(einsteinAIData);
      const territoryScore = assessTerritory(territoryData);
      const experienceCloudScore = assessExperienceCloud(experienceCloudData);
      const connectedAppSecurityScore = assessConnectedAppSecurity(connectedAppSecurityData);
      const lwcScore = assessLwc(lwcData);
      const omniStudioScore = assessOmniStudio(omniStudioData);

      const result = calculateOverallScore([
        configScore, codeScore, dataScore, serviceScore, sharingScore,
        integrationScore, testScore, limitsScore, duplicateScore, reportsScore,
        emailScore, platformEventsScore, packagesScore, customMetadataScore,
        recordTypesScore, einsteinScore, territoryScore, experienceCloudScore,
        connectedAppSecurityScore, lwcScore, omniStudioScore
      ]);

      const authStatus = await getAuthStatus();
      result.instanceUrl  = authStatus.instanceUrl;
      result.orgId        = authStatus.orgId;
      result.orgName      = authStatus.orgName;
      result.orgType      = authStatus.orgType;
      result.isSandbox    = authStatus.isSandbox;
      result.instanceName = authStatus.instanceName;

      setAssessment(result);
    } catch (err: any) {
      setError(err.message || 'Assessment failed');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const handleExportPDF = () => {
    if (assessment) {
      generatePDFReport(assessment);
    }
  };

  const handleExportCSV = () => {
    if (assessment) {
      generateCSVReport(assessment);
    }
  };

  const handleExportExcel = () => {
    if (assessment) {
      generateExcelReport(assessment);
    }
  };

  const getSeverityDistribution = () => {
    if (!assessment) return [];
    const all = assessment.categories.flatMap(c => c.items);
    return [
      { name: 'Low', value: all.filter(i => i.severity === 'low').length },
      { name: 'Medium', value: all.filter(i => i.severity === 'medium').length },
      { name: 'High', value: all.filter(i => i.severity === 'high').length },
      { name: 'Critical', value: all.filter(i => i.severity === 'critical').length }
    ].filter(d => d.value > 0);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {!assessment && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <h2 style={{ color: '#2c3e50', marginBottom: '16px' }}>Ready to Assess</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
            Click below to scan your connected Salesforce org for technical debt across
            configuration, code quality, data model, and Service Cloud setup.
          </p>
          <button
            onClick={runAssessment}
            style={{
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              padding: '16px 40px',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Run Assessment
          </button>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #ecf0f1',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }} />
          <p style={{ color: '#7f8c8d', fontSize: '1rem' }}>{progress}</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#fdf0ed',
          border: '1px solid #c0392b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          color: '#c0392b'
        }}>
          <strong>Error:</strong> {error}
          <button
            onClick={runAssessment}
            style={{ marginLeft: '16px', cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', color: '#c0392b' }}
          >
            Retry
          </button>
        </div>
      )}

      {assessment && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Assessment Results</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={runAssessment}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #3498db',
                  color: '#3498db',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Re-run
              </button>
              <button
                onClick={handleExportCSV}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #27ae60',
                  color: '#27ae60',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Export CSV
              </button>
              <button
                onClick={handleExportExcel}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #27ae60',
                  color: '#27ae60',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Export Excel
              </button>
              <button
                onClick={handleExportPDF}
                style={{
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Export PDF
              </button>
              <button
                onClick={() => setShowRoadmap(true)}
                style={{
                  backgroundColor: '#8e44ad',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Remediation Roadmap
              </button>
            </div>
          </div>

          {/* Overall Score + Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '32px' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <ScoreGauge percentage={assessment.overallPercentage} label="Overall Health" size="large" />
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h4 style={{ margin: '0 0 16px', color: '#2c3e50' }}>Category Scores</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={assessment.categories.map(c => ({ name: c.category.split(' ')[0], score: c.percentage }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="score" fill="#3498db" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              <h4 style={{ margin: '0 0 16px', color: '#2c3e50' }}>Issues by Severity</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={getSeverityDistribution()}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {getSeverityDistribution().map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Panels */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {assessment.categories.map(category => (
              <CategoryPanel key={category.category} category={category} />
            ))}
          </div>

          {showRoadmap && (
            <RemediationRoadmap assessment={assessment} onClose={() => setShowRoadmap(false)} />
          )}
        </>
      )}
    </div>
  );
};
