import {
  DebtItem,
  CategoryScore,
  AssessmentResult,
  AutomationData,
  ApexData,
  DataModelData,
  ServiceCloudData,
  ValidationRuleData,
  SharingSecurityData,
  IntegrationData,
  TestCoverageData,
  OrgLimitsData,
  DuplicateRulesData,
  ReportsDashboardsData,
  EmailTemplatesData,
  PlatformEventsData,
  ManagedPackagesData,
  CustomMetadataData,
  RecordTypesLayoutsData,
  EinsteinAIData,
  TerritoryData,
  ExperienceCloudData,
  ConnectedAppSecurityData
} from '../types/assessment';

const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2
};

function createDebtItem(
  category: DebtItem['category'],
  severity: DebtItem['severity'],
  title: string,
  description: string,
  recommendation: string,
  metadata?: Record<string, any>
): DebtItem {
  return {
    id: `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category,
    severity,
    title,
    description,
    recommendation,
    metadata
  };
}

export function assessConfiguration(
  automation: AutomationData,
  validationRules: ValidationRuleData
): CategoryScore {
  const items: DebtItem[] = [];

  // Check for active Workflow Rules (should be migrated to Flows)
  if (automation.workflowRules.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'high',
      `${automation.workflowRules.length} Active Workflow Rules`,
      'Workflow Rules are legacy automation. Salesforce recommends migrating to Flows.',
      'Use the Migrate to Flow tool in Setup to convert Workflow Rules to record-triggered flows.',
      { records: automation.workflowRules.map((r:any) => ({ name: r.Name, detail: r.TableEnumOrId })) }
    ));
  }

  // Check for Process Builders (should be migrated to Flows)
  if (automation.processBuilders.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'high',
      `${automation.processBuilders.length} Active Process Builders`,
      'Process Builders are deprecated. Salesforce will retire them in a future release.',
      'Migrate Process Builders to record-triggered flows using the Migrate to Flow tool.',
      { records: automation.processBuilders.map((r:any) => ({ name: r.MasterLabel || r.Label, detail: r.ProcessType })) }
    ));
  }

  // Check for automation overlap (multiple automations on same object)
  const automationByObject = new Map<string, number>();
  automation.allFlows.forEach(flow => {
    const label = flow.MasterLabel || flow.Label || '';
    const obj = flow.ProcessType === 'Workflow' ? label.split(' ')[0] : 'Unknown';
    automationByObject.set(obj, (automationByObject.get(obj) || 0) + 1);
  });
  automation.workflowRules.forEach(rule => {
    const obj = rule.TableEnumOrId;
    automationByObject.set(obj, (automationByObject.get(obj) || 0) + 1);
  });

  const overlappingObjects = Array.from(automationByObject.entries())
    .filter(([_, count]) => count > 3);
  if (overlappingObjects.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${overlappingObjects.length} Objects with Overlapping Automation`,
      'Multiple automation types on the same object increases complexity and risk of conflicts.',
      'Consolidate automation into a single flow per object where possible.',
      { objects: overlappingObjects }
    ));
  }

  // Check for high validation rule count per object
  if (validationRules.validationRules.length > 50) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${validationRules.validationRules.length} Active Validation Rules`,
      'A high number of validation rules increases complexity and can impact performance.',
      'Review and consolidate validation rules. Consider using flows for complex validations.',
      { count: validationRules.validationRules.length }
    ));
  }

  // Check for undocumented validation rules
  const undocumented = validationRules.validationRules.filter(
    (rule: any) => !rule.Description || rule.Description.trim() === ''
  );
  if (undocumented.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'low',
      `${undocumented.length} Validation Rules Without Descriptions`,
      'Validation rules without descriptions make it difficult for admins to understand their purpose.',
      'Add clear descriptions explaining the business rule each validation enforces.',
      { records: undocumented.map((r:any) => ({ name: r.ValidationName || r.DeveloperName || r.EntityDefinitionId })) }
    ));
  }

  // Classic Approval Processes — superseded by Flow Approval Processes (Spring '26)
  const activeApprovals = (automation.approvalProcesses || []).filter((a: any) => a.IsActive);
  if (activeApprovals.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${activeApprovals.length} Classic Approval Process${activeApprovals.length !== 1 ? 'es' : ''} Still Active`,
      `Classic Approval Processes are superseded by Flow Approval Processes as of Spring '26. ${activeApprovals.length} active process${activeApprovals.length !== 1 ? 'es' : ''} found.`,
      'Migrate Classic Approval Processes to Flow Approval Processes using the Approval Process migration tool or by rebuilding in Flow.',
      { records: activeApprovals.slice(0, 50).map((a: any) => ({ name: a.Name, detail: 'Classic Approval Process — superseded in Spring \'26' })) }
    ));
  }

  // Einstein for Flow actions — superseded by Agentforce for Flow (Spring '26)
  const einsteinFlowActions = automation.einsteinFlowActions || [];
  if (einsteinFlowActions.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'low',
      `${einsteinFlowActions.length} Flow${einsteinFlowActions.length !== 1 ? 's' : ''} Using Legacy Einstein for Flow Actions`,
      `Einstein for Flow has been superseded by Agentforce for Flow in Spring '26. ${einsteinFlowActions.length} active flow${einsteinFlowActions.length !== 1 ? 's' : ''} appear to reference legacy Einstein actions.`,
      'Review and migrate flows using Einstein for Flow to Agentforce for Flow actions in the Flow Builder.',
      { records: einsteinFlowActions.slice(0, 50).map((f: any) => ({ name: f.DeveloperName, detail: 'Uses legacy Einstein for Flow — superseded by Agentforce for Flow (Spring \'26)' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Configuration',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessCodeQuality(apex: ApexData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for triggers without handler pattern
  const triggersWithLogic = apex.triggers.filter((trigger: any) => {
    const body = trigger.Body || '';
    const lines = body.split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('//'));
    return lines.length > 10;
  });
  if (triggersWithLogic.length > 0) {
    items.push(createDebtItem(
      'code',
      'high',
      `${triggersWithLogic.length} Triggers with Business Logic`,
      'Triggers should delegate to handler classes. Logic in triggers is hard to test and maintain.',
      'Refactor triggers to call handler/service classes. Adopt a trigger framework.',
      { records: triggersWithLogic.map((t:any) => ({ name: t.Name, detail: `${t.TableEnumOrId || ''}` })) }
    ));
  }

  // Check for low test coverage
  const lowCoverage = apex.coverage.filter((c: any) => {
    const total = (c.NumLinesCovered || 0) + (c.NumLinesUncovered || 0);
    if (total === 0) return false;
    return (c.NumLinesCovered / total) < 0.75;
  });
  if (lowCoverage.length > 0) {
    const criticallyLow = lowCoverage.filter((c: any) => {
      const total = c.NumLinesCovered + c.NumLinesUncovered;
      return (c.NumLinesCovered / total) < 0.5;
    });
    items.push(createDebtItem(
      'code',
      criticallyLow.length > 5 ? 'critical' : 'high',
      `${lowCoverage.length} Classes/Triggers Below 75% Coverage`,
      `${criticallyLow.length} are below 50% coverage. Low coverage increases deployment risk.`,
      'Write meaningful unit tests focusing on business logic, not just coverage numbers.',
      { count: lowCoverage.length, criticalCount: criticallyLow.length }
    ));
  }

  // Check for outdated API versions
  const outdatedClasses = apex.classes.filter((c: any) => c.ApiVersion < 55);
  const outdatedTriggers = apex.triggers.filter((t: any) => t.ApiVersion < 55);
  const totalOutdated = outdatedClasses.length + outdatedTriggers.length;
  if (totalOutdated > 0) {
    items.push(createDebtItem(
      'code',
      'medium',
      `${totalOutdated} Components on Outdated API Versions`,
      'Components on old API versions may miss security patches and new platform features.',
      'Update API versions incrementally, testing each batch. Prioritize security-sensitive code.',
      { records: [...outdatedClasses.map((c:any) => ({ name: c.Name, detail: `Class · API v${c.ApiVersion}` })), ...outdatedTriggers.map((t:any) => ({ name: t.Name, detail: `Trigger · API v${t.ApiVersion}` }))] }
    ));
  }

  // Check for SOQL in loops (basic pattern detection)
  const soqlInLoops = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    const forLoopPattern = /for\s*\([^)]*\)\s*\{[^}]*\[SELECT/gi;
    const whileLoopPattern = /while\s*\([^)]*\)\s*\{[^}]*\[SELECT/gi;
    return forLoopPattern.test(body) || whileLoopPattern.test(body);
  });
  if (soqlInLoops.length > 0) {
    items.push(createDebtItem(
      'code',
      'critical',
      `${soqlInLoops.length} Classes with SOQL in Loops`,
      'SOQL queries inside loops cause governor limit exceptions in bulk operations.',
      'Move queries outside loops. Use collections and maps for bulk-safe patterns.',
      { records: soqlInLoops.map((c:any) => ({ name: c.Name })) }
    ));
  }

  // Check for hardcoded IDs
  const hardcodedIds = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    const idPattern = /['"][a-zA-Z0-9]{15,18}['"]/g;
    const matches = body.match(idPattern) || [];
    return matches.length > 0;
  });
  if (hardcodedIds.length > 0) {
    items.push(createDebtItem(
      'code',
      'high',
      `${hardcodedIds.length} Classes with Hardcoded IDs`,
      'Hardcoded Salesforce IDs break when deploying between environments.',
      'Use Custom Metadata Types, Custom Settings, or Custom Labels instead of hardcoded IDs.',
      { records: hardcodedIds.map((c:any) => ({ name: c.Name })) }
    ));
  }

  // SOAP login() usage — retired Spring '26 default, hard retirement Summer '27
  const soapLoginClasses = (apex.soapLoginApex || []);
  if (soapLoginClasses.length > 0) {
    items.push(createDebtItem(
      'code',
      'medium',
      `${soapLoginClasses.length} Apex Class${soapLoginClasses.length !== 1 ? 'es' : ''} May Use Legacy SOAP login()`,
      `The SOAP API login() method is disabled by default for new orgs in Spring '26 and fully retired in Summer '27. ${soapLoginClasses.length} Apex class${soapLoginClasses.length !== 1 ? 'es' : ''} with login/SOAP-related names found.`,
      'Replace SOAP login() authentication with OAuth 2.0 flows using Named Credentials and Connected Apps or External Client Apps.',
      { records: soapLoginClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'SOAP login() retired Spring \'26 (default); hard retirement Summer \'27' })) }
    ));
  }

  // My Domain enforcement — login.salesforce.com hardcoded in class names (Spring '26)
  const hardcodedLoginClasses = (apex.hardcodedLoginUrls || []);
  if (hardcodedLoginClasses.length > 0) {
    items.push(createDebtItem(
      'code',
      'high',
      `${hardcodedLoginClasses.length} Apex Class${hardcodedLoginClasses.length !== 1 ? 'es' : ''} May Reference Hardcoded Login URLs`,
      `My Domain login URL enforcement was applied to production orgs in Spring '26. Classes referencing login.salesforce.com or test.salesforce.com directly are non-compliant.`,
      'Update all Apex, integrations, and configurations to use the org\'s My Domain URL instead of login.salesforce.com or test.salesforce.com.',
      { records: hardcodedLoginClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'Possible hardcoded login URL — My Domain enforcement active since Spring \'26' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Code Quality',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessDataModel(data: DataModelData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for objects without descriptions
  const undescribedObjects = data.objects.filter(
    (obj: any) => !obj.Description || obj.Description.trim() === ''
  );
  if (undescribedObjects.length > 0) {
    items.push(createDebtItem(
      'dataModel',
      'low',
      `${undescribedObjects.length} Custom Objects Without Descriptions`,
      'Objects without descriptions make it hard for new team members to understand the data model.',
      'Add meaningful descriptions explaining what each object represents and its business purpose.',
      { count: undescribedObjects.length }
    ));
  }

  // Check for fields without descriptions
  const undescribedFields = data.fields.filter(
    (f: any) => !f.Description || f.Description.trim() === ''
  );
  const fieldRatio = data.fields.length > 0
    ? undescribedFields.length / data.fields.length
    : 0;
  if (fieldRatio > 0.5 && undescribedFields.length > 20) {
    items.push(createDebtItem(
      'dataModel',
      'medium',
      `${Math.round(fieldRatio * 100)}% of Custom Fields Lack Descriptions`,
      `${undescribedFields.length} of ${data.fields.length} custom fields have no description.`,
      'Document fields with their business purpose, valid values, and any dependencies.',
      { undescribed: undescribedFields.length, total: data.fields.length }
    ));
  }

  // Check for field sprawl (objects with too many custom fields)
  const fieldsByObject = new Map<string, number>();
  data.fields.forEach((f: any) => {
    const obj = f.TableEnumOrId;
    fieldsByObject.set(obj, (fieldsByObject.get(obj) || 0) + 1);
  });
  const bloatedObjects = Array.from(fieldsByObject.entries())
    .filter(([_, count]) => count > 100);
  if (bloatedObjects.length > 0) {
    items.push(createDebtItem(
      'dataModel',
      'high',
      `${bloatedObjects.length} Objects with 100+ Custom Fields`,
      'Objects with excessive fields indicate possible data model issues or unused fields.',
      'Audit field usage, archive unused fields, and consider splitting into related objects.',
      { records: bloatedObjects.map(([name, count]) => ({ name, detail: `${count} custom fields` })) }
    ));
  }

  // Check total custom objects count
  if (data.objects.length > 200) {
    items.push(createDebtItem(
      'dataModel',
      'medium',
      `${data.objects.length} Custom Objects in Org`,
      'A very high number of custom objects may indicate scope creep or abandoned features.',
      'Audit custom objects for usage. Archive or delete objects that are no longer needed.',
      { count: data.objects.length }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Data Model',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessServiceCloud(data: ServiceCloudData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for excessive case record types
  if (data.caseRecordTypes.length > 10) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.caseRecordTypes.length} Case Record Types`,
      'Too many record types adds complexity to page layouts, automation, and reporting.',
      'Consolidate record types where possible. Use picklist values for minor variations.',
      { records: data.caseRecordTypes.map((rt:any) => ({ name: rt.Name })) }
    ));
  }

  // Check for inactive case record types
  const inactiveRT = data.caseRecordTypes.filter((rt: any) => !rt.IsActive);
  if (inactiveRT.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'low',
      `${inactiveRT.length} Inactive Case Record Types`,
      'Inactive record types add clutter and confusion to the org.',
      'Delete inactive record types that are no longer needed after verifying no dependencies.',
      { count: inactiveRT.length }
    ));
  }

  // Check for excessive queues
  if (data.queues.length > 50) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.queues.length} Queues Configured`,
      'Excessive queues can indicate routing complexity that is hard to manage.',
      'Review queue usage and consolidate underutilized queues. Consider Omni-Channel routing.',
      { count: data.queues.length }
    ));
  }

  // Check for legacy assignment/escalation rules
  if (data.assignmentRules.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.assignmentRules.length} Case Assignment Rules`,
      'Assignment Rules are legacy. Consider migrating to Flow-based or Omni-Channel routing.',
      'Evaluate Omni-Channel for skills-based routing, or use Flow for assignment logic.',
      { count: data.assignmentRules.length }
    ));
  }

  if (data.escalationRules.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'low',
      `${data.escalationRules.length} Escalation Rules`,
      'Escalation Rules are functional but limited compared to Flow-based escalation.',
      'Consider migrating to time-based flows for more flexible escalation logic.',
      { count: data.escalationRules.length }
    ));
  }

  // Unverified Organization-Wide Email Addresses — fail silently no longer, fail hard (Spring '26)
  const unverifiedOWAs = (data.unverifiedOWAs || []);
  if (unverifiedOWAs.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'high',
      `${unverifiedOWAs.length} Unverified Organization-Wide Email Address${unverifiedOWAs.length !== 1 ? 'es' : ''}`,
      `As of Spring '26, unverified Organization-Wide Email Addresses fail to send entirely — they no longer fall back to noreply@salesforce.com. ${unverifiedOWAs.length} unverified address${unverifiedOWAs.length !== 1 ? 'es' : ''} found.`,
      'Verify all Organization-Wide Email Addresses in Setup → Organization-Wide Addresses. Each address must be verified by the mailbox owner before Spring \'26 enforcement.',
      { records: unverifiedOWAs.slice(0, 50).map((o: any) => ({ name: o.Address || o.Id, detail: 'Unverified OWA — emails from this address fail to send (Spring \'26)' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Service Cloud',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessSharingSecurity(data: SharingSecurityData): CategoryScore {
  const items: DebtItem[] = [];

  // Public OWD — any object with Public Read/Write or Public Read/Write/Transfer is critical
  const publicReadWrite = data.owdSettings.filter((obj: any) =>
    obj.InternalSharingModel === 'ReadWrite' || obj.InternalSharingModel === 'ReadWriteTransfer'
  );
  if (publicReadWrite.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'critical',
      `${publicReadWrite.length} Objects with Public Read/Write OWD`,
      'Objects with Public Read/Write sharing expose all records to all users, violating least-privilege.',
      'Change OWD to Private or Public Read Only, then use sharing rules to open up access as needed.',
      { records: publicReadWrite.map((o:any) => ({ name: o.QualifiedApiName, detail: o.InternalSharingModel })) }
    ));
  }

  // Public Read Only OWD (potential oversharing)
  const publicReadOnly = data.owdSettings.filter((obj: any) =>
    obj.InternalSharingModel === 'Read'
  );
  if (publicReadOnly.length > 5) {
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      `${publicReadOnly.length} Objects with Public Read Only OWD`,
      'Public Read Only OWD may expose sensitive records. Evaluate whether all users need visibility.',
      'Review each object and tighten OWD to Private where record-level access control is needed.',
      { records: publicReadOnly.map((o:any) => ({ name: o.QualifiedApiName })) }
    ));
  }

  // Too many profiles — difficult to maintain
  if (data.profiles.length > 20) {
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      `${data.profiles.length} Profiles Configured`,
      'Large numbers of profiles are difficult to maintain and audit for excess permissions.',
      'Consolidate to a minimal set of profiles. Use Permission Sets and Permission Set Groups for additive permissions.',
      { count: data.profiles.length }
    ));
  }

  // Permission Sets without descriptions
  const undocumentedPS = data.permissionSets.filter(
    (ps: any) => !ps.Description || ps.Description.trim() === ''
  );
  if (undocumentedPS.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'low',
      `${undocumentedPS.length} Permission Sets Without Descriptions`,
      'Undocumented permission sets make access reviews and audits error-prone.',
      'Add descriptions explaining what business role or use case each permission set serves.',
      { count: undocumentedPS.length }
    ));
  }

  // Excessive sharing rules (complexity risk)
  if (data.sharingRules.length > 50) {
    items.push(createDebtItem(
      'sharingSecurity',
      'high',
      `${data.sharingRules.length} Sharing Rules Configured`,
      'A high number of sharing rules indicates complex access patterns that are hard to audit.',
      'Review sharing rules for redundancy. Prefer role hierarchy and OWD adjustments over rules.',
      { count: data.sharingRules.length }
    ));
  }

  // API user checks
  const apiUsers = data.apiUsers || {};
  const allUsers: any[] = apiUsers.all || [];
  const integrationUsers: any[] = apiUsers.integrationUsers || [];
  const staleUsers: any[] = apiUsers.staleUsers || [];
  const broadPermUsers: any[] = apiUsers.broadPermUsers || [];

  // Users with Modify All Data — highest risk
  if (broadPermUsers.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'critical',
      `${broadPermUsers.length} Active Users with Modify All Data`,
      'Modify All Data grants unrestricted write access to every record in the org. This is a critical over-privilege.',
      'Revoke Modify All Data from all non-admin profiles. Use granular object permissions instead.',
      { records: broadPermUsers.map((u:any) => ({ name: u.Name, detail: `${u.Username} · ${u.Profile?.Name}` })) }
    ));
  }

  // Stale active users — no login in 90+ days
  if (staleUsers.length > 0) {
    const neverLoggedIn = staleUsers.filter((u: any) => !u.LastLoginDate);
    items.push(createDebtItem(
      'sharingSecurity',
      staleUsers.length > 20 ? 'high' : 'medium',
      `${staleUsers.length} Active Users Inactive for 90+ Days`,
      `${neverLoggedIn.length} have never logged in. Stale accounts are a common attack vector for credential stuffing.`,
      'Deactivate users who have not logged in within 90 days. Implement an offboarding process.',
      { records: staleUsers.map((u:any) => ({ name: u.Name, detail: `Last login: ${u.LastLoginDate ? new Date(u.LastLoginDate).toLocaleDateString() : 'Never'} · ${u.Profile?.Name}` })) }
    ));
  }

  // Integration/service account users with no IP restrictions
  if (integrationUsers.length > 0) {
    const profilesWithRanges = new Set((data.loginIpRanges || []).map((r: any) => r.ProfileId));
    const unrestrictedIntUsers = integrationUsers.filter(
      (u: any) => !profilesWithRanges.has(u.Profile?.Id || '') && u.Profile?.UserType !== 'Standard'
    );
    if (unrestrictedIntUsers.length > 0) {
      items.push(createDebtItem(
        'sharingSecurity',
        'high',
        `${integrationUsers.length} Integration/API Users Detected`,
        `Service account users with API-style profile names found. Verify each has IP restrictions and uses minimum required permissions.`,
        'Restrict integration user profiles to trusted IP ranges. Use Named Credentials instead of user credentials for callouts.',
        { records: integrationUsers.map((u:any) => ({ name: u.Name, detail: `${u.Username} · ${u.Profile?.Name}` })) }
      ));
    }
  }

  // Active users with no login IP range on their profile
  const profilesWithIpRanges = new Set((data.loginIpRanges || []).map((r: any) => r.ProfileId));
  const profilesWithoutRestrictions = (data.profiles || []).filter(
    (p: any) => p.UserType === 'Standard' && !profilesWithIpRanges.has(p.Id)
  );
  if (profilesWithoutRestrictions.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      `${profilesWithoutRestrictions.length} Standard Profiles Without Login IP Restrictions`,
      'Profiles with no IP range restrictions allow logins from any location, increasing brute-force and phishing exposure.',
      'Add trusted IP ranges to profiles, or enforce MFA as a compensating control for all unrestricted profiles.',
      { records: profilesWithoutRestrictions.map((p:any) => ({ name: p.Name })) }
    ));
  }

  // MFA: users not enrolled
  const enrolledIds = new Set(data.mfaEnrolledUserIds || []);
  const unenrolledUsers = allUsers.filter((u: any) => !enrolledIds.has(u.Id));
  if (allUsers.length > 0) {
    const unenrolledPct = Math.round((unenrolledUsers.length / allUsers.length) * 100);
    if (unenrolledUsers.length > 0) {
      items.push(createDebtItem(
        'sharingSecurity',
        unenrolledPct > 50 ? 'critical' : unenrolledPct > 20 ? 'high' : 'medium',
        `${unenrolledUsers.length} Active Users Not Enrolled in MFA (${unenrolledPct}%)`,
        `${unenrolledUsers.length} of ${allUsers.length} active standard users have no MFA method registered. Salesforce mandates MFA for all users.`,
        'Enable MFA enforcement in Setup > Identity > MFA for UI Logins. Use Salesforce Authenticator or TOTP. Track enrollment via the Identity Verification report.',
        { records: unenrolledUsers.map((u:any) => ({ name: u.Name, detail: `${u.Username} · Last login: ${u.LastLoginDate ? new Date(u.LastLoginDate).toLocaleDateString() : 'Never'}` })) }
      ));
    }
  }

  // Security Health Check score
  if (data.securityHealthCheck) {
    const shcScore = data.securityHealthCheck.Score;
    if (shcScore !== null && shcScore !== undefined) {
      if (shcScore < 50) {
        items.push(createDebtItem(
          'sharingSecurity',
          'critical',
          `Security Health Check Score: ${shcScore}/100`,
          'Salesforce Security Health Check is critically low. Multiple built-in security baselines are failing.',
          'Review the Security Health Check dashboard in Setup. Prioritize fixing all Critical and High risk items first.',
          { score: shcScore }
        ));
      } else if (shcScore < 75) {
        items.push(createDebtItem(
          'sharingSecurity',
          'high',
          `Security Health Check Score: ${shcScore}/100`,
          'Security Health Check is below the recommended threshold. Several security baselines are not met.',
          'Open Setup > Security > Health Check and resolve all High risk findings. Aim for a score above 80.',
          { score: shcScore }
        ));
      }
    }
  }

  // Active OAuth sessions (connected apps holding live tokens)
  if (data.activeOauthTokens.length > 100) {
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      `${data.activeOauthTokens.length} Active OAuth Access Tokens`,
      'A high volume of active OAuth tokens from connected apps increases the attack surface if any token is compromised.',
      'Audit connected apps in Setup. Revoke unused OAuth tokens. Set short token expiry windows on sensitive connected apps.',
      { count: data.activeOauthTokens.length }
    ));
  }

  // Sessions without MFA step-up (standard assurance level)
  if (data.lowSecuritySessions.length > 0) {
    const uniqueUsers = new Set(data.lowSecuritySessions.map((s: any) => s.UserId));
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      `${uniqueUsers.size} Users with Standard-Assurance Sessions (No MFA Step-Up)`,
      'These active sessions were authenticated without a high-assurance MFA challenge. Sensitive operations should require step-up auth.',
      'Configure Session Security Level policies in Setup to require High Assurance for sensitive permissions and connected apps.',
      { records: data.lowSecuritySessions.map((s:any) => ({ name: s.User?.Name || s.UserId, detail: s.LoginType })) }
    ));
  }

  // Users with passwords that never expire
  if (data.usersPasswordNeverExpires.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'high',
      `${data.usersPasswordNeverExpires.length} Users with Passwords That Never Expire`,
      'Non-expiring passwords increase the window of exposure if credentials are compromised.',
      'Remove the "Password Never Expires" permission from all profiles. Set org-wide password expiry to 90 days or less.',
      { records: data.usersPasswordNeverExpires.map((u:any) => ({ name: u.Name, detail: `${u.Username} · ${u.Profile?.Name}` })) }
    ));
  }

  // Active guest user sites (public-facing access)
  const activeSites = (data.guestAccessObjects || []).filter((s: any) => s.Status === 'Active');
  if (activeSites.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'high',
      `${activeSites.length} Active Sites with Guest User Access`,
      'Each active site exposes a guest user profile that can access org data without authentication. Guest profiles are a frequent source of data exposure.',
      'Audit guest user profile permissions for each site. Ensure OWD for sensitive objects is Private. Review guest-accessible Apex and Flows.',
      { records: activeSites.map((s:any) => ({ name: s.Name, detail: s.GuestUser?.Name || 'Guest User' })) }
    ));
  }

  // Phishing-resistant MFA for privileged users (active enforcement May 2026)
  const privilegedPermSets = (data.privilegedPermSets || []);
  if (privilegedPermSets.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'high',
      `${privilegedPermSets.length} Permission Set${privilegedPermSets.length !== 1 ? 's' : ''} Grant Privileged Access — Phishing-Resistant MFA Required`,
      `Salesforce now requires phishing-resistant MFA (hardware keys or passkeys) for users with System Administrator, Modify All Data, View All Data, Customize Application, or Author Apex permissions. ${privilegedPermSets.length} custom permission set${privilegedPermSets.length !== 1 ? 's' : ''} grant these elevated privileges.`,
      'Enforce phishing-resistant MFA (FIDO2 hardware keys or passkeys) for all users assigned these permission sets. Standard MFA (authenticator app) is no longer sufficient for privileged users.',
      { records: privilegedPermSets.slice(0, 50).map((p: any) => ({ name: p.Name, detail: 'Grants privileged permissions — phishing-resistant MFA required (enforced May 2026)' })) }
    ));
  }

  // Async Sharing Recalculation Release Update — enforced Spring '27
  if (!data.asyncSharingUpdateActive) {
    items.push(createDebtItem(
      'sharingSecurity',
      'medium',
      'Async Sharing Recalculation Release Update Not Activated',
      'The Asynchronous Sharing Recalculation Release Update is available in Spring \'26 and enforced in Spring \'27. Apex and Flows relying on synchronous sharing recalculation after role/group changes will break when enforced.',
      'Enable the Asynchronous Sharing Recalculation Release Update in Setup → Release Updates and test Apex classes and Flows that modify role hierarchy, group membership, or sharing rules.',
      {}
    ));
  }

  // Active Outbound Messages using Session IDs — retired February 2026
  const activeOutboundMessages = (data.activeOutboundMessages || []);
  if (activeOutboundMessages.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'high',
      `${activeOutboundMessages.length} Active Outbound Message${activeOutboundMessages.length !== 1 ? 's' : ''} — Session IDs Retired February 2026`,
      `Session IDs in Outbound Messages were retired in February 2026. ${activeOutboundMessages.length} active outbound message${activeOutboundMessages.length !== 1 ? 's' : ''} found — these are non-functional if they rely on Session ID authentication.`,
      'Migrate Outbound Message authentication from Session IDs to OAuth. Review each active Outbound Message in Setup → Workflow → Outbound Messages and update the receiving endpoint to use OAuth tokens.',
      { records: activeOutboundMessages.slice(0, 50).map((m: any) => ({ name: m.Name, detail: 'Active Outbound Message — Session ID auth retired Feb 2026' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Sharing & Security',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessIntegrations(data: IntegrationData): CategoryScore {
  const items: DebtItem[] = [];

  // Remote site settings with protocol security disabled
  const insecureRemoteSites = data.remoteSiteSettings.filter(
    (rs: any) => rs.DisableProtocolSecurity === true
  );
  if (insecureRemoteSites.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'critical',
      `${insecureRemoteSites.length} Remote Sites with Protocol Security Disabled`,
      'Disabling protocol security allows connections to sites with invalid SSL certificates.',
      'Re-enable protocol security. Fix certificate issues on target systems instead of bypassing validation.',
      { records: insecureRemoteSites.map((rs:any) => ({ name: rs.EndpointUrl })) }
    ));
  }

  // Inactive remote site settings (dead config)
  const inactiveRemoteSites = data.remoteSiteSettings.filter(
    (rs: any) => rs.IsActive === false
  );
  if (inactiveRemoteSites.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'low',
      `${inactiveRemoteSites.length} Inactive Remote Site Settings`,
      'Inactive remote site settings add clutter and may indicate abandoned integrations.',
      'Delete remote site settings for integrations that are no longer in use.',
      { records: inactiveRemoteSites.map((rs:any) => ({ name: rs.EndpointUrl })) }
    ));
  }

  // Connected apps without descriptions
  const undocumentedApps = data.connectedApps.filter(
    (app: any) => !app.Description || app.Description.trim() === ''
  );
  if (undocumentedApps.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'low',
      `${undocumentedApps.length} Connected Apps Without Descriptions`,
      'Undocumented connected apps make it impossible to audit which systems have access to the org.',
      'Document each connected app with its purpose, owning team, and data it accesses.',
      { records: undocumentedApps.map((a:any) => ({ name: a.Name })) }
    ));
  }

  // Apex classes with hardcoded endpoint URLs (not using Named Credentials)
  const hardcodedEndpoints = data.apexCallouts.filter((c: any) => {
    const body = c.Body || '';
    return /new\s+HttpRequest\(\)/.test(body) && /setEndpoint\s*\(\s*['"][^{]/.test(body);
  });
  if (hardcodedEndpoints.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'high',
      `${hardcodedEndpoints.length} Classes with Hardcoded HTTP Endpoints`,
      'Hardcoded endpoints bypass Named Credentials, exposing URLs/credentials and breaking across sandboxes.',
      'Migrate callouts to use Named Credentials so credentials are managed centrally and securely.',
      { records: hardcodedEndpoints.map((c:any) => ({ name: c.Name })) }
    ));
  }

  // Named credentials using per-user principal (harder to manage)
  const perUserCreds = data.namedCredentials.filter(
    (nc: any) => nc.PrincipalType === 'PerUser'
  );
  if (perUserCreds.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'medium',
      `${perUserCreds.length} Named Credentials Using Per-User Auth`,
      'Per-user named credentials require every user to authenticate, which breaks automated processes.',
      'Use Named Principal credentials for system integrations. Reserve Per-User only for user-delegated flows.',
      { records: perUserCreds.map((nc:any) => ({ name: nc.DeveloperName })) }
    ));
  }

  // API versions ≤30 — retired Summer '25, completely broken
  const retiredApiClasses = (data.retiredApiApexClasses || []);
  if (retiredApiClasses.length > 0) {
    items.push(createDebtItem(
      'integrations',
      'critical',
      `${retiredApiClasses.length} Apex Class${retiredApiClasses.length !== 1 ? 'es' : ''} on Retired API Versions (≤v30)`,
      `API versions 21.0–30.0 were retired in Summer '25. ${retiredApiClasses.length} Apex class${retiredApiClasses.length !== 1 ? 'es' : ''} are still on API versions ≤30 and are non-functional in production.`,
      'Immediately update all Apex classes on API versions ≤30 to a supported version (minimum v31, recommended v62+). These classes are broken in production.',
      { records: retiredApiClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: `API v${c.ApiVersion} — retired Summer '25, broken in production` })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Integrations',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessTestCoverage(data: TestCoverageData): CategoryScore {
  const items: DebtItem[] = [];

  const totalExecutable = data.apexClasses.length + data.apexTriggers.length;

  // Ratio of test classes to production classes
  if (totalExecutable > 0) {
    const testRatio = data.testClasses.length / totalExecutable;
    if (testRatio < 0.3) {
      items.push(createDebtItem(
        'testCoverage',
        'high',
        `Low Test Class Ratio (${data.testClasses.length} tests for ${totalExecutable} classes/triggers)`,
        'Too few test classes relative to production code. Complex business logic may be untested.',
        'Aim for at least one test class per trigger and one per service/handler class.',
        { testClasses: data.testClasses.length, productionComponents: totalExecutable }
      ));
    }
  }

  // Classes/triggers with 0% coverage (not tested at all)
  const coveredIds = new Set(data.coverage.map((c: any) => c.ApexClassOrTriggerId));
  const untestedClasses = data.apexClasses.filter((c: any) => !coveredIds.has(c.Id));
  const untestedTriggers = data.apexTriggers.filter((t: any) => !coveredIds.has(t.Id));
  const totalUntested = untestedClasses.length + untestedTriggers.length;
  if (totalUntested > 0) {
    items.push(createDebtItem(
      'testCoverage',
      'critical',
      `${totalUntested} Classes/Triggers with No Test Coverage`,
      `${untestedClasses.length} classes and ${untestedTriggers.length} triggers have zero coverage. These will block deployments.`,
      'Write at minimum a test class that exercises the primary happy path for each untested component.',
      { records: [...untestedClasses.map((c:any) => ({ name: c.Name, detail: 'Class · 0%' })), ...untestedTriggers.map((t:any) => ({ name: t.Name, detail: 'Trigger · 0%' }))] }
    ));
  }

  // Classes below 75% (Salesforce minimum is 75% org-wide, but individual matters)
  const lowCoverage = data.coverage.filter((c: any) => {
    const total = (c.NumLinesCovered || 0) + (c.NumLinesUncovered || 0);
    if (total === 0) return false;
    return (c.NumLinesCovered / total) < 0.75;
  });
  if (lowCoverage.length > 0) {
    const below50 = lowCoverage.filter((c: any) => {
      const total = c.NumLinesCovered + c.NumLinesUncovered;
      return (c.NumLinesCovered / total) < 0.5;
    });
    items.push(createDebtItem(
      'testCoverage',
      below50.length > 3 ? 'critical' : 'high',
      `${lowCoverage.length} Components Below 75% Test Coverage`,
      `${below50.length} components are below 50%. These are high-risk for deployment failures and regressions.`,
      'Prioritize test coverage for triggers, batch classes, and service classes first.',
      { total: lowCoverage.length, below50: below50.length }
    ));
  }

  // Triggers without a corresponding test class (by name convention)
  const triggerNames = data.apexTriggers.map((t: any) => t.Name.toLowerCase());
  const testClassNames = data.testClasses.map((t: any) => t.Name.toLowerCase());
  const triggersWithoutTest = triggerNames.filter(name =>
    !testClassNames.some(tc => tc.includes(name) || tc.includes(name.replace('trigger', '')))
  );
  if (triggersWithoutTest.length > 0) {
    items.push(createDebtItem(
      'testCoverage',
      'medium',
      `${triggersWithoutTest.length} Triggers Without a Dedicated Test Class`,
      'Triggers lacking a dedicated test class are often tested indirectly and incompletely.',
      'Create a dedicated test class per trigger that covers all trigger contexts (insert, update, delete, bulk).',
      { records: triggersWithoutTest.map((name:string) => ({ name })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Test Coverage',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

// Human-readable label map for Salesforce API limit names
const LIMIT_LABELS: Record<string, string> = {
  ActiveScratchOrgs: 'Active Scratch Orgs',
  AnalyticsExternalDataSizeMB: 'Analytics External Data (MB)',
  ConcurrentAsyncGetReportInstances: 'Concurrent Async Report Instances',
  ConcurrentEinsteinDataInsightsStoryCreation: 'Concurrent Einstein Insights Story Creation',
  ConcurrentEinsteinDiscoveryStoryCreation: 'Concurrent Einstein Discovery Story Creation',
  ConcurrentSyncReportRuns: 'Concurrent Sync Report Runs',
  DailyApiRequests: 'Daily API Requests',
  DailyAsyncApexExecutions: 'Daily Async Apex Executions',
  DailyBulkApiBatches: 'Daily Bulk API Batches',
  DailyBulkV2QueryFileStorageMB: 'Daily Bulk V2 Query File Storage (MB)',
  DailyBulkV2QueryJobs: 'Daily Bulk V2 Query Jobs',
  DailyDeliveredPlatformEvents: 'Daily Delivered Platform Events',
  DailyDurableGenericStreamingApiEvents: 'Daily Durable Generic Streaming Events',
  DailyDurableStreamingApiEvents: 'Daily Durable Streaming Events',
  DailyEinsteinDiscoveryPredictAPICalls: 'Daily Einstein Discovery Predict API Calls',
  DailyEinsteinDiscoveryPredictionsByCDC: 'Daily Einstein Discovery Predictions (CDC)',
  DailyFunctionsApiCallLimit: 'Daily Functions API Calls',
  DailyGenericStreamingApiEvents: 'Daily Generic Streaming Events',
  DailyPublishedPlatformEvents: 'Daily Published Platform Events',
  DailyPublishedStandardVolumePlatformEvents: 'Daily Published Standard Volume Platform Events',
  DailyScratchOrgs: 'Daily Scratch Orgs',
  DailyStreamingApiEvents: 'Daily Streaming API Events',
  DailyWorkflowEmails: 'Daily Workflow Emails',
  DataStorageMB: 'Data Storage (MB)',
  FileStorageMB: 'File Storage (MB)',
  HourlyAsyncReportRuns: 'Hourly Async Report Runs',
  HourlyDashboardRefreshes: 'Hourly Dashboard Refreshes',
  HourlyDashboardResults: 'Hourly Dashboard Results',
  HourlyDashboardStatuses: 'Hourly Dashboard Statuses',
  HourlyLongTermIdMapping: 'Hourly Long-Term ID Mapping',
  HourlyManagedContentPublicRequests: 'Hourly Managed Content Public Requests',
  HourlyODataCallout: 'Hourly OData Callout',
  HourlyPublishedPlatformEvents: 'Hourly Published Platform Events',
  HourlyPublishedStandardVolumePlatformEvents: 'Hourly Published Standard Volume Platform Events',
  HourlyShortTermIdMapping: 'Hourly Short-Term ID Mapping',
  HourlySyncReportRuns: 'Hourly Sync Report Runs',
  HourlyTimeBasedWorkflow: 'Hourly Time-Based Workflow',
  MassEmail: 'Mass Email',
  MaxConcurrentStaticResourceRequests: 'Max Concurrent Static Resource Requests',
  MonthlyEinsteinDiscoveryCommits: 'Monthly Einstein Discovery Commits',
  MonthlyPlatformEventsUsageEntitlement: 'Monthly Platform Events Entitlement',
  Package2VersionCreates: 'Package2 Version Creates',
  Package2VersionCreatesWithoutValidation: 'Package2 Version Creates (No Validation)',
  PermissionSets: 'Permission Sets',
  SingleEmail: 'Single Email',
  StreamingApiConcurrentClients: 'Streaming API Concurrent Clients'
};

export function assessOrgLimits(data: OrgLimitsData): CategoryScore {
  const items: DebtItem[] = [];

  const critical = data.limits.filter(l => l.usedPct >= 90);
  const high = data.limits.filter(l => l.usedPct >= 75 && l.usedPct < 90);
  const medium = data.limits.filter(l => l.usedPct >= 50 && l.usedPct < 75);

  critical.forEach(l => {
    const label = LIMIT_LABELS[l.name] || l.name;
    items.push(createDebtItem(
      'orgLimits',
      'critical',
      `${label}: ${l.usedPct}% Used (${l.used.toLocaleString()} / ${l.max.toLocaleString()})`,
      `This limit is critically close to exhaustion. At 100% the org will begin rejecting operations dependent on this limit.`,
      `Immediately review usage and reduce consumption. Contact Salesforce to purchase additional capacity if needed.`,
      { name: l.name, used: l.used, max: l.max, remaining: l.remaining, usedPct: l.usedPct }
    ));
  });

  high.forEach(l => {
    const label = LIMIT_LABELS[l.name] || l.name;
    items.push(createDebtItem(
      'orgLimits',
      'high',
      `${label}: ${l.usedPct}% Used (${l.used.toLocaleString()} / ${l.max.toLocaleString()})`,
      `This limit is at high utilization and could be exhausted under peak load.`,
      `Monitor this limit closely. Optimize usage patterns and plan for capacity increases before hitting the ceiling.`,
      { name: l.name, used: l.used, max: l.max, remaining: l.remaining, usedPct: l.usedPct }
    ));
  });

  medium.forEach(l => {
    const label = LIMIT_LABELS[l.name] || l.name;
    items.push(createDebtItem(
      'orgLimits',
      'medium',
      `${label}: ${l.usedPct}% Used (${l.used.toLocaleString()} / ${l.max.toLocaleString()})`,
      `This limit is trending toward high utilization. Worth monitoring as usage grows.`,
      `Review usage trends over time. Optimize if growth is steady to avoid future incidents.`,
      { name: l.name, used: l.used, max: l.max, remaining: l.remaining, usedPct: l.usedPct }
    ));
  });

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Org Limits',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessDuplicateRules(data: DuplicateRulesData): CategoryScore {
  const items: DebtItem[] = [];

  const inactiveRules = data.duplicateRules.filter((r: any) => !r.IsActive);
  if (data.duplicateRules.length === 0) {
    items.push(createDebtItem('duplicateRules', 'high', 'No Duplicate Rules Configured',
      'Without duplicate rules, duplicate records accumulate silently and degrade data quality.',
      'Create duplicate rules for Account, Contact, and Lead using standard or custom matching rules.'));
  } else if (inactiveRules.length > 0) {
    items.push(createDebtItem('duplicateRules', 'medium', `${inactiveRules.length} Inactive Duplicate Rules`,
      'Inactive duplicate rules provide no protection against duplicates.',
      'Activate all duplicate rules or delete ones that are no longer relevant.',
      { count: inactiveRules.length }));
  }

  if (data.matchingRules.length === 0) {
    items.push(createDebtItem('duplicateRules', 'high', 'No Matching Rules Configured',
      'Matching rules define how Salesforce identifies duplicates. Without them, duplicate detection cannot function.',
      'Create matching rules for the key objects your org uses (Account, Contact, Lead).'));
  }

  const undocumented = data.duplicateRules.filter((r: any) => !r.Description || r.Description.trim() === '');
  if (undocumented.length > 0) {
    items.push(createDebtItem('duplicateRules', 'low', `${undocumented.length} Duplicate Rules Without Descriptions`,
      'Undocumented rules make it hard to audit or modify duplicate prevention logic.',
      'Add descriptions explaining the business purpose of each duplicate rule.',
      { count: undocumented.length }));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Duplicate & Matching Rules', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessReportsDashboards(data: ReportsDashboardsData): CategoryScore {
  const items: DebtItem[] = [];

  const staleReportPct = data.totalReports > 0 ? Math.round((data.staleReports.length / data.totalReports) * 100) : 0;
  if (data.staleReports.length > 50) {
    items.push(createDebtItem('reportsDashboards', staleReportPct > 50 ? 'high' : 'medium',
      `${data.staleReports.length} Reports Not Run in 6+ Months (${staleReportPct}% of total)`,
      'Stale reports waste storage and clutter the org. Users may rely on outdated data if they run them.',
      'Delete or archive reports not run in over 6 months. Review report ownership and establish a cleanup cadence.',
      { count: data.staleReports.length, total: data.totalReports }));
  }

  const staleDashPct = data.totalDashboards > 0 ? Math.round((data.staleDashboards.length / data.totalDashboards) * 100) : 0;
  if (data.staleDashboards.length > 20) {
    items.push(createDebtItem('reportsDashboards', staleDashPct > 50 ? 'high' : 'medium',
      `${data.staleDashboards.length} Dashboards Not Viewed in 6+ Months (${staleDashPct}% of total)`,
      'Unused dashboards indicate abandoned initiatives or poor adoption.',
      'Delete dashboards not viewed in 6 months. Consolidate active dashboards by team or function.',
      { count: data.staleDashboards.length, total: data.totalDashboards }));
  }

  if (data.totalReports > 2000) {
    items.push(createDebtItem('reportsDashboards', 'medium', `${data.totalReports} Total Reports in Org`,
      'An extremely high report count is difficult to govern and slows report folder navigation.',
      'Implement a report governance policy. Set report retention rules and assign owners.',
      { total: data.totalReports }));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Reports & Dashboards', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessEmailTemplates(data: EmailTemplatesData): CategoryScore {
  const items: DebtItem[] = [];

  if (data.classicTemplates.length > 0) {
    items.push(createDebtItem('emailTemplates', 'medium',
      `${data.classicTemplates.length} Classic (Non-Lightning) Email Templates`,
      'Classic email templates (Text, HTML, Visualforce) are legacy and do not support modern branding or responsive design.',
      'Migrate Classic templates to Lightning Email Templates (custom3 type) for consistent branding and drag-and-drop editing.',
      { count: data.classicTemplates.length }));
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const allTemplates = [...data.classicTemplates, ...data.lightningTemplates];
  const staleTemplates = allTemplates.filter((t: any) => t.LastModifiedDate && new Date(t.LastModifiedDate) < twoYearsAgo);
  if (staleTemplates.length > 0) {
    items.push(createDebtItem('emailTemplates', 'low',
      `${staleTemplates.length} Email Templates Not Modified in 2+ Years`,
      'Stale templates may contain outdated branding, links, or messaging.',
      'Review templates not updated in 2 years. Archive or delete those no longer in use.',
      { count: staleTemplates.length }));
  }

  if (allTemplates.length === 0) {
    items.push(createDebtItem('emailTemplates', 'low', 'No Email Templates Found',
      'No email templates detected. If email is used in automation or Service Cloud, templates should be standardised.',
      'Create and standardise Lightning Email Templates for common communications.'));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Email Templates', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessPlatformEvents(data: PlatformEventsData): CategoryScore {
  const items: DebtItem[] = [];

  if (data.platformEvents.length > 0 && data.eventBusSubscribers.length === 0) {
    items.push(createDebtItem('platformEvents', 'high',
      `${data.platformEvents.length} Platform Event Channels with No Active Subscribers`,
      'Platform events with no subscribers are producing events that nobody is consuming — wasted processing and potential limit consumption.',
      'Audit platform event usage. Remove events no longer consumed, or wire up missing subscribers.',
      { count: data.platformEvents.length }));
  }

  if (data.cdcEntities.length > 20) {
    items.push(createDebtItem('platformEvents', 'medium',
      `${data.cdcEntities.length} Change Data Capture Entities Enabled`,
      'A high number of CDC entities increases event volume and may push the org toward daily event limits.',
      'Enable CDC only for objects with active consumers. Review and disable unused CDC entities.',
      { count: data.cdcEntities.length }));
  }

  if (data.platformEvents.length === 0 && data.cdcEntities.length === 0) {
    items.push(createDebtItem('platformEvents', 'low', 'No Platform Events or CDC Configured',
      'Platform Events and Change Data Capture are not in use. This is informational — not a debt item unless integrations require real-time events.',
      'Consider Platform Events for loosely-coupled integrations as a modern alternative to polling APIs.'));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Platform Events & CDC', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessManagedPackages(data: ManagedPackagesData): CategoryScore {
  const items: DebtItem[] = [];

  if (data.packages.length > 20) {
    items.push(createDebtItem('managedPackages', 'medium',
      `${data.packages.length} Managed Packages Installed`,
      'A high number of installed packages increases org complexity and the risk of conflicts, governor limit pressure, and security exposure.',
      'Audit installed packages. Uninstall any that are unused or have been replaced.',
      { count: data.packages.length }));
  }

  const betaPackages = data.packages.filter((p: any) => p.ReleaseState === 'Beta');
  if (betaPackages.length > 0) {
    items.push(createDebtItem('managedPackages', 'high',
      `${betaPackages.length} Beta Managed Packages Installed in Org`,
      'Beta packages are not supported for production use and may be unstable.',
      'Replace beta packages with GA versions or remove if no longer needed.',
      { records: betaPackages.map((p:any) => ({ name: p.Name, detail: `v${p.MajorVersion}.${p.MinorVersion}.${p.PatchVersion} · Beta` })) }));
  }

  if (data.packages.length > 0) {
    items.push(createDebtItem('managedPackages', 'low',
      `${data.packages.length} Managed Packages — Review for Currency`,
      'Installed packages should be kept up to date to receive security patches and stay compatible with Salesforce releases.',
      'Check each package version against the AppExchange listing. Subscribe to release notes for critical packages.',
      { records: data.packages.map((p:any) => ({ name: p.Name, detail: `v${p.MajorVersion}.${p.MinorVersion}.${p.PatchVersion} · ${p.ReleaseState}` })) }));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Managed Packages', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessCustomMetadata(data: CustomMetadataData): CategoryScore {
  const items: DebtItem[] = [];

  if (data.customSettings.length > 0) {
    items.push(createDebtItem('customMetadata', 'medium',
      `${data.customSettings.length} Custom Settings in Use`,
      'Custom Settings are a legacy configuration pattern. Custom Metadata Types are the modern replacement — they support deployment via change sets and packages.',
      'Migrate Custom Settings to Custom Metadata Types wherever they store org-wide or profile-level configuration.',
      { records: data.customSettings.map((s:any) => ({ name: s.DeveloperName, detail: s.SettingType || 'Custom Setting' })) }));
  }

  const undocumentedSettings = data.customSettings.filter((s: any) => !s.Description || s.Description.trim() === '');
  if (undocumentedSettings.length > 0) {
    items.push(createDebtItem('customMetadata', 'low',
      `${undocumentedSettings.length} Custom Settings Without Descriptions`,
      'Undocumented Custom Settings make it impossible to audit their purpose during deployments.',
      'Add descriptions to all Custom Settings explaining their purpose and valid value ranges.',
      { count: undocumentedSettings.length }));
  }

  if (data.customSettings.length > 0 && data.customMetadataTypes.length === 0) {
    items.push(createDebtItem('customMetadata', 'medium',
      'No Custom Metadata Types Found — All Config Uses Custom Settings',
      'The org relies entirely on Custom Settings for configuration, missing deployment and packaging benefits of Custom Metadata Types.',
      'Begin migrating new configuration patterns to Custom Metadata Types. Prioritise settings used in multi-environment deployments.'));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Custom Metadata & Settings', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessRecordTypesLayouts(data: RecordTypesLayoutsData): CategoryScore {
  const items: DebtItem[] = [];

  const inactiveRT = data.recordTypes.filter((rt: any) => !rt.IsActive);
  if (inactiveRT.length > 0) {
    items.push(createDebtItem('recordTypesLayouts', 'medium',
      `${inactiveRT.length} Inactive Record Types`,
      'Inactive record types create noise in setup and may still be referenced by flows or assignment rules.',
      'Delete inactive record types after confirming no automation references them.',
      { records: inactiveRT.map((rt:any) => ({ name: rt.Name, detail: rt.SobjectType })) }));
  }

  if (data.recordTypes.length > 100) {
    items.push(createDebtItem('recordTypesLayouts', 'medium',
      `${data.recordTypes.length} Custom Record Types Across Org`,
      'A very high record type count indicates complexity that can make page layouts, profiles, and automation hard to manage.',
      'Audit record types for each object. Consolidate where minor variations can be handled with picklist values.',
      { count: data.recordTypes.length }));
  }

  const undocumentedRT = data.recordTypes.filter((rt: any) => !rt.Description || rt.Description.trim() === '');
  if (undocumentedRT.length > 10) {
    items.push(createDebtItem('recordTypesLayouts', 'low',
      `${undocumentedRT.length} Record Types Without Descriptions`,
      'Undocumented record types make it hard to understand their business purpose during audits.',
      'Add descriptions to all record types explaining the business scenario they represent.',
      { count: undocumentedRT.length }));
  }

  if (data.pageLayouts.length > 100) {
    items.push(createDebtItem('recordTypesLayouts', 'medium',
      `${data.pageLayouts.length} Page Layouts Configured`,
      'Excessive page layouts are hard to maintain and keep in sync as objects evolve.',
      'Consolidate page layouts. Consider Dynamic Forms on Lightning pages to replace layout proliferation.',
      { count: data.pageLayouts.length }));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Record Types & Page Layouts', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessEinsteinAI(data: EinsteinAIData): CategoryScore {
  const items: DebtItem[] = [];

  const settings: Record<string, string> = {};
  (data.einsteinSettings || []).forEach((s: any) => { settings[s.SettingName] = s.SettingValue; });

  const einsteinEnabled = settings['EinsteinGptEnabled'] === 'true' || settings['AgentforceEnabled'] === 'true';
  const predictionBuilderEnabled = settings['EinsteinPredictionBuilderEnabled'] === 'true';
  if (!einsteinEnabled) {
    items.push(createDebtItem('einsteinAI', 'low',
      'Einstein Generative AI / Agentforce Not Enabled',
      'Einstein Generative AI and Agentforce are not enabled in this org.',
      'Enable Einstein Generative AI in Setup if the org has the required licenses. Evaluate Agentforce for automation use cases.'));
  }

  if (predictionBuilderEnabled && data.promptTemplates.length === 0) {
    items.push(createDebtItem('einsteinAI', 'medium',
      'Einstein Enabled but No Prompt Templates Configured',
      'Einstein features are active but no prompt templates are defined, suggesting AI features are enabled but not implemented.',
      'Either configure prompt templates for your AI use cases or disable unused Einstein features to reduce confusion.'));
  }

  if (data.bots && (data.bots as any[]).length > 0) {
    const inactiveBots = (data.bots as any[]).filter((b: any) => b.Status !== 'Active');
    if (inactiveBots.length > 0) {
      items.push(createDebtItem('einsteinAI', 'medium',
        `${inactiveBots.length} Inactive Bot/Agent Definitions`,
        'Inactive bots or Agentforce agent definitions indicate abandoned AI implementations.',
        'Delete inactive bot definitions that are not planned for reactivation to keep the org clean.',
        { records: inactiveBots.map((b:any) => ({ name: b.DeveloperName, detail: b.Status })) }));
    }
  }

  if (einsteinEnabled && data.promptTemplates.length === 0 && (!data.bots || (data.bots as any[]).length === 0)) {
    items.push(createDebtItem('einsteinAI', 'low',
      'Einstein/Agentforce Enabled but No Implementation Found',
      'AI features are enabled but no prompt templates or agents are configured. License may be unused.',
      'Evaluate current Einstein license utilisation. Plan AI use cases or discuss with Salesforce if licenses can be reallocated.'));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Einstein & AI Usage', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessTerritory(data: TerritoryData): CategoryScore {
  const items: DebtItem[] = [];

  if (data.territoryModels.length === 0) {
    items.push(createDebtItem('territory', 'low',
      'Territory Management Not Configured',
      'Territory Management is not in use. This is informational — only relevant if the org uses territory-based sales coverage.',
      'If territory-based coverage is needed, set up Territory2 models. Otherwise no action required.'));
    const maxScore = 100;
    return { category: 'Territory Management', score: maxScore, maxScore, percentage: 100, items };
  }

  const activeModels = data.territoryModels.filter((m: any) => m.State === 'Active');
  const draftModels = data.territoryModels.filter((m: any) => m.State === 'Planning');
  if (draftModels.length > 0) {
    items.push(createDebtItem('territory', 'medium',
      `${draftModels.length} Territory Models Still in Planning State`,
      'Territory models in Planning state are not live. If these are abandoned plans, they add confusion.',
      'Activate territory models that are ready, or archive Planning models that are no longer in use.',
      { records: draftModels.map((m:any) => ({ name: m.Name, detail: 'Planning' })) }));
  }

  if (activeModels.length > 1) {
    items.push(createDebtItem('territory', 'medium',
      `${activeModels.length} Active Territory Models`,
      'Multiple active territory models can cause confusion and conflict in opportunity assignment.',
      'Consolidate to a single active territory model. Archive models from prior fiscal years.',
      { count: activeModels.length }));
  }

  const inactiveRules = data.assignmentRules.filter((r: any) => !r.IsActive);
  if (inactiveRules.length > 0) {
    items.push(createDebtItem('territory', 'low',
      `${inactiveRules.length} Inactive Territory Assignment Rules`,
      'Inactive territory rules are dead configuration and may confuse admins.',
      'Delete inactive territory assignment rules that are no longer needed.',
      { count: inactiveRules.length }));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Territory Management', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessExperienceCloud(data: ExperienceCloudData): CategoryScore {
  const items: DebtItem[] = [];

  const activeSites = (data.sites || []).filter((s: any) => s.Status === 'Active');
  const allNetworks = data.networks || [];
  const customDomains = data.customDomains || [];

  // 1. Aura/Visualforce templates still in use (legacy)
  const legacyTemplateSites = activeSites.filter((s: any) =>
    s.Template && (s.Template.toLowerCase().includes('aura') || s.Template.toLowerCase().includes('visualforce') || s.Template.toLowerCase().includes('aloha'))
  );
  if (legacyTemplateSites.length > 0) {
    items.push(createDebtItem('experienceCloud', 'high',
      `${legacyTemplateSites.length} Sites Using Legacy Template (Aura/Visualforce)`,
      'Aura and Visualforce-based Experience Cloud templates are legacy. LWR (Lightning Web Runtime) delivers significantly better performance and is Salesforce\'s strategic direction.',
      'Plan migration to LWR-based templates. LWR sites support headless and composable architecture and receive Salesforce investment first.',
      { records: legacyTemplateSites.map((s:any) => ({ name: s.Name, detail: s.Template || 'Legacy Template' })) }));
  }

  // 2. Inactive / draft sites never published (stale config)
  const inactiveSites = (data.sites || []).filter((s: any) => s.Status !== 'Active');
  if (inactiveSites.length > 0) {
    items.push(createDebtItem('experienceCloud', 'low',
      `${inactiveSites.length} Inactive/Draft Experience Cloud Sites`,
      'Sites that were never published or are no longer active remain in the org as configuration debt.',
      'Delete or archive inactive sites that are no longer needed to keep the org clean.',
      { records: inactiveSites.map((s:any) => ({ name: s.Name, detail: s.Status })) }));
  }

  // 3. Self-registration enabled (governance/spam risk)
  const selfRegNetworks = allNetworks.filter((n: any) => n.SelfRegistrationEnabled === true);
  if (selfRegNetworks.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${selfRegNetworks.length} Sites with Self-Registration Enabled`,
      'Self-registration allows anyone on the internet to create an account. Without proper validation and approval workflows this can lead to spam accounts and unauthorized data access.',
      'Add reCAPTCHA, email domain restrictions, or an approval workflow. Ensure the self-registration Apex handler validates input and limits record access.',
      { records: selfRegNetworks.map((n:any) => ({ name: n.Name })) }));
  }

  // 4. Guest user access enabled on active sites
  const guestSites = activeSites.filter((s: any) => s.GuestUserId && s.GuestUser?.IsActive);
  if (guestSites.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${guestSites.length} Active Sites with Guest User Access`,
      'Guest users can access org data without authentication. Guest profiles are a frequent source of data exposure if OWD and sharing rules are not locked down.',
      'Audit the guest user profile on each site. Ensure sensitive objects are Private in OWD. Review all Apex, Flows, and Visualforce accessible to the guest profile.',
      { records: guestSites.map((s:any) => ({ name: s.Name, detail: s.GuestUser?.Name || 'Guest User' })) }));
  }

  // 5. Active sites without a custom domain (still on *.force.com or *.salesforce.com)
  const siteIdsWithCustomDomain = new Set(customDomains.map((d: any) => d.SiteId));
  const sitesWithoutCustomDomain = activeSites.filter((s: any) => !siteIdsWithCustomDomain.has(s.Id));
  if (sitesWithoutCustomDomain.length > 0) {
    items.push(createDebtItem('experienceCloud', 'low',
      `${sitesWithoutCustomDomain.length} Active Sites Without a Custom Domain`,
      'Sites running on the default *.force.com or *.site.com domain look unprofessional and may trigger browser trust warnings for end users.',
      'Configure a branded custom domain in Setup → Domains. Apply an SSL certificate for the custom domain.',
      { records: sitesWithoutCustomDomain.map((s:any) => ({ name: s.Name })) }));
  }

  // 6. Too many active sites (governance flag)
  if (activeSites.length > 5) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${activeSites.length} Active Experience Cloud Sites — Review for Governance`,
      'A large number of active sites can indicate ungoverned proliferation. Each site introduces a guest profile, sharing model surface, and ongoing maintenance burden.',
      'Establish a site governance process. Consolidate sites where possible and ensure each active site has a named owner and documented purpose.',
      { count: activeSites.length }));
  }

  // 7. CDN not enabled on public-facing sites
  const publicSitesWithoutCdn = allNetworks.filter((n: any) =>
    n.Status === 'Live' && n.CdnBasedOnLocation === false
  );
  if (publicSitesWithoutCdn.length > 0) {
    items.push(createDebtItem('experienceCloud', 'low',
      `${publicSitesWithoutCdn.length} Live Sites Without CDN Enabled`,
      'CDN (Content Delivery Network) improves page load time for geographically distributed users by caching static assets closer to the visitor.',
      'Enable CDN in Experience Builder → Administration → General for each public-facing site.',
      { records: publicSitesWithoutCdn.map((n:any) => ({ name: n.Name })) }));
  }

  // 8. HTTPS not enforced on custom domains
  const insecureDomains = customDomains.filter((d: any) => d.HttpsOption !== 'Required');
  if (insecureDomains.length > 0) {
    items.push(createDebtItem('experienceCloud', 'high',
      `${insecureDomains.length} Custom Domains Without HTTPS Enforced`,
      'Allowing non-HTTPS connections exposes session tokens and data in transit.',
      'Set HTTPS Option to "Required" on all custom domains in Setup → Domains.',
      { records: insecureDomains.map((d:any) => ({ name: d.Domain, detail: `HTTPS: ${d.HttpsOption || 'Not Required'}` })) }));
  }

  // WCAG 2.2 Accessibility Release Updates — enforced Summer '26
  if (!data.wcagUpdatesActive) {
    items.push(createDebtItem(
      'experienceCloud',
      'medium',
      'WCAG 2.2 Accessibility Release Updates Not Enabled',
      'Salesforce WCAG 2.2 accessibility Release Updates (Page Headers, Modal Windows, Date Pickers, Popovers, Utility Bars, Record Headers) are enforced in Summer \'26. Orgs that have not enabled them will have them force-applied, which may alter page layouts.',
      'Enable the chained WCAG 2.2 accessibility Release Updates in Setup → Release Updates in order: Update 1 first (Page Headers & Modals), then Update 2 (Date Pickers, Popovers, etc.). Test Experience Cloud pages and Lightning pages for layout changes before Summer \'26 enforcement.',
      {}
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Experience Cloud', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessConnectedAppSecurity(data: ConnectedAppSecurityData): CategoryScore {
  const items: DebtItem[] = [];

  const apps = data.connectedApps || [];
  const tokens = data.oauthTokens || [];

  // 1. Apps without session timeout set
  const noTimeout = apps.filter((a: any) => !a.MobileSessionTimeout || a.MobileSessionTimeout === 'None');
  if (noTimeout.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'high',
      `${noTimeout.length} Connected Apps Without Session Timeout`,
      'Connected apps with no session timeout allow OAuth tokens to remain valid indefinitely, increasing exposure if a token is compromised.',
      'Set a session timeout on all connected apps in Setup → App Manager → Manage → Edit Policies.',
      { records: noTimeout.map((a: any) => ({ name: a.Name })) }
    ));
  }

  // 2. Apps without descriptions (ungoverned / unauditable)
  const noDesc = apps.filter((a: any) => !a.Description || a.Description.trim() === '');
  if (noDesc.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'medium',
      `${noDesc.length} Connected Apps Without Descriptions`,
      'Undocumented connected apps cannot be audited for purpose, owner, or data access. Shadow IT and abandoned apps are a common source of credential leaks.',
      'Add a description to every connected app including its owner, purpose, and what data it accesses.',
      { records: noDesc.map((a: any) => ({ name: a.Name })) }
    ));
  }

  // 3. Apps with high active token count (broad OAuth exposure)
  const tokensByApp: Record<string, number> = {};
  tokens.forEach((t: any) => {
    tokensByApp[t.AppName] = (tokensByApp[t.AppName] || 0) + 1;
  });
  const highVolumeApps = Object.entries(tokensByApp)
    .filter(([_, count]) => count > 20)
    .sort((a, b) => b[1] - a[1]);
  if (highVolumeApps.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'medium',
      `${highVolumeApps.length} Connected Apps with 20+ Active OAuth Tokens`,
      'Apps with many active tokens represent broad OAuth exposure. A compromised app credential could affect all those users simultaneously.',
      'Review whether each high-volume app requires access for all those users. Restrict app access via profiles or permission sets where possible.',
      { records: highVolumeApps.map(([name, count]) => ({ name, detail: `${count} active tokens` })) }
    ));
  }

  // 4. Stale OAuth tokens — apps not used in 90+ days but still holding live tokens
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const staleTokens = tokens.filter((t: any) =>
    !t.LastUsedDate || new Date(t.LastUsedDate) < ninetyDaysAgo
  );
  const staleByApp: Record<string, number> = {};
  staleTokens.forEach((t: any) => {
    staleByApp[t.AppName] = (staleByApp[t.AppName] || 0) + 1;
  });
  const staleApps = Object.entries(staleByApp).sort((a, b) => b[1] - a[1]);
  if (staleApps.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'high',
      `${staleTokens.length} Stale OAuth Tokens Not Used in 90+ Days`,
      'Live tokens for apps that haven\'t been used in 90+ days represent dormant credentials. If compromised, the breach may go unnoticed.',
      'Revoke stale OAuth tokens in Setup → Connected Apps OAuth Usage. Configure token expiry policies to auto-expire idle sessions.',
      { records: staleApps.map(([name, count]) => ({ name, detail: `${count} stale token${count > 1 ? 's' : ''}` })) }
    ));
  }

  // 5. Duplicate app names (shadow IT / abandoned clones)
  const nameCounts: Record<string, number> = {};
  apps.forEach((a: any) => {
    const key = (a.Name || '').toLowerCase().trim();
    nameCounts[key] = (nameCounts[key] || 0) + 1;
  });
  const duplicateNames = Object.entries(nameCounts).filter(([_, c]) => c > 1);
  if (duplicateNames.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'medium',
      `${duplicateNames.length} Duplicate Connected App Names Detected`,
      'Multiple connected apps with the same name suggest abandoned copies or uncontrolled provisioning.',
      'Audit duplicate apps and delete those that are no longer in use. Enforce a naming convention for new apps.',
      { records: duplicateNames.map(([name, count]) => ({ name, detail: `${count} copies` })) }
    ));
  }

  // 6. Total connected app count — governance flag
  if (apps.length > 30) {
    items.push(createDebtItem('connectedAppSecurity', 'low',
      `${apps.length} Connected Apps in Org`,
      'A high number of connected apps is difficult to govern and audit. Each app is a potential OAuth entry point.',
      'Establish a connected app governance process. Assign an owner to each app and remove any that are unused.',
      { records: apps.map((a: any) => ({ name: a.Name, detail: a.Description ? undefined : 'No description' })) }
    ));
  }

  // Active Outbound Messages — Session IDs retired February 2026
  const activeOutboundMessages = (data.activeOutboundMessages || []);
  if (activeOutboundMessages.length > 0) {
    items.push(createDebtItem(
      'connectedAppSecurity',
      'high',
      `${activeOutboundMessages.length} Active Outbound Message${activeOutboundMessages.length !== 1 ? 's' : ''} — Session ID Auth Retired Feb 2026`,
      `Session IDs in Outbound Messages were retired in February 2026 (Spring '26). ${activeOutboundMessages.length} active outbound message${activeOutboundMessages.length !== 1 ? 'es' : ''} found — any that use Session ID authentication are broken.`,
      'Migrate Outbound Message receiving endpoints to OAuth authentication. Audit each active Outbound Message in Setup → Workflow → Outbound Messages.',
      { records: activeOutboundMessages.slice(0, 50).map((m: any) => ({ name: m.Name, detail: 'Session ID auth retired Feb 2026 — verify OAuth migration complete' })) }
    ));
  }

  // CA-signed certificates with lifespan >200 days — non-compliant since March 2026
  const longLivedCerts = (data.certificates || []).filter((c: any) => {
    if (!c.ValidFrom || !c.ExpirationDate) return false;
    const validFrom = new Date(c.ValidFrom);
    const expiration = new Date(c.ExpirationDate);
    const lifespanDays = Math.round((expiration.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));
    return lifespanDays > 200;
  });
  if (longLivedCerts.length > 0) {
    items.push(createDebtItem(
      'connectedAppSecurity',
      'medium',
      `${longLivedCerts.length} Certificate${longLivedCerts.length !== 1 ? 's' : ''} Exceed 200-Day Maximum Lifespan`,
      `As of March 2026 (Spring '26), CA-signed certificate lifespans are capped at 200 days (reducing to 100 days March 2027, 47 days March 2029). ${longLivedCerts.length} certificate${longLivedCerts.length !== 1 ? 's' : ''} exceed this limit.`,
      'Stop certificate pinning and implement automated certificate rotation using the Certificate Metadata API. Assign the Expired Certificate Notification permission to operations staff.',
      { records: longLivedCerts.slice(0, 50).map((c: any) => {
        const lifespanDays = Math.round((new Date(c.ExpirationDate).getTime() - new Date(c.ValidFrom).getTime()) / (1000 * 60 * 60 * 24));
        return { name: c.DeveloperName || c.Id, detail: `${lifespanDays}-day lifespan — max is 200 days (March 2026), 100 days (March 2027)` };
      }) }
    ));
  }

  // Traditional Connected Apps without External Client App equivalents (Spring '26)
  const externalClientApps = (data.externalClientApps || []);
  if (apps.length > 0 && externalClientApps.length === 0) {
    items.push(createDebtItem(
      'connectedAppSecurity',
      'medium',
      `${apps.length} Traditional Connected App${apps.length !== 1 ? 's' : ''} — External Client Apps Are the Spring '26 Standard`,
      `Connected App creation is disabled by default in Spring '26; External Client Apps (ECAs) are the new standard. ${apps.length} traditional Connected App${apps.length !== 1 ? 's' : ''} found with no External Client Apps configured.`,
      'Plan migration of Connected Apps to External Client Apps (ECAs) in Setup → External Client Apps. ECAs are metadata-compliant, support modern OAuth flows, and are required for new Spring \'26+ features.',
      { records: apps.slice(0, 50).map((a: any) => ({ name: a.Name || a.MasterLabel || a.Id, detail: 'Traditional Connected App — ECA is the Spring \'26 standard' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Connected App Security', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function calculateOverallScore(categories: CategoryScore[]): AssessmentResult {
  const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
  const totalMax = categories.reduce((sum, cat) => sum + cat.maxScore, 0);

  return {
    overallScore: totalScore,
    overallPercentage: Math.round((totalScore / totalMax) * 100),
    categories,
    timestamp: new Date().toISOString()
  };
}
