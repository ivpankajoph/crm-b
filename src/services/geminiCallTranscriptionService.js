import { GoogleGenAI } from '@google/genai';
import CallLog from '../models/CallLog.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_ATTEMPTS = 3;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const INLINE_AUDIO_BYTES = 18 * 1024 * 1024;
const INVALID_TRANSCRIPTS = new Set(['', 'null', 'undefined', '[null]', 'n/a']);

const cleanText = (value, maxLength = 20_000) => String(value ?? '')
  .replace(/\u0000/g, '')
  .replace(/\r\n/g, '\n')
  .trim()
  .slice(0, maxLength);

export const readableTranscriptionError = (error) => {
  const raw = cleanText(error?.message || error || 'Gemini transcription failed', 20_000);
  try {
    const parsed = JSON.parse(raw);
    return cleanText(parsed?.error?.message || parsed?.message || raw, 2_000);
  } catch {
    const jsonStart = raw.indexOf('{');
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart));
        return cleanText(parsed?.error?.message || parsed?.message || raw, 2_000);
      } catch {
        // Fall back to the provider message below.
      }
    }
    return cleanText(raw, 2_000);
  }
};

export const isUsableTranscript = (value) => {
  const normalized = cleanText(value).toLowerCase();
  return Boolean(normalized) && !INVALID_TRANSCRIPTS.has(normalized);
};

export const isGeminiTranscriptionConfigured = () => Boolean(
  (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim(),
);

const extractJson = (value) => {
  const text = cleanText(value, 1_000_000);
  if (!text) throw new Error('Gemini returned an empty transcription response');
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '');
  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(withoutFence.slice(start, end + 1));
    throw new Error('Gemini returned an invalid transcription response');
  }
};

const normalizeTimestamp = (value) => {
  const timestamp = cleanText(value, 16);
  return /^\d{1,2}:\d{2}(?::\d{2})?$/.test(timestamp) ? timestamp : '';
};

const normalizeSpeaker = (value) => {
  const speaker = cleanText(value, 50);
  if (!speaker) return 'Speaker';
  if (/employee|agent|representative|seller/i.test(speaker)) return 'Employee';
  if (/lead|customer|client|prospect/i.test(speaker)) return 'Lead';
  return speaker;
};

export const normalizeGeminiTranscript = (responseText) => {
  const parsed = extractJson(responseText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Gemini returned an invalid transcription response');
  }
  const segments = Array.isArray(parsed.segments) ? parsed.segments
    .map((segment) => ({
      startTime: normalizeTimestamp(segment?.startTime || segment?.timestamp),
      endTime: normalizeTimestamp(segment?.endTime),
      speaker: normalizeSpeaker(segment?.speaker),
      text: cleanText(segment?.text || segment?.content, 10_000),
      language: cleanText(segment?.language, 40),
    }))
    .filter((segment) => isUsableTranscript(segment.text)) : [];

  if (!segments.length) throw new Error('No intelligible speech was found in the recording');
  const transcriptText = segments.map((segment) => {
    const timestamp = segment.startTime ? `[${segment.startTime}] ` : '';
    return `${timestamp}${segment.speaker}: ${segment.text}`;
  }).join('\n');

  return {
    transcriptText,
    transcriptSegments: segments,
    summary: cleanText(parsed.summary, 4_000),
    primaryLanguage: cleanText(parsed.primaryLanguage, 80),
  };
};

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    primaryLanguage: { type: 'string' },
    segments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          speaker: { type: 'string' },
          text: { type: 'string' },
          language: { type: 'string' },
        },
        required: ['startTime', 'speaker', 'text', 'language'],
      },
    },
  },
  required: ['summary', 'primaryLanguage', 'segments'],
};

const transcriptionPrompt = `Transcribe this CRM phone-call recording accurately and verbatim.
The conversation can contain Hindi, English, or Hinglish. Preserve the words and script actually spoken; do not translate or invent missing speech.
Identify the CRM representative as Employee and the other party as Lead when the audio makes that clear. Otherwise use Speaker 1 and Speaker 2.
Return chronological segments with timestamps. Omit silence and clearly inaudible content. Provide a short factual summary and the primary language.`;

