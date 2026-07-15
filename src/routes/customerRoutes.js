import express from 'express';
import { getCustomers, createCustomer, getCustomerById, updateCustomer, deleteCustomer, bulkCreateCustomers } from '../controllers/customerController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/bulk', protect, bulkCreateCustomers);

router.route('/')
  .get(protect, getCustomers)
  .post(protect, createCustomer);

router.route('/:id')
  .get(protect, getCustomerById)
  .put(protect, updateCustomer)
  .delete(protect, deleteCustomer);

export default router;
