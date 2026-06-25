import { Router } from "express";
import { z } from "zod";
import { BotTemplate } from "../models/BotTemplate.js";
import { Bot } from "../models/Bot.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import type { Request, Response, NextFunction } from "express";
import type { IUser } from "../models/User.js";

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

router.get("/", authGuard, banCheck, async (_req, res) => {
  try {
    const templates = await BotTemplate.find({ active: true }).sort({ isDefault: -1, order: 1, createdAt: 1 }).lean();
    const templateIds = templates.map(t => t._id.toString());
    const counts = await Bot.aggregate([
      { $match: { templateId: { $in: templateIds }, status: { $ne: "deleted" } } },
      { $group: { _id: "$templateId", count: { $sum: 1 } } }
    ]);
    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c._id] = c.count;
    res.json(templates.map(t => ({ ...t, deployCount: countMap[t._id.toString()] || 0 })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/slug/:slug", async (req, res) => {
  try {
    const template = await BotTemplate.findOne({ shareableSlug: req.params.slug, active: true }).lean();
    if (!template) { res.status(404).json({ error: "Bot not found" }); return; }
    res.json(template);
  } catch { res.status(500).json({ error: "Server error" }); }
});

const addSchema = z.object({
  name: z.string().min(2),
  githubRepo: z.string().url(),
  sessionIdUrl: z.string().url(),
  costTx: z.number().min(0).default(10)
});

async function fetchAppJson(repoUrl: string): Promise<{ imageUrl: string }> {
  try {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return { imageUrl: "" };
    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, "");
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/main/app.json`;
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { imageUrl: "" };
    const data = await res.json() as { logo?: string; image?: string };
    const imageUrl = data.logo || data.image || "";
    return { imageUrl };
  } catch { return { imageUrl: "" }; }
}

function makeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${base}-${rand}`;
}

router.post("/", adminAuth, async (req: AdminReq, res) => {
  try {
    const parsed = addSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
    const { name, githubRepo, sessionIdUrl, costTx } = parsed.data;
    const { imageUrl } = await fetchAppJson(githubRepo);
    const shareableSlug = makeSlug(name);
    const count = await BotTemplate.countDocuments();
    const template = await BotTemplate.create({
      name, githubRepo, sessionIdUrl, imageUrl, shareableSlug, costTx,
      isDefault: false, active: true, order: count
    });
    res.json({ ok: true, template });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/:id", adminAuth, async (req: AdminReq, res) => {
  try {
    const template = await BotTemplate.findById(req.params.id);
    if (!template) { res.status(404).json({ error: "Not found" }); return; }
    if (template.isDefault) { res.status(400).json({ error: "Cannot remove the default bot" }); return; }
    await BotTemplate.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/:id/refresh-image", adminAuth, async (req: AdminReq, res) => {
  try {
    const template = await BotTemplate.findById(req.params.id);
    if (!template) { res.status(404).json({ error: "Not found" }); return; }
    const { imageUrl } = await fetchAppJson(template.githubRepo);
    template.imageUrl = imageUrl;
    await template.save();
    res.json({ ok: true, imageUrl });
  } catch { res.status(500).json({ error: "Server error" }); }
});

export default router;
