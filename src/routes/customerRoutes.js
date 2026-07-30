import express from 'express';
import { getCustomers, getCustomerOptions, createCustomer, getCustomerById, updateCustomer, deleteCustomer, bulkCreateCustomers } from '../controllers/customerController.js';
import { protect } from '../middleware/authMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

router.post('/bulk', protect, requirePermission(PERMISSIONS.LEADS_CREATE), bulkCreateCustomers);
router.get('/options', protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCustomerOptions);

router.route('/')
  .get(protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCustomers)
  .post(protect, requirePermission(PERMISSIONS.LEADS_CREATE), createCustomer);

router.route('/:id')
  .get(protect, requirePermission(PERMISSIONS.LEADS_VIEW), getCustomerById)
  .put(protect, requirePermission(PERMISSIONS.LEADS_EDIT), updateCustomer)
  .delete(protect, requirePermission(PERMISSIONS.LEADS_DELETE), deleteCustomer);

export default router;
