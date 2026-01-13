import nodemailer from 'nodemailer';
import supabase from '../config/supabase.js';
import { createTelegramSession } from '../routes/telegram.js';
import { v4 as uuidv4 } from 'uuid';

// Email transporter configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export interface NotificationPayload {
  userId: string;
  type: 'alert_match' | 'price_drop' | 'item_sold' | 'system';
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: ('email' | 'push' | 'telegram' | 'discord' | 'in_app')[];
}

// Send notification through configured channels
export const sendNotification = async (payload: NotificationPayload): Promise<void> => {
  const { userId, type, title, message, data, channels = ['in_app'] } = payload;

  // Get user preferences
  const { data: user } = await supabase
    .from('users')
    .select('email, notification_email, notification_push, notification_telegram, telegram_chat_id, notification_discord, discord_webhook_url')
    .eq('id', userId)
    .single();

  if (!user) {
    console.error('User not found for notification');
    return;
  }

  // Save in-app notification
  if (channels.includes('in_app')) {
    await saveInAppNotification(userId, type, title, message, data);
  }

  // Send email notification
  if (channels.includes('email') && user.notification_email && user.email) {
    await sendEmailNotification(user.email, title, message, data);
  }

  // Send Telegram notification using the ReList bot
  if (channels.includes('telegram') && user.notification_telegram && user.telegram_chat_id) {
    await sendTelegramNotification(user.telegram_chat_id, title, message, data);
  }

  // Send Discord webhook notification
  if (channels.includes('discord') && user.notification_discord && user.discord_webhook_url) {
    await sendDiscordNotification(user.discord_webhook_url, title, message, data);
  }

  // Push notifications would go here (requires OneSignal/FCM setup)
  if (channels.includes('push') && user.notification_push) {
    console.log('Push notification would be sent here');
  }
};

// Save notification to database
const saveInAppNotification = async (
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    data,
    is_read: false,
  });
};

