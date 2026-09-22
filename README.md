# Salesforce Tech Debt Assessor
*By Steven Bilgram, Success Architect*
*Last updated: September 22, 2026*

A web app that connects to any Salesforce org via OAuth and runs a comprehensive read-only scan across **384 checks in 23 categories** — surfacing technical debt, security gaps, and configuration anti-patterns with prioritized, actionable recommendations. Each finding includes an expandable list of the specific records, users, rules, or components causing the score deduction.

## Disclaimer

Tech Debt Assessor is provided "as is," without warranties. Its assessments and recommendations reflect my professional experience as a technical architect but are intended as decision-support guidance, not legal, regulatory, or financial advice.

Users are responsible for validating results and adapting recommendations to their specific environment, requirements, and risks. I accept no liability for its use or misuse; by using the software, you accept these terms.

This tool is independent and is not affiliated with or endorsed by Salesforce, Inc. "Salesforce" is a trademark of Salesforce, Inc.

---

## What's New — September 22, 2026 (AI chat)

**Gemini AI chat panel** — After running an assessment, click **Ask AI** (top-right of the results toolbar) to open a side panel powered by Gemini 1.5 Flash. The AI receives the full assessment context — org info, all category scores, and every triggered finding — and can answer questions like "What are the quick wins?", "Estimate total remediation effort", or "What are the AppExchange readiness risks?". Responses stream in token-by-token.

