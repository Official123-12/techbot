import fs from "fs";
import path from "path";
import { logger } from "../logger.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { notifyOwner } from "./notify.js";

// ============================================
// MINPAY CONFIGURATION
// ============================================
const MINPAY_NUMBER = process.env.MINPAY_NUMBER || "255787069580";
const MINPAY_NAME = process.env.MINPAY_NAME || "Masanyiwa Stanley";
const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads/screenshots";

// ============================================
// MINPAY PAYMENT INSTRUCTIONS
// ============================================
export function getMinpayInstructions(amount: number, reference: string): object {
  return {
    provider: "minpay",
    number: MINPAY_NUMBER,
    name: MINPAY_NAME,
    amount: amount,
    currency: "TSh",
    reference: reference,
    instructions: [
      "Send the exact amount to MINPAY number below",
      `Phone: ${MINPAY_NUMBER}`,
      `Name: ${MINPAY_NAME}`,
      `Amount: TSh ${amount.toLocaleString()}`,
      `Reference: ${reference}`,
      "Upload screenshot of payment confirmation in the app"
    ],
    steps: [
      "Step 1: Use M-Pesa, Tigo Pesa, or Airtel Money or Back From Any Available Areas",
      "Step 2: Send to MINPAY number: " + MINPAY_NUMBER,
      "Step 3: Enter name: " + MINPAY_NAME,
      "Step 4: Enter amount: TSh " + amount.toLocaleString(),
      "Step 5: Copy reference: " + reference,
      "Step 6: Take screenshot of confirmation",
      "Step 7: Upload screenshot in the app"
    ]
  };
}

// ============================================
// SAVE SCREENSHOT
// ============================================
export function saveScreenshot(file: Express.Multer.File, reference: string): string {
  try {
    // Ensure upload directory exists
    const uploadPath = path.join(process.cwd(), UPLOAD_DIR);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = path.extname(file.originalname);
    const filename = `minpay_${reference}_${timestamp}_${random}${extension}`;
    const filepath = path.join(uploadPath, filename);

    // Save file
    fs.writeFileSync(filepath, file.buffer);

    logger.info(`Screenshot saved: ${filepath}`);
    return filepath;

  } catch (error: any) {
    logger.error("Failed to save screenshot:", error.message);
    throw new Error("Failed to save screenshot");
  }
}

