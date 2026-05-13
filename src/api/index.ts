// Re-export every domain module as a single API surface.
//
// Consumers: `import { soldiersApi, missionsApi } from '../api';`

export * as soldiersApi      from './soldiers';
export * as missionsApi      from './missions';
export * as announcementsApi from './announcements';
export * as escalationsApi   from './escalations';
export * as leavesApi        from './leaves';
export * as reportsApi       from './reports';
export * as alertsApi        from './alerts';
