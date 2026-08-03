import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAD_STATUS_EMAIL_THEMES,
  SELLERSLOGIN_SUPPORT_EMAIL,
  SELLERSLOGIN_WEBSITE,
  renderLeadStatusEmail,
} from '../leadStatusEmailTemplate.js';
import { saveLeadFollowUp } from '../../controllers/followUpController.js';
import {
  buildLeadStatusWhatsAppMessage,
  normalizeWhatsAppNumber,
} from '../leadStatusWhatsAppTemplate.js';

const baseLead = {
  companyName: 'Acme & Sons <India>',
  email1: 'contact@acme.example',
  leadStatus: 'New',
};

test('every supported lead status renders a distinct branded HTML theme', () => {
  const statuses = Object.keys(LEAD_STATUS_EMAIL_THEMES);
  assert.equal(statuses.length, 8);
  assert.equal(new Set(statuses.map((status) => LEAD_STATUS_EMAIL_THEMES[status].primary)).size, statuses.length);

  for (const status of statuses) {
    const lead = { ...baseLead, leadStatus: status };
    const rendered = renderLeadStatusEmail({ leadType: 'Company', lead, status });
    assert.match(rendered.html, /Dear <strong>Acme &amp; Sons &lt;India&gt;<\/strong>,/);
    assert.doesNotMatch(rendered.html, /Dear[^,]* Team,/);
    assert.match(rendered.html, new RegExp(SELLERSLOGIN_SUPPORT_EMAIL.replace('.', '\\.')));
    assert.match(rendered.html, new RegExp(SELLERSLOGIN_WEBSITE.replaceAll('.', '\\.')));
    assert.ok(rendered.subject.includes('Acme & Sons <India>'));
    assert.ok(rendered.text.includes('Dear Acme & Sons <India>,'));
  }
});

test('online demo renders meeting link and omits location', () => {
  const lead = {
    ...baseLead,
    leadStatus: 'Demo Scheduled',
    statusDetails: {
      status: 'Demo Scheduled',
      demoDateTime: '2026-08-10T10:00:00.000Z',
      demoMode: 'Online',
      meetingLink: 'https://meet.example.com/acme',
      location: 'Must not be shown',
    },
  };
  const rendered = renderLeadStatusEmail({ leadType: 'Company', lead, status: 'Demo Scheduled' });
  assert.match(rendered.subject, /^Online Demo Confirmation/);
  assert.match(rendered.html, /Meeting Link/);
  assert.match(rendered.html, /https:\/\/meet\.example\.com\/acme/);
  assert.doesNotMatch(rendered.html, /Must not be shown/);
});

test('on-site demo renders location and omits meeting link', () => {
  const lead = {
    ...baseLead,
    leadStatus: 'Demo Scheduled',
    statusDetails: {
      status: 'Demo Scheduled',
      demoDateTime: '2026-08-10T10:00:00.000Z',
      demoMode: 'On-site',
      meetingLink: 'https://meet.example.com/must-not-show',
      location: 'Sellerslogin Office, New Delhi',
    },
  };
  const rendered = renderLeadStatusEmail({ leadType: 'Company', lead, status: 'Demo Scheduled' });
  assert.match(rendered.subject, /^On-Site Demo Confirmation/);
  assert.match(rendered.html, /Sellerslogin Office, New Delhi/);
  assert.doesNotMatch(rendered.html, /must-not-show/);
});

test('follow-up email includes the saved follow-up schedule', () => {
  const lead = {
    ...baseLead,
    leadStatus: 'Follow Up',
    followUpDateTime: '2026-08-12T09:30:00.000Z',
  };
  const rendered = renderLeadStatusEmail({ leadType: 'Company', lead, status: 'Follow Up' });
  assert.match(rendered.html, /Follow-Up Date &amp; Time/);
  assert.match(rendered.text, /Follow-Up Date & Time:/);
});

