import { Router } from "express";
import { z } from "zod";
import { Panel } from "../models/Panel.js";
import { PanelPlan } from "../models/PanelPlan.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { notifyOwner } from "../services/notify.js";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { IUser } from "../models/User.js";
import {
  findPanelUser,
  createPanelUser,
  updatePanelUserPassword,
  promoteToAdmin,
  getFreeAllocation,
  createPanelServer,
} from "../services/pterodactyl.js";

const router = Router();
const ADMIN_EMAIL = "xhclinton@gmail.com";

interface AdminReq extends Request { user?: IUser; }

async function adminAuth(req: AdminReq, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { userId: string };
    const user = await User.findById(decoded.userId).lean();
    if (!user || user.email !== ADMIN_EMAIL) { res.status(403).json({ error: "Forbidden" }); return; }
    req.user = user as unknown as IUser;
    next();
  } catch { res.status(401).json({ error: "Invalid token" }); }
}

function parseMb(str: string): number {
  if (!str) return 512;
  const lower = str.toLowerCase().trim();
  if (lower === "unlimited" || lower === "0") return 0;
  const m = lower.match(/^(\d+)/);
  return m ? parseInt(m[1]) : 512;
}

function parseCpu(str: string): number {
  if (!str) return 100;
  const m = str.match(/^(\d+)/);
  return m ? parseInt(m[1]) : 100;
}

router.get("/plans", async (_req, res) => {
  try {
    const plans = await PanelPlan.find({ active: true }).sort({ order: 1 }).lean();
    res.json(plans);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/my", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const panels = await Panel.find({ userId: req.user!._id }).sort({ purchasedAt: -1 }).lean();
    res.json(panels);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/purchase", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ planId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

    const plan = await PanelPlan.findById(parsed.data.planId);
    if (!plan || !plan.active) { res.status(404).json({ error: "Plan not found" }); return; }

    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    if (user.txCoins < plan.txCost) {
      res.status(403).json({ error: "Insufficient TX Coins", code: "INSUFFICIENT_COINS" });
      return;
    }

    const suffix = Math.floor(1000 + Math.random() * 9000);
    const base = (user.username || user.email.split("@")[0]).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
    const panelUsername = `${base}${suffix}`;
    const pwSuffix = Math.floor(1000 + Math.random() * 9000);
    const panelPassword = `${base}@${pwSuffix}`;
    const panelDomain = process.env.PANEL_DOMAIN || "https://panel.toxicx.tech";
    const panelEmailDomain = process.env.PANEL_EMAIL_DOMAIN || "panel.toxicx.tech";
    const panelEmail = `${panelUsername}@${panelEmailDomain}`;
    const panelLoginUrl = `${panelDomain}/auth/login`;

    if (process.env.PANEL_API_KEY) {
      try {
        let panelUser = await findPanelUser(panelUsername);
        if (!panelUser) {
          panelUser = await createPanelUser(panelUsername, panelEmail, panelPassword);
        } else {
          await updatePanelUserPassword(panelUser.id, panelUsername, panelEmail, panelPassword);
        }
        const planDoc = plan as unknown as { isAdminUpgrade?: boolean };
        if (planDoc.isAdminUpgrade) {
          await promoteToAdmin(panelUser.id, panelUsername, panelEmail);
        } else {
          const allocationId = await getFreeAllocation();
          await createPanelServer({
            name: `${panelUsername.toUpperCase()}'S SERVER`,
            panelUserId: panelUser.id,
            memoryMb: parseMb(plan.ram),
            diskMb: parseMb(plan.disk),
            cpu: parseCpu(plan.cpu),
            allocationId,
          });
        }
      } catch (ptErr) {
        const msg = ptErr instanceof Error ? ptErr.message : "Panel provisioning failed";
        res.status(500).json({ error: msg });
        return;
      }
    }

    user.txCoins -= plan.txCost;
    await user.save();

    const panel = await Panel.create({
      userId: user._id,
      planName: plan.name,
      panelUsername,
      panelPassword,
      panelLoginUrl,
      txCost: plan.txCost,
    });

    await Transaction.create({
      userId: user._id,
      type: "panel",
      txAmount: plan.txCost,
      ksAmount: 0,
      status: "success",
    });

    notifyOwner(
      `Panel Purchased\n\nUser: ${user.email}\nPlan: ${plan.name}\nUsername: ${panelUsername}\nCost: ${plan.txCost} TX`
    ).catch(() => {});

    res.json({ success: true, panel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ error: msg });
  }
});