// Send email notification
const sendEmailNotification = async (
  email: string,
  subject: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const htmlContent = generateEmailHtml(subject, message, data);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"ReList" <noreply@relist.app>',
      to: email,
      subject: `[ReList] ${subject}`,
      text: message,
      html: htmlContent,
    });

    console.log(`Email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
};

// Send Telegram notification using the ReList bot with interactive navigation
const sendTelegramNotification = async (
  chatId: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.log('Telegram bot token not configured in environment');
    return;
  }

  if (!chatId) {
    console.log('No chat ID configured for user');
    return;
  }

  try {
    const items = data?.items || [];
    const alertName = data?.alertName || title;

    // If we have multiple items, send an interactive card with navigation
    if (items.length > 0) {
      await sendInteractiveItemCard(botToken, chatId, items, alertName);
      return;
    }

    // Fallback: send text-only message if no items
    await sendTelegramTextMessage(botToken, chatId, title, message, items);
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
};

// Send interactive item card with navigation buttons
const sendInteractiveItemCard = async (
  botToken: string,
  chatId: string,
  items: any[],
  alertName: string
): Promise<void> => {
  const sessionId = uuidv4();
  const currentIndex = 0;
  const item = items[currentIndex];
  const total = items.length;

  // Build caption for the first item
  const caption = buildItemCaption(item, currentIndex, total, alertName);

  // Build inline keyboard with navigation buttons
  const keyboard = buildNavigationKeyboard(item, currentIndex, total, sessionId);

  let messageId: number;

  try {
    // Send photo with caption and inline keyboard if item has an image
    if (item.image && item.image.startsWith('http')) {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          photo: item.image,
          caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        }),
      });

      const result = await response.json();
      if (!result.ok) {
        console.error('Telegram sendPhoto error:', result.description);
        // Fall back to text message
        await sendTelegramTextMessage(botToken, chatId, alertName, `Found ${total} items`, items);
        return;
      }
      messageId = result.result.message_id;
    } else {
      // Send text message if no image
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: caption,
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: keyboard },
        }),
      });

      const result = await response.json();
      if (!result.ok) {
        console.error('Telegram sendMessage error:', result.description);
        return;
      }
      messageId = result.result.message_id;
    }

    // Store session for navigation (only if more than 1 item)
    if (items.length > 1) {
      createTelegramSession(sessionId, chatId, messageId, items, alertName);
    }

    console.log(`Interactive Telegram card sent to ${chatId} with ${items.length} items`);
  } catch (error) {
    console.error('Failed to send interactive Telegram card:', error);
    // Fall back to text message
    await sendTelegramTextMessage(botToken, chatId, alertName, `Found ${items.length} items`, items);
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

  // Navigation row (only if more than 1 item)
  if (total > 1) {
    const navRow: any[] = [];

    if (currentIndex > 0) {
      navRow.push({
        text: '⬅️ Previous',
        callback_data: `nav:${sessionId}:prev`,
      });
    }

    navRow.push({
      text: `${currentIndex + 1}/${total}`,
      callback_data: 'noop',
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

// Helper to escape markdown special characters
const escapeMarkdown = (text: string): string => {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
};

// Send text-only Telegram message (fallback)
const sendTelegramTextMessage = async (
  botToken: string,
  chatId: string,
  title: string,
  message: string,
  items: any[]
): Promise<void> => {
  // Escape special characters in title
  const escapedTitle = escapeMarkdown(title);
  let text = `🔔 *${escapedTitle}*\n\n${message}`;

  if (items.length > 0) {
    text += '\n\n📋 *First 10 items:*\n\n';
    // Limit to first 10 items to avoid Telegram message length limits
    const displayItems = items.slice(0, 10);
    for (const item of displayItems) {
      // Create a safe title by limiting length and escaping
      const safeTitle = (item.title || 'Unknown Item').substring(0, 100);
      const escapedItemTitle = escapeMarkdown(safeTitle);
      const platform = escapeMarkdown(item.platform || 'Unknown');

      text += `• ${escapedItemTitle}\n`;
      text += `  💰 £${item.price} on ${platform}\n`;
      if (item.url) {
        text += `  [View listing](${item.url})\n`;
      }
      text += '\n';
    }

    if (items.length > 10) {
      text += `\n_...and ${items.length - 10} more items_`;
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (response.ok) {
    console.log(`Telegram text message sent to ${chatId}`);
  } else {
    const result = await response.json();
    console.error('Telegram API error:', result.description);
  }
};

// Generate HTML email template
const generateEmailHtml = (title: string, message: string, data?: Record<string, any>): string => {
  let itemsHtml = '';

  if (data?.items && Array.isArray(data.items)) {
    itemsHtml = data.items.map((item: any) => `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 8px 0;">
        <h3 style="margin: 0 0 8px 0; color: #1e293b;">${item.title}</h3>
        <p style="margin: 0; color: #64748b; font-size: 14px;">
          <strong>£${item.price}</strong> on ${item.platform}
        </p>
        ${item.url ? `<a href="${item.url}" style="color: #2563eb; text-decoration: none;">View listing →</a>` : ''}
      </div>
    `).join('');
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
        <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">ReList</h1>
        </div>
        <div style="padding: 24px;">
          <h2 style="color: #1e293b; margin: 0 0 16px 0;">${title}</h2>
          <p style="color: #64748b; line-height: 1.6;">${message}</p>
          ${itemsHtml}
        </div>
        <div style="background: #f8fafc; padding: 16px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">
            You received this email because you have notifications enabled in ReList.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Notify user of new alert matches
export const notifyAlertMatches = async (
  userId: string,
  alertName: string,
  items: any[]
): Promise<void> => {
  if (items.length === 0) return;

  await sendNotification({
    userId,
    type: 'alert_match',
    title: `${items.length} new matches for "${alertName}"`,
    message: `We found ${items.length} new items matching your alert.`,
    data: { items, alertName }, // Include items and alert name for interactive Telegram
    channels: ['in_app', 'email', 'telegram', 'discord'],
  });
};

// Notify user of price drops on watched items
export const notifyPriceDrop = async (
  userId: string,
  item: {
    title: string;
    url: string;
    image_url?: string;
    platform: string;
    previous_price: number;
    current_price: number;
    target_price?: number;
    price_drop_percent: number;
  }
): Promise<void> => {
  const targetReached = item.target_price && item.current_price <= item.target_price;
  const savings = item.previous_price - item.current_price;

  const title = targetReached
    ? `🎯 Target price reached! ${item.title.substring(0, 50)}...`
    : `💰 Price drop! ${item.title.substring(0, 50)}...`;

  const message = targetReached
    ? `The item you're watching has dropped to your target price of £${item.target_price}! It was £${item.previous_price}, now £${item.current_price} (${item.price_drop_percent.toFixed(1)}% off).`
    : `Price dropped by £${savings.toFixed(2)} (${item.price_drop_percent.toFixed(1)}% off)! Was £${item.previous_price}, now £${item.current_price}.`;

  const items = [{
    title: item.title,
    price: item.current_price,
    platform: item.platform,
    url: item.url,
    image: item.image_url,
  }];

  await sendNotification({
    userId,
    type: 'price_drop',
    title,
    message,
    data: {
      items,
      alertName: 'Price Watch Alert',
      previous_price: item.previous_price,
      current_price: item.current_price,
      target_price: item.target_price,
      target_reached: targetReached,
    },
    channels: ['in_app', 'email', 'telegram', 'discord'],
  });
};

