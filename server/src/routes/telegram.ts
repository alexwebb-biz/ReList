import express, { Request, Response } from 'express';

const router = express.Router();

// In-memory store for Telegram sessions (items navigation)
// In production, consider using Redis for persistence
const telegramSessions = new Map<string, {
  items: any[];
  currentIndex: number;
  messageId: number;
  chatId: string;
  alertName: string;
  expiresAt: number;
}>();

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of telegramSessions.entries()) {
    if (session.expiresAt < now) {
      telegramSessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Store a new session
export const createTelegramSession = (
  sessionId: string,
  chatId: string,
  messageId: number,
  items: any[],
  alertName: string
): void => {
  telegramSessions.set(sessionId, {
    items,
    currentIndex: 0,
    messageId,
    chatId,
    alertName,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });
};

// Webhook endpoint for Telegram updates
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const update = req.body;

    // Handle callback queries (button presses)
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const data = callbackQuery.data;
      const chatId = callbackQuery.message?.chat?.id;
      const messageId = callbackQuery.message?.message_id;

      if (!data || !chatId || !messageId) {
        res.sendStatus(200);
        return;
      }

      // Parse callback data: action:sessionId
      const [action, sessionId] = data.split(':');

      if (action === 'nav') {
        // Navigation within items
        const [, sessId, direction] = data.split(':');
        const session = telegramSessions.get(sessId);

        if (session) {
          // Update index based on direction
          if (direction === 'next' && session.currentIndex < session.items.length - 1) {
            session.currentIndex++;
          } else if (direction === 'prev' && session.currentIndex > 0) {
            session.currentIndex--;
          }

          // Update the message with the new item
          await updateItemCard(
            chatId.toString(),
            messageId,
            session.items,
            session.currentIndex,
            sessId,
            session.alertName
          );

          // Answer the callback query
          await answerCallbackQuery(callbackQuery.id);
        } else {
          // Session expired
          await answerCallbackQuery(callbackQuery.id, 'Session expired. Please check the app for more results.');
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.sendStatus(200); // Always return 200 to Telegram
  }
});

// Answer callback query
const answerCallbackQuery = async (callbackQueryId: string, text?: string): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
};

// Update existing message with new item card
const updateItemCard = async (
  chatId: string,
  messageId: number,
  items: any[],
  currentIndex: number,
  sessionId: string,
  alertName: string
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  const item = items[currentIndex];
  const total = items.length;

  // Build caption
  const caption = buildItemCaption(item, currentIndex, total, alertName);

  // Build inline keyboard
  const keyboard = buildNavigationKeyboard(item, currentIndex, total, sessionId);

  try {
    // Try to edit media (photo)
    if (item.image && item.image.startsWith('http')) {
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageMedia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          media: {
            type: 'photo',
            media: item.image,
            caption,
            parse_mode: 'Markdown',
          },
          reply_markup: { inline_keyboard: keyboard },
        }),
      });
    } else {
      // Edit text message if no image
      await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text: caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        }),
      });
    }
  } catch (error) {
    console.error('Failed to update Telegram message:', error);
  }
};

// Build caption for item
const buildItemCaption = (item: any, index: number, total: number, alertName: string): string => {
  const title = escapeMarkdown(item.title || 'Unknown Item');
  const price = item.price || '?';
  const platform = item.platform || 'Unknown';
  const location = item.location ? `\n📍 ${escapeMarkdown(item.location)}` : '';

  return `🔔 *${escapeMarkdown(alertName)}*\n\n` +
    `*${title}*\n\n` +
    `💰 *£${price}* on ${platform}${location}\n\n` +
    `📦 Item ${index + 1} of ${total}`;
};

// Build navigation keyboard
const buildNavigationKeyboard = (
  item: any,
  currentIndex: number,
  total: number,
  sessionId: string
): any[][] => {
  const keyboard: any[][] = [];

  // Navigation row
  const navRow: any[] = [];

  if (currentIndex > 0) {
    navRow.push({
      text: '⬅️ Previous',
      callback_data: `nav:${sessionId}:prev`,
    });
  }

  navRow.push({
    text: `${currentIndex + 1}/${total}`,
    callback_data: 'noop', // No operation, just display
  });

  if (currentIndex < total - 1) {
    navRow.push({
      text: 'Next ➡️',
      callback_data: `nav:${sessionId}:next`,
    });
  }

  if (navRow.length > 0) {
    keyboard.push(navRow);
  }

  // View listing button
  if (item.url) {
    keyboard.push([{
      text: '🔗 View Listing',
      url: item.url,
    }]);
  }

  return keyboard;
};

// Escape markdown special characters
const escapeMarkdown = (text: string): string => {
  if (!text) return '';
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

// Export for use in notification service
export { telegramSessions };
export default router;
