import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

export const adminGuard = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Basic ")) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  const decoded = Buffer.from(auth.split(" ")[1], "base64").toString("utf-8");
  const [username, password] = decoded.split(":");
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Invalid admin credentials" });
    return;
  }
  next();
};
