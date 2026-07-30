import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';

import {
  LEGACY_PAGE_PERMISSION_MAP,
  PERMISSIONS,
  PERMISSION_VALUES,
  legacyPermissionsToGrants,
  sanitizeDataScopes,
  expandImpliedPermissions,
} from '../../constants/permissions.js';
import { userHasPermission } from '../accessControlService.js';
import Role from '../../models/Role.js';
import User from '../../models/User.js';
import Team from '../../models/Team.js';
import ResourceAccess from '../../models/ResourceAccess.js';
import LeadMessage from '../../models/LeadMessage.js';
import roleRoutes from '../../routes/roleRoutes.js';
import teamRoutes from '../../routes/teamRoutes.js';
import templateAccessRoutes from '../../routes/templateAccessRoutes.js';
import employeeRoutes from '../../routes/employeeRoutes.js';
import dashboardRoutes from '../../routes/dashboardRoutes.js';
import companyRoutes from '../../routes/companyRoutes.js';
import attendanceRoutes from '../../routes/attendanceRoutes.js';
import telephonyRoutes from '../../routes/telephonyRoutes.js';
import reportsRoutes from '../../routes/reportsRoutes.js';
import settingsRoutes from '../../routes/settingsRoutes.js';
import followUpRoutes from '../../routes/followUpRoutes.js';
import auditLogRoutes from '../../routes/auditLogRoutes.js';
import {
  buildEmployeeVisibilityQuery,
  combineEmployeeFilters,
} from '../employeeAccessService.js';

test('permission catalog is unique and legacy lead access remains compatible', () => {
  assert.equal(new Set(PERMISSION_VALUES).size, PERMISSION_VALUES.length);
  const migrated = legacyPermissionsToGrants(['/companies']);
  assert.ok(migrated.includes(PERMISSIONS.LEADS_VIEW));
  assert.ok(migrated.includes(PERMISSIONS.LEADS_CHANGE_STATUS));
  assert.ok(migrated.includes(PERMISSIONS.LEADS_ASSIGN));
  assert.equal(
    LEGACY_PAGE_PERMISSION_MAP['/email-marketing'].includes(PERMISSIONS.EMAIL_SEND_LEAD),
    true,
  );
});

test('permission checks support exact, namespace, and administrator grants', () => {
  assert.equal(userHasPermission({ grants: ['leads.view'] }, 'leads.view'), true);
  assert.equal(userHasPermission({ grants: ['leads.*'] }, 'leads.edit'), true);
  assert.equal(userHasPermission({ grants: ['*'] }, 'admin.users.manage'), true);
  assert.equal(userHasPermission({ grants: ['leads.view'] }, 'leads.delete'), false);
});

test('action permissions include the page access required to use them', () => {
  const grants = expandImpliedPermissions([
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.EMAIL_TEMPLATES_SHARE,
    PERMISSIONS.ADMIN_TEAMS_MANAGE,
  ]);
  assert.ok(grants.includes(PERMISSIONS.LEADS_VIEW));
  assert.ok(grants.includes(PERMISSIONS.ATTENDANCE_VIEW));
  assert.ok(grants.includes(PERMISSIONS.EMAIL_MODULE_VIEW));
  assert.ok(grants.includes(PERMISSIONS.ADMIN_TEAMS_VIEW));
});

test('data scopes reject unsupported values', () => {
  assert.deepEqual(
    sanitizeDataScopes({ leads: 'team', reports: 'all', unsafe: 'global' }),
    { leads: 'team', reports: 'all' },
  );
});

test('employee visibility queries keep own records isolated and preserve list filters', () => {
  const ownVisibility = buildEmployeeVisibilityQuery({
    scope: 'own',
    userIds: ['user-1'],
    userEmails: ['haidar@example.com'],
  });
  assert.deepEqual(ownVisibility, {
    $or: [
      { user: { $in: ['user-1'] } },
      { email: { $in: ['haidar@example.com'] } },
    ],
  });
  assert.deepEqual(buildEmployeeVisibilityQuery({ scope: 'all' }), {});
  assert.deepEqual(
    buildEmployeeVisibilityQuery({ scope: 'none' }),
    { _id: { $exists: false } },
  );
  assert.deepEqual(
    combineEmployeeFilters(ownVisibility, { status: 'Active' }),
    { $and: [ownVisibility, { status: 'Active' }] },
  );
});

