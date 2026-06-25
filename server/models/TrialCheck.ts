import mongoose from "mongoose";

const TrialCheckSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  status: { type: String, enum: ["trial_pending", "trial_ended"], default: "trial_pending" },
  createdAt: { type: Date, default: Date.now }
});

export const TrialCheck = mongoose.model("TrialCheck", TrialCheckSchema);

export interface ITrialCheck {
  _id: mongoose.Types.ObjectId;
  phoneNumber: string;
  status: "trial_pending" | "trial_ended";
  createdAt: Date;
}
