import mongoose from "mongoose";

const ReferralSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  referredId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  txRewarded: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, default: "" },

});

export const Referral = mongoose.model("Referral", ReferralSchema);

export interface IReferral {
  _id: mongoose.Types.ObjectId;
  referrerId: mongoose.Types.ObjectId;
  referredId: mongoose.Types.ObjectId;
  txRewarded: number;
  createdAt: Date;
}
