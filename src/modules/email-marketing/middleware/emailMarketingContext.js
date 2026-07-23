import { getEmailMarketingConfig } from '../config/emailMarketingConfig.js';
import { ensureEmailMarketingContext } from '../services/workspaceService.js';

export const resolveEmailMarketingContext = async (req, res, next) => {
  try {
    if (!getEmailMarketingConfig().enabled) {
      return res.status(503).json({
        success: false,
        message: 'Email Marketing module is disabled',
        errors: [],
      });
    }

    req.emailMarketing = await ensureEmailMarketingContext(req.user);
    return next();
  } catch (error) {
    return next(error);
  }
};
