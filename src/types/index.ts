export interface VacancyHead {
  _id: string;
  name: string;
  applicationPeriod?: {
    start: number;
    end: number;
  };
  process: string; // Workflow ID (VACANCIES.WORKFLOW_ID)
  team?: { _id: string; name: string }; // The team this vacancy belongs to
}

export interface Employee {
  _id: string;
  name: string;
  firstname?: string;
  lastname?: string;
  position?: { _id: string; name: string } | string | null;
  team?: { _id: string; name: string } | string | null;
  supervisor?: {
    _id: string;
    name: string;
  } | null;
  // Visual supervisor for org chart tree building - computed from team's head_of_team
  // This may differ from Hailer's supervisor field which skips vacancies
  visualSupervisor?: {
    _id: string;
    name: string;
  } | null;
  avatar?: string;
  headOfTeam?: {
    _id: string;
    name: string;
  } | null;
  nationality?: string | null;
  dateOfBirth?: number | null; // Timestamp of date of birth
  salary?: number | null; // Monthly salary amount
  totalCost?: number | null; // Total employment cost (salary + side costs for employees, consultancy fee for contractors)
  created?: number; // Creation timestamp for sorting
  pending?: boolean; // True when this is a skeleton placeholder or vacancy head
  skeletonData?: SkeletonNode; // Populated when this is a skeleton
  vacancyHead?: VacancyHead; // Populated when this node represents a vacancy head
  isVacancy?: boolean; // True when this is a vacancy (not a real employee)
  vacancyData?: VacancyHead; // Full vacancy data (for vacancies as first-class nodes)
  status?: string | null; // Employment status (Active, Long sick leave, Parental leave, Study leave)
  hasDisciplinaryAction?: boolean; // True if employee has any disciplinary action linked
}

export interface PendingNode {
  tempId: string;
  parentId: string;
  type: 'employee' | 'team';
  createdAt: number;
}

export interface TreeNode {
  employee: Employee;
  children: TreeNode[];
}

// Team info for multi-team chevron display
export interface TeamInfo {
  id: string | null;
  name: string;
  memberCount: number;
  totalDescendants: number;
  color?: string; // Color assigned for visual distinction in multi-team view
  vacancyHead?: VacancyHead; // Vacancy serving as head of team
}

// Skeleton card types for org chart planning
export type SkeletonState = 'empty' | 'title_only' | 'with_details' | 'has_vacancy';

export interface SkeletonNode {
  tempId: string;           // Unique identifier (e.g., skeleton-{timestamp})
  parentId: string | null;  // Parent employee/skeleton ID, null for root-level
  parentTeamId: string | null; // Team ID for skeletons under real parents
  state: SkeletonState;
  title?: string;           // Position/title (for title_only and with_details states)
  employeeName?: string;    // Employee name (for with_details state)
  createdAt: number;        // Timestamp for ordering
  vacancy?: {               // Vacancy information (for has_vacancy state)
    _id: string;
    name: string;
    applicationPeriod?: {
      start: number;
      end: number;
    };
  };
}

export interface SkeletonConfig {
  skeletons: SkeletonNode[];
  version: number;          // For migration if schema changes
}
