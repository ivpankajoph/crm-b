import Role from '../models/Role.js';
import Team from '../models/Team.js';
import User from '../models/User.js';
import {
  legacyPermissionsToGrants,
  normalizePermissionList,
  sanitizeDataScopes,
  expandImpliedPermissions,
  IMPLIED_PERMISSIONS,
} from '../constants/permissions.js';
import { isAdminUser } from '../utils/hierarchy.js';

const DEFAULT_SCOPES = Object.freeze({
  leads: 'own',
  employees: 'own',
  attendance: 'own',
  calls: 'own',
  reports: 'own',
});

const getRoleForUser = async (user) => {
  if (user?.roleRef) {
    const role = await Role.findById(user.roleRef).lean();
    if (role) return role;
  }
  if (!user?.role) return null;
  return Role.findOne({ name: user.role }).lean();
};

export const resolveAccountOwnerId = async (user) => {
  let current = user;
  const visited = new Set();

  for (let depth = 0; depth < 50 && current?._id; depth += 1) {
    const currentId = String(current._id);
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const parentId = current.parent || current.createdBy;
    if (!parentId || String(parentId) === currentId) return current._id;

    const parent = await User.findById(parentId)
      .select('_id parent createdBy')
      .lean();
    if (!parent) return current._id;
    current = parent;
  }

  return user._id;
};

export const resolveEffectiveAccess = async (user) => {
  if (!user) {
    return {
      isAdmin: false,
      permissions: [],
      grants: [],
      scopes: { ...DEFAULT_SCOPES },
      teamIds: [],
      roleId: null,
      accessVersion: 1,
    };
  }

  if (isAdminUser(user)) {
    return {
      isAdmin: true,
      permissions: [],
      grants: ['*'],
      scopes: Object.fromEntries(
        Object.keys(DEFAULT_SCOPES).map((key) => [key, 'all']),
      ),
      teamIds: (user.teams || []).map(String),
      roleId: user.roleRef ? String(user.roleRef) : null,
      accessVersion: 2,
    };
  }

  const role = await getRoleForUser(user);
  const legacyPermissions = normalizePermissionList(role?.permissions);
  const accessVersion = Number(role?.permissionVersion || 1);
  const baseGrants = normalizePermissionList([
    ...(role?.grants || []),
    ...(accessVersion < 2 ? legacyPermissionsToGrants(legacyPermissions) : []),
  ]);
  const allowed = normalizePermissionList(user.permissionOverrides?.allow);
  const denied = new Set(normalizePermissionList(user.permissionOverrides?.deny));
  const grants = expandImpliedPermissions([...baseGrants, ...allowed])
    .filter((permission) => (
      !denied.has(permission)
      && !(IMPLIED_PERMISSIONS[permission] || []).some((required) => denied.has(required))
    ));

  const scopes = {
    ...DEFAULT_SCOPES,
    ...sanitizeDataScopes(role?.dataScopes),
    ...sanitizeDataScopes(user.scopeOverrides),
  };

  return {
    isAdmin: false,
    permissions: legacyPermissions,
    grants,
    scopes,
    teamIds: (user.teams || []).map(String),
    roleId: role?._id ? String(role._id) : null,
    accessVersion,
  };
};

export const userHasPermission = (access, requiredPermission) => {
  if (!requiredPermission) return true;
  const grants = new Set(access?.grants || []);
  if (grants.has('*') || grants.has(requiredPermission)) return true;

  const [namespace] = requiredPermission.split('.');
  return grants.has(`${namespace}.*`);
};

export const getUserTeamMemberIds = async (user) => {
  const teamIds = (user?.teams || []).filter(Boolean);
  if (!teamIds.length) return [user._id];

  const teams = await Team.find({
    _id: { $in: teamIds },
    status: 'active',
  }).select('members manager').lean();

  return Array.from(new Set([
    String(user._id),
    ...teams.flatMap((team) => [
      team.manager ? String(team.manager) : null,
      ...(team.members || []).map(String),
    ]).filter(Boolean),
  ]));
};
