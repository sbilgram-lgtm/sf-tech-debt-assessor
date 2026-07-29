/**
 * Layer 3 — Smoke tests
 *
 * Every scoring function gets:
 *   - a "clean org" test: empty/minimal data → zero items, score = 100
 *   - a "flagged" test: one real trigger condition → at least one item, score < 100
 *
 * These catch logic inversions (clean data fires, dirty data doesn't) and
 * crashes on empty input.
 */

import {
  assessConfiguration,
  assessCodeQuality,
  assessDataModel,
  assessServiceCloud,
  assessSharingSecurity,
  assessIntegrations,
  assessTestCoverage,
  assessOrgLimits,
  assessDuplicateRules,
  assessReportsDashboards,
  assessEmailTemplates,
  assessPlatformEvents,
  assessManagedPackages,
  assessCustomMetadata,
  assessRecordTypesLayouts,
  assessEinsteinAI,
  assessExperienceCloud,
  assessConnectedAppSecurity,
  assessLwc,
  assessOmniStudio,
  assessPerformance,
  assessNotesAttachments,
  assessFlowQuality,
} from '../scoring';

// ─── shared empty fixtures ────────────────────────────────────────────────────

const emptyAutomation = {
  workflowRules: [], processBuilders: [], flows: [], allFlows: [],
  approvalProcesses: [], einsteinFlowActions: [], webToCaseSettings: null,
  caseAutoResponseRules: [], sControls: [], pendingTimeQueueCount: 0,
  loginFlows: [{}], jsButtons: [], feedEnabledObjects: [],
};
const emptyValidation = { validationRules: [] };
const emptyApex = {
  classes: [], triggers: [], coverage: [], soapLoginApex: [],
  hardcodedLoginUrls: [], seeAllDataClasses: [], noAssertClasses: [],
  noStartStopTestClasses: [], noTestSetupClasses: [],
};
const emptyDataModel = { objects: [], fields: [], fieldsByObject: {}, fieldUsage: [] };
const emptySharing = {
  owdSettings: [], sharingRules: [], profiles: [], permissionSets: [],
  passwordPolicies: [], sessionSettings: [],
  apiUsers: { all: [], integrationUsers: [], staleUsers: [], broadPermUsers: [] },
  loginIpRanges: [], mfaEnrolledUserIds: [], orgMfaEnforced: true,
  securityHealthCheck: null, activeOauthTokens: [], lowSecuritySessions: [],
  usersPasswordNeverExpires: [], guestAccessObjects: [], privilegedPermSets: [],
  asyncSharingUpdateActive: true, activeOutboundMessages: [], caseGuestProfiles: [],
  permissionSetGroupCount: 1, usersWithExcessivePermSets: [], clonedSysAdminProfiles: [],
  transactionSecurityPolicies: [{}], profilesWithNoUsers: [], permSetsWithNoAssignees: [],
  rolesWithNoUsers: [], allRoles: [],
};
const emptyIntegrations = {
  connectedApps: [], namedCredentials: [], remoteSiteSettings: [], apexCallouts: [],
  retiredApiApexClasses: [], activePushTopics: [], externalCredentialCount: 1,
  dedicatedIntegrationUserCount: 1,
};
const emptyTestCoverage = { apexClasses: [], apexTriggers: [], coverage: [], testClasses: [] };
const emptyOrgLimits = { limits: [], apexClassCount: 0, customObjectCount: 0 };
// Duplicate rules: supply one active rule with a description to avoid absence-of-config findings
const emptyDuplicateRules = {
  duplicateRules: [{ IsActive: true, DeveloperName: 'Std_Account', Description: 'Standard account dedup' }],
  matchingRules: [{ IsActive: true, DeveloperName: 'Std_Account_Match' }],
};
const emptyReports = {
  staleReports: [], totalReports: 0, staleDashboards: [], totalDashboards: 0,
  personalFolderReportCount: 0, unusedCustomReportTypes: [],
};
// Email: supply one lightning template to avoid "no templates" finding
const emptyEmail = { classicTemplates: [], lightningTemplates: [{ Id: 't1', Name: 'Welcome' }] };
// Platform Events: supply a subscribed event so "no events configured" doesn't fire
const emptyPlatformEvents = {
  platformEvents: [{ DeveloperName: 'My_Event' }],
  cdcEntities: [],
  eventBusSubscribers: [{ ExternalId: 'My_Event' }],
  apexConsumedEvents: [],
};
const emptyPackages = { packages: [] };
const emptyCustomMetadata = { customSettings: [], customMetadataTypes: [{}] };
const emptyRecordTypes = { recordTypes: [], pageLayouts: [], orphanedLayouts: [] };
// Einstein: enabled with implementation (topic + action + prompt) → no debt items
const emptyEinstein = {
  einsteinSettings: [{ SettingName: 'EinsteinPredictionBuilderEnabled', SettingValue: 'false' }],
  promptTemplates: [{ Id: 'pt1', DeveloperName: 'MyPrompt' }],
  bots: [], aiApplications: [],
  recentClosedCaseCount: 100, agentTopicCount: 1, agentActionCount: 1,
  dataCloudConnected: false,
};
const emptyExperience = {
  sites: [], networks: [], networkMembers: [], customDomains: [],
  wcagUpdatesActive: true, wcagUpdates: [], clickjackVulnerableSites: [],
  xssUnprotectedNetworks: [], contentSniffingUnprotectedNetworks: [],
  guestCacheDisabledNetworks: [], networkPageCounts: [], networkMemberCounts: [],
};
const emptyConnectedApps = {
  connectedApps: [], oauthTokens: [], setupAccess: [], permSets: [],
  activeOutboundMessages: [], certificates: [], externalClientApps: [], ctiConnectedApps: [],
};
const emptyLwc = {
  lwcBundles: [], auraBundles: [], auraDefinitions: [], flexiPages: [],
  lwcResources: [], jsResources: [], htmlResources: [], cssResources: [], vfPages: [],
};
const emptyOmni = {
  installed: false, flavor: null, omniScripts: [], integrationProcedures: [],
  dataTransforms: [], flexCards: [], managedPackageVersion: null, auraRuntimeScripts: [],
  ipsNoErrorHandling: [], dataTransformTypes: {}, namingViolations: [], remoteActionElements: [],
  legacyKavTypes: [],
};
// Performance: supply one event log file so "no event logs" doesn't fire
const emptyPerformance = {
  largeApexClasses: [], multiTriggerObjects: [], asyncQueuedJobs: [], recentFailedJobs: [],
  scheduledApex: [], batchConcurrent: [], traceFlagsActive: [], recordTriggeredFlows: [],
  scheduledFlows: [], platformCachePartitions: [{}], wideObjects: [], auraBundles: [],
  heavyEntities: [], eventLogFiles: [{ Id: 'elf1' }], futureQueueable: [],
  stuckAsyncJobCount: 0, totalActiveFlowCount: 0, obsoleteFlowCount: 0,
  flowsWithLoopsIds: [], flowsWithDmlIds: [], largeStaticResources: [],
};
// Notes: supply one content library so "no libraries" doesn't fire
const emptyNotes = {
  legacyNoteCount: 0, legacyAttachmentCount: 0, contentNoteCount: 0,
  contentVersionCount: 0, orphanedContentDocumentCount: 0, largeFileCount: 0,
  largeFiles: [], untitledContentDocumentCount: 0, externallySharedFileCount: 0,
  permanentlySharedFileCount: 0, staleFileCount: 0, contentWorkspaceCount: 1,
  topAttachmentObjects: [], enhancedNotesEnabled: true,
};
const emptyFlowQuality = {
  allFlows: [], flowsWithDmlInLoops: [], flowsWithMissingDescriptions: [],
  flowsSystemContextNoSharing: [], flowsSystemContextWithSharing: [],
  processBuilderFlows: [], obsoleteFlowCount: 0,
};

