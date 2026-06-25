import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  txCost: { type: Number, required: true },
  originalTxCost: { type: Number, default: 0 },
  ram: { type: String, default: "" },
  disk: { type: String, default: "" },
  cpu: { type: String, default: "" },
  isBestDeal: { type: Boolean, default: false },
  isAdminUpgrade: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const PanelPlan = mongoose.model("PanelPlan", PlanSchema);

export interface IPanelPlan {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  txCost: number;
  originalTxCost: number;
  ram: string;
  disk: string;
  cpu: string;
  isBestDeal: boolean;
  isAdminUpgrade: boolean;
  active: boolean;
  order: number;
  createdAt: Date;
}