// ============================================
// PROCESS MINPAY PAYMENT
// ============================================
export async function processMinpayPayment(data: {
  userId: string;
  txAmount: number;
  ksAmount: number;
  reference: string;
  screenshot?: string;
}): Promise<object> {
  try {
    // Check if user exists
    const user = await User.findById(data.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Create transaction
    const transaction = await Transaction.create({
      userId: data.userId,
      type: "topup",
      txAmount: data.txAmount,
      ksAmount: data.ksAmount,
      paystackRef: data.reference,
      status: "pending",
      provider: "minpay",
      metadata: {
        screenshot: data.screenshot || null,
        minpayNumber: MINPAY_NUMBER,
        minpayName: MINPAY_NAME,
        uploadedAt: data.screenshot ? new Date().toISOString() : null
      }
    });

    // Send notification
    const message = `MINPAY PAYMENT INITIATED\nUser: ${user.email}\nPhone: ${user.phone || "N/A"}\nAmount: TSh ${data.ksAmount.toLocaleString()}\nRef: ${data.reference}\nStatus: Waiting for payment and screenshot`;

    await notifyOwner(message);

    return {
      success: true,
      transaction: transaction,
      instructions: getMinpayInstructions(data.ksAmount, data.reference)
    };

  } catch (error: any) {
    logger.error("Process MINPAY error:", error.message);
    throw error;
  }
}

// ============================================
// VERIFY MINPAY PAYMENT (Admin)
// ============================================
export async function verifyMinpayPayment(data: {
  reference: string;
  status: "success" | "failed";
  adminId: string;
}): Promise<object> {
  try {
    // Find transaction
    const transaction = await Transaction.findOne({ 
      paystackRef: data.reference,
      provider: "minpay"
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "pending") {
      throw new Error(`Transaction already ${transaction.status}`);
    }

    // Update transaction
    transaction.status = data.status;
    await transaction.save();

    // If success, add coins to user
    if (data.status === "success") {
      const user = await User.findById(transaction.userId);
      if (user) {
        user.txCoins += transaction.txAmount;
        await user.save();

        // Update metadata
        transaction.metadata = {
          ...transaction.metadata,
          verifiedBy: data.adminId,
          verifiedAt: new Date().toISOString()
        };
        await transaction.save();

        // Send notification
        const message = `MINPAY PAYMENT VERIFIED\nUser: ${user.email}\nAmount: ${transaction.txAmount} SQ\nRef: ${data.reference}\nStatus: SUCCESS`;

        await notifyOwner(message);

        return {
          success: true,
          message: "Payment verified successfully",
          transaction: transaction
        };
      }
    } else {
      // Failed payment
      transaction.metadata = {
        ...transaction.metadata,
        verifiedBy: data.adminId,
        verifiedAt: new Date().toISOString(),
        failureReason: "Admin rejected payment"
      };
      await transaction.save();

      const message = `MINPAY PAYMENT REJECTED\nRef: ${data.reference}\nStatus: FAILED`;

      await notifyOwner(message);

      return {
        success: true,
        message: "Payment rejected",
        transaction: transaction
      };
    }

    throw new Error("Failed to process verification");

  } catch (error: any) {
    logger.error("Verify MINPAY error:", error.message);
    throw error;
  }
}

// ============================================
// GET MINPAY TRANSACTION
// ============================================
export async function getMinpayTransaction(reference: string): Promise<object | null> {
  try {
    const transaction = await Transaction.findOne({
      paystackRef: reference,
      provider: "minpay"
    });

    if (!transaction) {
      return null;
    }

    return transaction;
  } catch (error: any) {
    logger.error("Get MINPAY transaction error:", error.message);
    return null;
  }
}

// ============================================
// GET MINPAY TRANSACTIONS BY USER
// ============================================
export async function getMinpayTransactions(userId: string): Promise<object[]> {
  try {
    const transactions = await Transaction.find({
      userId: userId,
      provider: "minpay"
    }).sort({ createdAt: -1 });

    return transactions;
  } catch (error: any) {
    logger.error("Get MINPAY transactions error:", error.message);
    return [];
  }
}

// ============================================
// HANDLE MINPAY WEBHOOK
// ============================================
export async function handleMinpayWebhook(payload: any): Promise<boolean> {
  try {
    logger.info("Processing MINPAY webhook");

    const reference = payload.reference || payload.transaction_reference;
    const status = payload.status || payload.transaction_status;

    if (!reference || !status) {
      logger.warn("MINPAY webhook: Missing reference or status");
      return false;
    }

    // Find transaction
    const transaction = await Transaction.findOne({ paystackRef: reference });
    if (!transaction) {
      logger.warn(`MINPAY webhook: Transaction not found: ${reference}`);
      return false;
    }

    // Check if already processed
    if (transaction.status !== "pending") {
      logger.info(`MINPAY webhook: Transaction already ${transaction.status}: ${reference}`);
      return true;
    }

    // Update transaction based on status
    if (status === "success" || status === "completed") {
      transaction.status = "success";
      await transaction.save();

      // Add coins to user
      const user = await User.findById(transaction.userId);
      if (user) {
        user.txCoins += transaction.txAmount;
        await user.save();

        const message = `MINPAY PAYMENT CONFIRMATION\nUser: ${user.email}\nAmount: ${transaction.txAmount} SQ\nRef: ${reference}`;
        await notifyOwner(message);

        logger.info(`MINPAY payment successful: ${reference}`);
        return true;
      }
    } else if (status === "failed" || status === "cancelled") {
      transaction.status = "failed";
      await transaction.save();
      logger.info(`MINPAY payment failed: ${reference}`);
      return true;
    }

    return true;

  } catch (error: any) {
    logger.error("MINPAY webhook error:", error.message);
    return false;
  }
}

export default {
  getMinpayInstructions,
  saveScreenshot,
  processMinpayPayment,
  verifyMinpayPayment,
  getMinpayTransaction,
  getMinpayTransactions,
  handleMinpayWebhook
};