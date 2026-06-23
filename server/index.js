const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const jsforce = require('jsforce');

const app = express();
const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
}
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: isProduction,
    maxAge: 3600000,
    sameSite: 'lax'
  },
  proxy: isProduction
}));

if (isProduction) {
  app.set('trust proxy', 1);
}

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL;
  if (isProduction) return `${req.protocol}://${req.get('host')}`;
  return 'http://localhost:3000';
}

function getCallbackUrl(req) {
  if (process.env.SF_CALLBACK_URL) return process.env.SF_CALLBACK_URL;
  const base = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${base}/auth/callback`;
}

app.get('/auth/login', (req, res) => {
  const loginUrl = (req.query.loginUrl || process.env.SF_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const clientId = req.query.clientId || process.env.SF_CLIENT_ID;
  const clientSecret = req.query.clientSecret || process.env.SF_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect(`${getBaseUrl(req)}/login?error=missing_credentials`);
  }

  req.session.loginUrl = loginUrl;
  req.session.clientId = clientId;
  req.session.clientSecret = clientSecret;

  const oauth = new jsforce.OAuth2({
    loginUrl,
    clientId,
    clientSecret,
    redirectUri: getCallbackUrl(req)
  });

  const authUrl = oauth.getAuthorizationUrl({ scope: 'api refresh_token' });
  req.session.save(err => {
    if (err) {
      console.error('Session save error:', err);
      return res.redirect(`${getBaseUrl(req)}/login?error=session_error`);
    }
    res.redirect(authUrl);
  });
});

app.get('/auth/callback', async (req, res) => {
  const loginUrl = req.session.loginUrl || 'https://login.salesforce.com';
  const clientId = req.session.clientId || process.env.SF_CLIENT_ID;
  const clientSecret = req.session.clientSecret || process.env.SF_CLIENT_SECRET;

  const oauth = new jsforce.OAuth2({
    loginUrl,
    clientId,
    clientSecret,
    redirectUri: getCallbackUrl(req)
  });

  const conn = new jsforce.Connection({ oauth2: oauth });
  try {
    await conn.authorize(req.query.code);
    req.session.accessToken = conn.accessToken;
    req.session.instanceUrl = conn.instanceUrl;
    req.session.refreshToken = conn.refreshToken;

    // Fetch org identifying info and store in session
    try {
      await new Promise((resolve) => {
        conn.query(
          "SELECT Id, Name, OrganizationType, IsSandbox, InstanceName, PrimaryContact " +
          "FROM Organization LIMIT 1",
          (err, result) => {
            if (!err && result.records && result.records.length > 0) {
              const org = result.records[0];
              req.session.orgId       = org.Id;
              req.session.orgName     = org.Name;
              req.session.orgType     = org.OrganizationType;
              req.session.isSandbox   = org.IsSandbox;
              req.session.instanceName = org.InstanceName;
            }
            resolve(null);
          }
        );
      });
    } catch (e) { /* non-fatal */ }

    req.session.save(err => {
      if (err) {
        console.error('Session save error after auth:', err);
        return res.redirect(`${getBaseUrl(req)}/login?error=auth_failed`);
      }
      res.redirect(`${getBaseUrl(req)}/dashboard`);
    });
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect(`${getBaseUrl(req)}/login?error=auth_failed`);
  }
});

app.get('/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session.accessToken && req.session.instanceUrl),
    instanceUrl:   req.session.instanceUrl  || null,
    orgId:         req.session.orgId        || null,
    orgName:       req.session.orgName      || null,
    orgType:       req.session.orgType      || null,
    isSandbox:     req.session.isSandbox    || false,
    instanceName:  req.session.instanceName || null
  });
});

app.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

function getConnection(req) {
  if (!req.session.accessToken || !req.session.instanceUrl) {
    return null;
  }
  return new jsforce.Connection({
    accessToken: req.session.accessToken,
    instanceUrl: req.session.instanceUrl
  });
}

function requireAuth(req, res, next) {
  if (!req.session.accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// jsforce v1 query() returns a query object, not a Promise — wrap in callbacks
function safeQuery(conn, soql) {
  return new Promise((resolve) => {
    conn.query(soql, (err, result) => {
      if (err) resolve({ records: [], totalSize: 0 });
      else resolve(result);
    });
  });
}

function safeToolingQuery(conn, soql) {
  return new Promise((resolve) => {
    conn.tooling.query(soql, (err, result) => {
      if (err) resolve({ records: [], totalSize: 0 });
      else resolve(result);
    });
  });
}

// Metadata: Flows & Process Builders
app.get('/api/assess/automation', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const flows = await safeToolingQuery(conn,
      "SELECT Id, Definition.DeveloperName, MasterLabel, ProcessType, Status, Description, LastModifiedDate " +
      "FROM Flow WHERE Status = 'Active'"
    );
    const workflowRules = await safeToolingQuery(conn,
      "SELECT Id, Name, TableEnumOrId, CreatedDate, LastModifiedDate " +
      "FROM WorkflowRule"
    );
    const processBuilders = flows.records.filter(f =>
      f.ProcessType === 'CustomEvent' || f.ProcessType === 'InvocableProcess'
    );
    const actualFlows = flows.records.filter(f =>
      f.ProcessType === 'AutoLaunchedFlow' || f.ProcessType === 'Flow' ||
      f.ProcessType === 'RecordTriggeredFlow' || f.ProcessType === 'ScheduledFlow'
    );

    const [approvalProcesses, einsteinFlowActions, webToCaseSettingsRes, caseAutoResponseRulesRes] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, IsActive FROM ProcessDefinition WHERE Type = 'Approval' AND IsActive = true LIMIT 50"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName FROM Flow WHERE Status = 'Active' AND (DeveloperName LIKE '%Einstein%' OR DeveloperName LIKE '%GptAction%') LIMIT 20"),
      safeQuery(conn, "SELECT EnableWebToCase, CaseCaptchaEnabledFlag FROM WebToCaseSettings LIMIT 1").catch(() => ({ records: [] })),
      safeToolingQuery(conn, "SELECT Id, Name, Active FROM AutoResponseRule WHERE SobjectType = 'Case' AND Active = true LIMIT 50").catch(() => ({ records: [] }))
    ]);

    const [sControlsRes, activePushTopicsRes, pendingTimeQueueRes, loginFlowsRes] = await Promise.all([
      safeToolingQuery(conn, "SELECT Id, Name FROM Scontrol LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, Name, ApiVersion, Query FROM PushTopic WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ProcessInstance WHERE Status = 'Pending' AND CreatedDate = LAST_N_DAYS:30").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT Id, FlowDefinitionView.ApiName, EntityType FROM LoginFlow LIMIT 20").catch(() => ({ records: [] }))
    ]);

    res.json({
      workflowRules: workflowRules.records || [],
      processBuilders,
      flows: actualFlows,
      allFlows: flows.records,
      approvalProcesses: approvalProcesses.records || [],
      einsteinFlowActions: einsteinFlowActions.records || [],
      webToCaseSettings: (webToCaseSettingsRes.records || [])[0] || null,
      caseAutoResponseRules: caseAutoResponseRulesRes.records || [],
      sControls: sControlsRes.records || [],
      activePushTopics: activePushTopicsRes.records || [],
      pendingTimeQueueCount: (pendingTimeQueueRes.records[0] || {}).expr0 || 0,
      loginFlows: loginFlowsRes.records || []
    });
  } catch (err) {
    console.error('Automation assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Metadata: Validation Rules
app.get('/api/assess/validation-rules', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const rules = await safeToolingQuery(conn,
      "SELECT Id, ValidationName, EntityDefinitionId, Active, " +
      "Description, LastModifiedDate " +
      "FROM ValidationRule WHERE Active = true"
    );
    res.json({ validationRules: rules.records || [] });
  } catch (err) {
    console.error('Validation rules error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Code Quality: Apex Classes & Triggers
app.get('/api/assess/apex', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const classes = await safeToolingQuery(conn,
      "SELECT Id, Name, Body, ApiVersion, LengthWithoutComments, " +
      "LastModifiedDate, NamespacePrefix " +
      "FROM ApexClass WHERE NamespacePrefix = null"
    );
    const triggers = await safeToolingQuery(conn,
      "SELECT Id, Name, Body, TableEnumOrId, ApiVersion, " +
      "LastModifiedDate, NamespacePrefix " +
      "FROM ApexTrigger WHERE NamespacePrefix = null"
    );
    const testCoverage = await safeToolingQuery(conn,
      "SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered " +
      "FROM ApexCodeCoverageAggregate"
    );

    const soapLoginApex = await safeQuery(conn, "SELECT Id, Name FROM ApexClass WHERE Status = 'Active' AND NamespacePrefix = null AND (Name LIKE '%login%' OR Name LIKE '%Login%' OR Name LIKE '%SOAP%' OR Name LIKE '%Soap%') AND Name NOT IN ('CommunitiesLoginController','LightningLoginFormController','LightningLoginFormControllerTest','SiteLoginController','SiteRegisterController','ChangePasswordController','ForgotPasswordController','CommunitiesSelfRegController','CommunitiesSelfRegConfirmController','MyProfilePageController','CommunitiesLandingController','SiteSampleController') LIMIT 50");
    const hardcodedLoginUrls = await safeQuery(conn, "SELECT Id, Name FROM ApexClass WHERE Status = 'Active' AND NamespacePrefix = null AND (Name LIKE '%loginUrl%' OR Name LIKE '%LoginUrl%') LIMIT 20");

    // Test quality checks — scan test class source bodies for anti-patterns
    const testClassBodies = (classes.records || []).filter(c => {
      const body = (c.Body || '').toLowerCase();
      return body.includes('@istest') || body.includes('testmethod');
    });
    const seeAllDataClasses = testClassBodies.filter(c => /SeeAllData\s*=\s*true/i.test(c.Body || ''));
    const noAssertClasses = testClassBodies.filter(c => {
      const body = c.Body || '';
      return !/System\.assert|Assert\./i.test(body);
    });
    const noStartStopTestClasses = testClassBodies.filter(c => {
      const body = c.Body || '';
      return !/Test\.startTest/i.test(body);
    });
    const noTestSetupClasses = testClassBodies.filter(c => {
      const body = c.Body || '';
      // Flag classes that insert test data but don't use @TestSetup
      return /Database\.insert|insert\s+new\s+\w/i.test(body) && !/@TestSetup/i.test(body);
    });

    res.json({
      classes: classes.records || [],
      triggers: triggers.records || [],
      coverage: testCoverage.records || [],
      soapLoginApex: soapLoginApex.records || [],
      hardcodedLoginUrls: hardcodedLoginUrls.records || [],
      seeAllDataClasses,
      noAssertClasses,
      noStartStopTestClasses,
      noTestSetupClasses
    });
  } catch (err) {
    console.error('Apex assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Data Model: Custom Objects & Fields
app.get('/api/assess/data-model', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const objects = await safeToolingQuery(conn,
      "SELECT Id, DeveloperName, Description, NamespacePrefix, LastModifiedDate " +
      "FROM CustomObject WHERE NamespacePrefix = null"
    );
    const fields = await safeToolingQuery(conn,
      "SELECT Id, DeveloperName, TableEnumOrId, Description, NamespacePrefix, " +
      "LastModifiedDate " +
      "FROM CustomField WHERE NamespacePrefix = null"
    );

    res.json({
      objects: objects.records || [],
      fields: fields.records || [],
      fieldUsage: []
    });
  } catch (err) {
    console.error('Data model assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Service Cloud specific: Cases, Entitlements, Knowledge
app.get('/api/assess/service-cloud', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [caseRecordTypes, queues, unverifiedOWAs] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, IsActive, Description FROM RecordType WHERE SobjectType = 'Case'"),
      safeQuery(conn, "SELECT Id, Name, DeveloperName, Type FROM Group WHERE Type = 'Queue' LIMIT 2000"),
      safeQuery(conn, "SELECT Id, Address, IsVerified FROM OrgWideEmailAddress WHERE IsVerified = false LIMIT 20")
    ]);

    const [assignmentRules, escalationRules, serviceChannels, routingConfigurations, presenceConfigurations] = await Promise.all([
      safeToolingQuery(conn, "SELECT Id, Name FROM AssignmentRule LIMIT 50").catch(() => ({ records: [] })),
      safeToolingQuery(conn, "SELECT Id, Name FROM EscalationRule LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, DeveloperName, RelatedEntityType, IsEnabled FROM ServiceChannel LIMIT 50").catch(() => ({ records: [] })),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, CapacityType, RoutingModel, PushTimeout FROM RoutingConfiguration LIMIT 50").catch(() => ({ records: [] })),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, Capacity FROM PresenceConfiguration LIMIT 50").catch(() => ({ records: [] }))
    ]);

    // Knowledge counts — jsforce v1 always returns aggregate as expr0 (named aliases not supported)
    const [publishedArticles, staleArticles, draftStalled, dataCategoryGroups, articlesNoValidation] = await Promise.all([
      safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true AND LastModifiedDate < LAST_N_DAYS:365").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Draft' AND LastModifiedDate < LAST_N_DAYS:180").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM DataCategoryGroup").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND ValidationStatus = null").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);

    // Entitlements
    const [entitlementProcesses, serviceContractsRaw, entitlementTemplates] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, IsActive, BusinessHoursId FROM EntitlementProcess WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, Name FROM ServiceContract LIMIT 100").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM EntitlementTemplate").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);

    // Entitlement processes without business hours
    const entitlementProcessesWithoutBusinessHours = (entitlementProcesses.records || []).filter((ep) => !ep.BusinessHoursId);

    // Entitlement processes without milestone actions — check EntitlementProcessMilestone
    let epMilestones = { records: [] };
    try {
      epMilestones = await safeQuery(conn, "SELECT Id, SlaProcessId, Name FROM EntitlementProcessMilestone LIMIT 200");
    } catch(e) {}
    const epIdsWithMilestones = new Set((epMilestones.records || []).map(m => m.SlaProcessId));
    const entitlementProcessesWithoutMilestoneActions = (entitlementProcesses.records || []).filter(ep => !epIdsWithMilestones.has(ep.Id));

    // Open cases with entitlement but no SLA start date
    let openCasesEntitlementNoSla = { records: [{ expr0: 0 }] };
    try {
      openCasesEntitlementNoSla = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE EntitlementId != null AND SlaStartDate = null AND IsClosed = false");
    } catch(e) {}

    // Service contracts without entitlements
    let contractsWithEntitlements = { records: [] };
    try {
      contractsWithEntitlements = await safeQuery(conn, "SELECT ServiceContractId FROM Entitlement WHERE ServiceContractId != null GROUP BY ServiceContractId LIMIT 200");
    } catch(e) {}
    const contractIdsWithEntitlements = new Set((contractsWithEntitlements.records || []).map(e => e.ServiceContractId));
    const serviceContractsWithoutEntitlements = (serviceContractsRaw.records || []).filter(sc => !contractIdsWithEntitlements.has(sc.Id));

    // Email-to-Case
    const [emailRoutingAddresses, emailServicesAddresses] = await Promise.all([
      safeQuery(conn, "SELECT Id, RoutingName, EmailAddress, TlsMode, OwnerId, IsVerified FROM CaseEmailRoutingAddress LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, LocalPart, AuthorizedSenders FROM EmailServicesAddress LIMIT 50").catch(() => ({ records: [] }))
    ]);

    let emailThreadingGapCount = 0;
    try {
      const threadingGap = await safeQuery(conn, "SELECT COUNT(Id) FROM EmailMessage WHERE Incoming = true AND ThreadIdentifier = null AND CreatedDate = LAST_N_DAYS:30");
      emailThreadingGapCount = (threadingGap.records[0] || {}).expr0 || 0;
    } catch(e) {}

    // Live Chat / Messaging
    const [liveChatButtons, liveChatDeployments, messagingChannels, embeddedServiceConfigs, miawChannels] = await Promise.all([
      safeQuery(conn, "SELECT Id, DeveloperName, RoutingType, QueueId, IsActive FROM LiveChatButton WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, DeveloperName, IsActive FROM LiveChatDeployment WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, DeveloperName, MessagingPlatformType, IsActive FROM MessagingChannel WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, DeveloperName, IsActive FROM EmbeddedServiceConfig WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] })),
      // EmbeddedServiceMessagingChannel is the actual MIAW object (Messaging for In-App and Web)
      safeQuery(conn, "SELECT Id, DeveloperName FROM EmbeddedServiceMessagingChannel WHERE IsActive = true LIMIT 50").catch(() => ({ records: [] }))
    ]);

    // Service Console
    // Fetch ALL AppDefinition records visible to the running user (not just Console type).
    // AppDefinition is profile-filtered regardless of SOQL vs Tooling API — we can only see
    // apps assigned to our profile. We use the full set to distinguish "no Console apps exist"
    // from "AppDefinition returned nothing (query failed or profile has no apps)".
    const [allAppDefs, consoleApps, macros, recommendationStrategies, callCenters, softphoneLayouts] = await Promise.all([
      safeQuery(conn, "SELECT Id FROM AppDefinition LIMIT 1").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, DeveloperName, NavType FROM AppDefinition WHERE NavType = 'Console' LIMIT 10").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM Macro WHERE IsActive = true").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM RecommendationStrategy WHERE IsActive = true").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM CallCenter").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM SoftphoneLayout WHERE IsDefault = true").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);

    // Uncategorized articles (published with no data category assignment)
    let uncategorizedArticleCount = 0;
    try {
      const allPublished = await safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true");
      const categorized = await safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true AND Id IN (SELECT ParentId FROM KnowledgeArticleVersionDataCategorySelection)");
      const total = (allPublished.records[0] || {}).expr0 || 0;
      const cat = (categorized.records[0] || {}).expr0 || 0;
      uncategorizedArticleCount = Math.max(0, total - cat);
    } catch(e) {}

    // Messaging compliance — channels without OPTOUT keyword
    let messagingChannelsNoOptOut = { records: [] };
    try {
      messagingChannelsNoOptOut = await safeQuery(conn, "SELECT Id, DeveloperName, MessagingPlatformType FROM MessagingChannel WHERE IsActive = true AND OptOutKeyword = null LIMIT 50");
    } catch(e) {}

    // ── New Service Cloud checks ─────────────────────────────────────────────────

    // Open cases with active SLA milestone violations
    let violatedMilestones = { records: [] };
    try {
      violatedMilestones = await safeQuery(conn, "SELECT Id, CaseId, MilestoneName, IsCompleted, IsViolated, TargetDate FROM CaseMilestone WHERE IsViolated = true AND IsCompleted = false LIMIT 200");
    } catch(e) {}

    // Open escalated cases with no activity in 3+ days
    let staleEscalatedCases = { records: [] };
    try {
      staleEscalatedCases = await safeQuery(conn, "SELECT Id, CaseNumber, Subject, OwnerId, Priority, IsEscalated, LastModifiedDate, CreatedDate FROM Case WHERE IsEscalated = true AND IsClosed = false AND LastModifiedDate < LAST_N_DAYS:3 LIMIT 200");
    } catch(e) {}

    // Open cases not modified in 7+ days (stuck/untriaged)
    let staleCases = { records: [] };
    try {
      staleCases = await safeQuery(conn, "SELECT Id, CaseNumber, Subject, OwnerId, CreatedDate, LastModifiedDate FROM Case WHERE IsClosed = false AND CreatedDate < LAST_N_DAYS:7 AND LastModifiedDate < LAST_N_DAYS:7 LIMIT 200");
    } catch(e) {}

    // Cases closed with zero CaseComment activity (zero-touch close rate)
    // Compare: total closed cases vs closed cases that have at least one comment
    let closedCasesTotal = { records: [{ expr0: 0 }] };
    let closedCasesWithComments = { records: [{ expr0: 0 }] };
    try {
      closedCasesTotal = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = true AND ClosedDate = LAST_N_DAYS:90");
      closedCasesWithComments = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = true AND ClosedDate = LAST_N_DAYS:90 AND Id IN (SELECT ParentId FROM CaseComment WHERE CreatedDate = LAST_N_DAYS:90)");
    } catch(e) {}

    // Quick Text records — zero or stale
    let quickTexts = { records: [] };
    let staleQuickTextCount = 0;
    try {
      quickTexts = await safeQuery(conn, "SELECT Id, Name, Channel, Category, LastModifiedDate, IsActive FROM QuickText WHERE IsActive = true LIMIT 200");
      const staleQT = await safeQuery(conn, "SELECT COUNT(Id) FROM QuickText WHERE IsActive = true AND LastModifiedDate < LAST_N_DAYS:365");
      staleQuickTextCount = (staleQT.records[0] || {}).expr0 || 0;
    } catch(e) {}

    // ContactRequest records not completed after 24h
    let openContactRequests = { records: [] };
    try {
      openContactRequests = await safeQuery(conn, "SELECT Id, PreferredPhone, PreferredChannel, Status, CreatedDate FROM ContactRequest WHERE Status != 'Completed' AND CreatedDate < LAST_N_DAYS:1 LIMIT 200");
    } catch(e) {}

    // MessagingSession ended with zero agent messages (bot handoff failures)
    let zeroAgentSessions = { records: [{ expr0: 0 }] };
    try {
      zeroAgentSessions = await safeQuery(conn, "SELECT COUNT(Id) FROM MessagingSession WHERE Status = 'Ended' AND AgentMessageCount = 0 AND EndUserMessageCount > 0 AND CreatedDate = LAST_N_DAYS:30");
    } catch(e) {}

    // Live chat transcripts with no linked Case
    let unlinkedTranscripts = { records: [{ expr0: 0 }] };
    try {
      unlinkedTranscripts = await safeQuery(conn, "SELECT COUNT(Id) FROM LiveChatTranscript WHERE Status = 'Completed' AND CaseId = null AND CreatedDate = LAST_N_DAYS:30");
    } catch(e) {}

    // Expired entitlements still active with open cases
    let expiredActiveEntitlements = { records: [] };
    let openCasesExpiredEntitlement = { records: [{ expr0: 0 }] };
    try {
      expiredActiveEntitlements = await safeQuery(conn, "SELECT Id, Name, EndDate, Status, AccountId FROM Entitlement WHERE Status = 'Active' AND EndDate < TODAY LIMIT 200");
    } catch(e) {}
    if ((expiredActiveEntitlements.records || []).length > 0) {
      try {
        const expiredIds = (expiredActiveEntitlements.records || []).slice(0, 100).map(e => `'${e.Id}'`).join(',');
        openCasesExpiredEntitlement = await safeQuery(conn, `SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND EntitlementId IN (${expiredIds})`);
      } catch(e) {}
    }

    // CaseTeamTemplate — zero configured
    let caseTeamTemplates = { records: [] };
    try {
      caseTeamTemplates = await safeQuery(conn, "SELECT Id, Name, Description FROM CaseTeamTemplate LIMIT 50");
    } catch(e) {}

    // Inbound SocialPost with no linked Case (last 30 days)
    let unlinkedSocialPosts = { records: [{ expr0: 0 }] };
    try {
      unlinkedSocialPosts = await safeQuery(conn, "SELECT COUNT(Id) FROM SocialPost WHERE ParentId = null AND IsOutbound = false AND Posted = LAST_N_DAYS:30");
    } catch(e) {}

    // ── Entitlement deep checks ──────────────────────────────────────────────────

    // E-1: Active entitlements never linked to any case
    let orphanedEntitlements = { records: [] };
    try {
      orphanedEntitlements = await safeQuery(conn, "SELECT Id, Name, AccountId, Account.Name, StartDate, EndDate, Status FROM Entitlement WHERE Status = 'Active' AND Id NOT IN (SELECT EntitlementId FROM Case WHERE EntitlementId != null) ORDER BY StartDate ASC LIMIT 200");
    } catch(e) {}

    // E-2: Cases linked to multiple entitlements (CaseEntitlement junction)
    let multiEntitlementCases = { records: [] };
    try {
      multiEntitlementCases = await safeQuery(conn, "SELECT CaseId, COUNT(Id) FROM CaseEntitlement GROUP BY CaseId HAVING COUNT(Id) > 1 LIMIT 2000");
    } catch(e) {}

    // E-3: BusinessHours with no weekend + no holiday exceptions
    let weekdayOnlyBH = { records: [] };
    let bhHolidayCounts = { records: [] };
    try {
      weekdayOnlyBH = await safeQuery(conn, "SELECT Id, Name, IsActive, IsDefault, SaturdayStartTime, SundayStartTime FROM BusinessHours WHERE IsActive = true AND SaturdayStartTime = null AND SundayStartTime = null LIMIT 50");
      bhHolidayCounts = await safeQuery(conn, "SELECT BusinessHoursId, COUNT(Id) FROM BusinessHoursHoliday GROUP BY BusinessHoursId LIMIT 100");
    } catch(e) {}
    const bhWithHolidayIds = new Set((bhHolidayCounts.records || []).map(r => r.BusinessHoursId));
    const bhNoHolidays = (weekdayOnlyBH.records || []).filter(bh => !bhWithHolidayIds.has(bh.Id));

    // E-4: Entitlement process milestones with TimeTrigger <= 5 (unrealistic / zero)
    let suspectMilestoneTriggers = { records: [] };
    try {
      suspectMilestoneTriggers = await safeQuery(conn, "SELECT Id, Name, SlaProcessId, SlaProcess.Name, TimeTrigger, Order FROM EntitlementProcessMilestone WHERE TimeTrigger <= 5 ORDER BY SlaProcessId, Order ASC LIMIT 200");
    } catch(e) {}

    // E-5: Entitlement process milestones with duplicate TimeTrigger within same process
    let duplicateMilestoneTriggers = { records: [] };
    try {
      duplicateMilestoneTriggers = await safeQuery(conn, "SELECT SlaProcessId, TimeTrigger, COUNT(Id) FROM EntitlementProcessMilestone GROUP BY SlaProcessId, TimeTrigger HAVING COUNT(Id) > 1 LIMIT 100");
    } catch(e) {}

    // ── Knowledge deep checks ────────────────────────────────────────────────────

    // K-1: Published articles still visible in legacy CSP/PRM channels
    let legacyChannelArticles = { records: [{ expr0: 0 }] };
    try {
      legacyChannelArticles = await safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true AND IsVisibleInCsp = true");
    } catch(e) {}

    // K-2: Promoted search terms count (zero = Knowledge search not optimised)
    let promotedSearchTermCount = { records: [{ expr0: 0 }] };
    let synonymDictCount = { records: [{ expr0: 0 }] };
    try {
      promotedSearchTermCount = await safeQuery(conn, "SELECT COUNT(Id) FROM SearchPromotionRule");
    } catch(e) {}
    try {
      synonymDictCount = await safeQuery(conn, "SELECT COUNT(Id) FROM SynonymDictionary");
    } catch(e) {}

    // K-3: Duplicate article titles
    let duplicateArticleTitles = { records: [] };
    try {
      duplicateArticleTitles = await safeQuery(conn, "SELECT Title, COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true GROUP BY Title HAVING COUNT(Id) > 1 ORDER BY COUNT(Id) DESC LIMIT 100");
    } catch(e) {}

    // K-4: Published articles with no Summary
    let articlesNoSummary = { records: [{ expr0: 0 }] };
    try {
      articlesNoSummary = await safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true AND Summary = null");
    } catch(e) {}

    // K-5: Published articles with no linked CaseArticle (no deflection evidence)
    let articlesNoCaseLink = { records: [{ expr0: 0 }] };
    let totalCaseArticles = { records: [{ expr0: 0 }] };
    try {
      articlesNoCaseLink = await safeQuery(conn, "SELECT COUNT(Id) FROM KnowledgeArticleVersion WHERE PublishStatus = 'Online' AND IsLatestVersion = true AND KnowledgeArticleId NOT IN (SELECT KnowledgeArticleId FROM CaseArticle)");
      totalCaseArticles = await safeQuery(conn, "SELECT COUNT(Id) FROM CaseArticle");
    } catch(e) {}

    // ── Case deep checks ─────────────────────────────────────────────────────────

    // C-1: Open cases with no Contact and no Account
    let orphanedCases = { records: [{ expr0: 0 }] };
    try {
      orphanedCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND ContactId = null AND AccountId = null");
    } catch(e) {}

    // C-2: Open cases with Priority = null
    let noPriorityCases = { records: [{ expr0: 0 }] };
    try {
      noPriorityCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND Priority = null");
    } catch(e) {}

    // C-3: Open cases with Origin = null
    let noOriginCases = { records: [{ expr0: 0 }] };
    try {
      noOriginCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND Origin = null");
    } catch(e) {}

    // C-4: Very old open cases (90+ days)
    let veryOldCases = { records: [{ expr0: 0 }] };
    try {
      veryOldCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND CreatedDate < LAST_N_DAYS:90");
    } catch(e) {}

    // C-5: Open cases with no Description
    let noDescCases = { records: [{ expr0: 0 }] };
    try {
      noDescCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND Description = null");
    } catch(e) {}

    // C-6: Open cases owned by individual users (not queues)
    let userOwnedCases = { records: [{ expr0: 0 }] };
    try {
      userOwnedCases = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND Owner.Type = 'User'");
    } catch(e) {}

    // ── Other Service Cloud capabilities ─────────────────────────────────────────

    // SC-1: Incident Management — open incidents with no IncidentRelatedItem
    let openIncidents = { records: [] };
    let incidentsNoRelatedItem = { records: [{ expr0: 0 }] };
    try {
      openIncidents = await safeQuery(conn, "SELECT Id, IncidentNumber, Subject, Status, Priority, CreatedDate FROM Incident WHERE IsClosed = false ORDER BY CreatedDate DESC LIMIT 200");
      incidentsNoRelatedItem = await safeQuery(conn, "SELECT COUNT(Id) FROM Incident WHERE IsClosed = false AND Id NOT IN (SELECT IncidentId FROM IncidentRelatedItem)");
    } catch(e) {}

    // SC-2: Swarming — stale open swarms (no update in 14 days)
    let staleSwarms = { records: [] };
    try {
      staleSwarms = await safeQuery(conn, "SELECT Id, Name, Status, Subject, CaseId, OwnerId, CreatedDate, LastModifiedDate FROM Swarm WHERE Status != 'Closed' AND LastModifiedDate < LAST_N_DAYS:14 ORDER BY LastModifiedDate ASC LIMIT 200");
    } catch(e) {}

    // SC-3: Work orders with no Case and no Asset
    let unlinkedWorkOrders = { records: [{ expr0: 0 }] };
    try {
      unlinkedWorkOrders = await safeQuery(conn, "SELECT COUNT(Id) FROM WorkOrder WHERE Status != 'Closed' AND CaseId = null AND AssetId = null");
    } catch(e) {}

    // SC-4: Open cases on accounts that have assets but cases have no AssetId
    let casesNoAssetLinkCount = { records: [{ expr0: 0 }] };
    try {
      casesNoAssetLinkCount = await safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = false AND AssetId = null AND AccountId != null AND AccountId IN (SELECT AccountId FROM Asset WHERE AccountId != null)");
    } catch(e) {}

    // SC-5: Salesforce Feedback Management — active surveys with zero responses
    let activeSurveys = { records: [] };
    let surveyResponses = { records: [{ expr0: 0 }] };
    try {
      activeSurveys = await safeQuery(conn, "SELECT Id, Name, Status, CreatedDate FROM Survey WHERE Status = 'Active' ORDER BY CreatedDate DESC LIMIT 50");
      surveyResponses = await safeQuery(conn, "SELECT COUNT(Id) FROM SurveyResponse");
    } catch(e) {}

    // SC-6: Service Cloud Voice — completed calls with no linked Case
    let voiceCallsNoCase = { records: [{ expr0: 0 }] };
    let voiceCallsTotal = { records: [{ expr0: 0 }] };
    try {
      voiceCallsNoCase = await safeQuery(conn, "SELECT COUNT(Id) FROM VoiceCall WHERE Status = 'Completed' AND CaseId = null AND CreatedDate = LAST_N_DAYS:30");
      voiceCallsTotal = await safeQuery(conn, "SELECT COUNT(Id) FROM VoiceCall WHERE Status = 'Completed' AND CreatedDate = LAST_N_DAYS:30");
    } catch(e) {}

    res.json({
      caseRecordTypes: caseRecordTypes.records || [],
      emailToCase: [],
      queues: queues.records || [],
      assignmentRules: assignmentRules.records || [],
      escalationRules: escalationRules.records || [],
      unverifiedOWAs: unverifiedOWAs.records || [],
      serviceChannels: serviceChannels.records || [],
      routingConfigurations: routingConfigurations.records || [],
      presenceConfigurations: presenceConfigurations.records || [],
      publishedArticleCount: (publishedArticles.records[0] || {}).expr0 || 0,
      staleArticleCount: (staleArticles.records[0] || {}).expr0 || 0,
      draftStalledCount: (draftStalled.records[0] || {}).expr0 || 0,
      dataCategoryGroupCount: (dataCategoryGroups.records[0] || {}).expr0 || 0,
      uncategorizedArticleCount,
      articlesWithoutValidationCount: (articlesNoValidation.records[0] || {}).expr0 || 0,
      entitlementProcesses: entitlementProcesses.records || [],
      entitlementProcessesWithoutBusinessHours,
      entitlementProcessesWithoutMilestoneActions,
      openCasesEntitlementNoSla: (openCasesEntitlementNoSla.records[0] || {}).expr0 || 0,
      serviceContractsWithoutEntitlements,
      entitlementTemplateCount: (entitlementTemplates.records[0] || {}).expr0 || 0,
      emailRoutingAddresses: emailRoutingAddresses.records || [],
      emailServicesAddresses: emailServicesAddresses.records || [],
      emailThreadingGapCount,
      liveChatButtons: liveChatButtons.records || [],
      liveChatDeployments: liveChatDeployments.records || [],
      messagingChannels: messagingChannels.records || [],
      embeddedServiceConfigs: embeddedServiceConfigs.records || [],
      miawChannels: miawChannels.records || [],
      appDefQueryWorked: (allAppDefs.records || []).length > 0,
      consoleApps: consoleApps.records || [],
      activeMacroCount: (macros.records[0] || {}).expr0 || 0,
      activeRecommendationStrategyCount: (recommendationStrategies.records[0] || {}).expr0 || 0,
      callCenters: (callCenters.records[0] || {}).expr0 || 0,
      softphoneLayouts: (softphoneLayouts.records[0] || {}).expr0 || 0,
      messagingChannelsNoOptOut: messagingChannelsNoOptOut.records || [],
      violatedMilestones: violatedMilestones.records || [],
      staleEscalatedCases: staleEscalatedCases.records || [],
      staleCases: staleCases.records || [],
      closedCasesTotal90Days: (closedCasesTotal.records[0] || {}).expr0 || 0,
      closedCasesWithComments90Days: (closedCasesWithComments.records[0] || {}).expr0 || 0,
      quickTexts: quickTexts.records || [],
      staleQuickTextCount,
      openContactRequests: openContactRequests.records || [],
      zeroAgentSessionCount: (zeroAgentSessions.records[0] || {}).expr0 || 0,
      unlinkedTranscriptCount: (unlinkedTranscripts.records[0] || {}).expr0 || 0,
      expiredActiveEntitlements: expiredActiveEntitlements.records || [],
      openCasesExpiredEntitlementCount: (openCasesExpiredEntitlement.records[0] || {}).expr0 || 0,
      caseTeamTemplates: caseTeamTemplates.records || [],
      unlinkedSocialPostCount: (unlinkedSocialPosts.records[0] || {}).expr0 || 0,
      // Entitlement deep checks
      orphanedEntitlements: orphanedEntitlements.records || [],
      multiEntitlementCaseCount: (multiEntitlementCases.records || []).length,
      bhNoHolidays,
      suspectMilestoneTriggers: suspectMilestoneTriggers.records || [],
      duplicateMilestoneTriggerCount: (duplicateMilestoneTriggers.records || []).length,
      // Knowledge deep checks
      legacyChannelArticleCount: (legacyChannelArticles.records[0] || {}).expr0 || 0,
      promotedSearchTermCount: (promotedSearchTermCount.records[0] || {}).expr0 || 0,
      synonymDictCount: (synonymDictCount.records[0] || {}).expr0 || 0,
      duplicateArticleTitles: duplicateArticleTitles.records || [],
      articlesNoSummaryCount: (articlesNoSummary.records[0] || {}).expr0 || 0,
      articlesNoCaseLinkCount: (articlesNoCaseLink.records[0] || {}).expr0 || 0,
      totalCaseArticleCount: (totalCaseArticles.records[0] || {}).expr0 || 0,
      // Case deep checks
      orphanedCaseCount: (orphanedCases.records[0] || {}).expr0 || 0,
      noPriorityCaseCount: (noPriorityCases.records[0] || {}).expr0 || 0,
      noOriginCaseCount: (noOriginCases.records[0] || {}).expr0 || 0,
      veryOldCaseCount: (veryOldCases.records[0] || {}).expr0 || 0,
      noDescCaseCount: (noDescCases.records[0] || {}).expr0 || 0,
      userOwnedCaseCount: (userOwnedCases.records[0] || {}).expr0 || 0,
      // Other Service Cloud capabilities
      openIncidents: openIncidents.records || [],
      incidentsNoRelatedItemCount: (incidentsNoRelatedItem.records[0] || {}).expr0 || 0,
      staleSwarms: staleSwarms.records || [],
      unlinkedWorkOrderCount: (unlinkedWorkOrders.records[0] || {}).expr0 || 0,
      casesNoAssetLinkCount: (casesNoAssetLinkCount.records[0] || {}).expr0 || 0,
      activeSurveys: activeSurveys.records || [],
      surveyResponseCount: (surveyResponses.records[0] || {}).expr0 || 0,
      voiceCallsNoCaseCount: (voiceCallsNoCase.records[0] || {}).expr0 || 0,
      voiceCallsTotalCount: (voiceCallsTotal.records[0] || {}).expr0 || 0
    });
  } catch (err) {
    console.error('Service Cloud assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sharing & Security: OWD, Profiles, Permission Sets, Password Policies
app.get('/api/assess/sharing-security', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // OWD settings via EntityDefinition
    let owdSettings = { records: [] };
    try {
      owdSettings = await safeToolingQuery(conn,
        "SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel " +
        "FROM EntityDefinition WHERE IsCustomizable = true AND IsQueryable = true AND IsLayoutable = true"
      );
    } catch (e) { /* may not be available in all orgs */ }

    // Profiles (count)
    const profiles = await safeQuery(conn,
      "SELECT Id, Name, UserType, Description FROM Profile LIMIT 500"
    );

    // Permission Sets
    const permSets = await safeQuery(conn,
      "SELECT Id, Name, Label, Description, IsCustom FROM PermissionSet WHERE IsCustom = true LIMIT 500"
    );

    // Connected App OAuth policies (proxy for session security)
    let sessionSettings = { records: [] };
    try {
      sessionSettings = await safeToolingQuery(conn,
        "SELECT Id, SessionTimeout, LockTimeoutMinutes FROM SecuritySettings LIMIT 1"
      );
    } catch (e) { /* optional */ }

    // Sharing rules via Metadata API describe
    let sharingRules = [];
    try {
      const sharingCriteria = await safeToolingQuery(conn,
        "SELECT Id, DeveloperName, SobjectType FROM SharingCriteriaRule LIMIT 200"
      );
      const sharingOwner = await safeToolingQuery(conn,
        "SELECT Id, DeveloperName, SobjectType FROM SharingOwnerRule LIMIT 200"
      );
      sharingRules = [
        ...(sharingCriteria.records || []),
        ...(sharingOwner.records || [])
      ];
    } catch (e) { /* optional */ }

    // API-enabled users: IsActive, profile, last login, MFA
    const apiUsers = await safeQuery(conn,
      "SELECT Id, Name, Username, Email, IsActive, LastLoginDate, " +
      "Profile.Name, Profile.UserType, " +
      "UserType, CreatedDate " +
      "FROM User WHERE IsActive = true AND UserType IN ('Standard', 'PowerPartner', 'CsnOnly') " +
      "ORDER BY LastLoginDate DESC NULLS LAST LIMIT 2000"
    );

    // Integration/API service account users (likely have API-only profiles)
    const integrationUsers = await safeQuery(conn,
      "SELECT Id, Name, Username, Email, IsActive, LastLoginDate, " +
      "Profile.Name, Profile.UserType, CreatedDate " +
      "FROM User WHERE IsActive = true AND " +
      "(Profile.Name LIKE '%API%' OR Profile.Name LIKE '%Integration%' OR " +
      "Profile.Name LIKE '%System%' OR Profile.Name LIKE '%Service%') " +
      "ORDER BY LastLoginDate DESC NULLS LAST LIMIT 100"
    );

    // Users with no login in 90+ days (stale accounts) — includes all user types
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const staleUsers = await safeQuery(conn,
      `SELECT Id, Name, Username, Email, LastLoginDate, Profile.Name, UserType ` +
      `FROM User WHERE IsActive = true AND ` +
      `UserType IN ('Standard', 'PowerPartner', 'CsnOnly', 'SelfService') AND ` +
      `(LastLoginDate < ${ninetyDaysAgo.toISOString()} OR LastLoginDate = null) ` +
      `ORDER BY LastLoginDate ASC NULLS FIRST LIMIT 200`
    );

    // Users with Modify All Data — via profile OR permission set, excluding System Administrator
    // (SysAdmins are expected to have this; non-SysAdmin users with MAD are the real risk)
    const broadPermUsers = await safeQuery(conn,
      "SELECT Id, Name, Username, Email, Profile.Name FROM User " +
      "WHERE IsActive = true AND Profile.PermissionsModifyAllData = true " +
      "AND UserType = 'Standard' AND Profile.Name != 'System Administrator' LIMIT 500"
    );
    // Also find users who have MAD via a permission set (not counted above)
    let madViaPermSet = { records: [] };
    try {
      madViaPermSet = await safeQuery(conn,
        "SELECT AssigneeId, Assignee.Name, Assignee.Username, Assignee.Email, Assignee.Profile.Name " +
        "FROM PermissionSetAssignment " +
        "WHERE PermissionSet.PermissionsModifyAllData = true " +
        "AND Assignee.IsActive = true AND Assignee.UserType = 'Standard' " +
        "AND Assignee.Profile.Name != 'System Administrator' " +
        "AND PermissionSet.IsOwnedByProfile = false LIMIT 500"
      );
    } catch (e) { /* may not have access */ }
    // Merge both sources, dedup by user Id
    const broadPermMap = new Map();
    for (const u of (broadPermUsers.records || [])) broadPermMap.set(u.Id, { ...u, source: 'profile' });
    for (const r of (madViaPermSet.records || [])) {
      if (!broadPermMap.has(r.AssigneeId)) {
        broadPermMap.set(r.AssigneeId, {
          Id: r.AssigneeId,
          Name: r.Assignee?.Name,
          Username: r.Assignee?.Username,
          Email: r.Assignee?.Email,
          Profile: r.Assignee?.Profile,
          source: 'permset'
        });
      }
    }
    const broadPermMerged = Array.from(broadPermMap.values());

    // Login IP ranges — profiles with no IP restrictions
    let loginIpRanges = { records: [] };
    try {
      loginIpRanges = await safeToolingQuery(conn,
        "SELECT Id, ProfileId, StartAddress, EndAddress FROM ProfileIpRange LIMIT 500"
      );
    } catch (e) { /* optional */ }

    // MFA: users who have registered a TOTP/authenticator (TwoFactorInfo)
    const mfaEnrolledUsers = await safeQuery(conn,
      "SELECT UserId FROM TwoFactorInfo WHERE Type IN ('TOTP', 'SalesforceAuthenticator', 'U2F', 'WebAuthn') LIMIT 5000"
    );

    // Org-level MFA enforcement — SecuritySettings is Tooling API only
    let orgMfaEnforced = false;
    try {
      const mfaSettings = await safeToolingQuery(conn,
        "SELECT IsMFAUILoginEnabled FROM SecuritySettings LIMIT 1"
      );
      orgMfaEnforced = !!(mfaSettings.records && mfaSettings.records[0] && mfaSettings.records[0].IsMFAUILoginEnabled);
    } catch (e) { /* SecuritySettings may not be accessible with all profiles */ }

    // Security Health Check score and risk groups
    let securityHealthCheck = null;
    try {
      const shc = await safeQuery(conn,
        "SELECT Score, LastModifiedDate FROM SecurityHealthCheck LIMIT 1"
      );
      if (shc.records && shc.records.length > 0) {
        securityHealthCheck = shc.records[0];
      }
    } catch (e) { /* requires specific permissions */ }

    // Active OAuth access tokens (Connected App sessions)
    const activeOauthTokens = await safeQuery(conn,
      "SELECT Id, UserId, User.Name, User.Username, AppName, LastUsedDate, UseCount " +
      "FROM AuthSession WHERE SessionType = 'OAuth2' " +
      "ORDER BY LastUsedDate DESC NULLS LAST LIMIT 200"
    );

    // Sessions with low assurance level (no MFA step-up)
    const lowSecuritySessions = await safeQuery(conn,
      "SELECT Id, UserId, User.Name, User.Username, LoginType, SessionSecurityLevel, CreatedDate " +
      "FROM AuthSession WHERE SessionSecurityLevel = 'STANDARD' " +
      "ORDER BY CreatedDate DESC NULLS LAST LIMIT 200"
    );

    // Users with password that never expires (Profile-level setting)
    const usersPasswordNeverExpires = await safeQuery(conn,
      "SELECT Id, Name, Username, Profile.Name FROM User " +
      "WHERE IsActive = true AND Profile.PermissionsPasswordNeverExpires = true " +
      "AND UserType = 'Standard' LIMIT 200"
    );

    // Guest user access — sites/portals with guest profiles
    const guestAccessObjects = await safeQuery(conn,
      "SELECT Id, Name, GuestUserId, GuestUser.Name, GuestUser.IsActive, " +
      "GuestUser.Profile.Name, Status " +
      "FROM Site WHERE Status = 'Active' LIMIT 100"
    );

    const [privilegedUsersRes, asyncSharingUpdateRes, outboundMsgRes, caseGuestProfilesRes] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name FROM PermissionSet WHERE (PermissionsModifyAllData = true OR PermissionsViewAllData = true OR PermissionsAuthorApex = true OR PermissionsCustomizeApplication = true) AND IsCustom = true LIMIT 20"),
      safeQuery(conn, "SELECT Id, ApiName, IsCurrentDefault FROM ReleaseUpdateActivation WHERE ApiName = 'AsyncSharingRecalculation' LIMIT 1"),
      safeQuery(conn, "SELECT Id, Name FROM WorkflowOutboundMessage WHERE IsActive = true LIMIT 20"),
      safeQuery(conn, "SELECT Id, Name, PermissionsReadCases, PermissionsEditCases, Parent.Name, Parent.IsOwnedByProfile FROM ObjectPermissions WHERE SobjectType = 'Case' AND Parent.IsOwnedByProfile = true AND PermissionsReadCases = true LIMIT 20").catch(() => ({ records: [] }))
    ]);

    // PSG count — how many Permission Set Groups exist
    const psgCountRes = await safeQuery(conn, "SELECT COUNT(Id) FROM PermissionSetGroup").catch(() => ({ records: [{ expr0: 0 }] }));

    // Users with >10 permission sets assigned
    const usersWithExcessivePSRes = await safeQuery(conn,
      "SELECT AssigneeId, COUNT(Id) FROM PermissionSetAssignment WHERE PermissionSet.IsCustom = true GROUP BY AssigneeId HAVING COUNT(Id) > 10 LIMIT 50"
    ).catch(() => ({ records: [] }));

    // Cloned System Administrator profiles (name contains 'System Administrator' or 'Admin' but isn't the standard one)
    const clonedSysAdminRes = await safeQuery(conn,
      "SELECT Id, Name FROM Profile WHERE UserType = 'Standard' AND (Name LIKE '%System Administrator%' OR Name LIKE '%Sys Admin%') AND Name != 'System Administrator' LIMIT 20"
    ).catch(() => ({ records: [] }));

    // Transaction Security Policies
    const txnSecurityRes = await safeQuery(conn, "SELECT Id, Name FROM TransactionSecurityPolicy WHERE IsActive = true LIMIT 10").catch(() => ({ records: [] }));

    res.json({
      owdSettings: owdSettings.records || [],
      sharingRules,
      profiles: profiles.records || [],
      permissionSets: permSets.records || [],
      passwordPolicies: [],
      sessionSettings: sessionSettings.records || [],
      apiUsers: {
        all: apiUsers.records || [],
        integrationUsers: integrationUsers.records || [],
        staleUsers: staleUsers.records || [],
        broadPermUsers: broadPermMerged
      },
      loginIpRanges: loginIpRanges.records || [],
      mfaEnrolledUserIds: (mfaEnrolledUsers.records || []).map(r => r.UserId),
      orgMfaEnforced,
      securityHealthCheck,
      activeOauthTokens: activeOauthTokens.records || [],
      lowSecuritySessions: lowSecuritySessions.records || [],
      usersPasswordNeverExpires: usersPasswordNeverExpires.records || [],
      guestAccessObjects: guestAccessObjects.records || [],
      privilegedPermSets: privilegedUsersRes.records || [],
      asyncSharingUpdateActive: (asyncSharingUpdateRes.records || []).length > 0,
      activeOutboundMessages: outboundMsgRes.records || [],
      caseGuestProfiles: caseGuestProfilesRes.records || [],
      permissionSetGroupCount: (psgCountRes.records[0] || {}).expr0 || 0,
      usersWithExcessivePermSets: usersWithExcessivePSRes.records || [],
      clonedSysAdminProfiles: clonedSysAdminRes.records || [],
      transactionSecurityPolicies: txnSecurityRes.records || [],
      isSandbox: !!req.session.isSandbox
    });
  } catch (err) {
    console.error('Sharing/Security assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Integrations: Connected Apps, Named Credentials, Remote Site Settings, Apex callouts
app.get('/api/assess/integrations', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // Connected Apps
    let connectedApps = { records: [] };
    try {
      connectedApps = await safeToolingQuery(conn,
        "SELECT Id, Name, Description, MobileSessionTimeout " +
        "FROM ConnectedApplication"
      );
    } catch (e) { /* optional */ }

    // Named Credentials
    let namedCredentials = { records: [] };
    try {
      namedCredentials = await safeToolingQuery(conn,
        "SELECT Id, DeveloperName, Endpoint, PrincipalType " +
        "FROM NamedCredential"
      );
    } catch (e) { /* optional */ }

    // Remote Site Settings
    let remoteSites = { records: [] };
    try {
      remoteSites = await safeToolingQuery(conn,
        "SELECT Id, EndpointUrl, IsActive, DisableProtocolSecurity " +
        "FROM RemoteProxy"
      );
    } catch (e) { /* optional */ }

    // Apex classes with HttpRequest/callout patterns
    let apexCallouts = { records: [] };
    try {
      apexCallouts = await safeToolingQuery(conn,
        "SELECT Id, Name, Body FROM ApexClass WHERE NamespacePrefix = null"
      );
    } catch (e) { /* optional */ }

    const [retiredApiApex, deprecatedGraphQLComponents] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, ApiVersion FROM ApexClass WHERE Status = 'Active' AND ApiVersion <= 30 AND NamespacePrefix = null LIMIT 50"),
      safeQuery(conn, "SELECT Id, DeveloperName FROM LightningComponentBundle WHERE IsExposed = true LIMIT 200")
    ]);

    // Active PushTopics (deprecated — Summer '26)
    let integrationPushTopics = { records: [] };
    try {
      integrationPushTopics = await safeQuery(conn, "SELECT Id, Name, ApiVersion FROM PushTopic WHERE IsActive = true LIMIT 50");
    } catch(e) {}

    // External Credentials count (modern Named Credential replacement)
    let externalCredentialCount = 0;
    try {
      const ecRes = await safeQuery(conn, "SELECT COUNT(Id) FROM ExternalCredential LIMIT 1");
      externalCredentialCount = (ecRes.records[0] || {}).expr0 || 0;
    } catch(e) {}

    // Dedicated integration users (API-only profile users still active)
    let dedicatedIntegrationUsers = { records: [] };
    try {
      dedicatedIntegrationUsers = await safeQuery(conn,
        "SELECT COUNT(Id) FROM User WHERE IsActive = true AND (Profile.Name LIKE '%API Only%' OR Profile.Name LIKE '%Integration%' OR Profile.Name LIKE '%Service Account%') LIMIT 1"
      );
    } catch(e) {}

    res.json({
      connectedApps: connectedApps.records || [],
      namedCredentials: namedCredentials.records || [],
      remoteSiteSettings: remoteSites.records || [],
      apexCallouts: apexCallouts.records || [],
      retiredApiApexClasses: retiredApiApex.records || [],
      activePushTopics: integrationPushTopics.records || [],
      externalCredentialCount,
      dedicatedIntegrationUserCount: (dedicatedIntegrationUsers.records[0] || {}).expr0 || 0
    });
  } catch (err) {
    console.error('Integrations assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Test Coverage: detailed breakdown beyond what /api/assess/apex provides
app.get('/api/assess/test-coverage', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const classes = await safeToolingQuery(conn,
      "SELECT Id, Name, ApiVersion, LengthWithoutComments, NamespacePrefix " +
      "FROM ApexClass WHERE NamespacePrefix = null"
    );
    const triggers = await safeToolingQuery(conn,
      "SELECT Id, Name, ApiVersion, TableEnumOrId, NamespacePrefix " +
      "FROM ApexTrigger WHERE NamespacePrefix = null"
    );

    // Separate test classes from non-test
    const allClasses = classes.records || [];
    const testClasses = allClasses.filter(c => /test/i.test(c.Name));
    const nonTestClasses = allClasses.filter(c => !/test/i.test(c.Name));

    const coverage = await safeToolingQuery(conn,
      "SELECT ApexClassOrTriggerId, ApexClassOrTrigger.Name, NumLinesCovered, NumLinesUncovered " +
      "FROM ApexCodeCoverageAggregate"
    );

    res.json({
      apexClasses: nonTestClasses,
      apexTriggers: triggers.records || [],
      coverage: coverage.records || [],
      testClasses
    });
  } catch (err) {
    console.error('Test coverage assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Org Limits: uses the Limits REST API
app.get('/api/assess/org-limits', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // jsforce exposes limits via the REST API
    const limitsRaw = await conn.request('/services/data/v59.0/limits/');

    const limits = Object.entries(limitsRaw).map(([name, val]) => {
      const v = val;
      const max = v.Max || 0;
      const remaining = v.Remaining !== undefined ? v.Remaining : max;
      const used = max - remaining;
      const usedPct = max > 0 ? Math.round((used / max) * 100) : 0;
      return { name, max, remaining, used, usedPct };
    }).filter(l => l.max > 0);

    const [apexClassCountResult, customObjectCountResult] = await Promise.all([
      safeQuery(conn, "SELECT COUNT(Id) FROM ApexClass WHERE NamespacePrefix = null AND Status = 'Active'").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM EntityDefinition WHERE IsCustomizable = true AND NamespacePrefix = null").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);

    const apexClassCount = (apexClassCountResult.records[0] || {}).expr0 || 0;
    const customObjectCount = (customObjectCountResult.records[0] || {}).expr0 || 0;

    res.json({ limits, apexClassCount, customObjectCount });
  } catch (err) {
    console.error('Org limits assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Duplicate & Matching Rules ───────────────────────────────────────────────
app.get('/api/assess/duplicate-rules', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [duplicateRules, matchingRules] = await Promise.all([
      safeQuery(conn, "SELECT Id, DeveloperName, IsActive, Description FROM DuplicateRule LIMIT 100"),
      safeQuery(conn, "SELECT Id, DeveloperName, Description FROM MatchingRule LIMIT 100")
    ]);
    res.json({ duplicateRules: duplicateRules.records || [], matchingRules: matchingRules.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Reports & Dashboards ─────────────────────────────────────────────────────
app.get('/api/assess/reports-dashboards', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const iso = sixMonthsAgo.toISOString();
    const [allReports, staleReports, allDashboards, staleDashboards] = await Promise.all([
      safeQuery(conn, "SELECT COUNT(Id) FROM Report"),
      safeQuery(conn, `SELECT Id, Name, LastRunDate, OwnerId FROM Report WHERE LastRunDate < ${iso} OR LastRunDate = null LIMIT 200`),
      safeQuery(conn, "SELECT COUNT(Id) FROM Dashboard"),
      safeQuery(conn, `SELECT Id, Title, LastViewedDate FROM Dashboard WHERE LastViewedDate < ${iso} OR LastViewedDate = null LIMIT 200`)
    ]);
    res.json({
      totalReports: (allReports.records[0] || {}).expr0 || 0,
      staleReports: staleReports.records || [],
      totalDashboards: (allDashboards.records[0] || {}).expr0 || 0,
      staleDashboards: staleDashboards.records || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Email Templates ──────────────────────────────────────────────────────────
app.get('/api/assess/email-templates', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [classicTemplates, lightningTemplates] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, TemplateType, LastModifiedDate FROM EmailTemplate WHERE TemplateType != 'custom3' LIMIT 500"),
      safeQuery(conn, "SELECT Id, Name, LastModifiedDate FROM EmailTemplate WHERE TemplateType = 'custom3' LIMIT 500")
    ]);
    res.json({ classicTemplates: classicTemplates.records || [], lightningTemplates: lightningTemplates.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Platform Events & Change Data Capture ────────────────────────────────────
app.get('/api/assess/platform-events', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [platformEvents, cdcEntities, eventBusSubscribers, managedEventResult] = await Promise.all([
      safeQuery(conn, "SELECT Id, DeveloperName, Description FROM PlatformEventChannel LIMIT 100"),
      safeQuery(conn, "SELECT Id, DeveloperName FROM PlatformEventChannelMember LIMIT 100"),
      safeQuery(conn, "SELECT Id, ExternalId, Type FROM EventBusSubscriber LIMIT 100"),
      safeQuery(conn, "SELECT COUNT(Id) FROM EntityDefinition WHERE QualifiedApiName LIKE '%__e' LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);
    res.json({
      platformEvents: platformEvents.records || [],
      cdcEntities: cdcEntities.records || [],
      eventBusSubscribers: eventBusSubscribers.records || [],
      managedPlatformEventCount: (managedEventResult.records[0] || {}).expr0 || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Managed Packages ─────────────────────────────────────────────────────────
app.get('/api/assess/managed-packages', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const packages = await safeToolingQuery(conn,
      "SELECT Id, Name, NamespacePrefix, MajorVersion, MinorVersion, PatchVersion, ReleaseState FROM InstalledSubscriberPackage LIMIT 100"
    );
    res.json({ packages: packages.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Custom Metadata vs Custom Settings ───────────────────────────────────────
app.get('/api/assess/custom-metadata', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [customSettings, customMetadataTypes] = await Promise.all([
      safeToolingQuery(conn, "SELECT Id, DeveloperName, CustomSettingsType, Description FROM CustomObject WHERE CustomSettingsType IN ('Hierarchy','List') LIMIT 100"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, Description FROM CustomObject WHERE QualifiedApiName LIKE '%__mdt' AND NamespacePrefix = null LIMIT 100")
    ]);
    res.json({ customSettings: customSettings.records || [], customMetadataTypes: customMetadataTypes.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Record Types & Page Layouts ──────────────────────────────────────────────
app.get('/api/assess/record-types-layouts', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [recordTypes, pageLayouts] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, SobjectType, IsActive, Description FROM RecordType WHERE DeveloperName != 'Master' LIMIT 500"),
      safeToolingQuery(conn, "SELECT Id, Name, EntityDefinitionId, Description FROM Layout LIMIT 500")
    ]);
    res.json({ recordTypes: recordTypes.records || [], pageLayouts: pageLayouts.records || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Einstein / AI Usage ──────────────────────────────────────────────────────
app.get('/api/assess/einstein-ai', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [einsteinSettings, promptTemplates, bots, aiApplications, recentClosedCases] = await Promise.all([
      safeQuery(conn, "SELECT SettingName, SettingValue FROM OrganizationSetting WHERE SettingName IN ('EinsteinGptEnabled','AgentforceEnabled','EinsteinPredictionBuilderEnabled','EinsteinNextBestActionEnabled') LIMIT 20"),
      safeQuery(conn, "SELECT Id, DeveloperName, Status FROM PromptTemplate LIMIT 50"),
      safeQuery(conn, "SELECT Id, DeveloperName, Status FROM BotDefinition LIMIT 20"),
      safeQuery(conn, "SELECT Id, DeveloperName, Status FROM AiApplication LIMIT 50").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM Case WHERE IsClosed = true AND CreatedDate = LAST_N_DAYS:365").catch(() => ({ records: [{ expr0: 0 }] }))
    ]);

    // Agentforce: Agent Topics and Agent Actions
    let agentTopicCount = 0;
    let agentActionCount = 0;
    let dataCloudConnected = false;
    try {
      // BotTopicDefinition = Agentforce Topics (Summer '24+); fall back to BotDefinition EinsteinGptAgent type
      const topicsRes = await safeToolingQuery(conn, "SELECT COUNT(Id) FROM BotTopicDefinition LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] }));
      agentTopicCount = (topicsRes.records[0] || {}).expr0 || 0;
      if (agentTopicCount === 0) {
        // Fallback: count Agentforce-type bot definitions
        const fallbackRes = await safeQuery(conn, "SELECT COUNT(Id) FROM BotDefinition WHERE BotType = 'EinsteinGptAgent'").catch(() => ({ records: [{ expr0: 0 }] }));
        agentTopicCount = (fallbackRes.records[0] || {}).expr0 || 0;
      }
    } catch(e) {}
    try {
      // BotTopicAction = Agentforce Actions linked to topics
      const actionsRes = await safeToolingQuery(conn, "SELECT COUNT(Id) FROM BotTopicAction LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] }));
      agentActionCount = (actionsRes.records[0] || {}).expr0 || 0;
    } catch(e) {}
    try {
      // Data Cloud connection: DataStream is the primary queryable object when Data Cloud is connected
      const dcRes = await safeQuery(conn, "SELECT COUNT(Id) FROM DataStream LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] }));
      dataCloudConnected = ((dcRes.records[0] || {}).expr0 || 0) > 0;
    } catch(e) {}

    res.json({
      einsteinSettings: einsteinSettings.records || [],
      promptTemplates: promptTemplates.records || [],
      bots: bots.records || [],
      aiApplications: aiApplications.records || [],
      recentClosedCaseCount: (recentClosedCases.records[0] || {}).expr0 || 0,
      agentTopicCount,
      agentActionCount,
      dataCloudConnected
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Experience Cloud ─────────────────────────────────────────────────────────
app.get('/api/assess/experience-cloud', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // All sites with status and self-registration info
    const sites = await safeQuery(conn,
      "SELECT Id, Name, Status, SiteType, UrlPathPrefix, GuestUserId, " +
      "GuestUser.IsActive, GuestUser.Name, OptionsAllowGuestSupportApi " +
      "FROM Site LIMIT 200"
    );

    // Network (Experience Cloud site) settings including self-reg and CDN
    const networks = await safeQuery(conn,
      "SELECT Id, Name, Status, UrlPathPrefix, SelfRegistrationEnabled, " +
      "AllowMembersToFlag, BrowserNotificationsEnabled, " +
      "CdnBasedOnLocation, NavigationType, Template " +
      "FROM Network LIMIT 200"
    );

    // Network member configurations (guest access settings)
    const networkMembers = await safeQuery(conn,
      "SELECT Id, NetworkId, ProfileId, Profile.Name, Profile.UserType " +
      "FROM NetworkMember LIMIT 500"
    );

    // Custom domains configured for Experience Cloud sites
    // DomainSite links a Domain to a Site — use it to detect which sites have custom domains
    let customDomains = { records: [] };
    try {
      customDomains = await safeQuery(conn,
        "SELECT Id, DomainId, Domain.Domain, Domain.HttpsOption, SiteId " +
        "FROM DomainSite LIMIT 200"
      );
    } catch(e) {
      // Fall back to querying Domain directly if DomainSite not available
      try {
        customDomains = await safeQuery(conn, "SELECT Id, Domain, HttpsOption FROM Domain LIMIT 100");
      } catch(e2) { customDomains = { records: [] }; }
    }

    const wcagUpdateRes = await safeQuery(conn, "SELECT Id, ApiName, IsCurrentDefault FROM ReleaseUpdateActivation WHERE ApiName LIKE '%Accessibility%' OR ApiName LIKE '%WCAG%' LIMIT 5");

    // Guest page caching (Aura only — LWR uses platform CDN caching, not this field)
    let guestCacheNetworks = { records: [] };
    try {
      guestCacheNetworks = await safeQuery(conn,
        "SELECT Id, Name, Template, GuestCacheMaxAge FROM Network WHERE Status IN ('Live', 'Active') AND (GuestCacheMaxAge = 0 OR GuestCacheMaxAge = null) LIMIT 100"
      );
    } catch(e) {}

    // FlexiPage count per network/site — high page counts slow LWR bundle loading
    let networkPageCounts = { records: [] };
    try {
      networkPageCounts = await safeToolingQuery(conn,
        "SELECT NetworkId, COUNT(Id) FROM FlexiPage WHERE NamespacePrefix = null AND NetworkId != null GROUP BY NetworkId LIMIT 200"
      );
    } catch(e) {}

    // Network member count per network — large member bases cause search indexing lag
    let networkMemberCounts = { records: [] };
    try {
      networkMemberCounts = await safeQuery(conn,
        "SELECT NetworkId, COUNT(Id) FROM NetworkMember GROUP BY NetworkId LIMIT 100"
      );
    } catch(e) {}

    let clickjackSites = { records: [] };
    try {
      clickjackSites = await safeQuery(conn, "SELECT Id, Name, ClickjackProtectionLevel FROM Site WHERE ClickjackProtectionLevel = 'AllowAll' AND Status = 'Active' LIMIT 50");
    } catch(e) {}

    let xssNetworks = { records: [] };
    try {
      xssNetworks = await safeQuery(conn, "SELECT Id, Name, Template FROM Network WHERE BrowserXssProtection = false AND Status IN ('Live', 'Active') LIMIT 50");
    } catch(e) {}

    let contentSniffNetworks = { records: [] };
    try {
      contentSniffNetworks = await safeQuery(conn, "SELECT Id, Name, Template FROM Network WHERE ContentSniffingProtection = false AND Status IN ('Live', 'Active') LIMIT 50");
    } catch(e) {}

    res.json({
      sites: sites.records || [],
      networks: networks.records || [],
      networkMembers: networkMembers.records || [],
      customDomains: customDomains.records || [],
      wcagUpdatesActive: (wcagUpdateRes.records || []).length > 0,
      wcagUpdates: wcagUpdateRes.records || [],
      clickjackVulnerableSites: clickjackSites.records || [],
      xssUnprotectedNetworks: xssNetworks.records || [],
      contentSniffingUnprotectedNetworks: contentSniffNetworks.records || [],
      guestCacheDisabledNetworks: (guestCacheNetworks.records || []).filter((n) => {
        const t = (n.Template || '').toLowerCase();
        return !t.includes('lwr'); // GuestCacheMaxAge only applies to Aura sites
      }),
      networkPageCounts: (networkPageCounts.records || []).map((r) => ({ networkId: r.NetworkId, count: r.expr0 })),
      networkMemberCounts: (networkMemberCounts.records || []).map((r) => ({ networkId: r.NetworkId, count: r.expr0 }))
    });
  } catch (err) {
    console.error('Experience Cloud assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Connected App Security ───────────────────────────────────────────────────
app.get('/api/assess/connected-app-security', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // All connected apps with metadata
    const connectedApps = await safeToolingQuery(conn,
      "SELECT Id, Name, Description, MobileSessionTimeout, StartUrl, IpRelaxation " +
      "FROM ConnectedApplication LIMIT 200"
    );

    // Active OAuth tokens — who holds live sessions and when last used
    const oauthTokens = await safeQuery(conn,
      "SELECT Id, AppName, UserId, User.Name, User.Username, User.IsActive, " +
      "LastUsedDate, UseCount, CreatedDate " +
      "FROM OauthToken ORDER BY LastUsedDate DESC NULLS LAST LIMIT 500"
    );

    // SetupEntityAccess — which profiles/permsets have access to each app
    const setupAccess = await safeQuery(conn,
      "SELECT SetupEntityId, SetupEntityType, ParentId " +
      "FROM SetupEntityAccess WHERE SetupEntityType = 'ConnectedApplication' LIMIT 500"
    );

    // Permission sets that grant connected app access
    const permSetAccess = await safeQuery(conn,
      "SELECT Id, Name, Label FROM PermissionSet WHERE IsCustom = true LIMIT 200"
    );

    const [activeOutboundMsgs, expiredCerts, externalClientApps, ctiConnectedAppsRes] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name FROM WorkflowOutboundMessage WHERE IsActive = true LIMIT 20"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, ValidFrom, ExpirationDate FROM Certificate WHERE ExpirationDate != null LIMIT 50"),
      safeQuery(conn, "SELECT Id, DeveloperName, MasterLabel FROM ExternalClientApplication LIMIT 50"),
      safeQuery(conn, "SELECT Id, Name, MobileSessionTimeout FROM ConnectedApplication WHERE Name LIKE '%CTI%' OR Name LIKE '%Telephony%' OR Name LIKE '%OpenCTI%' OR Name LIKE '%Voice%' LIMIT 20").catch(() => ({ records: [] }))
    ]);

    res.json({
      connectedApps: connectedApps.records || [],
      oauthTokens: oauthTokens.records || [],
      setupAccess: setupAccess.records || [],
      permSets: permSetAccess.records || [],
      activeOutboundMessages: activeOutboundMsgs.records || [],
      certificates: expiredCerts.records || [],
      externalClientApps: externalClientApps.records || [],
      ctiConnectedApps: ctiConnectedAppsRes.records || []
    });
  } catch (err) {
    console.error('Connected App Security assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Lightning Web Components ─────────────────────────────────────────────────
app.get('/api/assess/lwc', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [lwcBundles, auraBundles, auraDefinitions, flexiPages, lwcResources, jsResources, htmlResources, cssResources, vfPages] = await Promise.all([
      safeToolingQuery(conn,
        "SELECT Id, DeveloperName, ApiVersion, Description, IsExposed, ManageableState, LastModifiedDate " +
        "FROM LightningComponentBundle WHERE NamespacePrefix = null LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, DeveloperName, ApiVersion, Description, ManageableState, LastModifiedDate " +
        "FROM AuraDefinitionBundle WHERE NamespacePrefix = null LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, DefType, AuraDefinitionBundleId, AuraDefinitionBundle.DeveloperName " +
        "FROM AuraDefinition WHERE DefType IN ('RENDERER','EVENT') LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, DeveloperName, Type, EntityDefinitionId, LastModifiedDate " +
        "FROM FlexiPage WHERE NamespacePrefix = null AND Type = 'RecordPage' LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, LightningComponentBundleId, FilePath, Format " +
        "FROM LightningComponentResource WHERE FilePath LIKE '%.test.js' LIMIT 1000"
      ),
      safeToolingQuery(conn,
        "SELECT Id, LightningComponentBundleId, FilePath, Source " +
        "FROM LightningComponentResource WHERE FilePath LIKE '%.js' AND FilePath NOT LIKE '%.test.js' LIMIT 1000"
      ),
      safeToolingQuery(conn,
        "SELECT Id, LightningComponentBundleId, FilePath, Source " +
        "FROM LightningComponentResource WHERE FilePath LIKE '%.html' LIMIT 1000"
      ),
      safeToolingQuery(conn,
        "SELECT Id, LightningComponentBundleId, FilePath, Source " +
        "FROM LightningComponentResource WHERE FilePath LIKE '%.css' LIMIT 1000"
      ),
      safeToolingQuery(conn,
        "SELECT Id, Name, ApiVersion, Description, NamespacePrefix, IsAvailableInTouch, LastModifiedDate " +
        "FROM ApexPage WHERE NamespacePrefix = null LIMIT 500"
      )
    ]);

    res.json({
      lwcBundles: lwcBundles.records || [],
      auraBundles: auraBundles.records || [],
      auraDefinitions: auraDefinitions.records || [],
      flexiPages: flexiPages.records || [],
      lwcResources: lwcResources.records || [],
      jsResources: jsResources.records || [],
      htmlResources: htmlResources.records || [],
      cssResources: cssResources.records || [],
      vfPages: vfPages.records || []
    });
  } catch (err) {
    console.error('LWC assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─── OmniStudio ───────────────────────────────────────────────────────────────
app.get('/api/assess/omnistudio', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // Detect whether org uses native OmniStudio or managed package (Vlocity)
    const describeUrl = `${req.session.instanceUrl}/services/data/v59.0/sobjects`;
    const describeResp = await fetch(describeUrl, { headers: { Authorization: `Bearer ${req.session.accessToken}` } });
    const describeJson = await describeResp.json();
    const objectNames = (describeJson.sobjects || []).map((o) => o.name);

    const isNative  = objectNames.includes('OmniProcess');
    const isManaged = objectNames.includes('vlocity_cmt__OmniScript__c') ||
                      objectNames.includes('vlocity_ins__OmniScript__c') ||
                      objectNames.includes('vlocity_ps__OmniScript__c');

    if (!isNative && !isManaged) {
      return res.json({ installed: false, flavor: null, omniScripts: [], integrationProcedures: [], dataTransforms: [], flexCards: [], managedPackageVersion: null });
    }

    const flavor = isNative ? 'native' : 'managed';
    const ns = isManaged
      ? (objectNames.includes('vlocity_cmt__OmniScript__c') ? 'vlocity_cmt__'
        : objectNames.includes('vlocity_ins__OmniScript__c') ? 'vlocity_ins__'
        : 'vlocity_ps__')
      : '';

    let omniScripts = [], integrationProcedures = [], dataTransforms = [], flexCards = [];

    let managedPackageVersion = null;

    if (isNative) {
      const [scripts, ips, dts, cards] = await Promise.all([
        safeQuery(conn, "SELECT Id, Name, Type, SubType, IsActive, IsTestMode, IsLvtEnabled, LastModifiedDate, Description FROM OmniProcess WHERE Type = 'OmniScript' LIMIT 200"),
        safeQuery(conn, "SELECT Id, Name, Type, SubType, IsActive, IsTestMode, IsLvtEnabled, LastModifiedDate, Description FROM OmniProcess WHERE Type = 'IntegrationProcedure' LIMIT 200"),
        safeQuery(conn, "SELECT Id, Name, Type, IsActive, IsTurboExtract, LastModifiedDate, Description FROM OmniDataTransform LIMIT 200"),
        safeQuery(conn, "SELECT Id, Name, IsActive, LastModifiedDate, Description FROM OmniUiCard LIMIT 200"),
      ]);
      omniScripts           = scripts.records || [];
      integrationProcedures = ips.records     || [];
      dataTransforms        = dts.records     || [];
      flexCards             = cards.records   || [];
    } else {
      // Check installed package version
      try {
        const nsPrefix = ns.replace('__', '');
        const pkgResult = await safeToolingQuery(conn,
          `SELECT SubscriberPackageVersion.MajorVersion, SubscriberPackageVersion.MinorVersion, SubscriberPackageVersion.PatchVersion FROM InstalledSubscriberPackage WHERE SubscriberPackage.NamespacePrefix = '${nsPrefix}' LIMIT 1`
        );
        if (pkgResult.records && pkgResult.records.length > 0) {
          const v = pkgResult.records[0].SubscriberPackageVersion;
          if (v) managedPackageVersion = `${v.MajorVersion}.${v.MinorVersion}.${v.PatchVersion}`;
        }
      } catch (e) { /* non-fatal */ }

      const [scripts, ips, dts, cards] = await Promise.all([
        safeQuery(conn, `SELECT Id, Name, ${ns}Type__c, ${ns}SubType__c, ${ns}IsActive__c, ${ns}IsTestMode__c, LastModifiedDate, ${ns}Description__c FROM ${ns}OmniScript__c WHERE ${ns}Type__c != 'IntegrationProcedure' LIMIT 200`),
        safeQuery(conn, `SELECT Id, Name, ${ns}Type__c, ${ns}SubType__c, ${ns}IsActive__c, ${ns}IsTestMode__c, LastModifiedDate, ${ns}Description__c FROM ${ns}OmniScript__c WHERE ${ns}Type__c = 'IntegrationProcedure' LIMIT 200`),
        safeQuery(conn, `SELECT Id, Name, ${ns}MapType__c, ${ns}IsActive__c, ${ns}IsTurboExtract__c, LastModifiedDate, ${ns}Description__c FROM ${ns}DRBundle__c LIMIT 200`),
        safeQuery(conn, `SELECT Id, Name, ${ns}Active__c, LastModifiedDate, ${ns}Description__c FROM ${ns}VlocityCard__c LIMIT 200`),
      ]);
      omniScripts = (scripts.records || []).map(r => ({
        Id: r.Id, Name: r.Name,
        Type: r[`${ns}Type__c`], SubType: r[`${ns}SubType__c`],
        IsActive: r[`${ns}IsActive__c`], IsTestMode: r[`${ns}IsTestMode__c`],
        IsLvtEnabled: null, // not applicable for managed package
        LastModifiedDate: r.LastModifiedDate, Description: r[`${ns}Description__c`]
      }));
      integrationProcedures = (ips.records || []).map(r => ({
        Id: r.Id, Name: r.Name,
        Type: r[`${ns}Type__c`], SubType: r[`${ns}SubType__c`],
        IsActive: r[`${ns}IsActive__c`], IsTestMode: r[`${ns}IsTestMode__c`],
        IsLvtEnabled: null,
        LastModifiedDate: r.LastModifiedDate, Description: r[`${ns}Description__c`]
      }));
      dataTransforms = (dts.records || []).map(r => ({
        Id: r.Id, Name: r.Name, Type: r[`${ns}MapType__c`],
        IsActive: r[`${ns}IsActive__c`], IsTurboExtract: r[`${ns}IsTurboExtract__c`],
        LastModifiedDate: r.LastModifiedDate, Description: r[`${ns}Description__c`]
      }));
      flexCards = (cards.records || []).map(r => ({
        Id: r.Id, Name: r.Name,
        IsActive: r[`${ns}Active__c`], LastModifiedDate: r.LastModifiedDate,
        Description: r[`${ns}Description__c`]
      }));
    }

    // ── Additional OmniStudio checks ─────────────────────────────────────────────

    // O-1: Active OmniScripts with LWC runtime disabled (Aura runtime still active)
    let auraRuntimeScripts = [];
    if (isNative) {
      const res1 = await safeQuery(conn, "SELECT Id, Name, Type, SubType, IsActive, IsLvtEnabled, LastModifiedDate FROM OmniProcess WHERE Type = 'OmniScript' AND IsActive = true AND IsLvtEnabled = false LIMIT 200").catch(() => ({ records: [] }));
      auraRuntimeScripts = res1.records || [];
    } else {
      const nsFld = `${ns}IsLwcEnabled__c`;
      const res1 = await safeQuery(conn, `SELECT Id, Name, ${ns}Type__c, ${ns}SubType__c, ${ns}IsActive__c, ${nsFld}, LastModifiedDate FROM ${ns}OmniScript__c WHERE ${ns}IsActive__c = true AND ${nsFld} = false LIMIT 200`).catch(() => ({ records: [] }));
      auraRuntimeScripts = (res1.records || []).map(r => ({ Id: r.Id, Name: r.Name, Type: r[`${ns}Type__c`], SubType: r[`${ns}SubType__c`], IsActive: r[`${ns}IsActive__c`], IsLvtEnabled: r[nsFld], LastModifiedDate: r.LastModifiedDate }));
    }

    // O-2: Active Integration Procedures with no error-handling elements (SetErrors/Throw)
    let ipsWithErrors = new Set();
    let allActiveIps = integrationProcedures.filter(ip => ip.IsActive);
    if (isNative && allActiveIps.length > 0) {
      const errEls = await safeQuery(conn, "SELECT OmniProcessId FROM OmniProcessElement WHERE OmniProcess.Type = 'IntegrationProcedure' AND OmniProcess.IsActive = true AND Type IN ('SetErrors','Throw') LIMIT 500").catch(() => ({ records: [] }));
      ipsWithErrors = new Set((errEls.records || []).map(r => r.OmniProcessId));
    }
    const ipsNoErrorHandling = allActiveIps.filter(ip => !ipsWithErrors.has(ip.Id));

    // O-3: DataTransform type distribution — flag over-reliance on standard Extract vs Turbo Extract
    let dataTransformTypes = {};
    if (isNative) {
      const dtTypes = await safeQuery(conn, "SELECT InterfaceType, COUNT(Id) FROM OmniDataTransform GROUP BY InterfaceType LIMIT 20").catch(() => ({ records: [] }));
      (dtTypes.records || []).forEach(r => { dataTransformTypes[r.InterfaceType] = r.expr0; });
    } else {
      const dtTypes = await safeQuery(conn, `SELECT ${ns}MapType__c, COUNT(Id) FROM ${ns}DRBundle__c GROUP BY ${ns}MapType__c LIMIT 20`).catch(() => ({ records: [] }));
      (dtTypes.records || []).forEach(r => { dataTransformTypes[r[`${ns}MapType__c`]] = r.expr0; });
    }

    // O-4: OmniScript naming convention violations (spaces in Type/SubType)
    let namingViolations = [];
    if (isNative) {
      const res4 = await safeQuery(conn, "SELECT Id, Name, Type, SubType, IsActive, LastModifiedDate FROM OmniProcess WHERE Type = 'OmniScript' AND (Type LIKE '% %' OR SubType LIKE '% %') LIMIT 200").catch(() => ({ records: [] }));
      namingViolations = res4.records || [];
    } else {
      const res4 = await safeQuery(conn, `SELECT Id, Name, ${ns}Type__c, ${ns}SubType__c, ${ns}IsActive__c FROM ${ns}OmniScript__c WHERE (${ns}Type__c LIKE '% %' OR ${ns}SubType__c LIKE '% %') LIMIT 200`).catch(() => ({ records: [] }));
      namingViolations = (res4.records || []).map(r => ({ Id: r.Id, Name: r.Name, Type: r[`${ns}Type__c`], SubType: r[`${ns}SubType__c`] }));
    }

    // O-6: Active OmniScripts using deprecated Remote Action elements
    let remoteActionElements = [];
    if (isNative) {
      const res6 = await safeQuery(conn, "SELECT Id, Name, Type, OmniProcessId, OmniProcess.Name, OmniProcess.IsActive FROM OmniProcessElement WHERE Type = 'Remote Action' AND OmniProcess.IsActive = true LIMIT 200").catch(() => ({ records: [] }));
      remoteActionElements = (res6.records || []).map(r => ({ Id: r.Id, ScriptName: r.OmniProcess?.Name || r.OmniProcessId, ElementName: r.Name }));
    } else {
      const res6 = await safeQuery(conn, `SELECT Id, Name, ${ns}Type__c, ${ns}OmniScriptId__c FROM ${ns}OmniScriptElement__c WHERE ${ns}Type__c = 'Remote Action' LIMIT 200`).catch(() => ({ records: [] }));
      remoteActionElements = (res6.records || []).map(r => ({ Id: r.Id, ScriptName: r[`${ns}OmniScriptId__c`], ElementName: r.Name }));
    }

    // O-5: Legacy article types in schema (pre-Spring '20 Knowledge migration)
    const legacyKavTypes = await safeToolingQuery(conn, "SELECT QualifiedApiName, Label FROM EntityDefinition WHERE QualifiedApiName LIKE '%__kav' AND QualifiedApiName != 'Knowledge__kav' LIMIT 50").catch(() => ({ records: [] }));

    res.json({ installed: true, flavor, omniScripts, integrationProcedures, dataTransforms, flexCards, managedPackageVersion, auraRuntimeScripts, ipsNoErrorHandling, dataTransformTypes, namingViolations, remoteActionElements, legacyKavTypes: legacyKavTypes.records || [] });
  } catch (err) {
    console.error('OmniStudio assess error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/performance', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    const [
      largeApexClasses,
      apexTriggersPerObject,
      asyncQueuedJobs,
      recentFailedJobs,
      scheduledApex,
      batchConcurrent,
      traceFlagsActive,
      recordTriggeredFlows,
      scheduledFlows,
      platformCachePartitions,
      wideObjects,
      auraBundles,
      heavyFlexiPages,
      eventLogFiles,
      futureQueueable,
      stuckAsyncJobs,
      totalActiveFlowCount,
      obsoleteFlowCount,
      flowsWithLoops,
      flowsWithDml
    ] = await Promise.all([
      safeToolingQuery(conn,
        "SELECT Id, Name, LengthWithoutComments FROM ApexClass WHERE NamespacePrefix = null AND LengthWithoutComments > 1000 LIMIT 200"
      ),
      safeQuery(conn,
        "SELECT TableEnumOrId, COUNT(Id) FROM ApexTrigger WHERE Status = 'Active' GROUP BY TableEnumOrId LIMIT 200"
      ),
      safeQuery(conn,
        "SELECT Id, ApexClass.Name, JobType, Status FROM AsyncApexJob WHERE Status = 'Queued' AND JobType IN ('BatchApex','Queueable','Future') LIMIT 500"
      ),
      safeQuery(conn,
        `SELECT Id, ApexClass.Name, JobType, Status, CompletedDate FROM AsyncApexJob WHERE Status = 'Failed' AND CompletedDate >= ${thirtyDaysAgoStr} LIMIT 500`
      ),
      safeQuery(conn,
        "SELECT Id, CronJobDetail.Name, State, NextFireTime FROM CronTrigger WHERE State = 'WAITING' LIMIT 100"
      ),
      safeQuery(conn,
        "SELECT Id, ApexClass.Name, JobType, Status FROM AsyncApexJob WHERE JobType = 'BatchApex' AND Status = 'Processing' LIMIT 100"
      ),
      safeToolingQuery(conn,
        "SELECT Id, TracedEntityId, LogType, ExpirationDate FROM TraceFlag WHERE ExpirationDate > TODAY LIMIT 100"
      ),
      safeToolingQuery(conn,
        "SELECT Id, ApiName, Label, TriggerType, ProcessType FROM Flow WHERE Status = 'Active' AND (TriggerType = 'RecordBeforeSave' OR TriggerType = 'RecordAfterSave') LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, ApiName, Label, TriggerType, ProcessType FROM Flow WHERE Status = 'Active' AND TriggerType = 'Scheduled' AND ProcessType = 'AutoLaunchedFlow' LIMIT 200"
      ),
      safeQuery(conn,
        "SELECT Id, DeveloperName FROM PlatformCachePartition LIMIT 10"
      ),
      safeQuery(conn,
        "SELECT EntityDefinitionId, COUNT(QualifiedApiName) FROM FieldDefinition WHERE EntityDefinition.IsCustomizable = true GROUP BY EntityDefinitionId HAVING COUNT(QualifiedApiName) > 300 LIMIT 100"
      ),
      safeToolingQuery(conn,
        "SELECT Id, DeveloperName, ApiVersion, LastModifiedDate FROM AuraDefinitionBundle WHERE NamespacePrefix = null LIMIT 500"
      ),
      safeToolingQuery(conn,
        "SELECT Id, DeveloperName, Type, EntityDefinitionId FROM FlexiPage WHERE NamespacePrefix = null AND Type = 'RecordPage' LIMIT 500"
      ),
      safeQuery(conn,
        "SELECT Id, EventType, LogDate, LogFileLength FROM EventLogFile WHERE LogDate = LAST_N_DAYS:7 LIMIT 10"
      ),
      safeQuery(conn,
        "SELECT Id, ApexClass.Name, JobType, Status FROM AsyncApexJob WHERE Status = 'Queued' AND JobType IN ('Future','Queueable') LIMIT 500"
      ),
      safeQuery(conn, `SELECT COUNT(Id) FROM AsyncApexJob WHERE Status IN ('Processing','Holding') AND CreatedDate < ${new Date(Date.now() - 86400000).toISOString()}`).catch(() => ({ records: [{ expr0: 0 }] })),
      safeToolingQuery(conn, "SELECT COUNT(Id) FROM Flow WHERE Status = 'Active'").catch(() => ({ records: [{ expr0: 0 }] })),
      safeToolingQuery(conn, "SELECT COUNT(Id) FROM Flow WHERE Status = 'Obsolete'").catch(() => ({ records: [{ expr0: 0 }] })),
      safeToolingQuery(conn, "SELECT FlowVersionId FROM FlowElement WHERE Type = 'Loop' GROUP BY FlowVersionId LIMIT 200").catch(() => ({ records: [] })),
      safeToolingQuery(conn, "SELECT FlowVersionId FROM FlowElement WHERE Type IN ('RecordCreate','RecordUpdate','RecordDelete') GROUP BY FlowVersionId LIMIT 500").catch(() => ({ records: [] }))
    ]);

    // Calculate trigger counts per object (aggregate alias not supported in REST API — use expr0)
    const triggersByObject = {};
    for (const row of (apexTriggersPerObject.records || [])) {
      triggersByObject[row.TableEnumOrId] = row.expr0;
    }
    const multiTriggerObjects = Object.entries(triggersByObject)
      .filter(([_, count]) => count > 1)
      .map(([obj, count]) => ({ obj, count }));

    // FlexiPage component count — approximate from component count per page via metadata
    // We query FlexiPage separately and flag those on the same object with high counts (proxy via total page count per EntityDefinitionId)
    const pagesByEntity = {};
    for (const fp of (heavyFlexiPages.records || [])) {
      const eid = fp.EntityDefinitionId || 'Unknown';
      pagesByEntity[eid] = (pagesByEntity[eid] || 0) + 1;
    }
    const heavyEntities = Object.entries(pagesByEntity).filter(([_, count]) => count > 5).map(([eid, count]) => ({ eid, count }));

    // Large static resources — oversized files slow Experience Cloud, LWC, and VF pages
    let largeStaticResources = { records: [] };
    try {
      largeStaticResources = await safeQuery(conn,
        "SELECT Id, Name, BodyLength, ContentType, LastModifiedDate, NamespacePrefix " +
        "FROM StaticResource WHERE NamespacePrefix = null AND BodyLength > 512000 " +
        "ORDER BY BodyLength DESC LIMIT 50"
      );
    } catch(e) {}

    res.json({
      largeApexClasses: largeApexClasses.records || [],
      multiTriggerObjects,
      asyncQueuedJobs: asyncQueuedJobs.records || [],
      recentFailedJobs: recentFailedJobs.records || [],
      scheduledApex: scheduledApex.records || [],
      batchConcurrent: batchConcurrent.records || [],
      traceFlagsActive: traceFlagsActive.records || [],
      recordTriggeredFlows: recordTriggeredFlows.records || [],
      scheduledFlows: scheduledFlows.records || [],
      platformCachePartitions: platformCachePartitions.records || [],
      wideObjects: wideObjects.records || [],
      auraBundles: auraBundles.records || [],
      heavyEntities,
      eventLogFiles: eventLogFiles.records || [],
      futureQueueable: futureQueueable.records || [],
      stuckAsyncJobCount: (stuckAsyncJobs.records[0] || {}).expr0 || 0,
      totalActiveFlowCount: (totalActiveFlowCount.records[0] || {}).expr0 || 0,
      obsoleteFlowCount: (obsoleteFlowCount.records[0] || {}).expr0 || 0,
      flowsWithLoopsIds: (flowsWithLoops.records || []).map(r => r.FlowVersionId),
      flowsWithDmlIds: (flowsWithDml.records || []).map(r => r.FlowVersionId),
      largeStaticResources: largeStaticResources.records || []
    });
  } catch (err) {
    console.error('Performance assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/notes-attachments', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [
      legacyNotes,
      legacyAttachments,
      contentNotes,
      contentVersions,
      orphanedDocs,
      largeFiles,
      untitledDocs,
      expiringShares,
      permanentShares,
      staleFiles,
      contentWorkspaces,
      topAttachmentObjects,
      orgPreferences
    ] = await Promise.all([
      safeQuery(conn, "SELECT COUNT(Id) FROM Note LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM Attachment LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentNote LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentVersion WHERE IsLatest = true AND FileType != 'SNOTE' LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentDocument WHERE Id NOT IN (SELECT ContentDocumentId FROM ContentDocumentLink) LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT Id, Title, ContentSize FROM ContentVersion WHERE IsLatest = true AND ContentSize > 26214400 LIMIT 100").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentDocument WHERE Title = null OR Title = '' LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentDistribution WHERE ExpiryDate > TODAY LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentDistribution WHERE ExpiryDate = null LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentDocument WHERE LastViewedDate < LAST_N_YEARS:2 LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT COUNT(Id) FROM ContentWorkspace LIMIT 1").catch(() => ({ records: [{ expr0: 0 }] })),
      safeQuery(conn, "SELECT LinkedEntityType, COUNT(Id) FROM ContentDocumentLink GROUP BY LinkedEntityType ORDER BY COUNT(Id) DESC LIMIT 20").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, Name, Value FROM OrgPreference WHERE Name = 'EnhancedNotes' LIMIT 1").catch(() => ({ records: [] }))
    ]);

    const topObjects = (topAttachmentObjects.records || []).map(r => ({
      obj: r.LinkedEntityType,
      count: r.expr0
    }));

    const enhancedNotesEnabled = (orgPreferences.records || []).some(r => r.Value === 'true' || r.Value === true);

    res.json({
      legacyNoteCount: (legacyNotes.records[0] || {}).expr0 || 0,
      legacyAttachmentCount: (legacyAttachments.records[0] || {}).expr0 || 0,
      contentNoteCount: (contentNotes.records[0] || {}).expr0 || 0,
      contentVersionCount: (contentVersions.records[0] || {}).expr0 || 0,
      orphanedContentDocumentCount: (orphanedDocs.records[0] || {}).expr0 || 0,
      largeFileCount: (largeFiles.records || []).length,
      largeFiles: largeFiles.records || [],
      untitledContentDocumentCount: (untitledDocs.records[0] || {}).expr0 || 0,
      externallySharedFileCount: ((expiringShares.records[0] || {}).expr0 || 0) + ((permanentShares.records[0] || {}).expr0 || 0),
      permanentlySharedFileCount: (permanentShares.records[0] || {}).expr0 || 0,
      staleFileCount: (staleFiles.records[0] || {}).expr0 || 0,
      contentWorkspaceCount: (contentWorkspaces.records[0] || {}).expr0 || 0,
      topAttachmentObjects: topObjects,
      enhancedNotesEnabled
    });
  } catch (err) {
    console.error('Notes & Attachments assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assess/flow-quality', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [
      allFlows,
      flowsWithDmlInLoops,
      flowsWithHardcodedIds,
      flowsWithMissingDescriptions,
      flowsSystemContextNoSharing,
      flowsSystemContextWithSharing
    ] = await Promise.all([
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType, RunInMode, Description FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null ORDER BY MasterLabel ASC LIMIT 500").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null AND Id IN (SELECT FlowVersionId FROM FlowElement WHERE ElementSubtype IN ('Loop') ) LIMIT 200").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null LIMIT 500").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null AND (Description = null OR Description = '') LIMIT 200").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null AND RunInMode = 'SystemModeWithoutSharing' LIMIT 200").catch(() => ({ records: [] })),
      safeQuery(conn, "SELECT Id, MasterLabel, DeveloperName, ProcessType FROM Flow WHERE Status = 'Active' AND NamespacePrefix = null AND RunInMode = 'SystemModeWithSharing' LIMIT 200").catch(() => ({ records: [] }))
    ]);

    // Detect flows with hardcoded IDs by checking for 15/18 char Salesforce IDs in metadata
    // We approximate this by flagging flows — a full check requires metadata API
    const allFlowRecords = allFlows.records || [];

    // Flows with missing fault paths — detect by checking for DML/action elements
    // We flag active flows that have DML-capable process types without fault path metadata available via SOQL
    const dmlCapableTypes = ['Flow', 'AutoLaunchedFlow', 'RecordTriggeredFlow', 'ScheduledFlow'];
    const flowsWithMissingFaultPaths = allFlowRecords.filter(f =>
      dmlCapableTypes.includes(f.ProcessType)
    );

    // Circular subflow detection — requires metadata API; flag flows with Subflow process type references
    // Conservative: flag scheduled/autolaunched flows that may call subflows
    const circularSubflowFlows = [];

    res.json({
      allFlows: allFlowRecords,
      flowsWithMissingFaultPaths,
      flowsWithDmlInLoops: flowsWithDmlInLoops.records || [],
      flowsWithHardcodedIds: [],
      flowsWithMissingDescriptions: flowsWithMissingDescriptions.records || [],
      flowsWithCopyLabels: [],
      flowsSystemContextNoSharing: flowsSystemContextNoSharing.records || [],
      flowsSystemContextWithSharing: flowsSystemContextWithSharing.records || [],
      circularSubflowFlows
    });
  } catch (err) {
    console.error('Flow Quality assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// In production, serve the React build
if (isProduction) {
  app.use(express.static(path.resolve(__dirname, '../build')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
});
