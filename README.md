# Salesforce Tech Debt Assessor
*By Steven Bilgram, Success Architect*

A web app that connects to any Salesforce org via OAuth and runs a comprehensive read-only scan across **315 checks in 22 categories** — surfacing technical debt, security gaps, and configuration anti-patterns with prioritised, actionable recommendations. Each finding includes an expandable list of the specific records, users, rules, or components causing the score deduction.

## Data & Privacy

All metadata is **ephemeral** — nothing is written to a database or stored server-side beyond your active session:

| Data | Where it lives | Lifetime |
|---|---|---|
| OAuth tokens | Server memory (express-session) | 1 hour |
| Assessment results | Browser tab (React state) | Until page refresh |
| Credentials (if remembered) | Browser localStorage | Until you clear it |
| Exported files (PDF / Excel / CSV) | Your local Downloads folder | Permanent |

Nothing is written back to Salesforce. No external database is used. Assessment results exist only in the browser tab while the session is active.

## Using the hosted app

> Share this URL with colleagues: **https://sf-tech-debt-assessor.onrender.com**

Each user needs to register the app in the org they want to assess. Takes about 5 minutes. The steps differ slightly depending on the org type — check which applies before you start.

---

## Setup: Registering the app (per org)

Do this once per Salesforce org you want to assess.

### How to tell which setup your org uses

- **External Client App** — newer orgs (Spring '25+). Go to Setup and search for **"External Client Apps"**. If it appears in the menu, use Option A.
- **Connected App** — older orgs. Go to Setup → **App Manager**. If you see a **"New Connected App"** button, use Option B.

---

### Option A — External Client App (newer orgs, Spring '25+)

1. Log in as an Administrator → **Setup → External Client Apps → New**
2. Fill in:
   - **Label:** SF Tech Debt Assessor
   - **API Name:** SF_Tech_Debt_Assessor
   - **Contact Email:** your email
3. Under **OAuth Settings**, check **Enable OAuth**
4. Set **Callback URL** to:
   ```
   https://sf-tech-debt-assessor.onrender.com/auth/callback
   ```
5. Under **OAuth Scopes**, add:
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
6. **Uncheck "Require Proof Key for Code Exchange (PKCE)"** if it appears — leave it disabled
7. Click **Save** — wait ~10 minutes for Salesforce to activate it
8. Go back to the External Client App → **View Consumer Details** to retrieve:
   - **Consumer Key** → this is your Client ID
   - **Consumer Secret** → this is your Client Secret

---

### Option B — Connected App (older orgs)

1. Log in as an Administrator → **Setup → App Manager → New Connected App**
2. Fill in:
   - **Connected App Name:** SF Tech Debt Assessor
   - **API Name:** SF_Tech_Debt_Assessor
   - **Contact Email:** your email
3. Check **Enable OAuth Settings**
4. Set **Callback URL** to:
   ```
   https://sf-tech-debt-assessor.onrender.com/auth/callback
   ```
5. Under **Selected OAuth Scopes**, add:
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)
6. **Uncheck "Require Proof Key for Code Exchange (PKCE)"** — this must be disabled
7. Click **Save** — wait ~10 minutes for Salesforce to activate the Connected App
8. Go back to the Connected App and click **Manage Consumer Details** to retrieve:
   - **Consumer Key** → this is your Client ID
   - **Consumer Secret** → this is your Client Secret

> **Important:** If you see a `redirect_uri_mismatch` error when connecting, the Callback URL in your app doesn't match. Update it to exactly `https://sf-tech-debt-assessor.onrender.com/auth/callback`, save, and wait ~10 minutes.
>
> **Important:** If you see a `missing required code challenge` error, PKCE is still enabled on your app. Go back into Setup and uncheck "Require Proof Key for Code Exchange (PKCE)", then save and retry.

### Permissions required

The user who authenticates must have:
- **API Enabled** on their profile
- **View Setup and Configuration**
- **Modify Metadata Through Metadata API Functions** (for full results)
- System Administrator profile gives all of the above

---

## Running an assessment

1. Open **https://sf-tech-debt-assessor.onrender.com**
2. Enter your org credentials on the landing page (auto-filled on return visits if you checked "Remember credentials"):
   - **Org / Sandbox URL** — your org's My Domain URL, e.g. `https://mycompany--uat.sandbox.my.salesforce.com`
   - **Client ID** — Consumer Key from the app setup above
   - **Client Secret** — Consumer Secret from the app setup above
