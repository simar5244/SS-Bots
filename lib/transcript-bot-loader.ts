// Server-side only loader for transcript bot services
// This prevents Next.js from trying to bundle Node.js modules during build

export function loadTranscriptBotService() {
  if (typeof window !== 'undefined') {
    throw new Error('TranscriptBotService can only be used on the server side');
  }
  
  // Dynamic require at runtime, not build time
  const TranscriptBotService = require('../backend/main_transcript_bot');
  return TranscriptBotService;
}

export function createTranscriptBotService() {
  const TranscriptBotService = loadTranscriptBotService();
  return new TranscriptBotService();
}
