import mongoose from "mongoose";

const PanelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  planName: { type: String, required: true },
  panelUsername: { type: String, required: true },
  panelPassword: { type: String, required: true },
  panelLoginUrl: { type: String, required: true },
  txCost: { type: Number, required: true },
  purchasedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null }
});

export const Panel = mongoose.model("Panel", PanelSchema);

export interface IPanel {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  planName: string;
  panelUsername: string;
  panelPassword: string;
  panelLoginUrl: string;
  txCost: number;
  purchasedAt: Date;
  expiresAt: Date | null;
}
