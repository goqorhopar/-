import TelegramBot from 'node-telegram-bot-api';
import { config } from './config.js';
import axios from 'axios';

const token = config.telegramBotToken;

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN не установлен. Telegram бот не будет запущен.');
} else {
  const bot = new TelegramBot(token, { polling: true });
  const userStates = new Map();

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🤖 Добро пожаловать в Meeting Bot - Анализатор продаж!\n\nДоступные команды:\n/process - запустить анализ встречи\n/analyze - анализировать транскрипт\n/status - статус бота`);
  });

  bot.onText(/\/process/, (msg) => {
    const chatId = msg.chat.id;
    userStates.set(chatId, { step: 'awaiting_meeting_url' });
    bot.sendMessage(chatId, 'Отправьте ссылку на встречу:');
  });

  bot.onText(/\/analyze/, (msg) => {
    const chatId = msg.chat.id;
    userStates.set(chatId, { step: 'awaiting_transcript' });
    bot.sendMessage(chatId, 'Отправьте транскрипт встречи для анализа.');
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const state = userStates.get(chatId);

    if (!state || msg.text?.startsWith('/')) return;

    try {
      if (state.step === 'awaiting_meeting_url') {
        userStates.set(chatId, { 
          step: 'awaiting_lead_id', 
          meetingUrl: text 
        });
        bot.sendMessage(chatId, 'Теперь отправьте ID лида в Битрикс:');
      } else if (state.step === 'awaiting_lead_id') {
        const meetingUrl = state.meetingUrl;
        const leadId = text;
        
        bot.sendMessage(chatId, '🚀 Запускаю процесс анализа встречи... Это может занять несколько минут.');
        
        try {
          const response = await axios.post(`http://localhost:${config.port}/join`, {
            meetingUrl,
            leadId
          });

          if (response.data.ok) {
            const result = response.data;
            
            let message = `✅ Анализ встречи завершен!\n\n`;
            message += `ID лида: ${result.leadId}\n`;
            message += `Длина транскрипта: ${result.transcriptChars} символов\n`;
            message += `Общая оценка: ${result.analysis.overallScore}/100\n`;
            message += `Категория клиента: ${result.analysis.category}\n\n`;
            message += `💡 Краткий отчет:\n${result.analysis.summary}`;
            
            const chunks = message.match(/.{1,4000}/g) || [];
            for (const chunk of chunks) {
              await bot.sendMessage(chatId, chunk);
            }
            
          } else {
            bot.sendMessage(chatId, `❌ Ошибка обработки встречи: ${response.data.error}`);
          }
        } catch (error) {
          bot.sendMessage(chatId, `❌ Ошибка при обработке встречи: ${error.response?.data?.error || error.message}`);
        }
        
        userStates.delete(chatId);
      } else if (state.step === 'awaiting_transcript') {
        if (text.length < 100) {
          bot.sendMessage(chatId, 'Транскрипт слишком короткий. Отправьте более подробную запись встречи.');
          return;
        }
        
        bot.sendMessage(chatId, '🔍 Анализирую встречу по 12 пунктам чек-листа...');
        
        try {
          const response = await axios.post(`http://localhost:${config.port}/analyze`, {
            transcript: text
          });

          if (response.data.success) {
            const report = response.data.report;
            
            let message = `📊 ОТЧЕТ ПО ВСТРЕЧЕ\n\n`;
            message += `Общая оценка: ${report.overallScore}/100\n`;
            message += `Категория клиента: ${report.category}\n\n`;
            message += `1. Анализ бизнеса клиента: ${report.points[1]?.score}/10\n`;
            message += `2. Выявление болей: ${report.points[2]?.score}/10\n`;
            message += `3. Обработка возражений: ${report.points[3]?.score}/10\n`;
            message += `4. Реакция на модель: ${report.points[4]?.score}/10\n`;
            message += `5. Интерес к сервису: ${report.points[5]?.score}/10\n\n`;
            message += `💡 Рекомендации:\n${report.summary}`;
            
            const chunks = message.match(/.{1,4000}/g) || [];
            for (const chunk of chunks) {
              await bot.sendMessage(chatId, chunk);
            }
            
            await bot.sendDocument(chatId, 
              Buffer.from(JSON.stringify(report, null, 2)), 
              { filename: 'meeting_report.json' }
            );
            
          } else {
            bot.sendMessage(chatId, `❌ Ошибка анализа: ${response.data.error}`);
          }
        } catch (error) {
          bot.sendMessage(chatId, `❌ Ошибка при анализе встречи: ${error.response?.data?.error || error.message}`);
        }
        
        userStates.delete(chatId);
      }
    } catch (error) {
      bot.sendMessage(chatId, `❌ Произошла ошибка: ${error.message}`);
      userStates.delete(chatId);
    }
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `🟢 Бот активен\nПорт: ${config.port}\nГотов анализировать встречи!`);
  });

  console.log('Telegram бот запущен');
}

export default TelegramBot;
