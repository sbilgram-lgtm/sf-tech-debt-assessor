export interface DebtItem {
  id: string;
  category: 'configuration' | 'code' | 'dataModel' | 'serviceCloud' | 'sharingSecurity' | 'integrations' | 'testCoverage' | 'orgLimits' | 'duplicateRules' | 'reportsDashboards' | 'emailTemplates' | 'platformEvents' | 'managedPackages' | 'customMetadata' | 'recordTypesLayouts' | 'einsteinAI' | 'experienceCloud' | 'connectedAppSecurity' | 'lwc' | 'omniStudio' | 'performance' | 'notesAttachments' | 'flowQuality';
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
  sControls: any[];
  activePushTopics: any[];
  pendingTimeQueueCount: number;
  loginFlows: any[];
}

export interface ApexData {
  classes: any[];
  triggers: any[];
  coverage: any[];
  soapLoginApex: any[];
  hardcodedLoginUrls: any[];
  seeAllDataClasses: any[];
  noAssertClasses: any[];
  noStartStopTestClasses: any[];
  noTestSetupClasses: any[];
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
  miawChannels: any[];
  // Service Console
  consoleApps: any[];
  activeMacroCount: number;
  activeRecommendationStrategyCount: number;
  callCenters: number;
  softphoneLayouts: number;
  // Messaging compliance
  messagingChannelsNoOptOut: any[];
  // New Service Cloud checks
  violatedMilestones: any[];
  staleEscalatedCases: any[];
  staleCases: any[];
  closedCasesTotal90Days: number;
  closedCasesWithComments90Days: number;
  quickTexts: any[];
  staleQuickTextCount: number;
  openContactRequests: any[];
  zeroAgentSessionCount: number;
  unlinkedTranscriptCount: number;
  expiredActiveEntitlements: any[];
  openCasesExpiredEntitlementCount: number;
  caseTeamTemplates: any[];
  unlinkedSocialPostCount: number;
  // Entitlement deep checks
  orphanedEntitlements: any[];
  multiEntitlementCaseCount: number;
  bhNoHolidays: any[];
  suspectMilestoneTriggers: any[];
  duplicateMilestoneTriggerCount: number;
  // Knowledge deep checks
  legacyChannelArticleCount: number;
  promotedSearchTermCount: number;
  synonymDictCount: number;
  duplicateArticleTitles: any[];
  articlesNoSummaryCount: number;
  articlesNoCaseLinkCount: number;
  totalCaseArticleCount: number;
  // Case deep checks
  orphanedCaseCount: number;
  noPriorityCaseCount: number;
  noOriginCaseCount: number;
  veryOldCaseCount: number;
  noDescCaseCount: number;
  userOwnedCaseCount: number;
  // Other Service Cloud capabilities
  openIncidents: any[];
  incidentsNoRelatedItemCount: number;
  staleSwarms: any[];
  unlinkedWorkOrderCount: number;
  casesNoAssetLinkCount: number;
  activeSurveys: any[];
  surveyResponseCount: number;
  voiceCallsNoCaseCount: number;
  voiceCallsTotalCount: number;
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
  orgMfaEnforced: boolean;
  securityHealthCheck: any;
  activeOauthTokens: any[];
  lowSecuritySessions: any[];
  usersPasswordNeverExpires: any[];
  guestAccessObjects: any[];
  privilegedPermSets: any[];
  asyncSharingUpdateActive: boolean;
  activeOutboundMessages: any[];
  caseGuestProfiles: any[];
  permissionSetGroupCount: number;
  usersWithExcessivePermSets: any[];
  clonedSysAdminProfiles: any[];
  transactionSecurityPolicies: any[];
}

export interface IntegrationData {
  connectedApps: any[];
  namedCredentials: any[];
  remoteSiteSettings: any[];
  apexCallouts: any[];
  retiredApiApexClasses: any[];
  activePushTopics: any[];
  externalCredentialCount: number;
  dedicatedIntegrationUserCount: number;
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
  apexClassCount: number;
  customObjectCount: number;
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
  promptTemplates: any[];
  bots: any[];
  aiApplications: any[];
  recentClosedCaseCount: number;
  agentTopicCount: number;
  agentActionCount: number;
  dataCloudConnected: boolean;
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
  guestCacheDisabledNetworks: any[];
  networkPageCounts: { networkId: string; count: number }[];
  networkMemberCounts: { networkId: string; count: number }[];
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
  auraRuntimeScripts: any[];
  ipsNoErrorHandling: any[];
  dataTransformTypes: Record<string, number>;
  namingViolations: any[];
  remoteActionElements: any[];
  legacyKavTypes: any[];
}

export interface PerformanceData {
  largeApexClasses: any[];
  multiTriggerObjects: { obj: string; count: number }[];
  asyncQueuedJobs: any[];
  recentFailedJobs: any[];
  scheduledApex: any[];
  batchConcurrent: any[];
  traceFlagsActive: any[];
  recordTriggeredFlows: any[];
  scheduledFlows: any[];
  platformCachePartitions: any[];
  wideObjects: any[];
  auraBundles: any[];
  heavyEntities: { eid: string; count: number }[];
  eventLogFiles: any[];
  futureQueueable: any[];
  stuckAsyncJobCount: number;
  totalActiveFlowCount: number;
  obsoleteFlowCount: number;
  flowsWithLoopsIds: string[];
  flowsWithDmlIds: string[];
  largeStaticResources: any[];
}

export interface NotesAttachmentsData {
  legacyNoteCount: number;
  legacyAttachmentCount: number;
  contentNoteCount: number;
  contentVersionCount: number;
  orphanedContentDocumentCount: number;
  largeFileCount: number;
  largeFiles: any[];
  untitledContentDocumentCount: number;
  externallySharedFileCount: number;
  permanentlySharedFileCount: number;
  staleFileCount: number;
  contentWorkspaceCount: number;
  topAttachmentObjects: { obj: string; count: number }[];
  enhancedNotesEnabled: boolean;
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
  vfPages: any[];
}

export interface FlowQualityData {
  allFlows: any[];
  flowsWithMissingFaultPaths: any[];
  flowsWithDmlInLoops: any[];
  flowsWithHardcodedIds: any[];
  flowsWithMissingDescriptions: any[];
  flowsWithCopyLabels: any[];
  flowsSystemContextNoSharing: any[];
  flowsSystemContextWithSharing: any[];
  circularSubflowFlows: any[];
}
