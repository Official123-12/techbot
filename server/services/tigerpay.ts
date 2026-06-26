import axios from "axios";
import { logger } from "../logger.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { notifyOwner } from "./notify.js";

// ============================================
// TIGERPAY CONFIGURATION
// ============================================
const TIGERPAY_API_URL = process.env.TIGERPAY_API_URL || "https://api.tigerpaypro.com/v1";
const TIGERPAY_API_KEY = process.env.TIGERPAY_API_KEY || "";
const TIGERPAY_SECRET = process.env.TIGERPAY_SECRET || "";
const APP_URL = process.env.APP_URL || "https://hosting.stany.site";

export interface TigerPayInitiateResponse {
  status: boolean;
  message: string;
  data?: {
    transactionId: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paymentUrl: string;
  };
}

export interface TigerPayVerifyResponse {
  status: boolean;
  message: string;
  data?: {
    transactionId: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paidAt: string;
    channel: string;
  };
}

// ============================================
// INITIALIZE TIGERPAY PAYMENT
// ============================================
export async function initializeTigerPayPayment(data: {
  amount: number;
  email: string;
  phone?: string;
  name?: string;
  reference?: string;
}): Promise<TigerPayInitiateResponse> {
  try {
    if (!TIGERPAY_API_KEY) {
      logger.error("TigerPay API key not configured");
      return {
        status: false,
        message: "Payment system not configured"
      };
    }

    const reference = data.reference || `SQ_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const payload = {
      amount: data.amount,
      email: data.email,
      phone: data.phone || "",
      name: data.name || data.email,
      reference: reference,
      currency: "TZS",
      callback_url: `${APP_URL}/payment/callback`,
      webhook_url: `${APP_URL}/webhook`
    };

    const response = await axios.post(
      `${TIGERPAY_API_URL}/transaction/initialize`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${TIGERPAY_API_KEY}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.status) {
      logger.info(`TigerPay payment initialized: ${reference}`);
      return {
        status: true,
        message: "Payment initialized successfully",
        data: response.data.data
      };
    }

    logger.error("TigerPay initialization failed:", response.data);
    return {
      status: false,
      message: response.data?.message || "Payment initialization failed"
    };

  } catch (error: any) {
    logger.error("TigerPay initialization error:", error.message);
    return {
      status: false,
      message: error.response?.data?.message || error.message || "Payment service error"
    };
  }
}

// ============================================
// VERIFY TIGERPAY PAYMENT
// ============================================
export async function verifyTigerPayPayment(reference: string): Promise<TigerPayVerifyResponse> {
  try {
    if (!TIGERPAY_API_KEY) {
      return {
        status: false,
        message: "Payment system not configured"
      };
    }

    const response = await axios.get(
      `${TIGERPAY_API_URL}/transaction/verify/${reference}`,
      {
        headers: {
          "Authorization": `Bearer ${TIGERPAY_API_KEY}`,
          "Accept": "application/json"
        },
        timeout: 30000
      }
    );

    if (response.data && response.data.status) {
      return {
        status: true,
        message: "Payment verified successfully",
        data: response.data.data
      };
    }

    return {
      status: false,
      message: response.data?.message || "Payment verification failed"
    };

  } catch (error: any) {
    logger.error("TigerPay verification error:", error.message);
    return {
      status: false,
      message: error.response?.data?.message || error.message || "Verification service error"
    };
  }
}

// ============================================
// HANDLE TIGERPAY WEBHOOK
// ============================================
export async function handleTigerPayWebhook(payload: any): Promise<boolean> {
  try {
    logger.info("Processing TigerPay webhook");

    // Verify webhook signature
    const signature = payload.signature || payload.webhook_signature;
    if (!signature) {
      logger.warn("TigerPay webhook: Missing signature");
      return false;
    }

    // TODO: Verify signature with TIGERPAY_SECRET
    // For now, we trust the webhook

    const reference = payload.reference || payload.transaction_reference;
    const status = payload.status || payload.transaction_status;

    if (!reference || !status) {
      logger.warn("TigerPay webhook: Missing reference or status");
      return false;
    }

    // Find transaction
    const transaction = await Transaction.findOne({ paystackRef: reference });
    if (!transaction) {
      logger.warn(`TigerPay webhook: Transaction not found: ${reference}`);
      return false;
    }

    // Check if already processed
    if (transaction.status !== "pending") {
      logger.info(`TigerPay webhook: Transaction already ${transaction.status}: ${reference}`);
      return true;
    }

    // Update transaction based on status
    if (status === "success" || status === "completed" || status === "paid") {
      transaction.status = "success";
      await transaction.save();

      // Add coins to user
      const user = await User.findById(transaction.userId);
      if (user) {
        user.txCoins += transaction.txAmount;
        await user.save();

        // Send notification
        const message = `PAYMENT CONFIRMATION (TigerPay)\nUser: ${user.email}\nAmount: ${transaction.txAmount} SQ\nRef: ${reference}`;
        await notifyOwner(message);

        logger.info(`TigerPay payment successful: ${reference}`);
        return true;
      }
    } else if (status === "failed" || status === "cancelled" || status === "expired") {
      transaction.status = "failed";
      await transaction.save();
      logger.info(`TigerPay payment failed: ${reference}`);
      return true;
    }

    return true;

  } catch (error: any) {
    logger.error("TigerPay webhook error:", error.message);
    return false;
  }
}

// ============================================
// GET TIGERPAY TRANSACTION STATUS
// ============================================
export async function getTigerPayStatus(reference: string): Promise<string> {
  try {
    const result = await verifyTigerPayPayment(reference);
    if (result.status && result.data) {
      return result.data.status;
    }
    return "pending";
  } catch (error) {
    logger.error("Get TigerPay status error:", error);
    return "pending";
  }
}

export default {
  initializeTigerPayPayment,
  verifyTigerPayPayment,
  handleTigerPayWebhook,
  getTigerPayStatus
};