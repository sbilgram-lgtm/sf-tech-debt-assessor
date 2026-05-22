export interface DebtItem {
  id: string;
  category: 'configuration' | 'code' | 'dataModel' | 'serviceCloud';
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
