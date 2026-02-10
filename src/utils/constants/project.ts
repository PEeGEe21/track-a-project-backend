export enum ProjectStatus {
  ACTIVE = 'active',
  UPCOMING = 'upcoming',
  IN_PROGRESS = 'in_progress',
  INACTIVE = 'inactive',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
  PAUSED = 'paused',
  ON_REVIEW = 'on_review',
  OVERDUE = 'overdue',
  DRAFT = 'draft',
}

export const statusColors = {
  [ProjectStatus.ACTIVE]: '#22C55E',
  [ProjectStatus.UPCOMING]: '#3b82f6',
  [ProjectStatus.IN_PROGRESS]: '#3b82f6',
  [ProjectStatus.COMPLETED]: '#10b981',
  [ProjectStatus.ON_HOLD]: '#f59e0b',
  [ProjectStatus.INACTIVE]: '#6b7280',
  [ProjectStatus.CANCELLED]: '#ef4444',
  [ProjectStatus.PAUSED]: '#ca8a04',
  [ProjectStatus.ON_REVIEW]: '#8b5cf6',
  [ProjectStatus.OVERDUE]: '#ef4444',
  [ProjectStatus.DRAFT]: '#6b7280',
};

export const statusLabels = {
  [ProjectStatus.ACTIVE]: 'Active',
  [ProjectStatus.IN_PROGRESS]: 'In Progress',
  [ProjectStatus.COMPLETED]: 'Completed',
  [ProjectStatus.UPCOMING]: 'Upcoming',
  [ProjectStatus.PAUSED]: 'Paused',
  [ProjectStatus.ON_HOLD]: 'On Hold',
  [ProjectStatus.INACTIVE]: 'Inactive',
  [ProjectStatus.CANCELLED]: 'Cancelled',
  [ProjectStatus.ON_REVIEW]: 'In Review',
  [ProjectStatus.OVERDUE]: 'Overdue',
  [ProjectStatus.DRAFT]: 'Draft',
};
