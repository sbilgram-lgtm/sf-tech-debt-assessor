import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'sf_tda_credentials';

type Severity = 'critical' | 'high' | 'medium' | 'low';

interface CheckItem {
  title: string;
  severity: Severity;
}

const CATEGORY_CHECKS: Record<string, CheckItem[]> = {
  'Configuration': [
    { title: 'Active Workflow Rules', severity: 'high' },
    { title: 'Active Process Builders', severity: 'high' },
    { title: 'Objects with Overlapping Automation', severity: 'medium' },
    { title: 'Active Validation Rules (>50)', severity: 'medium' },
    { title: 'Validation Rules Without Descriptions', severity: 'low' },
    { title: 'Classic Approval Processes Still Active', severity: 'medium' },
    { title: 'Flows Using Legacy Einstein for Flow Actions', severity: 'low' },
    { title: 'Web-to-Case Enabled Without CAPTCHA', severity: 'high' },
    { title: 'Active Case Auto-Response Rules', severity: 'low' },
    { title: 's-Controls Still Active — Deprecated Technology', severity: 'critical' },
    { title: "Active PushTopics — Deprecated Summer '26", severity: 'high' },
    { title: 'Pending Time-Based Workflow Actions in Queue', severity: 'medium' },
    { title: 'No Login Flows Configured', severity: 'low' },
  ],
  'Code Quality': [
    { title: 'Triggers with Business Logic', severity: 'high' },
    { title: 'Classes/Triggers Below 75% Coverage', severity: 'high' },
    { title: 'Components on Outdated API Versions', severity: 'medium' },
    { title: 'Classes with SOQL in Loops', severity: 'critical' },
    { title: 'Classes with Hardcoded IDs', severity: 'high' },
    { title: 'Classes with Empty catch Blocks', severity: 'high' },
    { title: 'Classes with DML Operations in Loops', severity: 'critical' },
    { title: 'Classes Use Schema.getGlobalDescribe()', severity: 'medium' },
    { title: 'Apex Classes Without a Sharing Declaration', severity: 'high' },
    { title: 'Classes Use System.setPassword()', severity: 'critical' },
    { title: 'Classes Access UserInfo.getSessionId()', severity: 'high' },
    { title: 'SOQL Queries Without FLS Enforcement', severity: 'medium' },
    { title: 'Apex Classes May Use Legacy SOAP login()', severity: 'medium' },
    { title: 'Apex Classes Reference Hardcoded Login URLs', severity: 'high' },
    { title: 'Classes May Have SOQL Injection Vulnerabilities', severity: 'critical' },
    { title: '@future(callout=true) Methods Also Perform DML', severity: 'medium' },
    { title: 'Classes Use Weak Cryptographic Algorithms (MD5/SHA-1)', severity: 'high' },
    { title: 'Test Classes Use @IsTest(SeeAllData=true)', severity: 'high' },
    { title: 'Test Classes Have No Assert Statements', severity: 'high' },
    { title: 'Test Classes Missing Test.startTest() / Test.stopTest()', severity: 'medium' },
    { title: 'Test Classes Insert Data Without @TestSetup', severity: 'low' },
    { title: 'Apex Classes Use global Access Modifier', severity: 'high' },
    { title: 'Queueable Classes Without a Finalizer', severity: 'medium' },
    { title: 'Apex Classes Use @future Annotation', severity: 'medium' },
    { title: 'DML Operations in Apex Constructors', severity: 'high' },
    { title: 'addError() Called with escape=false (XSS Risk)', severity: 'high' },
    { title: 'Insecure HTTP Callout Endpoints', severity: 'high' },
    { title: 'System.debug Statements in Production Code', severity: 'medium' },
    { title: 'SOQL Queries Without WHERE or LIMIT', severity: 'high' },
  ],
  'Data Model': [
    { title: 'Custom Objects Without Descriptions', severity: 'low' },
    { title: 'Custom Fields Lack Descriptions (>50%)', severity: 'medium' },
    { title: 'Objects with 100+ Custom Fields', severity: 'high' },
    { title: 'Custom Object Count (>200)', severity: 'medium' },
  ],
  'Service Cloud': [
    { title: 'Excessive Case Record Types (>10)', severity: 'medium' },
    { title: 'Inactive Case Record Types', severity: 'low' },
    { title: 'Excessive Queues Configured (>50)', severity: 'medium' },
    { title: 'Case Assignment Rules — Legacy', severity: 'medium' },
    { title: 'Escalation Rules — Legacy', severity: 'low' },
    { title: 'Unverified Organization-Wide Email Addresses', severity: 'high' },
    { title: 'No Omni-Channel Service Channels Configured', severity: 'medium' },
    { title: 'Routing Configurations Use Legacy Tab-Based Capacity', severity: 'critical' },
    { title: 'Routing Configurations Have No Push Timeout', severity: 'high' },
    { title: 'No Skills-Based Routing — Availability-Only', severity: 'medium' },
    { title: 'Presence Configurations Have No Capacity Limit', severity: 'high' },
    { title: 'No Presence Configurations Defined', severity: 'medium' },
    { title: 'Knowledge Enabled but No Published Articles', severity: 'medium' },
    { title: 'Draft Knowledge Articles Stalled 180+ Days', severity: 'medium' },
    { title: 'Published Articles Not Updated in 12+ Months', severity: 'high' },
    { title: 'No Data Category Groups Configured', severity: 'high' },
    { title: 'Published Articles Have No Data Category', severity: 'high' },
    { title: 'Published Articles Have No Validation Status', severity: 'medium' },
    { title: 'Entitlement Processes Have No Business Hours', severity: 'critical' },
    { title: 'Entitlement Processes Have No Milestone Actions', severity: 'critical' },
    { title: 'Open Cases With Entitlement but No SLA Start Date', severity: 'high' },
    { title: 'Service Contracts Have No Linked Entitlements', severity: 'high' },
    { title: 'Email-to-Case Routing Addresses Without TLS', severity: 'critical' },
    { title: 'Email-to-Case Routing Addresses Have No Default Owner', severity: 'high' },
    { title: 'Inbound Emails Creating New Cases Instead of Threading', severity: 'high' },
    { title: 'Email Service Addresses Accept Emails from Any Sender', severity: 'medium' },
    { title: 'Live Chat Buttons Not Routed Through Omni-Channel', severity: 'critical' },
    { title: 'Active Legacy Live Agent Deployments Without Embedded Service', severity: 'critical' },
    { title: 'Legacy Live Chat Active but MIAW Not Adopted', severity: 'high' },
    { title: 'Live Chat Buttons Point to Empty or Deleted Queues', severity: 'high' },
    { title: 'No Lightning Service Console App Configured', severity: 'critical' },
    { title: 'No Active Macros Configured', severity: 'high' },
    { title: 'No Einstein Next Best Action Strategies', severity: 'high' },
    { title: 'Call Center Configured but No Softphone Layout', severity: 'medium' },
    { title: 'Messaging Channels Without OPTOUT Keyword (TCPA/GDPR)', severity: 'high' },
    { title: 'Open Cases With Active SLA Milestone Violations', severity: 'critical' },
    { title: 'Open Escalated Cases With No Activity in 3+ Days', severity: 'critical' },
    { title: 'Open Cases Not Modified in 7+ Days', severity: 'high' },
    { title: 'High Zero-Touch Case Close Rate (No Activity Documented)', severity: 'high' },
    { title: 'Entitlements Past End Date Still Marked Active', severity: 'high' },
    { title: 'Open Cases Linked to Expired Entitlements', severity: 'critical' },
    { title: 'No Active Quick Texts Configured', severity: 'medium' },
    { title: 'Quick Texts Not Updated in 12+ Months', severity: 'low' },
    { title: 'Callback Requests Unresolved After 24+ Hours', severity: 'high' },
    { title: 'Messaging Sessions With No Agent Response', severity: 'high' },
    { title: 'Completed Chat Transcripts With No Linked Case', severity: 'medium' },
    { title: 'Inbound Social Posts With No Linked Case', severity: 'high' },
    { title: 'No Case Team Templates Configured', severity: 'low' },
    { title: 'Active Entitlements Never Linked to Any Case', severity: 'medium' },
    { title: 'Cases Linked to Multiple Entitlements', severity: 'medium' },
    { title: 'Business Hours Records With No Holiday Exceptions', severity: 'medium' },
    { title: 'Entitlement Milestones With 5-Minute or Less Target Time', severity: 'high' },
    { title: 'Entitlement Processes With Duplicate Milestone Target Times', severity: 'high' },
    { title: 'Articles Visible in Legacy Self-Service Portal Channel', severity: 'low' },
    { title: 'Knowledge Search Not Optimised (No Promoted Terms/Synonyms)', severity: 'medium' },
    { title: 'Duplicate Published Article Titles', severity: 'medium' },
    { title: 'Published Articles Have No Summary', severity: 'low' },
    { title: 'No Knowledge Articles Attached to Any Case', severity: 'medium' },
    { title: 'Open Cases With No Contact and No Account', severity: 'high' },
    { title: 'Open Cases With No Priority Set', severity: 'medium' },
    { title: 'Open Cases With No Origin (Unknown Channel)', severity: 'medium' },
    { title: 'Open Cases Older Than 90 Days', severity: 'high' },
    { title: 'Open Cases With No Description', severity: 'low' },
    { title: 'Open Cases Owned by Individual Users (Not Queues)', severity: 'medium' },
    { title: 'Open Incidents With No Related Items', severity: 'medium' },
    { title: 'Open Swarms With No Activity in 14+ Days', severity: 'low' },
    { title: 'Open Work Orders With No Case and No Asset', severity: 'medium' },
    { title: 'Active CSAT Surveys With No Survey Responses', severity: 'medium' },
    { title: 'Completed Voice Calls With No Linked Case', severity: 'high' },
  ],
  'Sharing & Security': [
    { title: 'Objects with Public Read/Write OWD', severity: 'critical' },
    { title: 'Objects with Public Read Only OWD (>5)', severity: 'medium' },
    { title: 'Too Many Profiles Configured (>20)', severity: 'medium' },
    { title: 'Permission Sets Without Descriptions', severity: 'low' },
    { title: 'Excessive Sharing Rules (>50)', severity: 'high' },
    { title: 'Active Users with Modify All Data', severity: 'critical' },
    { title: 'Active Users Inactive for 90+ Days', severity: 'high' },
    { title: 'Integration/API Users Without IP Restrictions', severity: 'high' },
    { title: 'Standard Profiles Without Login IP Restrictions', severity: 'medium' },
    { title: 'Active Users Not Enrolled in MFA', severity: 'critical' },
    { title: 'Security Health Check Score Below Threshold', severity: 'critical' },
    { title: 'Active OAuth Access Tokens (>100)', severity: 'medium' },
    { title: 'Users with Standard-Assurance Sessions (No MFA Step-Up)', severity: 'medium' },
    { title: 'Users with Passwords That Never Expire', severity: 'high' },
    { title: 'Active Sites with Guest User Access', severity: 'high' },
    { title: 'Permission Sets Grant Privileged Access — Phishing-Resistant MFA Required', severity: 'high' },
    { title: 'Async Sharing Recalculation Release Update Not Activated', severity: 'medium' },
    { title: 'Guest Profiles with Case Read Access — Unauthenticated Data Exposure', severity: 'critical' },
    { title: 'Active Outbound Messages — Session IDs Retired February 2026', severity: 'high' },
    { title: 'Permission Set Groups Not in Use', severity: 'medium' },
    { title: 'Users Assigned 10+ Custom Permission Sets', severity: 'medium' },
    { title: 'Cloned System Administrator Profiles Detected', severity: 'critical' },
    { title: 'No Transaction Security Policies Configured', severity: 'low' },
    { title: 'Excessive Active Users (stale account risk)', severity: 'medium' },
  ],
  'Integrations': [
    { title: 'Remote Sites with Protocol Security Disabled', severity: 'critical' },
    { title: 'Inactive Remote Site Settings', severity: 'low' },
    { title: 'Connected Apps Without Descriptions', severity: 'low' },
    { title: 'Classes with Hardcoded HTTP Endpoints', severity: 'high' },
    { title: 'Named Credentials Using Per-User Auth', severity: 'medium' },
    { title: "Apex Classes on Retired API Versions (≤v30)", severity: 'critical' },
    { title: "Active PushTopics — Streaming API Deprecated Summer '26", severity: 'high' },
    { title: 'No External Credentials Configured', severity: 'medium' },
    { title: 'No Dedicated Integration User Profiles Found', severity: 'medium' },
  ],
  'Test Coverage': [
    { title: 'Low Test Class Ratio (<30%)', severity: 'high' },
    { title: 'Classes/Triggers with No Test Coverage', severity: 'critical' },
    { title: 'Components Below 75% Test Coverage', severity: 'high' },
    { title: 'Triggers Without a Dedicated Test Class', severity: 'medium' },
  ],
  'Org Limits': [
    { title: 'Org Limit ≥90% Consumed', severity: 'critical' },
    { title: 'Org Limit 75–89% Consumed', severity: 'high' },
    { title: 'Org Limit 50–74% Consumed', severity: 'medium' },
    { title: 'Active Apex Classes Approaching Org Limit', severity: 'high' },
    { title: 'Custom Objects Approaching Org Limit', severity: 'high' },
  ],
  'Duplicate Rules': [
    { title: 'No Duplicate Rules Configured', severity: 'high' },
    { title: 'Inactive Duplicate Rules', severity: 'medium' },
    { title: 'No Matching Rules Configured', severity: 'high' },
    { title: 'Duplicate Rules Without Descriptions', severity: 'low' },
  ],
  'Reports & Dashboards': [
    { title: 'Reports Not Run in 6+ Months (>50)', severity: 'medium' },
    { title: 'Dashboards Not Viewed in 6+ Months (>20)', severity: 'medium' },
    { title: 'Total Reports in Org (>2,000)', severity: 'medium' },
  ],
  'Email Templates': [
    { title: 'Classic (Non-Lightning) Email Templates', severity: 'medium' },
    { title: 'Email Templates Not Modified in 2+ Years', severity: 'low' },
    { title: 'No Email Templates Found', severity: 'low' },
  ],
  'Platform Events': [
    { title: 'Platform Event Channels with No Active Subscribers', severity: 'high' },
    { title: 'Change Data Capture Entities Enabled (>20)', severity: 'medium' },
    { title: 'No Platform Events or CDC Configured', severity: 'low' },
  ],
  'Managed Packages': [
    { title: 'Managed Packages Installed (>20)', severity: 'medium' },
    { title: 'Beta Managed Packages Installed in Org', severity: 'high' },
    { title: 'Managed Packages — Review for Currency', severity: 'low' },
  ],
  'Custom Metadata': [
    { title: 'Custom Settings in Use — Legacy Configuration Pattern', severity: 'medium' },
    { title: 'Custom Settings Without Descriptions', severity: 'low' },
    { title: 'No Custom Metadata Types Found', severity: 'medium' },
  ],
  'Record Types & Layouts': [
    { title: 'Inactive Record Types', severity: 'medium' },
    { title: 'Custom Record Types Across Org (>100)', severity: 'medium' },
    { title: 'Record Types Without Descriptions (>10)', severity: 'low' },
    { title: 'Page Layouts Configured (>100)', severity: 'medium' },
  ],
  'Einstein & AI': [
    { title: 'Einstein Generative AI / Agentforce Not Enabled', severity: 'low' },
    { title: 'Einstein Enabled but No Prompt Templates Configured', severity: 'medium' },
    { title: 'Inactive Bot/Agent Definitions', severity: 'medium' },
    { title: 'Einstein/Agentforce Enabled but No Implementation Found', severity: 'low' },
    { title: 'Einstein AI Applications Exist but None Are Active', severity: 'medium' },
    { title: 'Einstein Case Classification — Insufficient Training Data', severity: 'high' },
    { title: 'Agentforce Bots Exist but No Agent Topics Configured', severity: 'high' },
    { title: 'Agentforce Topics Configured but No Agent Actions Defined', severity: 'high' },
    { title: 'Agentforce Active but Data Cloud Not Connected', severity: 'medium' },
  ],
  'Experience Cloud': [
    { title: 'Experience Sites Using Legacy Template (Aura/Visualforce)', severity: 'high' },
    { title: 'Inactive/Draft Experience Cloud Sites', severity: 'low' },
    { title: 'Sites with Self-Registration Enabled', severity: 'medium' },
    { title: 'Active Sites with Guest User Access', severity: 'medium' },
    { title: 'Active Sites Without a Custom Domain', severity: 'low' },
    { title: 'Active Sites — Review for Governance (>5)', severity: 'medium' },
    { title: 'Live Sites Without CDN Enabled', severity: 'low' },
    { title: 'Custom Domains Without HTTPS Enforced', severity: 'high' },
    { title: "WCAG 2.2 Accessibility Release Updates Not Enabled", severity: 'medium' },
    { title: 'Active Sites with Clickjack Protection Disabled (AllowAll)', severity: 'critical' },
    { title: 'Live Sites with Browser XSS Protection Disabled', severity: 'medium' },
    { title: 'Live Sites with Content Sniffing Protection Disabled', severity: 'medium' },
  ],
  'Connected App Security': [
    { title: 'Connected Apps Without Session Timeout', severity: 'high' },
    { title: 'Connected Apps Without Descriptions', severity: 'medium' },
    { title: 'Connected Apps with 20+ Active OAuth Tokens', severity: 'medium' },
    { title: 'Stale OAuth Tokens Not Used in 90+ Days', severity: 'high' },
    { title: 'Duplicate Connected App Names Detected', severity: 'medium' },
    { title: 'Total Connected Apps in Org (>30)', severity: 'low' },
    { title: 'Active Outbound Messages — Session ID Auth Retired Feb 2026', severity: 'high' },
    { title: 'Certificates Exceed 200-Day Maximum Lifespan', severity: 'medium' },
    { title: 'CTI / Telephony Connected Apps Without Session Timeout', severity: 'medium' },
    { title: "Traditional Connected Apps — External Client Apps Are Spring '26 Standard", severity: 'medium' },
    { title: 'OAuth Tokens Belonging to Deactivated Users', severity: 'high' },
    { title: 'Connected Apps Bypassing IP Login Restrictions', severity: 'medium' },
  ],
  'LWC & Components': [
    { title: 'LWC Bundles Without Descriptions', severity: 'low' },
    { title: 'LWC Bundles on Outdated API Versions (< v57)', severity: 'medium' },
    { title: 'LWC Bundles on Retired API Versions (≤ v30)', severity: 'critical' },
    { title: 'Aura Components vs LWC — Migration Debt', severity: 'medium' },
    { title: 'Aura Components with Custom RENDERER', severity: 'medium' },
    { title: 'Aura Application/Component Events Defined (>5)', severity: 'low' },
    { title: 'LWC Bundles Without Jest Test Files', severity: 'medium' },
    { title: 'Components Not Modified in 2+ Years', severity: 'low' },
    { title: 'Managed Package LWC Components Modified', severity: 'medium' },
    { title: 'LWC Components Contain debugger Statements', severity: 'critical' },
    { title: 'LWC Components Use .innerHTML (XSS Risk)', severity: 'high' },
    { title: 'LWC Components Query the Document Directly', severity: 'high' },
    { title: 'LWC Components Add Event Listeners Without Removing Them', severity: 'medium' },
    { title: 'LWC Components Use Async Timer Operations', severity: 'medium' },
    { title: 'LWC Components Use async/await', severity: 'medium' },
    { title: 'LWC Components Reference Browser Globals (SSR Incompatible)', severity: 'medium' },
    { title: 'LWC Components Use for...of Loops', severity: 'low' },
    { title: 'LWC Components Use Rest Parameters', severity: 'low' },
    { title: 'LWC Components Reference process.env.NODE_ENV', severity: 'low' },
    { title: 'LWC Components Have Duplicate Import Statements', severity: 'low' },
    { title: 'LWC Components Use eval()', severity: 'critical' },
    { title: 'LWC Components Contain console Statements', severity: 'medium' },
    { title: 'LWC Components Use Deprecated @track Decorator', severity: 'low' },
    { title: 'LWC Components Use JSON.parse(JSON.stringify()) for Cloning', severity: 'medium' },
    { title: 'LWC Components Mutate Inline Styles via JavaScript', severity: 'low' },
    { title: 'LWC Components Exceed 500 Lines of JavaScript', severity: 'medium' },
    { title: 'LWC Components Use Deprecated if:true / if:false Directives', severity: 'medium' },
    { title: 'LWC Components Use for:each Without a key Attribute', severity: 'high' },
    { title: 'LWC Components Use Inline style= Attributes in Templates', severity: 'low' },
    { title: 'LWC Components Fire Events with bubbles:true AND composed:true', severity: 'high' },
    { title: 'LWC Components Override SLDS Classes with Hardcoded Colors', severity: 'medium' },
    { title: 'Lightning Pages Not Modified in 2+ Years', severity: 'low' },
    { title: 'Lightning Pages — Governance Review Recommended (>50)', severity: 'low' },
    { title: 'Objects with 4+ Lightning Record Pages', severity: 'low' },
    { title: 'Visualforce Pages in Org — Legacy UI Technology', severity: 'medium' },
    { title: 'Visualforce Pages on Old API Versions (< v50)', severity: 'high' },
    { title: 'Visualforce Pages Without Descriptions', severity: 'low' },
    { title: 'Visualforce Pages Enabled for Salesforce Mobile — Poor UX', severity: 'medium' },
  ],
  'OmniStudio': [
    { title: 'Inactive OmniScripts', severity: 'medium' },
    { title: 'OmniScripts Without Descriptions', severity: 'low' },
    { title: 'OmniScripts Not Modified in 2+ Years', severity: 'low' },
    { title: 'OmniScript Types with Multiple Active Versions', severity: 'high' },
    { title: 'Active OmniScripts in Test Mode', severity: 'critical' },
    { title: 'Active Integration Procedures in Test Mode', severity: 'critical' },
    { title: 'Active OmniScripts Without LWC Compilation', severity: 'medium' },
    { title: 'Inactive Integration Procedures', severity: 'medium' },
    { title: 'Integration Procedures Without Descriptions', severity: 'low' },
    { title: 'Integration Procedures Not Modified in 2+ Years', severity: 'low' },
    { title: 'Inactive DataRaptors / Data Transforms', severity: 'medium' },
    { title: 'DataRaptors / Data Transforms Without Descriptions', severity: 'low' },
    { title: 'DataRaptors / Data Transforms Not Modified in 2+ Years', severity: 'low' },
    { title: 'Extract DataRaptors Without Turbo Extract', severity: 'medium' },
    { title: 'Inactive FlexCards', severity: 'low' },
    { title: 'FlexCards Not Modified in 2+ Years', severity: 'low' },
    { title: 'FlexCards Without Descriptions', severity: 'low' },
    { title: 'OmniStudio Managed Package Version Outdated', severity: 'medium' },
    { title: 'DataRaptors / Data Transforms — High Volume (>100)', severity: 'medium' },
    { title: 'Active OmniScripts Still Using Aura Runtime (LWC Disabled)', severity: 'high' },
    { title: 'Active Integration Procedures With No Error-Handling Element', severity: 'high' },
    { title: 'Standard Extract DataRaptors — No Turbo Extract in Use', severity: 'medium' },
    { title: 'Standard Extract DataRaptors vs Turbo Extract — Consider More Turbo', severity: 'low' },
    { title: 'OmniScripts With Spaces in Type or SubType (Naming Convention)', severity: 'low' },
    { title: 'Active OmniScripts Using Deprecated Remote Action Elements', severity: 'high' },
    { title: 'Legacy Knowledge Article Types Still in Schema', severity: 'high' },
  ],
  'Performance': [
    { title: 'Apex Classes Over 1,000 Lines', severity: 'medium' },
    { title: 'Objects with Multiple Active Triggers', severity: 'high' },
    { title: 'Batch Apex Jobs Running Concurrently (>3)', severity: 'high' },
    { title: 'Active Debug Trace Flags', severity: 'high' },
    { title: 'Async Apex Jobs Queued (>50)', severity: 'high' },
    { title: 'Future/Queueable Jobs Pending (>20)', severity: 'medium' },
    { title: 'Async Apex Failures in the Last 30 Days (High)', severity: 'high' },
    { title: 'Async Apex Failures in the Last 30 Days (Low)', severity: 'medium' },
    { title: 'Scheduled Apex Jobs Waiting (>20)', severity: 'medium' },
    { title: 'Active Scheduled Flows (>10)', severity: 'medium' },
    { title: 'Objects with 4+ Record-Triggered Flows', severity: 'medium' },
    { title: 'Platform Cache Not Configured', severity: 'low' },
    { title: 'Custom Objects with 300+ Fields', severity: 'medium' },
    { title: 'Aura Component Bundles Still Deployed (>50)', severity: 'low' },
    { title: 'Objects with 6+ Lightning Pages', severity: 'low' },
    { title: 'Event Monitoring Not Producing Logs (Last 7 Days)', severity: 'low' },
    { title: 'Async Jobs Stuck in Processing 24+ Hours', severity: 'high' },
    { title: 'Total Active Flows Exceeds 300', severity: 'medium' },
    { title: 'Obsolete Flow Versions Exceeds 200', severity: 'low' },
    { title: 'Apex Classes Exceed 5,000 Lines', severity: 'high' },
    { title: 'Active Flows with DML Elements Inside Loops', severity: 'high' },
  ],
  'Notes & Attachments': [
    { title: 'Legacy Note Records Found', severity: 'high' },
    { title: 'Legacy Attachment Records Found', severity: 'high' },
    { title: 'Enhanced Notes Not Enabled', severity: 'medium' },
    { title: 'Orphaned ContentDocument Records', severity: 'medium' },
    { title: 'Files Larger Than 25 MB', severity: 'medium' },
    { title: 'Files With No Title', severity: 'low' },
    { title: 'Files Shared Externally via Content Delivery', severity: 'high' },
    { title: 'No Salesforce Content Libraries Configured', severity: 'low' },
    { title: 'Files Permanently Shared Externally (No Expiry)', severity: 'high' },
    { title: 'Objects with 10,000+ File Attachments', severity: 'medium' },
    { title: 'Files Not Viewed in 2+ Years', severity: 'low' },
    { title: 'File Distribution Across Objects', severity: 'low' },
  ],
};

