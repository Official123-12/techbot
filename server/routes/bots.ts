import { Router } from "express";
import { z } from "zod";
import { Bot } from "../models/Bot.js";
import { User } from "../models/User.js";
import { Team } from "../models/Team.js";
import { Transaction } from "../models/Transaction.js";
import { BlockedTrial } from "../models/BlockedTrial.js";
import { TrialCheck } from "../models/TrialCheck.js";
import { BotTemplate } from "../models/BotTemplate.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import {
    deployBotApp,
    deleteApp,
    restartApp,
    enableMaintenanceMode,
    disableMaintenanceMode,
    getAppLogs,
    findBestTeam,
    setConfigVar,
    getSetupStatus,
    appExists
  } from "../services/heroku.js";
import { notifyOwner } from "../services/notify.js";

  const router = Router();

  const deploySchema = z.object({
    phoneNumber: z.string().optional(),
    botName: z.string().optional(),
    sessionVar: z.string().min(1),
    isTrial: z.boolean().optional(),
    device: z.enum(["android", "ios"]).optional(),
    months: z.number().min(1).max(12).optional()
  });

  const deployTemplateSchema = z.object({
    botTemplateId: z.string().min(1),
    botName: z.string().min(5),
    sessionVar: z.string().min(1),
    device: z.enum(["android", "ios"]).optional(),
    months: z.number().min(1).max(12).optional(),
    extraVars: z.record(z.string(), z.string()).optional()
  });

  function cleanPhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, "");
  }

  function hasCountryCode(phone: string): boolean {
    const cleaned = cleanPhoneNumber(phone);
    return cleaned.length >= 10 && !cleaned.startsWith("0");
  }

  function normalizePhone(phone: string): string {
    const digits = cleanPhoneNumber(phone);
    if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
    return digits;
  }

  function redactEmails(line: string): string {
    return line.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "[email]");
  }

  function filterLogs(rawLogs: string): string[] {
    if (!rawLogs || rawLogs === "No logs available") return [];
    const lines = rawLogs.split("\n").filter(l => l.trim());
    const infraPatterns = [
      /heroku\[/i, /app\[api\]/i, /heroku\/runner/i, /heroku\/release/i,
      /heroku\/slug/i, /heroku\/build/i, /dyno/i, /at=info method=/i,
      /at=error/i, /fwd="/i, /host=/i, /request_id=/i, /protocol=http/i,
      /tls_version=/i, /connect=\d+ms/i, /service=\d+ms/i, /status=\d+ bytes=/i,
      /buildpack/i, /npm\s+(audit|fund|notice)/i, /Downloading/i, /Installing node/i,
      /Compressing/i, /Launching/i, /slug\s+size/i, /app\[scheduler\]/i,
      /source=\w+\sdyno=/i, /Procfile/i, /State changed/i, /Starting process/i,
      /Stopping all processes/i, /Error R\d+/i, /router\s+at=/i,
    ];
    const spamPatterns = [
      /session\s+saved/i, /keys\s+saved/i, /creds\s+saved/i,
      /credentials\s+saved/i, /store\s+state/i, /saving\s+session/i,
    ];
    const botPatterns = [
      /\[patch-baileys\]/i, /session/i, /Server running/i, /\[DB\]/i,
      /Connected/i, /Bot\s+started/i, /command/i, /message/i,
      /error/i, /warn/i, /info/i, /\[.*\]/, /\{.*\}/,
    ];
    return lines
      .filter(line => {
        if (infraPatterns.some(p => p.test(line))) return false;
        if (spamPatterns.some(p => p.test(line))) return false;
        return botPatterns.some(p => p.test(line));
      })
      .map(redactEmails)
      .slice(-100);
  }

  async function generateAppName(cleanPhone: string): Promise<string | null> {
    const existingBots = await Bot.find(
      { herokuAppName: { $regex: `-${cleanPhone}$` } },
      { herokuAppName: 1 }
    ).lean();
    const taken = new Set(existingBots.map(b => b.herokuAppName));
    const base = `txhost-${cleanPhone}`;
    if (!taken.has(base)) return base;
    const alphabet = "abcdefghijklmnopqrstuvwxyz";
    for (const a of alphabet) {
      const candidate = `txhost${a}-${cleanPhone}`;
      if (!taken.has(candidate)) return candidate;
    }
    for (const a of alphabet) {
      for (const b of alphabet) {
        const candidate = `txhost${a}${b}-${cleanPhone}`;
        if (!taken.has(candidate)) return candidate;
      }
    }
    return null;
  }

  router.get("/trial-check/:phone", async (req, res) => {
    try {
      const phone = cleanPhoneNumber(String(req.params.phone)).slice(0, 15);
      if (!phone || phone.length < 10) { res.json({ status: "not_found" }); return; }

      const appParam = req.query.app ? String(req.query.app).trim() : "";
        if (appParam) {
          const botByName = await Bot.findOne({ herokuAppName: appParam, isTrial: false, status: { $nin: ["deleted", "expired"] } });
          if (botByName) { res.json({ status: "paid" }); return; }
        }

        const paidBot = await Bot.findOne({ phoneNumber: phone, isTrial: false, status: { $nin: ["deleted", "expired"] } });
      if (paidBot) { res.json({ status: "paid" }); return; }

      const blocked = await BlockedTrial.findOne({ phoneNumber: phone });
      if (blocked) {
        const owner = await User.findOne({ email: blocked.email });
        if (owner) {
          const fraudBot = await Bot.findOne({ userId: owner._id, isTrial: true, status: { $nin: ["deleted", "expired"] }, expiresAt: { $gt: new Date() } });
          if (fraudBot) {
            (async () => { try { await deleteApp(fraudBot.herokuAppName); await Bot.findByIdAndUpdate(fraudBot._id, { status: "deleted" }); } catch {} })();
          }
        }
        res.json({ status: "trial_ended" }); return;
      }

      let trialBot = await Bot.findOne({ phoneNumber: phone, isTrial: true });

      if (trialBot) {
        const expired = new Date(trialBot.expiresAt) < new Date() || ["expired", "deleted"].includes(trialBot.status);
        if (!expired) { res.json({ status: "active_trial" }); return; }
        (async () => { try { await deleteApp(trialBot!.herokuAppName); await Bot.findByIdAndUpdate(trialBot!._id, { status: "deleted" }); } catch {} })();
        const owner = await User.findById(trialBot.userId);
        if (owner) {
          await BlockedTrial.findOneAndUpdate(
            { phoneNumber: phone },
            { phoneNumber: phone, email: owner.email },
            { upsert: true }
          );
        }
        res.json({ status: "trial_ended" }); return;
      }

      res.json({ status: "not_found" });
    } catch { res.json({ status: "not_found" }); }
  });

  router.use(authGuard);
  router.use(banCheck);

  router.get("/", async (req: AuthRequest, res) => {
    try {
      const bots = await Bot.find({ userId: req.user!._id, status: { $ne: "deleted" } }).sort({ deployedAt: -1 }).lean();
      res.json(bots);
      const now = new Date();
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      for (const b of bots) {
        if (b.isTrial) continue;
        if (["running","stopped","building"].includes(b.status) && new Date(b.expiresAt) < now && !b.gracePeriodEnd) {
          (async () => { try { await Bot.findByIdAndUpdate(b._id, { status: "expired", gracePeriodEnd: new Date(new Date(b.expiresAt).getTime() + TWO_DAYS) }); } catch {} })();
        } else if (b.status === "expired" && b.gracePeriodEnd && new Date(b.gracePeriodEnd) < now) {
          (async () => { try { await deleteApp(b.herokuAppName); await Bot.findByIdAndUpdate(b._id, { status: "deleted" }); } catch {} })();
        }
      }
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  router.post("/deploy", async (req: AuthRequest, res) => {
    try {
      const parsed = deploySchema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
      const { phoneNumber, botName, sessionVar, isTrial, device = "android", months = 1 } = parsed.data;
      const user = await User.findById(req.user!._id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }

      const teams = await Team.find({ active: true });
      const teamNames = teams.length > 0 ? teams.map(t => t.name) : ["toxicxtech254"];
      const bestTeam = await findBestTeam(teamNames);
      if (!bestTeam) { res.status(500).json({ error: "No available teams for deployment" }); return; }

      let appName: string;
      let cleanPhone = "";

      if (botName) {
        appName = botName;
        cleanPhone = `bot-${Date.now()}`;
      } else if (phoneNumber) {
        if (!hasCountryCode(phoneNumber)) {
          res.status(400).json({ error: "Phone number must include a country code (e.g., 254123456789)" });
          return;
        }
        cleanPhone = normalizePhone(phoneNumber);
        const generated = await generateAppName(cleanPhone);
        if (!generated) { res.status(500).json({ error: "Unable to generate app name, please try again" }); return; }
        appName = generated;
      } else {
        res.status(400).json({ error: "botName or phoneNumber required" });
        return;
      }

      if (isTrial) {
        const activeTrial = await Bot.findOne({
          userId: user._id,
          isTrial: true,
          status: { $nin: ["deleted", "expired"] },
          expiresAt: { $gt: new Date() }
        });
        if (activeTrial) { res.status(403).json({ error: "You already have an active free trial bot" }); return; }

        const deployed = await deployBotApp(appName, bestTeam, sessionVar, cleanPhone, true);
        if (!deployed.success) { res.status(500).json({ error: "Failed to deploy bot" }); return; }
        if (device === "ios") await setConfigVar(appName, "DEVICE", "ios");
        const deployedAt = new Date();
        const expiresAt = new Date(deployedAt.getTime() + 24 * 60 * 60 * 1000);
        const bot = await Bot.create({ userId: user._id, herokuAppName: appName, phoneNumber: cleanPhone, sessionVar, deployedAt, expiresAt, isTrial: true, status: "running", teamName: bestTeam });
        user.usedFreeTrial = true;
        user.bots.push(bot._id);
        await user.save();
        if (cleanPhone) await TrialCheck.findOneAndUpdate({ phoneNumber: cleanPhone }, { status: "trial_pending" }, { upsert: true });
        await Transaction.create({ userId: user._id, type: "deploy", txAmount: 0, ksAmount: 0, status: "success" });
        notifyOwner(`🤖 *Trial Bot Deployed*\n\nUser: \`${user.email}\`\nApp: \`${appName}\`\nPhone: \`${cleanPhone}\``).catch(() => {});
        res.json({ success: true, bot });
      } else {
        const cost = 10 * months;
        if (user.txCoins < cost) { res.status(403).json({ error: "Insufficient TX Coins", code: "INSUFFICIENT_COINS" }); return; }

        const deployed = await deployBotApp(appName, bestTeam, sessionVar, cleanPhone, false);
        if (!deployed.success) { res.status(500).json({ error: "Failed to deploy bot" }); return; }
        if (device === "ios") await setConfigVar(appName, "DEVICE", "ios");
        const deployedAt = new Date();
        const expiresAt = new Date(deployedAt.getTime() + months * 30 * 24 * 60 * 60 * 1000);
        const bot = await Bot.create({ userId: user._id, herokuAppName: appName, phoneNumber: cleanPhone, sessionVar, deployedAt, expiresAt, isTrial: false, status: "running", teamName: bestTeam });
        user.txCoins -= cost;
        user.bots.push(bot._id);
        await user.save();
        await Transaction.create({ userId: user._id, type: "deploy", txAmount: cost, ksAmount: cost * 3, status: "success" });

        if (cleanPhone && phoneNumber) {
          const oldTrialBots = await Bot.find({ userId: user._id, isTrial: true, phoneNumber: cleanPhone });
          for (const tb of oldTrialBots) {
            (async () => { try { await deleteApp(tb.herokuAppName); } catch {} })();
            await Bot.findByIdAndUpdate(tb._id, { status: "deleted" });
          }
          await BlockedTrial.deleteOne({ phoneNumber: cleanPhone });
        }

        notifyOwner(`🚀 *Paid Bot Deployed*\n\nUser: \`${user.email}\`\nApp: \`${appName}\`\nMonths: ${months}\nCost: ${cost} TX`).catch(() => {});
        res.json({ success: true, bot });
      }
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  router.get("/template-appvars/:templateId", authGuard, banCheck, async (req: AuthRequest, res) => {
    try {
      const template = await BotTemplate.findById(req.params.templateId).lean();
      if (!template) { res.json({ vars: [], sessionIdUrl: "" }); return; }
      const githubRepo = (template as unknown as { githubRepo?: string }).githubRepo;
      const sessionIdUrl = (template as unknown as { sessionIdUrl?: string }).sessionIdUrl || "";
      if (!githubRepo) { res.json({ vars: [], sessionIdUrl }); return; }
      const rawRepo = githubRepo.replace(/\.git$/, "").replace(/\/$/, "");
      const repoPath = rawRepo.replace("https://github.com/", "").replace("http://github.com/", "");
      const autoVars = new Set(["SESSION", "SESSION_ID", "SESSION_TOKEN", "SESSION_DATA", "CREDS", "AUTH_CREDS", "BOT_NAME", "HEROKU_APP_NAME", "HEROKU_API_KEY", "EXPIRY_NOTICE"]);
      const tryFetch = async (branch: string): Promise<{ vars: { key: string; description: string; required: boolean; value: string }[]; ok: boolean }> => {
        const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/app.json`;
        const r = await fetch(url).catch(() => null);
        if (!r || !r.ok) return { vars: [], ok: false };
        const appJson = await r.json().catch(() => null) as { env?: Record<string, { description?: string; required?: boolean; value?: string; generator?: string }> } | null;
        if (!appJson?.env) return { vars: [], ok: true };
        const vars = Object.entries(appJson.env)
          .filter(([k]) => !autoVars.has(k))
          .map(([k, v]) => ({ key: k, description: v.description || k, required: v.required !== false && !v.value && !v.generator, value: v.value || "" }));
        return { vars, ok: true };
      };
      let result = await tryFetch("HEAD");
      if (!result.ok) result = await tryFetch("main");
      if (!result.ok) result = await tryFetch("master");
      res.json({ vars: result.vars, sessionIdUrl });
    } catch { res.json({ vars: [], sessionIdUrl: "" }); }
  });

  router.post("/deploy-template", async (req: AuthRequest, res) => {
      try {
        const parsed = deployTemplateSchema.safeParse(req.body);
        if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
        const { botTemplateId, botName, sessionVar, device = "android", months = 1, extraVars } = parsed.data;
        const user = await User.findById(req.user!._id);
        if (!user) { res.status(404).json({ error: "User not found" }); return; }
        const template = await BotTemplate.findById(botTemplateId);
        if (!template) { res.status(404).json({ error: "Bot template not found" }); return; }
        const cost = (template.costTx ?? 10) * months;
        if (user.txCoins < cost) { res.status(403).json({ error: "Insufficient TX Coins", code: "INSUFFICIENT_COINS" }); return; }
        const teams = await Team.find({ active: true });
        const teamNames = teams.length > 0 ? teams.map(t => t.name) : ["toxicxtech254"];
        const bestTeam = await findBestTeam(teamNames);
        if (!bestTeam) { res.status(500).json({ error: "No available teams for deployment" }); return; }
        const deployedAt = new Date();
        const expiresAt = new Date(deployedAt.getTime() + months * 30 * 24 * 60 * 60 * 1000);
        const bot = await Bot.create({ userId: user._id, herokuAppName: botName, phoneNumber: "", sessionVar, deployedAt, expiresAt, isTrial: false, status: "building", teamName: bestTeam, templateId: botTemplateId, templateName: (template as unknown as { name: string }).name, sessionIdUrl: (template as unknown as { sessionIdUrl?: string }).sessionIdUrl || "" });
        user.txCoins -= cost;
        user.bots.push(bot._id);
        await user.save();
        await Transaction.create({ userId: user._id, type: "deploy", txAmount: cost, ksAmount: cost * 3, status: "success" });
        res.json({ success: true, bot });
        const templateIsDefault = (template as unknown as { isDefault?: boolean }).isDefault === true;
        (async () => {
          try {
            let deployed: { success: boolean; setupId?: string };
            if (!templateIsDefault && (template as unknown as { githubRepo?: string }).githubRepo) {
              const rawRepo = ((template as unknown as { githubRepo: string }).githubRepo).replace(/\.git$/, "");
              const tarballUrl = rawRepo + "/tarball/HEAD";
              const envOverrides: Record<string, string> = {
                ...(extraVars || {}),
                SESSION: sessionVar,
                BOT_NAME: botName,
                HEROKU_APP_NAME: botName,
                HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
              };
              deployed = await deployBotApp(botName, bestTeam, sessionVar, "", false, tarballUrl, envOverrides);
            } else {
              deployed = await deployBotApp(botName, bestTeam, sessionVar, "", false);
              if (deployed.success) {
                if (device === "ios") await setConfigVar(botName, "DEVICE", "ios").catch(() => {});
                if (extraVars) await Promise.all(Object.entries(extraVars).map(([k, v]) => setConfigVar(botName, k, v).catch(() => {})));
              }
            }
            if (deployed.success && deployed.setupId) {
              await Bot.findByIdAndUpdate(bot._id, { setupId: deployed.setupId });
              let attempts = 0;
              const poll = async (): Promise<void> => {
                if (attempts >= 24) {
                  const exists = await appExists(botName).catch(() => false);
                  await Bot.findByIdAndUpdate(bot._id, { status: exists ? "running" : "stopped" });
                  return;
                }
                attempts++;
                const { status } = await getSetupStatus(deployed.setupId!).catch(() => ({ status: "unknown" }));
                if (status === "succeeded") {
                  await Bot.findByIdAndUpdate(bot._id, { status: "running" });
                  notifyOwner(`🚀 *Template Bot Deployed*\n\nUser: \`${user.email}\`\nApp: \`${botName}\`\nTemplate: \`${(template as unknown as { name: string }).name}\`\nMonths: ${months}\nCost: ${cost} TX`).catch(() => {});
                } else if (status === "failed") {
                  await Bot.findByIdAndUpdate(bot._id, { status: "stopped" });
                  notifyOwner(`❌ *Template Deploy Failed*\n\nUser: \`${user.email}\`\nApp: \`${botName}\`\nTemplate: \`${(template as unknown as { name: string }).name}\``).catch(() => {});
                } else {
                  setTimeout(() => { poll().catch(() => {}); }, 15000);
                }
              };
              setTimeout(() => { poll().catch(() => {}); }, 15000);
            } else if (deployed.success) {
              await Bot.findByIdAndUpdate(bot._id, { status: "running" });
              notifyOwner(`🚀 *Template Bot Deployed*\n\nUser: \`${user.email}\`\nApp: \`${botName}\`\nTemplate: \`${(template as unknown as { name: string }).name}\`\nMonths: ${months}\nCost: ${cost} TX`).catch(() => {});
            } else {
              await Bot.findByIdAndUpdate(bot._id, { status: "stopped" });
            }
          } catch {}
        })();
      } catch {
        res.status(500).json({ error: "Server error" });
      }
    });

  router.post("/:id/stop", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      const success = await enableMaintenanceMode(bot.herokuAppName);
      if (success) { bot.status = "stopped"; await bot.save(); }
      res.json({ success, status: bot.status });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.post("/:id/start", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      const success = await disableMaintenanceMode(bot.herokuAppName);
      if (success) { bot.status = "running"; await bot.save(); }
      res.json({ success, status: bot.status });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.post("/:id/restart", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      const success = await restartApp(bot.herokuAppName);
      if (success) { bot.status = "running"; await bot.save(); }
      res.json({ success, status: bot.status });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.post("/:id/renew", async (req: AuthRequest, res) => {
    try {
      const schema = z.object({ months: z.number().min(1).max(12) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
      const { months } = parsed.data;
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      if (bot.status === "deleted") { res.status(400).json({ error: "Bot has been permanently deleted" }); return; }
      const user = await User.findById(req.user!._id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      const cost = 10 * months;
      if (user.txCoins < cost) { res.status(403).json({ error: "Insufficient TX Coins", code: "INSUFFICIENT_COINS" }); return; }
      const now = new Date();
      const base = bot.status === "expired" ? now : (bot.expiresAt > now ? bot.expiresAt : now);
      bot.expiresAt = new Date(base.getTime() + months * 30 * 24 * 60 * 60 * 1000);
      bot.gracePeriodEnd = null;
      if (bot.status === "expired") {
        try { await disableMaintenanceMode(bot.herokuAppName); } catch {}
        bot.status = "running";
      }
      await bot.save();
      user.txCoins -= cost;
      await user.save();
      await Transaction.create({ userId: user._id, type: "renew", txAmount: cost, ksAmount: cost * 3, status: "success" });
      res.json({ success: true, bot });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

    router.patch("/:id/vars", async (req: AuthRequest, res) => {
      try {
        const schema = z.object({
          session: z.string().min(1),
          device: z.enum(["android", "ios"]).optional(),
          extraVars: z.record(z.string(), z.string()).optional()
        });
        const parsed = schema.safeParse(req.body);
        if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
        const { session, device, extraVars } = parsed.data;
        const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
        if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
        bot.sessionVar = session;
        await bot.save();
        await setConfigVar(bot.herokuAppName, "SESSION", session).catch(() => {});
        if (device) await setConfigVar(bot.herokuAppName, "DEVICE", device).catch(() => {});
        if (extraVars) await Promise.all(Object.entries(extraVars).map(([k, v]) => setConfigVar(bot.herokuAppName, k, v).catch(() => {})));
        res.json({ success: true });
      } catch { res.status(500).json({ error: "Server error" }); }
    });

  router.post("/:id/delete", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      try { await deleteApp(bot.herokuAppName); } catch {}
      if (bot.isTrial) {
        await TrialCheck.findOneAndUpdate({ phoneNumber: bot.phoneNumber }, { status: "trial_ended" });
        const botOwner = await User.findById(bot.userId);
        if (botOwner) {
          await BlockedTrial.findOneAndUpdate(
            { phoneNumber: bot.phoneNumber },
            { phoneNumber: bot.phoneNumber, email: botOwner.email },
            { upsert: true }
          );
        }
      }
      await Bot.deleteOne({ _id: bot._id });
      await User.updateOne({ _id: req.user!._id }, { $pull: { bots: bot._id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.delete("/:id", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      try { await deleteApp(bot.herokuAppName); } catch {}
      if (bot.isTrial) {
        await TrialCheck.findOneAndUpdate({ phoneNumber: bot.phoneNumber }, { status: "trial_ended" });
        const botOwner = await User.findById(bot.userId);
        if (botOwner) {
          await BlockedTrial.findOneAndUpdate(
            { phoneNumber: bot.phoneNumber },
            { phoneNumber: bot.phoneNumber, email: botOwner.email },
            { upsert: true }
          );
        }
      }
      await Bot.deleteOne({ _id: bot._id });
      await User.updateOne({ _id: req.user!._id }, { $pull: { bots: bot._id } });
      res.json({ success: true });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.get("/:id/logs", async (req: AuthRequest, res) => {
    try {
      const bot = await Bot.findOne({ _id: req.params.id, userId: req.user!._id });
      if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
      const rawLogs = await getAppLogs(bot.herokuAppName);
      const logs = filterLogs(rawLogs);
      res.json({ logs });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

export default router;
