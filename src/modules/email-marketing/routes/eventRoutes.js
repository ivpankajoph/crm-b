import { Router, text } from 'express';

import {
  ingestSesWebhook,
  trackClick,
  trackOpen,
  unsubscribeAutomationExecution,
  unsubscribeRecipient,
} from '../controllers/eventController.js';

const router = Router();
const textBody = text({ type: ['text/plain', 'text/*'], limit: '1mb' });

router.post('/ses', textBody, ingestSesWebhook);
router.post('/ses/events', textBody, ingestSesWebhook);
router.get('/open/:recipientId.gif', trackOpen);
router.get('/click/:recipientId', trackClick);
router.get('/unsubscribe/:recipientId', unsubscribeRecipient);
router.post('/unsubscribe/:recipientId', unsubscribeRecipient);
router.get(
  '/automation-unsubscribe/:executionId',
  unsubscribeAutomationExecution,
);
router.post(
  '/automation-unsubscribe/:executionId',
  unsubscribeAutomationExecution,
);

export default router;