// Group colors: accent for left border on category cards
const GROUP_COLORS: Record<string, string> = {
  'Security & Access':          '#e74c3c', // red
  'Code & Development':         '#8e44ad', // purple
  'Performance & Limits':       '#d35400', // orange
  'Configuration & Architecture':'#2980b9', // blue
  'CRM & Service':              '#27ae60', // green
  'Governance & Hygiene':       '#7f8c8d', // grey
};

const CATEGORIES = [
  // ── Security & Access ──────────────────────────────────────────
  { icon: '🔒',  name: 'Sharing & Security',      checks: 24, group: 'Security & Access' },
  { icon: '🛡️',  name: 'Connected App Security',  checks: 12, group: 'Security & Access' },
  { icon: '🌐',  name: 'Experience Cloud',        checks: 12, group: 'Security & Access' },
  // ── Code & Development ─────────────────────────────────────────
  { icon: '💻',  name: 'Code Quality',            checks: 29, group: 'Code & Development' },
  { icon: '🧪',  name: 'Test Coverage',           checks: 4,  group: 'Code & Development' },
  { icon: '⚡',  name: 'LWC & Components',        checks: 39, group: 'Code & Development' },
  { icon: '🎨',  name: 'OmniStudio',             checks: 26, group: 'Code & Development' },
  // ── Performance & Limits ───────────────────────────────────────
  { icon: '🚀',  name: 'Performance',             checks: 21, group: 'Performance & Limits' },
  { icon: '📊',  name: 'Org Limits',              checks: 5,  group: 'Performance & Limits' },
  { icon: '⚡',  name: 'Platform Events',         checks: 3,  group: 'Performance & Limits' },
  // ── Configuration & Architecture ──────────────────────────────
  { icon: '⚙️',  name: 'Configuration',          checks: 13, group: 'Configuration & Architecture' },
  { icon: '🗄️',  name: 'Data Model',              checks: 4,  group: 'Configuration & Architecture' },
  { icon: '📋',  name: 'Record Types & Layouts',  checks: 4,  group: 'Configuration & Architecture' },
  { icon: '🔧',  name: 'Custom Metadata',         checks: 3,  group: 'Configuration & Architecture' },
  { icon: '🔁',  name: 'Duplicate Rules',         checks: 4,  group: 'Configuration & Architecture' },
  { icon: '🔌',  name: 'Integrations',            checks: 9,  group: 'Configuration & Architecture' },
  // ── CRM & Service ──────────────────────────────────────────────
  { icon: '🎧',  name: 'Service Cloud',           checks: 69, group: 'CRM & Service' },
  { icon: '🤖',  name: 'Einstein & AI',           checks: 9,  group: 'CRM & Service' },
  { icon: '📦',  name: 'Managed Packages',        checks: 3,  group: 'CRM & Service' },
  // ── Governance & Hygiene ───────────────────────────────────────
  { icon: '📈',  name: 'Reports & Dashboards',    checks: 3,  group: 'Governance & Hygiene' },
  { icon: '📧',  name: 'Email Templates',         checks: 3,  group: 'Governance & Hygiene' },
  { icon: '📎',  name: 'Notes & Attachments',     checks: 12, group: 'Governance & Hygiene' },
];

