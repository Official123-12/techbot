import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Package } from "../models/Package.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { paymentRateLimit } from "../middleware/rateLimit.js";
import {
  verifyWebhookSignature,
  verifyTransaction,
  initializeTransaction,
  chargeMobileMoney,
  getChargeStatus,
  normalizePhone,
  PAYSTACK_PUBLIC_KEY,
} from "../services/paystack.js";
import { notifyOwner } from "../services/notify.js";
import { tigerpay } from "../services/tigerpay.js";
import { minpay } from "../services/minpay.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();
const MAX_DAILY_FAILURES = 7;

// Multer setup for screenshot uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "screenshots");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `minpay_${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  }
});

function getParam(val: string | string[]): string {
  return Array.isArray(val) ? (val[0] ?? "") : val;
}

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

// ============================================
// WEBHOOK HANDLER (TigerPay + MINPAY)
// ============================================
export async function paystackWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const signature = Array.isArray(req.headers["x-paystack-signature"])
      ? req.headers["x-paystack-signature"][0]
      : req.headers["x-paystack-signature"] || "";
    
    // TigerPay Webhook
    if (req.body.provider === "tigerpay") {
      const result = await tigerpay.handleWebhook(req.body);
      if (result) {
        res.json({ received: true });
        return;
      }
    }

    // MINPAY Webhook (International)
    if (req.body.provider === "minpay") {
      const result = await minpay.handleWebhook(req.body);
      if (result) {
        res.json({ received: true });
        return;
      }
    }

    // Fallback: Paystack webhook (for backward compatibility)
    if (!signature) { 
      res.status(400).json({ error: "Missing signature" }); 
      return; 
    }
    const body = JSON.stringify(req.body);
    if (!verifyWebhookSignature(body, signature)) { 
      res.status(400).json({ error: "Invalid signature" }); 
      return; 
    }
    const event = req.body;
    if (event.event === "charge.success") {
      const reference = event.data.reference as string;
      const tx = await Transaction.findOne({ paystackRef: reference });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(tx.userId);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          await notifyOwner(`💰 *Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} SQ (TSh ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
        }
      }
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

// ============================================
// CONFIG
// ============================================
router.get("/config", (_req, res) => {
  res.json({ 
    paystackPublicKey: PAYSTACK_PUBLIC_KEY,
    currency: "TSh",
    currencyCode: "TZS"
  });
});

router.get("/packages", async (_req, res) => {
  try {
    const packages = await Package.find({ active: true }).sort({ order: 1 }).lean();
    // Convert prices to TSH
    const formatted = packages.map(p => ({
      ...p,
      price: (p as any).txAmount * 1000, // Convert to TSH
      currency: "TSh"
    }));
    res.json(formatted);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// TIGERPAY (LOCAL PAYMENTS - AUTOPAY)
// ============================================
router.post("/tigerpay/initiate", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      packageId: z.string().optional(),
      txAmount: z.number().min(1).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }

    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }

    let txAmount = parsed.data.txAmount || 0;
    let ksAmount = 0;

    if (parsed.data.packageId) {
      const pkg = await Package.findById(parsed.data.packageId);
      if (!pkg) { 
        res.status(404).json({ error: "Package not found" }); 
        return; 
      }
      txAmount = (pkg as any).txAmount || 0;
      ksAmount = txAmount * 1000; // TSH conversion
    } else {
      // Custom amount
      ksAmount = txAmount * 1000;
    }

    if (txAmount < 1) {
      res.status(400).json({ error: "Minimum amount is 1 SQ" });
      return;
    }

    const reference = `SQ_${Date.now()}_${user._id.toString().slice(-6)}`;

    // Initialize TigerPay
    const result = await tigerpay.initializePayment({
      amount: ksAmount,
      email: user.email,
      phone: user.phone || "",
      name: user.name || user.email,
      reference
    });

    if (!result.status) {
      res.status(500).json({ error: result.message || "Payment initialization failed" });
      return;
    }

    // Create transaction
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      paystackRef: reference,
      status: "pending",
      provider: "tigerpay"
    });

    res.json({ 
      authorizationUrl: result.data?.paymentUrl,
      reference,
      amount: ksAmount,
      currency: "TSh"
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment initiation failed";
    res.status(500).json({ error: message });
  }
});

// ============================================
// MINPAY (INTERNATIONAL PAYMENTS)
// ============================================
router.post("/minpay/initiate", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      txAmount: z.number().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }

    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }

    const txAmount = parsed.data.txAmount;
    const ksAmount = txAmount * 1000; // TSH conversion

    // Create MINPAY transaction
    const reference = `MINPAY_${Date.now()}_${user._id.toString().slice(-6)}`;

    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      paystackRef: reference,
      status: "pending",
      provider: "minpay"
    });

    res.json({ 
      reference,
      minpayNumber: "255787069580",
      minpayName: "Masanyiwa Stanley",
      instructions: {
        step1: "Send the exact amount to MINPAY number: 255787069580",
        step2: "Name: Masanyiwa Stanley",
        step3: `Amount: TSh ${ksAmount.toLocaleString()}`,
        step4: "Upload screenshot of payment confirmation below"
      },
      amount: ksAmount,
      currency: "TSh"
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate MINPAY";
    res.status(500).json({ error: message });
  }
});

// ============================================
// MINPAY - UPLOAD SCREENSHOT
// ============================================
router.post("/minpay/upload", authGuard, banCheck, upload.single("screenshot"), async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      reference: z.string(),
      amount: z.number()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }

    if (!req.file) {
      res.status(400).json({ error: "Screenshot is required" });
      return;
    }

    const { reference, amount } = parsed.data;
    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }

    const tx = await Transaction.findOne({ paystackRef: reference, userId: user._id });
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    if (tx.status === "success") {
      res.status(400).json({ error: "Transaction already completed" });
      return;
    }

    // Save screenshot path
    tx.metadata = {
      ...tx.metadata,
      screenshot: req.file.path,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.email
    };
    await tx.save();

    // Send notification to owner via WhatsApp/Bot
    const message = `📸 *MINPAY Payment Screenshot Uploaded*\n\n` +
      `👤 User: ${user.email}\n` +
      `💰 Amount: TSh ${amount.toLocaleString()}\n` +
      `📱 Phone: ${user.phone || "N/A"}\n` +
      `🆔 Ref: ${reference}\n` +
      `📅 Time: ${new Date().toLocaleString()}\n\n` +
      `⚠️ Verify payment and confirm manually!`;

    await notifyOwner(message);

    // Send WhatsApp notification
    await minpay.sendWhatsAppNotification({
      message,
      phone: "255787069580" // Owner's number
    });

    res.json({ 
      success: true, 
      message: "Screenshot uploaded successfully. Waiting for admin verification.",
      reference
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    res.status(500).json({ error: message });
  }
});

// ============================================
// MINPAY - ADMIN VERIFY PAYMENT
// ============================================
router.post("/minpay/verify", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      reference: z.string(),
      status: z.enum(["success", "failed"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }

    // Check if user is admin
    const user = await User.findById(req.user!._id);
    if (!user || !user.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const { reference, status } = parsed.data;
    const tx = await Transaction.findOne({ paystackRef: reference });
    if (!tx) {
      res.status(404).json({ error: "Transaction not found" });
      return;
    }

    if (status === "success") {
      tx.status = "success";
      await tx.save();
      
      const user = await User.findById(tx.userId);
      if (user) {
        user.txCoins += tx.txAmount;
        await user.save();

        // Notify user
        await notifyOwner(`✅ *MINPAY Payment Verified*\n\nUser: ${user.email}\nAmount: ${tx.txAmount} SQ (TSh ${tx.ksAmount})\nRef: ${reference}`);
        
        // Send WhatsApp to user
        await minpay.sendWhatsAppNotification({
          message: `✅ Your payment of TSh ${tx.ksAmount.toLocaleString()} has been verified!\nYou have received ${tx.txAmount} SQ coins.`,
          phone: user.phone || "255787069580"
        });
      }
    } else {
      tx.status = "failed";
      await tx.save();
    }

    res.json({ success: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    res.status(500).json({ error: message });
  }
});

// ============================================
// CHARGE (Mobile Money - Legacy)
// ============================================
router.post("/charge", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      packageId: z.string(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }
    const { packageId, phone, provider } = parsed.data;
    const pkg = await Package.findById(packageId);
    if (!pkg) { 
      res.status(404).json({ error: "Package not found" }); 
      return; 
    }
    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }
    const reference = `TXM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: (pkg as any).ksPrice * 100,
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference
    });
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: (pkg as any).txAmount + (pkg as any).bonusTx,
      ksAmount: (pkg as any).ksPrice,
      paystackRef: charge.reference,
      status: "pending"
    });
    res.json({
      reference: charge.reference,
      message: charge.display_text ?? "Check your phone for the payment prompt."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    res.status(400).json({ error: message });
  }
});

