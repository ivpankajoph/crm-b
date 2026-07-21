import express from 'express';
import { adminOnly, protect } from '../middleware/authMiddleware.js';
import { answerBrowserCall, answerClickToCall, buyNumber, finalizeBrowserCall, getCallLogDetails, getTelephonyConfig, hangupClickToCall, listCallLogs, recordingCallback, searchNumbers, selectNumber, transcriptionCallback } from '../controllers/telephonyController.js';

const router = express.Router();
router.post('/webhooks/answer/:callLogId/:token', answerClickToCall);
router.post('/webhooks/hangup/:callLogId/:token', hangupClickToCall);
router.post('/webhooks/browser-answer', answerBrowserCall);
router.post('/webhooks/recording/:callLogId/:token', recordingCallback);
router.post('/webhooks/transcription/:callLogId/:token', transcriptionCallback);
router.get('/calls', protect, listCallLogs);
router.get('/calls/:callLogId', protect, getCallLogDetails);
router.post('/calls/:callLogId/finalize', protect, finalizeBrowserCall);
router.get('/numbers', protect, adminOnly, getTelephonyConfig);
router.get('/numbers/search', protect, adminOnly, searchNumbers);
router.post('/numbers/buy', protect, adminOnly, buyNumber);
router.put('/numbers/default', protect, adminOnly, selectNumber);
export default router;
