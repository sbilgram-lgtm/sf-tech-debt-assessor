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

  res.redirect(oauth.getAuthorizationUrl({ scope: 'api refresh_token' }));
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
    res.redirect(`${getBaseUrl(req)}/dashboard`);
  } catch (err) {
    console.error('OAuth error:', err);
    res.redirect(`${getBaseUrl(req)}/login?error=auth_failed`);
  }
});

app.get('/auth/status', (req, res) => {
  res.json({
    authenticated: !!(req.session.accessToken && req.session.instanceUrl),
    instanceUrl: req.session.instanceUrl || null
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
      f.ProcessType === 'Workflow' || f.ProcessType === 'InvocableProcess'
    );
    const actualFlows = flows.records.filter(f =>
      f.ProcessType === 'AutoLaunchedFlow' || f.ProcessType === 'Flow'
    );

    res.json({
      workflowRules: workflowRules.records || [],
      processBuilders,
      flows: actualFlows,
      allFlows: flows.records
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

    res.json({
      classes: classes.records || [],
      triggers: triggers.records || [],
      coverage: testCoverage.records || []
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
    const caseRecordTypes = await conn.query(
      "SELECT Id, Name, IsActive, Description FROM RecordType WHERE SobjectType = 'Case'"
    );
    const queues = await conn.query(
      "SELECT Id, Name, Type FROM Group WHERE Type = 'Queue'"
    );

    let assignmentRules = { records: [] };
    try {
      assignmentRules = await safeToolingQuery(conn,
        "SELECT Id, Name FROM AssignmentRule"
      );
    } catch (e) { /* not available in all orgs */ }

    let escalationRules = { records: [] };
    try {
      escalationRules = await safeToolingQuery(conn,
        "SELECT Id, Name FROM EscalationRule"
      );
    } catch (e) { /* not available in all orgs */ }

    res.json({
      caseRecordTypes: caseRecordTypes.records || [],
      emailToCase: [],
      queues: queues.records || [],
      assignmentRules: assignmentRules.records || [],
      escalationRules: escalationRules.records || []
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
        "FROM EntityDefinition WHERE IsCustomizable = true AND IsQueryable = true"
      );
    } catch (e) { /* may not be available in all orgs */ }

    // Profiles (count)
    const profiles = await conn.query(
      "SELECT Id, Name, UserType, Description FROM Profile"
    );

    // Permission Sets
    const permSets = await conn.query(
      "SELECT Id, Name, Label, Description, IsCustom FROM PermissionSet WHERE IsCustom = true"
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
    const apiUsers = await conn.query(
      "SELECT Id, Name, Username, Email, IsActive, LastLoginDate, " +
      "Profile.Name, Profile.UserType, " +
      "UserType, CreatedDate " +
      "FROM User WHERE IsActive = true AND UserType IN ('Standard', 'PowerPartner', 'CsnOnly') " +
      "ORDER BY LastLoginDate DESC NULLS LAST LIMIT 200"
    );

    // Integration/API service account users (likely have API-only profiles)
    const integrationUsers = await conn.query(
      "SELECT Id, Name, Username, Email, IsActive, LastLoginDate, " +
      "Profile.Name, Profile.UserType, CreatedDate " +
      "FROM User WHERE IsActive = true AND " +
      "(Profile.Name LIKE '%API%' OR Profile.Name LIKE '%Integration%' OR " +
      "Profile.Name LIKE '%System%' OR Profile.Name LIKE '%Service%') " +
      "ORDER BY LastLoginDate DESC NULLS LAST LIMIT 100"
    );

    // Users with no login in 90+ days (stale accounts)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const staleUsers = await conn.query(
      `SELECT Id, Name, Username, Email, LastLoginDate, Profile.Name ` +
      `FROM User WHERE IsActive = true AND UserType = 'Standard' AND ` +
      `(LastLoginDate < ${ninetyDaysAgo.toISOString()} OR LastLoginDate = null) ` +
      `ORDER BY LastLoginDate ASC NULLS FIRST LIMIT 100`
    );

    // Users with Modify All Data or View All Data permission via profile
    let broadPermUsers = { records: [] };
    try {
      broadPermUsers = await conn.query(
        "SELECT Id, Name, Username, Email, Profile.Name FROM User " +
        "WHERE IsActive = true AND Profile.PermissionsModifyAllData = true " +
        "AND UserType = 'Standard' LIMIT 100"
      );
    } catch (e) { /* not queryable in all orgs */ }

    // Login IP ranges — profiles with no IP restrictions
    let loginIpRanges = { records: [] };
    try {
      loginIpRanges = await safeToolingQuery(conn,
        "SELECT Id, ProfileId, StartAddress, EndAddress FROM ProfileIpRange LIMIT 500"
      );
    } catch (e) { /* optional */ }

    // MFA: users who have registered a TOTP/authenticator (TwoFactorInfo)
    let mfaEnrolledUsers = { records: [] };
    try {
      mfaEnrolledUsers = await conn.query(
        "SELECT UserId FROM TwoFactorInfo WHERE Type IN ('TOTP', 'SalesforceAuthenticator', 'U2F', 'WebAuthn') LIMIT 2000"
      );
    } catch (e) { /* not available in all API versions */ }

    // Security Health Check score and risk groups
    let securityHealthCheck = null;
    try {
      const shc = await conn.query(
        "SELECT Score, LastModifiedDate FROM SecurityHealthCheck LIMIT 1"
      );
      if (shc.records && shc.records.length > 0) {
        securityHealthCheck = shc.records[0];
      }
    } catch (e) { /* requires specific permissions */ }

    // Active OAuth access tokens (Connected App sessions)
    let activeOauthTokens = { records: [] };
    try {
      activeOauthTokens = await conn.query(
        "SELECT Id, UserId, User.Name, User.Username, AppName, LastUsedDate, UseCount " +
        "FROM AuthSession WHERE SessionType = 'OAuth2' " +
        "ORDER BY LastUsedDate DESC NULLS LAST LIMIT 200"
      );
    } catch (e) { /* optional */ }

    // Sessions with low assurance level (no MFA step-up)
    let lowSecuritySessions = { records: [] };
    try {
      lowSecuritySessions = await conn.query(
        "SELECT Id, UserId, User.Name, User.Username, LoginType, SessionSecurityLevel, CreatedDate " +
        "FROM AuthSession WHERE SessionSecurityLevel = 'STANDARD' " +
        "ORDER BY CreatedDate DESC NULLS LAST LIMIT 200"
      );
    } catch (e) { /* optional */ }

    // Users with password that never expires (Profile-level setting)
    let usersPasswordNeverExpires = { records: [] };
    try {
      usersPasswordNeverExpires = await conn.query(
        "SELECT Id, Name, Username, Profile.Name FROM User " +
        "WHERE IsActive = true AND Profile.PermissionsPasswordNeverExpires = true " +
        "AND UserType = 'Standard' LIMIT 200"
      );
    } catch (e) { /* not available in all orgs */ }

    // Guest user access — sites/portals with guest profiles
    let guestAccessObjects = { records: [] };
    try {
      guestAccessObjects = await conn.query(
        "SELECT Id, Name, GuestUserId, GuestUser.Name, GuestUser.IsActive, " +
        "GuestUser.Profile.Name, Status " +
        "FROM Site WHERE Status = 'Active' LIMIT 100"
      );
    } catch (e) { /* optional */ }

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
        broadPermUsers: broadPermUsers.records || []
      },
      loginIpRanges: loginIpRanges.records || [],
      mfaEnrolledUserIds: (mfaEnrolledUsers.records || []).map(r => r.UserId),
      securityHealthCheck,
      activeOauthTokens: activeOauthTokens.records || [],
      lowSecuritySessions: lowSecuritySessions.records || [],
      usersPasswordNeverExpires: usersPasswordNeverExpires.records || [],
      guestAccessObjects: guestAccessObjects.records || []
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

    res.json({
      connectedApps: connectedApps.records || [],
      namedCredentials: namedCredentials.records || [],
      remoteSiteSettings: remoteSites.records || [],
      apexCallouts: apexCallouts.records || []
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

    res.json({ limits });
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
      safeToolingQuery(conn, "SELECT Id, DeveloperName, IsActive, Description FROM DuplicateRule LIMIT 100"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, Description FROM MatchingRule LIMIT 100")
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
      safeQuery(conn, "SELECT COUNT() FROM Report"),
      safeQuery(conn, `SELECT Id, Name, LastRunDate, OwnerId FROM Report WHERE LastRunDate < ${iso} OR LastRunDate = null LIMIT 200`),
      safeQuery(conn, "SELECT COUNT() FROM Dashboard"),
      safeQuery(conn, `SELECT Id, Title, LastViewedDate FROM Dashboard WHERE LastViewedDate < ${iso} OR LastViewedDate = null LIMIT 200`)
    ]);
    res.json({
      totalReports: allReports.totalSize || 0,
      staleReports: staleReports.records || [],
      totalDashboards: allDashboards.totalSize || 0,
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
    const [platformEvents, cdcEntities] = await Promise.all([
      safeToolingQuery(conn, "SELECT Id, DeveloperName, Description FROM PlatformEventChannel LIMIT 100"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName FROM PlatformEventChannelMember LIMIT 100")
    ]);
    const eventBusSubscribers = await safeQuery(conn, "SELECT Id, ExternalId, Type FROM EventBusSubscriber LIMIT 100");
    res.json({
      platformEvents: platformEvents.records || [],
      cdcEntities: cdcEntities.records || [],
      eventBusSubscribers: eventBusSubscribers.records || []
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
      safeToolingQuery(conn, "SELECT Id, DeveloperName, SettingType, Description FROM CustomObject WHERE CustomSettingsType IN ('Hierarchy','List') LIMIT 100"),
      safeToolingQuery(conn, "SELECT Id, DeveloperName, Description FROM CustomObject WHERE CustomSettingsType = null AND IsCustomSetting = false AND DeveloperName LIKE '%mdt%' LIMIT 100")
    ]);
    const mdtTypes = await safeToolingQuery(conn,
      "SELECT Id, DeveloperName, Description FROM CustomObject WHERE IsMDT = true LIMIT 100"
    );
    res.json({ customSettings: customSettings.records || [], customMetadataTypes: (customMetadataTypes.records || []).concat(mdtTypes.records || []) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Record Types & Page Layouts ──────────────────────────────────────────────
app.get('/api/assess/record-types-layouts', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [recordTypes, pageLayouts] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, SobjectType, IsActive, Description FROM RecordType WHERE IsCustom = true LIMIT 500"),
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
    const [einsteinSettings, promptTemplates, bots] = await Promise.all([
      safeQuery(conn, "SELECT SettingName, SettingValue FROM OrganizationSetting WHERE SettingName IN ('EinsteinGptEnabled','AgentforceEnabled','EinsteinPredictionBuilderEnabled','EinsteinNextBestActionEnabled') LIMIT 20"),
      safeQuery(conn, "SELECT Id, DeveloperName, Status FROM PromptTemplate LIMIT 50"),
      safeQuery(conn, "SELECT Id, DeveloperName, Status FROM BotDefinition LIMIT 20")
    ]);
    res.json({
      einsteinSettings: einsteinSettings.records || [],
      promptTemplates: promptTemplates.records || [],
      bots: bots.records || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Experience Cloud ─────────────────────────────────────────────────────────
app.get('/api/assess/experience-cloud', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    // All sites with template, status, and self-registration info
    let sites = { records: [] };
    try {
      sites = await conn.query(
        "SELECT Id, Name, Status, SiteType, UrlPathPrefix, GuestUserId, " +
        "GuestUser.IsActive, OptionsAllowGuestSupportApi, Template " +
        "FROM Site LIMIT 200"
      );
    } catch (e) { /* not available in all orgs */ }

    // Network (Experience Cloud site) settings including self-reg and CDN
    let networks = { records: [] };
    try {
      networks = await conn.query(
        "SELECT Id, Name, Status, UrlPathPrefix, SelfRegistrationEnabled, " +
        "AllowMembersToFlag, BrowserNotificationsEnabled, " +
        "CdnBasedOnLocation, NavigationType " +
        "FROM Network LIMIT 200"
      );
    } catch (e) { /* optional */ }

    // Network member configurations (guest access settings)
    let networkMembers = { records: [] };
    try {
      networkMembers = await conn.query(
        "SELECT Id, NetworkId, ProfileId, Profile.Name, Profile.UserType " +
        "FROM NetworkMember LIMIT 500"
      );
    } catch (e) { /* optional */ }

    // Custom domains configured for Experience Cloud sites
    let customDomains = { records: [] };
    try {
      customDomains = await conn.query(
        "SELECT Id, Domain, SiteId, HttpsOption " +
        "FROM Domain LIMIT 100"
      );
    } catch (e) { /* optional */ }

    res.json({
      sites: sites.records || [],
      networks: networks.records || [],
      networkMembers: networkMembers.records || [],
      customDomains: customDomains.records || []
    });
  } catch (err) {
    console.error('Experience Cloud assessment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── Territory Management ─────────────────────────────────────────────────────
app.get('/api/assess/territory', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const [territoryModels, territories, rules] = await Promise.all([
      safeQuery(conn, "SELECT Id, Name, State FROM Territory2Model LIMIT 20"),
      safeQuery(conn, "SELECT Id, Name, Territory2ModelId FROM Territory2 LIMIT 200"),
      safeQuery(conn, "SELECT Id, Name, IsActive, ObjectType FROM Territory2Rule LIMIT 100")
    ]);
    res.json({ territoryModels: territoryModels.records || [], territories: territories.records || [], assignmentRules: rules.records || [] });
  } catch (err) {
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
