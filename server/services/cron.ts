import cron from "node-cron";
  import { Bot } from "../models/Bot.js";
  import { User } from "../models/User.js";
  import { Transaction } from "../models/Transaction.js";
  import { TrialCheck } from "../models/TrialCheck.js";
  import { deleteApp, getAppStatus, enableMaintenanceMode, disableMaintenanceMode, setConfigVar, appExists } from "./heroku.js";

  export function startCronJobs(): void {
    cron.schedule("0 * * * *", async () => {
      try {
        const now = new Date();

        const expiredTrials = await Bot.find({
          isTrial: true,
          expiresAt: { $lte: now },
          status: { $nin: ["deleted"] }
        });
        for (const bot of expiredTrials) {
          try { await deleteApp(bot.herokuAppName); } catch {}
          bot.status = "deleted";
          await bot.save();
          await TrialCheck.findOneAndUpdate({ phoneNumber: bot.phoneNumber }, { status: "trial_ended" });
        }

        const justExpired = await Bot.find({
          isTrial: false,
          expiresAt: { $lte: now },
          status: { $in: ["running", "stopped", "building"] },
          gracePeriodEnd: null
        });
        for (const bot of justExpired) {
          try {
            await setConfigVar(bot.herokuAppName, "EXPIRY_NOTICE", "1");
            await new Promise(r => setTimeout(r, 8000));
            await enableMaintenanceMode(bot.herokuAppName);
          } catch {}
          bot.status = "expired";
          bot.gracePeriodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          await bot.save();
        }

        const pastGrace = await Bot.find({
          isTrial: false,
          gracePeriodEnd: { $lte: now },
          status: "expired"
        });
        for (const bot of pastGrace) {
          try { await deleteApp(bot.herokuAppName); } catch {}
          bot.status = "deleted";
          bot.gracePeriodEnd = null;
          await bot.save();
        }

        const staleCutoff = new Date(now.getTime() - 60 * 60 * 1000);
        await Transaction.updateMany(
          { status: "pending", createdAt: { $lt: staleCutoff } },
          { $set: { status: "failed" } }
        );

        const bannedCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const expiredBanned = await User.find({ isBanned: true, bannedAt: { $lte: bannedCutoff, $ne: null } });
        for (const u of expiredBanned) {
          const userBots = await Bot.find({ userId: u._id, status: { $ne: "deleted" } });
          for (const b of userBots) {
            try { await deleteApp(b.herokuAppName); } catch {}
            b.status = "deleted";
            await b.save();
          }
          await User.findByIdAndDelete(u._id);
        }
      } catch {}
    });

    cron.schedule("*/15 * * * *", async () => {
      try {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000);
        const stuckBots = await Bot.find({ status: "building", deployedAt: { $lt: cutoff } });
        for (const bot of stuckBots) {
          try {
            const exists = await appExists(bot.herokuAppName);
            await Bot.findByIdAndUpdate(bot._id, { status: exists ? "running" : "stopped" });
          } catch {}
        }
      } catch {}
    });

    cron.schedule("*/10 * * * *", async () => {
      try {
        const activeBots = await Bot.find({ status: { $in: ["running", "stopped"] }, isTrial: false });
        for (const bot of activeBots) {
          const status = await getAppStatus(bot.herokuAppName);
          if (status === "stopped" && bot.status === "running") {
            bot.status = "stopped";
            await bot.save();
          } else if (status === "running" && bot.status === "stopped") {
            bot.status = "running";
            await bot.save();
          }
        }
      } catch {}
    });
  }
