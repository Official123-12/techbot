import mongoose from "mongoose";

const PackageSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ksPrice: { type: Number, required: true },
  txAmount: { type: Number, required: true },
  bonusTx: { type: Number, default: 0 },
  isBestDeal: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
});

export const Package = mongoose.model("Package", PackageSchema);

export interface IPackage {
  _id: mongoose.Types.ObjectId;
  name: string;
  ksPrice: number;
  txAmount: number;
  bonusTx: number;
  isBestDeal: boolean;
  order: number;
  active: boolean;
}
