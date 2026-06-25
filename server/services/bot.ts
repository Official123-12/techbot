import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { registerNotifier } from "./notify.js";
import { logger } from "../logger.js";
import { Bot } from "../models/Bot.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { Panel } from "../models/Panel.js";
import { PanelPlan } from "../models/PanelPlan.js";
import mongoose from "mongoose";
import {
  findPanelUser,
  createPanelUser,
  updatePanelUserPassword,
  promoteToAdmin,
  getFreeAllocation,
  createPanelServer,
} from "./pterodactyl.js";
import { chargeMobileMoney, verifyTransaction, toPaystackPhone } from "./paystack.js";

const OWNER_ID = Number(process.env.BOT_OWNER_ID || "8282579769");
const SUPPORT = "@xhclintonxd";
const PANEL_DOMAIN = process.env.PANEL_DOMAIN || "https://panel.toxicx.tech";
const PANEL_EMAIL_DOMAIN = process.env.PANEL_EMAIL_DOMAIN || "panel.toxicx.tech";
const KSH_PER_TX = Number(process.env.KSH_PER_TX || "10");
const SITE_URL = process.env.SITE_URL || "https://toxichosting.tech";
const BOT_PANEL_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const PHONE_RE = /^(\+?254|0)[17]\d{8}$/;

interface Session {
  step: "plan" | "method" | "username" | "phone" | "polling";
  planId?: string;
  planName?: string;
  planTxCost?: number;
  planKsh?: number;
  isAdminUpgrade?: boolean;
  paymentProvider?: "mpesa" | "airtel";
  username?: string;
  lastMenuMsgId?: number;
}

const sessions = new Map<number, Session>();

function isOwner(ctx: Context): boolean {
  return OWNER_ID > 0 && ctx.from?.id === OWNER_ID;
}

function parseMb(s: string): number {
  const n = parseFloat(s);
  if (isNaN(n)) return 512;
  return /gb/i.test(s) ? Math.round(n * 1024) : Math.round(n);
}

function parseCpu(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 100 : Math.round(n);
}

function getDisplayName(ctx: Context): string {
  const username = ctx.from?.username;
  if (username) return `@${username}`;
  const firstName = ctx.from?.first_name;
  if (firstName) return firstName;
  return "there";
}

function userMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🛒 Buy Panel", "buy_panel")],
    [Markup.button.url("🏠 Open Shop", SITE_URL)],
    [Markup.button.url("💬 Support", `https://t.me/${SUPPORT.replace("@", "")}`)],
  ]);
}

function adminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("🛒 Buy Panel", "buy_panel"), Markup.button.callback("📊 Stats", "stats")],
    [Markup.button.callback("🛠️ Admin Commands", "admin_cmds"), Markup.button.callback("⚡ Create Panel (Free)", "create_panel_free")],
    [Markup.button.url("🏠 Open Shop", SITE_URL)],
    [Markup.button.url("💬 Support", `https://t.me/${SUPPORT.replace("@", "")}`)],
  ]);
}

function welcomeBox(ctx: Context, extra?: string): string {
  const name = getDisplayName(ctx);
  const extraLine = extra ? `│ ${extra}\n` : "";
  return (
    `╭─❏ 「Toxic-Hosting-Bot」\n` +
    `│\n` +
    `│ 👋 Hello ${name}\n` +
    `│ Welcome to Toxic Host — buy a\n` +
    `│ Pterodactyl panel, check stats,\n` +
    `│ or visit the shop.\n` +
    `${extraLine}` +
    `│\n` +
    `╰───────────────`
  );
}

function box(title: string, lines: string[]): string {
  const body = lines.map(l => `│ ${l}`).join("\n");
  return `╭─❏ 「${title}」\n${body}\n╰───────────────`;
}

  async function replaceMenu(ctx: Context, text: string, extra?: Parameters<typeof ctx.reply>[1]) {
    const userId = ctx.from?.id;
    const session = userId !== undefined ? sessions.get(userId) : undefined;
    const cbMsgId = (ctx as unknown as { callbackQuery?: { message?: { message_id?: number } } }).callbackQuery?.message?.message_id;
    if (cbMsgId) {
      try { await ctx.deleteMessage(cbMsgId); } catch {}
      if (session?.lastMenuMsgId && session.lastMenuMsgId !== cbMsgId) {
        try { await ctx.telegram.deleteMessage(ctx.chat!.id, session.lastMenuMsgId); } catch {}
      }
    } else if (session?.lastMenuMsgId) {
      try { await ctx.telegram.deleteMessage(ctx.chat!.id, session.lastMenuMsgId); } catch {}
    }
    const sent = await ctx.reply(text, extra);
    if (session) session.lastMenuMsgId = sent.message_id;
    return sent;
  }

  
