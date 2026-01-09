// Employee Directory workflow
export const WORKFLOW_ID = '654245fac9a762197e96ce3f';

export const PHASE_IDS = {
  ACTIVE_EMPLOYEES: '654245fac9a762197e96ce57',
  ACTIVE_CONTRACTORS: '654245fac9a762197e96ce95',
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
  WORKFLOW_ID: '654245fac9a762197e96ce3f',
  PHASE_IDS: {
    ACTIVE_EMPLOYEES: '654245fac9a762197e96ce57',
    ACTIVE_CONTRACTORS: '654245fac9a762197e96ce95',
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
  WORKFLOW_ID: '654245fac9a762197e96ce4f',
  PHASE_ID: '654245fac9a762197e96ce55',
  FIELD_KEYS: {
    PERSON: 'person',
    EFFECTIVE_DATE: 'effectiveDate',
    PREVIOUS_POSITION: 'previousPosition',
    NEW_POSITION: 'newPosition',
  },
} as const;

// Positions workflow
export const POSITIONS = {
  WORKFLOW_ID: '654245fac9a762197e96ce52',
  PHASE_ID: '654245fac9a762197e96ce5d',
} as const;

// Teams workflow
export const TEAMS = {
  WORKFLOW_ID: '654245fac9a762197e96ce5f',
  PHASE_ID: '654245fac9a762197e96ce64',
  FIELD_KEYS: {
    TEAM_INFO: 'teamInfo',
    HEAD_OF_TEAM: 'headOfTeam',
    PARENT_TEAM: 'parentTeam',
  },
} as const;

// Vacancies workflow
export const VACANCIES = {
  WORKFLOW_ID: '654245fac9a762197e96cebc',
  PHASE_IDS: {
    PLANNING: '654245fac9a762197e96cecc',
    PUBLISHED: '654245fac9a762197e96cecd',
    ARCHIVE: '654245fac9a762197e96cece',
  },
  FIELD_KEYS: {
    POSITION: 'position',
    TEAM: 'team',
    APPLICATION_PERIOD: 'applicationPeriod',
  },
} as const;

// Disciplinary Actions workflow
export const DISCIPLINARY_ACTIONS = {
  WORKFLOW_ID: '654245fac9a762197e96ce3d',
  PHASE_ID: '654245fac9a762197e96ce47',
  FIELD_IDS: {
    NAME: '654245fac9a762197e96ce40', // ActivityLink to Employee (no key set, using ID directly)
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