router.post("/purchase-admin", authGuard, banCheck, async (req: AuthRequest, res) => {
    const ADMIN_PANEL_COST = 40;
    try {
      const user = await User.findById(req.user!._id);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      if (user.txCoins < ADMIN_PANEL_COST) {
        res.status(403).json({ error: "Insufficient TX Coins", code: "INSUFFICIENT_COINS" });
        return;
      }
      const suffix = Math.floor(1000 + Math.random() * 9000);
      const base = (user.username || user.email.split("@")[0]).replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12);
      const panelUsername = `${base}${suffix}`;
      const pwSuffix = Math.floor(1000 + Math.random() * 9000);
      const panelPassword = `${base}@${pwSuffix}`;
      const panelDomain = process.env.PANEL_DOMAIN || "https://panel.toxicx.tech";
      const panelEmailDomain = process.env.PANEL_EMAIL_DOMAIN || "panel.toxicx.tech";
      const panelEmail = `${panelUsername}@${panelEmailDomain}`;
      const panelLoginUrl = `${panelDomain}/auth/login`;
      if (process.env.PANEL_API_KEY) {
        try {
          let panelUser = await findPanelUser(panelUsername);
          if (!panelUser) {
            panelUser = await createPanelUser(panelUsername, panelEmail, panelPassword);
          } else {
            await updatePanelUserPassword(panelUser.id, panelUsername, panelEmail, panelPassword);
          }
          await promoteToAdmin(panelUser.id, panelUsername, panelEmail);
        } catch (ptErr) {
          const msg = ptErr instanceof Error ? ptErr.message : "Panel provisioning failed";
          res.status(500).json({ error: msg });
          return;
        }
      }
      user.txCoins -= ADMIN_PANEL_COST;
      await user.save();
      const panel = await Panel.create({
        userId: user._id,
        planName: "Admin Panel Access",
        panelUsername,
        panelPassword,
        panelLoginUrl,
        txCost: ADMIN_PANEL_COST,
      });
      await Transaction.create({ userId: user._id, type: "panel", txAmount: ADMIN_PANEL_COST, ksAmount: 0, status: "success" });
      notifyOwner(`Admin Panel Purchased\n\nUser: ${user.email}\nUsername: ${panelUsername}\nCost: ${ADMIN_PANEL_COST} TX`).catch(() => {});
      res.json({ success: true, panel });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Server error";
      res.status(500).json({ error: msg });
    }
  });

  router.delete("/my/:id", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const panel = await Panel.findOne({ _id: req.params.id, userId: req.user!._id });
    if (!panel) { res.status(404).json({ error: "Panel not found" }); return; }
    await Panel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/admin/all", adminAuth, async (_req, res) => {
  try {
    const panels = await Panel.find({}).sort({ purchasedAt: -1 }).lean();
    const userIds = [...new Set(panels.map(p => p.userId?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select("email username").lean();
    const userMap: Record<string, { email: string; username: string }> = {};
    for (const u of users) userMap[u._id.toString()] = { email: u.email, username: u.username || "" };
    res.json(panels.map(p => ({
      ...p,
      ownerEmail: userMap[p.userId?.toString()]?.email || "unknown",
      ownerUsername: userMap[p.userId?.toString()]?.username || ""
    })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/panel/:id", adminAuth, async (req, res) => {
    try {
      const panel = await Panel.findById(req.params.id);
      if (!panel) { res.status(404).json({ error: "Panel not found" }); return; }
      await Panel.findByIdAndDelete(req.params.id);
      res.json({ ok: true });
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  router.post("/admin/plans", adminAuth, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      description: z.string().default(""),
      txCost: z.number().min(1),
      originalTxCost: z.number().default(0),
      ram: z.string().default(""),
      disk: z.string().default(""),
      cpu: z.string().default(""),
      isBestDeal: z.boolean().default(false),
      isAdminUpgrade: z.boolean().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const count = await PanelPlan.countDocuments();
    const plan = await PanelPlan.create({ ...parsed.data, active: true, order: count });
    res.json({ ok: true, plan });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/admin/plans/:id", adminAuth, async (req, res) => {
  try {
    await PanelPlan.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

export default router;
