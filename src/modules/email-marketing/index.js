import { Router } from 'express';

import { protect } from '../../middleware/authMiddleware.js';
import { resolveEmailMarketingContext } from './middleware/emailMarketingContext.js';
import { emailMarketingErrorHandler } from './middleware/emailMarketingErrorHandler.js';
import campaignRoutes from './routes/campaignRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import automationRoutes from './routes/automationRoutes.js';
import billingRoutes from './routes/billingRoutes.js';
import domainRoutes from './routes/domainRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import foundationRoutes from './routes/foundationRoutes.js';
import segmentRoutes from './routes/segmentRoutes.js';
import subscriberRoutes from './routes/subscriberRoutes.js';
import suppressionRoutes from './routes/suppressionRoutes.js';
import templateRoutes from './routes/templateRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import integrationRoutes from './routes/integrationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import teamRoutes from './routes/teamRoutes.js';

const emailMarketingRouter = Router();

// Tracking links and provider webhooks are authenticated by signed tokens/signatures.
emailMarketingRouter.use('/events', eventRoutes);

emailMarketingRouter.use(protect);
emailMarketingRouter.use(resolveEmailMarketingContext);
emailMarketingRouter.use('/analytics', analyticsRoutes);
emailMarketingRouter.use('/automations', automationRoutes);
emailMarketingRouter.use('/billing', billingRoutes);
emailMarketingRouter.use('/campaigns', campaignRoutes);
emailMarketingRouter.use('/domains', domainRoutes);
emailMarketingRouter.use('/integration', integrationRoutes);
emailMarketingRouter.use('/reports', reportRoutes);
emailMarketingRouter.use('/team', teamRoutes);
emailMarketingRouter.use('/subscribers', subscriberRoutes);
emailMarketingRouter.use('/segments', segmentRoutes);
emailMarketingRouter.use('/suppressions', suppressionRoutes);
emailMarketingRouter.use('/templates', templateRoutes);
emailMarketingRouter.use('/uploads', uploadRoutes);
emailMarketingRouter.use('/', foundationRoutes);
emailMarketingRouter.use(emailMarketingErrorHandler);

export default emailMarketingRouter;
