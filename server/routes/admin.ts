import { Router } from "express";
    import jwt from "jsonwebtoken";
    import bcrypt from "bcryptjs";
    import mongoose from "mongoose";
    import { User } from "../models/User.js";
    import { Bot } from "../models/Bot.js";
    import { Panel } from "../models/Panel.js";
    import { Transaction } from "../models/Transaction.js";
    import { Coupon } from "../models/Coupon.js";
    import { Referral } from "../models/Referral.js";
    import { Team } from "../models/Team.js";
    import { Tutorial } from "../models/Tutorial.js";
    import { BlockedTrial } from "../models/BlockedTrial.js";
    import { IPRecord } from "../models/IPRecord.js";
    import { TrialCheck } from "../models/TrialCheck.js";
    import { BotTemplate } from "../models/BotTemplate.js";
    import { deleteApp, enableMaintenanceMode, disableMaintenanceMode, restartApp, getTeamAppCount, getTeamApps } from "../services/heroku.js";
    import type { Request, Response, NextFunction } from "express";
    import type { IUser } from "../models/User.js";

    const ADMIN_EMAIL = "xhclinton@gmail.com";
    const TEAM_MAX_APPS = 100;
    const router = Router();

    interface AdminRequest extends Request {
      user?: IUser;
    }

    async function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
      const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
      if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { userId: string };
        const user = await User.findById(decoded.userId).lean();
        if (!user || user.email !== ADMIN_EMAIL) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        req.user = user as unknown as IUser;
        next();
      } catch {
        res.status(401).json({ error: "Invalid token" });
      }
    }

    router.use(adminAuth);

    router.get("/stats", async (_req, res) => {
      try {
        const [allUsers, allBots, allTx, allCoupons, allReferrals, totalPanels] = await Promise.all([
          User.find({}).lean(),
          Bot.find({}).lean(),
          Transaction.find({ status: "success" }).lean(),
          Coupon.find({}).lean(),
          Referral.find({}).lean(),
          Panel.countDocuments()
        ]);
        const nonAdminUsers = allUsers.filter(u => u.email !== ADMIN_EMAIL);
        const totalTxInCirculation = nonAdminUsers.reduce((s, u) => s + (u.txCoins || 0), 0);
        const totalRevenue = allTx.reduce((s, t) => s + (t.ksAmount || 0), 0);
        res.json({
          totalUsers: nonAdminUsers.length,
          totalBots: allBots.length,
          activeBots: allBots.filter(b => b.status === "running").length,
          totalRevenue,
          totalTxInCirculation,
          totalTransactions: allTx.length,
          totalCoupons: allCoupons.length,
          claimedCoupons: allCoupons.filter(c => c.claimedBy).length,
          totalReferrals: allReferrals.length,
          totalPanels
        });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/users", async (_req, res) => {
      try {
        const users = await User.find({ email: { $ne: ADMIN_EMAIL } }).lean();
        const bots = await Bot.find({}).lean();
        const botCountMap: Record<string, number> = {};
        for (const b of bots) { const id = b.userId?.toString(); if (id) botCountMap[id] = (botCountMap[id] || 0) + 1; }
        res.json(users.map(u => ({
          _id: u._id,
          email: u.email,
          username: u.username || "",
          txCoins: u.txCoins,
          botCount: botCountMap[u._id.toString()] || 0,
          isBanned: (u as unknown as { isBanned?: boolean }).isBanned || false,
          banReason: (u as unknown as { banReason?: string }).banReason || "",
          referralCode: (u as unknown as { referralCode?: string }).referralCode || "",
          createdAt: u.createdAt
        })));
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/users/:id/ban", async (req, res) => {
      try {
        const { reason } = req.body || {};
        const user = await User.findByIdAndUpdate(req.params.id, { $set: { isBanned: true, banReason: reason || "", bannedAt: new Date() } }, { new: true });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        const activeBots = await Bot.find({ userId: req.params.id, status: { $in: ["running", "building"] } });
        await Promise.all(activeBots.map(async b => {
          try { await enableMaintenanceMode(b.herokuAppName); } catch {}
          await Bot.findByIdAndUpdate(b._id, { status: "stopped" });
        }));
        res.json({ ok: true, isBanned: user.isBanned });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/users/:id/unban", async (req, res) => {
      try {
        const user = await User.findByIdAndUpdate(req.params.id, { $set: { isBanned: false, banReason: "", paymentFailCount: 0, paymentFailDate: "" } }, { new: true });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        res.json({ ok: true, isBanned: user.isBanned });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/bots", async (_req, res) => {
      try {
        const bots = await Bot.find({}).lean();
        const userIds = [...new Set(bots.map(b => b.userId?.toString()).filter(Boolean))];
        const users = await User.find({ _id: { $in: userIds } }).select("email username").lean();
        const userMap: Record<string, { email: string; username: string }> = {};
        for (const u of users) userMap[u._id.toString()] = { email: u.email, username: u.username || "" };
        res.json(bots.map(b => ({
          _id: b._id,
          herokuAppName: b.herokuAppName,
          phoneNumber: b.phoneNumber,
          ownerEmail: userMap[b.userId?.toString()]?.email || "unknown",
          ownerUsername: userMap[b.userId?.toString()]?.username || "",
          status: b.status,
          teamName: b.teamName || "",
          templateName: (b as unknown as { templateName?: string }).templateName || "",
          expiresAt: b.expiresAt
        })));
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/transactions", async (_req, res) => {
      try {
        const txns = await Transaction.find({}).sort({ createdAt: -1 }).limit(500).lean();
        const userIds = [...new Set(txns.map(t => t.userId?.toString()).filter(Boolean))];
        const users = await User.find({ _id: { $in: userIds } }).select("email username").lean();
        const userMap: Record<string, { email: string; username: string }> = {};
        for (const u of users) userMap[u._id.toString()] = { email: u.email, username: u.username || "" };
        res.json(txns.map(t => ({
          _id: t._id,
          type: t.type,
          txAmount: Math.abs(t.txAmount),
          txSign: t.type === "admin_grant" || t.type === "topup" || t.type === "refund" ? "+" : "-",
          ksAmount: t.ksAmount,
          status: t.status,
          paystackRef: t.paystackRef,
          ownerEmail: userMap[t.userId?.toString()]?.email || "unknown",
          ownerUsername: userMap[t.userId?.toString()]?.username || "",
          userId: t.userId?.toString() || "",
          createdAt: t.createdAt
        })));
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/transactions/bulk", async (req, res) => {
      try {
        const { ids } = req.body || {};
        if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "No IDs provided" }); return; }
        await Transaction.deleteMany({ _id: { $in: ids } });
        res.json({ ok: true, deleted: ids.length });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/transactions/resolve-stale", async (_req, res) => {
      try {
        const cutoff = new Date(Date.now() - 60 * 60 * 1000);
        const result = await Transaction.updateMany(
          { status: "pending", createdAt: { $lt: cutoff } },
          { $set: { status: "failed" } }
        );
        res.json({ ok: true, updated: result.modifiedCount });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/users/:id/tx", async (req, res) => {
      try {
        const { amount } = req.body || {};
        const num = Number(amount);
        if (!num || num <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
        const user = await User.findByIdAndUpdate(req.params.id, { $inc: { txCoins: num } }, { new: true });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        await Transaction.create({ userId: req.params.id, type: "admin_grant", txAmount: num, ksAmount: 0, status: "success" });
        res.json({ ok: true, txCoins: user.txCoins });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/users/:id/subtract-tx", async (req, res) => {
      try {
        const { amount } = req.body || {};
        const num = Number(amount);
        if (!num || num <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
        const user = await User.findById(req.params.id);
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        user.txCoins = Math.max(0, user.txCoins - num);
        await user.save();
        res.json({ ok: true, txCoins: user.txCoins });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/users/:id/password", async (req, res) => {
      try {
        const { password } = req.body || {};
        if (!password || password.length < 6) { res.status(400).json({ error: "Password too short" }); return; }
        const hash = await bcrypt.hash(password, 12);
        const user = await User.findByIdAndUpdate(req.params.id, { passwordHash: hash }, { new: true });
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/users/:id", async (req, res) => {
      try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        const userBots = await Bot.find({ userId: req.params.id });
        await Promise.all(userBots.map(async b => { try { await deleteApp(b.herokuAppName); } catch {} }));
        await Bot.deleteMany({ userId: req.params.id });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/bots/:id/stop", async (req, res) => {
      try {
        const bot = await Bot.findById(req.params.id);
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        await enableMaintenanceMode(bot.herokuAppName);
        await Bot.findByIdAndUpdate(req.params.id, { status: "stopped" });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/bots/:id/start", async (req, res) => {
      try {
        const bot = await Bot.findById(req.params.id);
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        await disableMaintenanceMode(bot.herokuAppName);
        await Bot.findByIdAndUpdate(req.params.id, { status: "running" });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/bots/:id/restart", async (req, res) => {
      try {
        const bot = await Bot.findById(req.params.id);
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        await restartApp(bot.herokuAppName);
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/bots/:id", async (req, res) => {
      try {
        const bot = await Bot.findById(req.params.id);
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        try { await deleteApp(bot.herokuAppName); } catch {}
        await Bot.findByIdAndUpdate(req.params.id, { status: "deleted" });
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/bots/:id/logs", async (req, res) => {
      try {
        const bot = await Bot.findById(req.params.id);
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        const { getAppLogs } = await import("../services/heroku.js");
        const rawLogs = await getAppLogs(bot.herokuAppName);
        res.json({ logs: typeof rawLogs === "string" ? rawLogs.split("\n").filter(Boolean) : [] });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/transactions/:id", async (req, res) => {
      try {
        const tx = await Transaction.findByIdAndDelete(req.params.id);
        if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/coupons", async (_req, res) => {
      try {
        const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
        res.json(coupons);
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/coupons", async (req, res) => {
      try {
        const { code, txAmount } = req.body || {};
        if (!code || !txAmount) { res.status(400).json({ error: "Invalid input" }); return; }
        const existing = await Coupon.findOne({ code: code.toUpperCase() });
        if (existing) { res.status(409).json({ error: "Code already exists" }); return; }
        const coupon = await Coupon.create({ code: code.toUpperCase(), txAmount });
        res.json({ ok: true, coupon });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/coupons/:id", async (req, res) => {
      try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/referrals", async (_req, res) => {
      try {
        const referrals = await Referral.find({}).sort({ createdAt: -1 }).lean();
        const userIds = [
          ...new Set([
            ...referrals.map(r => r.referrerId?.toString()),
            ...referrals.map(r => r.referredId?.toString())
          ].filter(Boolean))
        ];
        const users = await User.find({ _id: { $in: userIds } }).select("email username").lean();
        const userMap: Record<string, { email: string; username: string }> = {};
        for (const u of users) userMap[u._id.toString()] = { email: u.email, username: u.username || "" };
        res.json(referrals.map(r => ({
          _id: r._id,
          referrerEmail: userMap[r.referrerId?.toString()]?.email || "unknown",
          referrerUsername: userMap[r.referrerId?.toString()]?.username || "",
          referredEmail: userMap[r.referredId?.toString()]?.email || "unknown",
          referredUsername: userMap[r.referredId?.toString()]?.username || "",
          txRewarded: r.txRewarded,
          createdAt: r.createdAt
        })));
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/referrals/all", async (_req, res) => {
      try {
        await Referral.deleteMany({});
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/teams", async (_req, res) => {
      try {
        const teams = await Team.find({}).sort({ createdAt: 1 }).lean();
        const enriched = await Promise.all(teams.map(async t => {
          let appCount = 0;
          let isFull = false;
          try {
            appCount = await getTeamAppCount(t.name);
            isFull = appCount >= TEAM_MAX_APPS;
          } catch {}
          return { ...t, appCount, isFull };
        }));
        res.json(enriched);
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/teams", async (req, res) => {
      try {
        const { name, billingLabel } = req.body || {};
        if (!name || name.length < 2) { res.status(400).json({ error: "Invalid team name" }); return; }
        const existing = await Team.findOne({ name });
        if (existing) { res.status(409).json({ error: "Team already exists" }); return; }
        const team = await Team.create({ name, billingLabel: billingLabel || name, active: true });
        res.json({ ok: true, team });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.patch("/teams/:id", async (req, res) => {
      try {
        const { billingLabel, active } = req.body || {};
        const update: Record<string, unknown> = {};
        if (billingLabel !== undefined) update.billingLabel = billingLabel;
        if (typeof active === "boolean") update.active = active;
        const team = await Team.findByIdAndUpdate(req.params.id, update, { new: true });
        if (!team) { res.status(404).json({ error: "Team not found" }); return; }
        res.json({ ok: true, team });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/teams/:id", async (req, res) => {
      try {
        await Team.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/db/stats", async (_req, res) => {
      try {
        const db = mongoose.connection.db;
        let storageInfo: { dataSize: number; storageSize: number; totalSize: number } | null = null;
        try {
          const stats = await db!.command({ dbStats: 1, scale: 1 });
          storageInfo = {
            dataSize: stats.dataSize as number,
            storageSize: stats.storageSize as number,
            totalSize: (stats.dataSize as number) + (stats.indexSize as number)
          };
        } catch {}
        const collections = [
          { key: "users", label: "Users", canPurge: false },
          { key: "bots", label: "Bots", canPurge: false },
          { key: "panels", label: "Panels", canPurge: false },
          { key: "transactions", label: "Transactions", canPurge: true },
          { key: "blockedtrials", label: "Blocked Trials", canPurge: true },
          { key: "iprecords", label: "IP Records", canPurge: true },
          { key: "trialchecks", label: "Trial Checks", canPurge: true },
          { key: "coupons", label: "Coupons", canPurge: true },
          { key: "referrals", label: "Referrals", canPurge: false },
        ];
        const counts = await Promise.all(collections.map(async c => {
          try {
            const count = await db!.collection(c.key).countDocuments();
            return { name: c.key, label: c.label, count, canPurge: c.canPurge };
          } catch {
            return { name: c.key, label: c.label, count: 0, canPurge: c.canPurge };
          }
        }));
        const quotaMb = Number(process.env.MONGO_STORAGE_QUOTA_MB || "512");
        let quota: { quotaMb: number; usedMb: number; remainingMb: number; usedPercent: number } | null = null;
        if (storageInfo) {
          const usedMb = storageInfo.storageSize / (1024 * 1024);
          const remainingMb = Math.max(0, quotaMb - usedMb);
          const usedPercent = Math.min(100, (usedMb / quotaMb) * 100);
          quota = { quotaMb, usedMb, remainingMb, usedPercent };
        }
        res.json({ collections: counts, storage: storageInfo, quota });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/db/purge/:collection", async (req, res) => {
      try {
        const allowed = ["transactions", "blockedtrials", "iprecords", "trialchecks", "coupons"];
        const col = req.params.collection.toLowerCase();
        if (!allowed.includes(col)) { res.status(403).json({ error: "Cannot purge this collection" }); return; }
        const db = mongoose.connection.db;
        await db!.collection(col).deleteMany({});
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/orphan-apps", async (_req, res) => {
      try {
        const teams = await Team.find({ active: true }).lean();
        const teamNames = teams.length > 0 ? (teams as { name: string }[]).map(t => t.name) : ["toxicxtech254"];
        const allAppNames: string[] = [];
        await Promise.all(teamNames.map(async team => {
          const apps = await getTeamApps(team);
          for (const name of apps) allAppNames.push(name);
        }));
        const siteApps = allAppNames.filter(n => n.startsWith("toxichost-") || n.startsWith("txhost"));
        const dbBots = await Bot.find({ herokuAppName: { $in: siteApps }, status: { $ne: "deleted" } }).select("herokuAppName").lean();
        const dbNames = new Set(dbBots.map(b => b.herokuAppName));
        const orphans = siteApps.filter(n => !dbNames.has(n));
        res.json({ orphans });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/orphan-apps/:appName", async (req, res) => {
      try {
        await deleteApp(req.params.appName);
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/tutorials", async (_req, res) => {
      try {
        const tutorials = await Tutorial.find({}).sort({ order: 1, createdAt: -1 }).lean();
        res.json(tutorials);
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.post("/tutorials", async (req, res) => {
      try {
        const { title, youtubeUrl, order } = req.body || {};
        if (!title || !youtubeUrl) { res.status(400).json({ error: "Title and YouTube URL are required" }); return; }
        const tutorial = await Tutorial.create({ title, youtubeUrl, order: order ?? 0 });
        res.json({ ok: true, tutorial });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.delete("/tutorials/:id", async (req, res) => {
      try {
        await Tutorial.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    router.get("/bot-templates", async (_req, res) => {
      try {
        const templates = await BotTemplate.find({}).sort({ order: 1, createdAt: -1 }).lean();
        const deployCountMap: Record<string, number> = {};
        const counts = await Bot.aggregate([
          { $match: { templateId: { $exists: true, $ne: "" }, status: { $ne: "deleted" } } },
          { $group: { _id: "$templateId", count: { $sum: 1 } } }
        ]);
        for (const c of counts) { deployCountMap[c._id] = c.count; }
        res.json(templates.map(t => ({ ...t, deployCount: deployCountMap[(t as unknown as { _id: { toString(): string } })._id.toString()] || 0 })));
      } catch { res.status(500).json({ error: "Server error" }); }
    });

    export default router;
  