- Feature-flagged via `GEMINI_API_KEY` Railway env var — panel is hidden when the key is not set; no deployment needed to toggle
- Uses Gemini 1.5 Flash free tier (15 RPM, 1 M tokens/day)
- To enable: add `GEMINI_API_KEY` to your Railway environment variables (get a free key at [Google AI Studio](https://aistudio.google.com))

---

## What's New — August 18, 2026 (bug fixes)

24 logic fixes across server and scoring layers. Key fixes:

- **F01** – `fieldCount` SOQL alias was read as `expr0`, making field-count-by-object always undefined
- **F03** – `Order` field does not exist on `EntitlementProcessMilestone`; query was silently failing
- **F04** – `asyncSharingUpdateActive` was always `false` when the query errored; now propagates `null`
- **F05** – `InstalledSubscriberPackage` queried flat fields that belong to `SubscriberPackage`/`SubscriberPackageVersion` relationships
- **F06** – OmniStudio IP error-handling check always fired on managed-package orgs (missing `else` branch)
- **F07** – `BotDefinition` had no `BotType` filter; classic Einstein Bots incorrectly triggered Agentforce checks
- **F08** – `OrgPreference` is Tooling API only; was queried via standard SOQL, always returning empty
- **F09** – SOQL-in-loops regex was unbounded and could match across method boundaries
- **F10** – CQ-31 (DML without CRUD) silently skipped classes already in CQ-14 (SOQL without FLS)
- **F11–F25** – Additional regex accuracy, false-positive elimination, dead query removal, and API type corrections

OmniStudio duplicate check removed (LWC-not-compiled was double-counted with Aura runtime check): **363 → 362**

---

## What's New — August 18, 2026

5 new checks across Code Quality and Flow Quality:

**Code Quality (3 new):**
- **`System.runAs()` in production code** (Critical) — privilege escalation; `System.runAs()` is test-only and bypasses sharing rules in production
- **Schedulable classes without try/catch in `execute()`** (High) — scheduled jobs fail silently with no alert when unhandled exceptions occur
- **`@TestVisible` usage** (Low) — creates tight coupling between tests and internal implementation, making refactoring harder

**Flow Quality (2 new):**
- **Flows with multiple active versions** (High) — API/deploy anomaly that causes both versions to execute simultaneously
- **Flows with more than 50 elements** (Medium) — maintainability signal; large flows are difficult to debug and hand off

> Note: "Action elements without fault paths" was considered but requires parsing full Flow metadata XML — not achievable via SOQL/Tooling API queries.

Total checks: **358 → 362**

---

## What's New — August 18, 2026 (earlier)

Corrected count discrepancies:

- Fixed Sharing & Security count: UI showed 32 checks, code had 33 — corrected to 33
- Fixed README section headers: Code Quality listed as 46 (correct: 45), Service Cloud listed as 69 (correct: 70)

Total checks: **357 → 358**

---

## What's New — August 11, 2026

- **PKCE support added** — the OAuth flow now generates a `code_verifier`/`code_challenge` on every login. External Client Apps in Spring '25+ orgs can no longer have "Require PKCE" unchecked in the UI, making this required for those orgs. No setup change needed — the app handles it automatically. The "Uncheck PKCE" step has been removed from the setup guide.
- **Salesforce OAuth errors now surface on the login page** — instead of a generic "Authentication failed" message, errors returned by Salesforce (e.g. redirect URI mismatch, invalid client) are shown directly so the exact issue is visible.

---

## What's New — August 4, 2026

9 new metadata-only checks across 5 categories — all validated against Salesforce API field names before implementation:

- **Sharing & Security (4 new):** Active users with no role assigned (Medium); Profiles with View All Data — non-SysAdmin (Critical); Profiles with Modify All Data — non-SysAdmin (Critical); Permission sets with both View All Records + Modify All Records on the same object (High)
- **Reports & Dashboards (2 new):** Reports owned by deactivated users (High); Dashboards owned by deactivated users (High)
- **Flow Quality (1 new):** Active flows last modified by a deactivated user — change control gap (Low)
- **Configuration (1 new):** Validation rules with no error message — users see blank error on failure (Medium)
- **Integrations (1 new):** Named Credentials using Password authentication — legacy pattern (High)

Total checks: **349 → 358**

---

## What's New — August 1, 2026

- **Migrated hosting from Render to Railway** — no more 30-second cold starts. The app is now always-on at **https://sf-tech-debt-assessor-production.up.railway.app**
- **Disclaimer added** — an "Important Disclaimer" box now appears on the login page above the Connect form, clarifying that the tool is independent, not affiliated with Salesforce, Inc., and that results are informational guidance only — not legal, regulatory, or financial advice.

---

## What's New — July 31, 2026

**Test suite added — 89 tests across 3 layers:**

- **Layer 1 — Check Count Parity** (`checkCountParity.test.ts`): Counts `createDebtItem` calls per scoring function and asserts they match the `checks:` values declared in `LoginPage CATEGORIES`. Any future drift between the code and the UI check counts fails automatically.
- **Layer 2 — Regression Tests** (`regressions.test.ts`): One test per confirmed bug from the accuracy audit — DML-in-loop cross-method false positive, `Schema.sObjectType` CRUD false positive, C-style `for`-loop SOQL detection, `for:each` key= per-occurrence check, Process Builder double-count, obsolete flows double-count, DML-in-loop flows double-count, external files double-deduction.
- **Layer 3 — Scoring Smoke Tests** (`scoring.smoke.test.ts`): Every scoring function tested with a clean-org input (no items → score = 100) and a flagged input (≥1 item → score < 100). Catches logic inversions and crashes on empty input across all 23 categories.

---

## What's New — July 28, 2026

9 new checks derived from the Salesforce Optimizer (sunset tool) — all metadata-only, no data scan required:

- **Configuration (2 new):** JavaScript buttons/links broken in Lightning Experience (High); Feed Tracking enabled on excessive objects (Medium)
- **Sharing & Security (4 new):** Standard profiles with no active users (Low); Custom permission sets assigned to no users (Low); Roles with no active users (Low); Role hierarchy depth >10 levels (Medium)
- **Record Types & Layouts (1 new):** Page layouts not assigned to any profile or record type — orphaned (Medium)
- **Reports & Dashboards (2 new):** Reports stored in personal folders — invisible to team (Medium); Custom Report Types with no reports built on them (Low)

Total checks: **343 → 349**

---

## What's New — July 20, 2026

- **Category health labels:** Category scores now display as qualitative labels (Excellent / Good / Average / Fair / Poor) instead of raw percentages — easier to communicate to customers at a glance
- **Exports updated:** PDF, Excel, and CSV exports use the same health labels throughout, replacing the previous numeric scores per category

## What's New — July 16, 2026

Fixed 9 code quality logic bugs:
- **Regex cross-brace false positives:** Regex patterns that span source-code lines no longer produce spurious DML-in-loop or SOQL-in-loop findings when the match crosses a closing brace boundary
- **Hardcoded-ID false positives:** 15- and 18-character ID patterns in comments, test fixture strings, and `@isTest` methods are now excluded
- **Double-counting fixed:** Multiple findings for the same class across overlapping checks (e.g. `@future` + async rules) are now deduplicated so each class appears once in the affected records list

---

## What's New — June 24, 2026

Comprehensive accuracy audit — 40+ checks corrected across all 23 categories:

- **Flow Quality:** Removed 4 checks that could never work via SOQL (fault paths, hardcoded IDs, copy labels, circular subflows — all require Metadata API). Added 2 accurate checks: active Process Builder flows and obsolete flow version accumulation. Fixed DML-in-loops to use Tooling API (FlowElement is not accessible via standard SOQL). Removed invalid `NamespacePrefix = null` filter from all standard SOQL Flow queries.
- **Test Coverage:** Test classes now identified via the canonical `IsTest` field instead of a name heuristic. Added `Body` and `Status = 'Active'` to the query so TC-5 (assert messages), TC-6 (runAs), TC-7 (testMethod keyword) can actually run. Abstract classes with 0 executable lines no longer flagged as untested. `assessCodeQuality` now scopes coverage to org-owned components only (same fix applied to `assessTestCoverage` previously).
- **Automation:** Process Builder count now includes `ProcessType = 'Workflow'` (the primary type — previously always 0). "Pending Time-Based Workflow Queue" correctly relabeled as "Pending Approval Process Instances" (time-based WFR queue is not SOQL-queryable). Main Flow query, s-Controls, and Approval Processes fixed for namespace and LIMIT.
- **Sharing & Security:** OAuth tokens now query `OauthToken` (replaced broken `AuthSession WHERE SessionType = 'OAuth2'`). Outbound messages `WHERE IsActive = true` removed (field doesn't exist). Low-security sessions threshold raised from `> 0` to `> 20` with MFA guard. `caseGuestProfiles` scoped to `UserType = 'GuestUser'` only. `ProfileIpRange` LIMIT raised to 2000.
- **Service Cloud:** Escalation Rules check inverted — now fires when absent (not when present). Assignment Rules threshold fixed — fires when none configured (Salesforce only allows 1 active rule at a time, making `> 1` unreachable). Zero-touch case close rate date filter removed from CaseComment subquery. EntitlementProcessMilestone LIMIT raised to 2000. Stalled draft articles now filters `IsLatestVersion = true`.
- **Integrations:** NamedCredential and RemoteProxy queries now filter `NamespacePrefix = null`. `setEndpoint` regex excludes `callout:` Named Credential syntax. Integration user threshold raised to `> 5` to exclude Salesforce-shipped built-in apps.
- **Data Model:** CustomObject query now excludes `__mdt`, `__e`, `__x`, `__b`, and Custom Settings — counts true custom objects only. Bloated objects display resolved to API names instead of opaque IDs. Hardcoded 800/600 custom object thresholds removed — generic limits loop handles this with edition-accurate values.
- **Remaining categories:** DuplicateRule, MatchingRule, RecordType, Custom Settings queries all now filter `NamespacePrefix = null`. Platform events EntityDefinition now counts only `IsCustomizable = true` (excludes standard Salesforce events). Email templates filtered to `isActive = true`. Reports/Dashboards stale count now uses a COUNT query (LIMIT 200 sample no longer understates the number). WCAG check now only fires when Tooling API confirmed the setting exists and is not enabled — silent query failures no longer produce false positives.

---

## What's New — June 22, 2026

- **41 new checks added across 3 categories** — total checks grows from 315 → 343
  - Code Quality: 29 → 46 checks (17 new PMD/Graph Engine security + design rules)
  - Test Coverage: 4 → 7 checks (3 new PMD test quality rules)
  - Flow Quality: brand new category with 8 checks (Flow Scanner rules)
- Docker support: app is published to GitHub Container Registry on every push to `main`
- Connected App setup now documents both the hosted and local Docker callback URLs
- Clarified that External Client Apps (Spring '25+ orgs) support the hosted version only — local Docker requires a Connected App
- Apple Silicon (M1/M2/M3) Mac users must build the image locally (GHCR image is amd64 only)

## What's New — June 15–16, 2026

Accuracy improvements across 11 checks based on customer feedback:

- **OWD (Sharing & Security):** Managed package objects, Custom Metadata Types (`__mdt`), External Objects (`__x`), Platform Event objects (`__e`), History objects, and other non-configurable types are now excluded from the Public Read/Write count — only objects whose OWD an admin can actually change are flagged.
- **MFA check:** Sandbox orgs now show this as Low severity (not Critical) since Salesforce does not enforce MFA enrollment in sandboxes. Added clarification for orgs using SSO/IdP-managed MFA (Okta, Entra ID) where TwoFactorInfo records are absent even when MFA is active.
- **Retired API versions:** Salesforce-owned Experience Cloud controllers (SiteRegisterController, ChangePasswordController, etc.) are now excluded — only customer-owned Apex classes are flagged.
- **Duplicate & Matching Rules:** Salesforce's standard shipped rules now correctly appear, eliminating the false "No Rules Configured" finding.
- **Platform Events & CDC:** Managed-package Platform Events (e.g. Marketing Cloud `et4ae5__`) are now detected, preventing a false "None Configured" finding.
- **Performance — Lightning Pages:** Non-record pages (AppPage, HomePage, UtilityBar) no longer pool as "Unknown" in the multi-page-per-object check.
- **Einstein & AI:** Detection now uses BotDefinition, BotTopicDefinition, and PromptTemplate as reliable signals, eliminating the false "Not Enabled" finding for orgs with active Agentforce.
- **Service Console detection:** Switched from Tooling API to standard SOQL — returns all Console apps regardless of profile assignment.
- **Knowledge checks:** Removed English-only language filter — now counts articles across all languages.
- **Sharing Security API:** `isSandbox` flag now exposed to scoring layer.
- **SOAP login / hardcoded URL Apex queries:** `NamespacePrefix = null` filter added to exclude managed classes.

---

## Data & Privacy

All metadata is **ephemeral** — nothing is written to a database or stored server-side beyond your active session:

| Data | Where it lives | Lifetime |
|---|---|---|
| OAuth tokens | Server memory (express-session) | 1 hour |
| Assessment results | Browser tab (React state) | Until page refresh |
| Credentials (if remembered) | Browser localStorage | Until you clear it |
| Exported files (PDF / Excel / CSV) | Your local Downloads folder | Permanent |

Nothing is written back to Salesforce. No external database is used. Assessment results exist only in the browser tab while the session is active.

---

## Using the hosted app

> Share this URL with colleagues: **https://sf-tech-debt-assessor-production.up.railway.app**

Each user needs to register the app in the org they want to assess. Takes about 15 minutes. The steps differ slightly depending on the org type — check which applies before you start.

---

## Setup: Registering the app (per org)

Do this once per Salesforce org you want to assess.

### Which setup type do I need?

| Org Type | Setup Type | Supports Hosted | Supports Local Docker |
|---|---|---|---|
| Production / Sandbox / Developer Edition | Connected App | ✅ | ✅ |
| Trailhead Playground / Spring '25+ orgs | External Client App | ✅ | ❌ |

> **How to tell:** Go to Setup and search **App Manager**. If you see a **"New Connected App"** button, use the Connected App instructions. If you only see External Client Apps, use those instructions — but note local Docker will not be available.

---

### Option A — Connected App (Production, Sandbox, Developer Edition)

Supports both the hosted version and local Docker.

1. Log in as an Administrator → **Setup → App Manager → New Connected App**
2. Fill in:
   - **Connected App Name:** SF Tech Debt Assessor
   - **API Name:** SF_Tech_Debt_Assessor (auto-fills)
   - **Contact Email:** your email address
3. Check **Enable OAuth Settings**
4. In the **Callback URL** field, enter the URLs for the options you want to use — one per line:
   - Hosted version: `https://sf-tech-debt-assessor-production.up.railway.app/auth/callback`
   - Local Docker: `http://localhost:3001/auth/callback`
   - You can include both — Salesforce will use whichever matches
5. Under **Selected OAuth Scopes**, add:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
6. Click **Save** → then **Continue**
8. **Wait 10 minutes** — Salesforce needs time to activate the app

**Get your credentials:**
1. Go back to **App Manager**, find your app, click the dropdown arrow → **View**
2. Click **Manage Consumer Details** (you may need to verify your identity)
3. Copy the **Consumer Key** → this is your **Client ID**
4. Copy the **Consumer Secret** → this is your **Client Secret**

---

### Option B — External Client App (Spring '25+ / Trailhead Playground orgs)

> **Note:** External Client Apps only support the hosted version. Local Docker requires HTTPS and is not supported with `http://localhost`.

1. Log in as an Administrator → **Setup → External Client Apps → New**
2. Fill in:
   - **Label:** SF Tech Debt Assessor
   - **Name:** SF_Tech_Debt_Assessor (auto-fills)
   - **Contact Email:** your email address
3. Under **OAuth Settings**, check **Enable OAuth**
4. Set **Callback URL** to:
   ```
   https://sf-tech-debt-assessor-production.up.railway.app/auth/callback
   ```
5. Under **OAuth Scopes**, add:
   - `Access and manage your data (api)`
   - `Perform requests on your behalf at any time (refresh_token, offline_access)`
6. Click **Save** — wait ~10 minutes for Salesforce to activate it
8. Go back to the External Client App → click the app name → copy:
   - **Client ID** → your Client ID
   - **Client Secret** → your Client Secret

---

### Permissions required

The user who authenticates must have:
- **API Enabled** on their profile
- **View Setup and Configuration**
- **Modify Metadata Through Metadata API Functions** (for full results)
- System Administrator profile gives all of the above

---

> **Troubleshooting common errors:**
>
> | Error | Fix |
> |---|---|
> | "Authentication failed" | Double-check Client ID and Client Secret — copy/paste directly, no extra spaces |
> | "redirect_uri_mismatch" | The Callback URL in your app doesn't match exactly. Check it's entered as shown above, then save and wait 10 minutes |
> | "invalid_client_id" | Wait the full 10 minutes after creating the app, then try again |
> | Any Salesforce error | The exact error message from Salesforce is now shown on the login page — use it to identify the specific issue |

---

## Running an assessment

1. Open **https://sf-tech-debt-assessor-production.up.railway.app** (or `http://localhost:3001` for Docker)
2. Enter your credentials:
   - **Org / Sandbox URL** — your org's My Domain URL (see examples below)
   - **Client ID** — Consumer Key from the app setup above
   - **Client Secret** — Consumer Secret from the app setup above
3. Click **Connect to Salesforce**, log in, and click **Allow**
4. The assessment starts automatically — a progress indicator shows each category as it scans
5. Click any category panel to expand its findings
6. Click **Show affected records** on any issue to see the specific records, rules, or users causing the deduction
7. Export results (all exports include Org Name, Org ID, Type, Instance, and URL):
   - **Export PDF** — full report with category scores, findings, recommendations, and affected records per issue
   - **Export Excel** — one tab per category plus a Summary tab
   - **Export CSV** — flat file, one row per affected record — ideal for importing into a project tracker
   - **Remediation Roadmap** — full-screen phased roadmap (Critical → High → Medium → Low). Use **Print / Save as PDF** to export

**Org URL format examples:**

| Org Type | Example URL |
|---|---|
| Production | `https://yourcompany.my.salesforce.com` |
| Sandbox | `https://yourcompany--sandboxname.sandbox.my.salesforce.com` |
| Developer Edition | `https://yourname-dev-ed.develop.my.salesforce.com` |
| Trailhead Playground | `https://yourname-dev-ed.trailblaze.my.salesforce.com` |

> **Tip:** Find your org URL in Salesforce → Setup → Company Settings → My Domain. Use everything up to and including `.salesforce.com` with no trailing slash.

---

## Assessment categories

Checks are validated against Salesforce Spring '26 and Summer '26 release notes. Items marked with ⚠️ reflect confirmed breaking changes or enforced deprecations in those releases.

| Category | Checks | What it checks |
|---|---|---|
| **Configuration** | 14 | Workflow Rules, Process Builders, s-Controls ⚠️ deprecated, active PushTopics ⚠️ Summer '26, pending time-based WF actions, Login Flows, Classic Approval Processes ⚠️ Spring '26, legacy Einstein for Flow actions, Web-to-Case without CAPTCHA, legacy Case Auto-Response Rules, validation rules, validation rules with no error message, JavaScript buttons/links broken in LEX, excessive Feed Tracking |
| **Code Quality** | 48 | See detail table below |
| **Data Model** | 5 | Object/field descriptions, field sprawl, object count |
| **Service Cloud** | 70 | See detail table below |
| **Sharing & Security** | 33 | OWD, MFA enrollment, stale users, Password Never Expires, guest sites, Security Health Check, OAuth tokens, guest profiles with Case access, privileged users ⚠️ phishing-resistant MFA enforced May 2026, PSG adoption, cloned SysAdmin profiles, Transaction Security Policies, users with excessive permission sets, profiles with no active users, permission sets assigned to no users, roles with no active users, role hierarchy depth, users with no role assigned, profiles with View All Data, profiles with Modify All Data, permission sets with object-level View All + Modify All |
| **Integrations** | 10 | Named vs External Credentials, Named Credentials using Password auth, hardcoded endpoints, remote site SSL, retired API Apex, active PushTopics ⚠️ Summer '26, dedicated integration users |
| **Test Coverage** | 7 | Zero-coverage classes, below-75% components, test class ratio, assert messages, runAs usage, deprecated testMethod keyword |
| **Org Limits** | 5 | All org limits — flags anything ≥50% consumed; Apex class count approaching ~5,000 limit; custom object count approaching ~900 limit |
| **Duplicate & Matching Rules** | 4 | Missing rules, inactive rules, undocumented rules |
| **Reports & Dashboards** | 7 | Stale reports/dashboards, report proliferation, reports in personal folders, unused Custom Report Types, reports owned by deactivated users, dashboards owned by deactivated users |
| **Email Templates** | 3 | Classic (legacy) templates, templates not updated in 2+ years |
| **Platform Events & CDC** | 3 | Unsubscribed event channels, excessive CDC entities |
| **Managed Packages** | 3 | Beta packages, package count, version currency |
| **Custom Metadata & Settings** | 3 | Custom Settings vs Custom Metadata Types, undocumented settings |
| **Record Types & Page Layouts** | 5 | Inactive record types, excessive layouts, undocumented types, orphaned page layouts not assigned to any profile |
| **Einstein & AI** | 9 | Einstein/Agentforce enablement, prompt templates, inactive bots, inactive AI Applications, Case Classification training data, Agent Topics, Agent Actions, Data Cloud connection |
| **Experience Cloud** | 16 | WCAG 2.2 ⚠️ Summer '26, clickjack protection, XSS/content-sniffing (LWR & Aura), self-registration, CDN, custom domains, guest access, Aura guest page caching, high page count per site, large network member base |
| **Connected App Security** | 12 | Session timeouts, stale OAuth tokens, certificates ⚠️ 200-day cap March 2026, CTI adapters, External Client Apps, Outbound Messages ⚠️ Session ID retired Feb 2026, OAuth tokens for deactivated users, Connected Apps bypassing IP restrictions |
| **LWC & Components** | 39 | See detail table below |
| **OmniStudio** | 25 | See detail table below |
| **Performance** | 20 | Large Apex classes (>1,000 and >5,000 lines), multi-trigger objects, async job queue depth, stuck jobs (>24h), failed jobs, scheduled Apex, active trace flags, record-triggered flows, total active flows (>300), Platform Cache, wide objects, event log files, large static resources (>500 KB) |
| **Notes & Attachments** | 12 | Legacy Note/Attachment records, Enhanced Notes enablement, orphaned ContentDocuments, oversized files (>25 MB), untitled files, externally shared files, files with no expiry date, objects with 10k+ attachments, files not viewed in 2+ years, file distribution by object, Content Libraries |
| **Flow Quality** | 9 | See detail table below |

---

### Code Quality — All 48 Checks

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
| 30 | Hardwired IVs or keys in `Crypto.encrypt/decrypt` calls (PMD: ApexBadCrypto) | Critical |
| 31 | DML / SOQL without CRUD permission checks (PMD: ApexCRUDViolation) | Critical |
| 32 | `Database.executeAnonymous()` usage — arbitrary code execution risk (PMD: ApexDangerousMethods) | Critical |
| 33 | `PageReference` constructed from user-controlled input — open redirect (PMD: ApexOpenRedirect) | Critical |
| 34 | Hardcoded `Authorization` headers in HTTP callouts — use Named Credentials (PMD: ApexSuggestUsingNamedCred) | High |
| 35 | URL parameters used without escaping — XSS risk (PMD: ApexXSSFromURLParam) | High |
| 36 | High cyclomatic complexity — too many decision branches (PMD: CyclomaticComplexity) | High |
| 37 | Methods with 6+ parameters — use wrapper objects (PMD: ExcessiveParameterList) | Medium |
| 38 | If statements nested 4+ levels deep (PMD: AvoidDeeplyNestedIfStmts) | Medium |
| 39 | `@AuraEnabled` properties with private/protected getters — runtime error (PMD: InaccessibleAuraEnabledGetter) | High |
| 40 | `equals()` overridden without `hashCode()` or vice versa — broken Map/Set contract (PMD: OverrideBothEqualsAndHashcode) | High |
| 41 | Class names shadow built-in Apex types (PMD: TypeShadowsBuiltInNamespace) | High |
| 42 | SOQL `LIMIT 1` result used without null check — NullPointerException risk (Graph Engine: ApexNullPointerException) | High |
| 43 | SOQL bind variables without null checks — full table scan risk (Graph Engine: MissingNullCheckOnSoqlVariable) | High |
| 44 | Multiple calls to `Schema.getGlobalDescribe()` / `describeSObjects()` (Graph Engine: AvoidMultipleMassSchemaLookups) | High |
| 45 | Non-global abstract classes or interfaces with no concrete implementation (Graph Engine: UnimplementedType) | Medium |
| 46 | `System.runAs()` in production code — privilege escalation (test-only method) | Critical |
| 47 | Schedulable classes without try/catch in `execute()` — silent job failures | High |
| 48 | `@TestVisible` usage — tests coupled to internal implementation | Low |
| 46 | `System.debug()` without `LoggingLevel` parameter (PMD: DebugsShouldUseLoggingLevel) | Low |

---

### Service Cloud — All 70 Checks

| Area | Checks | Examples |
|---|---|---|
| **Case Configuration** | 6 | Excessive record types, inactive record types, excessive queues, legacy assignment/escalation rules, unverified OWAs ⚠️ Spring '26 |
| **Omni-Channel** | 6 | No service channels, tab-based capacity, no push timeout, availability-only routing, no presence capacity limit, no presence configs |
| **Knowledge** | 6 | No published articles, stalled drafts, stale published articles, no data categories, uncategorized articles, no validation status |
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

### OmniStudio — All 25 Checks

Automatically detects whether the org uses native OmniStudio (`OmniProcess`) or managed package Vlocity (any namespace variant: `vlocity_cmt__`, `vlocity_ins__`, `vlocity_ps__`). Skips gracefully if OmniStudio is not installed.

| # | Check | Component | Severity |
|---|---|---|---|
| 1 | Active OmniScripts in Test Mode — exposes debug output to end users | OmniScripts | Critical |
| 2 | Active Integration Procedures in Test Mode | Integration Procedures | Critical |
| 3 | Multiple active versions of the same OmniScript type (version sprawl) | OmniScripts | High |
| 4 | Inactive OmniScripts | OmniScripts | Medium |
| 5 | Inactive Integration Procedures | Integration Procedures | Medium |
| 6 | Inactive DataRaptors / Data Transforms | DataRaptors | Medium |
| 7 | Extract DataRaptors without Turbo Extract enabled | DataRaptors | Medium |
| 8 | High DataRaptor / Data Transform volume (>100) | DataRaptors | Medium |
| 9 | Outdated OmniStudio managed package version (managed package orgs) | Package | Medium |
| 10 | OmniScripts without descriptions | OmniScripts | Low |
| 11 | Integration Procedures without descriptions | Integration Procedures | Low |
| 12 | DataRaptors / Data Transforms without descriptions | DataRaptors | Low |
| 13 | FlexCards without descriptions | FlexCards | Low |
| 14 | OmniScripts not modified in 2+ years | OmniScripts | Low |
| 15 | Integration Procedures not modified in 2+ years | Integration Procedures | Low |
| 16 | DataRaptors / Data Transforms not modified in 2+ years | DataRaptors | Low |
| 17 | Inactive FlexCards | FlexCards | Low |
| 18 | FlexCards not modified in 2+ years | FlexCards | Low |
| 19 | Active IPs with no error-handling elements (SetErrors/Throw) | Integration Procedures | High |
| 20 | OmniScript naming convention violations (spaces in Type/SubType) | OmniScripts | Medium |
| 21 | Active OmniScripts using deprecated Remote Action elements | OmniScripts | High |
| 22 | Legacy article types in schema (pre-Spring '20 Knowledge migration) | Knowledge | Medium |
| 23 | Over-reliance on standard Extract vs Turbo Extract DataTransforms | DataRaptors | Medium |
| 24 | Active OmniScripts still on Aura runtime (LWC not enabled) | OmniScripts | High |
| 25 | Active Integration Procedures with no active OmniScripts referencing them | Integration Procedures | Low |

---

### Test Coverage — All 7 Checks

| # | Check | Severity |
|---|---|---|
| 1 | Low test class ratio (< 30% of production components) | High |
| 2 | Classes / triggers with zero test coverage | Critical |
| 3 | Components below 75% test coverage | High |
| 4 | Triggers without a dedicated test class (by naming convention) | Medium |
| 5 | Assert statements without a message parameter — failures are cryptic (PMD: ApexAssertionsShouldIncludeMessage) | Low |
| 6 | Test classes that never call `System.runAs()` — multi-user scenarios untested (PMD: ApexUnitTestClassShouldHaveRunAs) | Medium |
| 7 | Test methods using the deprecated `testMethod` keyword — replace with `@isTest` (PMD: ApexUnitTestMethodShouldHaveIsTestAnnotation) | Low |

---

### Flow Quality — All 9 Checks

| # | Check | Severity |
|---|---|---|
| 1 | Active Process Builder flows (ProcessType = Workflow) — legacy, Salesforce retiring | High |
| 2 | Active flows with loop and record operation elements — governor limit risk | High |
| 3 | Flows running in System Context Without Sharing — privilege escalation risk | High |
| 4 | Flows running in System Context With Sharing — elevated privileges, review intent | Low |
| 5 | Obsolete flow versions accumulating (>50) — org hygiene | Low / Medium |
| 6 | Active flows last modified by a deactivated user — change control gap | Low |
| 7 | Active flows with no description | Low |
| 8 | Flows with multiple active versions — API/deploy anomaly causing duplicate execution | High |
| 9 | Flows with more than 50 elements — maintainability and debugging risk | Medium |

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

## Running with Docker

The app is published as a Docker image to GitHub Container Registry on every push to `main`. This is the recommended option for running the app inside your own network.

> **Important:** Local Docker requires a **Connected App** (not an External Client App). External Client Apps require HTTPS and do not support `http://localhost` callback URLs.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed (Mac, Windows, or Linux)
- A Salesforce **Connected App** with `http://localhost:3001/auth/callback` in the Callback URL list

### Quick start

**Windows / Linux / Intel Mac:**
```bash
docker pull ghcr.io/sbilgram-lgtm/sf-tech-debt-assessor:latest

docker run -d \
  -p 3001:3001 \
  -e SESSION_SECRET=change-this-to-a-random-string \
  -e NODE_ENV=production \
  --name sf-assessor \
  ghcr.io/sbilgram-lgtm/sf-tech-debt-assessor:latest
```

**Apple Silicon Mac (M1/M2/M3) — build locally:**
```bash
git clone https://github.com/sbilgram-lgtm/sf-tech-debt-assessor
cd sf-tech-debt-assessor
docker build -t sf-tech-debt-assessor .

docker run -d \
  -p 3001:3001 \
  -e SESSION_SECRET=change-this-to-a-random-string \
  -e NODE_ENV=production \
  --name sf-assessor \
  sf-tech-debt-assessor
```

Then open **http://localhost:3001** in your browser.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Any long random string — used to sign the session cookie. Generate one with `openssl rand -hex 32` |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Defaults to `3001` |
| `SF_LOGIN_URL` | No | Pre-fill the login URL (e.g. `https://test.salesforce.com` for sandboxes) |
| `SF_CLIENT_ID` | No | Pre-fill the Client ID |
| `SF_CLIENT_SECRET` | No | Pre-fill the Client Secret |
| `SF_CALLBACK_URL` | No | Override the OAuth callback URL (default: `http://localhost:3001/auth/callback`) |

### Using an env file

Create a file called `.env.docker`:

```
SESSION_SECRET=your-random-string-here
NODE_ENV=production
```

Then run:

```bash
docker run -d -p 3001:3001 --env-file .env.docker --name sf-assessor \
  ghcr.io/sbilgram-lgtm/sf-tech-debt-assessor:latest
```

### Managing the container

```bash
# Stop
docker stop sf-assessor

# Start again
docker start sf-assessor

# Remove
docker stop sf-assessor && docker rm sf-assessor
```

### Updating to the latest image

```bash
docker stop sf-assessor && docker rm sf-assessor
docker pull ghcr.io/sbilgram-lgtm/sf-tech-debt-assessor:latest
docker run -d -p 3001:3001 --env-file .env.docker --name sf-assessor \
  ghcr.io/sbilgram-lgtm/sf-tech-debt-assessor:latest
```

### Docker troubleshooting

| Error | Fix |
|---|---|
| "no matching manifest for linux/arm64" | You're on an Apple Silicon Mac — follow the "Build locally" instructions above |
| "port is already allocated" | Port 3001 is in use. Stop the existing container or change `-p 3001:3001` to `-p 3002:3001` and open `http://localhost:3002` |
| "Authentication failed" | Confirm you created a Connected App (not External Client App) with `http://localhost:3001/auth/callback` |
| Container exits immediately | Check logs: `docker logs sf-assessor` |

---

## Running locally (development)

### Prerequisites
- Node.js 18+
- A Salesforce **Connected App** or **External Client App** (Spring '25+) with `http://localhost:3000/auth/callback` added to its Callback URL list

> **Both app types work locally.** PKCE is supported automatically — no need to disable it in your app setup.

### Fresh clone

```bash
git clone https://github.com/sbilgram-lgtm/sf-tech-debt-assessor
cd sf-tech-debt-assessor
npm install
npm run dev
```

### Already cloned — pull latest

```bash
cd sf-tech-debt-assessor
git pull origin main
npm install
npm run dev
```

Open **http://localhost:3000** in your browser. Enter your Org URL, Client ID, and Client Secret in the login form.

No `.env` file is required for local development.

---

## Deploying your own instance to Railway

The app is hosted on [Railway](https://railway.app) — always-on, no cold starts, free within the $5/month credit.

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Connect your GitHub repo
4. Railway auto-detects the Dockerfile — no build/start commands needed
5. Add environment variables (Settings → Variables → Raw Editor):
   ```
   NODE_ENV=production
   NPM_CONFIG_PRODUCTION=false
   SESSION_SECRET=your-random-string (generate with: openssl rand -hex 32)
   ```
6. Click **Deploy**
7. Once live, go to Settings → Networking → Generate Domain to get your URL
8. Add your Railway URL + `/auth/callback` to your Connected App's callback URLs
