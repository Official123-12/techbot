import { Router, type Request, type Response } from "express";
import { z } from "zod";
import axios from "axios";
import { ObjectId } from "mongodb";
import { Package } from "../models/Package.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { paymentRateLimit } from "../middleware/rateLimit.js";
import { notifyOwner } from "../services/notify.js";

const router = Router();

// ===== TIGERPAY CONFIG =====
const TIGERPAY_API = process.env.TIGERPAY_API_URL || 'https://www.tigerpaypro.com/api/v1';
const TIGERPAY_PUBLIC_KEY = process.env.TIGERPAY_PUBLIC_KEY || '';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '255787069580';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Stanley';
const TX_RATE_KES = 5;
const MAX_DAILY_FAILURES = 7;

// ===== HELPERS =====
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function recordPaymentFailure(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.isBanned) return;
  const today = todayStr();
  const currentDate = (user as unknown as { paymentFailDate?: string }).paymentFailDate || "";
  const currentCount = (user as unknown as { paymentFailCount?: number }).paymentFailCount || 0;
  const newCount = currentDate === today ? currentCount + 1 : 1;
  if (newCount >= MAX_DAILY_FAILURES) {
    await User.findByIdAndUpdate(userId, {
      isBanned: true,
      banReason: "Automated: excessive payment failures",
      paymentFailCount: newCount,
      paymentFailDate: today
    });
  } else {
    await User.findByIdAndUpdate(userId, { paymentFailCount: newCount, paymentFailDate: today });
  }
}

async function notifyAdmin(data: any) {
  try {
    if (process.env.BOT_TOKEN && process.env.BOT_OWNER_ID) {
      const message = `
🔔 *${data.title || 'New Min Pay Request'}*

👤 User: @${data.username || 'N/A'}
📧 Email: ${data.email || 'N/A'}
💰 Amount: ${data.ksAmount || 0} TSh
🪙 SQ Coins: ${data.txAmount || 0} SQ

📱 *Send payment to:*
${data.adminName || ADMIN_NAME} - ${data.adminPhone || ADMIN_PHONE}

📸 After payment, take screenshot and confirm.
      `;
      
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: process.env.BOT_OWNER_ID,
          text: message,
          parse_mode: 'Markdown'
        }
      );
    }
  } catch (error) {
    console.error('Admin notification failed:', error);
  }
}

