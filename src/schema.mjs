export const APP_VERSION = '2.0.0';
export const LEGAL_CONTENT_VERSION = 3;
export const BULK_TEMPLATE = Object.freeze({
  NAME: 'Daily Work Sheet Logging Bulk Import Template',
  VERSION: '1.1'
});

export const SCHEMA = Object.freeze({
  Settings: ['Key', 'Value', 'Description', 'UpdatedAt'],
  Users: ['UserID', 'Email', 'Name', 'Role', 'ContractorID', 'AuthorizedParishes', 'Active', 'CreatedAt', 'UpdatedAt'],
  Contractors: ['ContractorID', 'ContractorName', 'Address', 'ContactPerson', 'Phone', 'Email', 'Active', 'CreatedAt', 'UpdatedAt'],
  Crews: ['CrewID', 'CrewName', 'ContractorID', 'Parish', 'Supervisor', 'Active', 'CreatedAt', 'UpdatedAt'],
  CrewMembers: ['CrewMemberID', 'CrewID', 'EmployeeName', 'EmployeeNumber', 'Position', 'Active', 'CreatedAt', 'UpdatedAt'],
  Parishes: ['ParishID', 'ParishName', 'Region', 'Active', 'SortOrder', 'CreatedAt', 'UpdatedAt'],
  Shifts: ['ShiftID', 'ShiftName', 'StartTime', 'EndTime', 'Active', 'SortOrder', 'CreatedAt', 'UpdatedAt'],
  WorkTypes: ['WorkTypeID', 'WorkTypeName', 'Active', 'SortOrder', 'CreatedAt', 'UpdatedAt'],
  Worksheets: [
    'WorksheetID', 'ContractorID', 'ContractorName', 'WorkTypeID', 'WorkType', 'DateWorked',
    'Parish', 'Location', 'CrewID', 'CrewName', 'TeamMembers', 'ShiftID', 'ShiftName',
    'SubmittedBy', 'SubmittedByName', 'SubmittedAt', 'JobsCompleted', 'RequiredJobs', 'JobVariance',
    'ProductionCompliancePercent', 'ProductionStatus', 'DataCompletenessPercent', 'TimingCompliancePercent',
    'SLACompliancePercent', 'OverallCompliancePercent', 'ComplianceStatus', 'ExceptionCount',
    'ReviewStatus', 'ReviewedBy', 'ReviewedAt', 'SourceType', 'CreatedAt', 'UpdatedAt'
  ],
  WorksheetJobs: [
    'JobRecordID', 'WorksheetID', 'JobSequence', 'JobID', 'CustomerName', 'CustomerAddress',
    'ProblemReported', 'AssignedTime', 'OnSiteTime', 'CompletedTime', 'AssignToOnSiteMinutes',
    'OnSiteToCompleteMinutes', 'AssignToCompleteMinutes', 'ActionTaken', 'MaterialUsed',
    'VoltageFound', 'VoltageLeft', 'Remarks', 'RequiredFieldsCompletePercent', 'DataComplete',
    'TimingValid', 'TimingException', 'SLAException', 'DuplicateSuspected', 'CreatedAt', 'UpdatedAt',
    'ImportBatchID', 'ImportSource'
  ],
  Exceptions: [
    'ExceptionID', 'WorksheetID', 'JobRecordID', 'ExceptionType', 'Severity', 'Description',
    'DetectedValue', 'ExpectedValue', 'Status', 'ReviewedBy', 'ReviewedAt', 'ResolutionNotes', 'CreatedAt'
  ],
  AuditLog: ['AuditID', 'Timestamp', 'UserEmail', 'UserName', 'Action', 'EntityType', 'EntityID', 'Description', 'OldValue', 'NewValue'],
  LegalContent: ['PageKey', 'Title', 'Content', 'UpdatedAt']
});

export const PRIMARY_KEYS = Object.freeze({
  Settings: 'Key', Users: 'UserID', Contractors: 'ContractorID', Crews: 'CrewID', CrewMembers: 'CrewMemberID',
  Parishes: 'ParishID', Shifts: 'ShiftID', WorkTypes: 'WorkTypeID', Worksheets: 'WorksheetID',
  WorksheetJobs: 'JobRecordID', Exceptions: 'ExceptionID', AuditLog: 'AuditID', LegalContent: 'PageKey'
});

export const ADMIN_ENTITIES = Object.freeze({
  Users: { table: 'Users', key: 'UserID', prefix: 'USR' },
  Contractors: { table: 'Contractors', key: 'ContractorID', prefix: 'CON' },
  Crews: { table: 'Crews', key: 'CrewID', prefix: 'CRW' },
  CrewMembers: { table: 'CrewMembers', key: 'CrewMemberID', prefix: 'MEM' },
  Parishes: { table: 'Parishes', key: 'ParishID', prefix: 'PAR' },
  Shifts: { table: 'Shifts', key: 'ShiftID', prefix: 'SHF' },
  WorkTypes: { table: 'WorkTypes', key: 'WorkTypeID', prefix: 'WTP' },
  Settings: { table: 'Settings', key: 'Key', prefix: '' },
  LegalContent: { table: 'LegalContent', key: 'PageKey', prefix: '' }
});

