export const config = {
  port: process.env.PORT || 3000,
  chromiumPath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  geminiApiKey: process.env.GEMINI_API_KEY,
  bitrix: {
    baseUrl: process.env.BITRIX_BASE_URL,
    token: process.env.BITRIX_TOKEN
  },
  transcribe: {
    provider: process.env.TRANSCRIBE_PROVIDER || 'whisper',
    whisperApiUrl: process.env.WHISPER_API_URL,
    whisperApiKey: process.env.WHISPER_API_KEY
  },
  recording: {
    outDir: process.env.REC_DIR || 'recordings',
    maxSeconds: Number(process.env.REC_MAX_SECONDS || 0)
  },
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN
};
