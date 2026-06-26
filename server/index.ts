import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import authRouter from "./routes/auth.js";
import botRouter from "./routes/bots.js";
import paymentsRouter, { paystackWebhookHandler } from "./routes/payments.js";
import panelsRouter from "./routes/panels.js";
import adminRouter from "./routes/admin.js";
import couponRouter from "./routes/coupons.js";
import botTemplatesRouter from "./routes/bot-templates.js";
import tutorialsRouter from "./routes/tutorials.js";
import { logger } from "./logger.js";
import { BotTemplate } from "./models/BotTemplate.js";
import { Bot } from "./models/Bot.js";
import { PanelPlan } from "./models/PanelPlan.js";
import { startBot } from "./services/bot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: FRONTEND_ORIGIN || true, credentials: true }));

// Webhook kwa TigerPay (badala ya Paystack)
app.post("/webhook", paystackWebhookHandler);

app.use("/api/auth", authRouter);
app.use("/api/bots", botRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/panels", panelsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/coupons", couponRouter);
app.use("/api/bot-templates", botTemplatesRouter);
app.use("/api/tutorials", tutorialsRouter);

const CRAWLER_RE = /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|discord|googlebot|bingbot|curl|wget|python-requests/i;

app.get(["/services/bots/:slug", "/services/bots/:slug/*"], async (req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (!CRAWLER_RE.test(ua)) { next(); return; }
  try {
    const template = await BotTemplate.findOne({ shareableSlug: req.params.slug, active: true }).lean();
    if (!template) { next(); return; }
    const name = (template as unknown as { name?: string }).name || "MDINYANE Bot";
    const imageUrl = (template as unknown as { imageUrl?: string }).imageUrl || "https://i.imgur.com/8kQmQKq.png";
    const host = req.get("host") || "hosting.stany.site";
    const url = `https://${host}/services/bots/${req.params.slug}`;
    const title = `${name} — Deploy on STANY Host`;
    const desc = `Deploy ${name} bot instantly on STANY Host. Fast, reliable WhatsApp bot hosting in Tanzania.`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <meta name="description" content="${desc}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${title}"/>
  <meta property="og:description" content="${desc}"/>
  <meta property="og:image" content="${imageUrl}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta property="og:url" content="${url}"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${title}"/>
  <meta name="twitter:description" content="${desc}"/>
  <meta name="twitter:image" content="${imageUrl}"/>
  </head><body><p>${title}</p><script>window.location.replace("${url}");</script></body></html>`);
  } catch { next(); }
});

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get(/.*/, (_req, res) => { res.sendFile(path.join(distPath, "index.html")); });

async function dropStaleIndexes() {
  const db = mongoose.connection.db;
  if (!db) return;
  try {
    const indexes = await db.collection("panels").indexes();
    if (indexes.some((idx: { name?: string }) => idx.name === "paystackRef_1")) {
      await db.collection("panels").dropIndex("paystackRef_1");
      logger.info("Dropped stale paystackRef_1 index from panels collection");
    }
  } catch (err) {
    logger.warn({ err }, "Could not check/drop paystackRef_1 index (safe to ignore)");
  }
}

async function seedDefaultTemplate() {
  try {
    const count = await BotTemplate.countDocuments({ isDefault: true });
    if (count > 0) return;
    await BotTemplate.create({
      name: "MDINYANE",
      githubRepo: "Stanytz378/mdinyane",
      sessionIdUrl: "https://hosting.stany.site/pairing",
      costTx: 0,
      isDefault: true,
      active: true,
      shareableSlug: "mdinyane"
    });
    logger.info("Seeded default MDINYANE bot template");
  } catch (err) {
    logger.error({ err }, "Failed to seed default template");
  }
}

async function seedPanelPlans() {
  try {
    const count = await PanelPlan.countDocuments();
    if (count > 0) return;
    await PanelPlan.insertMany([
      {
        name: "Mini 400MB",
        description: "400MB RAM · ~4GB Disk · 1 Allocation · 1 Database",
        txCost: 5000, // TSH
        originalTxCost: 8000,
        ram: "400 MB",
        disk: "~4 GB",
        cpu: "100%",
        isBestDeal: false,
        active: true,
        order: 0
      },
      {
        name: "Basic 800MB",
        description: "800MB RAM · ~8GB Disk · 2 Allocations · 2 Databases",
        txCost: 10000, // TSH
        originalTxCost: 16000,
        ram: "800 MB",
        disk: "~8 GB",
        cpu: "100%",
        isBestDeal: false,
        active: true,
        order: 1
      },
      {
        name: "Unlimited",
        description: "Unlimited RAM · Unlimited Disk · 100 Allocations · 10 Databases",
        txCost: 12000, // TSH
        originalTxCost: 20000,
        ram: "∞ Unlimited",
        disk: "∞ Unlimited",
        cpu: "100%",
        isBestDeal: true,
        active: true,
        order: 2
      }
    ]);
    logger.info("Seeded default panel plans with TSH pricing");
  } catch (err) {
    logger.error({ err }, "Failed to seed panel plans");
  }
}

async function deduplicatePanelPlans() {
  try {
    const plans = await PanelPlan.find({}).lean();
    const groups: Record<string, typeof plans> = {};
    for (const p of plans) {
      const key = ((p as unknown as { name?: string }).name || "").toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    let removed = 0;
    for (const group of Object.values(groups)) {
      if (group.length <= 1) continue;
      const activeOnes = group.filter(p => (p as unknown as { active?: boolean }).active);
      const keep = activeOnes.length === 1 ? activeOnes[0] : group.sort((a, b) => a._id.toString().localeCompare(b._id.toString()))[0];
      for (const p of group) {
        if (p._id.toString() !== keep._id.toString()) {
          await PanelPlan.findByIdAndDelete(p._id);
          removed++;
        }
      }
    }
    if (removed > 0) logger.info(`Removed ${removed} duplicate PanelPlan documents`);
  } catch (err) {
    logger.warn({ err }, "PanelPlan deduplication failed (safe to ignore)");
  }
}

async function cleanupOrphanedBots() {
  try {
    const bots = await Bot.find({}).lean();
    const { User: UserModel } = await import("./models/User.js");
    const userIds = [...new Set(bots.map(b => (b as unknown as { userId?: { toString(): string } }).userId?.toString()).filter(Boolean))] as string[];
    const existingUsers = await UserModel.find({ _id: { $in: userIds } }).select("_id").lean();
    const existingSet = new Set(existingUsers.map(u => u._id.toString()));
    const orphans = bots.filter(b => {
      const uid = (b as unknown as { userId?: { toString(): string } }).userId?.toString();
      return uid && !existingSet.has(uid);
    });
    if (orphans.length > 0) {
      await Bot.deleteMany({ _id: { $in: orphans.map(b => b._id) } });
      logger.info(`Removed ${orphans.length} orphaned bot documents`);
    }
  } catch (err) {
    logger.warn({ err }, "Orphaned bot cleanup failed (safe to ignore)");
  }
}

async function fixBotTemplateImages() {
  try {
    const result = await BotTemplate.updateMany(
      { $or: [{ imageUrl: { $exists: false } }, { imageUrl: "" }, { imageUrl: null }] },
      { $set: { imageUrl: "https://raw.githubusercontent.com/Stanytz378/mdinyane/main/assets/stany.png" } }
    );
    if (result.modifiedCount > 0) logger.info(`Fixed ${result.modifiedCount} bot template(s) with missing imageUrl`);
  } catch (err) {
    logger.warn({ err }, "Bot template image fix failed (safe to ignore)");
  }
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    logger.info("MongoDB connected");
    await dropStaleIndexes();
    await deduplicatePanelPlans();
    await cleanupOrphanedBots();
    await fixBotTemplateImages();
    await seedDefaultTemplate();
    await seedPanelPlans();
    app.listen(PORT, () => logger.info(`🚀 STANY Server running on port ${PORT}`));
    startBot();
  })
  .catch(err => {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  });