import {
  DebtItem,
  CategoryScore,
  AssessmentResult,
  AutomationData,
  ApexData,
  DataModelData,
  ServiceCloudData,
  ValidationRuleData
} from '../types/assessment';

const SEVERITY_WEIGHTS = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2
};

function createDebtItem(
  category: DebtItem['category'],
  severity: DebtItem['severity'],
  title: string,
  description: string,
  recommendation: string,
  metadata?: Record<string, any>
): DebtItem {
  return {
    id: `${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    category,
    severity,
    title,
    description,
    recommendation,
    metadata
  };
}

export function assessConfiguration(
  automation: AutomationData,
  validationRules: ValidationRuleData
): CategoryScore {
  const items: DebtItem[] = [];

  // Check for active Workflow Rules (should be migrated to Flows)
  if (automation.workflowRules.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'high',
      `${automation.workflowRules.length} Active Workflow Rules`,
      'Workflow Rules are legacy automation. Salesforce recommends migrating to Flows.',
      'Use the Migrate to Flow tool in Setup to convert Workflow Rules to record-triggered flows.',
      { count: automation.workflowRules.length, items: automation.workflowRules.slice(0, 10) }
    ));
  }

  // Check for Process Builders (should be migrated to Flows)
  if (automation.processBuilders.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'high',
      `${automation.processBuilders.length} Active Process Builders`,
      'Process Builders are deprecated. Salesforce will retire them in a future release.',
      'Migrate Process Builders to record-triggered flows using the Migrate to Flow tool.',
      { count: automation.processBuilders.length, items: automation.processBuilders.slice(0, 10) }
    ));
  }

  // Check for automation overlap (multiple automations on same object)
  const automationByObject = new Map<string, number>();
  automation.allFlows.forEach(flow => {
    const label = flow.MasterLabel || flow.Label || '';
    const obj = flow.ProcessType === 'Workflow' ? label.split(' ')[0] : 'Unknown';
    automationByObject.set(obj, (automationByObject.get(obj) || 0) + 1);
  });
  automation.workflowRules.forEach(rule => {
    const obj = rule.TableEnumOrId;
    automationByObject.set(obj, (automationByObject.get(obj) || 0) + 1);
  });

  const overlappingObjects = Array.from(automationByObject.entries())
    .filter(([_, count]) => count > 3);
  if (overlappingObjects.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${overlappingObjects.length} Objects with Overlapping Automation`,
      'Multiple automation types on the same object increases complexity and risk of conflicts.',
      'Consolidate automation into a single flow per object where possible.',
      { objects: overlappingObjects }
    ));
  }

  // Check for high validation rule count per object
  if (validationRules.validationRules.length > 50) {
    items.push(createDebtItem(
      'configuration',
      'medium',
      `${validationRules.validationRules.length} Active Validation Rules`,
      'A high number of validation rules increases complexity and can impact performance.',
      'Review and consolidate validation rules. Consider using flows for complex validations.',
      { count: validationRules.validationRules.length }
    ));
  }

  // Check for undocumented validation rules
  const undocumented = validationRules.validationRules.filter(
    (rule: any) => !rule.Description || rule.Description.trim() === ''
  );
  if (undocumented.length > 0) {
    items.push(createDebtItem(
      'configuration',
      'low',
      `${undocumented.length} Validation Rules Without Descriptions`,
      'Validation rules without descriptions make it difficult for admins to understand their purpose.',
      'Add clear descriptions explaining the business rule each validation enforces.',
      { count: undocumented.length }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Configuration',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessCodeQuality(apex: ApexData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for triggers without handler pattern
  const triggersWithLogic = apex.triggers.filter((trigger: any) => {
    const body = trigger.Body || '';
    const lines = body.split('\n').filter((l: string) => l.trim() && !l.trim().startsWith('//'));
    return lines.length > 10;
  });
  if (triggersWithLogic.length > 0) {
    items.push(createDebtItem(
      'code',
      'high',
      `${triggersWithLogic.length} Triggers with Business Logic`,
      'Triggers should delegate to handler classes. Logic in triggers is hard to test and maintain.',
      'Refactor triggers to call handler/service classes. Adopt a trigger framework.',
      { triggers: triggersWithLogic.map((t: any) => t.Name) }
    ));
  }

  // Check for low test coverage
  const lowCoverage = apex.coverage.filter((c: any) => {
    const total = (c.NumLinesCovered || 0) + (c.NumLinesUncovered || 0);
    if (total === 0) return false;
    return (c.NumLinesCovered / total) < 0.75;
  });
  if (lowCoverage.length > 0) {
    const criticallyLow = lowCoverage.filter((c: any) => {
      const total = c.NumLinesCovered + c.NumLinesUncovered;
      return (c.NumLinesCovered / total) < 0.5;
    });
    items.push(createDebtItem(
      'code',
      criticallyLow.length > 5 ? 'critical' : 'high',
      `${lowCoverage.length} Classes/Triggers Below 75% Coverage`,
      `${criticallyLow.length} are below 50% coverage. Low coverage increases deployment risk.`,
      'Write meaningful unit tests focusing on business logic, not just coverage numbers.',
      { count: lowCoverage.length, criticalCount: criticallyLow.length }
    ));
  }

  // Check for outdated API versions
  const outdatedClasses = apex.classes.filter((c: any) => c.ApiVersion < 55);
  const outdatedTriggers = apex.triggers.filter((t: any) => t.ApiVersion < 55);
  const totalOutdated = outdatedClasses.length + outdatedTriggers.length;
  if (totalOutdated > 0) {
    items.push(createDebtItem(
      'code',
      'medium',
      `${totalOutdated} Components on Outdated API Versions`,
      'Components on old API versions may miss security patches and new platform features.',
      'Update API versions incrementally, testing each batch. Prioritize security-sensitive code.',
      { classes: outdatedClasses.length, triggers: outdatedTriggers.length }
    ));
  }

  // Check for SOQL in loops (basic pattern detection)
  const soqlInLoops = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    const forLoopPattern = /for\s*\([^)]*\)\s*\{[^}]*\[SELECT/gi;
    const whileLoopPattern = /while\s*\([^)]*\)\s*\{[^}]*\[SELECT/gi;
    return forLoopPattern.test(body) || whileLoopPattern.test(body);
  });
  if (soqlInLoops.length > 0) {
    items.push(createDebtItem(
      'code',
      'critical',
      `${soqlInLoops.length} Classes with SOQL in Loops`,
      'SOQL queries inside loops cause governor limit exceptions in bulk operations.',
      'Move queries outside loops. Use collections and maps for bulk-safe patterns.',
      { classes: soqlInLoops.map((c: any) => c.Name) }
    ));
  }

  // Check for hardcoded IDs
  const hardcodedIds = apex.classes.filter((c: any) => {
    const body = c.Body || '';
    const idPattern = /['"][a-zA-Z0-9]{15,18}['"]/g;
    const matches = body.match(idPattern) || [];
    return matches.length > 0;
  });
  if (hardcodedIds.length > 0) {
    items.push(createDebtItem(
      'code',
      'high',
      `${hardcodedIds.length} Classes with Hardcoded IDs`,
      'Hardcoded Salesforce IDs break when deploying between environments.',
      'Use Custom Metadata Types, Custom Settings, or Custom Labels instead of hardcoded IDs.',
      { classes: hardcodedIds.map((c: any) => c.Name) }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Code Quality',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessDataModel(data: DataModelData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for objects without descriptions
  const undescribedObjects = data.objects.filter(
    (obj: any) => !obj.Description || obj.Description.trim() === ''
  );
  if (undescribedObjects.length > 0) {
    items.push(createDebtItem(
      'dataModel',
      'low',
      `${undescribedObjects.length} Custom Objects Without Descriptions`,
      'Objects without descriptions make it hard for new team members to understand the data model.',
      'Add meaningful descriptions explaining what each object represents and its business purpose.',
      { count: undescribedObjects.length }
    ));
  }

  // Check for fields without descriptions
  const undescribedFields = data.fields.filter(
    (f: any) => !f.Description || f.Description.trim() === ''
  );
  const fieldRatio = data.fields.length > 0
    ? undescribedFields.length / data.fields.length
    : 0;
  if (fieldRatio > 0.5 && undescribedFields.length > 20) {
    items.push(createDebtItem(
      'dataModel',
      'medium',
      `${Math.round(fieldRatio * 100)}% of Custom Fields Lack Descriptions`,
      `${undescribedFields.length} of ${data.fields.length} custom fields have no description.`,
      'Document fields with their business purpose, valid values, and any dependencies.',
      { undescribed: undescribedFields.length, total: data.fields.length }
    ));
  }

  // Check for field sprawl (objects with too many custom fields)
  const fieldsByObject = new Map<string, number>();
  data.fields.forEach((f: any) => {
    const obj = f.TableEnumOrId;
    fieldsByObject.set(obj, (fieldsByObject.get(obj) || 0) + 1);
  });
  const bloatedObjects = Array.from(fieldsByObject.entries())
    .filter(([_, count]) => count > 100);
  if (bloatedObjects.length > 0) {
    items.push(createDebtItem(
      'dataModel',
      'high',
      `${bloatedObjects.length} Objects with 100+ Custom Fields`,
      'Objects with excessive fields indicate possible data model issues or unused fields.',
      'Audit field usage, archive unused fields, and consider splitting into related objects.',
      { objects: bloatedObjects.map(([name, count]) => ({ name, count })) }
    ));
  }

  // Check total custom objects count
  if (data.objects.length > 200) {
    items.push(createDebtItem(
      'dataModel',
      'medium',
      `${data.objects.length} Custom Objects in Org`,
      'A very high number of custom objects may indicate scope creep or abandoned features.',
      'Audit custom objects for usage. Archive or delete objects that are no longer needed.',
      { count: data.objects.length }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Data Model',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function assessServiceCloud(data: ServiceCloudData): CategoryScore {
  const items: DebtItem[] = [];

  // Check for excessive case record types
  if (data.caseRecordTypes.length > 10) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.caseRecordTypes.length} Case Record Types`,
      'Too many record types adds complexity to page layouts, automation, and reporting.',
      'Consolidate record types where possible. Use picklist values for minor variations.',
      { recordTypes: data.caseRecordTypes.map((rt: any) => rt.Name) }
    ));
  }

  // Check for inactive case record types
  const inactiveRT = data.caseRecordTypes.filter((rt: any) => !rt.IsActive);
  if (inactiveRT.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'low',
      `${inactiveRT.length} Inactive Case Record Types`,
      'Inactive record types add clutter and confusion to the org.',
      'Delete inactive record types that are no longer needed after verifying no dependencies.',
      { count: inactiveRT.length }
    ));
  }

  // Check for excessive queues
  if (data.queues.length > 50) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.queues.length} Queues Configured`,
      'Excessive queues can indicate routing complexity that is hard to manage.',
      'Review queue usage and consolidate underutilized queues. Consider Omni-Channel routing.',
      { count: data.queues.length }
    ));
  }

  // Check for legacy assignment/escalation rules
  if (data.assignmentRules.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'medium',
      `${data.assignmentRules.length} Case Assignment Rules`,
      'Assignment Rules are legacy. Consider migrating to Flow-based or Omni-Channel routing.',
      'Evaluate Omni-Channel for skills-based routing, or use Flow for assignment logic.',
      { count: data.assignmentRules.length }
    ));
  }

  if (data.escalationRules.length > 0) {
    items.push(createDebtItem(
      'serviceCloud',
      'low',
      `${data.escalationRules.length} Escalation Rules`,
      'Escalation Rules are functional but limited compared to Flow-based escalation.',
      'Consider migrating to time-based flows for more flexible escalation logic.',
      { count: data.escalationRules.length }
    ));
  }

  const maxScore = 100;
  const deductions = items.reduce((sum, item) => sum + SEVERITY_WEIGHTS[item.severity], 0);
  const score = Math.max(0, maxScore - deductions);

  return {
    category: 'Service Cloud',
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    items
  };
}

export function calculateOverallScore(categories: CategoryScore[]): AssessmentResult {
  const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
  const totalMax = categories.reduce((sum, cat) => sum + cat.maxScore, 0);

  return {
    overallScore: totalScore,
    overallPercentage: Math.round((totalScore / totalMax) * 100),
    categories,
    timestamp: new Date().toISOString()
  };
}