3. Click **Connect to Salesforce**, log in to Salesforce, and click **Allow**
4. The assessment starts automatically — a progress indicator shows each category as it scans
5. Click any category panel to expand its findings
6. Click **Show affected records** on any issue to see the specific records, rules, or users causing the deduction
7. Export results (all exports include Org Name, Org ID, Type, Instance, and URL):
   - **Export PDF** — full report with category scores, findings, recommendations, and affected records per issue. Ideal for customer presentations.
   - **Export Excel** — one tab per category plus a Summary tab. Each tab lists findings with affected records. Opens directly in Excel.
   - **Export CSV** — flat file with one row per affected record across all categories. Ideal for importing into a project tracker or remediation backlog.
   - **Remediation Roadmap** — opens a full-screen display grouped into four phases (Critical → High → Medium → Low), then by category within each phase. Each item shows the title, description, recommended action, and affected record count. Use the **Print / Save as PDF** button in the toolbar to export the roadmap as a PDF.
8. Use **Re-run** in the top toolbar to run a fresh assessment at any time.

---

## Assessment categories

Checks are validated against Salesforce Spring '26 and Summer '26 release notes. Items marked with ⚠️ reflect confirmed breaking changes or enforced deprecations in those releases.

| Category | Checks | What it checks |
|---|---|---|
| **Configuration** | 13 | Workflow Rules, Process Builders, s-Controls ⚠️ deprecated, active PushTopics ⚠️ Summer '26, pending time-based WF actions, Login Flows, Classic Approval Processes ⚠️ Spring '26, legacy Einstein for Flow actions, Web-to-Case without CAPTCHA, legacy Case Auto-Response Rules, validation rules |
| **Code Quality** | 29 | See detail table below |
| **Data Model** | 4 | Object/field descriptions, field sprawl, object count |
| **Service Cloud** | 69 | See detail table below |
| **Sharing & Security** | 24 | OWD, MFA enrollment, stale users, Password Never Expires, guest sites, Security Health Check, OAuth tokens, guest profiles with Case access, privileged users ⚠️ phishing-resistant MFA enforced May 2026, Outbound Messages with retired Session ID auth ⚠️ Feb 2026, PSG adoption, cloned SysAdmin profiles, Transaction Security Policies, users with excessive permission sets |
| **Integrations** | 9 | Named vs External Credentials, hardcoded endpoints, remote site SSL, retired API Apex, active PushTopics ⚠️ Summer '26, dedicated integration users |
| **Test Coverage** | 4 | Zero-coverage classes, below-75% components, test class ratio |
| **Org Limits** | 5 | All org limits — flags anything ≥50% consumed; Apex class count approaching ~5,000 limit; custom object count approaching ~900 limit |
| **Duplicate & Matching Rules** | 4 | Missing rules, inactive rules, undocumented rules |
| **Reports & Dashboards** | 3 | Stale reports/dashboards, report proliferation |
| **Email Templates** | 3 | Classic (legacy) templates, templates not updated in 2+ years |
| **Platform Events & CDC** | 3 | Unsubscribed event channels, excessive CDC entities |
| **Managed Packages** | 3 | Beta packages, package count, version currency |
| **Custom Metadata & Settings** | 3 | Custom Settings vs Custom Metadata Types, undocumented settings |
| **Record Types & Page Layouts** | 4 | Inactive record types, excessive layouts, undocumented types |
| **Einstein & AI** | 9 | Einstein/Agentforce enablement, prompt templates, inactive bots, inactive AI Applications, Case Classification training data, Agent Topics, Agent Actions, Data Cloud connection |
| **Experience Cloud** | 15 | WCAG 2.2 ⚠️ Summer '26, clickjack protection, XSS/content-sniffing (LWR & Aura), self-registration, CDN, custom domains, guest access, Aura guest page caching, high page count per site, large network member base |
| **Connected App Security** | 12 | Session timeouts, stale OAuth tokens, certificates ⚠️ 200-day cap March 2026, CTI adapters, External Client Apps, Outbound Messages ⚠️ Session ID retired Feb 2026, OAuth tokens for deactivated users, Connected Apps bypassing IP restrictions |
| **LWC & Components** | 39 | See detail table below |
| **OmniStudio** | 26 | See detail table below |
| **Performance** | 22 | Large Apex classes (>1,000 and >5,000 lines), multi-trigger objects, async job queue depth, stuck jobs (>24h), failed jobs, scheduled Apex, active trace flags, record-triggered flows, flows with DML in loops, total active flows (>300), obsolete flow versions (>200), Platform Cache, wide objects, event log files, large static resources (>500 KB) |
| **Notes & Attachments** | 12 | Legacy Note/Attachment records, Enhanced Notes enablement, orphaned ContentDocuments, oversized files (>25 MB), untitled files, externally shared files, files with no expiry date, objects with 10k+ attachments, files not viewed in 2+ years, file distribution by object, Content Libraries |

