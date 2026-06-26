import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  txCoins: { type: Number, default: 0 },
  bots: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bot" }],
  usedFreeTrial: { type: Boolean, default: false },
  trialPhoneNumbers: [{ type: String }],
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: "" },
  bannedAt: { type: Date, default: null },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  paymentFailCount: { type: Number, default: 0 },
  paymentFailDate: { type: String, default: "" },
  // ===== ADDED: isAdmin field =====
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model("User", UserSchema);

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  username?: string;
  passwordHash: string;
  txCoins: number;
  bots: mongoose.Types.ObjectId[];
  usedFreeTrial: boolean;
  trialPhoneNumbers: string[];
  isBanned: boolean;
  banReason: string;
  bannedAt: Date | null;
  referralCode: string;
  referredBy: mongoose.Types.ObjectId | null;
  paymentFailCount: number;
  paymentFailDate: string;
  isAdmin: boolean;  // ===== ADDED =====
  createdAt: Date;
}