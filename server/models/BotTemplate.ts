import mongoose from "mongoose";

const BotTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  githubRepo: { type: String, required: true },
  sessionIdUrl: { type: String, required: true },
  imageUrl: { type: String, default: "" },
  isDefault: { type: Boolean, default: false },
  shareableSlug: { type: String, required: true, unique: true },
  costTx: { type: Number, default: 10 },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export const BotTemplate = mongoose.model("BotTemplate", BotTemplateSchema);

export interface IBotTemplate {
  _id: mongoose.Types.ObjectId;
  name: string;
  githubRepo: string;
  sessionIdUrl: string;
  imageUrl: string;
  isDefault: boolean;
  shareableSlug: string;
  costTx: number;
  active: boolean;
  order: number;
  createdAt: Date;
}