---

### Code Quality — All 29 Checks

| # | Check | Severity |
|---|---|---|
| 1 | Triggers with business logic (no handler pattern) | High |
| 2 | Classes/triggers below 75% test coverage | High / Critical |
| 3 | Components on outdated API versions (< v55) | Medium |
| 4 | SOQL queries inside loops | Critical |
| 5 | Hardcoded Salesforce IDs in classes | High |
| 6 | Empty catch blocks — exceptions silently swallowed | High |
| 7 | DML operations inside loops — governor limit risk | Critical |
| 8 | `Schema.getGlobalDescribe()` — expensive mass schema lookup | Medium |
| 9 | Classes without a sharing declaration | High |
| 10 | `System.setPassword()` — AppExchange security violation | Critical |
| 11 | `UserInfo.getSessionId()` — session ID exposure risk | High |
| 12 | SOQL without FLS enforcement (`WITH SECURITY_ENFORCED` / `WITH USER_MODE`) | Medium |
| 13 | SOAP `login()` usage ⚠️ disabled by default Spring '26; hard retirement Summer '27 | Medium |
| 14 | Hardcoded `login.salesforce.com` URLs ⚠️ My Domain enforced Spring '26 | High |
| 15 | Dynamic SOQL with string concatenation — SOQL injection risk | Critical |
| 16 | `@future(callout=true)` methods that also perform DML | Medium |
| 17 | Weak cryptographic algorithms — MD5 / SHA-1 usage | High |
| 18 | `@IsTest(SeeAllData=true)` — tests access real org data | High |
| 19 | Test classes with no assert statements | High |
| 20 | Test classes missing `Test.startTest()` / `Test.stopTest()` | Medium |
| 21 | Test classes inserting data without `@TestSetup` | Low |
| 22 | Classes using the `global` access modifier — permanent API surface (PMD: AvoidGlobalModifier) | High |
| 23 | Queueable classes without a `Finalizer` — async failures are silent (PMD: QueueableWithoutFinalizer) | Medium |
| 24 | `@future` annotation still in use — use Queueable instead (PMD: AvoidFutureAnnotation) | Medium |
| 25 | DML operations in Apex constructors — CSRF-class vulnerability (PMD: ApexCSRF) | High |
| 26 | `addError(msg, false)` — HTML escaping disabled, XSS risk (PMD: ApexXSSFromEscapeFalse) | High |
| 27 | HTTP (not HTTPS) callout endpoints — unencrypted transmission (PMD: ApexInsecureEndpoint) | High |
| 28 | `System.debug` statements in production code — CPU overhead (PMD: AvoidDebugStatements) | Medium |
| 29 | SOQL queries without `WHERE` or `LIMIT` — full table scan risk (PMD: AvoidNonRestrictiveQueries) | High |

---

### Service Cloud — All 69 Checks

