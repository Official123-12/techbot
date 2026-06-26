import axios from "axios";
import { logger } from "../logger.js";

// ============================================
// NOTIFICATION CONFIGURATION
// ============================================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

let _fn: ((msg: string) => Promise<void>) | null = null;

// ============================================
// REGISTER NOTIFIER
// ============================================
export function registerNotifier(fn: (msg: string) => Promise<void>): void {
  _fn = fn;
  logger.info("📢 Notifier registered successfully");
}

// ============================================
// SEND NOTIFICATION VIA TELEGRAM
// ============================================
export async function sendTelegramMessage(message: string): Promise<boolean> {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      logger.warn("⚠️ Telegram not configured, skipping message");
      return false;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
    });

    if (response.data?.ok) {
      logger.info("✅ Telegram message sent successfully");
      return true;
    } else {
      logger.error("❌ Telegram API returned error:", response.data);
      return false;
    }
  } catch (error: any) {
    logger.error("❌ Failed to send Telegram message:", error.message);
    return false;
  }
}

// ============================================
// SEND NOTIFICATION TO OWNER (ALL CHANNELS)
// ============================================
export async function notifyOwner(msg: string): Promise<void> {
  try {
    // Send via registered notifier (bot)
    if (_fn) {
      await _fn(msg).catch((err) => {
        logger.error("❌ Notifier function failed:", err);
      });
    }

    // Send via Telegram
    await sendTelegramMessage(msg);

    logger.info("✅ All notifications sent successfully");
  } catch (error: any) {
    logger.error("❌ Failed to send notifications:", error.message);
  }
}

// ============================================
// SEND PAYMENT CONFIRMATION
// ============================================
export async function notifyPaymentSuccess(
  userEmail: string,
  userPhone: string,
  amount: number,
  reference: string,
  provider: string
): Promise<void> {
  const message = `✅ *Payment Confirmed!*\n\n` +
    `👤 User: ${userEmail}\n` +
    `📱 Phone: ${userPhone || "N/A"}\n` +
    `💰 Amount: ${amount} SQ\n` +
    `🆔 Reference: ${reference}\n` +
    `🏦 Provider: ${provider.toUpperCase()}\n` +
    `📅 Time: ${new Date().toLocaleString()}\n\n` +
    `Thank you for choosing STANY Hosting! 🚀`;

  await notifyOwner(message);
}

// ============================================
// SEND MINPAY INSTRUCTION
// ============================================
export async function sendMinpayInstructions(
  userEmail: string,
  userPhone: string,
  amount: number,
  reference: string
): Promise<void> {
  const message = `📱 *MINPAY Payment Initiated*\n\n` +
    `👤 User: ${userEmail}\n` +
    `📱 Phone: ${userPhone || "N/A"}\n` +
    `💰 Amount: TSh ${amount.toLocaleString()}\n` +
    `🆔 Reference: ${reference}\n\n` +
    `📤 *Payment Details:*\n` +
    `📞 Number: 255787069580\n` +
    `📛 Name: Masanyiwa Stanley\n\n` +
    `⏳ Status: Waiting for payment & screenshot upload`;

  await notifyOwner(message);
}

// ============================================
// SEND MINPAY SCREENSHOT UPLOAD
// ============================================
export async function notifyMinpayScreenshot(
  userEmail: string,
  userPhone: string,
  amount: number,
  reference: string,
  screenshotPath: string
): Promise<void> {
  const message = `📸 *MINPAY Screenshot Uploaded!*\n\n` +
    `👤 User: ${userEmail}\n` +
    `📱 Phone: ${userPhone || "N/A"}\n` +
    `💰 Amount: TSh ${amount.toLocaleString()}\n` +
    `🆔 Reference: ${reference}\n` +
    `📁 Screenshot: ${screenshotPath}\n` +
    `📅 Time: ${new Date().toLocaleString()}\n\n` +
    `⚠️ *Action Required:* Verify payment manually!`;

  await notifyOwner(message);
}

// ============================================
// SEND MINPAY VERIFICATION
// ============================================
export async function notifyMinpayVerification(
  userEmail: string,
  userPhone: string,
  amount: number,
  status: "success" | "failed"
): Promise<void> {
  if (status === "success") {
    const message = `✅ *MINPAY Payment Verified!*\n\n` +
      `👤 User: ${userEmail}\n` +
      `📱 Phone: ${userPhone || "N/A"}\n` +
      `💰 Amount: TSh ${amount.toLocaleString()}\n` +
      `📅 Time: ${new Date().toLocaleString()}\n\n` +
      `🎉 Payment confirmed! SQ coins added to user account.`;

    await notifyOwner(message);
  } else {
    const message = `❌ *MINPAY Payment Failed*\n\n` +
      `👤 User: ${userEmail}\n` +
      `📱 Phone: ${userPhone || "N/A"}\n` +
      `💰 Amount: TSh ${amount.toLocaleString()}\n\n` +
      `⚠️ Payment verification failed.`;

    await notifyOwner(message);
  }
}

// ============================================
// SEND SYSTEM ERROR
// ============================================
export async function notifyError(error: string, context?: any): Promise<void> {
  const message = `⚠️ *SYSTEM ERROR*\n\n` +
    `❌ Error: ${error}\n` +
    `📋 Context: ${JSON.stringify(context || {}, null, 2)}\n` +
    `📅 Time: ${new Date().toLocaleString()}`;

  await notifyOwner(message);
}

export default {
  registerNotifier,
  notifyOwner,
  sendTelegramMessage,
  notifyPaymentSuccess,
  sendMinpayInstructions,
  notifyMinpayScreenshot,
  notifyMinpayVerification,
  notifyError,
};