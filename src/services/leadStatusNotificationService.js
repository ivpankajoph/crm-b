import { sendAutomatedLeadStatusEmail } from './leadStatusEmailService.js';
import { sendAutomatedLeadStatusWhatsApp } from './leadStatusWhatsAppService.js';

export const sendAutomatedLeadStatusNotifications = async (context) => {
  const [emailResult, whatsappResult] = await Promise.allSettled([
    sendAutomatedLeadStatusEmail(context),
    sendAutomatedLeadStatusWhatsApp(context),
  ]);

  const normalizeResult = (channel, result) => {
    if (result.status === 'fulfilled') return result.value;
    const error = String(result.reason?.message || result.reason || `${channel} notification failed`);
    console.error(`Automated lead status ${channel} notification failed:`, error);
    return { status: 'failed', error };
  };

  return {
    email: normalizeResult('email', emailResult),
    whatsapp: normalizeResult('WhatsApp', whatsappResult),
  };
};