const TOTAL_CHECKS = CATEGORIES.reduce((sum, c) => sum + c.checks, 0);

const SEVERITY_COLORS: Record<Severity, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fde8e8', color: '#c0392b', label: 'Critical' },
  high:     { bg: '#fef3e2', color: '#d35400', label: 'High' },
  medium:   { bg: '#fef9e7', color: '#b8860b', label: 'Medium' },
  low:      { bg: '#e8f8f0', color: '#27ae60', label: 'Low' },
};

export const LoginPage: React.FC = () => {
  const [loginUrl, setLoginUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'auth_failed') {
      setError('Authentication failed. Check your Client ID, Client Secret, and Callback URL in your Connected App.');
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { loginUrl: u, clientId: id, clientSecret: s } = JSON.parse(saved);
        if (u) setLoginUrl(u);
        if (id) setClientId(id);
        if (s) setClientSecret(s);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSelectedCategory(null); setShowSetupGuide(false); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedCategory, showSetupGuide]);

  const handleLogin = () => {
    if (!loginUrl.trim() || !clientId.trim() || !clientSecret.trim()) {
      setError('All three fields are required.');
      return;
    }
    let url = loginUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/$/, '');

    if (remember) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() }));
      } catch {}
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    const params = new URLSearchParams({ loginUrl: url, clientId: clientId.trim(), clientSecret: clientSecret.trim() });
    window.location.href = `/auth/login?${params.toString()}`;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #dde1e7',
    fontSize: '0.875rem',
    boxSizing: 'border-box',
    marginTop: '5px',
    outline: 'none',
    color: '#2c3e50',
    backgroundColor: '#fafbfc',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#5a6472',
    letterSpacing: '0.02em',
    textTransform: 'uppercase',
  };

  const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const modalChecks = selectedCategory
    ? [...(CATEGORY_CHECKS[selectedCategory] || [])].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    : [];

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── LEFT PANEL ── */}
      <div style={{
        flex: '0 0 60%',
        background: 'linear-gradient(145deg, #032D60 0%, #0070D2 60%, #1589EE 100%)',
        color: 'white',
        padding: '52px 56px',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '40px' }}>
          {/* Wordmark */}
          <div style={{ marginBottom: '24px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 500, opacity: 0.85, letterSpacing: '0.05em' }}>
              SALESFORCE TECH DEBT ASSESSOR
            </span>
          </div>

          <h1 style={{
            fontSize: '2.4rem',
            fontWeight: 700,
            margin: '0 0 8px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
          }}>
            Know your org's<br />health in minutes.
          </h1>

          <p style={{ fontSize: '0.9rem', opacity: 0.75, margin: '0 0 6px', fontWeight: 400 }}>
            by <strong style={{ opacity: 1 }}>Steven Bilgram</strong>, Success Architect
          </p>

          <p style={{
            fontSize: '0.95rem',
            lineHeight: 1.65,
            opacity: 0.88,
            maxWidth: '520px',
            marginTop: '20px',
          }}>
            Connects securely to your Salesforce org via OAuth and runs a comprehensive
            read-only scan across <strong>{TOTAL_CHECKS} checks</strong> in {CATEGORIES.length} categories —
            surfacing technical debt, security gaps, and configuration anti-patterns with
            prioritised recommendations.
          </p>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          gap: '32px',
          marginBottom: '36px',
          paddingBottom: '28px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
        }}>
          {[
            { value: TOTAL_CHECKS, label: 'Total Checks' },
            { value: CATEGORIES.length, label: 'Categories' },
            { value: '100%', label: 'Read-Only' },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px', letterSpacing: '0.03em' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Category grid */}
        <div style={{ marginBottom: '10px' }}>
          <p style={{ fontSize: '0.75rem', opacity: 0.6, margin: '0 0 12px', letterSpacing: '0.03em' }}>
            Click any category to see all checks
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}>
            {CATEGORIES.map(cat => {
              const accentColor = GROUP_COLORS[cat.group] || 'rgba(255,255,255,0.4)';
              const isHovered = hoveredCategory === cat.name;
              return (
                <div
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  onMouseEnter={() => setHoveredCategory(cat.name)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  style={{
                    backgroundColor: isHovered
                      ? 'rgba(255,255,255,0.2)'
                      : 'rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px 14px 12px 12px',
                    backdropFilter: 'blur(4px)',
                    border: isHovered
                      ? '1px solid rgba(255,255,255,0.35)'
                      : '1px solid rgba(255,255,255,0.12)',
                    borderLeft: `3px solid ${accentColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'background-color 0.12s, border-color 0.12s',
                    userSelect: 'none',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cat.icon}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {cat.name}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      opacity: 0.65,
                      marginTop: '1px',
                    }}>
                      {cat.checks} check{cat.checks !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Group legend */}
        <div style={{
          marginTop: '14px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px 18px',
        }}>
          {Object.entries(GROUP_COLORS).map(([group, color]) => (
            <div key={group} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: '0.68rem', opacity: 0.7, whiteSpace: 'nowrap' }}>
                {group}
              </span>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p style={{
          marginTop: '16px',
          fontSize: '0.72rem',
          opacity: 0.5,
          lineHeight: 1.5,
        }}>
          Read-only OAuth access · No data stored · Credentials saved locally only
        </p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: '0 0 40%',
        backgroundColor: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 40px',
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: 700,
            color: '#1a2332',
            margin: '0 0 6px',
          }}>
            Connect your org
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#7f8c8d', margin: '0 0 32px', lineHeight: 1.5 }}>
            Enter your Connected App credentials to authenticate via Salesforce OAuth.
          </p>

          {error && (
            <div style={{
              backgroundColor: '#fdf0ed',
              border: '1px solid #e74c3c',
              borderRadius: '6px',
              padding: '10px 14px',
              marginBottom: '20px',
              fontSize: '0.82rem',
              color: '#c0392b',
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              Org / Sandbox URL
              <input
                type="text"
                placeholder="https://company--uat.sandbox.my.salesforce.com"
                value={loginUrl}
                onChange={e => { setLoginUrl(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
            <p style={{ fontSize: '0.72rem', color: '#aaa', margin: '4px 0 0' }}>
              Use your org's My Domain URL
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>
              Client ID (Consumer Key)
              <input
                type="text"
                placeholder="3MVG9..."
                value={clientId}
                onChange={e => { setClientId(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={labelStyle}>
              Client Secret (Consumer Secret)
              <input
                type="password"
                placeholder="••••••••••••••••"
                value={clientSecret}
                onChange={e => { setClientSecret(e.target.value); setError(''); }}
                style={inputStyle}
              />
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <input
              type="checkbox"
              id="remember"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: '#0070D2' }}
            />
            <label htmlFor="remember" style={{ fontSize: '0.8rem', color: '#5a6472', cursor: 'pointer' }}>
              Remember credentials on this device
            </label>
          </div>

          <button
            onClick={handleLogin}
            style={{
              background: 'linear-gradient(135deg, #0070D2 0%, #1589EE 100%)',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              letterSpacing: '0.01em',
              boxShadow: '0 2px 8px rgba(0,112,210,0.35)',
              transition: 'opacity 0.15s, transform 0.1s',
            }}
            onMouseOver={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            Connect to Salesforce →
          </button>

          <p style={{ marginTop: '20px', fontSize: '0.72rem', color: '#bdc3c7', lineHeight: 1.6, textAlign: 'center' }}>
            Need Instructions?{' '}
            <button
              onClick={() => setShowSetupGuide(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#0070D2',
                fontWeight: 500,
                fontSize: '0.72rem',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              See the setup guide →
            </button>
          </p>
        </div>
      </div>

      {/* ── SETUP GUIDE MODAL ── */}
      {showSetupGuide && (
        <div
          onClick={() => setShowSetupGuide(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '640px',
              maxHeight: '82vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexShrink: 0,
              background: 'linear-gradient(135deg, #032D60 0%, #0070D2 100%)',
              color: 'white',
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>
                  Setup Guide
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.75 }}>
                  Register the app once per Salesforce org you want to assess
                </p>
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  color: 'white',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Scrollable content */}
            <div style={{ overflowY: 'auto', padding: '20px 24px 28px', fontSize: '0.875rem', color: '#2c3e50', lineHeight: 1.6 }}>

              {/* Which type? */}
              <div style={{ backgroundColor: '#f0f7ff', borderRadius: '8px', padding: '14px 16px', marginBottom: '20px', border: '1px solid #cce0ff' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#0070D2' }}>How to tell which setup your org uses</p>
                <p style={{ margin: '0 0 4px' }}>
                  <strong>External Client App</strong> — newer orgs (Spring '25+). Go to Setup and search for <strong>"External Client Apps"</strong>. If it appears, use Option A.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Connected App</strong> — older orgs. Go to Setup → <strong>App Manager</strong>. If you see a <strong>"New Connected App"</strong> button, use Option B.
                </p>
              </div>

              {/* Option A */}
              <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#032D60', borderBottom: '2px solid #0070D2', paddingBottom: '6px' }}>
                Option A — External Client App (newer orgs, Spring '25+)
              </h4>
              <ol style={{ margin: '0 0 20px', paddingLeft: '20px' }}>
                {[
                  <>Log in as an Administrator → <strong>Setup → External Client Apps → New</strong></>,
                  <>Fill in: <strong>Label:</strong> SF Tech Debt Assessor · <strong>API Name:</strong> SF_Tech_Debt_Assessor · <strong>Contact Email:</strong> your email</>,
                  <>Under <strong>OAuth Settings</strong>, check <strong>Enable OAuth</strong></>,
                  <>Set <strong>Callback URL</strong> to:<br />
                    <code style={{ display: 'inline-block', marginTop: '4px', padding: '4px 8px', backgroundColor: '#f4f4f4', borderRadius: '4px', fontSize: '0.8rem', color: '#c0392b', wordBreak: 'break-all' }}>
                      https://sf-tech-debt-assessor.onrender.com/auth/callback
                    </code>
                  </>,
                  <>Under <strong>OAuth Scopes</strong>, add: <em>Access and manage your data (api)</em> and <em>Perform requests on your behalf at any time (refresh_token)</em></>,
                  <><strong>Uncheck "Require Proof Key for Code Exchange (PKCE)"</strong> if it appears — leave it disabled</>,
                  <>Click <strong>Save</strong> — wait ~10 minutes for Salesforce to activate it</>,
                  <>Go back to the External Client App → <strong>View Consumer Details</strong> to retrieve your <strong>Consumer Key</strong> (Client ID) and <strong>Consumer Secret</strong></>,
                ].map((step, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{step}</li>
                ))}
              </ol>

              {/* Option B */}
              <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#032D60', borderBottom: '2px solid #0070D2', paddingBottom: '6px' }}>
                Option B — Connected App (older orgs)
              </h4>
              <ol style={{ margin: '0 0 20px', paddingLeft: '20px' }}>
                {[
                  <>Log in as an Administrator → <strong>Setup → App Manager → New Connected App</strong></>,
                  <>Fill in: <strong>App Name:</strong> SF Tech Debt Assessor · <strong>API Name:</strong> SF_Tech_Debt_Assessor · <strong>Contact Email:</strong> your email</>,
                  <>Check <strong>Enable OAuth Settings</strong></>,
                  <>Set <strong>Callback URL</strong> to:<br />
                    <code style={{ display: 'inline-block', marginTop: '4px', padding: '4px 8px', backgroundColor: '#f4f4f4', borderRadius: '4px', fontSize: '0.8rem', color: '#c0392b', wordBreak: 'break-all' }}>
                      https://sf-tech-debt-assessor.onrender.com/auth/callback
                    </code>
                  </>,
                  <>Under <strong>Selected OAuth Scopes</strong>, add: <em>Access and manage your data (api)</em> and <em>Perform requests on your behalf at any time (refresh_token)</em></>,
                  <><strong>Uncheck "Require Proof Key for Code Exchange (PKCE)"</strong> — this must be disabled</>,
                  <>Click <strong>Save</strong> — wait ~10 minutes for Salesforce to activate the app</>,
                  <>Go back to the Connected App → <strong>Manage Consumer Details</strong> to retrieve your <strong>Consumer Key</strong> (Client ID) and <strong>Consumer Secret</strong></>,
                ].map((step, i) => (
                  <li key={i} style={{ marginBottom: '8px' }}>{step}</li>
                ))}
              </ol>

              {/* Permissions */}
              <h4 style={{ margin: '0 0 10px', fontSize: '0.9rem', color: '#032D60', borderBottom: '2px solid #0070D2', paddingBottom: '6px' }}>
                Permissions required
              </h4>
              <p style={{ margin: '0 0 6px' }}>The user who authenticates must have:</p>
              <ul style={{ margin: '0 0 20px', paddingLeft: '20px' }}>
                {['API Enabled (profile setting)', 'View Setup and Configuration', 'Modify Metadata Through Metadata API Functions (for full results)', 'System Administrator profile grants all of the above'].map((p, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{p}</li>
                ))}
              </ul>

              {/* Troubleshooting */}
              <div style={{ backgroundColor: '#fef9e7', borderRadius: '8px', padding: '14px 16px', border: '1px solid #f9e4a0' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#b8860b' }}>Troubleshooting</p>
                <p style={{ margin: '0 0 6px' }}>
                  <strong>redirect_uri_mismatch</strong> — the Callback URL in your app doesn't match. Update it to exactly the URL above, save, and wait ~10 min.
                </p>
                <p style={{ margin: '0 0 6px' }}>
                  <strong>missing required code challenge</strong> — PKCE is still enabled. Go back into Setup and uncheck "Require Proof Key for Code Exchange (PKCE)", then save and retry.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Trailhead Playground URL format:</strong> <code style={{ fontSize: '0.8rem', color: '#c0392b' }}>https://orgname-dev-ed.trailblaze.my.salesforce.com</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CATEGORY CHECKS MODAL ── */}
      {selectedCategory && (
        <div
          onClick={() => setSelectedCategory(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexShrink: 0,
            }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', fontWeight: 700, color: '#1a2332' }}>
                  {CATEGORIES.find(c => c.name === selectedCategory)?.icon} {selectedCategory}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#7f8c8d' }}>
                  {modalChecks.length} check{modalChecks.length !== 1 ? 's' : ''} · click backdrop or press Esc to close
                </p>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  color: '#aaa',
                  lineHeight: 1,
                  padding: '0 0 0 16px',
                  flexShrink: 0,
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Severity legend */}
            <div style={{
              padding: '10px 24px',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex',
              gap: '12px',
              flexShrink: 0,
            }}>
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map(sev => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: SEVERITY_COLORS[sev].color,
                  }} />
                  <span style={{ fontSize: '0.7rem', color: '#888' }}>{SEVERITY_COLORS[sev].label}</span>
                </div>
              ))}
            </div>

            {/* Check list */}
            <div style={{ overflowY: 'auto', padding: '8px 24px 20px', flexGrow: 1 }}>
              {modalChecks.map((check, idx) => {
                const sc = SEVERITY_COLORS[check.severity];
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '9px 0',
                      borderBottom: idx < modalChecks.length - 1 ? '1px solid #f5f5f5' : 'none',
                    }}
                  >
                    <span style={{
                      flexShrink: 0,
                      marginTop: '1px',
                      padding: '2px 7px',
                      borderRadius: '4px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase',
                      backgroundColor: sc.bg,
                      color: sc.color,
                      whiteSpace: 'nowrap',
                    }}>
                      {sc.label}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#2c3e50', lineHeight: 1.4 }}>
                      {check.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
