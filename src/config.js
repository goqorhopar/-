export const config = {
  port: process.env.PORT || 3000,
  chromiumPath: process.env.CHROME_BIN || '/usr/bin/google-chrome-stable',
  geminiApiKey: process.env.GEMINI_API_KEY,
  bitrix: {
    baseUrl: process.env.BITRIX_BASE_URL
  },
  recording: {
    outDir: process.env.REC_DIR || '/tmp/recordings',
    maxSeconds: Number(process.env.REC_MAX_SECONDS || 3600)
  },
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  adminChatId: process.env.ADMIN_CHAT_ID
};
