import crypto from "crypto";
import { IPRecord } from "../models/IPRecord.js";

const MAX_ACCOUNTS_PER_FINGERPRINT = 5;

export function getClientIP(req: { headers: Record<string, unknown>; socket: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function canRegisterWithIP(_ip: string, fingerprint: string): Promise<{ allowed: boolean; reason?: string }> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentIPCount = await IPRecord.countDocuments({ ip: _ip, createdAt: { $gte: hourAgo } });
    if (recentIPCount >= 3) {
      return { allowed: false, reason: "Too many accounts created from this network. Please try again later." };
    }
    if (fingerprint) {
      const MAX_ACCOUNTS_PER_FINGERPRINT = 5;
      const fpCount = await IPRecord.countDocuments({ fingerprint });
      if (fpCount >= MAX_ACCOUNTS_PER_FINGERPRINT) {
        return { allowed: false, reason: "Maximum number of accounts reached for this device" };
      }
    }
    return { allowed: true };
}

export async function recordIPAndFingerprint(ip: string, userId: string, fingerprint: string): Promise<void> {
  try {
    await IPRecord.updateOne(
      { ip, userId },
      { $set: { fingerprint: fingerprint || "", createdAt: new Date() } },
      { upsert: true }
    );
  } catch {
  }
}
