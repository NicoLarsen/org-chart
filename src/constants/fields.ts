// Employee Directory workflow
export const WORKFLOW_ID = '697d1e905d7aa85c928e5aa4';

export const PHASE_IDS = {
  ACTIVE_EMPLOYEES: '697d1e905d7aa85c928e5abf',
  ACTIVE_CONTRACTORS: '697d1e905d7aa85c928e5af2',
  ARCHIVE: '697d1e905d7aa85c928e5af3',
} as const;

// Field KEYS (portable across workspaces) - resolved to IDs at runtime via useFieldSchema
export const FIELD_KEYS = {
  FIRSTNAME: 'firstname',
  LASTNAME: 'lastname',
  POSITION: 'position',
  TEAM: 'team',
  SUPERVISOR: 'supervisor',
  EMPLOYEES_LINKEDFROM: 'subordinates',
  NATIONALITY: 'nationality',
  DATE_OF_BIRTH: 'dateOfBirth',
  SALARY: 'salary',
  TOTAL_COST: 'totalCost',
  STATUS: 'status',
} as const;

// Employees workflow (alias for main workflow)
export const EMPLOYEES = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5aa4',
  PHASE_IDS: {
    ACTIVE_EMPLOYEES: '697d1e905d7aa85c928e5abf',
    ACTIVE_CONTRACTORS: '697d1e905d7aa85c928e5af2',
    ARCHIVE: '697d1e905d7aa85c928e5af3',
  },
  FIELD_KEYS: {
    FIRSTNAME: 'firstname',
    LASTNAME: 'lastname',
    POSITION: 'position',
    TEAM: 'team',
  },
} as const;

// Change Management workflow
export const CHANGE_MANAGEMENT = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5ab6',
  PHASE_ID: '697d1e905d7aa85c928e5abc',
  FIELD_KEYS: {
    PERSON: 'person',
    EFFECTIVE_DATE: 'effectiveDate',
    PREVIOUS_POSITION: 'previousPosition',
    NEW_POSITION: 'newPosition',
  },
} as const;

// Positions workflow
export const POSITIONS = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5ab9',
  PHASE_ID: '697d1e905d7aa85c928e5ac5',
} as const;

// Teams workflow
export const TEAMS = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5ac3',
  PHASE_ID: '697d1e905d7aa85c928e5ad6',
  FIELD_KEYS: {
    TEAM_INFO: 'teamInfo',
    HEAD_OF_TEAM: 'headOfTeam',
    PARENT_TEAM: 'parentTeam',
    IS_TOP_TEAM: 'isTopTeam',
  },
} as const;

// Vacancies workflow
export const VACANCIES = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5b39',
  PHASE_IDS: {
    PUBLISHED: '697d1e905d7aa85c928e5b4a',
    ARCHIVE: '697d1e905d7aa85c928e5b4b',
  },
  FIELD_KEYS: {
    POSITION: 'position',
    TEAM: 'team',
    APPLICATION_PERIOD: 'applicationPeriod',
  },
} as const;

// Disciplinary Actions workflow
export const DISCIPLINARY_ACTIONS = {
  WORKFLOW_ID: '697d1e905d7aa85c928e5aa2',
  PHASE_ID: '697d1e905d7aa85c928e5aac',
  FIELD_IDS: {
    NAME: '697d1e905d7aa85c928e5aa5', // ActivityLink to Employee (no key set, using ID directly)
  },
} as const;

// All workflow IDs that need schema fetching
export const ALL_WORKFLOW_IDS = [
  WORKFLOW_ID,
  TEAMS.WORKFLOW_ID,
  CHANGE_MANAGEMENT.WORKFLOW_ID,
  VACANCIES.WORKFLOW_ID,
  DISCIPLINARY_ACTIONS.WORKFLOW_ID,
] as const;