const downloadRecording = async (recordingUrl) => {
  const url = new URL(recordingUrl);
  if (url.protocol !== 'https:') throw new Error('Recording URL must use HTTPS');
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`Recording download failed (${response.status})`);
  const declaredSize = Number(response.headers.get('content-length') || 0);
  if (declaredSize > MAX_AUDIO_BYTES) throw new Error('Recording is too large to transcribe');
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) throw new Error('Recording file is empty');
  if (audio.length > MAX_AUDIO_BYTES) throw new Error('Recording is too large to transcribe');
  return { audio, mimeType: 'audio/mp3' };
};

const generateTranscript = async ({ audio, mimeType, recordingId }) => {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) throw new Error('Gemini API key is not configured');
  const ai = new GoogleGenAI({ apiKey });
  let uploadedFile;
  try {
    let audioPart;
    if (audio.length <= INLINE_AUDIO_BYTES) {
      audioPart = { inlineData: { data: audio.toString('base64'), mimeType } };
    } else {
      uploadedFile = await ai.files.upload({
        file: new Blob([audio], { type: mimeType }),
        config: { mimeType, displayName: `crm-call-${recordingId || Date.now()}.mp3` },
      });
      audioPart = { fileData: { fileUri: uploadedFile.uri, mimeType: uploadedFile.mimeType || mimeType } };
    }
    const response = await ai.models.generateContent({
      model: (process.env.GEMINI_TRANSCRIPTION_MODEL || DEFAULT_MODEL).trim(),
      contents: [{ role: 'user', parts: [{ text: transcriptionPrompt }, audioPart] }],
      config: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseJsonSchema: responseSchema,
      },
    });
    return normalizeGeminiTranscript(response.text);
  } finally {
    if (uploadedFile?.name) {
      await ai.files.delete({ name: uploadedFile.name }).catch(() => undefined);
    }
  }
};

const claimCall = (callLogId) => CallLog.findOneAndUpdate(
  {
    _id: callLogId,
    recordingStatus: 'ready',
    recordingUrl: { $type: 'string', $ne: '' },
    transcriptionStatus: { $in: ['pending', 'failed'] },
    $or: [
      { transcriptionAttempts: { $exists: false } },
      { transcriptionAttempts: { $lt: MAX_ATTEMPTS } },
    ],
  },
  {
    $set: {
      transcriptionStatus: 'processing',
      transcriptionSource: 'gemini',
      transcriptionStartedAt: new Date(),
      transcriptionError: '',
    },
    $inc: { transcriptionAttempts: 1 },
  },
  { new: true },
);

export const transcribeCallRecording = async (callLogId) => {
  if (!isGeminiTranscriptionConfigured()) return { status: 'skipped', reason: 'gemini_not_configured' };
  const call = await claimCall(callLogId);
  if (!call) return { status: 'skipped', reason: 'not_eligible_or_already_processing' };
  try {
    const recording = await downloadRecording(call.recordingUrl);
    const result = await generateTranscript({ ...recording, recordingId: call.recordingId });
    await CallLog.updateOne(
      { _id: call._id, transcriptionStatus: 'processing', transcriptionSource: 'gemini' },
      {
        $set: {
          transcriptText: result.transcriptText,
          transcriptSegments: result.transcriptSegments,
          transcriptLanguage: result.primaryLanguage,
          aiSummary: result.summary,
          transcriptionStatus: 'completed',
          transcriptionError: '',
          transcriptionCompletedAt: new Date(),
        },
      },
    );
    return { status: 'completed' };
  } catch (error) {
    const errorMessage = readableTranscriptionError(error);
    await CallLog.updateOne(
      { _id: call._id, transcriptionStatus: 'processing', transcriptionSource: 'gemini' },
      { $set: { transcriptionStatus: 'failed', transcriptionError: errorMessage } },
    );
    console.error(`Gemini transcription failed for call ${call._id}:`, errorMessage);
    return { status: 'failed', error: errorMessage };
  }
};

export const scheduleCallTranscription = (callLogId) => {
  if (!isGeminiTranscriptionConfigured()) return false;
  setImmediate(() => {
    transcribeCallRecording(callLogId).catch((error) => {
      console.error(`Unable to schedule Gemini transcription for call ${callLogId}:`, error.message);
    });
  });
  return true;
};

export const MAX_TRANSCRIPTION_ATTEMPTS = MAX_ATTEMPTS;
