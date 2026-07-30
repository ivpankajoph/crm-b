import express from 'express';
import { getCompanies, getCompaniesPaged, getCompanyOptions, createCompany, getCompanyById, updateCompany, deleteCompany, bulkCreateCompanies } from '../controllers/companyController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.post('/bulk', protect, requirePermission(PERMISSIONS.LEADS_CREATE), bulkCreateCompanies);
router.get('/paged', protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCompaniesPaged);
router.get('/options', protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCompanyOptions);

router.route('/')
  .get(protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCompanies)
  .post(protect, requirePermission(PERMISSIONS.LEADS_CREATE), createCompany);

router.route('/:id')
  .get(protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCompanyById)
  .put(protect, requirePermission(PERMISSIONS.LEADS_EDIT), updateCompany)
  .delete(protect, requirePermission(PERMISSIONS.LEADS_DELETE), deleteCompany);

export default router;
