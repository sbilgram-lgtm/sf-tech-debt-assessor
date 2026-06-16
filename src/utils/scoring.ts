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
  ExperienceCloudData,
  ConnectedAppSecurityData,
  LwcData,
  OmniStudioData,
  PerformanceData,
  NotesAttachmentsData
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

  // Check for high total automation count (overlap risk)
  const totalAutomation = (automation.allFlows || []).length + (automation.workflowRules || []).length;
  if (totalAutomation > 50) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${totalAutomation} Active Automation Components — Review for Overlap`,
      `${totalAutomation} active flows and workflow rules detected. High automation volume increases the risk of conflicting order-of-execution and makes change impact assessment difficult.`,
      'Audit all active flows and workflow rules. Consolidate multiple flows on the same object into a single record-triggered flow with ordered actions.',
      { count: totalAutomation }
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

  // Web-to-Case enabled without CAPTCHA — spam risk
  const webToCaseSettings = automation.webToCaseSettings;
  if (webToCaseSettings && webToCaseSettings.EnableWebToCase && !webToCaseSettings.CaseCaptchaEnabledFlag) {
    items.push(createDebtItem(
      'configuration',
      'high',
      'Web-to-Case Enabled Without CAPTCHA — Spam Risk',
      'Web-to-Case is active but CAPTCHA is not enabled. Unprotected web forms are open to spam bots that inflate case volume, consume org limits, and pollute reporting.',
      'Enable CAPTCHA on Web-to-Case in Setup → Feature Settings → Service → Web-to-Case. Use reCAPTCHA v3 (invisible) to avoid friction for legitimate customers.',
      {}
    ));
  }

  // Active Case Auto-Response Rules (legacy)
  const caseAutoResponseRules = automation.caseAutoResponseRules || [];
  if (caseAutoResponseRules.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'low',
      `${caseAutoResponseRules.length} Active Case Auto-Response Rule${caseAutoResponseRules.length !== 1 ? 's' : ''} — Legacy`,
      'Auto-Response Rules are a legacy mechanism. They cannot be triggered by flows, lack dynamic content, and are superseded by Flow-based email responses that support personalization and conditional logic.',
      'Migrate Auto-Response Rules to Flow-triggered email actions using Email Alerts or Messaging components for richer, conditional responses.',
      { records: caseAutoResponseRules.slice(0, 50).map((r: any) => ({ name: r.Name, detail: 'Active Auto-Response Rule' })) }
    ));
  }

  // s-Controls — deprecated, should be removed
  const sControls = automation.sControls || [];
  if (sControls.length > 0) {
    items.push(createDebtItem(
      'configuration', 'critical',
      `${sControls.length} s-Control${sControls.length !== 1 ? 's' : ''} Still Active — Deprecated Technology`,
      's-Controls are a pre-Apex scripting mechanism that was deprecated over a decade ago. They rely on a legacy sandbox execution model that Salesforce no longer supports. Orgs with s-Controls face forced retirement with no migration path except manual replacement.',
      'Identify every s-Control and replace it with an equivalent LWC component, Apex class, or Flow. Log a case with Salesforce if any s-Control functionality is unclear.',
      { records: sControls.slice(0, 30).map((sc: any) => ({ name: sc.Name, detail: 's-Control — deprecated legacy automation' })) }
    ));
  }

  // Active PushTopics — deprecated Summer '26
  const activePushTopics = automation.activePushTopics || [];
  if (activePushTopics.length > 0) {
    items.push(createDebtItem(
      'configuration', 'high',
      `${activePushTopics.length} Active PushTopic${activePushTopics.length !== 1 ? 's' : ''} — Deprecated Summer '26`,
      `PushTopics (Streaming API) are deprecated in Summer '26. ${activePushTopics.length} active PushTopic${activePushTopics.length !== 1 ? 's' : ''} found. Any integration subscribing to PushTopics will break after Summer '26 enforcement.`,
      'Migrate PushTopic subscriptions to Platform Events or Change Data Capture (CDC). Both provide equivalent real-time record change notifications with no deprecation risk.',
      { records: activePushTopics.slice(0, 30).map((pt: any) => ({ name: pt.Name, detail: `API v${pt.ApiVersion} — deprecated Summer '26` })) }
    ));
  }

  // Time-based Workflow Rules — pending queue items indicate live usage
  if ((automation.pendingTimeQueueCount || 0) > 0) {
    items.push(createDebtItem(
      'configuration', 'medium',
      `${automation.pendingTimeQueueCount} Pending Time-Based Workflow Action${automation.pendingTimeQueueCount !== 1 ? 's' : ''} in Queue`,
      'Time-based Workflow Rule actions are still queued and will fire. This confirms Workflow Rules are in active use — their retirement will abort these actions.',
      'Accelerate migration of Workflow Rules with pending time-based actions to Flows. Scheduled Paths in record-triggered flows are the direct replacement.',
      { count: automation.pendingTimeQueueCount }
    ));
  }

  // Login Flows configured for privileged access
  const loginFlows = automation.loginFlows || [];
  if (loginFlows.length === 0) {
    items.push(createDebtItem(
      'configuration', 'low',
      'No Login Flows Configured — Additional Auth Enforcement Missing',
      'Login Flows can enforce additional steps (MFA step-up, device trust, terms acceptance) at login. No Login Flows are configured, meaning post-authentication security enforcement relies entirely on profile and permission set settings.',
      'Consider implementing Login Flows for privileged user profiles (System Administrator, API users) to enforce device trust checks or acknowledge terms of use.',
      {}
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

  // Check for empty catch blocks (swallowed exceptions)
  const emptyCatch = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /catch\s*\([^)]*\)\s*\{\s*\}/g.test(body);
  });
  if (emptyCatch.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${emptyCatch.length} Classes with Empty catch Blocks`,
      'Empty catch blocks silently swallow exceptions, hiding errors from logs and making debugging impossible. This is a PMD static analysis violation.',
      'Add meaningful error handling in every catch block. At minimum log the exception with System.debug or a logging framework. Never leave catch blocks empty.',
      { records: emptyCatch.map((c: any) => ({ name: c.Name, detail: 'Empty catch block — exceptions silently swallowed' })) }
    ));
  }

  // DML operations in loops (insert/update/delete/upsert/merge in for/while)
  const dmlInLoops = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /for\s*\([\s\S]*?\)\s*\{[\s\S]*?\b(insert|update|delete|upsert|merge)\b/gi.test(body) ||
           /while\s*\([^)]*\)\s*\{[\s\S]*?\b(insert|update|delete|upsert|merge)\b/gi.test(body);
  });
  if (dmlInLoops.length > 0) {
    items.push(createDebtItem(
      'code', 'critical',
      `${dmlInLoops.length} Classes with DML Operations in Loops`,
      'DML statements (insert, update, delete, upsert, merge) inside loops hit governor limits in bulk operations. Each iteration counts against the 150 DML statements per transaction limit.',
      'Collect records into a List before the loop and perform a single bulk DML after. Use Database.insert/update with allOrNone=false for partial success handling.',
      { records: dmlInLoops.map((c: any) => ({ name: c.Name, detail: 'DML in loop — governor limit risk' })) }
    ));
  }

  // Schema.getGlobalDescribe() — expensive schema lookup
  const schemaLookups = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /Schema\.getGlobalDescribe\s*\(\s*\)/gi.test(body);
  });
  if (schemaLookups.length > 0) {
    items.push(createDebtItem(
      'code', 'medium',
      `${schemaLookups.length} Classes Use Schema.getGlobalDescribe()`,
      'Schema.getGlobalDescribe() loads all object metadata in the org into memory on every call. It is one of the most expensive Apex operations and causes severe performance degradation at scale.',
      'Cache the result in a static variable or use Schema.describeSObjects() for targeted lookups. Prefer Token-based describe calls (SObjectType.Account.getDescribe()) where possible.',
      { records: schemaLookups.map((c: any) => ({ name: c.Name, detail: 'Schema.getGlobalDescribe() — expensive mass schema lookup' })) }
    ));
  }

  // Classes without with sharing / inherited sharing
  const noSharing = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    // Skip interfaces, abstract classes, test classes, and @isTest
    if (/@isTest\b/i.test(body)) return false;
    if (/\binterface\b/i.test(body)) return false;
    // Flag classes that declare a class keyword but lack with sharing / inherited sharing / without sharing declaration
    return /\bclass\b/i.test(body) &&
      !/\bwith\s+sharing\b/i.test(body) &&
      !/\binherited\s+sharing\b/i.test(body) &&
      !/\bwithout\s+sharing\b/i.test(body);
  });
  if (noSharing.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${noSharing.length} Apex Classes Without a Sharing Declaration`,
      'Classes without with sharing, without sharing, or inherited sharing run in the default system context, potentially exposing records the running user should not see. This is a sharing enforcement gap (UseWithSharingOnDatabaseOperation).',
      'Add with sharing to all classes that perform database operations unless there is a documented business reason to escalate privileges. Use inherited sharing for utility classes called from both sharing contexts.',
      { records: noSharing.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'No sharing declaration — defaults to system context' })) }
    ));
  }

  // System.setPassword() — AppExchange security violation
  const setPasswordClasses = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /System\.setPassword\s*\(/gi.test(body);
  });
  if (setPasswordClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'critical',
      `${setPasswordClasses.length} Classes Use System.setPassword()`,
      'System.setPassword() is flagged by Salesforce AppExchange security review as a high-risk method. It can be exploited to change user passwords programmatically, bypassing normal authentication controls.',
      'Remove all System.setPassword() calls. Use standard Salesforce password reset flows or the Auth.setPasswordPolicy API where password management is legitimately required.',
      { records: setPasswordClasses.map((c: any) => ({ name: c.Name, detail: 'System.setPassword() — AppExchange security violation' })) }
    ));
  }

  // UserInfo.getSessionId() — session ID exposure risk
  const sessionIdClasses = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /UserInfo\.getSessionId\s*\(\s*\)/gi.test(body);
  });
  if (sessionIdClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${sessionIdClasses.length} Classes Access UserInfo.getSessionId()`,
      'Accessing session IDs in Apex and passing them to external systems or storing them is a security risk. Session IDs in Outbound Messages were retired in February 2026. This pattern is flagged by AppExchange security review.',
      'Replace session ID usage with OAuth Named Credentials for external callouts. Do not pass session IDs to Visualforce, LWC, or external endpoints.',
      { records: sessionIdClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'UserInfo.getSessionId() — session ID exposure, retired pattern' })) }
    ));
  }

  // SOQL without WITH SECURITY_ENFORCED or WITH USER_MODE — FLS enforcement gap
  const soqlNoFls = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    // Find SOQL queries (simplified: [...]) that lack security enforcement keywords
    const soqlBlocks = body.match(/\[SELECT[\s\S]*?\]/gi) || [];
    return soqlBlocks.some((q: string) =>
      !/WITH\s+SECURITY_ENFORCED/i.test(q) &&
      !/WITH\s+USER_MODE/i.test(q)
    );
  });
  if (soqlNoFls.length > 0) {
    items.push(createDebtItem(
      'code', 'medium',
      `${soqlNoFls.length} Classes Have SOQL Queries Without FLS Enforcement`,
      'SOQL queries without WITH SECURITY_ENFORCED or WITH USER_MODE bypass Field-Level Security checks, potentially exposing fields the running user should not see. This is a CRUD/FLS violation.',
      'Add WITH USER_MODE to SOQL queries in classes that run in user context. Use WITH SECURITY_ENFORCED as an alternative. Supplement with stripInaccessible() for DML operations.',
      { records: soqlNoFls.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'SOQL without WITH SECURITY_ENFORCED or WITH USER_MODE — FLS bypass' })) }
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

  // Dynamic SOQL with string concatenation — SOQL injection risk
  const soqlInjectionRisk = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /Database\.(query|queryWithBinds)\s*\(\s*['"][^'"]*'\s*\+/gi.test(body) ||
           /\[SELECT[\s\S]{0,200}'\s*\+/gi.test(body);
  });
  if (soqlInjectionRisk.length > 0) {
    items.push(createDebtItem(
      'code', 'critical',
      `${soqlInjectionRisk.length} Classes May Have SOQL Injection Vulnerabilities`,
      'Dynamic SOQL built by concatenating user-controlled strings is vulnerable to SOQL injection attacks. Attackers can exfiltrate or modify data beyond their intended access.',
      'Use String.escapeSingleQuotes() on all user input before including in dynamic SOQL. Prefer bind variables (:variable) or Database.queryWithBinds() for parameterised queries.',
      { records: soqlInjectionRisk.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'Dynamic SOQL string concatenation — SOQL injection risk' })) }
    ));
  }

  // @future methods with DML after callout pattern
  const futureDmlAfterCallout = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /@future\s*\(\s*callout\s*=\s*true/gi.test(body) &&
           /\b(insert|update|delete|upsert)\b/gi.test(body);
  });
  if (futureDmlAfterCallout.length > 0) {
    items.push(createDebtItem(
      'code', 'medium',
      `${futureDmlAfterCallout.length} @future(callout=true) Methods Also Perform DML`,
      '@future methods with callout=true that also execute DML run callouts and DML in the same async context. If the callout fails, the DML may still commit — leaving data in an inconsistent state. This pattern also consumes both callout and DML transaction limits.',
      'Separate callout logic from DML logic. Use a Queueable chain: one Queueable for the callout, chaining to a second Queueable for the DML based on the callout response.',
      { records: futureDmlAfterCallout.slice(0, 30).map((c: any) => ({ name: c.Name, detail: '@future(callout=true) + DML — inconsistent state risk' })) }
    ));
  }

  // Weak crypto — MD5 or SHA-1 usage
  // generateDigest() algorithm names: MD5, SHA1, SHA-256, SHA-384, SHA-512
  // generateHMAC() algorithm names:  hmacMD5, hmacSHA1, hmacSHA256, hmacSHA512
  const weakCrypto = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /Crypto\.generateDigest\s*\(\s*['"]MD5['"]/gi.test(body) ||
           /Crypto\.generateDigest\s*\(\s*['"]SHA1['"]/gi.test(body) ||
           /Crypto\.generateHMAC\s*\(\s*['"]hmacMD5['"]/gi.test(body) ||
           /Crypto\.generateHMAC\s*\(\s*['"]hmacSHA1['"]/gi.test(body);
  });
  if (weakCrypto.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${weakCrypto.length} Classes Use Weak Cryptographic Algorithms (MD5 / SHA-1)`,
      'MD5 and SHA-1 are cryptographically broken hash algorithms. Salesforce AppExchange security review flags MD5/SHA-1 usage. These algorithms are vulnerable to collision attacks and should not be used for any security-sensitive purpose.',
      'Replace MD5 and SHA-1 with SHA-256 or SHA-512. Update Crypto.generateDigest() calls to use \'SHA-256\' as the algorithm parameter.',
      { records: weakCrypto.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'MD5/SHA-1 usage — weak cryptography, AppExchange security violation' })) }
    ));
  }

  // @IsTest(SeeAllData=true) — access to real org data in tests
  const seeAllDataClasses = apex.seeAllDataClasses || [];
  if (seeAllDataClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${seeAllDataClasses.length} Test Class${seeAllDataClasses.length !== 1 ? 'es' : ''} Use @IsTest(SeeAllData=true)`,
      '@IsTest(SeeAllData=true) gives tests access to all production data, making tests environment-dependent and fragile. Tests passing in sandbox fail in production when data differs. This is a PMD rule violation.',
      'Remove SeeAllData=true from all test classes. Create explicit test data using @TestSetup or data factory classes. Use Test.loadData() for complex seed data.',
      { records: seeAllDataClasses.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'SeeAllData=true — test accesses real org data' })) }
    ));
  }

  // Test classes with no assert statements
  const noAssertClasses = apex.noAssertClasses || [];
  if (noAssertClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'high',
      `${noAssertClasses.length} Test Class${noAssertClasses.length !== 1 ? 'es' : ''} Have No Assert Statements`,
      'Test classes without System.assert(), System.assertEquals(), or Assert.* calls provide no actual verification — they only exercise code paths for coverage numbers but never confirm correct behaviour. This is a PMD rule (ApexUnitTestClassShouldHaveAsserts) violation.',
      'Add at minimum one meaningful assert per test method. Test the actual output values, not just that no exception was thrown.',
      { records: noAssertClasses.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'No assert statements — coverage-only test, no verification' })) }
    ));
  }

  // Test classes missing Test.startTest() / Test.stopTest()
  const noStartStopClasses = apex.noStartStopTestClasses || [];
  if (noStartStopClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'medium',
      `${noStartStopClasses.length} Test Class${noStartStopClasses.length !== 1 ? 'es' : ''} Missing Test.startTest() / Test.stopTest()`,
      'Test classes without Test.startTest() / Test.stopTest() do not reset governor limits between test setup and the code under test. Async operations (future methods, queueable) may not execute properly without stopTest().',
      'Wrap the code under test in Test.startTest() and Test.stopTest() in every test method. This ensures fresh governor limit counts and forces async execution to complete.',
      { records: noStartStopClasses.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'No Test.startTest()/stopTest() — governor limits not reset' })) }
    ));
  }

  // Test classes inserting data without @TestSetup
  const noTestSetupClasses = apex.noTestSetupClasses || [];
  if (noTestSetupClasses.length > 0) {
    items.push(createDebtItem(
      'code', 'low',
      `${noTestSetupClasses.length} Test Class${noTestSetupClasses.length !== 1 ? 'es' : ''} Insert Data Without @TestSetup`,
      'Test classes that insert records in each test method repeat expensive DML on every test run. @TestSetup creates test data once and rolls back between methods, significantly reducing test execution time.',
      'Consolidate shared test data creation into a @TestSetup method. This reduces test runtime and standardises test data across all methods in the class.',
      { records: noTestSetupClasses.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'Data insertion without @TestSetup — repeated DML per test method' })) }
    ));
  }

  // CQ-22: Global modifier (AvoidGlobalModifier)
  const globalClasses = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /\bglobal\s+(class|interface|enum|abstract|virtual|override|static|void|String|Integer|Boolean|List|Map|Set|Id)\b/gi.test(body);
  });
  if (globalClasses.length > 0) {
    items.push(createDebtItem('code', 'high',
      `${globalClasses.length} Apex Classes Use the global Access Modifier`,
      'The global access modifier exposes classes and methods as a permanent public API. Once deployed as global, these signatures can never be changed or removed — they create irreversible technical debt. This is flagged by Salesforce Code Analyzer (PMD: AvoidGlobalModifier) and AppExchange security review.',
      'Replace global with public. Reserve global only for classes intentionally exposed as a Salesforce managed package API or for classes that implement global interfaces (e.g., Auth.RegistrationHandler). Audit each global class for actual external consumers.',
      { records: globalClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'global modifier — permanent API surface, cannot be changed or removed' })) }
    ));
  }

  // CQ-23: Queueable without Finalizer (QueueableWithoutFinalizer)
  const queueableNoFinalizer = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /implements\s+[^{]*\bQueueable\b/i.test(body) && !/System\.attachFinalizer\s*\(/i.test(body);
  });
  if (queueableNoFinalizer.length > 0) {
    items.push(createDebtItem('code', 'medium',
      `${queueableNoFinalizer.length} Queueable Apex Classes Without a Finalizer`,
      'Queueable classes that do not attach a Finalizer have no mechanism for handling asynchronous failures. If a Queueable job fails after being dequeued, there is no way to detect the failure, retry the job, or trigger compensating actions. This is flagged by Salesforce Code Analyzer (PMD: QueueableWithoutFinalizer).',
      'Implement the Finalizer interface and attach it via System.attachFinalizer(finalizer) in the execute() method. Use the Finalizer to log failures, trigger retry logic, or send alerts when a Queueable job fails.',
      { records: queueableNoFinalizer.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'Queueable without Finalizer — async failures are silent' })) }
    ));
  }

  // CQ-24: @future annotation (AvoidFutureAnnotation)
  const futureClasses = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /@future\b/i.test(body);
  });
  if (futureClasses.length > 0) {
    items.push(createDebtItem('code', 'medium',
      `${futureClasses.length} Apex Classes Use the @future Annotation`,
      '@future methods cannot be monitored, chained, cancelled, or tracked in the async queue. They are limited to 50 invocations per transaction and do not support passing sObject arguments. This is flagged by Salesforce Code Analyzer (PMD: AvoidFutureAnnotation). Queueable is the supported modern replacement.',
      'Replace @future methods with Queueable classes. Queueable supports chaining, monitoring via AsyncApexJob, richer parameter types, and attaching a Finalizer for error handling.',
      { records: futureClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: '@future — cannot chain, monitor, or cancel; use Queueable instead' })) }
    ));
  }

  // CQ-25: DML in constructors/initializers (ApexCSRF)
  const dmlInConstructor = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /public\s+\w+\s*\([^)]*\)\s*\{[^}]*\b(insert|update|delete|upsert|merge)\b/gi.test(body);
  });
  if (dmlInConstructor.length > 0) {
    items.push(createDebtItem('code', 'high',
      `${dmlInConstructor.length} Apex Classes Perform DML in Constructors`,
      'DML operations in Apex constructors execute automatically when a class is instantiated — including on page load in Visualforce controllers. This can cause unintended data mutations without explicit user action, mirroring a CSRF vulnerability. This is flagged by Salesforce Code Analyzer (PMD: ApexCSRF).',
      'Move DML operations out of constructors into explicitly invoked action methods. For Visualforce controllers, use action methods triggered by user interaction (e.g., a button click).',
      { records: dmlInConstructor.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'DML in constructor — unintended side effect on instantiation' })) }
    ));
  }

  // CQ-26: addError with escape=false (ApexXSSFromEscapeFalse)
  const addErrorEscapeFalse = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    return /\.addError\s*\([^)]*,\s*false\s*\)/gi.test(body);
  });
  if (addErrorEscapeFalse.length > 0) {
    items.push(createDebtItem('code', 'high',
      `${addErrorEscapeFalse.length} Apex Classes Call addError() with escape=false`,
      'addError(message, false) disables HTML escaping on the error message rendered to the user. If the message contains any user-controlled or externally-sourced data, this creates a stored Cross-Site Scripting (XSS) vulnerability. This is flagged by Salesforce Code Analyzer (PMD: ApexXSSFromEscapeFalse).',
      'Remove the second parameter or change it to true to enable HTML escaping: record.addError(message) or record.addError(message, true). Never pass user-controlled data into addError() without escaping.',
      { records: addErrorEscapeFalse.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'addError(msg, false) — XSS risk, HTML escaping disabled' })) }
    ));
  }

  // CQ-27: HTTP (not HTTPS) callouts (ApexInsecureEndpoint)
  const insecureEndpoints = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /['"]http:\/\/(?!localhost)/gi.test(body);
  });
  if (insecureEndpoints.length > 0) {
    items.push(createDebtItem('code', 'high',
      `${insecureEndpoints.length} Apex Classes May Use Insecure HTTP Callout Endpoints`,
      'HTTP (non-TLS) callout endpoints transmit data in plaintext, exposing credentials and payload data to interception. Salesforce Remote Site Settings now require HTTPS. This is flagged by Salesforce Code Analyzer (PMD: ApexInsecureEndpoint).',
      'Replace all http:// endpoint URLs with https:// equivalents. Update corresponding Remote Site Settings to use HTTPS. Use Named Credentials to manage endpoint URLs and avoid hardcoding.',
      { records: insecureEndpoints.slice(0, 30).map((c: any) => ({ name: c.Name, detail: 'http:// callout endpoint — unencrypted transmission' })) }
    ));
  }

  // CQ-28: System.debug in production code (PMD: AvoidDebugStatements)
  const debugClasses = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    return /\bSystem\.debug\s*\(/gi.test(body);
  });
  if (debugClasses.length > 0) {
    items.push(createDebtItem('code', 'medium',
      `${debugClasses.length} Apex Classes Contain System.debug Statements`,
      'System.debug calls consume CPU time on every transaction even when no debug log is active. In high-volume orgs, excessive debug statements are a measurable contributor to governor limit CPU consumption. This is flagged by Salesforce Code Analyzer (PMD: AvoidDebugStatements).',
      'Remove System.debug calls from production code. Replace critical diagnostic logging with a structured logging framework (e.g., a custom Logger class that respects a logging level Custom Setting) so debug output can be toggled without code changes.',
      { records: debugClasses.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'System.debug — CPU overhead on every transaction' })) }
    ));
  }

  // CQ-29: SOQL without WHERE clause or LIMIT (PMD: AvoidNonRestrictiveQueries)
  const nonRestrictiveSOQL = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    if (/@isTest\b/i.test(body)) return false;
    const soqlBlocks = body.match(/\[SELECT\b[\s\S]*?\]/gi) || [];
    return soqlBlocks.some((q: string) =>
      !/\bWHERE\b/i.test(q) && !/\bLIMIT\b/i.test(q)
    );
  });
  if (nonRestrictiveSOQL.length > 0) {
    items.push(createDebtItem('code', 'high',
      `${nonRestrictiveSOQL.length} Apex Classes Have SOQL Queries Without WHERE or LIMIT`,
      'SOQL queries without a WHERE clause or LIMIT can scan entire object tables. In small sandboxes these work fine but cause governor limit errors (50,000 row query limit) in production orgs with large data volumes. This is flagged by Salesforce Code Analyzer (PMD: AvoidNonRestrictiveQueries).',
      'Add WHERE conditions to filter to the relevant record set, or add LIMIT clauses where a full scan is intentional. For bulk operations, use batch Apex with appropriate query scope.',
      { records: nonRestrictiveSOQL.slice(0, 50).map((c: any) => ({ name: c.Name, detail: 'SOQL without WHERE or LIMIT — full table scan risk at scale' })) }
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

  // ── Omnichannel ──────────────────────────────────────────────────────────────

  // OC-1: No ServiceChannels despite queues existing
  if ((data.serviceChannels || []).length === 0 && data.queues.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Omni-Channel Service Channels Configured',
      'Queues exist but no Omni-Channel Service Channels are configured. Work is routed manually with no capacity management, queue metrics, or supervisor visibility.',
      'Create Service Channels in Setup → Omni-Channel → Service Channels for each work type (Cases, Chats, Messaging Sessions). Route all queues through Omni-Channel.'));
  }

  // OC-2: RoutingConfiguration uses Tab-based capacity (legacy)
  const tabCapacityConfigs = (data.routingConfigurations || []).filter((rc: any) => rc.CapacityType === 'Tab');
  if (tabCapacityConfigs.length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${tabCapacityConfigs.length} Routing Configuration${tabCapacityConfigs.length !== 1 ? 's' : ''} Use Legacy Tab-Based Capacity`,
      'Tab-based capacity counts browser tabs, not work complexity. Agents can be overloaded with high-effort items. Salesforce replaced this with Count and Percentage-based capacity models.',
      'Update Routing Configurations to use Count or Percentage-based capacity. This requires re-evaluating agent capacity limits across all queues.',
      { records: tabCapacityConfigs.map((rc: any) => ({ name: rc.DeveloperName, detail: 'CapacityType = Tab — legacy model' })) }));
  }

  // OC-3: RoutingConfiguration has no PushTimeout — stalled work never re-routed
  const noPushTimeout = (data.routingConfigurations || []).filter((rc: any) => !rc.PushTimeout || rc.PushTimeout === 0);
  if (noPushTimeout.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${noPushTimeout.length} Routing Configuration${noPushTimeout.length !== 1 ? 's' : ''} Have No Push Timeout`,
      'Without a push timeout, work items that agents do not accept sit indefinitely in the assigned state, silently violating SLAs and blocking queue throughput.',
      'Set a push timeout (60–120 seconds recommended) on all Routing Configurations so unaccepted work items are re-queued automatically.',
      { records: noPushTimeout.map((rc: any) => ({ name: rc.DeveloperName, detail: 'PushTimeout = 0 — work can stall indefinitely' })) }));
  }

  // OC-4: All RoutingConfigurations use MostAvailable — no skills-based routing
  const allMostAvailable = (data.routingConfigurations || []).length > 0 &&
    (data.routingConfigurations || []).every((rc: any) => rc.RoutingModel === 'MostAvailable' || rc.RoutingModel === 'LeastActive');
  if (allMostAvailable) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Skills-Based Routing Configured — All Queues Use Availability-Only Routing',
      'All Routing Configurations use availability-based routing (Most Available / Least Active). Specialized cases (billing, technical, escalations) are sent to any available agent, reducing first-contact resolution and increasing transfers.',
      'Implement skills-based routing for differentiated support tiers. Define agent skills in Setup → Omni-Channel → Skills and assign routing configurations to use skill requirements.'));
  }

  // OC-5: PresenceConfiguration capacity = 0 or null
  const noCapacityPresence = (data.presenceConfigurations || []).filter((pc: any) => !pc.Capacity || pc.Capacity === 0);
  if (noCapacityPresence.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${noCapacityPresence.length} Presence Configuration${noCapacityPresence.length !== 1 ? 's' : ''} Have No Capacity Limit`,
      'Presence Configurations with no capacity limit allow agents to receive unlimited simultaneous work items, causing overload and breaking workload balancing.',
      'Set a capacity limit on all Presence Configurations. Typical values are 5–10 for chat-only agents, 2–4 for mixed voice/chat. Review with supervisors to calibrate.',
      { records: noCapacityPresence.map((pc: any) => ({ name: pc.DeveloperName, detail: 'Capacity = 0 — no concurrency limit on agents' })) }));
  }

  // OC-6: No PresenceConfigurations despite ServiceChannels existing
  if ((data.presenceConfigurations || []).length === 0 && (data.serviceChannels || []).length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Presence Configurations Defined Despite Active Service Channels',
      'Service Channels are configured but no Presence Configurations exist. Agents have no presence statuses, cannot receive routed work, and supervisor monitoring is unavailable.',
      'Create Presence Configurations in Setup → Omni-Channel → Presence Configurations. Assign them to agent profiles.'));
  }

  // ── Knowledge ──────────────────────────────────────────────────────────────

  // KN-1: Knowledge enabled but zero published articles
  if ((data.publishedArticleCount || 0) === 0 && data.queues.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'Knowledge Enabled but No Published Articles Found',
      'No published Knowledge articles detected despite Service Cloud configuration. Article recommendations, Einstein Replies, and search deflection are all non-functional without published content.',
      'Publish initial Knowledge articles for your top case categories. Use existing case resolution notes as source material. Set a target of 50+ articles before enabling agent-facing Knowledge search.'));
  }

  // KN-2: Stalled drafts
  if ((data.draftStalledCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.draftStalledCount} Draft Knowledge Articles Stalled for 180+ Days`,
      'Draft articles not modified in over 6 months indicate broken authoring workflows — missing approval processes, no owner accountability, or no article lifecycle automation.',
      'Audit stalled draft articles. Assign owners and due dates. Implement an approval process to move articles from Draft to Published with defined SLAs.',
      { count: data.draftStalledCount }));
  }

  // KN-3: Stale published articles (12+ months)
  if ((data.staleArticleCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.staleArticleCount} Published Knowledge Articles Not Updated in 12+ Months`,
      'Stale published articles degrade search quality, cause incorrect agent guidance, and actively harm customer-facing deflection. Salesforce recommends a 6–12 month review cycle.',
      'Implement an article review workflow triggered by LastModifiedDate. Set article expiry dates and assign article owners responsible for periodic reviews.',
      { count: data.staleArticleCount }));
  }

  // KN-4: No Data Category Groups
  if ((data.dataCategoryGroupCount || 0) === 0 && (data.publishedArticleCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      'No Data Category Groups Configured — Knowledge Cannot Be Filtered by Audience',
      'Without data categories, article visibility cannot be segmented by audience (internal vs. customer vs. partner) and search filtering is unavailable. This is a fundamental governance gap.',
      'Create Data Category Groups in Setup → Data Categories for each dimension (Product, Topic, Audience). Assign categories to all published articles.'));
  }

  // KN-5: Published articles with no data category
  if ((data.uncategorizedArticleCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.uncategorizedArticleCount} Published Articles Have No Data Category Assignment`,
      'Uncategorized articles are not visible through category-based channel filtering, meaning customers or partners cannot find relevant content through filtered search.',
      'Assign at least one data category to every published article. Use bulk assignment in the Knowledge Management setup or via Data Loader.',
      { count: data.uncategorizedArticleCount }));
  }

  // KN-6: ValidationStatus blank on published articles
  if ((data.articlesWithoutValidationCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.articlesWithoutValidationCount} Published Articles Have No Validation Status`,
      'Published articles without a validation status had no editorial review enforced before publication — content accuracy is unverified.',
      'Set ValidationStatus on all published articles. Implement an approval process that requires validation before articles can be published.',
      { count: data.articlesWithoutValidationCount }));
  }

  // ── Entitlements ────────────────────────────────────────────────────────────

  // ENT-1: Active Entitlement Processes without Business Hours
  if ((data.entitlementProcessesWithoutBusinessHours || []).length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${data.entitlementProcessesWithoutBusinessHours.length} Active Entitlement Process${data.entitlementProcessesWithoutBusinessHours.length !== 1 ? 'es' : ''} Have No Business Hours Assigned`,
      'Without business hours, SLA milestone countdowns run 24/7 including weekends and holidays. This causes false SLA violations overnight and on weekends, invalidating all SLA reporting.',
      'Assign Business Hours to all active Entitlement Processes in Setup → Entitlements → Entitlement Processes. Create separate Business Hours records for different support tiers (standard vs. premium).',
      { records: data.entitlementProcessesWithoutBusinessHours.map((ep: any) => ({ name: ep.Name, detail: 'No Business Hours — SLA runs 24/7' })) }));
  }

  // ENT-2: Active Entitlement Processes without Milestone Actions
  if ((data.entitlementProcessesWithoutMilestoneActions || []).length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${data.entitlementProcessesWithoutMilestoneActions.length} Active Entitlement Process${data.entitlementProcessesWithoutMilestoneActions.length !== 1 ? 'es' : ''} Have No Milestone Actions`,
      'Milestones track SLA status but no automated escalation, notification, or action fires on warning or violation. SLA tracking is passive — operators must manually monitor dashboards.',
      'Configure warning and violation actions on each milestone in active Entitlement Processes. At minimum, add email alerts to case owners and managers when SLAs are breached.',
      { records: data.entitlementProcessesWithoutMilestoneActions.map((ep: any) => ({ name: ep.Name, detail: 'No milestone warning/violation actions configured' })) }));
  }

  // ENT-3: Open cases with entitlement but no SLA start date
  if ((data.openCasesEntitlementNoSla || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.openCasesEntitlementNoSla} Open Cases Have an Entitlement but No SLA Start Date`,
      'Cases with an entitlement assigned but no SlaStartDate mean the SLA clock never started. These cases are breaching SLAs silently with no tracking.',
      'Investigate why SlaStartDate is null — typically the case does not meet the entitlement activation criteria. Review the Entitlement Process activation rules and case field requirements.',
      { count: data.openCasesEntitlementNoSla }));
  }

  // ENT-4: Service Contracts without Entitlements
  if ((data.serviceContractsWithoutEntitlements || []).length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.serviceContractsWithoutEntitlements.length} Service Contract${data.serviceContractsWithoutEntitlements.length !== 1 ? 's' : ''} Have No Linked Entitlements`,
      'Service Contracts without entitlements are skeleton records — they exist in the data model but enforce no SLA rules. These are a common outcome of incomplete Service Cloud implementations.',
      'Add Entitlement records to all Service Contracts. Link each Entitlement to the appropriate Entitlement Process to activate SLA tracking.',
      { records: data.serviceContractsWithoutEntitlements.map((sc: any) => ({ name: sc.Name, detail: 'Service Contract with no Entitlement — SLA not enforced' })) }));
  }

  // ── Email-to-Case ────────────────────────────────────────────────────────────

  // ETC-1: Email routing addresses without TLS
  const noTlsAddresses = (data.emailRoutingAddresses || []).filter((a: any) => !a.TlsMode || a.TlsMode === 'Disabled');
  if (noTlsAddresses.length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${noTlsAddresses.length} Email-to-Case Routing Address${noTlsAddresses.length !== 1 ? 'es' : ''} Without TLS`,
      'Email-to-Case routing addresses without TLS transmit customer communications in plaintext, exposing PII and violating GDPR/CCPA requirements.',
      'Enable TLS (Preferred or Required) on all Email-to-Case routing addresses in Setup → Email-to-Case → Routing Addresses.',
      { records: noTlsAddresses.map((a: any) => ({ name: a.RoutingName || a.EmailAddress, detail: `TLS: ${a.TlsMode || 'Disabled'} — customer emails transmitted in plaintext` })) }));
  }

  // ETC-2: Email routing addresses with no owner/queue
  const noOwnerAddresses = (data.emailRoutingAddresses || []).filter((a: any) => !a.OwnerId);
  if (noOwnerAddresses.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${noOwnerAddresses.length} Email-to-Case Routing Address${noOwnerAddresses.length !== 1 ? 'es' : ''} Have No Default Owner`,
      'Email-to-Case addresses with no default owner or queue create cases with no owner, making them invisible to all agents and queues.',
      'Assign a default owner (queue or user) to every Email-to-Case routing address in Setup → Email-to-Case → Routing Addresses.',
      { records: noOwnerAddresses.map((a: any) => ({ name: a.RoutingName || a.EmailAddress, detail: 'No OwnerId — cases created with no owner' })) }));
  }

  // ETC-3: Email threading gap
  if ((data.emailThreadingGapCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.emailThreadingGapCount} Inbound Emails in the Last 30 Days Created New Cases Instead of Threading`,
      'Customer reply emails without a thread identifier create new cases instead of appending to existing ones, inflating case volume and losing conversation context.',
      'Ensure Email-to-Case threading tokens are included in all outbound case emails. Verify the email template includes the {!Case.Thread_Id} merge field. Check that threading is enabled in Email-to-Case settings.',
      { count: data.emailThreadingGapCount }));
  }

  // ETC-4: EmailServicesAddress with no sender restrictions
  const unrestrictedEmailServices = (data.emailServicesAddresses || []).filter((a: any) => !a.AuthorizedSenders);
  if (unrestrictedEmailServices.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${unrestrictedEmailServices.length} Email Service Address${unrestrictedEmailServices.length !== 1 ? 'es' : ''} Accept Emails from Any Sender`,
      'Email service addresses with no authorized sender restrictions can be exploited to generate spam cases, exhaust daily email limits (5,000/day), and drop legitimate inbound emails.',
      'Add authorized sender restrictions to Email Service Addresses in Setup → Email Services. Use domain-based filtering (e.g. *.yourcompany.com) at minimum.',
      { records: unrestrictedEmailServices.map((a: any) => ({ name: a.LocalPart, detail: 'No AuthorizedSenders restriction — accepts any sender' })) }));
  }

  // ── Live Chat / Messaging ────────────────────────────────────────────────────

  // MSG-1: LiveChatButton routing not Omni-Channel
  const nonOmniChatButtons = (data.liveChatButtons || []).filter((b: any) => b.RoutingType !== 'Omni');
  if (nonOmniChatButtons.length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${nonOmniChatButtons.length} Live Chat Button${nonOmniChatButtons.length !== 1 ? 's' : ''} Not Routed Through Omni-Channel`,
      'Chat buttons using legacy button-based routing bypass Omni-Channel capacity management entirely. Chat volume is invisible to agent workload calculations, causing overload and inaccurate queue metrics.',
      'Update Live Chat Button routing type to Omni-Channel in Setup → Live Agent → Chat Buttons & Invitations. Create a corresponding Service Channel for Chats.',
      { records: nonOmniChatButtons.map((b: any) => ({ name: b.DeveloperName, detail: `RoutingType: ${b.RoutingType} — bypasses Omni-Channel` })) }));
  }

  // MSG-2: Active LiveChatDeployments with no EmbeddedServiceConfig
  if ((data.liveChatDeployments || []).length > 0 && (data.embeddedServiceConfigs || []).length === 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${data.liveChatDeployments.length} Active Legacy Live Agent Deployment${data.liveChatDeployments.length !== 1 ? 's' : ''} — No Embedded Service Config Found`,
      'Active LiveChatDeployments without an Embedded Service Config indicate the org is on the legacy LiveAgent JavaScript stack. Embedded Service provides enhanced branding, mobile SDK support, and the migration path to Messaging for In-App and Web.',
      'Create an Embedded Service Deployment in Setup → Embedded Service Deployments. Migrate the legacy LiveAgent snippet to the Embedded Service Chat snippet.',
      { records: data.liveChatDeployments.map((d: any) => ({ name: d.DeveloperName, detail: 'Legacy LiveAgent deployment — no Embedded Service Config' })) }));
  }

  // MSG-3: Legacy LiveChat only, no MessagingChannel (MIAW not adopted)
  if ((data.liveChatButtons || []).length > 0 && (data.messagingChannels || []).length === 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      'Legacy Live Chat Active but Messaging for In-App and Web (MIAW) Not Adopted',
      'The org uses Legacy Live Chat exclusively with no Messaging Channels configured. Messaging for In-App and Web (MIAW) is the strategic successor — it provides asynchronous messaging, bot integration, and unified conversation history.',
      'Begin the transition to Messaging for In-App and Web. Create Messaging Channels in Setup → Messaging → Messaging Settings. Legacy Live Chat is on a deprecation trajectory.',
      { count: data.liveChatButtons.length }));
  }

  // MSG-4: Chat buttons pointing to empty queues
  const chatButtonQueueIds = (data.liveChatButtons || []).map((b: any) => b.QueueId).filter(Boolean);
  const queueIds = new Set(data.queues.map((q: any) => q.Id));
  const orphanedChatButtons = chatButtonQueueIds.filter((id: string) => !queueIds.has(id));
  if (orphanedChatButtons.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${orphanedChatButtons.length} Live Chat Button${orphanedChatButtons.length !== 1 ? 's' : ''} Point to Queues That May Be Empty or Deleted`,
      'Chat buttons routing to empty or missing queues silently fail — chats queue indefinitely with no agent to accept them.',
      'Verify each Live Chat Button is linked to an active queue with members. Review Setup → Live Agent → Chat Buttons & Invitations.',
      { count: orphanedChatButtons.length }));
  }

  // ── Service Console ──────────────────────────────────────────────────────────

  // SC-1: No Console App — queries AppDefinition via standard SOQL (not Tooling API)
  // so all Console apps in the org are returned regardless of profile assignment.
  // Guard on queues.length > 0 as a proxy for active Service Cloud usage.
  if ((data.consoleApps || []).length === 0 && data.queues.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      'No Lightning Service Console App Detected',
      'No Lightning App with Console navigation style was found in this org. Agents may be using standard tab navigation for case management, losing split-view, workspace tabs, the utility bar (Omni-Channel widget, macros, telephony), and keyboard shortcuts.',
      'Create a Lightning App with Navigation Style = Console in Setup → App Manager. Add Omni-Channel, Knowledge, and case quick actions to the utility bar. Assign the app to agent profiles.'));
  }

  const hasConsoleApp = (data.consoleApps || []).length > 0;

  // SC-2: No active Macros — only meaningful when a console app exists
  if ((data.activeMacroCount || 0) === 0 && hasConsoleApp) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Active Macros Configured',
      'A Service Console app is configured but no active macros exist. Macros automate repetitive agent actions (close case, send standard reply, update status field) and are one of the most accessible AHT reduction tools in Service Cloud.',
      'Create macros for the top 10 most common agent actions in Setup → Macros. Start with case closure, standard acknowledgement emails, and status transitions. Macros require Quick Actions on the Case page layout.',
      { count: 0 }));
  }

  // SC-3: No active Einstein Next Best Action strategy — only flag when console exists;
  // NBA is an optional licensed feature so use low severity to avoid noise
  if ((data.activeRecommendationStrategyCount || 0) === 0 && hasConsoleApp) {
    items.push(createDebtItem('serviceCloud', 'low',
      'No Einstein Next Best Action Recommendation Strategies Configured',
      'A Service Console app is configured but no active Einstein Next Best Action Recommendation Strategies exist. NBA surfaces contextual guidance to agents (knowledge article suggestions, entitlement checks, follow-up tasks) at the point of work.',
      'If Einstein NBA is licensed, create Recommendation Strategies in Setup → Einstein → Next Best Action. Add a Recommendations component to the Case record page in the Service Console. If not licensed, evaluate whether NBA would reduce escalation rates for your top case categories.',
      { count: 0 }));
  }

  // SC-4: CTI licensed but no softphone layout
  if ((data.callCenters || 0) > 0 && (data.softphoneLayouts || 0) === 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'Call Center Configured but No Default Softphone Layout Assigned',
      'A Call Center is configured but no default Softphone Layout is defined. Agents cannot use the integrated softphone in the console — call controls, screen pops, and call logging are all manual.',
      'Create a Softphone Layout in Setup → Call Centers → Softphone Layouts and mark it as default. Assign it to agent profiles.',
      { count: data.callCenters }));
  }

  // ── Messaging Compliance ──────────────────────────────────────────────────────

  // MSG-5: Messaging Channels without OPTOUT keyword — TCPA/GDPR risk
  const messagingChannelsNoOptOut = data.messagingChannelsNoOptOut || [];
  if (messagingChannelsNoOptOut.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${messagingChannelsNoOptOut.length} Messaging Channel${messagingChannelsNoOptOut.length !== 1 ? 's' : ''} Without OPTOUT Keyword — TCPA/GDPR Risk`,
      `${messagingChannelsNoOptOut.length} active Messaging Channel${messagingChannelsNoOptOut.length !== 1 ? 's' : ''} have no OPTOUT keyword configured. Customers cannot opt out of messages, violating TCPA (US), GDPR (EU), and CASL (Canada). This is a compliance and legal liability.`,
      'Configure an OPTOUT keyword on each Messaging Channel in Setup → Messaging → Messaging Settings. Map the keyword to a Flow that immediately stops outbound messages and updates the contact record.',
      { records: messagingChannelsNoOptOut.slice(0, 30).map((ch: any) => ({ name: ch.DeveloperName, detail: `${ch.MessagingPlatformType} — no OPTOUT keyword` })) }));
  }

  // ── SLA & Case Health ────────────────────────────────────────────────────────

  // SLA-1: Active SLA milestone violations
  const violatedMilestones = data.violatedMilestones || [];
  if (violatedMilestones.length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${violatedMilestones.length} Open Cases With Active SLA Milestone Violations`,
      'SLA milestones are in violation — target time has passed without completion. These cases are actively breaching contracted SLA terms. Milestone violation actions (alerts, escalations) may not be configured or have already fired without resolution.',
      'Review violated milestones in the Entitlement Milestones dashboard. Configure milestone violation actions (email alerts, queue reassignments) in Setup → Entitlements → Entitlement Processes for each milestone.',
      { records: violatedMilestones.slice(0, 50).map((m: any) => ({ name: m.MilestoneName, detail: `Case ${m.CaseId} — target: ${m.TargetDate ? new Date(m.TargetDate).toLocaleDateString() : 'none'}` })) }));
  }

  // SLA-2: Open escalated cases with no activity in 3+ days
  const staleEscalatedCases = data.staleEscalatedCases || [];
  if (staleEscalatedCases.length > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${staleEscalatedCases.length} Open Escalated Cases With No Activity in 3+ Days`,
      'These cases have IsEscalated = true but have not been modified in over 3 days. Escalation rules fired but no one acted — the escalation path is broken, routing is failing, or queue ownership is unclear.',
      'Review each escalated case. Ensure escalation rules trigger queue reassignments or direct notifications with owner accountability. Add a flow to auto-reassign stalled escalated cases after 48 hours.',
      { records: staleEscalatedCases.slice(0, 50).map((c: any) => ({ name: c.CaseNumber || c.Id, detail: c.Subject || 'No subject' })) }));
  }

  // SLA-3: Open cases not modified in 7+ days (stuck/untriaged)
  const staleCases = data.staleCases || [];
  if (staleCases.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${staleCases.length} Open Cases Not Modified in 7+ Days`,
      'These cases have been open and untouched for over a week. Dormant open cases indicate routing failures, absent queue owners, or agents not working their queues — all leading to SLA breaches.',
      'Audit the owners and queues of dormant cases. Set up escalation rules or flow-based alerts that fire when open cases exceed 5 days without modification. Add supervisor dashboard views for case age.',
      { records: staleCases.slice(0, 50).map((c: any) => ({ name: c.CaseNumber || c.Id, detail: c.Subject || 'No subject' })) }));
  }

  // SLA-4: High zero-touch case close rate
  const closedTotal = data.closedCasesTotal90Days || 0;
  const closedWithActivity = data.closedCasesWithComments90Days || 0;
  if (closedTotal > 0 && closedWithActivity < closedTotal * 0.5) {
    const zeroTouchPct = Math.round(((closedTotal - closedWithActivity) / closedTotal) * 100);
    items.push(createDebtItem('serviceCloud', 'high',
      `${zeroTouchPct}% of Cases Closed in Last 90 Days Have No Documented Activity`,
      'More than half of recently closed cases have no case comments. Cases closed without documented interaction have no resolution notes, produce no Knowledge content, and corrupt Einstein Case Classification training data.',
      'Implement a validation rule or flow requiring at least one internal note or email before case closure. Train agents to document resolution steps as case comments.',
      { count: closedTotal - closedWithActivity }));
  }

  // SLA-5: Expired entitlements still active on open cases
  const expiredEntitlements = data.expiredActiveEntitlements || [];
  if (expiredEntitlements.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${expiredEntitlements.length} Entitlement${expiredEntitlements.length !== 1 ? 's' : ''} Past End Date Still Marked Active`,
      'Entitlement records past their EndDate that remain Active produce invalid SLA metrics — cases linked to these entitlements have SLA clocks running under lapsed contract terms, and customers whose contracts have ended may still receive SLA protection.',
      'Create a scheduled Flow or Apex job to deactivate Entitlements when EndDate passes. Review open cases linked to expired entitlements and either re-entitle or manually close SLA tracking.',
      { records: expiredEntitlements.slice(0, 50).map((e: any) => ({ name: e.Name, detail: `EndDate: ${e.EndDate ? new Date(e.EndDate).toLocaleDateString() : 'none'}` })) }));
  }
  if ((data.openCasesExpiredEntitlementCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'critical',
      `${data.openCasesExpiredEntitlementCount} Open Cases Linked to Expired Entitlements`,
      'Open cases are still linked to entitlement records whose contracts have expired. SLA milestones are counting against terms that are no longer valid.',
      'Immediately review these cases. Remove or replace entitlement links where contracts have ended. Escalate to the account team if renewal is pending.',
      { count: data.openCasesExpiredEntitlementCount }));
  }

  // ── Agent Efficiency ──────────────────────────────────────────────────────────

  // AE-1: Zero Quick Texts (AHT gap)
  const quickTexts = data.quickTexts || [];
  if (quickTexts.length === 0 && data.queues.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Active Quick Texts Configured',
      'Zero active Quick Texts means all agent responses are typed freeform — inconsistent language, higher AHT, and no foundation for Einstein Reply Recommendations. Salesforce positions Quick Texts as a baseline AHT reduction tool for any Service Cloud org.',
      'Create Quick Texts for the top 20 most common agent responses (greetings, holds, closings, standard resolutions). Organise by Channel and Category for easy discovery in the console.',
      {}));
  } else if (data.staleQuickTextCount > 0 && (data.staleQuickTextCount / Math.max(quickTexts.length, 1)) > 0.5) {
    items.push(createDebtItem('serviceCloud', 'low',
      `${data.staleQuickTextCount} Quick Texts Not Updated in 12+ Months`,
      'More than half of active Quick Texts have not been updated in over a year. Stale Quick Texts may contain outdated product names, discontinued processes, or incorrect policy language.',
      'Review all Quick Texts annually. Archive outdated entries. Assign a Quick Text owner in each support team responsible for quarterly reviews.',
      { count: data.staleQuickTextCount }));
  }

  // AE-2: Unresolved ContactRequest records > 24h old
  const openContactRequests = data.openContactRequests || [];
  if (openContactRequests.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${openContactRequests.length} Callback Request${openContactRequests.length !== 1 ? 's' : ''} Unresolved After 24+ Hours`,
      'ContactRequest records in non-Completed status after 24 hours represent customers who requested a callback and received none. The automation that should create a Case or Task from these requests is missing or broken.',
      'Create a Flow triggered on ContactRequest insert to generate a Case or Task. Assign it to the appropriate service queue. Alert supervisors when ContactRequests age beyond 4 hours without action.',
      { records: openContactRequests.slice(0, 50).map((cr: any) => ({ name: cr.PreferredChannel || 'Unknown channel', detail: `Created: ${cr.CreatedDate ? new Date(cr.CreatedDate).toLocaleDateString() : 'unknown'}` })) }));
  }

  // ── Channel Coverage Gaps ─────────────────────────────────────────────────────

  // CC-1: MessagingSession ended with zero agent messages
  if ((data.zeroAgentSessionCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.zeroAgentSessionCount} Messaging Sessions Ended With No Agent Response (Last 30 Days)`,
      'Messaging sessions where customers sent messages but received zero agent replies represent abandoned conversations — customers reached out and were ignored. This indicates bot handoff failures or understaffed queues.',
      'Review MessagingSession records with AgentMessageCount = 0. Test all bot-to-agent escalation paths. Ensure queues routing Messaging work have active agents during operating hours.',
      { count: data.zeroAgentSessionCount }));
  }

  // CC-2: Live chat transcripts with no Case link
  if ((data.unlinkedTranscriptCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.unlinkedTranscriptCount} Completed Chat Transcripts With No Linked Case (Last 30 Days)`,
      'Chat conversations that ended without creating a case have no record in contact history — CSAT surveys cannot be sent, Knowledge deflection cannot be measured, and the interaction is invisible to account teams.',
      'Configure a flow or post-chat survey that creates a Case for every completed chat. Set CaseId on the LiveChatTranscript via a flow triggered on transcript completion.',
      { count: data.unlinkedTranscriptCount }));
  }

  // CC-3: Inbound social posts with no Case
  if ((data.unlinkedSocialPostCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.unlinkedSocialPostCount} Inbound Social Posts With No Linked Case (Last 30 Days)`,
      'Social mentions or DMs received but never converted to a case mean customers who reached out via social channels received no response — a channel coverage gap with direct CSAT and reputational risk.',
      'Review Social Customer Service triage workflows. Ensure all inbound social contacts trigger a case creation rule or manual review queue. Unlinked SocialPosts should be a supervisor alert.',
      { count: data.unlinkedSocialPostCount }));
  }

  // CC-4: No CaseTeamTemplates for multi-party cases
  if ((data.caseTeamTemplates || []).length === 0 && data.queues.length > 5) {
    items.push(createDebtItem('serviceCloud', 'low',
      'No Case Team Templates Configured',
      'No CaseTeamTemplates exist. Complex multi-party cases (escalations, enterprise accounts, cross-functional investigations) have no predefined collaboration structure — team members must be added ad-hoc, role-based visibility cannot be enforced.',
      'Create Case Team Templates in Setup → Cases → Case Teams for common escalation patterns (e.g., "Billing + Technical + Manager"). Add templates as a quick action on high-priority case record types.',
      {}));
  }

  // ── Entitlement deep checks ───────────────────────────────────────────────────

  const orphanedEntitlements = data.orphanedEntitlements || [];
  if (orphanedEntitlements.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${orphanedEntitlements.length} Active Entitlement${orphanedEntitlements.length !== 1 ? 's' : ''} Never Linked to Any Case`,
      'These active entitlements have never had a case associated. They may represent contracts imported without operationalisation, or customers entitled to support who have never logged a case — both inflate capacity figures and pollute SLA reporting.',
      'Audit orphaned entitlements. Confirm whether they represent active contracts. Deactivate or delete entitlements for expired or unused contracts.',
      { records: orphanedEntitlements.slice(0, 50).map((e: any) => ({ name: e.Name, detail: e.Account?.Name || e.AccountId || 'No Account' })) }
    ));
  }

  if ((data.multiEntitlementCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.multiEntitlementCaseCount} Cases Linked to Multiple Entitlements`,
      'Cases with multiple entitlement associations create SLA ambiguity — only the Case.EntitlementId field drives milestone tracking, but multiple CaseEntitlement records suggest automated entitlement assignment rules are over-associating entitlements.',
      'Review CaseEntitlement assignment rules. Ensure only the primary applicable entitlement is attached to each case. Clean up duplicate CaseEntitlement junction records.',
      { count: data.multiEntitlementCaseCount }
    ));
  }

  const bhNoHolidays = data.bhNoHolidays || [];
  if (bhNoHolidays.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${bhNoHolidays.length} Business Hours Record${bhNoHolidays.length !== 1 ? 's' : ''} Exclude Weekends but Have No Holiday Exceptions`,
      'Business hours records with Mon–Fri schedules but no Holiday records will run SLA milestone timers on public holidays, causing false violations and breach of customer SLA commitments.',
      'Add Holiday records via Setup → Business Hours → Holidays. Assign relevant holidays to each BusinessHours record used in active entitlement processes.',
      { records: bhNoHolidays.map((bh: any) => ({ name: bh.Name, detail: bh.IsDefault ? 'Default business hours' : '' })) }
    ));
  }

  const suspectTriggers = data.suspectMilestoneTriggers || [];
  if (suspectTriggers.length > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${suspectTriggers.length} Entitlement Milestone${suspectTriggers.length !== 1 ? 's' : ''} With Target Time of 5 Minutes or Less`,
      'Milestone target times of 5 minutes or less are almost certainly configuration errors — these milestones will be violated immediately after case creation and generate a constant stream of false violations that desensitise agents to real SLA breaches.',
      'Review entitlement process milestones with near-zero TimeTrigger values. Set realistic target times aligned to your SLA commitments (e.g., First Response = 60 minutes, Resolution = 8 hours).',
      { records: suspectTriggers.map((m: any) => ({ name: m.Name, detail: `Process: ${m.SlaProcess?.Name || m.SlaProcessId} — ${m.TimeTrigger} min` })) }
    ));
  }

  if ((data.duplicateMilestoneTriggerCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.duplicateMilestoneTriggerCount} Entitlement Processes Have Milestones With Duplicate Target Times`,
      'Multiple milestones within the same entitlement process sharing identical TimeTrigger values produce non-deterministic sequencing and simultaneous violations, making SLA reporting unreliable.',
      'Review entitlement process milestones with duplicate TimeTrigger values. Each milestone within a process should have a unique, progressively increasing target time.',
      { count: data.duplicateMilestoneTriggerCount }
    ));
  }

  // ── Knowledge deep checks ─────────────────────────────────────────────────────

  if ((data.legacyChannelArticleCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'low',
      `${data.legacyChannelArticleCount} Published Articles Still Visible in Legacy Customer Self-Service Portal Channel`,
      'Articles marked visible in the legacy Customer Self-Service Portal (IsVisibleInCsp) channel are configured for a deprecated portal type. This flag adds no value for orgs using Experience Cloud and may expose articles to unintended legacy portals.',
      'Audit IsVisibleInCsp visibility on all published articles. Remove CSP visibility where the org uses Experience Cloud instead of the legacy Self-Service portal.',
      { count: data.legacyChannelArticleCount }
    ));
  }

  const publishedCount = data.publishedArticleCount || 0;
  if (publishedCount > 10 && (data.promotedSearchTermCount || 0) === 0 && (data.synonymDictCount || 0) === 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'Knowledge Search Not Optimised — No Promoted Terms or Synonym Groups Configured',
      'The org has a published Knowledge library but zero promoted search terms (SearchPromotionRule) and zero synonym groups. High-value deflection articles will not surface for variations in customer search terminology, reducing deflection rates.',
      'Configure promoted search terms in Setup → Knowledge → Promoted Search Terms for top-category articles. Add synonym groups in Setup → Knowledge → Synonyms for common terminology variants (e.g., "invoice" = "bill" = "receipt").',
      {}
    ));
  }

  const dupTitles = data.duplicateArticleTitles || [];
  if (dupTitles.length > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${dupTitles.length} Duplicate Published Article Title${dupTitles.length !== 1 ? 's' : ''} Found`,
      'Multiple published articles share the same title. Duplicate titles create agent confusion during search, make it impossible to determine the authoritative version, and indicate articles are being duplicated instead of versioned.',
      'Consolidate duplicate articles. Archive or delete older versions. Use Knowledge article versioning (Archive + New Draft) rather than creating new articles for updates.',
      { records: dupTitles.slice(0, 30).map((t: any) => ({ name: t.Title, detail: `${t.expr0} copies` })) }
    ));
  }

  if ((data.articlesNoSummaryCount || 0) > 0 && publishedCount > 0) {
    const pct = Math.round(((data.articlesNoSummaryCount || 0) / publishedCount) * 100);
    items.push(createDebtItem('serviceCloud', 'low',
      `${data.articlesNoSummaryCount} Published Articles Have No Summary (${pct}% of library)`,
      'Articles without a Summary field produce poor search result snippets in the Lightning console, help centres, and Einstein Search — reducing agent and customer ability to identify relevant content before opening the article.',
      'Add Summary text to all published articles. Aim for 1–2 sentences describing the article\'s content and the scenario it addresses.',
      { count: data.articlesNoSummaryCount }
    ));
  }

  if (publishedCount > 20 && (data.totalCaseArticleCount || 0) === 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'No Knowledge Articles Have Been Attached to Any Case (Zero Deflection Evidence)',
      'A published Knowledge library exists but no CaseArticle records indicate agents are not using Knowledge in case resolution. This may signal poor Knowledge search configuration, irrelevant content, or agents bypassing the Knowledge base.',
      'Review Knowledge search configuration and article visibility settings. Enable the Knowledge component on case record pages. Measure article attachment rates and train agents on Knowledge usage.',
      { count: publishedCount }
    ));
  }

  // ── Case deep checks ──────────────────────────────────────────────────────────

  if ((data.orphanedCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.orphanedCaseCount} Open Cases With No Contact and No Account`,
      'Open cases with neither a Contact nor an Account cannot trigger entitlement lookups, are excluded from 360-degree account views, and cannot be routed by assignment rules that rely on account/contact relationships.',
      'Investigate the source creating these cases (web forms, API integrations, bulk imports). Add validation rules or flow checks to require Contact or Account on case creation.',
      { count: data.orphanedCaseCount }
    ));
  }

  if ((data.noPriorityCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.noPriorityCaseCount} Open Cases With No Priority Set`,
      'Cases without a Priority bypass priority-based escalation rules entirely — potentially critical issues are never automatically escalated. Priority is also required for most SLA milestone criteria.',
      'Add a validation rule or default value that sets Priority on all new cases. Update assignment rule entries to set Priority based on case origin or contact tier.',
      { count: data.noPriorityCaseCount }
    ));
  }

  if ((data.noOriginCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.noOriginCaseCount} Open Cases With No Origin (Unknown Channel)`,
      'Cases with no Origin value are invisible to channel-specific reports, cannot be routed by origin-based assignment rules, and indicate gaps in case creation flows — likely programmatic creation or data imports bypassing standard capture.',
      'Add Origin as a required field on all case creation entry points. Set a default origin value in each case creation flow, web-to-case form, and email-to-case routing address.',
      { count: data.noOriginCaseCount }
    ));
  }

  if ((data.veryOldCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.veryOldCaseCount} Open Cases Older Than 90 Days`,
      'Cases open for 90+ days represent chronic resolution failures — stalled escalations, abandoned work, or cases that were never properly closed. These pollute queue metrics and inflate open-case counts in dashboards.',
      'Run an aged case review with team leads. Close cases that are resolved but not formally closed. Establish an escalation rule that fires when cases exceed 30 days open without modification.',
      { count: data.veryOldCaseCount }
    ));
  }

  if ((data.noDescCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'low',
      `${data.noDescCaseCount} Open Cases With No Description`,
      'Cases without a Description have no recorded narrative of the issue. This forces agents to rely on comments or email threads, makes Einstein Case Classification impossible, and prevents keyword-based routing and Knowledge deflection.',
      'Add Description as a required field on case creation flows and web-to-case forms. For cases already missing descriptions, triage and update the top open cases.',
      { count: data.noDescCaseCount }
    ));
  }

  if ((data.userOwnedCaseCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.userOwnedCaseCount} Open Cases Owned by Individual Users (Not Queues)`,
      'Cases assigned directly to users cannot be redistributed by Omnichannel capacity management, cannot be picked up by coverage agents during absence, and create single-agent bottlenecks. Salesforce routing best practices require queue-based case ownership.',
      'Review assignment rules and ensure cases are routed to queues. For cases currently owned by users, reassign to appropriate queues. Use personal queue worklists only as a temporary holding pattern.',
      { count: data.userOwnedCaseCount }
    ));
  }

  // ── Other Service Cloud capabilities ─────────────────────────────────────────

  if ((data.openIncidents || []).length > 0 && (data.incidentsNoRelatedItemCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.incidentsNoRelatedItemCount} Open Incident${data.incidentsNoRelatedItemCount !== 1 ? 's' : ''} With No Related Items`,
      'Incident Management is in use but active incidents have no IncidentRelatedItem records — no impacted cases or assets are linked. These incidents have no defined scope and cannot drive impact-based prioritisation or mass case updates.',
      'For each open incident, link all impacted cases, assets, or accounts via the IncidentRelatedItem junction. This enables impact count reporting and mass status updates to affected customers.',
      { records: (data.openIncidents || []).slice(0, 30).map((i: any) => ({ name: i.IncidentNumber || i.Id, detail: i.Subject || '' })) }
    ));
  }

  const staleSwarms = data.staleSwarms || [];
  if (staleSwarms.length > 0) {
    items.push(createDebtItem('serviceCloud', 'low',
      `${staleSwarms.length} Open Swarm${staleSwarms.length !== 1 ? 's' : ''} With No Activity in 14+ Days`,
      'Open swarms not updated in over two weeks represent either forgotten escalations or resolved issues where the swarm was never closed. Ghost swarms generate unnecessary reminder notifications and pollute swarming dashboards.',
      'Review stale swarms and close those where the underlying case is resolved. Add a flow that auto-closes swarms when the associated case is closed.',
      { records: staleSwarms.slice(0, 30).map((s: any) => ({ name: s.Name || s.Id, detail: s.Subject || '' })) }
    ));
  }

  if ((data.unlinkedWorkOrderCount || 0) > 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      `${data.unlinkedWorkOrderCount} Open Work Order${data.unlinkedWorkOrderCount !== 1 ? 's' : ''} With No Case and No Asset`,
      'Work orders with neither a Case nor an Asset link have no service context — they are excluded from asset service history, cannot be tracked against case resolution, and are invisible to FSL scheduling optimisation.',
      'Update work order creation flows to always populate CaseId or AssetId. Review existing unlinked work orders and manually associate them with the correct case or asset.',
      { count: data.unlinkedWorkOrderCount }
    ));
  }

  if ((data.activeSurveys || []).length > 0 && (data.surveyResponseCount || 0) === 0) {
    items.push(createDebtItem('serviceCloud', 'medium',
      'Active CSAT Surveys Configured but No Survey Responses Received',
      'Feedback Management surveys are active but have zero responses. Survey invitations are either not being sent, the delivery mechanism is misconfigured, or the survey link in outbound emails is broken.',
      'Review Survey Invitation records and the flow/process sending invitations. Test the survey delivery path end-to-end. Confirm survey links are included in post-case closure email templates.',
      { count: (data.activeSurveys || []).length }
    ));
  }

  if ((data.voiceCallsTotalCount || 0) > 0 && (data.voiceCallsNoCaseCount || 0) > 0) {
    const pct = Math.round(((data.voiceCallsNoCaseCount || 0) / (data.voiceCallsTotalCount || 1)) * 100);
    items.push(createDebtItem('serviceCloud', 'high',
      `${data.voiceCallsNoCaseCount} Completed Voice Calls With No Linked Case (${pct}% of calls last 30 days)`,
      'Completed VoiceCall records with no CaseId mean agents are ending calls without completing the post-call wrap-up flow. These interactions have no case history, no CSAT survey eligibility, and no contact timeline record.',
      'Review the Service Cloud Voice post-call flow configuration. Ensure the wrap-up flow creates and links a case before the call is marked completed. Train agents on wrap-up procedures.',
      { count: data.voiceCallsNoCaseCount }
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
  // Exclude objects whose OWD cannot be configured by admins:
  //   - Managed package objects: namespace__Object pattern (QualifiedApiName has 3+ segments when split by '__')
  //   - Non-configurable suffixes: __mdt (Custom Metadata), __x (External Objects), __e (Platform Events),
  //     __b (Big Objects), __History, __Share, __Feed, __Tag, __ChangeEvent, __hd (History Deletion)
  const NON_OWD_SUFFIXES = ['__mdt', '__x', '__e', '__b', '__History', '__Share', '__Feed', '__Tag', '__ChangeEvent', '__hd', '__DataCategorySelection'];
  const isConfigurableOwd = (name: string) =>
    !NON_OWD_SUFFIXES.some(s => name.endsWith(s)) && name.split('__').length < 3;

  const publicReadWrite = data.owdSettings.filter((obj: any) =>
    (obj.InternalSharingModel === 'ReadWrite' || obj.InternalSharingModel === 'ReadWriteTransfer') &&
    isConfigurableOwd(obj.QualifiedApiName || '')
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
    obj.InternalSharingModel === 'Read' &&
    isConfigurableOwd(obj.QualifiedApiName || '')
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
      (u: any) => !profilesWithRanges.has(u.Profile?.Id || '')
    );
    if (unrestrictedIntUsers.length > 0) {
      items.push(createDebtItem(
        'sharingSecurity',
        'high',
        `${unrestrictedIntUsers.length} Integration/API User${unrestrictedIntUsers.length !== 1 ? 's' : ''} Without IP Restrictions`,
        `${unrestrictedIntUsers.length} service account user${unrestrictedIntUsers.length !== 1 ? 's' : ''} with API-style profile names have no login IP restrictions on their profile. This allows API access from any IP address.`,
        'Restrict integration user profiles to trusted IP ranges. Use Named Credentials instead of user credentials for callouts.',
        { records: unrestrictedIntUsers.map((u:any) => ({ name: u.Name, detail: `${u.Username} · ${u.Profile?.Name}` })) }
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
  // Skip individual enrollment check when org-level MFA enforcement is active —
  // Salesforce challenges all UI users at login regardless of TwoFactorInfo records,
  // so the absence of a TwoFactorInfo record does not mean MFA is not in use.
  const orgMfaEnforced = !!(data as any).orgMfaEnforced;
  const isSandboxOrg = !!(data as any).isSandbox;
  const enrolledIds = new Set(data.mfaEnrolledUserIds || []);
  const unenrolledUsers = allUsers.filter((u: any) => !enrolledIds.has(u.Id));
  if (!orgMfaEnforced && allUsers.length > 0 && unenrolledUsers.length > 0) {
    const unenrolledPct = Math.round((unenrolledUsers.length / allUsers.length) * 100);
    // In sandboxes MFA is typically not enforced by Salesforce and enrollment state
    // does not reflect production. When MFA is managed by SSO/IdP (Okta, Entra ID, etc.),
    // TwoFactorInfo records are absent even though MFA is active — reduce severity in both cases.
    const sandboxNote = isSandboxOrg
      ? ' This is a sandbox org — MFA enrollment state here may not reflect production. If MFA is handled via SSO/Identity Provider, TwoFactorInfo records will be empty even when MFA is active.'
      : ' Note: if MFA is enforced via SSO/Identity Provider (Okta, Entra ID, etc.), TwoFactorInfo records will be empty even when MFA is active — verify MFA is enforced at the IdP level.';
    items.push(createDebtItem(
      'sharingSecurity',
      isSandboxOrg ? 'low' : (unenrolledPct > 50 ? 'critical' : unenrolledPct > 20 ? 'high' : 'medium'),
      `${unenrolledUsers.length} Active Users Not Enrolled in MFA (${unenrolledPct}%)`,
      `${unenrolledUsers.length} of ${allUsers.length} active standard users have no Salesforce MFA method (TwoFactorInfo) registered.${sandboxNote}`,
      'Enable MFA enforcement in Setup > Identity > MFA for UI Logins. Use Salesforce Authenticator or TOTP. Track enrollment via the Identity Verification report.',
      { records: unenrolledUsers.map((u:any) => ({ name: u.Name, detail: `${u.Username} · Last login: ${u.LastLoginDate ? new Date(u.LastLoginDate).toLocaleDateString() : 'Never'}` })) }
    ));
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

  // Guest user profiles with Case read access — Service Cloud data exposure risk
  const caseGuestProfiles = (data.caseGuestProfiles || []);
  if (caseGuestProfiles.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity',
      'critical',
      `${caseGuestProfiles.length} Guest Profile${caseGuestProfiles.length !== 1 ? 's' : ''} with Case Read Access — Unauthenticated Data Exposure`,
      `${caseGuestProfiles.length} guest user profile${caseGuestProfiles.length !== 1 ? 's' : ''} have Read access to the Case object. Unauthenticated site visitors can query and view case records — including customer support history, account details, and email threads — without logging in.`,
      'Remove Case Read access from all guest user profiles in Setup → Sites → Guest User Profile. Ensure Case OWD is set to Private. Use authenticated Experience Cloud portals if customers need case visibility.',
      { records: caseGuestProfiles.slice(0, 20).map((p: any) => ({ name: p.Name || p.Id, detail: `Guest profile with Case Read${p.PermissionsEditCases ? ' + Edit' : ''} access` })) }
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

  // Permission Set Groups not adopted — users getting permissions via individual PSs
  if ((data.permissionSetGroupCount || 0) === 0 && data.permissionSets.length > 5) {
    items.push(createDebtItem(
      'sharingSecurity', 'medium',
      'Permission Set Groups Not in Use — Access Management is Ungrouped',
      'No Permission Set Groups (PSGs) are configured. PSGs allow logical grouping of permission sets for roles, simplifying assignment, revocation, and audit. Without PSGs, access management is done by individually assigning permission sets, which is error-prone at scale.',
      'Create Permission Set Groups in Setup → Permission Set Groups for each business role (e.g., "Service Agent", "Sales Rep"). Assign PSGs to users instead of individual permission sets.',
      {}
    ));
  }

  // Users with excessive permission sets (>10)
  const usersWithExcessivePSets = data.usersWithExcessivePermSets || [];
  if (usersWithExcessivePSets.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity', 'medium',
      `${usersWithExcessivePSets.length} User${usersWithExcessivePSets.length !== 1 ? 's' : ''} Assigned 10+ Custom Permission Sets`,
      'Users with many individual permission sets are difficult to audit for least-privilege compliance. Excessive PS assignments often indicate accumulated permissions over time without periodic review.',
      'Review users with >10 permission sets. Consolidate into Permission Set Groups. Conduct a quarterly access review to remove permissions no longer required.',
      { count: usersWithExcessivePSets.length }
    ));
  }

  // Cloned System Administrator profiles
  const clonedSysAdminProfiles = data.clonedSysAdminProfiles || [];
  if (clonedSysAdminProfiles.length > 0) {
    items.push(createDebtItem(
      'sharingSecurity', 'critical',
      `${clonedSysAdminProfiles.length} Cloned System Administrator Profile${clonedSysAdminProfiles.length !== 1 ? 's' : ''} Detected`,
      `Cloned System Administrator profiles grant the same elevated permissions as the standard System Administrator profile but bypass the standard profile monitoring path. ${clonedSysAdminProfiles.length} profile${clonedSysAdminProfiles.length !== 1 ? 's' : ''} with System Administrator-like names found.`,
      'Audit the permissions of cloned admin profiles. Replace elevated permissions with targeted Permission Sets. Remove unnecessary admin-level access. Use the standard System Administrator profile only for designated system administrators.',
      { records: clonedSysAdminProfiles.slice(0, 20).map((p: any) => ({ name: p.Name, detail: 'Cloned SysAdmin profile — elevated access outside standard admin profile' })) }
    ));
  }

  // No Transaction Security Policies
  if ((data.transactionSecurityPolicies || []).length === 0) {
    items.push(createDebtItem(
      'sharingSecurity', 'low',
      'No Transaction Security Policies Configured',
      'Transaction Security Policies enable real-time monitoring and enforcement of org activity (e.g., block exports >2,000 records, notify on concurrent login from different IPs, alert on mass data deletion). Without policies, these events go undetected.',
      'Create Transaction Security Policies in Setup → Security → Transaction Security for at least: (1) Large data exports, (2) Concurrent logins from different IPs, (3) Mass record deletion. Set action to Notify and Block for high-severity events.',
      {}
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

  // Active PushTopics — deprecated Summer '26
  const integrationPushTopics = data.activePushTopics || [];
  if (integrationPushTopics.length > 0) {
    items.push(createDebtItem(
      'integrations', 'high',
      `${integrationPushTopics.length} Active PushTopic${integrationPushTopics.length !== 1 ? 's' : ''} — Streaming API Deprecated Summer '26`,
      `PushTopics (Streaming API) are deprecated in Summer '26. ${integrationPushTopics.length} active PushTopic${integrationPushTopics.length !== 1 ? 's' : ''} will stop working after enforcement. External systems subscribing to PushTopics will lose real-time data without migration.`,
      'Migrate PushTopic consumers to Platform Events (high-volume event bus) or Change Data Capture (CDC) for object change notifications. Both APIs are GA and receive ongoing investment.',
      { records: integrationPushTopics.slice(0, 30).map((pt: any) => ({ name: pt.Name, detail: `API v${pt.ApiVersion} — deprecated Summer '26` })) }
    ));
  }

  // No External Credentials — using legacy Named Credentials only
  if ((data.externalCredentialCount || 0) === 0 && data.namedCredentials.length > 0) {
    items.push(createDebtItem(
      'integrations', 'medium',
      'No External Credentials Configured — Using Legacy Named Credentials Only',
      'External Credentials (introduced Winter \'23) are the modern replacement for Named Credentials. They support OAuth 2.0 Client Credentials flow, per-user auth, and External Client Apps. Zero External Credentials with Named Credentials in use indicates auth management has not been modernised.',
      'Create External Credentials in Setup → Security → Named Credentials → External Credentials for each integration. Migrate Named Credentials to reference External Credentials for proper OAuth flows.',
      { count: data.namedCredentials.length }
    ));
  }

  // No dedicated integration user
  if ((data.dedicatedIntegrationUserCount || 0) === 0 && data.connectedApps.length > 0) {
    items.push(createDebtItem(
      'integrations', 'medium',
      'No Dedicated Integration User Profiles Found — Connected Apps May Use Named Users',
      'Connected Apps exist but no dedicated integration user profiles (API Only, Integration, Service Account) were found. Integrations running as named human users cause audit trail pollution, break when the user leaves, and grant more permissions than required.',
      'Create dedicated service account users with API-only profiles for each integration. Assign minimum required permissions via Permission Sets. Disable UI login for integration user profiles.',
      { count: data.connectedApps.length }
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

  // ── Apex class count approaching org limit ────────────────────────────────────
  const apexCount = data.apexClassCount || 0;
  if (apexCount > 4500) {
    items.push(createDebtItem('orgLimits', 'high',
      `${apexCount.toLocaleString()} Active Apex Classes — Approaching Org Limit (~5,000)`,
      `Salesforce orgs have an effective ceiling of ~5,000 Apex classes (the documented limit is per-namespace, but org-wide performance degrades significantly above this threshold). At ${apexCount} classes, the org is critically close to triggering deployment failures.`,
      'Audit all Apex classes. Delete unused classes, consolidate overly-fragmented utility classes, and evaluate managed packages that contribute to class count. Prioritise deletion of test-only classes that are no longer relevant.',
      {}
    ));
  } else if (apexCount > 4000) {
    items.push(createDebtItem('orgLimits', 'medium',
      `${apexCount.toLocaleString()} Active Apex Classes — Monitor Org Limit`,
      'The org is approaching the ~5,000 Apex class threshold. Continued growth without pruning will eventually cause deployment failures.',
      'Begin auditing and removing unused Apex classes now to build headroom before the limit is reached.',
      {}
    ));
  }

  // ── Custom object count approaching org limit ─────────────────────────────────
  const objCount = data.customObjectCount || 0;
  if (objCount > 800) {
    items.push(createDebtItem('orgLimits', 'high',
      `${objCount.toLocaleString()} Custom Objects — Approaching Org Limit (~900)`,
      'Salesforce orgs have a default custom object limit of 800–900 (varies by edition). A count above 800 means new object creation will fail. This also causes slowdowns in Schema describe operations and Setup page load times.',
      'Audit custom objects. Delete unused objects and their data. Review if any objects can be consolidated using polymorphic relationships, Custom Metadata Types, or Platform Events instead.',
      {}
    ));
  } else if (objCount > 600) {
    items.push(createDebtItem('orgLimits', 'medium',
      `${objCount.toLocaleString()} Custom Objects — Monitor Approaching Limit`,
      'The org has a high number of custom objects. With a limit of ~900, the current count leaves limited headroom for future development.',
      'Periodically audit custom object usage. Remove deprecated objects and resist creating new objects where existing ones can be extended.',
      {}
    ));
  }

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

  const managedPeCount = (data as any).managedPlatformEventCount || 0;
  if (data.platformEvents.length === 0 && data.cdcEntities.length === 0 && managedPeCount === 0) {
    items.push(createDebtItem('platformEvents', 'low', 'No Platform Events or CDC Configured',
      'No custom Platform Events, Change Data Capture entities, or managed-package Platform Event objects were detected. This is informational — not a debt item unless integrations require real-time events.',
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
      { records: data.customSettings.map((s:any) => ({ name: s.DeveloperName, detail: s.CustomSettingsType || 'Custom Setting' })) }));
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

  // Detect Einstein/Agentforce via multiple signals — OrganizationSetting returns no rows
  // in many orgs, so also check BotDefinition, BotTopicDefinition, and PromptTemplate
  // as reliable indicators that Einstein/Agentforce is in active use.
  const agentTopicCountEin = data.agentTopicCount || 0;
  const botsCountEin = ((data.bots as any[]) || []).length;
  const promptCountEin = (data.promptTemplates || []).length;
  const einsteinEnabled = settings['EinsteinGptEnabled'] === 'true' ||
    settings['AgentforceEnabled'] === 'true' ||
    agentTopicCountEin > 0 ||
    botsCountEin > 0 ||
    promptCountEin > 0;
  const predictionBuilderEnabled = settings['EinsteinPredictionBuilderEnabled'] === 'true';
  if (!einsteinEnabled) {
    items.push(createDebtItem('einsteinAI', 'low',
      'Einstein Generative AI / Agentforce Not Enabled',
      'No Einstein Generative AI settings, Agentforce agents, bot definitions, or prompt templates were found in this org.',
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

  // EIN-1: Einstein features licensed but no AiApplication active
  const aiApplications = (data.aiApplications || []);
  const activeAiApps = aiApplications.filter((a: any) => a.Status === 'Active');
  if (aiApplications.length > 0 && activeAiApps.length === 0) {
    items.push(createDebtItem('einsteinAI', 'medium',
      `${aiApplications.length} Einstein AI Application${aiApplications.length !== 1 ? 's' : ''} Exist but None Are Active — License Unused`,
      'Einstein AI Applications are configured but none are in Active status. Features are licensed but not delivering value.',
      'Activate Einstein AI Applications in Setup → Einstein → AI Applications. Review each application\'s configuration and training data requirements.',
      { records: aiApplications.map((a: any) => ({ name: a.DeveloperName, detail: `Status: ${a.Status}` })) }));
  }

  // EIN-2: Einstein Case Classification — insufficient training data
  const caseClassificationApps = aiApplications.filter((a: any) =>
    a.DeveloperName && a.DeveloperName.toLowerCase().includes('classification')
  );
  if (caseClassificationApps.length > 0 && (data.recentClosedCaseCount || 0) < 1000) {
    items.push(createDebtItem('einsteinAI', 'high',
      `Einstein Case Classification Active but Only ${data.recentClosedCaseCount || 0} Closed Cases in the Past Year — Insufficient Training Data`,
      'Salesforce requires approximately 1,000+ closed cases with the target fields populated to train an accurate classification model. Low case volume produces low-confidence predictions that agents learn to ignore.',
      'Pause Einstein Case Classification until sufficient case history accumulates. Focus on ensuring target fields (Type, Reason, Priority) are consistently populated on all closed cases.',
      { count: data.recentClosedCaseCount || 0 }));
  }

  // EIN-3: Agentforce enabled but no Agent Topics defined
  const agentTopicCount = data.agentTopicCount || 0;
  const agentActionCount = data.agentActionCount || 0;
  if (einsteinEnabled && agentTopicCount === 0 && (data.bots || []).length > 0) {
    items.push(createDebtItem('einsteinAI', 'high',
      'Agentforce Bots Exist but No Agent Topics Configured',
      'Agentforce agents require Topics to define their scope of responsibility. Bots without Topics cannot understand what they are supposed to handle and default to generic fallback responses, failing to deflect any cases.',
      'Create Agent Topics in Setup → Agentforce → Topics for each domain the agent should handle (e.g., "Order Status", "Password Reset"). Each topic needs a description, classification instructions, and associated actions.',
      { botCount: (data.bots || []).length }
    ));
  }

  // EIN-4: Agentforce topics exist but no Actions
  if (einsteinEnabled && agentTopicCount > 0 && agentActionCount === 0) {
    items.push(createDebtItem('einsteinAI', 'high',
      `${agentTopicCount} Agentforce Topic${agentTopicCount !== 1 ? 's' : ''} Configured but No Agent Actions Defined`,
      'Agent Topics define what an agent can discuss but Actions define what it can do. Topics without Actions produce a conversational agent that can acknowledge requests but cannot execute any tasks.',
      'Create Agent Actions in Setup → Agentforce → Actions for each capability the agent should perform (e.g., "Get Case Status", "Create Return"). Link actions to the appropriate Topics.',
      { topicCount: agentTopicCount }
    ));
  }

  // EIN-5: Einstein/Agentforce enabled but Data Cloud not connected
  if (einsteinEnabled && !data.dataCloudConnected && (data.bots || []).length > 0) {
    items.push(createDebtItem('einsteinAI', 'medium',
      'Agentforce Active but Data Cloud Not Connected — AI Running on Incomplete Customer Data',
      'Agentforce agents without Data Cloud access can only use Salesforce CRM data for grounding. Data Cloud provides unified customer profiles (web behaviour, purchase history, third-party data) that significantly improve response relevance and personalisation.',
      'Connect Data Cloud to the org in Setup → Data Cloud. Create Data Cloud data streams for key customer data sources. Use Data Cloud segments and calculated insights as grounding context for Agentforce agents.',
      {}
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Einstein & AI Usage', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}


export function assessExperienceCloud(data: ExperienceCloudData): CategoryScore {
  const items: DebtItem[] = [];

  const activeSites = (data.sites || []).filter((s: any) => s.Status === 'Active');
  const allNetworks = data.networks || [];
  const customDomains = data.customDomains || [];

  // 1. Aura-based templates still in use — LWR templates always contain 'lwr' in their API name
  // Known Aura/legacy templates: aloha, kokua, nto, oob, partner_central, salesforce_tabs+visualforce
  const LEGACY_AURA_TEMPLATES = ['aloha', 'kokua', 'nto', 'oob', 'partner_central', 'salesforce_tabs'];
  const liveNetworks = allNetworks.filter((n: any) => n.Status === 'Live' || n.Status === 'Active');
  const legacyTemplateSites = liveNetworks.filter((n: any) => {
    if (!n.Template) return false;
    const t = n.Template.toLowerCase();
    if (t.includes('lwr')) return false; // LWR — not legacy
    return LEGACY_AURA_TEMPLATES.some(legacy => t.includes(legacy));
  });
  if (legacyTemplateSites.length > 0) {
    items.push(createDebtItem('experienceCloud', 'high',
      `${legacyTemplateSites.length} Experience Site${legacyTemplateSites.length !== 1 ? 's' : ''} Using Legacy Aura Template`,
      'Aura-based Experience Cloud templates (aloha, kokua, nto, oob, partner_central) are legacy. LWR (Lightning Web Runtime) sites load significantly faster — Salesforce benchmarks show 2-3x improvement — and are the only template type receiving new feature investment.',
      'Plan migration to an LWR-based template. Use Build Your Own (LWR) for custom portals or a Salesforce-provided LWR template where available. Test all custom Aura components before migration — they require conversion to LWC.',
      { records: legacyTemplateSites.map((n:any) => ({ name: n.Name, detail: n.Template || 'Aura template' })) }));
  }

  // 1b. Sites with no Template value — unknown/undetectable type
  const unknownTemplateSites = liveNetworks.filter((n: any) => !n.Template);
  if (unknownTemplateSites.length > 0 && legacyTemplateSites.length === 0) {
    // Only flag if we couldn't detect any legacy sites — avoids double-noise
    items.push(createDebtItem('experienceCloud', 'low',
      `${unknownTemplateSites.length} Live Site${unknownTemplateSites.length !== 1 ? 's' : ''} with Unknown Template Type`,
      'Template type could not be determined for these live sites. This may indicate a custom or undocumented template.',
      'Verify the template type in Experience Builder → Administration → Template. Confirm whether it is LWR-based.',
      { records: unknownTemplateSites.map((n:any) => ({ name: n.Name, detail: 'Template not returned' })) }));
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
  // customDomains contains DomainSite records with SiteId, or fallback Domain records without SiteId
  const siteIdsWithCustomDomain = new Set(
    customDomains.filter((d: any) => d.SiteId).map((d: any) => d.SiteId)
  );
  // If DomainSite returned records but none have SiteId, the fallback Domain query was used — skip the check
  const canCheckCustomDomain = customDomains.length === 0 || customDomains.some((d: any) => d.SiteId !== undefined);
  const sitesWithoutCustomDomain = canCheckCustomDomain
    ? activeSites.filter((s: any) => !siteIdsWithCustomDomain.has(s.Id))
    : [];
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
  // Handle both DomainSite records (Domain.HttpsOption) and fallback Domain records (HttpsOption)
  const insecureDomains = customDomains.filter((d: any) => {
    const httpsOption = d.Domain?.HttpsOption ?? d.HttpsOption;
    return httpsOption !== undefined && httpsOption !== 'Required';
  });
  if (insecureDomains.length > 0) {
    items.push(createDebtItem('experienceCloud', 'high',
      `${insecureDomains.length} Custom Domains Without HTTPS Enforced`,
      'Allowing non-HTTPS connections exposes session tokens and data in transit.',
      'Set HTTPS Option to "Required" on all custom domains in Setup → Domains.',
      { records: insecureDomains.map((d:any) => ({
        name: d.Domain?.Domain ?? d.Domain,
        detail: `HTTPS: ${d.Domain?.HttpsOption ?? d.HttpsOption ?? 'Not Required'}`
      })) }));
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

  // Clickjack protection disabled — AllowAll
  const clickjackSites = (data.clickjackVulnerableSites || []);
  if (clickjackSites.length > 0) {
    items.push(createDebtItem('experienceCloud', 'critical',
      `${clickjackSites.length} Active Site${clickjackSites.length !== 1 ? 's' : ''} with Clickjack Protection Disabled (AllowAll)`,
      'Sites with Clickjack Protection set to AllowAll permit iframe embedding from any origin. This enables UI redressing / clickjacking attacks where malicious sites overlay your pages to steal clicks and credentials.',
      'Set Clickjack Protection to "Allow framing by same-origin sites only" or stricter on all active Sites in Setup → Sites. Review whether any legitimate integration requires iframe embedding.',
      { records: clickjackSites.map((s: any) => ({ name: s.Name, detail: 'ClickjackProtection = AllowAll — iframe embedding unrestricted' })) }));
  }

  // XSS protection disabled — applies to both Aura and LWR sites
  const xssNetworks = (data.xssUnprotectedNetworks || []);
  if (xssNetworks.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${xssNetworks.length} Live Experience Cloud Site${xssNetworks.length !== 1 ? 's' : ''} with Browser XSS Protection Disabled`,
      'Browser XSS Protection headers (X-XSS-Protection) are disabled on these sites. While modern browsers have built-in XSS mitigation, disabling this header reduces defense-in-depth for older browsers and is a common security baseline requirement.',
      'Enable Browser XSS Protection in Setup → Digital Experiences → All Sites → Workspaces → Administration → Security.',
      { records: xssNetworks.map((n: any) => ({
        name: n.Name,
        detail: n.Template ? `BrowserXssProtection = false · ${n.Template.toLowerCase().includes('lwr') ? 'LWR' : 'Aura'} template` : 'BrowserXssProtection = false'
      })) }));
  }

  // Content sniffing protection disabled — applies to both Aura and LWR sites
  const contentSniffNetworks = (data.contentSniffingUnprotectedNetworks || []);
  if (contentSniffNetworks.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${contentSniffNetworks.length} Live Experience Cloud Site${contentSniffNetworks.length !== 1 ? 's' : ''} with Content Sniffing Protection Disabled`,
      'Content Sniffing Protection (X-Content-Type-Options: nosniff) prevents browsers from MIME-sniffing responses away from the declared content type. Disabling this enables content injection attacks.',
      'Enable Content Sniffing Protection in Setup → Digital Experiences → All Sites → Workspaces → Administration → Security.',
      { records: contentSniffNetworks.map((n: any) => ({
        name: n.Name,
        detail: n.Template ? `ContentSniffingProtection = false · ${n.Template.toLowerCase().includes('lwr') ? 'LWR' : 'Aura'} template` : 'ContentSniffingProtection = false'
      })) }));
  }

  // ── Performance checks ────────────────────────────────────────────────────────

  // PERF-EC-1: Guest page caching disabled (Aura only — LWR uses platform CDN, not this field)
  const guestCacheDisabled = (data.guestCacheDisabledNetworks || []);
  if (guestCacheDisabled.length > 0) {
    items.push(createDebtItem('experienceCloud', 'high',
      `${guestCacheDisabled.length} Aura Site${guestCacheDisabled.length !== 1 ? 's' : ''} with Guest Page Caching Disabled`,
      `Guest page caching (GuestCacheMaxAge) is set to 0 on ${guestCacheDisabled.length} Aura-based site${guestCacheDisabled.length !== 1 ? 's' : ''}. Every unauthenticated page request hits Salesforce servers directly — no CDN edge caching occurs. This increases page load times for public visitors and consumes server capacity unnecessarily. LWR sites use platform CDN caching automatically and are not affected by this setting.`,
      'Set Guest Cache Max Age to a suitable value (e.g., 600 seconds / 10 minutes) in Experience Builder → Administration → Caching for each affected Aura site. For mostly-static pages, higher values (3600+) significantly reduce load times.',
      { records: guestCacheDisabled.map((n: any) => ({ name: n.Name, detail: `GuestCacheMaxAge = 0 · Aura template: ${n.Template || 'unknown'}` })) }
    ));
  }

  // PERF-EC-2: High FlexiPage count per site — large page trees slow LWR JS bundle loading
  const networkPageCounts = data.networkPageCounts || [];
  const allNetworkMap = new Map((data.networks || []).map((n: any) => [n.Id, n]));
  const highPageCountNetworks = networkPageCounts.filter((r: any) => r.count > 30);
  if (highPageCountNetworks.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${highPageCountNetworks.length} Site${highPageCountNetworks.length !== 1 ? 's' : ''} with More Than 30 Experience Builder Pages`,
      `Sites with large numbers of Experience Builder pages increase sitemap complexity, slow LWR JavaScript bundle generation, and make navigation governance difficult. Each page adds to the component graph that LWR must resolve at build time.`,
      'Audit all pages in Experience Builder. Archive or delete pages that are unpublished, duplicated, or no longer in use. Consider splitting very large sites into multiple purpose-specific sites.',
      { records: highPageCountNetworks.map((r: any) => {
        const n = allNetworkMap.get(r.networkId);
        return { name: n?.Name || r.networkId, detail: `${r.count} pages · ${n?.Template?.toLowerCase().includes('lwr') ? 'LWR' : 'Aura'} template` };
      }) }
    ));
  }

  // PERF-EC-3: Very large network member bases — search indexing and member-facing render lag
  const networkMemberCounts = data.networkMemberCounts || [];
  const largeNetworks = networkMemberCounts.filter((r: any) => r.count > 100000);
  if (largeNetworks.length > 0) {
    items.push(createDebtItem('experienceCloud', 'medium',
      `${largeNetworks.length} Experience Cloud Site${largeNetworks.length !== 1 ? 's' : ''} with Over 100,000 Members`,
      `Sites with very large member counts experience slower Knowledge search indexing, longer member login times, and increased risk of SOQL row limit errors in member-facing Apex and Flows. Salesforce recommends specific architectural patterns for high-scale communities.`,
      'Review member data model and sharing rules for large-scale sites. Use External Objects or Data Cloud for high-volume data rather than standard Salesforce objects. Enable search index optimization in Site Administration. Consider whether all members need full platform access vs. a lighter authenticated experience.',
      { records: largeNetworks.map((r: any) => {
        const n = allNetworkMap.get(r.networkId);
        return { name: n?.Name || r.networkId, detail: `${r.count.toLocaleString()} members` };
      }) }
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

  // CTI adapter connected apps without session timeout
  const ctiApps = (data.ctiConnectedApps || []);
  const ctiNoTimeout = ctiApps.filter((a: any) => !a.MobileSessionTimeout || a.MobileSessionTimeout === 'None');
  if (ctiNoTimeout.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'medium',
      `${ctiNoTimeout.length} CTI / Telephony Connected App${ctiNoTimeout.length !== 1 ? 's' : ''} Without Session Timeout`,
      'CTI adapter connected apps with no session timeout allow agent telephony sessions to remain authenticated indefinitely after the browser is closed. A shared workstation or unattended session creates an open channel for calls.',
      'Set a session timeout on CTI connected apps in Setup → App Manager → Manage → Edit Policies. 8-hour maximum is recommended for agent workstations.',
      { records: ctiNoTimeout.map((a: any) => ({ name: a.Name, detail: 'CTI/Telephony app — no session timeout' })) }
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

  // ── OAuth tokens for inactive users ──────────────────────────────────────────
  const inactiveUserTokens = (data.oauthTokens || []).filter((t: any) => t.User?.IsActive === false);
  if (inactiveUserTokens.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'high',
      `${inactiveUserTokens.length} Active OAuth Token${inactiveUserTokens.length !== 1 ? 's' : ''} Belonging to Deactivated Users`,
      'Deactivating a Salesforce user does NOT revoke their existing OAuth tokens. Deactivated users retain valid access tokens that can be used by external systems to call the Salesforce API until the tokens expire or are manually revoked. This is a critical access control gap — a deactivated employee\'s integrations or compromised tokens remain live.',
      'Revoke all OAuth tokens belonging to inactive users immediately. In Setup → Connected Apps → Manage, use "Revoke All" or revoke tokens per user. Establish a deprovisioning process that includes OAuth token revocation as a step when deactivating users.',
      { records: inactiveUserTokens.slice(0, 50).map((t: any) => ({ name: t.AppName || 'Unknown App', detail: `User: ${t.User?.Username || t.UserId} — deactivated, token still live` })) }
    ));
  }

  // ── Connected Apps bypassing IP login restrictions ────────────────────────────
  const ipRelaxedApps = (data.connectedApps || []).filter((a: any) => a.IpRelaxation === 'RelaxedForThisApp');
  if (ipRelaxedApps.length > 0) {
    items.push(createDebtItem('connectedAppSecurity', 'medium',
      `${ipRelaxedApps.length} Connected App${ipRelaxedApps.length !== 1 ? 's' : ''} Bypass IP Login Restrictions`,
      'Connected Apps with IpRelaxation set to "Relax IP Restrictions" skip the org\'s IP allowlist checks for OAuth sessions. Even if the org enforces IP restrictions for standard login, these apps allow API access from any IP address. This widens the attack surface significantly, particularly for integrations that use long-lived refresh tokens.',
      'Review each Connected App set to RelaxedForThisApp. Change IpRelaxation to "Enforce IP Restrictions" where feasible. For integrations that require broad IP access, compensate with shorter token lifetimes and IP-restricted Named Credentials.',
      { records: ipRelaxedApps.slice(0, 20).map((a: any) => ({ name: a.Name, detail: 'IpRelaxation = RelaxedForThisApp — IP allowlist bypassed' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return { category: 'Connected App Security', score: Math.max(0, maxScore - deductions), maxScore, percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100), items };
}

export function assessLwc(data: LwcData): CategoryScore {
  const items: DebtItem[] = [];
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const lwcBundles: any[] = data.lwcBundles || [];
  const auraBundles: any[] = data.auraBundles || [];
  const auraDefinitions: any[] = data.auraDefinitions || [];
  const flexiPages: any[] = data.flexiPages || [];
  const lwcResources: any[] = data.lwcResources || [];
  const jsResources: any[] = data.jsResources || [];
  const htmlResources: any[] = data.htmlResources || [];
  const cssResources: any[] = data.cssResources || [];

  // 1. LWC bundles missing descriptions
  const lwcNoDesc = lwcBundles.filter((b: any) => !b.Description || b.Description.trim() === '');
  if (lwcNoDesc.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${lwcNoDesc.length} LWC Bundle${lwcNoDesc.length !== 1 ? 's' : ''} Without Descriptions`,
      'Undocumented LWC components make it hard for teams to understand component purpose, inputs, and intended use.',
      'Add a description to each LWC bundle in the component\'s metadata. Document the component\'s purpose, exposed properties, and events.',
      { records: lwcNoDesc.slice(0, 50).map((b: any) => ({ name: b.DeveloperName, detail: `API v${b.ApiVersion}` })) }
    ));
  }

  // 2. LWC on outdated API versions (<v57)
  const lwcOutdated = lwcBundles.filter((b: any) => b.ApiVersion && b.ApiVersion < 57 && b.ApiVersion > 30);
  if (lwcOutdated.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${lwcOutdated.length} LWC Bundle${lwcOutdated.length !== 1 ? 's' : ''} on Outdated API Versions (< v57)`,
      'LWC components on API versions below v57 miss important platform updates, security patches, and new Wire adapters introduced in recent releases.',
      'Update LWC bundles to the current API version (v62+). Test incrementally and verify no deprecated features are in use.',
      { records: lwcOutdated.slice(0, 50).map((b: any) => ({ name: b.DeveloperName, detail: `API v${b.ApiVersion}` })) }
    ));
  }

  // 3. LWC on retired API versions (≤v30) — same retirement as Apex
  const lwcRetired = lwcBundles.filter((b: any) => b.ApiVersion && b.ApiVersion <= 30);
  if (lwcRetired.length > 0) {
    items.push(createDebtItem(
      'lwc', 'critical',
      `${lwcRetired.length} LWC Bundle${lwcRetired.length !== 1 ? 's' : ''} on Retired API Versions (≤ v30)`,
      `API versions 21–30 were retired in Summer '25. LWC bundles on these versions are non-functional.`,
      'Immediately update all LWC bundles on API v30 or below to a supported version (minimum v31, recommended v62+).',
      { records: lwcRetired.slice(0, 50).map((b: any) => ({ name: b.DeveloperName, detail: `API v${b.ApiVersion} — retired Summer '25` })) }
    ));
  }

  // 4. Aura component count vs LWC — migration debt
  if (auraBundles.length > 0 && lwcBundles.length > 0) {
    const auraRatio = auraBundles.length / (auraBundles.length + lwcBundles.length);
    if (auraRatio > 0.4) {
      items.push(createDebtItem(
        'lwc', 'medium',
        `${auraBundles.length} Aura Components vs ${lwcBundles.length} LWC Bundles — Migration Debt`,
        `Aura (Lightning Component Framework) is legacy. ${Math.round(auraRatio * 100)}% of front-end components are still Aura. LWC is Salesforce's strategic direction with better performance, tooling, and support.`,
        'Prioritize migrating Aura components to LWC. Start with high-traffic components in service console and Experience Cloud. Use the LWC migration guide and lwc-recipes as reference.',
        { aura: auraBundles.length, lwc: lwcBundles.length, auraPercent: Math.round(auraRatio * 100) }
      ));
    }
  } else if (auraBundles.length > 10 && lwcBundles.length === 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${auraBundles.length} Aura Components — No LWC Migration Started`,
      'No LWC components found. The org is entirely on the legacy Aura framework.',
      'Begin LWC adoption. Migrate new development to LWC and plan a phased migration of existing Aura components.',
      { aura: auraBundles.length }
    ));
  }

  // 5. Aura RENDERER definitions — high complexity flag
  const auraRenderers = auraDefinitions.filter((d: any) => d.DefType === 'RENDERER');
  if (auraRenderers.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${auraRenderers.length} Aura Component${auraRenderers.length !== 1 ? 's' : ''} with Custom RENDERER`,
      'Aura RENDERER overrides manipulate the DOM directly, bypassing the framework lifecycle. These are high-complexity, high-risk, and have no equivalent migration path to LWC.',
      'Audit each Aura RENDERER. Refactor to use LWC reactive data binding and event-driven patterns. These are the hardest Aura components to migrate.',
      { records: auraRenderers.slice(0, 30).map((d: any) => ({ name: d.AuraDefinitionBundle?.DeveloperName || d.AuraDefinitionBundleId, detail: 'RENDERER — direct DOM manipulation' })) }
    ));
  }

  // 6. Aura EVENT definitions — cross-component coupling
  const auraEvents = auraDefinitions.filter((d: any) => d.DefType === 'EVENT');
  if (auraEvents.length > 5) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${auraEvents.length} Aura Application/Component Events Defined`,
      'Aura events create tight coupling between components and have no direct equivalent in LWC. High event counts indicate architectural patterns that must be redesigned during migration.',
      'Document all Aura events and their consumers before migrating. Replace with LWC CustomEvents and Lightning Message Service for cross-component communication.',
      { count: auraEvents.length }
    ));
  }

  // 7. LWC bundles with no test files
  const bundleIdsWithTest = new Set(
    lwcResources
      .filter((r: any) => r.FilePath && r.FilePath.endsWith('.test.js'))
      .map((r: any) => r.LightningComponentBundleId)
  );
  const lwcNoTest = lwcBundles.filter((b: any) => !bundleIdsWithTest.has(b.Id));
  if (lwcNoTest.length > 0) {
    const noTestPct = Math.round((lwcNoTest.length / lwcBundles.length) * 100);
    items.push(createDebtItem(
      'lwc', 'medium',
      `${lwcNoTest.length} LWC Bundle${lwcNoTest.length !== 1 ? 's' : ''} Without Jest Test Files (${noTestPct}%)`,
      'LWC components without Jest test files have no automated testing. UI regressions go undetected until they reach production.',
      'Add a __tests__ directory with at least one Jest spec per LWC bundle. Use @salesforce/sfdx-lwc-jest for component testing. Aim for >80% LWC test coverage.',
      { records: lwcNoTest.slice(0, 50).map((b: any) => ({ name: b.DeveloperName, detail: 'No .test.js file found' })) }
    ));
  }

  // 8. Stale LWC/Aura — not modified in 2+ years
  const staleLwc = lwcBundles.filter((b: any) => b.LastModifiedDate && new Date(b.LastModifiedDate) < twoYearsAgo);
  const staleAura = auraBundles.filter((b: any) => b.LastModifiedDate && new Date(b.LastModifiedDate) < twoYearsAgo);
  const totalStale = staleLwc.length + staleAura.length;
  if (totalStale > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${totalStale} Components Not Modified in 2+ Years`,
      `${staleLwc.length} LWC and ${staleAura.length} Aura components have not been updated in over 2 years. These may be abandoned, on old API versions, or contain deprecated patterns.`,
      'Audit stale components. Delete unused ones, update API versions on active ones, and flag as migration candidates.',
      { records: [...staleLwc, ...staleAura].slice(0, 50).map((b: any) => ({ name: b.DeveloperName, detail: `Last modified: ${new Date(b.LastModifiedDate).toLocaleDateString()}` })) }
    ));
  }

  // 9. Modified managed package components (installedEditable)
  const modifiedManaged = lwcBundles.filter((b: any) => b.ManageableState === 'installedEditable');
  if (modifiedManaged.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${modifiedManaged.length} Managed Package LWC Component${modifiedManaged.length !== 1 ? 's' : ''} Modified`,
      'LWC components from managed packages that have been locally modified will be overwritten on the next package upgrade, losing the changes silently.',
      'Document why each managed component was modified. Where possible, use extension points or override patterns instead of direct modification. Plan to re-apply changes after each package upgrade.',
      { records: modifiedManaged.slice(0, 30).map((b: any) => ({ name: b.DeveloperName, detail: 'Managed package component — local modifications will be overwritten on upgrade' })) }
    ));
  }

  // ── Source-level ESLint-rule checks (via LightningComponentResource.Source) ──

  // Helper: aggregate affected bundle names from source matches
  function sourceScan(
    pattern: RegExp,
    counterPattern?: RegExp
  ): { bundleId: string; name: string }[] {
    const hits: { bundleId: string; name: string }[] = [];
    const bundleMap = new Map(lwcBundles.map((b: any) => [b.Id, b.DeveloperName]));
    for (const r of jsResources) {
      const src: string = r.Source || '';
      if (!pattern.test(src)) continue;
      // For leaky-listener check: skip if counter-pattern also present
      if (counterPattern && counterPattern.test(src)) continue;
      const name = bundleMap.get(r.LightningComponentBundleId) || r.LightningComponentBundleId;
      if (!hits.find(h => h.bundleId === r.LightningComponentBundleId)) {
        hits.push({ bundleId: r.LightningComponentBundleId, name });
      }
    }
    return hits;
  }

  // 11. no-debugger — debugger statement in production code
  const debuggerHits = sourceScan(/\bdebugger\b/);
  if (debuggerHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'critical',
      `${debuggerHits.length} LWC Component${debuggerHits.length !== 1 ? 's' : ''} Contain debugger Statements`,
      'debugger statements halt execution in developer tools and must never ship to production. They indicate code that was not properly cleaned up before deployment.',
      'Remove all debugger statements. Use console.log or a structured logging approach for diagnostics. Add a lint pre-commit hook to catch these automatically.',
      { records: debuggerHits.slice(0, 50).map(h => ({ name: h.name, detail: 'debugger statement found — no-debugger violation' })) }
    ));
  }

  // 12. @lwc/lwc/no-inner-html — .innerHTML assignment (XSS risk)
  const innerHtmlHits = sourceScan(/\.innerHTML\s*=/);
  if (innerHtmlHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${innerHtmlHits.length} LWC Component${innerHtmlHits.length !== 1 ? 's' : ''} Use .innerHTML (XSS Risk)`,
      'Setting .innerHTML directly bypasses LWC\'s template engine and introduces Cross-Site Scripting (XSS) vulnerabilities. This violates the @lwc/lwc/no-inner-html ESLint rule.',
      'Replace .innerHTML assignments with LWC template directives (lwc:if, for:each, etc.) or sanitized rendering. Use DOMPurify only as a last resort for third-party HTML.',
      { records: innerHtmlHits.slice(0, 50).map(h => ({ name: h.name, detail: '.innerHTML assignment — XSS risk, no-inner-html violation' })) }
    ));
  }

  // 13. @lwc/lwc/no-document-query — document.querySelector / getElementById etc.
  const docQueryHits = sourceScan(/document\.(querySelector|querySelectorAll|getElementById|getElementsBy)/);
  if (docQueryHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${docQueryHits.length} LWC Component${docQueryHits.length !== 1 ? 's' : ''} Query the Document Directly`,
      'Using document.querySelector or document.getElementById in LWC bypasses Shadow DOM encapsulation and breaks in SSR (Server-Side Rendering). This violates the @lwc/lwc/no-document-query ESLint rule.',
      'Replace document.querySelector with this.template.querySelector to scope queries within the component\'s shadow root.',
      { records: docQueryHits.slice(0, 50).map(h => ({ name: h.name, detail: 'document.querySelector/getElementById — no-document-query violation' })) }
    ));
  }

  // 14. @lwc/lwc/no-leaky-event-listeners — addEventListener without removeEventListener
  const addListenerHits = sourceScan(/addEventListener\s*\(/, /removeEventListener\s*\(/);
  if (addListenerHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${addListenerHits.length} LWC Component${addListenerHits.length !== 1 ? 's' : ''} Add Event Listeners Without Removing Them`,
      'Event listeners added without a corresponding removeEventListener cause memory leaks — the component is retained in memory after it is removed from the DOM. This violates @lwc/lwc/no-leaky-event-listeners.',
      'Remove event listeners in the disconnectedCallback lifecycle hook. Use this.template.addEventListener for component-scoped events where possible.',
      { records: addListenerHits.slice(0, 50).map(h => ({ name: h.name, detail: 'addEventListener without removeEventListener — memory leak risk' })) }
    ));
  }

  // 15. @lwc/lwc/no-async-operation — setTimeout / setInterval / requestAnimationFrame
  const asyncOpHits = sourceScan(/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(/);
  if (asyncOpHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${asyncOpHits.length} LWC Component${asyncOpHits.length !== 1 ? 's' : ''} Use Async Timer Operations`,
      'setTimeout, setInterval, and requestAnimationFrame in LWC components can cause memory leaks if not cleared in disconnectedCallback, and break in SSR environments. This violates @lwc/lwc/no-async-operation.',
      'Clear all timers in disconnectedCallback. Use LWC reactive properties and wire adapters instead of polling timers where possible.',
      { records: asyncOpHits.slice(0, 50).map(h => ({ name: h.name, detail: 'setTimeout/setInterval/requestAnimationFrame — no-async-operation violation' })) }
    ));
  }

  // 16. @lwc/lwc/no-async-await — async/await usage
  const asyncAwaitHits = sourceScan(/\basync\s+(function|\(|[a-zA-Z_$])/);
  if (asyncAwaitHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${asyncAwaitHits.length} LWC Component${asyncAwaitHits.length !== 1 ? 's' : ''} Use async/await`,
      'async/await is not supported in all LWC execution contexts, particularly in getter functions and some lifecycle hooks. It also does not work correctly in LWC SSR. This violates @lwc/lwc/no-async-await in strict mode.',
      'Replace async/await with Promise chains (.then/.catch) or use wire adapters for data fetching. If async/await is intentional, verify it is only used in event handlers.',
      { records: asyncAwaitHits.slice(0, 50).map(h => ({ name: h.name, detail: 'async/await usage — no-async-await violation' })) }
    ));
  }

  // 17. @lwc/lwc/no-restricted-browser-globals-during-ssr — window/navigator/location
  const ssrGlobalHits = sourceScan(/\b(window\.|navigator\.|location\.(?!href\s*=))/);
  if (ssrGlobalHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${ssrGlobalHits.length} LWC Component${ssrGlobalHits.length !== 1 ? 's' : ''} Reference Browser Globals (SSR Incompatible)`,
      'Accessing window, navigator, or location directly breaks LWC Server-Side Rendering (SSR) because these globals are not available in a Node.js environment. This violates @lwc/lwc/no-restricted-browser-globals-during-ssr.',
      'Guard browser global usage with a check: if (typeof window !== "undefined"). For navigation, use NavigationMixin. For user agent detection, use wire adapters or server-side properties.',
      { records: ssrGlobalHits.slice(0, 50).map(h => ({ name: h.name, detail: 'window/navigator/location — SSR incompatible, no-restricted-browser-globals-during-ssr violation' })) }
    ));
  }

  // 18. @lwc/lwc/no-for-of — for...of loops
  const forOfHits = sourceScan(/for\s*\(\s*(const|let|var)\s+\w+\s+of\s+/);
  if (forOfHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${forOfHits.length} LWC Component${forOfHits.length !== 1 ? 's' : ''} Use for...of Loops`,
      'for...of loops require an iterator polyfill in older browsers and some LWC runtime environments. This violates @lwc/lwc/no-for-of in projects targeting broad browser compatibility.',
      'Replace for...of with Array.forEach(), Array.map(), or a standard indexed for loop for maximum compatibility.',
      { records: forOfHits.slice(0, 50).map(h => ({ name: h.name, detail: 'for...of loop — no-for-of violation' })) }
    ));
  }

  // 19. @lwc/lwc/no-rest-parameter — rest parameters (...args)
  const restParamHits = sourceScan(/function\s*\w*\s*\([^)]*\.\.\.[a-zA-Z_$]/);
  if (restParamHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${restParamHits.length} LWC Component${restParamHits.length !== 1 ? 's' : ''} Use Rest Parameters`,
      'Rest parameters (...args) require spread/rest polyfills and may cause issues in some LWC compilation targets. This violates @lwc/lwc/no-rest-parameter in strict compatibility mode.',
      'Replace rest parameters with explicit parameter lists or use the arguments object for variadic functions.',
      { records: restParamHits.slice(0, 50).map(h => ({ name: h.name, detail: 'rest parameter (...args) — no-rest-parameter violation' })) }
    ));
  }

  // 20. @lwc/lwc/no-node-env-in-ssr — process.env.NODE_ENV
  const nodeEnvHits = sourceScan(/process\.env\.NODE_ENV/);
  if (nodeEnvHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${nodeEnvHits.length} LWC Component${nodeEnvHits.length !== 1 ? 's' : ''} Reference process.env.NODE_ENV`,
      'process.env.NODE_ENV is a Node.js construct not available in browser LWC contexts. While it is replaced at build time in some bundlers, relying on it in LWC source is fragile and violates @lwc/lwc/no-node-env-in-ssr.',
      'Remove process.env.NODE_ENV checks from LWC source. Use Salesforce-native mechanisms like Custom Labels or Custom Metadata Types for environment-specific configuration.',
      { records: nodeEnvHits.slice(0, 50).map(h => ({ name: h.name, detail: 'process.env.NODE_ENV — no-node-env-in-ssr violation' })) }
    ));
  }

  // 21. no-duplicate-imports — same module imported multiple times
  const dupImportHits: { bundleId: string; name: string }[] = [];
  const bundleMap = new Map(lwcBundles.map((b: any) => [b.Id, b.DeveloperName]));
  for (const r of jsResources) {
    const src: string = r.Source || '';
    const importMatches = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
    const modules = importMatches.map(m => m.replace(/from\s+['"]/, '').replace(/['"]$/, '').trim());
    const seen = new Set<string>();
    const hasDup = modules.some(m => { if (seen.has(m)) return true; seen.add(m); return false; });
    if (hasDup) {
      const name = bundleMap.get(r.LightningComponentBundleId) || r.LightningComponentBundleId;
      if (!dupImportHits.find(h => h.bundleId === r.LightningComponentBundleId)) {
        dupImportHits.push({ bundleId: r.LightningComponentBundleId, name });
      }
    }
  }
  if (dupImportHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${dupImportHits.length} LWC Component${dupImportHits.length !== 1 ? 's' : ''} Have Duplicate Import Statements`,
      'Duplicate import statements from the same module add unnecessary overhead and indicate copy-paste errors. This violates the no-duplicate-imports ESLint rule.',
      'Consolidate all imports from the same module into a single import statement.',
      { records: dupImportHits.slice(0, 50).map(h => ({ name: h.name, detail: 'duplicate import from same module — no-duplicate-imports violation' })) }
    ));
  }

  // ── Additional JS source checks ──────────────────────────────────────────────

  // 22. eval() usage — security + performance
  const evalHits = sourceScan(/\beval\s*\(/);
  if (evalHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'critical',
      `${evalHits.length} LWC Component${evalHits.length !== 1 ? 's' : ''} Use eval()`,
      'eval() executes arbitrary strings as code, introducing critical security vulnerabilities (XSS, code injection) and severely degrading JavaScript engine optimization. It is never acceptable in LWC.',
      'Remove all eval() calls. Replace dynamic code execution with data-driven logic, JSON.parse for data, or explicit function maps.',
      { records: evalHits.slice(0, 50).map(h => ({ name: h.name, detail: 'eval() usage — security vulnerability and performance anti-pattern' })) }
    ));
  }

  // 23. console.log/warn/info in production — performance + data exposure
  const consoleHits = sourceScan(/\bconsole\.(log|warn|info|error|debug)\s*\(/);
  if (consoleHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${consoleHits.length} LWC Component${consoleHits.length !== 1 ? 's' : ''} Contain console Statements`,
      'console.log/warn/info statements left in production code expose internal data to browser developer tools, add processing overhead, and indicate code not cleaned up before deployment.',
      'Remove all console statements before deployment. Use a logging service or build-time stripping (e.g. Babel plugin) to prevent them reaching production.',
      { records: consoleHits.slice(0, 50).map(h => ({ name: h.name, detail: 'console statement in production code — data exposure and performance risk' })) }
    ));
  }

  // 24. Deprecated @track decorator — removed as required in Spring '20
  const trackHits = sourceScan(/@track\b/);
  if (trackHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${trackHits.length} LWC Component${trackHits.length !== 1 ? 's' : ''} Use Deprecated @track Decorator`,
      '@track was deprecated in Spring \'20. All LWC properties are now reactive by default — @track is redundant and signals the component has not been updated since early LWC adoption.',
      'Remove @track decorators and the corresponding import from lwc. All object/array property mutations are now tracked automatically.',
      { records: trackHits.slice(0, 50).map(h => ({ name: h.name, detail: '@track decorator — deprecated since Spring \'20, now redundant' })) }
    ));
  }

  // 25. JSON.parse(JSON.stringify(...)) deep clone anti-pattern
  const jsonCloneHits = sourceScan(/JSON\.parse\s*\(\s*JSON\.stringify\s*\(/);
  if (jsonCloneHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${jsonCloneHits.length} LWC Component${jsonCloneHits.length !== 1 ? 's' : ''} Use JSON.parse(JSON.stringify()) for Cloning`,
      'JSON.parse(JSON.stringify()) is a slow deep-clone pattern that strips undefined values, Dates, functions, and circular references. On large objects it causes noticeable UI lag.',
      'Replace with structuredClone() (supported in all modern browsers and LWC runtime) or a targeted spread/Object.assign for shallow clones.',
      { records: jsonCloneHits.slice(0, 50).map(h => ({ name: h.name, detail: 'JSON.parse(JSON.stringify()) — slow deep clone, use structuredClone()' })) }
    ));
  }

  // 26. Inline style mutation via JS (.style.)
  const styleMutationHits = sourceScan(/\.style\.(cssText\s*=|\w+\s*=)/);
  if (styleMutationHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${styleMutationHits.length} LWC Component${styleMutationHits.length !== 1 ? 's' : ''} Mutate Inline Styles via JavaScript`,
      'Directly mutating element.style in LWC bypasses the component\'s CSS encapsulation, breaks theme token inheritance, and causes style recalculations that degrade rendering performance.',
      'Replace inline style mutations with CSS class toggles (classList.add/remove) driven by reactive LWC properties. Use CSS custom properties for dynamic theming.',
      { records: styleMutationHits.slice(0, 50).map(h => ({ name: h.name, detail: 'element.style mutation — bypasses LWC CSS encapsulation' })) }
    ));
  }

  // 27. Large JS files — complexity flag (>500 lines)
  const largeBundleIds = new Set<string>();
  const largeBundleMap = new Map(lwcBundles.map((b: any) => [b.Id, b.DeveloperName]));
  for (const r of jsResources) {
    const src: string = r.Source || '';
    const lineCount = (src.match(/\n/g) || []).length + 1;
    if (lineCount > 500) {
      largeBundleIds.add(r.LightningComponentBundleId);
    }
  }
  if (largeBundleIds.size > 0) {
    const largeNames = Array.from(largeBundleIds).map(id => largeBundleMap.get(id) || id);
    items.push(createDebtItem(
      'lwc', 'medium',
      `${largeBundleIds.size} LWC Component${largeBundleIds.size !== 1 ? 's' : ''} Exceed 500 Lines of JavaScript`,
      'LWC components with >500 lines of JavaScript are doing too much. Large components are hard to test, maintain, and reuse, and contribute to slow initial render times.',
      'Split large components into smaller, focused child components. Extract business logic into ES modules (utility files) imported by the component.',
      { records: largeNames.slice(0, 50).map(name => ({ name, detail: 'JS file >500 lines — consider decomposing into smaller components' })) }
    ));
  }

  // ── HTML template checks ──────────────────────────────────────────────────────

  // Helper: scan HTML resources
  function htmlScan(
    pattern: RegExp,
    counterPattern?: RegExp
  ): { bundleId: string; name: string }[] {
    const hits: { bundleId: string; name: string }[] = [];
    const bundleMap2 = new Map(lwcBundles.map((b: any) => [b.Id, b.DeveloperName]));
    for (const r of htmlResources) {
      const src: string = r.Source || '';
      if (!pattern.test(src)) continue;
      if (counterPattern && counterPattern.test(src)) continue;
      const name = bundleMap2.get(r.LightningComponentBundleId) || r.LightningComponentBundleId;
      if (!hits.find(h => h.bundleId === r.LightningComponentBundleId)) {
        hits.push({ bundleId: r.LightningComponentBundleId, name });
      }
    }
    return hits;
  }

  // 28. Deprecated if:true / if:false directives
  const ifTrueHits = htmlScan(/\bif:(true|false)\b/);
  if (ifTrueHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${ifTrueHits.length} LWC Component${ifTrueHits.length !== 1 ? 's' : ''} Use Deprecated if:true / if:false Directives`,
      'if:true and if:false were deprecated in API v57 and removed in v60. Components using them are on old API versions and will break when the org enforces minimum API versions.',
      'Replace if:true={expr} with lwc:if={expr} and if:false={expr} with lwc:if={!expr} or lwc:else. Requires API v57+.',
      { records: ifTrueHits.slice(0, 50).map(h => ({ name: h.name, detail: 'if:true/if:false — deprecated in v57, removed in v60; migrate to lwc:if' })) }
    ));
  }

  // 29. for:each without key — forces full list re-render
  const forEachHits = htmlScan(/for:each=/, /\bkey=/);
  if (forEachHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${forEachHits.length} LWC Component${forEachHits.length !== 1 ? 's' : ''} Use for:each Without a key Attribute`,
      'Omitting the key attribute on for:each items forces LWC to destroy and recreate all list items on every render cycle instead of patching only changed items. This is a major performance issue for any list with more than a handful of items.',
      'Add a unique key={item.Id} or key={item.uniqueField} to the direct child element inside every for:each loop.',
      { records: forEachHits.slice(0, 50).map(h => ({ name: h.name, detail: 'for:each without key — full list re-render on every change' })) }
    ));
  }

  // 30. Inline style attributes in templates
  const inlineStyleHits = htmlScan(/\bstyle=["'][^"']/);
  if (inlineStyleHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${inlineStyleHits.length} LWC Component${inlineStyleHits.length !== 1 ? 's' : ''} Use Inline style= Attributes in Templates`,
      'Hardcoded inline styles in LWC templates bypass SLDS theme tokens, break dark mode and high-contrast accessibility themes, and are not scoped by Shadow DOM CSS encapsulation.',
      'Replace inline styles with CSS classes defined in the component\'s .css file. Use CSS custom properties (var(--slds-...)) for dynamic theming.',
      { records: inlineStyleHits.slice(0, 50).map(h => ({ name: h.name, detail: 'inline style= attribute in template — bypasses SLDS tokens and theming' })) }
    ));
  }

  // ── FlexiPage checks ──────────────────────────────────────────────────────────

  // 33. CustomEvent with bubbles:true AND composed:true — AppExchange security rule
  const composedBubbleHits = sourceScan(/bubbles\s*:\s*true[\s\S]{0,100}composed\s*:\s*true|composed\s*:\s*true[\s\S]{0,100}bubbles\s*:\s*true/);
  if (composedBubbleHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${composedBubbleHits.length} LWC Component${composedBubbleHits.length !== 1 ? 's' : ''} Fire Events with bubbles:true AND composed:true`,
      'CustomEvents with both bubbles:true and composed:true cross Shadow DOM boundaries and can expose internal component data to parent components in the page — including components from other namespaces. This is flagged by AppExchange security review.',
      'Set composed:false unless there is a specific requirement to cross Shadow DOM boundaries. If cross-boundary propagation is needed, use Lightning Message Service (LMS) instead.',
      { records: composedBubbleHits.slice(0, 50).map(h => ({ name: h.name, detail: 'CustomEvent bubbles:true + composed:true — Shadow DOM boundary breach risk' })) }
    ));
  }

  // 34. Hard-coded SLDS class overrides in CSS (c-scoped overrides breaking theme)
  const sldsOverrideHits: { bundleId: string; name: string }[] = [];
  const cssBundleMap = new Map(lwcBundles.map((b: any) => [b.Id, b.DeveloperName]));
  for (const r of cssResources) {
    const src: string = r.Source || '';
    // Flag CSS that overrides SLDS variables with hardcoded hex/rgb values instead of tokens
    if (/(#[0-9a-fA-F]{3,6}|rgb\s*\(|rgba\s*\()[\s\S]{0,200}\.slds-|\.slds-[\s\S]{0,200}(#[0-9a-fA-F]{3,6}|rgb\s*\(|rgba\s*\()/.test(src)) {
      const name = cssBundleMap.get(r.LightningComponentBundleId) || r.LightningComponentBundleId;
      if (!sldsOverrideHits.find(h => h.bundleId === r.LightningComponentBundleId)) {
        sldsOverrideHits.push({ bundleId: r.LightningComponentBundleId, name });
      }
    }
  }
  if (sldsOverrideHits.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${sldsOverrideHits.length} LWC Component${sldsOverrideHits.length !== 1 ? 's' : ''} Override SLDS Classes with Hardcoded Colors`,
      'Overriding SLDS classes with hardcoded hex or RGB values bypasses the Salesforce design token system. These components will not respect org-level theme customisations, dark mode, or high-contrast accessibility modes.',
      'Replace hardcoded color values with SLDS design tokens (var(--slds-g-color-*)). Use CSS custom properties scoped to the component for any non-SLDS styling.',
      { records: sldsOverrideHits.slice(0, 50).map(h => ({ name: h.name, detail: 'SLDS class override with hardcoded color — breaks theme tokens and accessibility' })) }
    ));
  }

  // 31. Stale FlexiPages not modified in 2+ years
  const stalePages = flexiPages.filter((p: any) => p.LastModifiedDate && new Date(p.LastModifiedDate) < twoYearsAgo);
  if (stalePages.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${stalePages.length} Lightning Page${stalePages.length !== 1 ? 's' : ''} Not Modified in 2+ Years`,
      'Lightning pages not updated in over 2 years may reference deprecated components, old API versions, or removed fields. They accumulate maintenance burden and slow down org audits.',
      'Review stale Lightning pages. Delete those no longer assigned, update components on active pages, and document the owner and purpose of each page.',
      { records: stalePages.slice(0, 50).map((p: any) => ({ name: p.DeveloperName, detail: `Last modified: ${new Date(p.LastModifiedDate).toLocaleDateString()} · ${p.Type}` })) }
    ));
  }

  // 32. High total FlexiPage count — governance flag
  if (flexiPages.length > 50) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${flexiPages.length} Lightning Pages Configured — Governance Review Recommended`,
      'A high number of Lightning pages is difficult to govern. Each page must be assigned, maintained, and kept compatible with component updates.',
      'Audit all Lightning pages. Establish a governance process with named owners. Delete unassigned pages and consolidate objects that have excessive page variants.',
      { count: flexiPages.length }
    ));
  }

  // 10. FlexiPage sprawl — multiple record pages per object
  const pagesByObject: Record<string, number> = {};
  flexiPages
    .filter((p: any) => p.Type === 'RecordPage' && p.EntityDefinitionId)
    .forEach((p: any) => {
      pagesByObject[p.EntityDefinitionId] = (pagesByObject[p.EntityDefinitionId] || 0) + 1;
    });
  const bloatedObjects = Object.entries(pagesByObject).filter(([_, count]) => count > 3);
  if (bloatedObjects.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${bloatedObjects.length} Objects with 4+ Lightning Record Pages`,
      'Multiple record pages per object indicates layout proliferation. Each page must be individually maintained and assigned via page assignments or record types.',
      'Consolidate record pages per object. Use Dynamic Forms and Dynamic Actions to replace page proliferation with a single adaptive page.',
      { records: bloatedObjects.map(([obj, count]) => ({ name: obj, detail: `${count} record pages` })) }
    ));
  }

  // ── Visualforce Checks ────────────────────────────────────────────────────────

  const vfPages: any[] = data.vfPages || [];

  // VF-1: Active Visualforce pages found — migration debt
  if (vfPages.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${vfPages.length} Visualforce Page${vfPages.length !== 1 ? 's' : ''} in Org — Legacy UI Technology`,
      'Visualforce is a legacy page framework. Pages on old API versions are incompatible with newer platform features, SLDS theming, and mobile accessibility. Salesforce has no plans to retire VF but all new development should use LWC.',
      'Audit Visualforce pages by usage. Replace high-traffic pages with LWC-based Lightning pages. Remove unused VF pages. Prioritise any VF pages in the Service Console or Experience Cloud.',
      { records: vfPages.slice(0, 50).map((p: any) => ({ name: p.Name, detail: `API v${p.ApiVersion}${!p.Description ? ' — no description' : ''}` })) }
    ));
  }

  // VF-2: Visualforce pages on old API versions (<v50)
  const vfOutdated = vfPages.filter((p: any) => p.ApiVersion && p.ApiVersion < 50);
  if (vfOutdated.length > 0) {
    items.push(createDebtItem(
      'lwc', 'high',
      `${vfOutdated.length} Visualforce Page${vfOutdated.length !== 1 ? 's' : ''} on Old API Versions (< v50)`,
      'Visualforce pages on API versions below v50 miss significant platform security patches and SLDS updates. These pages may not render correctly in modern browsers or Salesforce mobile.',
      'Update VF page API versions to the current version (v62+). Test each page after updating as API version changes can affect controller behaviour.',
      { records: vfOutdated.slice(0, 30).map((p: any) => ({ name: p.Name, detail: `API v${p.ApiVersion}` })) }
    ));
  }

  // VF-3: Visualforce pages without descriptions
  const vfNoDesc = vfPages.filter((p: any) => !p.Description || p.Description.trim() === '');
  if (vfNoDesc.length > 0) {
    items.push(createDebtItem(
      'lwc', 'low',
      `${vfNoDesc.length} Visualforce Page${vfNoDesc.length !== 1 ? 's' : ''} Without Descriptions`,
      'Undocumented VF pages make it impossible to identify purpose, controller dependencies, or migration priority during audits.',
      'Add descriptions to all VF pages documenting their business purpose, controller class, and whether they are a migration candidate.',
      { records: vfNoDesc.slice(0, 30).map((p: any) => ({ name: p.Name, detail: `API v${p.ApiVersion} — no description` })) }
    ));
  }

  // VF-4: Visualforce pages available in Salesforce Mobile (IsAvailableInTouch)
  const vfMobileEnabled = vfPages.filter((p: any) => p.IsAvailableInTouch === true);
  if (vfMobileEnabled.length > 0) {
    items.push(createDebtItem(
      'lwc', 'medium',
      `${vfMobileEnabled.length} Visualforce Page${vfMobileEnabled.length !== 1 ? 's' : ''} Enabled for Salesforce Mobile — Poor UX`,
      'Visualforce pages enabled for Salesforce Mobile deliver poor mobile user experience. VF was never designed for mobile and lacks responsive layouts, native mobile gestures, and offline support.',
      'Migrate mobile-enabled VF pages to LWC which renders natively in the Salesforce mobile app. Prioritise these over desktop-only VF pages.',
      { records: vfMobileEnabled.slice(0, 30).map((p: any) => ({ name: p.Name, detail: 'IsAvailableInTouch = true — VF in mobile app' })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return {
    category: 'Lightning Web Components',
    score: Math.max(0, maxScore - deductions),
    maxScore,
    percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100),
    items
  };
}

export function assessOmniStudio(data: OmniStudioData): CategoryScore {
  const items: DebtItem[] = [];

  if (!data.installed) {
    return { category: 'OmniStudio', score: 100, maxScore: 100, percentage: 100, items: [] };
  }

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  // ── OmniScripts ──────────────────────────────────────────────────────────────

  const inactiveScripts = data.omniScripts.filter((s: any) => !s.IsActive);
  if (inactiveScripts.length > 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${inactiveScripts.length} Inactive OmniScripts`,
      'OmniScripts that are not active are not deployed to end users but still exist as metadata debt.',
      'Review inactive OmniScripts. Activate scripts that are ready, or delete unused ones to reduce maintenance overhead.',
      { records: inactiveScripts.map((s: any) => ({ name: s.Name, detail: `${s.Type}/${s.SubType || ''}` })) }
    ));
  }

  const noDescScripts = data.omniScripts.filter((s: any) => !s.Description || s.Description.trim() === '');
  if (noDescScripts.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${noDescScripts.length} OmniScripts Without Descriptions`,
      'OmniScripts without descriptions make it difficult to understand purpose and ownership.',
      'Add descriptions to all OmniScripts documenting their purpose, owning team, and related business process.',
      { records: noDescScripts.map((s: any) => ({ name: s.Name })) }
    ));
  }

  const staleScripts = data.omniScripts.filter((s: any) => s.LastModifiedDate && new Date(s.LastModifiedDate) < twoYearsAgo);
  if (staleScripts.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${staleScripts.length} OmniScripts Not Modified in 2+ Years`,
      'Long-unchanged OmniScripts may be outdated, use deprecated elements, or no longer serve active business processes.',
      'Review stale OmniScripts with business stakeholders. Deactivate or archive scripts that are no longer needed.',
      { records: staleScripts.map((s: any) => ({ name: s.Name, detail: new Date(s.LastModifiedDate).toLocaleDateString() })) }
    ));
  }

  // Version sprawl — multiple active versions of same script
  const scriptVersionGroups: Record<string, number> = {};
  data.omniScripts.filter((s: any) => s.IsActive).forEach((s: any) => {
    const key = `${s.Type}/${s.SubType || s.Name}`;
    scriptVersionGroups[key] = (scriptVersionGroups[key] || 0) + 1;
  });
  const versionSprawl = Object.entries(scriptVersionGroups).filter(([, count]) => count > 1);
  if (versionSprawl.length > 0) {
    items.push(createDebtItem('omniStudio', 'high',
      `${versionSprawl.length} OmniScript Types with Multiple Active Versions`,
      'Multiple active versions of the same OmniScript type creates ambiguity about which version is authoritative and increases maintenance burden.',
      'Deactivate older versions and ensure only one version per OmniScript type is active at any time.',
      { records: versionSprawl.map(([name, count]) => ({ name, detail: `${count} active versions` })) }
    ));
  }

  // Test Mode scripts — should never be active in production
  const testModeScripts = data.omniScripts.filter((s: any) => s.IsActive && s.IsTestMode);
  if (testModeScripts.length > 0) {
    items.push(createDebtItem('omniStudio', 'critical',
      `${testModeScripts.length} Active OmniScripts in Test Mode`,
      'OmniScripts with Test Mode enabled expose debugging information to end users and bypass production validation logic. This should never be active in production.',
      'Disable Test Mode on all active OmniScripts immediately. Test Mode is only for developer sandboxes.',
      { records: testModeScripts.map((s: any) => ({ name: s.Name, detail: `${s.Type}/${s.SubType || ''}` })) }
    ));
  }

  const testModeIPs = data.integrationProcedures.filter((ip: any) => ip.IsActive && ip.IsTestMode);
  if (testModeIPs.length > 0) {
    items.push(createDebtItem('omniStudio', 'critical',
      `${testModeIPs.length} Active Integration Procedures in Test Mode`,
      'Active Integration Procedures in Test Mode expose debugging output and bypass production logic. This is a critical configuration error in production.',
      'Disable Test Mode on all active Integration Procedures immediately.',
      { records: testModeIPs.map((ip: any) => ({ name: ip.Name })) }
    ));
  }

  // LWC compilation not enabled (native only — IsLvtEnabled = false)
  const notLwcCompiled = data.omniScripts.filter((s: any) => s.IsActive && s.IsLvtEnabled === false);
  if (notLwcCompiled.length > 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${notLwcCompiled.length} Active OmniScripts Without LWC Compilation`,
      'OmniScripts without LWC (Lightning Web Runtime) compilation enabled run in the slower interpreted mode. This is a significant performance and scalability best practice violation.',
      'Enable LWC compilation on all active OmniScripts. Go to each OmniScript and toggle "LWR Enabled" to active.',
      { records: notLwcCompiled.map((s: any) => ({ name: s.Name, detail: `${s.Type}/${s.SubType || ''}` })) }
    ));
  }

  // ── Integration Procedures ───────────────────────────────────────────────────

  const inactiveIPs = data.integrationProcedures.filter((ip: any) => !ip.IsActive);
  if (inactiveIPs.length > 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${inactiveIPs.length} Inactive Integration Procedures`,
      'Inactive Integration Procedures represent undeployed or orphaned automation logic.',
      'Review inactive Integration Procedures. Activate those that are ready for use or delete unused ones.',
      { records: inactiveIPs.map((ip: any) => ({ name: ip.Name })) }
    ));
  }

  const noDescIPs = data.integrationProcedures.filter((ip: any) => !ip.Description || ip.Description.trim() === '');
  if (noDescIPs.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${noDescIPs.length} Integration Procedures Without Descriptions`,
      'Integration Procedures without descriptions make it difficult to understand data flow and dependencies.',
      'Add descriptions documenting input/output schema, calling OmniScripts, and owning team.',
      { records: noDescIPs.map((ip: any) => ({ name: ip.Name })) }
    ));
  }

  const staleIPs = data.integrationProcedures.filter((ip: any) => ip.LastModifiedDate && new Date(ip.LastModifiedDate) < twoYearsAgo);
  if (staleIPs.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${staleIPs.length} Integration Procedures Not Modified in 2+ Years`,
      'Stale Integration Procedures may have outdated logic or call deprecated APIs.',
      'Review stale Integration Procedures. Deactivate or delete those that are no longer called.',
      { records: staleIPs.map((ip: any) => ({ name: ip.Name, detail: new Date(ip.LastModifiedDate).toLocaleDateString() })) }
    ));
  }

  // ── DataRaptors / Data Transforms ────────────────────────────────────────────

  const inactiveDTs = data.dataTransforms.filter((dt: any) => !dt.IsActive);
  if (inactiveDTs.length > 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${inactiveDTs.length} Inactive DataRaptors / Data Transforms`,
      'Inactive DataRaptors represent unused data mapping logic that adds clutter and maintenance overhead.',
      'Delete DataRaptors that are no longer referenced by any OmniScript or Integration Procedure.',
      { records: inactiveDTs.map((dt: any) => ({ name: dt.Name, detail: dt.Type || '' })) }
    ));
  }

  const noDescDTs = data.dataTransforms.filter((dt: any) => !dt.Description || dt.Description.trim() === '');
  if (noDescDTs.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${noDescDTs.length} DataRaptors / Data Transforms Without Descriptions`,
      'DataRaptors without descriptions make it impossible to understand what objects and fields they map without opening each one.',
      'Add descriptions to all DataRaptors documenting source/target objects, owning OmniScript or IP, and data direction.',
      { records: noDescDTs.map((dt: any) => ({ name: dt.Name })) }
    ));
  }

  const staleDTs = data.dataTransforms.filter((dt: any) => dt.LastModifiedDate && new Date(dt.LastModifiedDate) < twoYearsAgo);
  if (staleDTs.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${staleDTs.length} DataRaptors / Data Transforms Not Modified in 2+ Years`,
      'Stale DataRaptors may reference deleted fields, outdated objects, or be completely orphaned.',
      'Review stale DataRaptors with the team. Delete those no longer referenced by active components.',
      { records: staleDTs.map((dt: any) => ({ name: dt.Name, detail: new Date(dt.LastModifiedDate).toLocaleDateString() })) }
    ));
  }

  // Turbo Extract not enabled on Extract DataRaptors
  const extractDTs = data.dataTransforms.filter((dt: any) => dt.IsActive && (dt.Type === 'Extract' || dt.Type === 'Retrieve'));
  const noTurboExtract = extractDTs.filter((dt: any) => !dt.IsTurboExtract);
  if (noTurboExtract.length > 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${noTurboExtract.length} Extract DataRaptors Without Turbo Extract`,
      'Turbo Extract is a Salesforce-recommended best practice for Extract-type DataRaptors. Without it, queries run in standard mode which is significantly slower on large data volumes.',
      'Enable Turbo Extract on all Extract-type DataRaptors. Open each DataRaptor and check the Turbo Extract option.',
      { records: noTurboExtract.map((dt: any) => ({ name: dt.Name })) }
    ));
  }

  // ── FlexCards ────────────────────────────────────────────────────────────────

  const inactiveCards = data.flexCards.filter((c: any) => !c.IsActive);
  if (inactiveCards.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${inactiveCards.length} Inactive FlexCards`,
      'Inactive FlexCards are not visible to users but remain as maintenance overhead.',
      'Review inactive FlexCards. Activate those that are ready or delete unused ones.',
      { records: inactiveCards.map((c: any) => ({ name: c.Name })) }
    ));
  }

  const staleCards = data.flexCards.filter((c: any) => c.LastModifiedDate && new Date(c.LastModifiedDate) < twoYearsAgo);
  if (staleCards.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${staleCards.length} FlexCards Not Modified in 2+ Years`,
      'Stale FlexCards may display outdated data or reference deprecated components.',
      'Review stale FlexCards with stakeholders. Deactivate or delete those that are no longer in use.',
      { records: staleCards.map((c: any) => ({ name: c.Name, detail: new Date(c.LastModifiedDate).toLocaleDateString() })) }
    ));
  }

  const noDescCards = data.flexCards.filter((c: any) => !c.Description || c.Description.trim() === '');
  if (noDescCards.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${noDescCards.length} FlexCards Without Descriptions`,
      'FlexCards without descriptions make it difficult to understand their purpose, owning team, or the OmniScript they support.',
      'Add descriptions to all FlexCards documenting their business purpose and related components.',
      { records: noDescCards.map((c: any) => ({ name: c.Name })) }
    ));
  }

  // ── Managed package version ───────────────────────────────────────────────────
  // Current Vlocity/OmniStudio managed package major version is 940+
  // Flag if below 930 (significantly outdated)
  if (data.flavor === 'managed' && data.managedPackageVersion) {
    const major = parseInt(data.managedPackageVersion.split('.')[0], 10);
    if (!isNaN(major) && major < 930) {
      items.push(createDebtItem('omniStudio', 'medium',
        `OmniStudio Managed Package Version ${data.managedPackageVersion} — Outdated`,
        'The installed Vlocity/OmniStudio managed package is significantly out of date. Older versions miss critical bug fixes, security patches, and compatibility updates for newer Salesforce API versions.',
        'Upgrade the OmniStudio managed package to the latest available version via the Salesforce AppExchange or your Vlocity/Salesforce representative.',
        { version: data.managedPackageVersion }
      ));
    }
  }

  // ── Volume flags ─────────────────────────────────────────────────────────────

  const totalDTs = data.dataTransforms.length;
  if (totalDTs > 100) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${totalDTs} DataRaptors / Data Transforms — High Volume`,
      'A large number of DataRaptors increases deployment complexity and the risk of conflicts during upgrades.',
      'Audit for duplicate or near-duplicate DataRaptors. Consolidate where possible and enforce a naming and ownership convention.',
      { count: totalDTs }
    ));
  }

  // ── LWC Runtime & Accessibility ──────────────────────────────────────────────

  const auraRuntimeScripts = data.auraRuntimeScripts || [];
  if (auraRuntimeScripts.length > 0) {
    items.push(createDebtItem('omniStudio', 'high',
      `${auraRuntimeScripts.length} Active OmniScripts Still Using Aura Runtime (LWC Disabled)`,
      'Salesforce retired the Aura-based OmniScript runtime. Active OmniScripts with IsLvtEnabled = false fail WCAG 2.1 AA accessibility requirements, lack keyboard navigation and ARIA support, and are on a deprecated execution path with no future investment.',
      'Enable the LWC runtime on all active OmniScripts. In Setup → OmniStudio, open each script and toggle the LWC Compilation setting. Test thoroughly before activating — LWC runtime may expose layout differences.',
      { records: auraRuntimeScripts.map((s: any) => ({ name: s.Name, detail: `${s.Type}/${s.SubType || ''}` })) }
    ));
  }

  // ── Integration Procedure error handling ─────────────────────────────────────

  const ipsNoErrorHandling = data.ipsNoErrorHandling || [];
  if (ipsNoErrorHandling.length > 0) {
    items.push(createDebtItem('omniStudio', 'high',
      `${ipsNoErrorHandling.length} Active Integration Procedures With No Error-Handling Element`,
      'Integration Procedures without a SetErrors or Throw element silently swallow API failures and return empty data to the calling OmniScript with no user feedback or logging. This leads to broken form flows and undetectable data corruption.',
      'Add a SetErrors or Throw element to every Integration Procedure to handle HTTP errors and unexpected empty responses. Route error paths to a dedicated error response structure.',
      { records: ipsNoErrorHandling.map((ip: any) => ({ name: ip.Name, detail: `${ip.Type}/${ip.SubType || ''}` })) }
    ));
  }

  // ── DataTransform type distribution ──────────────────────────────────────────

  const dtTypes = data.dataTransformTypes || {};
  const extractCount = (dtTypes['Retrieve'] || dtTypes['Extract'] || 0) as number;
  const turboCount = (dtTypes['RetrieveSObjectCollections'] || dtTypes['Turbo Extract'] || 0) as number;
  if (extractCount > 0 && turboCount === 0) {
    items.push(createDebtItem('omniStudio', 'medium',
      `${extractCount} Standard Extract DataRaptors — No Turbo Extract in Use`,
      'All Extract DataRaptors use the standard extraction engine. Salesforce recommends Turbo Extract for read-only SOQL retrievals — it bypasses the transformation engine and is significantly faster. Zero Turbo Extract usage signals a missed performance optimisation opportunity.',
      'Audit Extract DataRaptors for candidates to convert to Turbo Extract. Any DataRaptor that only reads data (no complex mappings) is a conversion candidate.',
      { count: extractCount }
    ));
  } else if (extractCount > turboCount * 2 && extractCount > 5) {
    items.push(createDebtItem('omniStudio', 'low',
      `${extractCount} Standard Extract DataRaptors vs ${turboCount} Turbo Extract — Consider More Turbo Extract`,
      'Standard Extract DataRaptors significantly outnumber Turbo Extract DataRaptors. Salesforce recommends Turbo Extract for read-only retrievals as a performance best practice.',
      'Review standard Extract DataRaptors. Migrate simple read-only retrievals to Turbo Extract to reduce transaction time.',
      {}
    ));
  }

  // ── Naming conventions ────────────────────────────────────────────────────────

  const namingViolations = data.namingViolations || [];
  if (namingViolations.length > 0) {
    items.push(createDebtItem('omniStudio', 'low',
      `${namingViolations.length} OmniScripts With Spaces in Type or SubType`,
      'OmniScript Type and SubType should use PascalCase with no spaces. Spaces in the composite key break invocation by API name, cause issues in URL-based launching, and signal uncontrolled creation.',
      'Rename OmniScript Type/SubType fields to use PascalCase (e.g., "Address Change" → "AddressChange"). Update all references to the composite key.',
      { records: namingViolations.map((s: any) => ({ name: s.Name, detail: `Type: "${s.Type}" / SubType: "${s.SubType || ''}"` })) }
    ));
  }

  // ── Deprecated element types ──────────────────────────────────────────────────

  const remoteActionElements = data.remoteActionElements || [];
  if (remoteActionElements.length > 0) {
    items.push(createDebtItem('omniStudio', 'high',
      `${remoteActionElements.length} Active OmniScripts Using Deprecated Remote Action Elements`,
      'Remote Action elements (Visualforce-style Apex Remote Actions) are deprecated in OmniStudio. They are incompatible with the LWC runtime and headless OmniScript invocation, and receive no new platform investment.',
      'Replace Remote Action elements with Integration Procedure Action elements calling a properly structured Integration Procedure, or use DataRaptor Turbo Extract for data retrieval.',
      { records: remoteActionElements.map((e: any) => ({ name: e.ScriptName || e.Id, detail: `Element: ${e.ElementName}` })) }
    ));
  }

  // ── Legacy Knowledge article types ───────────────────────────────────────────

  const legacyKavTypes = data.legacyKavTypes || [];
  if (legacyKavTypes.length > 0) {
    items.push(createDebtItem('omniStudio', 'high',
      `${legacyKavTypes.length} Legacy Knowledge Article Type${legacyKavTypes.length !== 1 ? 's' : ''} Still in Schema (Pre-Spring '20 Migration Incomplete)`,
      'Legacy article type objects (e.g., FAQ__kav, HowTo__kav) from before the Spring 2020 unified Knowledge migration are still present. These objects are deprecated, receive no new platform investment, and create Knowledge search inconsistencies.',
      'Complete the Knowledge article type migration to the unified Knowledge__kav model. Use the Salesforce Knowledge Migration Tool and follow the Winter \'20 migration guide.',
      { records: legacyKavTypes.map((t: any) => ({ name: t.QualifiedApiName, detail: t.Label })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return {
    category: 'OmniStudio',
    score: Math.max(0, maxScore - deductions),
    maxScore,
    percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100),
    items
  };
}

export function assessPerformance(data: PerformanceData): CategoryScore {
  const items: DebtItem[] = [];

  // ── Apex Runtime ─────────────────────────────────────────────────────────────

  if (data.largeApexClasses.length > 0) {
    items.push(createDebtItem('performance', 'medium',
      `${data.largeApexClasses.length} Apex Classes Over 1,000 Lines`,
      'Oversized Apex classes are harder to test, maintain, and debug. Large classes often violate the Single Responsibility Principle and slow compile times.',
      'Refactor large Apex classes into smaller, focused classes. Break out utility methods into separate helper classes.',
      { records: data.largeApexClasses.map((c: any) => ({ name: c.Name, detail: `${c.LengthWithoutComments} lines` })) }
    ));
  }

  if (data.multiTriggerObjects.length > 0) {
    items.push(createDebtItem('performance', 'high',
      `${data.multiTriggerObjects.length} Objects with Multiple Active Triggers`,
      'Multiple triggers on the same object execute in an unpredictable order and can cause recursive firing, governor limit exhaustion, and hard-to-diagnose bugs.',
      'Consolidate all triggers per object into a single trigger using a trigger handler framework (e.g., FFLIB, TriggerHandler).',
      { records: data.multiTriggerObjects.map((t: any) => ({ name: t.obj, detail: `${t.count} triggers` })) }
    ));
  }

  if (data.batchConcurrent.length > 3) {
    items.push(createDebtItem('performance', 'high',
      `${data.batchConcurrent.length} Batch Apex Jobs Running Concurrently`,
      'Salesforce allows a maximum of 5 concurrent batch jobs. High concurrency consumes shared resources and can cause new batch submissions to fail or queue indefinitely.',
      'Review batch scheduling. Stagger batch start times and consider replacing short batch jobs with Queueable chains or Platform Events.',
      { records: data.batchConcurrent.map((j: any) => ({ name: j.ApexClass?.Name || j.Id, detail: j.Status })) }
    ));
  }

  if (data.traceFlagsActive.length > 0) {
    items.push(createDebtItem('performance', 'high',
      `${data.traceFlagsActive.length} Active Debug Trace Flags`,
      'Active trace flags force Salesforce to capture and store debug logs for every transaction on the traced entity. This adds measurable overhead to every DML operation, SOQL query, and Apex execution for that user or class.',
      'Remove all debug trace flags that are no longer needed. Use Developer Console or VS Code Developer Log sparingly during active debugging only.',
      { records: data.traceFlagsActive.map((f: any) => ({ name: f.TracedEntityId, detail: `Expires: ${f.ExpirationDate ? new Date(f.ExpirationDate).toLocaleDateString() : 'unknown'}` })) }
    ));
  }

  // ── Async Queue Depth ─────────────────────────────────────────────────────────

  if (data.asyncQueuedJobs.length > 50) {
    items.push(createDebtItem('performance', 'high',
      `${data.asyncQueuedJobs.length} Async Apex Jobs Queued (Batch/Queueable/Future)`,
      'A large backlog of queued async jobs indicates processing delays. Jobs waiting in queue are not executing, which can delay time-sensitive automation.',
      'Investigate the root cause of the queue backlog. Check for runaway recursion, batch chains, or a high-volume process flooding the queue.',
      { count: data.asyncQueuedJobs.length }
    ));
  }

  if (data.futureQueueable.length > 20) {
    items.push(createDebtItem('performance', 'medium',
      `${data.futureQueueable.length} Future/Queueable Jobs Pending`,
      'A large backlog of Future and Queueable jobs creates delays in asynchronous processing. Future methods are limited to 50 per Apex transaction and compete with batch jobs for the async queue.',
      'Review what is generating this volume of async jobs. Consider replacing @future methods with Queueable chains that offer more control over concurrency.',
      { count: data.futureQueueable.length }
    ));
  }

  const recentFailRate = data.recentFailedJobs.length;
  if (recentFailRate > 10) {
    items.push(createDebtItem('performance', 'high',
      `${recentFailRate} Async Apex Failures in the Last 30 Days`,
      'A high async job failure rate indicates recurring errors in batch, queueable, or future methods that are silently swallowed. Failed jobs may leave data in an inconsistent state.',
      'Review failed job error messages in Setup → Apex Jobs. Add robust error handling, retry logic, and alerting to async Apex jobs.',
      { records: data.recentFailedJobs.slice(0, 50).map((j: any) => ({ name: j.ApexClass?.Name || j.Id, detail: j.JobType })) }
    ));
  } else if (recentFailRate > 0) {
    items.push(createDebtItem('performance', 'medium',
      `${recentFailRate} Async Apex Failures in the Last 30 Days`,
      'Async Apex failures indicate errors in batch, queueable, or future methods that may leave data in an inconsistent state.',
      'Review failed job error messages in Setup → Apex Jobs. Add error handling and alerting to async Apex jobs.',
      { records: data.recentFailedJobs.slice(0, 50).map((j: any) => ({ name: j.ApexClass?.Name || j.Id, detail: j.JobType })) }
    ));
  }

  // ── Scheduled Jobs ─────────────────────────────────────────────────────────────

  if (data.scheduledApex.length > 20) {
    items.push(createDebtItem('performance', 'medium',
      `${data.scheduledApex.length} Scheduled Apex Jobs Waiting`,
      'A large number of scheduled jobs creates queue pressure, delays execution windows, and can cause jobs to be skipped if the org is busy. Salesforce enforces a maximum of 100 scheduled Apex jobs.',
      'Audit scheduled jobs. Consolidate similar jobs into a single scheduler, use a dispatcher pattern, and remove any stale or redundant schedules.',
      { records: data.scheduledApex.map((j: any) => ({ name: j.CronJobDetail?.Name || j.Id, detail: j.NextFireTime ? new Date(j.NextFireTime).toLocaleDateString() : '' })) }
    ));
  }

  if (data.scheduledFlows.length > 10) {
    items.push(createDebtItem('performance', 'medium',
      `${data.scheduledFlows.length} Active Scheduled Flows`,
      'Each scheduled flow creates background jobs that run at defined intervals. A high number of scheduled flows can flood the async queue and slow overall org performance.',
      'Review scheduled flows. Combine flows that run on the same schedule. Consider replacing with a single scheduled Apex job that handles multiple use cases.',
      { records: data.scheduledFlows.map((f: any) => ({ name: f.Label || f.ApiName })) }
    ));
  }

  // ── Flows ─────────────────────────────────────────────────────────────────────

  const flowsByObject: Record<string, string[]> = {};
  for (const f of data.recordTriggeredFlows) {
    const obj = f.ApiName?.split('_')[0] || 'Unknown';
    if (!flowsByObject[obj]) flowsByObject[obj] = [];
    flowsByObject[obj].push(f.Label || f.ApiName);
  }
  const heavyFlowObjects = Object.entries(flowsByObject).filter(([_, flows]) => flows.length > 3);
  if (heavyFlowObjects.length > 0) {
    items.push(createDebtItem('performance', 'medium',
      `${heavyFlowObjects.length} Objects with 4+ Record-Triggered Flows`,
      'Multiple record-triggered flows on the same object each execute synchronously on every save. Each additional flow increases DML transaction time and governor limit consumption.',
      'Consolidate record-triggered flows per object into a single flow using Decision elements to branch logic. This reduces transaction overhead and makes execution order predictable.',
      { records: heavyFlowObjects.map(([obj, flows]) => ({ name: obj, detail: `${flows.length} flows` })) }
    ));
  }

  // ── Platform Cache ────────────────────────────────────────────────────────────

  if (data.platformCachePartitions.length === 0) {
    items.push(createDebtItem('performance', 'low',
      'Platform Cache Not Configured',
      'Platform Cache is not enabled in this org. Without Platform Cache, repeated SOQL queries for static or rarely-changing data (org settings, picklist values, custom metadata) run on every transaction.',
      'Enable Platform Cache in Setup → Platform Cache. Allocate session cache for user-specific data and org cache for shared reference data. Update Apex to use Cache.Session or Cache.Org.',
      {}
    ));
  }

  // ── Data Model ────────────────────────────────────────────────────────────────

  if (data.wideObjects.length > 0) {
    items.push(createDebtItem('performance', 'medium',
      `${data.wideObjects.length} Custom Objects with 300+ Fields`,
      'Objects with an extremely high field count slow SOQL queries on that object (even when selecting a subset of fields), increase page load time for record layouts, and hit field-level security evaluation overhead.',
      'Audit field usage for these objects. Archive or delete unused fields. Consider child objects or external objects for rarely-used field groups.',
      { records: data.wideObjects.map((o: any) => ({ name: o.EntityDefinitionId, detail: `${o.expr0} fields` })) }
    ));
  }

  // ── UI & Lightning ────────────────────────────────────────────────────────────

  if (data.auraBundles.length > 50) {
    items.push(createDebtItem('performance', 'low',
      `${data.auraBundles.length} Aura Component Bundles Still Deployed`,
      'Aura components render slower than LWC equivalents. A large Aura footprint increases page load time and represents a migration gap to the more performant LWC framework.',
      'Prioritize migrating Aura components to LWC. Focus on components embedded in high-traffic record pages and service console layouts.',
      { records: data.auraBundles.map((b: any) => ({ name: b.DeveloperName })) }
    ));
  }

  if (data.heavyEntities.length > 0) {
    items.push(createDebtItem('performance', 'low',
      `${data.heavyEntities.length} Objects with 6+ Lightning Pages`,
      'Objects with many Lightning record pages indicate layout proliferation. Each page must be individually maintained, and having many pages assigned to the same object can slow page assignment resolution.',
      'Consolidate record pages per object. Use Dynamic Forms and Dynamic Actions to create a single adaptive page instead of multiple object-level page variants.',
      { records: data.heavyEntities.map((e: any) => ({ name: e.eid, detail: `${e.count} pages` })) }
    ));
  }

  // ── Observability ─────────────────────────────────────────────────────────────

  if (data.eventLogFiles.length === 0) {
    items.push(createDebtItem('performance', 'low',
      'Event Monitoring Not Producing Logs (Last 7 Days)',
      'No Event Log Files found for the past 7 days. Event Monitoring provides performance data on SOQL consumption, Apex CPU usage, and login patterns. Without it, performance regressions are difficult to detect.',
      'Verify Event Monitoring is enabled for this org (requires Event Monitoring add-on). If enabled, review Setup → Event Log Files to confirm log generation.',
      {}
    ));
  }

  // ── Stuck async jobs ──────────────────────────────────────────────────────────
  if ((data.stuckAsyncJobCount || 0) > 0) {
    items.push(createDebtItem('performance', 'high',
      `${data.stuckAsyncJobCount} Async Apex Jobs Stuck in Processing for 24+ Hours`,
      'Async jobs stuck in Processing or Holding for more than 24 hours indicate a hung batch, a deadlock, or a runaway job consuming a platform worker. Jobs queued behind them are blocked indefinitely.',
      'Check Setup → Apex Jobs for error messages on stuck jobs. Use AbortJob to terminate hung jobs. Investigate root cause — common causes include infinite loops, CPU exhaustion, or platform-level throttling.',
      {}
    ));
  }

  // ── Total active flow count ───────────────────────────────────────────────────
  if ((data.totalActiveFlowCount || 0) > 300) {
    items.push(createDebtItem('performance', 'medium',
      `${data.totalActiveFlowCount} Active Flows in Org`,
      'A very high number of active flows creates governance overhead and makes troubleshooting automation failures extremely difficult. Flow deployments also slow down org deployments as each active flow is evaluated.',
      'Audit active flows. Deactivate and delete flows no longer in use. Consolidate overlapping flows into fewer, well-designed automations. Aim to keep active flow count below 200.',
      {}
    ));
  }

  // ── Obsolete flow versions ────────────────────────────────────────────────────
  if ((data.obsoleteFlowCount || 0) > 200) {
    items.push(createDebtItem('performance', 'low',
      `${data.obsoleteFlowCount} Obsolete Flow Versions in Org`,
      'Obsolete flow versions accumulate over time as flows are activated and replaced. Very large numbers of obsolete versions slow sandbox deployments and clutter the Setup interface.',
      'Periodically delete obsolete flow versions via Setup → Flows or via the Metadata API. Keep only the current active version plus one prior version for rollback capability.',
      {}
    ));
  }

  // ── Apex 5,000+ lines (severe tier) ──────────────────────────────────────────
  const veryLargeApexClasses = data.largeApexClasses.filter((c: any) => (c.LengthWithoutComments || 0) > 5000);
  if (veryLargeApexClasses.length > 0) {
    items.push(createDebtItem('performance', 'high',
      `${veryLargeApexClasses.length} Apex Classes Exceed 5,000 Lines`,
      'Apex classes over 5,000 lines are extreme outliers that severely violate the Single Responsibility Principle. They slow Apex compilation, make test coverage requirements harder to meet, and are prime candidates for governor limit failures due to method complexity.',
      'Immediately prioritise refactoring these classes. Break into domain-specific service classes, extract utilities, and adopt a layered architecture (handler, service, selector, domain).',
      { records: veryLargeApexClasses.map((c: any) => ({ name: c.Name, detail: `${c.LengthWithoutComments} lines` })) }
    ));
  }

  // ── Flow DML in loops ─────────────────────────────────────────────────────────
  const loopsSet = new Set((data.flowsWithLoopsIds || []).map(String));
  const dmlSet = new Set((data.flowsWithDmlIds || []).map(String));
  const flowsWithBoth = Array.from(loopsSet).filter(id => dmlSet.has(id));
  if (flowsWithBoth.length > 0) {
    items.push(createDebtItem('performance', 'high',
      `${flowsWithBoth.length} Active Flows Contain Both Loop and DML Elements`,
      'Flows that contain both a Loop element and record DML elements (Create/Update/Delete Records) are likely performing DML inside a loop. This hits the 150 DML statement governor limit in bulk scenarios and causes Flow fault errors or record save failures. This is flagged by Salesforce Code Analyzer (Flow Scanner: Database Operations in Loops).',
      'Refactor the flow to collect records inside the loop into a collection variable, then perform a single Create/Update/Delete Records element outside the loop using the collection.',
      {}
    ));
  }

  // Large static resources — oversized files slow Experience Cloud, LWC, and Visualforce pages
  const largeStaticResources = data.largeStaticResources || [];
  if (largeStaticResources.length > 0) {
    const totalSizeKb = Math.round(largeStaticResources.reduce((sum: number, r: any) => sum + (r.BodyLength || 0), 0) / 1024);
    items.push(createDebtItem('performance', 'medium',
      `${largeStaticResources.length} Static Resource${largeStaticResources.length !== 1 ? 's' : ''} Over 500 KB`,
      `${largeStaticResources.length} static resource${largeStaticResources.length !== 1 ? 's' : ''} exceed 500 KB uncompressed (${totalSizeKb.toLocaleString()} KB total). Oversized JS, CSS, and image resources loaded by Experience Cloud, LWC, or Visualforce pages increase Time to First Byte and First Contentful Paint. They are also subject to Salesforce static resource size limits (50 MB per resource, 250 MB org total).`,
      'Audit each large static resource: compress images (WebP/AVIF), minify and bundle JS/CSS, remove unused vendor libraries, and split large archives. For Experience Cloud, prefer uploading images as CMS content rather than static resources. Use a CDN or external host for very large third-party libraries.',
      { records: largeStaticResources.slice(0, 20).map((r: any) => ({
        name: r.Name,
        detail: `${Math.round(r.BodyLength / 1024)} KB · ${r.ContentType || 'unknown type'}`
      })) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return {
    category: 'Performance',
    score: Math.max(0, maxScore - deductions),
    maxScore,
    percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100),
    items
  };
}

export function assessNotesAttachments(data: NotesAttachmentsData): CategoryScore {
  const items: DebtItem[] = [];

  // ── Legacy Notes ──────────────────────────────────────────────────────────────

  if (data.legacyNoteCount > 0) {
    items.push(createDebtItem('notesAttachments', 'high',
      `${data.legacyNoteCount.toLocaleString()} Legacy Note Records Found`,
      'Classic Note records (the Note object) are a deprecated data format. They are plain-text only, have limited formatting, cannot be searched via the unified Salesforce search, and cannot be managed through the Files & Content governance framework.',
      'Enable Enhanced Notes in Setup → Notes Settings. Migrate legacy Note records to ContentNote using the Salesforce Notes Migration Tool or a bulk data migration. Enhanced Notes support rich text, related records, and standard content permissions.',
      {}
    ));
  }

  // ── Legacy Attachments ────────────────────────────────────────────────────────

  if (data.legacyAttachmentCount > 0) {
    items.push(createDebtItem('notesAttachments', 'high',
      `${data.legacyAttachmentCount.toLocaleString()} Legacy Attachment Records Found`,
      'Classic Attachment records are stored against the parent record directly and bypass the Salesforce Files (ContentDocument/ContentVersion) framework. They lack version control, external sharing controls, content delivery options, and file governance. Salesforce has deprecated the Attachment object and it may be removed in a future release.',
      'Migrate legacy Attachments to Salesforce Files (ContentDocument/ContentVersion/ContentDocumentLink) using the Salesforce Files Migration Utility. After migration, deactivate Attachment upload functionality in your page layouts.',
      {}
    ));
  }

  // ── Enhanced Notes not enabled ────────────────────────────────────────────────

  if (!data.enhancedNotesEnabled && data.legacyNoteCount === 0 && data.contentNoteCount === 0) {
    items.push(createDebtItem('notesAttachments', 'medium',
      'Enhanced Notes Not Enabled',
      'Enhanced Notes (ContentNote) are disabled. Users are limited to plain-text legacy Notes that lack rich-text formatting, file attachments within a note, and integration with the Salesforce Files framework.',
      'Enable Enhanced Notes in Setup → Notes Settings. This enables rich-text note-taking directly on records and stores notes as ContentNote records compatible with the Files framework.',
      {}
    ));
  }

  // ── Orphaned ContentDocuments ─────────────────────────────────────────────────

  if (data.orphanedContentDocumentCount > 0) {
    items.push(createDebtItem('notesAttachments', 'medium',
      `${data.orphanedContentDocumentCount.toLocaleString()} Orphaned ContentDocument Records`,
      'ContentDocument records with no ContentDocumentLink are not linked to any record, library, or user. These files consume org storage, cannot be discovered through standard navigation, and represent a governance gap as their provenance is unknown.',
      'Identify and review orphaned ContentDocuments. Files with no business context should be deleted. Files that belong to records should be re-linked via ContentDocumentLink. Run this audit periodically to prevent storage bloat.',
      {}
    ));
  }

  // ── Large files ───────────────────────────────────────────────────────────────

  if (data.largeFileCount > 0) {
    items.push(createDebtItem('notesAttachments', 'medium',
      `${data.largeFileCount} Files Larger Than 25 MB`,
      'Files over 25 MB slow download performance, consume significant file storage allocation, and can cause timeouts during API-based file retrieval. Salesforce file storage is metered and large files are the primary driver of storage limit consumption.',
      'Review large files and determine if they belong in Salesforce. Consider moving binary assets (videos, large PDFs, datasets) to an external content store (SharePoint, Box, Google Drive) and linking them via Salesforce Files Connect or custom rich text fields.',
      { records: data.largeFiles.map((f: any) => ({ name: f.Title || 'Untitled', detail: `${Math.round((f.ContentSize || 0) / 1048576)} MB` })) }
    ));
  }

  // ── Untitled ContentDocuments ─────────────────────────────────────────────────

  if (data.untitledContentDocumentCount > 0) {
    items.push(createDebtItem('notesAttachments', 'low',
      `${data.untitledContentDocumentCount} Files With No Title`,
      'ContentDocument records without a Title are undiscoverable through search and provide no context for viewers. They indicate files uploaded without proper governance (e.g., from API integrations or data migrations).',
      'Bulk-update untitled ContentDocument records to set meaningful titles. Enforce title entry at the point of upload by reviewing page layout and upload component settings. For files created via API, ensure the integration sets Title on ContentVersion.',
      {}
    ));
  }

  // ── Externally shared files ───────────────────────────────────────────────────

  if (data.externallySharedFileCount > 0) {
    items.push(createDebtItem('notesAttachments', 'high',
      `${data.externallySharedFileCount} Files Shared Externally via Content Delivery`,
      'ContentDistribution records create publicly accessible links to files hosted in Salesforce. Files shared with no expiry date remain publicly accessible indefinitely. This is a data exposure risk for any file that contains customer, employee, or confidential business data.',
      'Audit all active ContentDistribution records. Revoke external sharing for files that no longer need it. Set expiry dates on all active distributions. Establish a governance policy for external file sharing with regular review cycles.',
      {}
    ));
  }

  // ── No content libraries ──────────────────────────────────────────────────────

  if (data.contentWorkspaceCount === 0) {
    items.push(createDebtItem('notesAttachments', 'low',
      'No Salesforce Content Libraries Configured',
      'Content Libraries (ContentWorkspace) provide a governed shared repository for files that need to be accessible across multiple records or users. Without libraries, files are ad-hoc attachments with no reusability or version governance.',
      'Create Content Libraries in Setup → Content → Content Deliveries and Libraries for reusable assets (templates, branding assets, product documentation). Assign appropriate library permissions based on user roles.',
      {}
    ));
  }

  // ── Files permanently shared externally ──────────────────────────────────────
  if ((data.permanentlySharedFileCount || 0) > 0) {
    items.push(createDebtItem('notesAttachments', 'high',
      `${data.permanentlySharedFileCount} Files Shared Externally With No Expiry Date`,
      'ContentDistribution records with no ExpiryDate create publicly accessible download links that never expire. These files remain publicly accessible indefinitely — even if the associated record is deleted or the sharing was intended to be temporary. This is a data governance and potential data exposure risk.',
      'Immediately audit all ContentDistribution records with no ExpiryDate. Set expiry dates on active distributions or revoke them. Establish a governance policy that mandates expiry dates on all external file shares.',
      {}
    ));
  }

  // ── High file volume by object ────────────────────────────────────────────────
  const highVolumeObjects = (data.topAttachmentObjects || []).filter((o: any) => o.count > 10000);
  if (highVolumeObjects.length > 0) {
    items.push(createDebtItem('notesAttachments', 'medium',
      `${highVolumeObjects.length} Object${highVolumeObjects.length !== 1 ? 's' : ''} with 10,000+ File Attachments`,
      'Objects with extremely high ContentDocumentLink counts indicate uncontrolled file attachment behaviour. This drives up Salesforce file storage consumption (billed separately), slows record page load times when the Files related list loads, and complicates data migration or archiving efforts.',
      'Review attachment patterns for high-volume objects. Implement file governance policies (max file size, allowed file types). Consider routing large file volumes to external storage (SharePoint, Box) via Files Connect. Archive or delete files older than your retention policy.',
      { records: highVolumeObjects.map((o: any) => ({ name: o.obj, detail: `${o.count.toLocaleString()} files` })) }
    ));
  }

  // ── Stale files not accessed in 2+ years ─────────────────────────────────────
  if ((data.staleFileCount || 0) > 0) {
    items.push(createDebtItem('notesAttachments', 'low',
      `${data.staleFileCount.toLocaleString()} Files Not Viewed in 2+ Years`,
      'Files with no LastViewedDate activity for over 2 years are likely abandoned. They consume file storage allocation, add noise to file searches, and complicate data migration and archiving.',
      'Establish a file retention policy. Identify stale files with a bulk query and review with record owners. Delete files with no business retention requirement. Archive files required for compliance to a lower-cost storage tier.',
      {}
    ));
  }

  // ── Notes & Attachments by object breakdown ───────────────────────────────────
  if (data.topAttachmentObjects && data.topAttachmentObjects.length > 0) {
    const top5 = data.topAttachmentObjects.slice(0, 5);
    const totalLinked = top5.reduce((s: number, o: any) => s + (o.count || 0), 0);
    if (totalLinked > 5000) {
      items.push(createDebtItem('notesAttachments', 'low',
        `File Distribution Across Objects — Top Objects Identified`,
        `The top ${top5.length} objects account for ${totalLinked.toLocaleString()} file links. Understanding which objects accumulate the most files helps prioritise storage governance and archiving efforts.`,
        'Review file attachment volumes per object. Apply object-specific governance rules: enforce file type restrictions, implement automated archiving for old attachments on closed records, and set storage budgets per object type.',
        { records: top5.map((o: any) => ({ name: o.obj, detail: `${o.count.toLocaleString()} files` })) }
      ));
    }
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  return {
    category: 'Notes & Attachments',
    score: Math.max(0, maxScore - deductions),
    maxScore,
    percentage: Math.round((Math.max(0, maxScore - deductions) / maxScore) * 100),
    items
  };
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
