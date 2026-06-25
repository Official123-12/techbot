import mongoose from "mongoose";

const BlockedTrialSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export const BlockedTrial = mongoose.model("BlockedTrial", BlockedTrialSchema);

export interface IBlockedTrial {
  _id: mongoose.Types.ObjectId;
  phoneNumber: string;
  email: string;
  createdAt: Date;
}
