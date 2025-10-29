
export enum ActivityType {
    PROJECT_COMMENT = 'comment',
    TASK_CREATED = 'task_created', // done
    TASK_UPDATED = 'task_updated', // done
    TASK_COMPLETED = 'task_completed',
    TASK_DELETED = 'task_deleted', // done
    PEER_ADDED = 'peer_added',
    PEER_REMOVED = 'peer_removed',
    RESOURCE_ADDED = 'resource_added', // done
    RESOURCE_DELETED = 'resource_deleted', // done
    STATUS_CHANGE = 'status_change',
    PROJECT_UPDATED = 'project_updated',
  }