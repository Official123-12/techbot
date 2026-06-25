import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/User.js";

const JWT_SECRET = process.env.JWT_SECRET || "";

export interface AuthRequest extends Request {
  user?: IUser;
}

export const authGuard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = await User.findById(decoded.userId).lean();
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    req.user = user as unknown as IUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};