// ─── helper ───────────────────────────────────────────────────────────────────

function clean(result: any) {
  expect(result.items).toHaveLength(0);
  expect(result.percentage).toBe(100);
}

function flagged(result: any) {
  expect(result.items.length).toBeGreaterThan(0);
  expect(result.percentage).toBeLessThan(100);
}

// ─── assessConfiguration ──────────────────────────────────────────────────────

describe('assessConfiguration', () => {
  test('clean org — no items', () => clean(assessConfiguration(emptyAutomation, emptyValidation)));
  test('workflow rules fire finding', () => {
    const automation = { ...emptyAutomation, workflowRules: [{ Id: '1', Name: 'Rule1', TableEnumOrId: 'Account' }] };
    flagged(assessConfiguration(automation, emptyValidation));
  });
  test('s-Controls fire critical finding', () => {
    const automation = { ...emptyAutomation, sControls: [{ Id: '1', Name: 'OldSC' }] };
    const result = assessConfiguration(automation, emptyValidation);
    const item = result.items.find(i => i.title.includes('s-Control'));
    expect(item?.severity).toBe('critical');
  });
});

// ─── assessCodeQuality ────────────────────────────────────────────────────────

describe('assessCodeQuality', () => {
  test('clean org — no items', () => clean(assessCodeQuality(emptyApex)));
  test('trigger with > 10 lines of logic fires finding', () => {
    const body = Array(12).fill('System.debug(1);').join('\n');
    const apex = { ...emptyApex, triggers: [{ Id: 't1', Name: 'AccTrigger', Body: body, TableEnumOrId: 'Account', ApiVersion: 60 }] };
    flagged(assessCodeQuality(apex));
  });
});