// Notify multiple price drops at once (batch)
export const notifyPriceDropsBatch = async (
  userId: string,
  drops: Array<{
    title: string;
    url: string;
    image_url?: string;
    platform: string;
    previous_price: number;
    current_price: number;
    target_price?: number;
    price_drop_percent: number;
  }>
): Promise<void> => {
  if (drops.length === 0) return;

  const targetReached = drops.filter(d => d.target_price && d.current_price <= d.target_price);
  const regularDrops = drops.filter(d => !d.target_price || d.current_price > d.target_price);

  // Send individual notifications for target-reached items (important!)
  for (const drop of targetReached) {
    await notifyPriceDrop(userId, drop);
  }

  // Batch notification for regular price drops
  if (regularDrops.length > 0) {
    const items = regularDrops.map(d => ({
      title: d.title,
      price: d.current_price,
      platform: d.platform,
      url: d.url,
      image: d.image_url,
    }));

    const title = regularDrops.length === 1
      ? `💰 Price drop on ${regularDrops[0].title.substring(0, 40)}...`
      : `💰 ${regularDrops.length} items dropped in price!`;

    const message = regularDrops.length === 1
      ? `Price dropped to £${regularDrops[0].current_price} (was £${regularDrops[0].previous_price})`
      : `${regularDrops.length} items you're watching have dropped in price.`;

    await sendNotification({
      userId,
      type: 'price_drop',
      title,
      message,
      data: { items, alertName: 'Price Watch' },
      channels: ['in_app', 'email', 'telegram', 'discord'],
    });
  }
};

// Send Discord webhook notification
const sendDiscordNotification = async (
  webhookUrl: string,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<void> => {
  try {
    const items = data?.items || [];
    const alertName = data?.alertName || title;

    // Build Discord embed
    const embed: any = {
      title: `🔔 ${alertName}`,
      description: message,
      color: 0x7C3AED, // Violet color
      timestamp: new Date().toISOString(),
      footer: {
        text: 'ReList Alert',
      },
    };

    // Add items as fields (limit to first 5)
    if (items.length > 0) {
      embed.fields = items.slice(0, 5).map((item: any, index: number) => ({
        name: `${index + 1}. ${item.title || 'Unknown Item'}`,
        value: `💰 **£${item.price || '?'}** on ${item.platform || 'Unknown'}\n🔗 [View Listing](${item.url || '#'})`,
        inline: false,
      }));

      if (items.length > 5) {
        embed.fields.push({
          name: '📦 More Items',
          value: `... and ${items.length - 5} more items`,
          inline: false,
        });
      }

      // Add thumbnail from first item with image
      const firstItemWithImage = items.find((item: any) => item.image);
      if (firstItemWithImage?.image) {
        embed.thumbnail = { url: firstItemWithImage.image };
      }
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: items.length > 0 ? `Found ${items.length} new item${items.length === 1 ? '' : 's'}!` : null,
        embeds: [embed],
      }),
    });

    console.log('Discord notification sent');
  } catch (error) {
    console.error('Failed to send Discord notification:', error);
  }
};

export default sendNotification;
