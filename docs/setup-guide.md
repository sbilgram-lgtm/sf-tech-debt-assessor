# Salesforce Tech Debt Assessor — Setup Guide

This guide walks you through connecting the Salesforce Tech Debt Assessor to a customer's Salesforce org. The app is already deployed — you just need to create an OAuth app in the customer org.

---

## What You Need

- Access to the customer's org with System Administrator profile
- The app URL: **https://sf-tech-debt-assessor.onrender.com**

---

## Which Setup Path Should I Use?

Salesforce introduced **External Client Apps** in Spring '25 as the new way to configure OAuth in newer orgs. Use the table below to determine which path applies:

| Org Type | Setup Path |
|----------|-----------|
| Spring '25 or later (most new sandbox orgs) | [Option A — External Client App](#option-a--external-client-app-spring-25-and-later) |
| Older orgs / Classic Connected App | [Option B — Connected App (Classic)](#option-b--connected-app-classic) |

> **How to tell which you have:** Go to Setup and search for "External Client Apps". If the menu item appears, use Option A. If it doesn't exist, use Option B.

---

## Option A — External Client App (Spring '25 and later)

### Step 1 — Create the External Client App

1. Log in to the customer org as a System Administrator
2. Go to **Setup** → search for **External Client Apps** → click **New External Client App**
3. Fill in the following:

   **Basic Information**
   | Field | Value |
   |-------|-------|
   | External Client App Name | `SF Tech Debt Assessor` |
   | API Name | `SF_Tech_Debt_Assessor` |
   | Contact Email | your email address |
   | Distribution State | `Local` |

4. Click **Next**

### Step 2 — Configure OAuth

1. On the OAuth page, set the following:
   - **Callback URL:** `https://sf-tech-debt-assessor.onrender.com/auth/callback`
   - **OAuth Scopes:** Add both:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - **Require Proof Key for Code Exchange (PKCE):** Leave **unchecked** ⚠️ This must be OFF — if enabled, the app will fail with a `missing required code challenge` error
2. Click **Save**

> **Note:** Allow 2–10 minutes for the app to activate after saving.

### Step 3 — Get the Consumer Key and Secret

1. In External Client Apps, find your app and click **View**
2. Click **Manage Consumer Details** (may require re-authentication)
3. Copy the **Consumer Key** (Client ID) and **Consumer Secret** — you need both to log in

### Step 4 — Set Policies

1. In External Client Apps, find your app and click **Manage**
2. Click **Edit Policies**
3. Set **Permitted Users** to `All users may self-authorize`
4. Set **IP Relaxation** to `Relax IP restrictions`
5. Click **Save**

---

## Option B — Connected App (Classic)

### Step 1 — Create the Connected App

1. Log in to the customer org as a System Administrator
2. Go to **Setup** → search for **App Manager** → click **New Connected App**
3. Fill in the following:

   **Basic Information**
   | Field | Value |
   |-------|-------|
   | Connected App Name | `SF Tech Debt Assessor` |
   | API Name | `SF_Tech_Debt_Assessor` |
   | Contact Email | your email address |

   **API (Enable OAuth Settings)**
   - Check **Enable OAuth Settings**
   - **Callback URL:** `https://sf-tech-debt-assessor.onrender.com/auth/callback`
   - **Selected OAuth Scopes:** Add both:
     - `Access and manage your data (api)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`
   - **Require Proof Key for Code Exchange (PKCE):** Leave **unchecked** ⚠️ This must be OFF — if enabled, the app will fail with a `missing required code challenge` error

4. Click **Save** → Click **Continue**

> **Note:** Allow 2–10 minutes for the Connected App to activate after saving.

### Step 2 — Get the Consumer Key and Secret

1. In App Manager, find your Connected App and click **View**
2. Click **Manage Consumer Details** (may require re-authentication)
3. Copy the **Consumer Key** (Client ID) and **Consumer Secret**

### Step 3 — Set OAuth Policies

1. In App Manager, find your Connected App and click **Manage**
2. Click **Edit Policies**
3. Set **Permitted Users** to `All users may self-authorize`
4. Set **IP Relaxation** to `Relax IP restrictions`
5. Click **Save**

---

## Running the Assessment (Both Paths)

1. Open **https://sf-tech-debt-assessor.onrender.com** in your browser
2. Enter the following:

   | Field | Value |
   |-------|-------|
   | Org / Sandbox URL | The customer's My Domain URL — see format guide below |
   | Client ID (Consumer Key) | Copied from your app setup |
   | Client Secret (Consumer Secret) | Copied from your app setup |

3. Click **Connect to Salesforce**
4. Log in with your Salesforce credentials
5. Click **Allow** when prompted
6. Click **Run Assessment** on the dashboard
7. Click **Export PDF** to generate the report

---

## Org URL Format Reference

| Environment | URL Format |
|-------------|-----------|
| Sandbox | `https://companyname--sandboxname.sandbox.my.salesforce.com` |
| Developer Edition | `https://companyname.develop.my.salesforce.com` |
| Production | `https://companyname.my.salesforce.com` |

> **Tip:** Find the correct URL in the browser address bar when logged into the org. Use the domain ending in `.salesforce.com` — not `.salesforce-setup.com`.

---

## Assessment Categories

| Category | What It Checks |
|----------|---------------|
| Configuration | Workflow Rules, Process Builders, automation overlap, validation rules |
| Code Quality | SOQL in loops, hardcoded IDs, trigger patterns, outdated API versions |
| Data Model | Object/field descriptions, field sprawl, object count |
| Service Cloud | Record types, queues, assignment and escalation rules |
| Sharing & Security | OWD, MFA enrollment, stale users, Password Never Expires, guest sites, Security Health Check |
| Integrations | Named Credentials, hardcoded endpoints, remote site SSL |
| Test Coverage | Zero-coverage classes, below-75% components, test class ratio |
| Org Limits | All org limits — flags anything ≥50% consumed |

---

## Required Permissions

A **System Administrator** profile will work for all checks. If using a non-admin user, they need at minimum:

- API Enabled
- View Setup and Configuration
- Modify Metadata Through Metadata API Functions

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `error=missing required code challenge` | PKCE is enabled on your app — go to Setup → External Client Apps (or App Manager for classic) → find your app → Edit → uncheck **Require Proof Key for Code Exchange (PKCE)** → Save. Wait 5 minutes then retry. |
| Redirected back to login with no error | Wait 5–10 minutes for the app to activate, then try again |
| `error=invalid_client` | Copy the Consumer Key and Secret fresh from Manage Consumer Details |
| `error=redirect_uri_mismatch` | Verify the Callback URL is exactly `https://sf-tech-debt-assessor.onrender.com/auth/callback` |
| Can't find "External Client Apps" in Setup | Your org uses the classic path — follow Option B instead |
| Dashboard loads but categories show errors | The logged-in user lacks API access or View Setup and Configuration permission |
| App takes 30+ seconds to load | Render free tier spins down after inactivity — first load may be slow, subsequent loads are fast |

---

## Security Notes

- The app never stores Consumer Keys, Secrets, or access tokens permanently — held only in a server-side session that expires after 1 hour
- The app is **read-only** — it queries org data but makes no changes
- Each session is isolated — credentials entered by one user are not accessible to others

---

*App built by Steven Bilgram — sbilgram-lgtm/sf-tech-debt-assessor*