test('the active Follow Up save endpoint dispatches the customer email', () => {
  assert.match(saveLeadFollowUp.toString(), /sendAutomatedLeadStatusNotifications/);
  assert.match(saveLeadFollowUp.toString(), /follow_up_saved/);
});

test('approved WhatsApp templates map to every lead status and both demo modes', () => {
  const cases = [
    ['New', {}, 'lead_conversation_acknowledgement_v1', 1],
    ['Interested', { productService: 'CRM Software' }, 'enquiry_requirement_recorded_v1', 3],
    ['Not Interested', {}, 'enquiry_closure_confirmation_v1', 2],
    ['Prospective', { expectedClosingDate: '2026-08-20T00:00:00.000Z' }, 'enquiry_review_confirmation_v1', 3],
    ['Follow Up', {}, 'followup_appointment_confirmation_v1', 3],
    ['Committed', { committedProductService: 'CRM Software', expectedCompletionDate: '2026-08-30T00:00:00.000Z' }, 'service_request_confirmation_v1', 4],
    ['Converted', { productService: 'CRM Software', convertedAt: '2026-09-01T00:00:00.000Z' }, 'onboarding_process_confirmation_v1', 4],
    ['Demo Scheduled', { demoMode: 'Online', demoDateTime: '2026-08-12T09:30:00.000Z', meetingLink: 'https://meet.example.com/acme' }, 'demo_appointment_online_update_v1', 4],
    ['Demo Scheduled', { demoMode: 'On-site', demoDateTime: '2026-08-12T09:30:00.000Z', location: 'New Delhi' }, 'demo_appointment_onsite_update_v1', 4],
  ];

  for (const [status, details, templateName, parameterCount] of cases) {
    const lead = {
      _id: '6a6c6e6d9ee0095b1d3a8935',
      companyName: 'Acme Pvt Ltd',
      mobileNo: '9873138444',
      leadStatus: status,
      followUpDateTime: '2026-08-15T06:00:00.000Z',
      statusDetails: { status, ...details },
    };
    const message = buildLeadStatusWhatsAppMessage({ leadType: 'Company', lead, status });
    assert.equal(message.status, 'ready');
    assert.equal(message.templateName, templateName);
    assert.equal(message.language, 'en_US');
    assert.equal(message.parameters.length, parameterCount);
    assert.equal(message.parameters[0], 'Acme Pvt Ltd');
    assert.equal(message.normalizedPhone, '919873138444');
  }
});

test('Committed and Converted parameters follow the approved Meta template order', () => {
  const base = {
    _id: '6a6c6e6d9ee0095b1d3a8935',
    companyName: 'Acme Pvt Ltd',
    mobileNo: '+919873138444',
  };
  const committed = buildLeadStatusWhatsAppMessage({
    leadType: 'Company',
    status: 'Committed',
    lead: {
      ...base,
      leadStatus: 'Committed',
      statusDetails: {
        status: 'Committed',
        committedProductService: 'CRM Software',
        expectedCompletionDate: '2026-08-30T00:00:00.000Z',
      },
    },
  });
  assert.deepEqual(committed.parameters.slice(0, 3), ['Acme Pvt Ltd', 'CRM Software', 'ENQ-D3A8935']);

  const converted = buildLeadStatusWhatsAppMessage({
    leadType: 'Company',
    status: 'Converted',
    lead: {
      ...base,
      leadStatus: 'Converted',
      statusDetails: {
        status: 'Converted',
        productService: 'CRM Software',
        convertedAt: '2026-09-01T00:00:00.000Z',
      },
    },
  });
  assert.deepEqual(converted.parameters.slice(0, 3), ['Acme Pvt Ltd', 'CRM Software', 'ENQ-D3A8935']);
});

test('WhatsApp phone normalization rejects unusable numbers', () => {
  assert.equal(normalizeWhatsAppNumber('+91 98731 38444'), '919873138444');
  assert.equal(normalizeWhatsAppNumber('9873138444'), '919873138444');
  assert.equal(normalizeWhatsAppNumber('123'), '');
});
