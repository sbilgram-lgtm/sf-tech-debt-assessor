/**
 * Layer 2 — Regression tests
 *
 * One test per confirmed bug from the accuracy audit. Each test encodes
 * the exact scenario that was broken and asserts the fixed behaviour.
 * If any of these tests start failing, it means a regression was introduced.
 */

import {
  assessCodeQuality,
  assessConfiguration,
  assessFlowQuality,
  assessPerformance,
  assessNotesAttachments,
  assessLwc,
  assessSharingSecurity,
} from '../scoring';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeApex(overrides: object = {}) {
  return {
    classes: [],
    triggers: [],
    coverage: [],
    soapLoginApex: [],
    hardcodedLoginUrls: [],
    seeAllDataClasses: [],
    noAssertClasses: [],
    noStartStopTestClasses: [],
    noTestSetupClasses: [],
    ...overrides,
  };
}

function makeClass(name: string, body: string, extra: object = {}) {
  return { Id: name, Name: name, Body: body, ApiVersion: 60, NamespacePrefix: null, ...extra };
}

function makeAutomation(overrides: object = {}) {
  return {
    workflowRules: [],
    processBuilders: [],
    flows: [],
    allFlows: [],
    approvalProcesses: [],
    einsteinFlowActions: [],
    webToCaseSettings: null,
    caseAutoResponseRules: [],
    sControls: [],
    pendingTimeQueueCount: 0,
    loginFlows: [{}],  // suppress "no login flows" finding
    jsButtons: [],
    feedEnabledObjects: [],
    ...overrides,
  };
}

function makeValidationRules(overrides: object = {}) {
  return { validationRules: [], ...overrides };
}

function makeFlowQuality(overrides: object = {}) {
  return {
    allFlows: [],
    flowsWithDmlInLoops: [],
    flowsWithMissingDescriptions: [],
    flowsSystemContextNoSharing: [],
    flowsSystemContextWithSharing: [],
    processBuilderFlows: [],
    obsoleteFlowCount: 0,
    flowsModifiedByInactiveUser: [],
    ...overrides,
  };
}

function makePerformance(overrides: object = {}) {
  return {
    largeApexClasses: [],
    multiTriggerObjects: [],
    asyncQueuedJobs: [],
    recentFailedJobs: [],
    scheduledApex: [],
    batchConcurrent: [],
    traceFlagsActive: [],
    recordTriggeredFlows: [],
    scheduledFlows: [],
    platformCachePartitions: [],
    wideObjects: [],
    auraBundles: [],
    heavyEntities: [],
    eventLogFiles: [],
    futureQueueable: [],
    stuckAsyncJobCount: 0,
    totalActiveFlowCount: 0,
    obsoleteFlowCount: 0,
    flowsWithLoopsIds: [],
    flowsWithDmlIds: [],
    largeStaticResources: [],
    ...overrides,
  };
}

function makeNotes(overrides: object = {}) {
  return {
    legacyNoteCount: 0,
    legacyAttachmentCount: 0,
    contentNoteCount: 0,
    contentVersionCount: 0,
    orphanedContentDocumentCount: 0,
    largeFileCount: 0,
    largeFiles: [],
    untitledContentDocumentCount: 0,
    externallySharedFileCount: 0,
    permanentlySharedFileCount: 0,
    staleFileCount: 0,
    contentWorkspaceCount: 0,
    topAttachmentObjects: [],
    enhancedNotesEnabled: true,
    ...overrides,
  };
}

function makeLwc(overrides: object = {}) {
  return {
    lwcBundles: [],
    auraBundles: [],
    auraDefinitions: [],
    flexiPages: [],
    lwcResources: [],
    jsResources: [],
    htmlResources: [],
    cssResources: [],
    vfPages: [],
    ...overrides,
  };
}

function makeSharing(overrides: object = {}) {
  return {
    owdSettings: [],
    sharingRules: [],
    profiles: [],
    permissionSets: [],
    passwordPolicies: [],
    sessionSettings: [],
    apiUsers: { all: [], integrationUsers: [], staleUsers: [], broadPermUsers: [] },
    loginIpRanges: [],
    mfaEnrolledUserIds: [],
    orgMfaEnforced: true,
    securityHealthCheck: null,
    activeOauthTokens: [],
    lowSecuritySessions: [],
    usersPasswordNeverExpires: [],
    guestAccessObjects: [],
    privilegedPermSets: [],
    asyncSharingUpdateActive: false,
    activeOutboundMessages: [],
    caseGuestProfiles: [],
    permissionSetGroupCount: 1,
    usersWithExcessivePermSets: [],
    clonedSysAdminProfiles: [],
    transactionSecurityPolicies: [{}],
    profilesWithNoUsers: [],
    permSetsWithNoAssignees: [],
    rolesWithNoUsers: [],
    allRoles: [],
    ...overrides,
  };
}

