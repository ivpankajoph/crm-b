import mongoose from 'mongoose';

import Team from '../models/Team.js';
import User from '../models/User.js';
import Role from '../models/Role.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logActivity } from '../utils/activity.js';
import {
  getAccountUserIds,
  resolveAccountOwnerId,
} from '../services/accessControlService.js';
import {
  cacheKeys,
  getReferenceCacheVersion,
  invalidateAccessCaches,
  invalidateAuthenticatedUserCache,
  invalidateTeamReferenceCaches,
  withJsonCache,
} from '../services/cacheService.js';

const normalizeIds = (values = []) => Array.from(new Set(
  (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => mongoose.isValidObjectId(value)),
));

const populateTeam = (query) => query
  .populate('manager', 'name email role status')
  .populate('members', 'name email role status')
  .populate('defaultRole', 'name level status')
  .populate('createdBy', 'name email');

const assertUsersBelongToAccount = async (ownerId, userIds) => {
  if (!userIds.length) return;
  const allowedIds = new Set(await getAccountUserIds(ownerId));
  const invalid = userIds.find((id) => !allowedIds.has(String(id)));
  if (invalid) {
    const error = new Error('One or more selected users do not belong to this account');
    error.statusCode = 400;
    throw error;
  }
};

const syncTeamOnUsers = async (teamId, memberIds) => {
  await User.updateMany({ teams: teamId }, { $pull: { teams: teamId } });
  if (memberIds.length) {
    await User.updateMany(
      { _id: { $in: memberIds } },
      { $addToSet: { teams: teamId } },
    );
  }
};

export const getTeams = async (req, res, next) => {
  try {
    const ownerId = await resolveAccountOwnerId(req.user);
    const filter = { createdBy: ownerId };
    const status = req.query.status && req.query.status !== 'all'
      ? req.query.status
      : 'all';
    if (status !== 'all') {
      filter.status = status;
    }
    const version = await getReferenceCacheVersion();
    const { value: teams } = await withJsonCache(
      { key: cacheKeys.teams(version, ownerId, status), ttlSeconds: 300 },
      () => populateTeam(Team.find(filter).sort({ status: 1, name: 1 })).lean(),
    );
    return successResponse(res, 200, 'Teams fetched successfully', teams);
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req, res, next) => {
  try {
    const ownerId = await resolveAccountOwnerId(req.user);
    const memberIds = normalizeIds(req.body.memberIds);
    const managerId = mongoose.isValidObjectId(req.body.managerId)
      ? String(req.body.managerId)
      : null;
    await assertUsersBelongToAccount(
      ownerId,
      [...memberIds, managerId].filter(Boolean),
    );

    if (req.body.defaultRoleId) {
      const roleExists = await Role.exists({ _id: req.body.defaultRoleId });
      if (!roleExists) return errorResponse(res, 400, 'Selected default role does not exist');
    }

    const existing = await Team.findOne({
      createdBy: ownerId,
      name: String(req.body.name || '').trim(),
    });
    if (existing) return errorResponse(res, 400, 'A team with this name already exists');

    const team = await Team.create({
      name: req.body.name,
      description: req.body.description || '',
      manager: managerId,
      members: memberIds,
      defaultRole: req.body.defaultRoleId || null,
      status: req.body.status === 'inactive' ? 'inactive' : 'active',
      createdBy: ownerId,
      updatedBy: req.user._id,
    });
    await syncTeamOnUsers(team._id, memberIds);

    await logActivity({
      user: req.user._id,
      actionType: 'team_created',
      description: `Created team ${team.name}`,
      entityType: 'Team',
      entityId: team._id,
      metadata: { manager: managerId, memberIds },
    });
    await Promise.all([
      invalidateTeamReferenceCaches(),
      invalidateAccessCaches(),
      ...memberIds.map(invalidateAuthenticatedUserCache),
    ]);

    const populated = await populateTeam(Team.findById(team._id));
    return successResponse(res, 201, 'Team created successfully', populated);
  } catch (error) {
    if (error?.code === 11000) {
      return errorResponse(res, 400, 'A team with this name already exists');
    }
    next(error);
  }
};

export const updateTeam = async (req, res, next) => {
  try {
    const ownerId = await resolveAccountOwnerId(req.user);
    const team = await Team.findOne({ _id: req.params.id, createdBy: ownerId });
    if (!team) return errorResponse(res, 404, 'Team not found');

    const memberIds = req.body.memberIds === undefined
      ? team.members.map(String)
      : normalizeIds(req.body.memberIds);
    const previousMemberIds = team.members.map(String);
    const managerId = req.body.managerId === undefined
      ? team.manager?.toString() || null
      : mongoose.isValidObjectId(req.body.managerId)
        ? String(req.body.managerId)
        : null;
    await assertUsersBelongToAccount(
      ownerId,
      [...memberIds, managerId].filter(Boolean),
    );

    if (req.body.name) team.name = req.body.name;
    if (req.body.description !== undefined) team.description = req.body.description;
    if (req.body.managerId !== undefined) team.manager = managerId;
    if (req.body.memberIds !== undefined) team.members = memberIds;
    if (req.body.defaultRoleId !== undefined) {
      if (req.body.defaultRoleId) {
        const roleExists = await Role.exists({ _id: req.body.defaultRoleId });
        if (!roleExists) return errorResponse(res, 400, 'Selected default role does not exist');
      }
      team.defaultRole = req.body.defaultRoleId || null;
    }
    if (['active', 'inactive'].includes(req.body.status)) team.status = req.body.status;
    team.updatedBy = req.user._id;
    await team.save();
    await syncTeamOnUsers(team._id, memberIds);

    await logActivity({
      user: req.user._id,
      actionType: 'team_updated',
      description: `Updated team ${team.name}`,
      entityType: 'Team',
      entityId: team._id,
      metadata: { manager: managerId, memberIds, status: team.status },
    });
    await Promise.all([
      invalidateTeamReferenceCaches(),
      invalidateAccessCaches(),
      ...Array.from(new Set([...previousMemberIds, ...memberIds]))
        .map(invalidateAuthenticatedUserCache),
    ]);

    const populated = await populateTeam(Team.findById(team._id));
    return successResponse(res, 200, 'Team updated successfully', populated);
  } catch (error) {
    if (error?.code === 11000) {
      return errorResponse(res, 400, 'A team with this name already exists');
    }
    next(error);
  }
};

export const deactivateTeam = async (req, res, next) => {
  try {
    const ownerId = await resolveAccountOwnerId(req.user);
    const team = await Team.findOne({ _id: req.params.id, createdBy: ownerId });
    if (!team) return errorResponse(res, 404, 'Team not found');

    const previousMemberIds = team.members.map(String);
    team.status = 'inactive';
    team.updatedBy = req.user._id;
    await team.save();
    await syncTeamOnUsers(team._id, []);

    await logActivity({
      user: req.user._id,
      actionType: 'team_deactivated',
      description: `Deactivated team ${team.name}`,
      entityType: 'Team',
      entityId: team._id,
    });
    await Promise.all([
      invalidateTeamReferenceCaches(),
      invalidateAccessCaches(),
      ...previousMemberIds.map(invalidateAuthenticatedUserCache),
    ]);

    return successResponse(res, 200, 'Team deactivated successfully', team);
  } catch (error) {
    next(error);
  }
};
