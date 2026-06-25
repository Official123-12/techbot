import mongoose from "mongoose";

const IPRecordSchema = new mongoose.Schema({
  ip: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fingerprint: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

IPRecordSchema.index({ ip: 1, userId: 1 }, { unique: true });

export const IPRecord = mongoose.model("IPRecord", IPRecordSchema);

export interface IIPRecord {
  _id: mongoose.Types.ObjectId;
  ip: string;
  userId: mongoose.Types.ObjectId;
  fingerprint: string;
  createdAt: Date;
}