function findItem(items: any[], titleFragment: string) {
  return items.find(i => i.title.includes(titleFragment));
}

// ─── Regression: DML-in-loop regex crosses method boundaries ────────────────

describe('Regression: DML-in-loop (cross-method false positive)', () => {
  test('does NOT flag a class where loop and DML are in separate methods', () => {
    const body = `
      public class MyClass {
        public void loopMethod() {
          for (Account a : accounts) {
            System.debug(a.Name);
          }
        }
        public void saveMethod() {
          insert newAccount;
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'DML Operations in Loops');
    expect(item).toBeUndefined();
  });

  test('DOES flag a class where DML is genuinely inside a loop', () => {
    const body = `
      public class MyClass {
        public void badMethod() {
          for (Account a : accounts) {
            insert new Contact(LastName = a.Name);
          }
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'DML Operations in Loops');
    expect(item).toBeDefined();
    expect(item.severity).toBe('critical');
  });
});

// ─── Regression: CRUD check — Schema.sObjectType false positive ─────────────

describe('Regression: CRUD check — Schema.sObjectType false positive', () => {
  test('does NOT satisfy CRUD check by using Schema.sObjectType for introspection only', () => {
    const body = `
      public class MyClass {
        public void describeOnly() {
          Schema.SObjectType t = Schema.sObjectType.Account;
          insert new Account(Name = 'Test');
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'CRUD Permission Violations');
    expect(item).toBeDefined();
  });

  test('DOES satisfy CRUD check with isCreateable()', () => {
    const body = `
      public class MyClass {
        public void safeInsert() {
          if (Account.sObjectType.getDescribe().isCreateable()) {
            insert new Account(Name = 'Test');
          }
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'CRUD Permission Violations');
    expect(item).toBeUndefined();
  });

  test('DOES satisfy CRUD check with WITH USER_MODE', () => {
    const body = `
      public class MyClass {
        public void query() {
          List<Account> accs = [SELECT Id FROM Account WITH USER_MODE];
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'CRUD Permission Violations');
    expect(item).toBeUndefined();
  });
});

// ─── Regression: for-loop pattern — C-style loop with method call ────────────

describe('Regression: SOQL-in-loop — C-style for loop with method call', () => {
  test('flags SOQL inside C-style for loop with list.size() in condition', () => {
    const body = `
      public class MyClass {
        public void badLoop() {
          List<Account> accs = getAccounts();
          for (Integer i = 0; i < accs.size(); i++) {
            List<Contact> c = [SELECT Id FROM Contact WHERE AccountId = :accs[i].Id];
          }
        }
      }
    `;
    const result = assessCodeQuality(makeApex({ classes: [makeClass('MyClass', body)] }));
    const item = findItem(result.items, 'SOQL in Loops');
    expect(item).toBeDefined();
    expect(item.severity).toBe('critical');
  });
});

// ─── Regression: for:each missing key — per-occurrence check ────────────────

describe('Regression: LWC for:each missing key — per-occurrence', () => {
  test('flags a template that has one unkeyed for:each even if another has key=', () => {
    const goodAndBad = `
      <template>
        <template for:each={items} for:item="item">
          <p key={item.Id}>{item.Name}</p>
        </template>
        <template for:each={others} for:item="other">
          <p>{other.Name}</p>
        </template>
      </template>
    `;
    const bundle = { Id: 'bundle1', DeveloperName: 'TestCmp' };
    const resource = { LightningComponentBundleId: 'bundle1', Source: goodAndBad };
    const result = assessLwc(makeLwc({
      lwcBundles: [bundle],
      htmlResources: [resource],
    }));
    const item = findItem(result.items, 'for:each Without a key');
    expect(item).toBeDefined();
  });

  test('does NOT flag a template where every for:each has key=', () => {
    const allKeyed = `
      <template>
        <template for:each={items} for:item="item">
          <p key={item.Id}>{item.Name}</p>
        </template>
      </template>
    `;
    const bundle = { Id: 'bundle2', DeveloperName: 'GoodCmp' };
    const resource = { LightningComponentBundleId: 'bundle2', Source: allKeyed };
    const result = assessLwc(makeLwc({
      lwcBundles: [bundle],
      htmlResources: [resource],
    }));
    const item = findItem(result.items, 'for:each Without a key');
    expect(item).toBeUndefined();
  });
});

// ─── Regression: Process Builder double-count ────────────────────────────────

describe('Regression: Process Builder not double-counted', () => {
  test('assessConfiguration does NOT flag Process Builders', () => {
    const automation = makeAutomation({
      processBuilders: [{ Id: '1', MasterLabel: 'My PB', ProcessType: 'Workflow' }],
    });
    const result = assessConfiguration(automation, makeValidationRules());
    const item = findItem(result.items, 'Process Builder');
    expect(item).toBeUndefined();
  });

  test('assessFlowQuality DOES flag Process Builders', () => {
    const data = makeFlowQuality({
      processBuilderFlows: [{ Id: '1', MasterLabel: 'My PB', ProcessType: 'Workflow' }],
    });
    const result = assessFlowQuality(data);
    const item = findItem(result.items, 'Process Builder');
    expect(item).toBeDefined();
    expect(item.severity).toBe('high');
  });
});

// ─── Regression: Obsolete flows double-count ─────────────────────────────────

describe('Regression: Obsolete flow versions not double-counted', () => {
  test('assessPerformance does NOT flag obsolete flow versions', () => {
    const result = assessPerformance(makePerformance({ obsoleteFlowCount: 300 }));
    const item = findItem(result.items, 'Obsolete Flow Version');
    expect(item).toBeUndefined();
  });

  test('assessFlowQuality DOES flag obsolete flow versions > 50', () => {
    const result = assessFlowQuality(makeFlowQuality({ obsoleteFlowCount: 60 }));
    const item = findItem(result.items, 'Obsolete Flow Version');
    expect(item).toBeDefined();
    expect(item.severity).toBe('low');
  });

  test('assessFlowQuality uses medium severity when obsolete count > 300', () => {
    const result = assessFlowQuality(makeFlowQuality({ obsoleteFlowCount: 350 }));
    const item = findItem(result.items, 'Obsolete Flow Version');
    expect(item).toBeDefined();
    expect(item.severity).toBe('medium');
  });
});

// ─── Regression: DML-in-loop flows double-count ──────────────────────────────

describe('Regression: DML-in-loop flows not double-counted', () => {
  test('assessPerformance does NOT flag flows with DML in loops', () => {
    const result = assessPerformance(makePerformance({
      flowsWithDmlIds: ['flow1', 'flow2'],
      flowsWithLoopsIds: ['flow1'],
    }));
    const item = findItem(result.items, 'Database Operations Inside Loops');
    expect(item).toBeUndefined();
  });

  test('assessFlowQuality DOES flag flows with DML in loops', () => {
    const data = makeFlowQuality({
      flowsWithDmlInLoops: [{ Id: '1', MasterLabel: 'Bad Flow', ProcessType: 'AutoLaunchedFlow' }],
    });
    const result = assessFlowQuality(data);
    const item = findItem(result.items, 'Database Operations Inside Loops');
    expect(item).toBeDefined();
    expect(item.severity).toBe('high');
  });
});

// ─── Regression: External files double-deduction ─────────────────────────────

describe('Regression: External files double-deduction', () => {
  test('does NOT double-deduct when all external shares are permanent', () => {
    const result = assessNotesAttachments(makeNotes({
      externallySharedFileCount: 10,
      permanentlySharedFileCount: 10,
    }));
    const externalItem = findItem(result.items, 'Files Shared Externally via Content Delivery');
    const permanentItem = findItem(result.items, 'Files Shared Externally With No Expiry');
    // The external item should mention permanent shares, but the permanent item should NOT also fire
    expect(externalItem).toBeDefined();
    expect(permanentItem).toBeUndefined();
  });

  test('DOES flag permanently shared files separately when there are no other external shares', () => {
    const result = assessNotesAttachments(makeNotes({
      externallySharedFileCount: 0,
      permanentlySharedFileCount: 5,
    }));
    const item = findItem(result.items, 'No Expiry Date');
    expect(item).toBeDefined();
  });
});