// ─── assessDataModel ──────────────────────────────────────────────────────────

describe('assessDataModel', () => {
  test('clean org — no items', () => clean(assessDataModel(emptyDataModel)));
  test('objects without descriptions fire finding', () => {
    const data = { ...emptyDataModel, objects: [{ QualifiedApiName: 'My_Obj__c', Description: '' }] };
    flagged(assessDataModel(data));
  });
});

// ─── assessSharingSecurity ────────────────────────────────────────────────────

describe('assessSharingSecurity', () => {
  test('clean org — no items', () => clean(assessSharingSecurity(emptySharing)));
  test('stale users fire finding', () => {
    const data = { ...emptySharing, apiUsers: { ...emptySharing.apiUsers, staleUsers: [{ Id: 'u1', Name: 'Old User' }] } };
    flagged(assessSharingSecurity(data));
  });
});

// ─── assessIntegrations ───────────────────────────────────────────────────────

describe('assessIntegrations', () => {
  test('clean org — no items', () => clean(assessIntegrations(emptyIntegrations)));
  test('retired API Apex classes fire finding', () => {
    const data = { ...emptyIntegrations, retiredApiApexClasses: [{ Id: 'c1', Name: 'OldAPI' }] };
    flagged(assessIntegrations(data));
  });
});

// ─── assessTestCoverage ───────────────────────────────────────────────────────

describe('assessTestCoverage', () => {
  test('clean org — no items', () => clean(assessTestCoverage(emptyTestCoverage)));
  test('zero coverage classes fire finding', () => {
    const data = {
      ...emptyTestCoverage,
      apexClasses: [{ Id: 'c1', Name: 'MyClass' }],
      coverage: [{ ApexClassOrTriggerId: 'c1', NumLinesCovered: 0, NumLinesUncovered: 100 }],
    };
    flagged(assessTestCoverage(data));
  });
});

// ─── assessOrgLimits ──────────────────────────────────────────────────────────

describe('assessOrgLimits', () => {
  test('clean org — no items', () => clean(assessOrgLimits(emptyOrgLimits)));
  test('limit at 80% fires finding', () => {
    const data = {
      ...emptyOrgLimits,
      limits: [{ name: 'DailyApiRequests', max: 1000, remaining: 200, used: 800, usedPct: 80 }],
    };
    flagged(assessOrgLimits(data));
  });
});

// ─── assessDuplicateRules ─────────────────────────────────────────────────────

describe('assessDuplicateRules', () => {
  test('clean org — no items', () => clean(assessDuplicateRules(emptyDuplicateRules)));
  test('no duplicate rules fires finding', () => {
    flagged(assessDuplicateRules({ duplicateRules: [], matchingRules: [] }));
  });
});

// ─── assessReportsDashboards ──────────────────────────────────────────────────

describe('assessReportsDashboards', () => {
  test('clean org — no items', () => clean(assessReportsDashboards(emptyReports)));
  test('stale reports fire finding', () => {
    // threshold is > 50 stale reports
    const staleReports = Array.from({ length: 55 }, (_, i) => ({ Id: `r${i}`, Name: `Report ${i}` }));
    const data = { ...emptyReports, staleReports, totalReports: 100 };
    flagged(assessReportsDashboards(data));
  });
});

// ─── assessEmailTemplates ─────────────────────────────────────────────────────

describe('assessEmailTemplates', () => {
  test('clean org — no items', () => clean(assessEmailTemplates(emptyEmail)));
  test('classic templates fire finding', () => {
    const data = { ...emptyEmail, classicTemplates: [{ Id: 't1', Name: 'Old Template' }] };
    flagged(assessEmailTemplates(data));
  });
});

// ─── assessPlatformEvents ─────────────────────────────────────────────────────