export const NUMERIC_COLUMNS = new Set([
  'SortOrder', 'JobsCompleted', 'RequiredJobs', 'JobVariance', 'ProductionCompliancePercent',
  'DataCompletenessPercent', 'TimingCompliancePercent', 'SLACompliancePercent', 'OverallCompliancePercent',
  'ExceptionCount', 'JobSequence', 'AssignToOnSiteMinutes', 'OnSiteToCompleteMinutes',
  'AssignToCompleteMinutes', 'RequiredFieldsCompletePercent'
]);

export const BOOLEAN_COLUMNS = new Set([
  'Active', 'DataComplete', 'TimingValid', 'TimingException', 'SLAException', 'DuplicateSuspected'
]);

export const DEFAULT_SETTINGS = [
  ['APP_NAME', 'Daily Work Sheet Logging', 'Application display name'],
  ['COMPANY_NAME', 'Emergency & Dispatch Operations', 'Organization / division name'],
  ['TAGLINE', 'Track work. Measure response. Improve accountability.', 'CTA landing page tagline'],
  ['MIN_JOBS_PER_SHIFT', '6', 'Minimum number of completed jobs required per crew shift'],
  ['MIN_TIME_GAP_MINUTES', '15', 'Minimum acceptable gap between Assigned→On-site and On-site→Completed'],
  ['ASSIGN_TO_ONSITE_WARNING_MIN', '60', 'Overrun warning threshold in minutes'],
  ['ONSITE_TO_COMPLETE_WARNING_MIN', '180', 'Overrun warning threshold in minutes'],
  ['ASSIGN_TO_COMPLETE_WARNING_MIN', '240', 'Overrun warning threshold in minutes'],
  ['COMPLIANCE_WATCH_THRESHOLD', '75', 'Watch threshold percent'],
  ['COMPLIANCE_LOW_THRESHOLD', '50', 'Low threshold percent'],
  ['REQUIRED_JOB_FIELDS', 'JobID,ProblemReported,AssignedTime,OnSiteTime,CompletedTime,ActionTaken,Remarks', 'Comma-separated fields used for data completeness'],
  ['OVERALL_WEIGHT_PRODUCTION', '50', 'Overall compliance weight'],
  ['OVERALL_WEIGHT_DATA', '25', 'Overall compliance weight'],
  ['OVERALL_WEIGHT_TIMING', '15', 'Overall compliance weight'],
  ['OVERALL_WEIGHT_SLA', '10', 'Overall compliance weight'],
  ['TIMEZONE', 'America/Jamaica', 'Application timezone'],
  ['DATE_FORMAT', 'yyyy-MM-dd', 'Application date format'],
  ['COPYRIGHT_OWNER', 'Qwik Business Solutions', 'Copyright / attribution owner'],
  ['SUPPORT_EMAIL', '', 'Optional support email'],
  ['LEGAL_CONTENT_VERSION', String(LEGAL_CONTENT_VERSION), 'Internal version marker for About / Licensing / Disclaimer / Copyright content']
];

export const DEFAULT_PARISHES = [
  ['Kingston', 'East'], ['St. Andrew', 'East'], ['St. Thomas', 'East'], ['Portland', 'East'],
  ['St. Mary', 'East'], ['St. Ann', 'Central'], ['Trelawny', 'West'], ['St. James', 'West'],
  ['Hanover', 'West'], ['Westmoreland', 'West'], ['St. Elizabeth', 'West'], ['Manchester', 'Central'],
  ['Clarendon', 'Central'], ['St. Catherine', 'Central']
];

export const DEFAULT_SHIFTS = [
  { ShiftID: 'SHF-01', ShiftName: '7 AM - 3 PM', StartTime: '07:00', EndTime: '15:00', Active: true, SortOrder: 1 },
  { ShiftID: 'SHF-02', ShiftName: '3 AM - 11 PM', StartTime: '03:00', EndTime: '23:00', Active: true, SortOrder: 2 },
  { ShiftID: 'SHF-03', ShiftName: '11 PM - 7 AM', StartTime: '23:00', EndTime: '07:00', Active: true, SortOrder: 3 }
];

export const DEFAULT_WORK_TYPES = [
  { WorkTypeID: 'WTP-01', WorkTypeName: 'Power Quality', Active: true, SortOrder: 1 },
  { WorkTypeID: 'WTP-02', WorkTypeName: 'Outage Response', Active: true, SortOrder: 2 }
];
