import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  isUsableTranscript,
  normalizeGeminiTranscript,
  readableTranscriptionError,
} from '../geminiCallTranscriptionService.js';
import CallLog from '../../models/CallLog.js';

test('provider null-like values are never treated as completed transcripts', () => {
  for (const value of [null, undefined, '', 'null', ' NULL ', 'undefined', '[null]', 'n/a']) {
    assert.equal(isUsableTranscript(value), false);
  }
  assert.equal(isUsableTranscript('Employee: Hello\nLead: Namaste'), true);
});

test('Gemini structured output becomes a readable multilingual speaker transcript', () => {
  const result = normalizeGeminiTranscript(JSON.stringify({
    summary: 'Lead requested a CRM demo.',
    primaryLanguage: 'Hinglish',
    segments: [
      { startTime: '00:01', endTime: '00:04', speaker: 'Agent', text: 'Hello sir, Sellerslogin se baat kar raha hoon.', language: 'Hinglish' },
      { startTime: '00:05', endTime: '00:08', speaker: 'Customer', text: 'Haan ji, mujhe CRM ka demo chahiye.', language: 'Hinglish' },
    ],
  }));

  assert.equal(result.primaryLanguage, 'Hinglish');
  assert.equal(result.summary, 'Lead requested a CRM demo.');
  assert.match(result.transcriptText, /^\[00:01\] Employee:/);
  assert.match(result.transcriptText, /\[00:05\] Lead:/);
  assert.equal(result.transcriptSegments.length, 2);
});

test('invalid or speechless Gemini results fail instead of saving misleading content', () => {
  assert.throws(() => normalizeGeminiTranscript('null'), /invalid transcription response/i);
  assert.throws(
    () => normalizeGeminiTranscript(JSON.stringify({ summary: '', primaryLanguage: '', segments: [] })),
    /No intelligible speech/i,
  );
});

test('Gemini provider JSON errors are converted to readable messages', () => {
  assert.equal(
    readableTranscriptionError(new Error('{"error":{"code":429,"message":"Prepayment credits are depleted","status":"RESOURCE_EXHAUSTED"}}')),
    'Prepayment credits are depleted',
  );
});

test('call schema supports the Gemini processing lifecycle and structured segments', () => {
  assert.ok(CallLog.schema.path('transcriptionStatus').enumValues.includes('processing'));
  assert.ok(CallLog.schema.path('transcriptionAttempts'));
  assert.ok(CallLog.schema.path('transcriptSegments'));
  assert.ok(CallLog.schema.path('transcriptionSource').enumValues.includes('gemini'));
});

test('browser call recording triggers backend Gemini transcription without Plivo auto-transcription', () => {
  const controller = fs.readFileSync(new URL('../../controllers/telephonyController.js', import.meta.url), 'utf8');
  assert.match(controller, /maxLength="14400"/);
  assert.match(controller, /scheduleCallTranscription\(callLog\._id\)/);
  assert.doesNotMatch(controller, /transcriptionType="auto"/);
});

test('manual transcription retry route is protected by Manage Calls permission', () => {
  const routes = fs.readFileSync(new URL('../../routes/telephonyRoutes.js', import.meta.url), 'utf8');
  assert.match(routes, /calls\/:callLogId\/transcription\/retry/);
  assert.match(routes, /PERMISSIONS\.CALLS_MANAGE\), retryCallTranscription/);
});
