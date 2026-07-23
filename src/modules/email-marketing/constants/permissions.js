export const EMAIL_MARKETING_PERMISSIONS = Object.freeze({
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_CAMPAIGNS: 'manage_campaigns',
  EDIT_CONTENT: 'edit_content',
  MANAGE_AUDIENCE: 'manage_audience',
  MANAGE_AUTOMATIONS: 'manage_automations',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SENDING_DOMAINS: 'manage_sending_domains',
  VIEW_BILLING: 'view_billing',
  MANAGE_TEAM_ACCESS: 'manage_team_access',
  MANAGE_SETTINGS: 'manage_settings',
});

export const EMAIL_MARKETING_PERMISSION_VALUES = Object.freeze(
  Object.values(EMAIL_MARKETING_PERMISSIONS),
);

const VIEW_ONLY = [
  EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD,
  EMAIL_MARKETING_PERMISSIONS.VIEW_ANALYTICS,
  EMAIL_MARKETING_PERMISSIONS.VIEW_REPORTS,
];

const EDITOR = [
  ...VIEW_ONLY,
  EMAIL_MARKETING_PERMISSIONS.MANAGE_CAMPAIGNS,
  EMAIL_MARKETING_PERMISSIONS.EDIT_CONTENT,
  EMAIL_MARKETING_PERMISSIONS.MANAGE_AUDIENCE,
];

const MANAGER = [
  ...EDITOR,
  EMAIL_MARKETING_PERMISSIONS.MANAGE_AUTOMATIONS,
  EMAIL_MARKETING_PERMISSIONS.MANAGE_SENDING_DOMAINS,
];

export const EMAIL_MARKETING_ROLE_DEFAULTS = Object.freeze({
  owner: EMAIL_MARKETING_PERMISSION_VALUES,
  admin: EMAIL_MARKETING_PERMISSION_VALUES,
  super_admin: EMAIL_MARKETING_PERMISSION_VALUES,
  manager: MANAGER,
  editor: EDITOR,
  analyst: VIEW_ONLY,
  viewer: [EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD],
});

export const normalizeEmailMarketingRole = (role = '') =>
  String(role).trim().toLowerCase().replace(/[\s-]+/g, '_');

export const getDefaultEmailMarketingPermissions = (role = '') => {
  const normalized = normalizeEmailMarketingRole(role);
  if (EMAIL_MARKETING_ROLE_DEFAULTS[normalized]) {
    return [...EMAIL_MARKETING_ROLE_DEFAULTS[normalized]];
  }
  if (normalized.includes('admin')) return [...EMAIL_MARKETING_PERMISSION_VALUES];
  if (normalized.includes('manager')) return [...MANAGER];
  if (normalized.includes('analyst')) return [...VIEW_ONLY];
  return [EMAIL_MARKETING_PERMISSIONS.VIEW_DASHBOARD];
};

export const sanitizeEmailMarketingPermissions = (permissions = []) => {
  const allowed = new Set(EMAIL_MARKETING_PERMISSION_VALUES);
  return Array.from(new Set(permissions.filter((permission) => allowed.has(permission))));
};