describe('assessPlatformEvents', () => {
  test('clean org — no items', () => clean(assessPlatformEvents(emptyPlatformEvents)));
  test('unsubscribed platform event fires finding', () => {
    const data = {
      ...emptyPlatformEvents,
      platformEvents: [
        { DeveloperName: 'My_Event' },    // subscribed — from emptyPlatformEvents
        { DeveloperName: 'Ghost_Event' }, // NOT subscribed
      ],
    };
    flagged(assessPlatformEvents(data));
  });
});

// ─── assessManagedPackages ────────────────────────────────────────────────────

describe('assessManagedPackages', () => {
  test('clean org — no items', () => clean(assessManagedPackages(emptyPackages)));
  test('beta package fires finding', () => {
    const data = { packages: [{ SubscriberPackage: { Name: 'TestPkg' }, IsBeta: true }] };
    flagged(assessManagedPackages(data));
  });
});

// ─── assessCustomMetadata ─────────────────────────────────────────────────────

describe('assessCustomMetadata', () => {
  test('clean org — no items', () => clean(assessCustomMetadata(emptyCustomMetadata)));
  test('custom settings fire finding', () => {
    const data = { ...emptyCustomMetadata, customSettings: [{ Id: 'cs1', DeveloperName: 'MySetting' }] };
    flagged(assessCustomMetadata(data));
  });
});

// ─── assessRecordTypesLayouts ─────────────────────────────────────────────────

describe('assessRecordTypesLayouts', () => {
  test('clean org — no items', () => clean(assessRecordTypesLayouts(emptyRecordTypes)));
  test('orphaned layouts fire finding', () => {
    const data = { ...emptyRecordTypes, orphanedLayouts: [{ Id: 'l1', Name: 'Unused Layout' }] };
    flagged(assessRecordTypesLayouts(data));
  });
});

// ─── assessEinsteinAI ─────────────────────────────────────────────────────────

describe('assessEinsteinAI', () => {
  test('clean org — no items', () => clean(assessEinsteinAI(emptyEinstein)));
  test('inactive bot fires finding', () => {
    const data = { ...emptyEinstein, bots: [{ Id: 'b1', DeveloperName: 'MyBot', Status: 'Inactive' }] };
    flagged(assessEinsteinAI(data));
  });
});

// ─── assessExperienceCloud ────────────────────────────────────────────────────

describe('assessExperienceCloud', () => {
  test('clean org — no items', () => clean(assessExperienceCloud(emptyExperience)));
  test('clickjack-vulnerable site fires finding', () => {
    const data = { ...emptyExperience, clickjackVulnerableSites: [{ Id: 's1', Name: 'My Site' }] };
    flagged(assessExperienceCloud(data));
  });
});

// ─── assessConnectedAppSecurity ───────────────────────────────────────────────

describe('assessConnectedAppSecurity', () => {
  test('clean org — no items', () => clean(assessConnectedAppSecurity(emptyConnectedApps)));
  test('connected app without session timeout fires finding', () => {
    const data = {
      ...emptyConnectedApps,
      connectedApps: [{ Id: 'a1', Name: 'My App', MobileSessionTimeout: null }],
    };
    flagged(assessConnectedAppSecurity(data));
  });
});

// ─── assessLwc ────────────────────────────────────────────────────────────────

describe('assessLwc', () => {
  test('clean org — no items', () => clean(assessLwc(emptyLwc)));
  test('VF page fires finding', () => {
    const data = { ...emptyLwc, vfPages: [{ Id: 'p1', Name: 'OldPage', ApiVersion: 40 }] };
    flagged(assessLwc(data));
  });
});

// ─── assessOmniStudio ─────────────────────────────────────────────────────────

describe('assessOmniStudio', () => {
  test('not installed — no items', () => clean(assessOmniStudio(emptyOmni)));
  test('IPs without error handling fire finding', () => {
    const data = {
      ...emptyOmni, installed: true, flavor: 'native' as const,
      integrationProcedures: [{ Id: 'ip1', Name: 'My_IP' }],
      ipsNoErrorHandling: [{ Id: 'ip1', Name: 'My_IP' }],
    };
    flagged(assessOmniStudio(data));
  });
});

// ─── assessPerformance ────────────────────────────────────────────────────────

describe('assessPerformance', () => {
  test('clean org — no items', () => clean(assessPerformance(emptyPerformance)));
  test('active trace flags fire finding', () => {
    const data = { ...emptyPerformance, traceFlagsActive: [{ TracedEntityId: 'u1', ExpirationDate: null }] };
    flagged(assessPerformance(data));
  });
});

