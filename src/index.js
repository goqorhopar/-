import express from 'express';
import pino from 'pino';
import { openMeeting } from './browser.js';
import { startPulseRecording, stopRecording } from './recording.js';
import { transcribeAudio } from './transcribe.js';
import { runChecklist } from './gemini.js';
import { updateLead } from './bitrix.js';
import { config } from './config.js';
import './telegram.js'; // Импортируем Telegram бота

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined
});

const app = express();
app.use(express.json({ limit: '10mb' }));

// Healthcheck
app.get('/health', (_, res) => res.status(200).send('ok'));

// Новый endpoint для анализа транскриптов
app.post('/analyze', async (req, res) => {
  const { transcript } = req.body || {};
  
  if (!transcript) {
    return res.status(400).json({ success: false, error: 'Transcript is required' });
  }

  logger.info({ length: transcript.length }, 'Analysis request received');

  try {
    const analysisResult = await runChecklist(transcript, logger);
    
    if (analysisResult.error) {
      return res.status(500).json({ success: false, error: analysisResult.error });
    }

    res.json({
      success: true,
      report: analysisResult
    });
  } catch (e) {
    logger.error({ err: e }, 'Analysis failed');
    res.status(500).json({ success: false, error: e.message });
  }
});

// Endpoint для полного цикла
app.post('/join', async (req, res) => {
  const { meetingUrl, leadId } = req.body || {};
  if (!meetingUrl || !leadId) {
    return res.status(400).json({ error: 'meetingUrl and leadId are required' });
  }

  logger.info({ meetingUrl, leadId }, 'Join request received');

  let browser, page, rec;
  try {
    ({ browser, page } = await openMeeting({ url: meetingUrl, logger }));
    rec = startPulseRecording({ logger });

    if (config.recording.maxSeconds > 0) {
      await page.waitForTimeout(config.recording.maxSeconds * 1000);
    } else {
      try {
        await page.waitForSelector('text/Meeting ended', { timeout: 60 * 60 * 1000 });
      } catch (_) {
        logger.warn('No end marker found, timing out at 60 minutes');
      }
    }

    const outfile = await stopRecording(rec);
    logger.info({ outfile }, 'Recording saved');

    const transcript = await transcribeAudio(outfile, logger);
    logger.info({ length: transcript.length }, 'Transcript received');

    const analysisResult = await runChecklist(transcript, logger);
    logger.info({ analysisResult }, 'Meeting analysis done');

    const fieldsToUpdate = {
      COMMENTS: `Анализ встречи от ${new Date().toLocaleString()}\n\n` +
                `Общая оценка: ${analysisResult.overallScore}/100\n` +
                `Категория клиента: ${analysisResult.category}\n\n` +
                `Детальный отчет сохранен в приложении`
    };

    await updateLead({ leadId, fields: fieldsToUpdate });

    res.json({
      ok: true,
      leadId,
      transcriptChars: transcript.length,
      analysis: analysisResult
    });
  } catch (e) {
    logger.error({ err: e }, 'Join flow failed');
    res.status(500).json({ error: e.message || 'Internal error' });
  } finally {
    try { if (rec) await stopRecording(rec); } catch (_) {}
    try { if (page) await page.close(); } catch (_) {}
    try { if (browser) await browser.close(); } catch (_) {}
  }
});

app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Server started');
});