| Area | Checks | Examples |
|---|---|---|
| **Case Configuration** | 6 | Excessive record types, inactive record types, excessive queues, legacy assignment/escalation rules, unverified OWAs ⚠️ Spring '26 |
| **Omni-Channel** | 6 | No service channels, tab-based capacity, no push timeout, availability-only routing, no presence capacity limit, no presence configs |
| **Knowledge** | 6 | No published articles, stalled drafts, stale published articles, no data categories, uncategorised articles, no validation status |
| **Entitlements** | 4 | No business hours on processes, no milestone actions, open cases with no SLA start date, service contracts without entitlements |
| **Email-to-Case** | 4 | Routing addresses without TLS, no default owner, email threading gaps, unrestricted email service addresses |
| **Live Chat & Messaging** | 4 | Non-Omni-Channel chat buttons, legacy Live Agent deployments, MIAW not adopted, chat buttons pointing to empty queues |
| **Service Console** | 4 | No console app, no active macros, no Einstein NBA strategies, call centre without softphone layout |
| **Messaging Compliance** | 1 | Messaging channels without OPTOUT keyword — TCPA/GDPR risk |
| **SLA & Case Health** | 6 | Active milestone violations, stale escalated cases, stuck open cases, high zero-touch close rate, expired entitlements still active, open cases on expired entitlements |
| **Agent Efficiency** | 2 | No Quick Texts configured, unresolved callback requests >24 hours |
| **Channel Coverage** | 4 | Messaging sessions with zero agent response, unlinked chat transcripts, unlinked social posts, no case team templates |
| **Entitlement Deep Checks** | 6 | Orphaned entitlements, multi-entitlement cases, business hours without holiday exceptions, suspect milestone triggers (≤5 min), duplicate milestone trigger times |
| **Knowledge Deep Checks** | 6 | Legacy CSP channel articles, no promoted search terms or synonyms, duplicate article titles, articles without Summary, no Knowledge deflection evidence |
| **Case Deep Checks** | 6 | Cases with no contact/account, no priority set, no origin, very old open cases (90+ days), no description, user-owned cases (not queues) |
| **Other Capabilities** | 4 | Open incidents with no related items, stale swarms, unlinked work orders, active surveys with no responses, voice calls with no linked case |

---

### LWC & Components — All 39 Checks