// ─── assessNotesAttachments ───────────────────────────────────────────────────

describe('assessNotesAttachments', () => {
  test('clean org — no items', () => clean(assessNotesAttachments(emptyNotes)));
  test('legacy notes fire finding', () => {
    const data = { ...emptyNotes, legacyNoteCount: 100, enhancedNotesEnabled: true };
    flagged(assessNotesAttachments(data));
  });
});

// ─── assessFlowQuality ────────────────────────────────────────────────────────

describe('assessFlowQuality', () => {
  test('clean org — no items', () => clean(assessFlowQuality(emptyFlowQuality)));
  test('flows running without sharing fire finding', () => {
    const data = {
      ...emptyFlowQuality,
      flowsSystemContextNoSharing: [{ Id: 'f1', MasterLabel: 'Risky Flow', ProcessType: 'AutoLaunchedFlow' }],
    };
    flagged(assessFlowQuality(data));
  });
});

// ─── assessServiceCloud (abbreviated — 70 checks makes full coverage impractical) ──

describe('assessServiceCloud', () => {
  const emptyServiceCloud = {
    // one active record type only (no inactive ones)
    caseRecordTypes: [{ IsActive: true, Name: 'Master' }],
    emailToCase: [], queues: [{}], assignmentRules: [{}],
    // escalation rules present so "no escalation rules" doesn't fire
    escalationRules: [{ IsActive: true }],
    unverifiedOWAs: [],
    // service channels + routing + presence with valid config to suppress absence-checks
    serviceChannels: [{}],
    routingConfigurations: [{ PushTimeout: 120 }],
    presenceConfigurations: [{ Capacity: 5 }],
    knowledgeEnabled: false, publishedArticleCount: 0,
    staleArticleCount: 0, draftStalledCount: 0, dataCategoryGroupCount: 0,
    uncategorizedArticleCount: 0, articlesWithoutValidationCount: 0,
    entitlementProcesses: [], entitlementProcessesWithoutBusinessHours: [],
    entitlementProcessesWithoutMilestoneActions: [], openCasesEntitlementNoSla: 0,
    serviceContractsWithoutEntitlements: [], entitlementTemplateCount: 0,
    emailRoutingAddresses: [], emailServicesAddresses: [], emailThreadingGapCount: 0,
    liveChatButtons: [], liveChatDeployments: [], messagingChannels: [],
    embeddedServiceConfigs: [], miawChannels: [],
    // no console app so NBA/macro checks don't fire
    appDefQueryWorked: true, consoleApps: [], activeMacroCount: 0,
    activeRecommendationStrategyCount: 0, callCenters: 0, softphoneLayouts: 0,
    messagingChannelsNoOptOut: [], violatedMilestones: [], staleEscalatedCases: [],
    staleCases: [], closedCasesTotal90Days: 100, closedCasesWithComments90Days: 90,
    quickTexts: [{}], staleQuickTextCount: 0, openContactRequests: [],
    zeroAgentSessionCount: 0, unlinkedTranscriptCount: 0, expiredActiveEntitlements: [],
    openCasesExpiredEntitlementCount: 0, caseTeamTemplates: [], unlinkedSocialPostCount: 0,
    orphanedEntitlements: [], multiEntitlementCaseCount: 0, bhNoHolidays: [],
    suspectMilestoneTriggers: [], duplicateMilestoneTriggerCount: 0,
    legacyChannelArticleCount: 0, promotedSearchTermCount: 0, synonymDictCount: 0,
    duplicateArticleTitles: [], articlesNoSummaryCount: 0, articlesNoCaseLinkCount: 0,
    totalCaseArticleCount: 0, orphanedCaseCount: 0, noPriorityCaseCount: 0,
    noOriginCaseCount: 0, veryOldCaseCount: 0, noDescCaseCount: 0, userOwnedCaseCount: 0,
    openIncidents: [], incidentsNoRelatedItemCount: 0, staleSwarms: [],
    unlinkedWorkOrderCount: 0, casesNoAssetLinkCount: 0, activeSurveys: [],
    surveyResponseCount: 0, voiceCallsNoCaseCount: 0, voiceCallsTotalCount: 0,
  };

  test('clean org — no items', () => clean(assessServiceCloud(emptyServiceCloud)));
  test('unverified OWAs fire finding', () => {
    const data = { ...emptyServiceCloud, unverifiedOWAs: [{ Id: 'o1', DisplayName: 'noreply@test.com' }] };
    flagged(assessServiceCloud(data));
  });
});
