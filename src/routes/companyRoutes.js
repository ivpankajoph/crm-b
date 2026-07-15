import express from 'express';
import { getCompanies, createCompany, getCompanyById, updateCompany, deleteCompany, bulkCreateCompanies } from '../controllers/companyController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/bulk', protect, bulkCreateCompanies);

router.route('/')
  .get(protect, getCompanies)
  .post(protect, createCompany);

router.route('/:id')
  .get(protect, getCompanyById)
  .put(protect, updateCompany)
  .delete(protect, deleteCompany);

export default router;
