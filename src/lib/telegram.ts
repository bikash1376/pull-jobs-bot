import axios from 'axios';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export async function sendMessage(chatId: string | number, text: string, replyMarkup?: any) {
  try {
    await axios.post(`${TELEGRAM_API}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}

export async function sendAction(chatId: string | number, action: 'typing' | 'upload_document') {
  try {
    await axios.post(`${TELEGRAM_API}/sendChatAction`, {
      chat_id: chatId,
      action: action,
    });
  } catch (error) {
    console.error('Error sending Telegram chat action:', error);
  }
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  try {
    await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text,
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}