// ===== GET PACKAGES =====
router.get("/packages", async (_req, res) => {
  try {
    const packages = await Package.find({ active: true }).sort({ order: 1 }).lean();
    res.json(packages);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== TIGERPAY PAYMENT (TANZANIA - AUTOMATIC) =====
router.post("/tigerpay/initiate", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      amount: z.number().min(1),
      phone: z.string().min(9),
      network: z.enum(["vodacom", "airtel", "tigo", "halotel"]),
      packageId: z.string().optional(),
      isCustom: z.boolean().optional(),
      txAmount: z.number().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error });
      return;
    }

    const { amount, phone, network, packageId, isCustom, txAmount } = parsed.data;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const finalTxAmount = isCustom ? (txAmount || 0) : 0;
    const finalPackageId = packageId || null;

    // Create transaction
    const reference = `TXP_${Date.now()}_${user._id.toString().slice(-6)}`;
    const transaction = await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: finalTxAmount,
      ksAmount: amount,
      status: "pending",
      paymentMethod: network,
      paymentType: "local",
      packageId: finalPackageId,
      paystackRef: reference,
      tigerpayRef: reference
    });

    // Call TigerPayPro API
    try {
      const response = await axios.post(
        `${TIGERPAY_API}/create_order.php`,
        {
          amount: amount,
          buyer_phone: phone,
          buyer_name: user.username || 'Customer',
          buyer_email: user.email || 'customer@email.com'
        },
        {
          headers: {
            'X-API-KEY': TIGERPAY_PUBLIC_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data;

      if (data.status === 'success') {
        await Transaction.findByIdAndUpdate(transaction._id, {
          orderId: data.order_id,
          tigerpayRef: data.reference || reference,
          updatedAt: new Date()
        });

        res.json({
          success: true,
          reference: data.reference || reference,
          orderId: data.order_id,
          message: data.message || `Check your ${network} phone for the payment prompt.`
        });
      } else {
        await Transaction.findByIdAndUpdate(transaction._id, {
          status: "failed",
          error: data.message || "TigerPay initiation failed"
        });
        await recordPaymentFailure(user._id.toString());
        res.status(400).json({ error: data.message || "Failed to initiate payment" });
      }
    } catch (apiError) {
      console.error("TigerPay API Error:", apiError);
      await Transaction.findByIdAndUpdate(transaction._id, {
        status: "failed",
        error: "TigerPay API error"
      });
      await recordPaymentFailure(user._id.toString());
      res.status(500).json({ error: "Payment gateway error" });
    }
  } catch (error) {
    console.error("TigerPay Initiate Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== TIGERPAY - CHECK STATUS =====
router.get("/tigerpay/status/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = req.params.reference;
    
    const transaction = await Transaction.findOne({ 
      tigerpayRef: reference,
      userId: req.user!._id
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (transaction.status === "success") {
      return res.json({ status: "success", txAmount: transaction.txAmount });
    }

    if (transaction.status === "failed") {
      return res.json({ status: "failed" });
    }

    // Check with TigerPay
    try {
      const response = await axios.post(
        `${TIGERPAY_API}/order_status.php`,
        { order_id: transaction.orderId },
        {
          headers: {
            'X-API-KEY': TIGERPAY_PUBLIC_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const data = response.data;

      if (data.payment_status === 'completed') {
        transaction.status = "success";
        transaction.paidAt = data.paid_at ? new Date(data.paid_at) : new Date();
        await transaction.save();

        // Add SQ to user
        const user = await User.findById(transaction.userId);
        if (user) {
          user.txCoins += transaction.txAmount;
          await user.save();
          await notifyOwner(`💰 *Payment Confirmed (TigerPay)*\n\nUser: \`${user.email}\`\nAmount: ${transaction.txAmount} SQ\nRef: \`${reference}\``).catch(() => {});
        }

        res.json({
          status: "success",
          txAmount: transaction.txAmount,
          message: "Payment confirmed!"
        });
      } else if (data.payment_status === 'failed' || data.payment_status === 'cancelled') {
        transaction.status = "failed";
        transaction.error = data.payment_status;
        await transaction.save();
        await recordPaymentFailure(transaction.userId.toString());
        res.json({ status: "failed", message: "Payment failed or cancelled" });
      } else {
        res.json({ status: "pending", message: "Payment still pending" });
      }
    } catch (apiError) {
      console.error("TigerPay Status API Error:", apiError);
      res.json({ status: "pending", message: "Still checking..." });
    }
  } catch (error) {
    console.error("TigerPay Status Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== MIN PAY (INTERNATIONAL - MANUAL) =====
router.post("/minpay/request", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      packageId: z.string().optional(),
      txAmount: z.number().min(1),
      ksAmount: z.number().min(1),
      username: z.string(),
      email: z.string().email()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { packageId, txAmount, ksAmount, username, email } = parsed.data;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Create min pay request
    const minPayRequest = {
      userId: user._id,
      username: username || user.username,
      email: email || user.email,
      packageId: packageId || null,
      txAmount,
      ksAmount,
      status: "pending",
      adminPhone: ADMIN_PHONE,
      adminName: ADMIN_NAME,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await (global.db as any).collection('minpay_requests').insertOne(minPayRequest);
    const requestId = result.insertedId.toString();

    // Create pending transaction
    const reference = `MIN_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      status: "pending",
      paymentMethod: "minpay",
      paymentType: "international",
      packageId: packageId || null,
      paystackRef: reference,
      minPayRequestId: requestId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Notify admin
    await notifyAdmin({
      title: '📱 *New Min Pay Request (International)*',
      username: username || user.username,
      email: email || user.email,
      ksAmount,
      txAmount,
      adminPhone: ADMIN_PHONE,
      adminName: ADMIN_NAME
    });

    res.json({
      success: true,
      requestId,
      message: "Request submitted. Admin will confirm shortly.",
      adminPhone: ADMIN_PHONE,
      adminName: ADMIN_NAME
    });
  } catch (error) {
    console.error("MinPay Request Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== MIN PAY - ADMIN CONFIRM =====
router.post("/minpay/confirm/:requestId", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    // Admin only
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { requestId } = req.params;
    const request = await (global.db as any).collection('minpay_requests').findOne({ 
      _id: new ObjectId(requestId) 
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    // Update request
    await (global.db as any).collection('minpay_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { 
        $set: { 
          status: "confirmed",
          confirmedAt: new Date(),
          confirmedBy: req.user?._id,
          updatedAt: new Date()
        } 
      }
    );

    // Update transaction
    const transaction = await Transaction.findOne({ minPayRequestId: requestId });
    if (transaction) {
      transaction.status = "success";
      transaction.paidAt = new Date();
      await transaction.save();

      // Add SQ to user
      const user = await User.findById(request.userId);
      if (user) {
        user.txCoins += request.txAmount;
        await user.save();
        await notifyOwner(`💰 *Payment Confirmed (Min Pay)*\n\nUser: \`${user.email}\`\nAmount: ${request.txAmount} SQ\nMethod: International`).catch(() => {});
      }
    }

    res.json({
      success: true,
      message: `Added ${request.txAmount} SQ to user ${request.username}`
    });
  } catch (error) {
    console.error("MinPay Confirm Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== MIN PAY - REJECT REQUEST =====
router.post("/minpay/reject/:requestId", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { requestId } = req.params;
    const { reason } = req.body;

    const request = await (global.db as any).collection('minpay_requests').findOne({ 
      _id: new ObjectId(requestId) 
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    await (global.db as any).collection('minpay_requests').updateOne(
      { _id: new ObjectId(requestId) },
      { 
        $set: { 
          status: "rejected",
          error: reason || "Payment not confirmed",
          updatedAt: new Date()
        } 
      }
    );

    await Transaction.findOneAndUpdate(
      { minPayRequestId: requestId },
      { 
        status: "failed",
        error: reason || "Rejected by admin",
        updatedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: "Request rejected"
    });
  } catch (error) {
    console.error("MinPay Reject Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== MIN PAY - GET REQUESTS (Admin) =====
router.get("/minpay/requests", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const requests = await (global.db as any).collection('minpay_requests')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(requests);
  } catch (error) {
    console.error("MinPay List Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== WEBHOOK - TigerPayPro Callback =====
router.post("/webhooks/tigerpay", async (req: Request, res: Response) => {
  try {
    const { order_id, reference, status, amount, buyer_phone } = req.body;
    
    const transaction = await Transaction.findOne({ 
      orderId: order_id 
    });

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (status === "success" || status === "completed") {
      if (transaction.status === "pending") {
        transaction.status = "success";
        transaction.paidAt = new Date();
        await transaction.save();

        const user = await User.findById(transaction.userId);
        if (user) {
          user.txCoins += transaction.txAmount;
          await user.save();
          await notifyOwner(`💰 *Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${transaction.txAmount} SQ\nRef: \`${reference || order_id}\``).catch(() => {});
        }
      }
    } else if (status === "failed" || status === "cancelled") {
      if (transaction.status === "pending") {
        transaction.status = "failed";
        transaction.error = status;
        await transaction.save();
        await recordPaymentFailure(transaction.userId.toString());
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook Error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ===== PAYMENT HISTORY =====
router.get("/history", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(transactions);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ===== CUSTOM PAYMENT =====
router.post("/initiate-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      txAmount: z.number().min(3),
      ksAmount: z.number().min(15).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const reference = `CUST_${Date.now()}_${user._id.toString().slice(-6)}`;
    
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      status: "pending",
      paymentMethod: "custom",
      paymentType: "local",
      paystackRef: reference,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Send to TigerPay
    try {
      const response = await axios.post(
        `${TIGERPAY_API}/create_order.php`,
        {
          amount: ksAmount,
          buyer_phone: req.body.phone || "255700000000",
          buyer_name: user.username || 'Customer',
          buyer_email: user.email || 'customer@email.com'
        },
        {
          headers: {
            'X-API-KEY': TIGERPAY_PUBLIC_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const data = response.data;
      if (data.status === 'success') {
        await Transaction.findOneAndUpdate(
          { paystackRef: reference },
          { orderId: data.order_id, tigerpayRef: data.reference }
        );
        res.json({
          reference: data.reference,
          orderId: data.order_id,
          message: "Check your phone for the payment prompt."
        });
      } else {
        throw new Error(data.message || "TigerPay initiation failed");
      }
    } catch (apiError) {
      await Transaction.findOneAndUpdate(
        { paystackRef: reference },
        { status: "failed", error: "TigerPay API error" }
      );
      res.status(500).json({ error: "Payment gateway error" });
    }
  } catch (error) {
    console.error("Custom Initiate Error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;