async function sendPlanList(ctx: Context) {
  try {
    const plans = await PanelPlan.find({ active: true }).sort({ order: 1 }).lean();
    const buttons = plans.map(p => [
      Markup.button.callback(
        `${p.name} — ${p.txCost * KSH_PER_TX} KSH`,
        `plan_${(p._id as mongoose.Types.ObjectId).toString()}`
      ),
    ]);
    buttons.push([Markup.button.callback("👑 Admin Panel Access — 200 KSH", "plan_admin_access")]);
    buttons.push([Markup.button.callback("◀ Back", "main_menu")]);
    const planLines: string[] = [];
    plans.forEach(p => {
      planLines.push(`🔹 *${p.name}*`);
      if (p.ram) planLines.push(`   RAM: ${p.ram}  Disk: ${p.disk}  CPU: ${p.cpu}`);
      planLines.push(`   Price: *${p.txCost * KSH_PER_TX} KSH*`);
      planLines.push("");
    });
    planLines.push(`👑 *Admin Panel Access*`);
    planLines.push(`   Pterodactyl admin account`);
    planLines.push(`   Price: *200 KSH*`);
    const msg = `╭─❏ 「🛒 Available Plans」\n${planLines.map(l => l ? `│ ${l}` : "│").join("\n")}\n╰───────────────`;
    const sentPlan = await ctx.reply(msg.trim(), { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) });
    const planUserId = ctx.from?.id;
    if (planUserId !== undefined) { const s = sessions.get(planUserId); if (s) s.lastMenuMsgId = sentPlan.message_id; }
  } catch {
    const menu = isOwner(ctx) ? adminMenu() : userMenu();
    await ctx.reply(
      box("Error", ["❌ Failed to load plans.", "Try again later."]),
      menu
    );
  }
}

async function provision(planId: string, desiredUsername: string) {
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const base = desiredUsername.slice(0, 12);
  const panelUsername = `${base}${suffix}`;
  const panelPassword = `${base}@${Math.floor(1000 + Math.random() * 9000)}`;
  const panelEmail = `${panelUsername}@${PANEL_EMAIL_DOMAIN}`;
  const panelLoginUrl = `${PANEL_DOMAIN}/auth/login`;

  if (planId === "admin_access") {
    if (process.env.PANEL_API_KEY) {
      let pu = await findPanelUser(panelUsername);
      if (!pu) {
        pu = await createPanelUser(panelUsername, panelEmail, panelPassword);
      } else {
        await updatePanelUserPassword(pu.id, panelUsername, panelEmail, panelPassword);
      }
      await promoteToAdmin(pu.id, panelUsername, panelEmail);
    }
    await Panel.create({
      userId: BOT_PANEL_USER_ID,
      planName: "Admin Panel Access",
      panelUsername,
      panelPassword,
      panelLoginUrl,
      txCost: 0,
    });
    return { panelUsername, panelPassword, panelLoginUrl, planName: "Admin Panel Access", txCost: 0 };
  }

  const plan = await PanelPlan.findById(planId);
  if (!plan || !plan.active) throw new Error("Plan not found or inactive");
  if (process.env.PANEL_API_KEY) {
    let pu = await findPanelUser(panelUsername);
    if (!pu) {
      pu = await createPanelUser(panelUsername, panelEmail, panelPassword);
    } else {
      await updatePanelUserPassword(pu.id, panelUsername, panelEmail, panelPassword);
    }
    if (plan.isAdminUpgrade) {
      await promoteToAdmin(pu.id, panelUsername, panelEmail);
    } else {
      const allocationId = await getFreeAllocation();
      await createPanelServer({
        name: `${panelUsername.toUpperCase()}'S SERVER`,
        panelUserId: pu.id,
        memoryMb: parseMb(plan.ram),
        diskMb: parseMb(plan.disk),
        cpu: parseCpu(plan.cpu),
        allocationId,
      });
    }
  }
  await Panel.create({
    userId: BOT_PANEL_USER_ID,
    planName: plan.name,
    panelUsername,
    panelPassword,
    panelLoginUrl,
    txCost: plan.txCost,
  });
  return { panelUsername, panelPassword, panelLoginUrl, planName: plan.name, txCost: plan.txCost };
}

