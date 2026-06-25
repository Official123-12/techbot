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

const router = Router();
const MAX_DAILY_FAILURES = 7;

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

export async function paystackWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const signature = Array.isArray(req.headers["x-paystack-signature"])
      ? req.headers["x-paystack-signature"][0]
      : req.headers["x-paystack-signature"] || "";
    if (!signature) { res.status(400).json({ error: "Missing signature" }); return; }
    const body = JSON.stringify(req.body);
    if (!verifyWebhookSignature(body, signature)) { res.status(400).json({ error: "Invalid signature" }); return; }
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
          notifyOwner(`💰 *Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (KES ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
        }
      }
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

router.get("/config", (_req, res) => {
  res.json({ paystackPublicKey: PAYSTACK_PUBLIC_KEY });
});

router.get("/packages", async (_req, res) => {
  try {
    const packages = await Package.find({ active: true }).sort({ order: 1 }).lean();
    res.json(packages);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/initiate", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ packageId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const pkg = await Package.findById(parsed.data.packageId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TX_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransaction(user.email, pkg.ksPrice, reference, {
      packageId: pkg._id.toString(),
      userId: user._id.toString(),
      txAmount: pkg.txAmount + pkg.bonusTx
    });
    if (!result.success) { res.status(500).json({ error: "Failed to initialize payment" }); return; }
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: pkg.txAmount + pkg.bonusTx,
      ksAmount: pkg.ksPrice,
      paystackRef: reference,
      status: "pending"
    });
    res.json({ authorizationUrl: result.authorizationUrl, accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/charge", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      packageId: z.string(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { packageId, phone, provider } = parsed.data;
    const pkg = await Package.findById(packageId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: pkg.ksPrice * 100,
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference
    });
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: pkg.txAmount + pkg.bonusTx,
      ksAmount: pkg.ksPrice,
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

router.post("/charge-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      txAmount: z.number().min(3),
      ksAmount: z.number().min(15).optional(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { txAmount, phone, provider } = parsed.data;
    const TX_RATE_KES = 5;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXCUSTM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: ksAmount * 100,
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference
    });
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
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
          notifyOwner(`💰 *Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (KES ${tx.ksAmount})\nMethod: Mobile Money\nRef: \`${reference}\``).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
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

router.post("/webhook", paystackWebhookHandler);

router.get("/callback", async (req, res) => {
  try {
    const reference = typeof req.query.reference === "string" ? req.query.reference : "";
    if (!reference) { res.redirect("/topup?status=failed"); return; }
    const tx = await Transaction.findOne({ paystackRef: reference });
    if (!tx) { res.redirect("/topup?status=failed"); return; }
    if (tx.status === "pending") {
      const result = await verifyTransaction(reference);
      if (result.success) {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(tx.userId);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *Payment Confirmed (Callback)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (KES ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
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

router.get("/verify/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
    if (tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
    if (tx.status === "failed") { res.json({ status: "failed", txAmount: tx.txAmount }); return; }
    const result = await verifyTransaction(reference);
    if (result.success) {
      tx.status = "success";
      await tx.save();
      const user = await User.findById(tx.userId);
      if (user) {
        user.txCoins += tx.txAmount;
        await user.save();
        notifyOwner(`💰 *Payment Verified*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (KES ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
      }
      res.json({ status: "success", txAmount: tx.txAmount });
    } else {
      res.json({ status: "pending", txAmount: tx.txAmount });
    }
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/history", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user!._id }).sort({ createdAt: -1 }).lean();
    res.json(transactions);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

const TX_RATE_KES = 5;

router.post("/initiate-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ txAmount: z.number().min(3), ksAmount: z.number().min(15).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXCUST_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransaction(user.email, ksAmount, reference, { userId: user._id.toString(), txAmount });
    if (!result.success) { res.status(500).json({ error: "Failed to initialize payment" }); return; }
    await Transaction.create({ userId: user._id, type: "topup", txAmount, ksAmount, paystackRef: reference, status: "pending" });
    res.json({ authorizationUrl: result.authorizationUrl, accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

  router.post("/prepare-card", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ packageId: z.string() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
      const pkg = await Package.findById(parsed.data.packageId);
      if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
      const user = await User.findById(req.user!._id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      const reference = `TXCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
      await Transaction.create({ userId: user._id, type: "topup", txAmount: pkg.txAmount + pkg.bonusTx, ksAmount: pkg.ksPrice, paystackRef: reference, status: "pending" });
      res.json({ reference });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  router.post("/prepare-card-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ txAmount: z.number().min(3), ksAmount: z.number().min(15).optional() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
      const { txAmount } = parsed.data;
      const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
      const user = await User.findById(req.user!._id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      const reference = `TXCCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
      await Transaction.create({ userId: user._id, type: "topup", txAmount, ksAmount, paystackRef: reference, status: "pending" });
      res.json({ reference });
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  export default router;
  