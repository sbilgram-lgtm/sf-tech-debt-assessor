export interface DebtItem {
  id: string;
  category: 'configuration' | 'code' | 'dataModel' | 'serviceCloud' | 'sharingSecurity' | 'integrations' | 'testCoverage' | 'orgLimits';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  metadata?: Record<string, any>;
}

export interface CategoryScore {
  category: string;
  score: number;
  maxScore: number;
  percentage: number;
  items: DebtItem[];
}

export interface AssessmentResult {
  overallScore: number;
  overallPercentage: number;
  categories: CategoryScore[];
  timestamp: string;
  orgId?: string;
  instanceUrl?: string;
}

export interface AutomationData {
  workflowRules: any[];
  processBuilders: any[];
  flows: any[];
  allFlows: any[];
}

export interface ApexData {
  classes: any[];
  triggers: any[];
  coverage: any[];
}

export interface DataModelData {
  objects: any[];
  fields: any[];
  fieldUsage: any[];
}

export interface ServiceCloudData {
  caseRecordTypes: any[];
  emailToCase: any[];
  queues: any[];
  assignmentRules: any[];
  escalationRules: any[];
}

export interface ValidationRuleData {
  validationRules: any[];
}

export interface SharingSecurityData {
  owdSettings: any[];
  sharingRules: any[];
  profiles: any[];
  permissionSets: any[];
  passwordPolicies: any[];
  sessionSettings: any[];
  apiUsers: {
    all: any[];
    integrationUsers: any[];
    staleUsers: any[];
    broadPermUsers: any[];
  };
  loginIpRanges: any[];
  mfaEnrolledUserIds: string[];
  securityHealthCheck: any;
  activeOauthTokens: any[];
  lowSecuritySessions: any[];
  usersPasswordNeverExpires: any[];
  guestAccessObjects: any[];
}

export interface IntegrationData {
  connectedApps: any[];
  namedCredentials: any[];
  remoteSiteSettings: any[];
  apexCallouts: any[];
}

export interface TestCoverageData {
  apexClasses: any[];
  apexTriggers: any[];
  coverage: any[];
  testClasses: any[];
}

export interface OrgLimitEntry {
  name: string;
  max: number;
  remaining: number;
  used: number;
  usedPct: number;
}

export interface OrgLimitsData {
  limits: OrgLimitEntry[];
}
