# Salesforce Tech Debt Assessor
*By Steven Bilgram*

A web app that connects to any Salesforce org and produces a scored technical debt report across 20 categories. Each issue includes an expandable list of the specific records, rules, users, or components causing the score reduction.

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
2. Enter your org credentials (auto-filled on return visits if you checked "Remember credentials"):
   - **Sandbox / Org URL** — your org's My Domain URL, e.g. `https://mycompany--uat.sandbox.my.salesforce.com`
   - **Client ID** — Consumer Key from the app setup above
   - **Client Secret** — Consumer Secret from the app setup above
3. Click **Connect to Salesforce**, log in, and click **Allow**
4. Click **Run Assessment**
5. Click any category to expand its findings
6. Click **Show affected records** on any issue to see the specific records, rules, or users causing the deduction
7. Export results (all exports include Org Name, Org ID, Type, Instance, and URL):
   - **Export PDF** — full report with category scores, findings, recommendations, and affected records per issue. Ideal for customer presentations.
   - **Export Excel** — one tab per category plus a Summary tab. Each tab lists findings with affected records. Opens directly in Excel.
   - **Export CSV** — flat file with one row per affected record across all categories. Ideal for importing into a project tracker or remediation backlog.
   - **Remediation Roadmap** — opens a full-screen display grouped into four phases (Critical → High → Medium → Low), then by category within each phase. Each item shows the title, description, recommended action, and affected record count. Use the **Print / Save as PDF** button in the toolbar to export the roadmap as a PDF.

---

## Assessment categories

Checks are validated against Salesforce Spring '26 and Summer '26 release notes. Items marked with ⚠️ reflect confirmed breaking changes or enforced deprecations in those releases.

| Category | What it checks |
|---|---|
| **Configuration** | Workflow Rules, Process Builders, automation overlap, validation rules; Classic Approval Processes ⚠️ Spring '26; legacy Einstein for Flow actions ⚠️ Spring '26 |
| **Code Quality** | SOQL in loops, hardcoded IDs, trigger patterns, outdated API versions; SOAP `login()` usage ⚠️ Spring '26; hardcoded `login.salesforce.com` URLs ⚠️ Spring '26 My Domain enforcement |
| **Data Model** | Object/field descriptions, field sprawl, object count |
| **Service Cloud** | Record types, queues, assignment/escalation rules; unverified Organization-Wide Email Addresses ⚠️ Spring '26 — fail to send |
| **Sharing & Security** | OWD, MFA enrollment, stale users, Password Never Expires, guest sites, Security Health Check, OAuth tokens; privileged users without phishing-resistant MFA ⚠️ enforced May 2026; active Outbound Messages with retired Session ID auth ⚠️ retired Feb 2026; Async Sharing Recalculation Release Update ⚠️ enforced Spring '27 |
| **Integrations** | Named Credentials usage, hardcoded endpoints, remote site SSL, connected apps; Apex classes on API versions ≤30 ⚠️ retired Summer '25 — broken in production |
| **Test Coverage** | Zero-coverage classes, below-75% components, test class ratio |
| **Org Limits** | All org limits — flags anything ≥50% consumed |
| **Duplicate & Matching Rules** | Missing rules, inactive rules, undocumented rules |
| **Reports & Dashboards** | Stale reports/dashboards, report proliferation |
| **Email Templates** | Classic (legacy) templates, templates not updated in 2+ years |
| **Platform Events & CDC** | Unsubscribed event channels, excessive CDC entities |
| **Managed Packages** | Beta packages, package count, version currency |
| **Custom Metadata & Settings** | Custom Settings vs Custom Metadata Types, undocumented settings |
| **Record Types & Page Layouts** | Inactive record types, excessive layouts, undocumented types |
| **Einstein & AI Usage** | Einstein/Agentforce enablement, prompt templates, inactive bot definitions |
| **Territory Management** | Draft models, multiple active models, inactive assignment rules |
| **Experience Cloud** | Legacy templates, guest access, self-registration, custom domains, CDN, HTTPS enforcement; WCAG 2.2 accessibility Release Updates ⚠️ enforced Summer '26 |
| **Connected App Security** | Session timeouts, stale OAuth tokens, token volume, undocumented apps; Outbound Messages with retired Session ID auth ⚠️ retired Feb 2026; CA-signed certificates >200-day lifespan ⚠️ enforced March 2026; Traditional Connected Apps without External Client App equivalents ⚠️ Spring '26 standard |
| **Lightning Web Components** | 32 checks across metadata, source code, HTML templates, and Lightning page governance — see detail table below |

### Lightning Web Components — All 32 Checks

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

### Spring '26 / Summer '26 Breaking Changes Summary

| Change | Enforcement Date | Affected Category |
|---|---|---|
| Session IDs in Outbound Messages retired | February 2026 | Sharing & Security, Connected App Security |
| CA-signed certificate max lifespan 200 days | March 2026 | Connected App Security |
| My Domain login URL enforced for production | Spring '26 | Code Quality |
| Connected App creation disabled by default (ECAs are standard) | Spring '26 | Connected App Security |
| Unverified OWAs fail to send (no more noreply fallback) | Spring '26 | Service Cloud |
| Classic Approval Processes superseded by Flow Approvals | Spring '26 | Configuration |
| Phishing-resistant MFA required for privileged users | Active May 2026 | Sharing & Security |
| API versions 21–30 retired — broken in production | Summer '25 | Integrations, Lightning Web Components |
| WCAG 2.2 accessibility Release Updates force-applied | Summer '26 | Experience Cloud |
| Async Sharing Recalculation enforced | Spring '27 | Sharing & Security |

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
