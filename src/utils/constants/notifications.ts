export const NOTIFICATION_TYPES = {
  INVITE: 'invite',
  PROJECT_UPDATE: 'project_update',
  PROJECT_PEER_REQUEST: 'project_peer_request',
  PEER_REQUEST: 'peer_request',
  COMMENT: 'comment',
  PROJECT_COMMENT: 'project_comment',
};

export const NOTIFICATION_DEFAULT_PREFERENCES = {
  [NOTIFICATION_TYPES.INVITE]: { in_app: true, email: true, push: false },
  [NOTIFICATION_TYPES.PROJECT_UPDATE]: {
    in_app: true,
    email: false,
    push: false,
  },
  [NOTIFICATION_TYPES.PEER_REQUEST]: { in_app: true, email: true, push: false },
  [NOTIFICATION_TYPES.COMMENT]: { in_app: true, email: false, push: false },
};