test('access-control models preserve legacy fields while adding versioned access', () => {
  const ownerId = new mongoose.Types.ObjectId();
  const role = new Role({
    name: 'Compatibility Test Role',
    level: 'Level 4',
    createdBy: ownerId,
  });
  assert.equal(role.permissionVersion, 1);
  assert.deepEqual(role.grants, []);

  const user = new User({
    name: 'Safe User',
    email: 'safe@example.com',
    password: 'password123',
    role: 'Compatibility Test Role',
  });
  const serialized = user.toJSON();
  assert.equal(serialized.password, undefined);
  assert.deepEqual(serialized.permissionOverrides.allow, []);
});

test('team, resource sharing, and lead message schemas accept valid records', () => {
  const ownerId = new mongoose.Types.ObjectId();
  const team = new Team({
    name: 'North Sales',
    createdBy: ownerId,
    updatedBy: ownerId,
  });
  assert.equal(team.validateSync(), undefined);

  const sharing = new ResourceAccess({
    resourceType: 'email_template',
    resourceId: 'template-1',
    resourceName: 'Welcome',
    ownerUserId: ownerId,
    createdBy: ownerId,
    updatedBy: ownerId,
  });
  assert.equal(sharing.validateSync(), undefined);

  const message = new LeadMessage({
    lead: new mongoose.Types.ObjectId(),
    leadModel: 'Company',
    channel: 'email',
    templateId: 'template-1',
    templateName: 'Welcome',
    recipient: 'lead@example.com',
    createdBy: ownerId,
  });
  assert.equal(message.validateSync(), undefined);
});

const routePaths = (router) => router.stack
  .map((layer) => layer.route?.path)
  .filter(Boolean);

test('administration access routes remain registered', () => {
  assert.ok(routePaths(roleRoutes).includes('/catalog'));
  assert.ok(routePaths(roleRoutes).includes('/:id/access'));
  assert.ok(routePaths(teamRoutes).includes('/'));
  assert.ok(routePaths(templateAccessRoutes).includes('/available'));
});

test('employee routes enforce permissions before list, detail, and write controllers', () => {
  const route = (path) => employeeRoutes.stack.find((layer) => layer.route?.path === path)?.route;
  const handlerCount = (path, method) => (
    route(path)?.stack.filter((layer) => layer.method === method).length || 0
  );

  assert.equal(handlerCount('/paged', 'get'), 3);
  assert.equal(handlerCount('/', 'get'), 3);
  assert.equal(handlerCount('/', 'post'), 3);
  assert.equal(handlerCount('/:id', 'get'), 3);
  assert.equal(handlerCount('/:id', 'put'), 3);
  assert.equal(handlerCount('/:id', 'delete'), 3);
});

test('audited feature routes include authentication and permission middleware', () => {
  const handlerCount = (router, path, method) => {
    const route = router.stack.find((layer) => (
      layer.route?.path === path && layer.route?.methods?.[method]
    ))?.route;
    return route?.stack.filter((layer) => layer.method === method).length || 0;
  };

  assert.equal(handlerCount(dashboardRoutes, '/metrics', 'get'), 3);
  assert.equal(handlerCount(companyRoutes, '/paged', 'get'), 3);
  assert.equal(handlerCount(attendanceRoutes, '/report', 'get'), 3);
  assert.equal(handlerCount(telephonyRoutes, '/calls', 'get'), 3);
  // Authentication is registered once with router.use(), then permission + controller.
  assert.equal(handlerCount(reportsRoutes, '/sales', 'get'), 2);
  assert.equal(handlerCount(settingsRoutes, '/', 'get'), 1);
  assert.equal(handlerCount(followUpRoutes, '/lead/:leadId', 'post'), 4);
  assert.equal(handlerCount(auditLogRoutes, '/', 'get'), 3);
});
