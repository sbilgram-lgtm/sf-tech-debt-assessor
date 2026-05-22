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
  const isSandbox = req.query.sandbox === 'true';
  const loginUrl = process.env.SF_LOGIN_URL
    || (isSandbox ? 'https://test.salesforce.com' : 'https://login.salesforce.com');

  req.session.loginUrl = loginUrl;

  const oauth = new jsforce.OAuth2({
    loginUrl,
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
    redirectUri: getCallbackUrl(req)
  });

  res.redirect(oauth.getAuthorizationUrl({ scope: 'api refresh_token' }));
});

app.get('/auth/callback', async (req, res) => {
  const loginUrl = req.session.loginUrl || 'https://login.salesforce.com';

  const oauth = new jsforce.OAuth2({
    loginUrl,
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET,
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

// Metadata: Flows & Process Builders
app.get('/api/assess/automation', requireAuth, async (req, res) => {
  const conn = getConnection(req);
  try {
    const flows = await conn.tooling.query(
      "SELECT Id, Definition.DeveloperName, MasterLabel, ProcessType, Status, Description, LastModifiedDate " +
      "FROM Flow WHERE Status = 'Active'"
    );
    const workflowRules = await conn.tooling.query(
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
    const rules = await conn.tooling.query(
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
    const classes = await conn.tooling.query(
      "SELECT Id, Name, Body, ApiVersion, LengthWithoutComments, " +
      "LastModifiedDate, NamespacePrefix " +
      "FROM ApexClass WHERE NamespacePrefix = null"
    );
    const triggers = await conn.tooling.query(
      "SELECT Id, Name, Body, TableEnumOrId, ApiVersion, " +
      "LastModifiedDate, NamespacePrefix " +
      "FROM ApexTrigger WHERE NamespacePrefix = null"
    );
    const testCoverage = await conn.tooling.query(
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
    const objects = await conn.tooling.query(
      "SELECT Id, DeveloperName, Description, NamespacePrefix, LastModifiedDate " +
      "FROM CustomObject WHERE NamespacePrefix = null"
    );
    const fields = await conn.tooling.query(
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
      assignmentRules = await conn.tooling.query(
        "SELECT Id, Name FROM AssignmentRule"
      );
    } catch (e) { /* not available in all orgs */ }

    let escalationRules = { records: [] };
    try {
      escalationRules = await conn.tooling.query(
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