function credMsg(r: { planName: string; panelUsername: string; panelPassword: string; panelLoginUrl: string }) {
  return (
    `╭─❏ 「✅ Panel Ready — ${r.planName}」\n` +
    `│\n` +
    `│ ⚠️ *Save these NOW — won't be shown again.*\n` +
    `│\n` +
    `│ 🌐 Panel URL:\n│   ${r.panelLoginUrl}\n` +
    `│ 👤 Username: \`${r.panelUsername}\`\n` +
    `│ 🔑 Password: \`${r.panelPassword}\`\n` +
    `│ 📧 Email: \`${r.panelUsername}@${PANEL_EMAIL_DOMAIN}\`\n` +
    `│\n` +
    `╰───────────────`
  );
}

function methodButtons() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📱 M-Pesa", "method_mpesa"),
      Markup.button.callback("📲 Airtel Money", "method_airtel"),
    ],
    [Markup.button.callback("◀ Back", "buy_panel")],
  ]);
}

export function startBot(): void {
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    logger.info("BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  if (!OWNER_ID) {
    logger.warn("BOT_OWNER_ID not set — admin menu will not be available to anyone");
  }

  const bot = new Telegraf(botToken);

  registerNotifier(async (msg: string) => {
    if (!OWNER_ID) return;
    await bot.telegram.sendMessage(OWNER_ID, msg, { parse_mode: "Markdown" });
  });

  bot.start(async (ctx) => {
    sessions.delete(ctx.from.id);
    if (isOwner(ctx)) {
      await ctx.reply(
        welcomeBox(ctx, "🛠️ ADMIN MODE — extra commands unlocked"),
        { parse_mode: "Markdown", ...adminMenu() }
      );
      await ctx.reply("👑 *Admin Access*", { parse_mode: "Markdown" });
    } else {
      await ctx.reply(
        welcomeBox(ctx),
        { parse_mode: "Markdown", ...userMenu() }
      );
    }
  });

  bot.command("menu", async (ctx) => {
    sessions.delete(ctx.from.id);
    if (isOwner(ctx)) {
      await ctx.reply(
        welcomeBox(ctx, "🛠️ ADMIN MODE — extra commands unlocked"),
        { parse_mode: "Markdown", ...adminMenu() }
      );
      await ctx.reply("👑 *Admin Access*", { parse_mode: "Markdown" });
    } else {
      await ctx.reply(
        welcomeBox(ctx),
        { parse_mode: "Markdown", ...userMenu() }
      );
    }
  });

  bot.command("cancel", async (ctx) => {
    sessions.delete(ctx.from.id);
    const menu = isOwner(ctx) ? adminMenu() : userMenu();
    await ctx.reply(
      box("Cancelled", ["🚫 Order cancelled."]),
      { parse_mode: "Markdown", ...menu }
    );
  });

  bot.command("help", async (ctx) => {
    if (isOwner(ctx)) {
      await ctx.reply(
        box("Commands", [
          "📋 User Commands:",
          "/start — Welcome message",
          "/menu — Main menu",
          "/cancel — Cancel current order",
          "/help — This message",
          "",
          "🛠️ Admin Commands:",
          "/admin — Admin commands list",
          "/stats — Platform statistics",
          "/plans — List plans with IDs",
          "/createpanel — Free provisioning",
        ]),
        { parse_mode: "Markdown" }
      );
    } else {
      await ctx.reply(
        box("Commands", [
          "📋 Available Commands:",
          "/start — Welcome message",
          "/menu — Main menu",
          "/cancel — Cancel current order",
          "/help — This message",
        ]),
        { parse_mode: "Markdown" }
      );
    }
  });

  bot.command("admin", async (ctx) => {
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    await ctx.reply(
      box("Admin Commands", [
        "🛠️ /stats — Platform stats",
        "📋 /plans — List all plans with IDs",
        "⚡ /createpanel — Free panel provisioning",
        "📱 /menu — Main menu",
        "❓ /help — Full command list",
      ]),
      { parse_mode: "Markdown" }
    );
  });

  bot.command("plans", async (ctx) => {
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    try {
      const plans = await PanelPlan.find({ active: true }).sort({ order: 1 }).lean();
      if (plans.length === 0) { await ctx.reply(box("Plans", ["😔 No active plans."])); return; }
      const lines: string[] = [];
      plans.forEach(p => {
        lines.push(`🔹 *${p.name}*`);
        lines.push(`   ID: \`${(p._id as mongoose.Types.ObjectId).toString()}\``);
        lines.push(`   Price: ${p.txCost * KSH_PER_TX} KSH (${p.txCost} TX)`);
        lines.push(`   RAM: ${p.ram}  Disk: ${p.disk}  CPU: ${p.cpu}`);
        lines.push(`   Admin upgrade: ${p.isAdminUpgrade ? "Yes" : "No"}`);
        lines.push("");
      });
      lines.push(`👑 *Admin Panel Access*`);
      lines.push(`   Price: 200 KSH (flat)`);
      lines.push(`   Callback: plan_admin_access`);
      await ctx.reply(
        `╭─❏ 「📋 Panel Plans」\n${lines.map(l => l ? `│ ${l}` : "│").join("\n")}\n╰───────────────`,
        { parse_mode: "Markdown" }
      );
    } catch {
      await ctx.reply(box("Error", ["❌ Failed to fetch plans."]));
    }
  });

  bot.command("createpanel", async (ctx) => {
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    sessions.set(ctx.from.id, { step: "plan" });
    await sendPlanList(ctx);
  });

  const statsData = async () => {
    const [totalUsers, activeBots, totalBots, totalPanels, recentTx] = await Promise.all([
      User.countDocuments(),
      Bot.countDocuments({ status: "running" }),
      Bot.countDocuments({ status: { $ne: "deleted" } }),
      Panel.countDocuments(),
      Transaction.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: "success",
        type: "topup",
      }),
    ]);
    return (
      `╭─❏ 「📊 Toxic Host Stats」\n` +
      `│\n` +
      `│ 👥 Users: ${totalUsers}\n` +
      `│ 🤖 Active Bots: ${activeBots}\n` +
      `│ 📦 Total Bots: ${totalBots}\n` +
      `│ 🖥️ Panels: ${totalPanels}\n` +
      `│ 💰 Payments (24h): ${recentTx}\n` +
      `│\n` +
      `╰───────────────`
    );
  };

  bot.command("stats", async (ctx) => {
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    try { await ctx.reply(await statsData(), { parse_mode: "Markdown" }); }
    catch { await ctx.reply(box("Error", ["❌ Failed to fetch stats."])); }
  });

  bot.action("stats", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    try { await ctx.editMessageText(await statsData(), { parse_mode: "Markdown", ...adminMenu() }); }
    catch { await ctx.editMessageText(box("Error", ["❌ Failed to fetch stats."]), adminMenu()); }
  });

  bot.action("admin_cmds", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    try { await ctx.deleteMessage(); } catch {}
    await ctx.reply(
      box("Admin Commands", [
        "🛠️ /stats — Platform stats",
        "📋 /plans — List all plans with IDs",
        "⚡ /createpanel — Free panel provisioning",
        "📱 /menu — Main menu",
        "❓ /help — Full command list",
      ]),
      { parse_mode: "Markdown", ...adminMenu() }
    );
  });

  bot.action("create_panel_free", async (ctx) => {
    await ctx.answerCbQuery();
    if (!isOwner(ctx)) {
      await ctx.reply(box("Unauthorized", ["🚫 Access denied."]));
      return;
    }
    try { await ctx.deleteMessage(); } catch {}
    sessions.set(ctx.from!.id, { step: "plan" });
    await sendPlanList(ctx);
  });

  bot.action("main_menu", async (ctx) => {
    await ctx.answerCbQuery();
    sessions.delete(ctx.from!.id);
    if (isOwner(ctx)) {
      await ctx.editMessageText(
        welcomeBox(ctx, "🛠️ ADMIN MODE — extra commands unlocked"),
        { parse_mode: "Markdown", ...adminMenu() }
      );
    } else {
      await ctx.editMessageText(
        welcomeBox(ctx),
        { parse_mode: "Markdown", ...userMenu() }
      );
    }
  });

  bot.action("buy_panel", async (ctx) => {
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch {}
    sessions.set(ctx.from!.id, { step: "plan" });
    await sendPlanList(ctx);
  });

  bot.action("plan_admin_access", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from!.id;
    sessions.set(userId, {
      step: isOwner(ctx) ? "username" : "method",
      planId: "admin_access",
      planName: "Admin Panel Access",
      planTxCost: 0,
      planKsh: 200,
      isAdminUpgrade: true,
    });
    if (isOwner(ctx)) {
      await ctx.reply(
        box("👑 Admin Panel Access — Free", [
          "📝 Enter the desired panel username:",
          "",
          "3–20 characters, lowercase letters,",
          "numbers and underscores only.",
          "",
          "Type /cancel to abort.",
        ]),
        { parse_mode: "Markdown" }
      );
      return;
    }
    await replaceMenu(
      ctx,
      box("👑 Admin Panel Access — 200 KSH", [
        "💳 Choose your payment method:",
      ]),
      { parse_mode: "Markdown", ...methodButtons() }
    );
  });

  bot.action(/^plan_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from!.id;
    const planId = (ctx.match as RegExpMatchArray)[1];
    try {
      const plan = await PanelPlan.findById(planId);
      if (!plan || !plan.active) {
        const menu = isOwner(ctx) ? adminMenu() : userMenu();
        await ctx.reply(box("Error", ["❌ Plan not available."]), menu);
        sessions.delete(userId);
        return;
      }
      const session: Session = {
        step: isOwner(ctx) ? "username" : "method",
        planId: (plan._id as mongoose.Types.ObjectId).toString(),
        planName: plan.name,
        planTxCost: plan.txCost,
        planKsh: plan.txCost * KSH_PER_TX,
        isAdminUpgrade: plan.isAdminUpgrade,
      };
      sessions.set(userId, session);
      if (isOwner(ctx)) {
        await ctx.reply(
          box(`🔹 ${plan.name} Selected`, [
            "📝 Enter your desired panel username:",
            "",
            "3–20 characters, lowercase letters,",
            "numbers and underscores only.",
            "",
            "Type /cancel to abort.",
          ]),
          { parse_mode: "Markdown" }
        );
        return;
      }
      await replaceMenu(
        ctx,
        box(`🏷️ ${plan.name} — ${plan.txCost * KSH_PER_TX} KSH`, [
          "💳 Choose your payment method:",
        ]),
        { parse_mode: "Markdown", ...methodButtons() }
      );
    } catch {
      const menu = isOwner(ctx) ? adminMenu() : userMenu();
      await ctx.reply(box("Error", ["❌ Failed to load plan."]), menu);
      sessions.delete(userId);
    }
  });

  bot.action("method_mpesa", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from!.id;
    const session = sessions.get(userId);
    if (!session || session.step !== "method") {
      await ctx.reply(box("Error", ["❌ Session expired.", "Use /menu to start again."]));
      return;
    }
    session.paymentProvider = "mpesa";
    session.step = "username";
    sessions.set(userId, session);
    await replaceMenu(
      ctx,
      box("📱 M-Pesa Selected", [
        "📝 Enter your desired panel username:",
        "",
        "3–20 characters, lowercase letters,",
        "numbers and underscores only.",
        "",
        "Type /cancel to abort.",
      ]),
      { parse_mode: "Markdown" }
    );
  });

  bot.action("method_airtel", async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.from!.id;
    const session = sessions.get(userId);
    if (!session || session.step !== "method") {
      await ctx.reply(box("Error", ["❌ Session expired.", "Use /menu to start again."]));
      return;
    }
    session.paymentProvider = "airtel";
    session.step = "username";
    sessions.set(userId, session);
    await replaceMenu(
      ctx,
      box("📲 Airtel Money Selected", [
        "📝 Enter your desired panel username:",
        "",
        "3–20 characters, lowercase letters,",
        "numbers and underscores only.",
        "",
        "Type /cancel to abort.",
      ]),
      { parse_mode: "Markdown" }
    );
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    const session = sessions.get(userId);
    if (!session) {
      const menu = isOwner(ctx) ? adminMenu() : userMenu();
      await ctx.reply(welcomeBox(ctx), { parse_mode: "Markdown", ...menu });
      return;
    }

    if (session.step === "username") {
      const clean = text.toLowerCase().replace(/[^a-z0-9_]/g, "");
      if (!USERNAME_RE.test(clean)) {
        await ctx.reply(
          box("Invalid Username", [
            "❌ Username must be 3–20 characters:",
            "lowercase letters, numbers, underscores.",
            "",
            "Try again:",
          ])
        );
        return;
      }
      session.username = clean;
      if (isOwner(ctx)) {
        await ctx.reply(box("Provisioning", ["⏳ Provisioning your panel...", "Please wait."]), { parse_mode: "Markdown" });
        try {
          const result = await provision(session.planId!, clean);
          sessions.delete(userId);
          await ctx.reply(credMsg(result), { parse_mode: "Markdown" });
          await ctx.reply(
            box("Done!", ["✅ Panel provisioned successfully.", "Use /menu for the main menu."]),
            adminMenu()
          );
        } catch (err) {
          sessions.delete(userId);
          await ctx.reply(
            box("Provisioning Failed", [
              `❌ ${err instanceof Error ? err.message : "Unknown error"}`,
              "",
              "Use /menu to try again.",
            ]),
            adminMenu()
          );
        }
        return;
      }
      session.step = "phone";
      const providerLabel = session.paymentProvider === "airtel" ? "Airtel Money" : "M-Pesa";
      await replaceMenu(
        ctx,
        box(`📱 Enter Phone Number`, [
          `💰 Pay *${session.planKsh} KSH* via *${providerLabel}*:`,
          "",
          "Format: 07XXXXXXXX or 254XXXXXXXXX",
          "",
          "Type /cancel to abort.",
        ]),
        { parse_mode: "Markdown" }
      );
      return;
    }

    if (session.step === "phone") {
      const phone = text.replace(/\s/g, "");
      if (!PHONE_RE.test(phone)) {
        await ctx.reply(
          box("Invalid Phone", [
            "❌ Invalid phone number.",
            "Use format: 07XXXXXXXX or 254XXXXXXXXX",
            "",
            "Try again:",
          ])
        );
        return;
      }
      const reference = `BOT_${Date.now()}_${userId}`;
      const planId = session.planId!;
      const username = session.username!;
      const ksh = session.planKsh!;
      const txCost = session.planTxCost!;
      const provider = session.paymentProvider === "airtel" ? "atl" : "mpesa";
      const providerLabel = session.paymentProvider === "airtel" ? "Airtel Money" : "M-Pesa";
      sessions.delete(userId);

      await ctx.reply(
        box(`📱 ${providerLabel} Prompt Sent`, [
          `Sending prompt to *${phone}*`,
          `for *${ksh} KSH*...`,
          "",
          "Check your phone and enter",
          `your ${providerLabel} PIN.`,
        ]),
        { parse_mode: "Markdown" }
      );
      try {
        await chargeMobileMoney({
          email: `tgbot_${userId}@toxichost.app`,
          amountKes: ksh * 100,
          phone: toPaystackPhone(phone),
          provider,
          reference,
        });
      } catch (err) {
        await ctx.reply(
          box("Charge Failed", [
            `❌ ${err instanceof Error ? err.message : "Charge failed"}`,
            "",
            "Use /menu to try again.",
          ])
        );
        return;
      }

      await ctx.reply(
        box("⏳ Awaiting Payment", [
          "Waiting for payment confirmation...",
          "(up to 60 seconds)",
        ])
      );

      let paid = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          const result = await verifyTransaction(reference);
          if (result.success) { paid = true; break; }
        } catch {}
      }

      if (!paid) {
        await bot.telegram.sendMessage(
          userId,
          box("Timed Out", [
            "⏰ Payment timed out or not confirmed.",
            "Use /menu to try again.",
          ])
        );
        return;
      }

      await bot.telegram.sendMessage(
        userId,
        box("Payment Received", ["✅ Payment confirmed!", "Provisioning your panel..."])
      );
      try {
        const result = await provision(planId, username);
        await Transaction.create({
          userId: BOT_PANEL_USER_ID,
          type: "panel",
          txAmount: txCost,
          ksAmount: ksh,
          paystackRef: reference,
          status: "success",
        });
        await bot.telegram.sendMessage(userId, credMsg(result), { parse_mode: "Markdown" });
        await bot.telegram.sendMessage(
          userId,
          box("🎉 All Done!", ["✅ Your panel is ready!", "Use /menu for the main menu."])
        );
      } catch (err) {
        await bot.telegram.sendMessage(
          userId,
          box("Provisioning Failed", [
            "✅ Payment received but provisioning failed:",
            `❌ ${err instanceof Error ? err.message : "Unknown error"}`,
            "",
            `Contact support: ${SUPPORT}`,
          ])
        );
      }
      return;
    }
  });

  bot.launch().catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Telegram bot launch error: ${msg}`);
  });
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  logger.info("Telegram bot started");
}
