# Salesforce Tech Debt Assessor
*By Steven Bilgram*

A web app that connects to any Salesforce org and produces a scored technical debt report across 8 categories: Configuration, Code Quality, Data Model, Service Cloud, Sharing & Security, Integrations, Test Coverage, and Org Limits.

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
6. Click **Save** — wait ~10 minutes for Salesforce to activate it
7. Go back to the External Client App → **View Consumer Details** to retrieve:
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
6. Click **Save** — wait ~10 minutes for Salesforce to activate the Connected App
7. Go back to the Connected App and click **Manage Consumer Details** to retrieve:
   - **Consumer Key** → this is your Client ID
   - **Consumer Secret** → this is your Client Secret

### Permissions required

The user who authenticates must have:
- **API Enabled** on their profile
- **View Setup and Configuration**
- **Modify Metadata Through Metadata API Functions** (for full results)
- System Administrator profile gives all of the above

---

## Running an assessment

1. Open **https://sf-tech-debt-assessor.onrender.com**
2. Enter:
   - **Sandbox / Org URL** — your org's My Domain URL, e.g. `https://mycompany--uat.sandbox.my.salesforce.com`
   - **Client ID** — Consumer Key from the Connected App
   - **Client Secret** — Consumer Secret from the Connected App
3. Click **Connect to Salesforce** and authenticate
4. Click **Run Assessment**
5. Export results as PDF when done

---

## Assessment categories

| Category | What it checks |
|---|---|
| **Configuration** | Workflow Rules, Process Builders, automation overlap, validation rules |
| **Code Quality** | SOQL in loops, hardcoded IDs, trigger patterns, outdated API versions |
| **Data Model** | Object/field descriptions, field sprawl, object count |
| **Service Cloud** | Record types, queues, assignment/escalation rules |
| **Sharing & Security** | OWD, MFA enrollment, stale users, Password Never Expires, guest sites, Security Health Check, OAuth tokens |
| **Integrations** | Named Credentials usage, hardcoded endpoints, remote site SSL, connected apps |
| **Test Coverage** | Zero-coverage classes, below-75% components, test class ratio |
| **Org Limits** | All org limits — flags anything ≥50% consumed |

---

## Running locally (development)

### Prerequisites
- Node.js 18+
- A Salesforce Connected App with callback URL `http://localhost:3000/auth/callback`

### Steps

```bash
git clone https://github.com/sbilgram-lgtm/sf-tech-debt-assessor
cd sf-tech-debt-assessor
npm install
cd server && npm install && cd ..
npm run dev
```

Open http://localhost:3000

For local development you can optionally create a `.env` file to pre-fill credentials:

```
SF_LOGIN_URL=https://yourorg.sandbox.my.salesforce.com
SF_CLIENT_ID=your_consumer_key
SF_CLIENT_SECRET=your_consumer_secret
SF_CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=any-random-string
```

---

## Deploying your own instance to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect your GitHub repo
4. Set:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server/index.js`
5. Add environment variables:
   - `NODE_ENV` = `production`
   - `SESSION_SECRET` = any long random string (e.g. output of `openssl rand -hex 32`)
6. Click **Deploy**
7. Once live, update your Connected App callback URL to your Render URL + `/auth/callback`
