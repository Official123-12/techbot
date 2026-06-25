import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { User } from "../models/User.js";
import { Package } from "../models/Package.js";
import { Referral } from "../models/Referral.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { getClientIP, generateReferralCode, canRegisterWithIP, recordIPAndFingerprint } from "../utils/fingerprint.js";
import { IPRecord } from "../models/IPRecord.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "";

const signupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i),
  password: z.string().min(6),
  referralCode: z.string().optional(),
  fingerprint: z.string().optional()
});

const loginSchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string()
});

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

async function syncDefaultPackages(): Promise<void> {
  const packages = [
    { name: "Starter", ksPrice: 50, txAmount: 10, bonusTx: 0, isBestDeal: false, order: 1, active: true },
    { name: "Basic", ksPrice: 100, txAmount: 20, bonusTx: 0, isBestDeal: false, order: 2, active: true },
    { name: "Standard", ksPrice: 150, txAmount: 30, bonusTx: 0, isBestDeal: false, order: 3, active: true },
    { name: "Pro", ksPrice: 250, txAmount: 50, bonusTx: 5, isBestDeal: true, order: 4, active: true },
    { name: "Elite", ksPrice: 500, txAmount: 100, bonusTx: 10, isBestDeal: false, order: 5, active: true },
    { name: "Ultimate", ksPrice: 1000, txAmount: 200, bonusTx: 20, isBestDeal: false, order: 6, active: true },
  ];
  for (const pkg of packages) {
    await Package.findOneAndUpdate({ order: pkg.order }, { $set: pkg }, { upsert: true });
  }
}

router.post("/signup", authRateLimit, async (req, res) => {
  try {
    await syncDefaultPackages();
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input. Username must be 3-20 chars, letters/numbers/underscores only." });
      return;
    }
    const { email, username, password, referralCode, fingerprint } = parsed.data;
    const uname = username.toLowerCase();
    const ip = getClientIP(req);

    const ipCheck = await canRegisterWithIP(ip, fingerprint || "");
    if (!ipCheck.allowed) {
      res.status(403).json({ error: ipCheck.reason });
      return;
    }

    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }),
      User.findOne({ username: uname })
    ]);
    if (existingEmail) { res.status(409).json({ error: "Email already registered" }); return; }
    if (existingUsername) { res.status(409).json({ error: "Username already taken" }); return; }

    const passwordHash = await bcrypt.hash(password, 12);
    const refCode = generateReferralCode();

    let referrerId = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) referrerId = referrer._id;
    }

    const user = await User.create({
      email,
      username: uname,
      passwordHash,
      txCoins: 0,
      referralCode: refCode,
      referredBy: referrerId
    });

    await recordIPAndFingerprint(ip, user._id.toString(), fingerprint || "");

    if (referrerId) {
        const existingReferral = await Referral.findOne({ referredId: user._id });
        if (!existingReferral) {
          const { Transaction } = await import("../models/Transaction.js");
          const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
          const [referrerIPRecords, recentReferralCount] = await Promise.all([
            IPRecord.find({ userId: referrerId.toString() }, { ip: 1 }).lean(),
            Referral.countDocuments({ referrerId, createdAt: { $gte: hourAgo } })
          ]);
          const referrerIPs = new Set(referrerIPRecords.map((r: { ip: string }) => r.ip));
          const sameIP = referrerIPs.has(ip);
          const isAbuse = sameIP || recentReferralCount >= 3;
          if (isAbuse) {
            const flagReason = sameIP ? "referrer_ip_match" : "referral_rate_limit";
            await Referral.create({ referrerId, referredId: user._id, txRewarded: 0, flagged: true, flagReason });
            if (sameIP) {
              await User.findByIdAndUpdate(referrerId, { $set: { isBanned: true, banReason: "Referral abuse detected: same-IP self-referral" } });
            }
          } else {
            await Referral.create({ referrerId, referredId: user._id, txRewarded: 2 });
            await User.findByIdAndUpdate(referrerId, { $inc: { txCoins: 2 } });
            await Transaction.create({ userId: referrerId, type: "admin_grant", txAmount: 2, ksAmount: 0, status: "success" });
            await User.findByIdAndUpdate(user._id, { $inc: { txCoins: 2 } });
            await Transaction.create({ userId: user._id, type: "admin_grant", txAmount: 2, ksAmount: 0, status: "success" });
          }
        }
      }

  
    const token = generateToken(user._id.toString());
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        txCoins: user.txCoins,
        isBanned: user.isBanned,
        referralCode: user.referralCode
      }
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login", authRateLimit, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { usernameOrEmail, password } = parsed.data;
    const isEmail = usernameOrEmail.includes("@");
    const user = isEmail
      ? await User.findOne({ email: usernameOrEmail.toLowerCase() })
      : await User.findOne({ username: usernameOrEmail.toLowerCase() });
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if ((user as unknown as { isBanned?: boolean }).isBanned) {
      res.status(403).json({ error: "Your account has been banned. Contact support for assistance." });
      return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = generateToken(user._id.toString());
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: (user as unknown as { username?: string }).username,
        txCoins: user.txCoins,
        isBanned: user.isBanned,
        referralCode: user.referralCode
      }
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = req.user;
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    let referralCode = (user as unknown as { referralCode?: string }).referralCode || "";
    if (!referralCode) {
      referralCode = generateReferralCode();
      await User.updateOne({ _id: user._id }, { $set: { referralCode } });
    }
    res.json({
      id: user._id,
      email: user.email,
      username: (user as unknown as { username?: string }).username,
      txCoins: user.txCoins,
      usedFreeTrial: user.usedFreeTrial,
      isBanned: (user as unknown as { isBanned?: boolean }).isBanned || false,
      referralCode
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/username", authGuard, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/i)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Username must be 3-20 characters (letters, numbers, underscores only)" });
      return;
    }
    const uname = parsed.data.username.toLowerCase();
    const existing = await User.findOne({ username: uname, _id: { $ne: req.user!._id } });
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    await User.updateOne({ _id: req.user!._id }, { $set: { username: uname } });
    res.json({ success: true, username: uname });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

export default router;
