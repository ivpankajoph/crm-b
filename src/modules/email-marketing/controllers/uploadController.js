import fs from 'node:fs/promises';
import path from 'node:path';

import { errorResponse, successResponse } from '../../../utils/response.js';
import EmailMarketingMediaAsset from '../models/EmailMarketingMediaAsset.js';
import { recordEmailMarketingAudit } from '../services/auditService.js';
import { buildWorkspaceFilter } from '../services/workspaceService.js';

const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads', 'email-marketing');
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const safeName = (value = 'image') =>
  String(value)
    .replace(/\.[^.]+$/, '')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'image';

const hasValidSignature = (buffer, mimeType) => {
  if (mimeType === 'image/png') {
    return buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  }
  if (mimeType === 'image/jpeg') {
    return buffer.subarray(0, 3).toString('hex') === 'ffd8ff';
  }
  if (mimeType === 'image/gif') {
    return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
};

const storeImage = async ({ req, buffer, mimeType, originalName }) => {
  if (!buffer.length || buffer.length > MAX_IMAGE_SIZE) {
    const error = new Error('Image must be between 1 byte and 5 MB');
    error.statusCode = 413;
    throw error;
  }
  if (!MIME_EXTENSIONS[mimeType] || !hasValidSignature(buffer, mimeType)) {
    const error = new Error('Image content does not match an allowed image type');
    error.statusCode = 400;
    throw error;
  }

  const workspacePart = String(req.emailMarketing.workspaceId);
  const workspaceDirectory = path.join(UPLOAD_ROOT, workspacePart);
  await fs.mkdir(workspaceDirectory, { recursive: true });
  const fileName = `${safeName(originalName)}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${MIME_EXTENSIONS[mimeType]}`;
  const absolutePath = path.join(workspaceDirectory, fileName);
  await fs.writeFile(absolutePath, buffer, { flag: 'wx' });

  const relativePath = path.posix.join(
    'email-marketing',
    workspacePart,
    fileName,
  );
  const baseUrl = `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
  const url = `${baseUrl}/uploads/${relativePath}`;

  const asset = await EmailMarketingMediaAsset.create({
    workspaceId: req.emailMarketing.workspaceId,
    originalName: originalName || fileName,
    fileName,
    relativePath,
    url,
    mimeType,
    size: buffer.length,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await recordEmailMarketingAudit({
    req,
    action: 'media.uploaded',
    resourceType: 'media_asset',
    resourceId: asset._id,
    metadata: { mimeType, size: buffer.length },
  });
  return asset;
};

export const uploadImageFile = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 400, 'Image file is required');
    const asset = await storeImage({
      req,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
    return successResponse(res, 201, 'Image uploaded successfully', asset);
  } catch (error) {
    return next(error);
  }
};

export const uploadImageDataUrl = async (req, res, next) => {
  try {
    const match = req.validated.body.dataUrl.match(
      /^data:(image\/(?:png|jpeg|gif|webp));base64,([a-z0-9+/=\s]+)$/i,
    );
    if (!match) return errorResponse(res, 400, 'Invalid image data URL');
    const asset = await storeImage({
      req,
      buffer: Buffer.from(match[2], 'base64'),
      mimeType: match[1].toLowerCase(),
      originalName: req.validated.body.filename,
    });
    return successResponse(res, 201, 'Image uploaded successfully', asset);
  } catch (error) {
    return next(error);
  }
};

export const listMediaAssets = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const items = await EmailMarketingMediaAsset.find(
      buildWorkspaceFilter(req.emailMarketing),
    )
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return successResponse(res, 200, 'Media assets fetched successfully', {
      items,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteMediaAsset = async (req, res, next) => {
  try {
    const asset = await EmailMarketingMediaAsset.findOneAndDelete(
      buildWorkspaceFilter(req.emailMarketing, {
        _id: req.validated.params.id,
      }),
    );
    if (!asset) return errorResponse(res, 404, 'Media asset not found');

    const workspaceDirectory = path.resolve(
      UPLOAD_ROOT,
      String(req.emailMarketing.workspaceId),
    );
    const absolutePath = path.resolve(process.cwd(), 'uploads', asset.relativePath);
    if (absolutePath.startsWith(`${workspaceDirectory}${path.sep}`)) {
      await fs.unlink(absolutePath).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }

    await recordEmailMarketingAudit({
      req,
      action: 'media.deleted',
      resourceType: 'media_asset',
      resourceId: asset._id,
      metadata: { fileName: asset.fileName },
    });
    return successResponse(res, 200, 'Media asset deleted successfully', null);
  } catch (error) {
    return next(error);
  }
};