// ============================================
// CHARGE STATUS
// ============================================
router.get("/charge/status/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    let status: string;
    try {
      status = await getChargeStatus(reference);
    } catch {
      res.json({ status: "pending" });
      return;
    }
    if (status === "success") {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(req.user!._id);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          await notifyOwner(`💰 *Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} SQ (TSh ${tx.ksAmount})\nMethod: Mobile Money\nRef: \`${reference}\``).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { 
        res.json({ status: "success", txAmount: tx.txAmount }); 
        return; 
      }
    }
    if (["failed", "abandoned", "cancelled", "reversed"].includes(status)) {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "failed";
        await tx.save();
        await recordPaymentFailure(req.user!._id.toString());
      }
      res.json({ status });
      return;
    }
    res.json({ status });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// WEBHOOK
// ============================================
router.post("/webhook", paystackWebhookHandler);

// ============================================
// CALLBACK
// ============================================
router.get("/callback", async (req, res) => {
  try {
    const reference = typeof req.query.reference === "string" ? req.query.reference : "";
    if (!reference) { 
      res.redirect("/topup?status=failed"); 
      return; 
    }
    const tx = await Transaction.findOne({ paystackRef: reference });
    if (!tx) { 
      res.redirect("/topup?status=failed"); 
      return; 
    }
    if (tx.status === "pending") {
      const result = await verifyTransaction(reference);
      if (result.success) {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(tx.userId);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          await notifyOwner(`💰 *Payment Confirmed (Callback)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} SQ (TSh ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
        }
      } else {
        tx.status = "failed";
        await tx.save();
        await recordPaymentFailure(tx.userId.toString());
      }
    }
    res.redirect(`/topup?status=${tx.status === "success" ? "success" : "failed"}&ref=${reference}`);
  } catch {
    res.redirect("/topup?status=failed");
  }
});

// ============================================
// VERIFY
// ============================================
router.get("/verify/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
    if (!tx) { 
      res.status(404).json({ error: "Transaction not found" }); 
      return; 
    }
    if (tx.status === "success") { 
      res.json({ status: "success", txAmount: tx.txAmount }); 
      return; 
    }
    if (tx.status === "failed") { 
      res.json({ status: "failed", txAmount: tx.txAmount }); 
      return; 
    }
    const result = await verifyTransaction(reference);
    if (result.success) {
      tx.status = "success";
      await tx.save();
      const user = await User.findById(tx.userId);
      if (user) {
        user.txCoins += tx.txAmount;
        await user.save();
        await notifyOwner(`💰 *Payment Verified*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} SQ (TSh ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
      }
      res.json({ status: "success", txAmount: tx.txAmount });
    } else {
      res.json({ status: "pending", txAmount: tx.txAmount });
    }
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// HISTORY
// ============================================
router.get("/history", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!._id }).sort({ createdAt: -1 }).lean();
    res.json(transactions);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

const TX_RATE_TSH = 1000; // 1 SQ = 1000 TSh

// ============================================
// INITIATE CUSTOM
// ============================================
router.post("/initiate-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      txAmount: z.number().min(1), 
      ksAmount: z.number().min(1000).optional() 
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }
    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_TSH;
    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }
    const reference = `TXCUST_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransaction(user.email, ksAmount, reference, { 
      userId: user._id.toString(), 
      txAmount 
    });
    if (!result.success) { 
      res.status(500).json({ error: "Failed to initialize payment" }); 
      return; 
    }
    await Transaction.create({ 
      userId: user._id, 
      type: "topup", 
      txAmount, 
      ksAmount, 
      paystackRef: reference, 
      status: "pending" 
    });
    res.json({ 
      authorizationUrl: result.authorizationUrl, 
      accessCode: result.accessCode, 
      reference 
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ============================================
// PREPARE CARD
// ============================================
router.post("/prepare-card", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ packageId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }
    const pkg = await Package.findById(parsed.data.packageId);
    if (!pkg) { 
      res.status(404).json({ error: "Package not found" }); 
      return; 
    }
    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }
    const reference = `TXCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({ 
      userId: user._id, 
      type: "topup", 
      txAmount: (pkg as any).txAmount + (pkg as any).bonusTx, 
      ksAmount: (pkg as any).ksPrice, 
      paystackRef: reference, 
      status: "pending" 
    });
    res.json({ reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/prepare-card-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ 
      txAmount: z.number().min(1), 
      ksAmount: z.number().min(1000).optional() 
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { 
      res.status(400).json({ error: "Invalid input" }); 
      return; 
    }
    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_TSH;
    const user = await User.findById(req.user!._id);
    if (!user) { 
      res.status(404).json({ error: "User not found" }); 
      return; 
    }
    const reference = `TXCCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({ 
      userId: user._id, 
      type: "topup", 
      txAmount, 
      ksAmount, 
      paystackRef: reference, 
      status: "pending" 
    });
    res.json({ reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;