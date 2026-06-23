export const NOTIFICATION_TYPES = {
  INVITE: 'invite',
  PROJECT_UPDATE: 'project_update',
  PROJECT_PEER_REQUEST: 'project_peer_request',
  PEER_REQUEST: 'peer_request',
  COMMENT: 'comment',
  PROJECT_COMMENT: 'project_comment',
  PEER_MESSAGE: 'peer_message',
  TASK_ASSIGNMENT: 'task_assignment',
  DEADLINE_REMINDER: 'deadline_reminder',
};

export const NOTIFICATION_PREFERENCE_DETAILS = {
  [NOTIFICATION_TYPES.INVITE]: {
    label: 'Invites',
    description: 'Workspace and collaboration invites that need your response.',
  },
  [NOTIFICATION_TYPES.PROJECT_UPDATE]: {
    label: 'Project updates',
    description: 'General activity and progress changes across your projects.',
  },
  [NOTIFICATION_TYPES.PROJECT_PEER_REQUEST]: {
    label: 'Project peer requests',
    description: 'Requests to join or collaborate within a specific project.',
  },
  [NOTIFICATION_TYPES.PEER_REQUEST]: {
    label: 'Peer requests',
    description: 'Direct peer requests from other people on the platform.',
  },
  [NOTIFICATION_TYPES.COMMENT]: {
    label: 'Comments',
    description: 'Replies and discussion on work you are involved in.',
  },
  [NOTIFICATION_TYPES.PROJECT_COMMENT]: {
    label: 'Project comments',
    description: 'Project-specific comment threads and follow-up discussion.',
  },
  [NOTIFICATION_TYPES.PEER_MESSAGE]: {
    label: 'Chat messages',
    description: 'Direct chat messages and one-to-one conversation activity.',
  },
  [NOTIFICATION_TYPES.TASK_ASSIGNMENT]: {
    label: 'Task assignments',
    description: 'New task ownership and assignment changes that affect you.',
  },
  [NOTIFICATION_TYPES.DEADLINE_REMINDER]: {
    label: 'Deadline reminders',
    description: 'Upcoming due dates for work assigned to you or owned by you.',
  },
} as const;

export const NOTIFICATION_DEFAULT_PREFERENCES = {
  [NOTIFICATION_TYPES.INVITE]: {
    in_app: true,
    email: true,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.PROJECT_UPDATE]: {
    in_app: true,
    email: false,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.PROJECT_PEER_REQUEST]: {
    in_app: true,
    email: true,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.PEER_REQUEST]: {
    in_app: true,
    email: true,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.COMMENT]: {
    in_app: true,
    email: false,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.PROJECT_COMMENT]: {
    in_app: true,
    email: false,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.PEER_MESSAGE]: {
    in_app: true,
    email: false,
    push: true,
    sound: true,
  },
  [NOTIFICATION_TYPES.TASK_ASSIGNMENT]: {
    in_app: true,
    email: true,
    push: false,
    sound: true,
  },
  [NOTIFICATION_TYPES.DEADLINE_REMINDER]: {
    in_app: true,
    email: true,
    push: true,
    sound: true,
  },
};