| # | Check | Severity |
|---|---|---|
| 1 | LWC bundles without descriptions | Low |
| 2 | LWC on outdated API versions (< v57) | Medium |
| 3 | LWC on retired API versions (≤ v30) ⚠️ broken since Summer '25 | Critical |
| 4 | Aura component count vs LWC — migration debt (>40% Aura) | Medium |
| 5 | Aura components with no LWC migration started | High |
| 6 | Aura components with custom RENDERER definitions | Medium |
| 7 | Aura application/component EVENT definitions | Low |
| 8 | LWC bundles without Jest test files | Medium |
| 9 | LWC/Aura components not modified in 2+ years | Low |
| 10 | Managed package LWC components modified locally | Medium |
| 11 | `debugger` statements in production code | Critical |
| 12 | `.innerHTML` assignment — XSS risk | High |
| 13 | `document.querySelector` / `getElementById` — Shadow DOM bypass | High |
| 14 | `addEventListener` without `removeEventListener` — memory leak | Medium |
| 15 | `setTimeout` / `setInterval` / `requestAnimationFrame` | Medium |
| 16 | `async` / `await` in restricted contexts | Medium |
| 17 | `window.` / `navigator.` / `location.` — SSR-incompatible browser globals | Medium |
| 18 | `for...of` loops — polyfill dependency | Low |
| 19 | Rest parameters (`...args`) in functions | Low |
| 20 | `process.env.NODE_ENV` — Node.js construct in browser code | Low |
| 21 | Duplicate `import` statements from same module | Low |
| 22 | `eval()` usage ⚠️ critical security vulnerability + performance | Critical |
| 23 | `console.log` / `warn` / `info` statements in production | Medium |
| 24 | Deprecated `@track` decorator (redundant since Spring '20) | Low |
| 25 | `JSON.parse(JSON.stringify())` deep clone anti-pattern | Medium |
| 26 | Inline `.style.` mutation via JavaScript | Low |
| 27 | JS files exceeding 500 lines | Medium |
| 28 | Deprecated `if:true` / `if:false` template directives (removed v60) | Medium |
| 29 | `for:each` without `key` attribute — full list re-render on every change | High |
| 30 | Inline `style=` attributes in HTML templates | Low |
| 31 | Lightning pages not modified in 2+ years | Low |
| 32 | High total Lightning page count (>50) — governance flag | Low |
| 33 | `CustomEvent` with `bubbles:true` AND `composed:true` — Shadow DOM boundary breach | High |
| 34 | SLDS class overrides with hardcoded hex/RGB colors — breaks theme tokens | Medium |
| 35 | Visualforce pages present — legacy UI technology | Medium |
| 36 | Visualforce pages on API versions < v50 | High |
| 37 | Visualforce pages without descriptions | Low |
| 38 | Visualforce pages enabled for mobile (IsAvailableInTouch) | Medium |
| 39 | High Visualforce page count (>20) | Medium |

---

### OmniStudio — All 26 Checks

Automatically detects whether the org uses native OmniStudio (`OmniProcess`) or managed package Vlocity (any namespace variant: `vlocity_cmt__`, `vlocity_ins__`, `vlocity_ps__`). Skips gracefully if OmniStudio is not installed.

| # | Check | Component | Severity |
|---|---|---|---|
| 1 | Active OmniScripts in Test Mode — exposes debug output to end users | OmniScripts | Critical |
| 2 | Active Integration Procedures in Test Mode | Integration Procedures | Critical |
| 3 | Multiple active versions of the same OmniScript type (version sprawl) | OmniScripts | High |
| 4 | Inactive OmniScripts | OmniScripts | Medium |
| 5 | Inactive Integration Procedures | Integration Procedures | Medium |
| 6 | Inactive DataRaptors / Data Transforms | DataRaptors | Medium |
| 7 | Active OmniScripts without LWC compilation enabled (native orgs) | OmniScripts | Medium |
| 8 | Extract DataRaptors without Turbo Extract enabled | DataRaptors | Medium |
| 9 | High DataRaptor / Data Transform volume (>100) | DataRaptors | Medium |
| 10 | Outdated OmniStudio managed package version (managed package orgs) | Package | Medium |
| 11 | OmniScripts without descriptions | OmniScripts | Low |
| 12 | Integration Procedures without descriptions | Integration Procedures | Low |
| 13 | DataRaptors / Data Transforms without descriptions | DataRaptors | Low |
| 14 | FlexCards without descriptions | FlexCards | Low |
| 15 | OmniScripts not modified in 2+ years | OmniScripts | Low |
| 16 | Integration Procedures not modified in 2+ years | Integration Procedures | Low |
| 17 | DataRaptors / Data Transforms not modified in 2+ years | DataRaptors | Low |
| 18 | Inactive FlexCards | FlexCards | Low |
| 19 | FlexCards not modified in 2+ years | FlexCards | Low |
| 20 | Active IPs with no error-handling elements (SetErrors/Throw) | Integration Procedures | High |
| 21 | OmniScript naming convention violations (spaces in Type/SubType) | OmniScripts | Medium |
| 22 | Active OmniScripts using deprecated Remote Action elements | OmniScripts | High |
| 23 | Legacy article types in schema (pre-Spring '20 Knowledge migration) | Knowledge | Medium |
| 24 | Over-reliance on standard Extract vs Turbo Extract DataTransforms | DataRaptors | Medium |
| 25 | Active OmniScripts still on Aura runtime (LWC not enabled) | OmniScripts | High |
| 26 | Active Integration Procedures with no active OmniScripts referencing them | Integration Procedures | Low |

---

### Spring '26 / Summer '26 Breaking Changes Summary

| Change | Enforcement Date | Affected Category |
|---|---|---|
| Session IDs in Outbound Messages retired | February 2026 | Sharing & Security, Connected App Security |
| CA-signed certificate max lifespan 200 days | March 2026 | Connected App Security |
| My Domain login URL enforced for production | Spring '26 | Code Quality |
| Unverified OWAs fail to send (no more noreply fallback) | Spring '26 | Service Cloud |
| Classic Approval Processes superseded by Flow Approvals | Spring '26 | Configuration |
| Phishing-resistant MFA required for privileged users | Active May 2026 | Sharing & Security |
| SOAP login() disabled by default for new orgs | Spring '26 | Code Quality |
| API versions 21–30 retired — broken in production | Summer '25 | Integrations, LWC & Components |
| WCAG 2.2 accessibility Release Updates force-applied | Summer '26 | Experience Cloud |
| PushTopics (Streaming API) deprecated | Summer '26 | Configuration, Integrations |
| Async Sharing Recalculation enforced | Spring '27 | Sharing & Security |
| SOAP login() hard retirement | Summer '27 | Code Quality |

---

## Running locally (development)

### Prerequisites
- Node.js 18+
- A Salesforce Connected App or External Client App with callback URL `http://localhost:3000/auth/callback`

### Steps

```bash
git clone https://github.com/sbilgram-lgtm/sf-tech-debt-assessor
cd sf-tech-debt-assessor
npm install
npm run dev
```

Open http://localhost:3000

Create a `.env` file in the project root for local credentials:

```
SF_LOGIN_URL=https://yourorg.sandbox.my.salesforce.com
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=any-random-string
```

---

## Deploying your own instance to Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install --production=false && npm run build`
   - **Start Command:** `node server/index.js`
5. Add environment variables:
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = any long random string (e.g. output of `openssl rand -hex 32`)
   - `NPM_CONFIG_PRODUCTION` = `false`
6. Click **Deploy**
7. Once live, add your Render URL + `/auth/callback` to your Connected App's callback URLs
