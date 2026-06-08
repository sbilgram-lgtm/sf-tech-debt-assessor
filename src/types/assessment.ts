export interface DebtItem {
  id: string;
  category: 'configuration' | 'code' | 'dataModel' | 'serviceCloud' | 'sharingSecurity' | 'integrations' | 'testCoverage' | 'orgLimits' | 'duplicateRules' | 'reportsDashboards' | 'emailTemplates' | 'platformEvents' | 'managedPackages' | 'customMetadata' | 'recordTypesLayouts' | 'einsteinAI' | 'territory' | 'experienceCloud' | 'connectedAppSecurity' | 'lwc' | 'omniStudio';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  metadata?: Record<string, any>;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  items: DebtItem[];
}

export interface AssessmentResult {
  overallScore: number;
  overallPercentage: number;
  categories: CategoryScore[];
  timestamp: string;
  orgId?: string;
  orgName?: string;
  orgType?: string;
  isSandbox?: boolean;
  instanceName?: string;
  instanceUrl?: string;
}

export interface AutomationData {
  workflowRules: any[];
  processBuilders: any[];
  flows: any[];
  allFlows: any[];
  approvalProcesses: any[];
  einsteinFlowActions: any[];
  webToCaseSettings: any;
  caseAutoResponseRules: any[];
}

export interface ApexData {
  classes: any[];
  triggers: any[];
  coverage: any[];
  soapLoginApex: any[];
  hardcodedLoginUrls: any[];
}

export interface DataModelData {
  objects: any[];
  fields: any[];
  fieldUsage: any[];
}

export interface ServiceCloudData {
  caseRecordTypes: any[];
  emailToCase: any[];
  queues: any[];
  assignmentRules: any[];
  escalationRules: any[];
  unverifiedOWAs: any[];
  // Omnichannel
  serviceChannels: any[];
  routingConfigurations: any[];
  presenceConfigurations: any[];
  // Knowledge
  publishedArticleCount: number;
  staleArticleCount: number;  // published, not modified in 12+ months
  draftStalledCount: number;  // draft, not modified in 180+ days
  dataCategoryGroupCount: number;
  uncategorizedArticleCount: number;
  articlesWithoutValidationCount: number;
  // Entitlements
  entitlementProcesses: any[];
  entitlementProcessesWithoutBusinessHours: any[];
  entitlementProcessesWithoutMilestoneActions: any[];
  openCasesEntitlementNoSla: number;
  serviceContractsWithoutEntitlements: any[];
  entitlementTemplateCount: number;
  // Email-to-Case
  emailRoutingAddresses: any[];
  emailServicesAddresses: any[];
  emailThreadingGapCount: number;
  // Live Chat / Messaging
  liveChatButtons: any[];
  liveChatDeployments: any[];
  messagingChannels: any[];
  embeddedServiceConfigs: any[];
  // Service Console
  consoleApps: any[];
  activeMacroCount: number;
  activeRecommendationStrategyCount: number;
  callCenters: number;
  softphoneLayouts: number;
  // Field Service Lightning
  fslEnabled: boolean;
  serviceTerritories: any[];
  serviceResources: any[];
  workTypes: any[];
  schedulingPolicies: any[];
  // Messaging compliance
  messagingChannelsNoOptOut: any[];
}

export interface ValidationRuleData {
  validationRules: any[];
}

export interface SharingSecurityData {
  owdSettings: any[];
  sharingRules: any[];
  profiles: any[];
  permissionSets: any[];
  passwordPolicies: any[];
  sessionSettings: any[];
  apiUsers: {
    all: any[];
    integrationUsers: any[];
    staleUsers: any[];
    broadPermUsers: any[];
  };
  loginIpRanges: any[];
  mfaEnrolledUserIds: string[];
  securityHealthCheck: any;
  activeOauthTokens: any[];
  lowSecuritySessions: any[];
  usersPasswordNeverExpires: any[];
  guestAccessObjects: any[];
  privilegedPermSets: any[];
  asyncSharingUpdateActive: boolean;
  activeOutboundMessages: any[];
  caseGuestProfiles: any[];
}

export interface IntegrationData {
  connectedApps: any[];
  namedCredentials: any[];
  remoteSiteSettings: any[];
  apexCallouts: any[];
  retiredApiApexClasses: any[];
}

export interface TestCoverageData {
  apexClasses: any[];
  apexTriggers: any[];
  coverage: any[];
  testClasses: any[];
}

export interface OrgLimitEntry {
  name: string;
  max: number;
  remaining: number;
  used: number;
  usedPct: number;
}

export interface OrgLimitsData {
  limits: OrgLimitEntry[];
}

export interface DuplicateRulesData {
  duplicateRules: any[];
  matchingRules: any[];
}

export interface ReportsDashboardsData {
  staleReports: any[];
  totalReports: number;
  staleDashboards: any[];
  totalDashboards: number;
}

export interface EmailTemplatesData {
  classicTemplates: any[];
  lightningTemplates: any[];
}

export interface PlatformEventsData {
  platformEvents: any[];
  cdcEntities: any[];
  eventBusSubscribers: any[];
}

export interface ManagedPackagesData {
  packages: any[];
}

export interface CustomMetadataData {
  customSettings: any[];
  customMetadataTypes: any[];
}

export interface RecordTypesLayoutsData {
  recordTypes: any[];
  pageLayouts: any[];
}

export interface EinsteinAIData {
  einsteinSettings: any[];
  aiFeatures: any[];
  promptTemplates: any[];
  bots: any[];
  aiApplications: any[];
  recentClosedCaseCount: number;
}

export interface TerritoryData {
  territoryModels: any[];
  territories: any[];
  assignmentRules: any[];
}

export interface ExperienceCloudData {
  sites: any[];
  networks: any[];
  networkMembers: any[];
  customDomains: any[];
  wcagUpdatesActive: boolean;
  wcagUpdates: any[];
  clickjackVulnerableSites: any[];
  xssUnprotectedNetworks: any[];
  contentSniffingUnprotectedNetworks: any[];
}

export interface ConnectedAppSecurityData {
  connectedApps: any[];
  oauthTokens: any[];
  setupAccess: any[];
  permSets: any[];
  activeOutboundMessages: any[];
  certificates: any[];
  externalClientApps: any[];
  ctiConnectedApps: any[];
}

export interface OmniStudioData {
  installed: boolean;
  flavor: 'native' | 'managed' | null;
  omniScripts: any[];
  integrationProcedures: any[];
  dataTransforms: any[];
  flexCards: any[];
  managedPackageVersion: string | null;
}

export interface LwcData {
  lwcBundles: any[];
  auraBundles: any[];
  auraDefinitions: any[];
  flexiPages: any[];
  lwcResources: any[];
  jsResources: any[];
  htmlResources: any[];
  cssResources: any[];
}
