import { sendAutomatedLeadStatusEmail } from './leadStatusEmailService.js';
import { sendAutomatedLeadStatusWhatsApp } from './leadStatusWhatsAppService.js';

export const resolveLeadNotificationChannels = (lead) => ({
  emailEnabled: lead?.notificationPreferences?.emailEnabled === true,
  whatsappEnabled: lead?.notificationPreferences?.whatsappEnabled === true,
});

export const sendAutomatedLeadStatusNotifications = async (context) => {
  const { emailEnabled, whatsappEnabled } = resolveLeadNotificationChannels(context?.lead);

  const [emailResult, whatsappResult] = await Promise.allSettled([
    emailEnabled
      ? sendAutomatedLeadStatusEmail(context)
      : Promise.resolve({ status: 'skipped', reason: 'disabled_for_lead' }),
    whatsappEnabled
      ? sendAutomatedLeadStatusWhatsApp(context)
      : Promise.resolve({ status: 'skipped', reason: 'disabled_for_lead' }),
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
