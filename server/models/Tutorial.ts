import mongoose from "mongoose";

  const TutorialSchema = new mongoose.Schema({
    title: { type: String, required: true },
    youtubeUrl: { type: String, required: true },
    order: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
  });

  export const Tutorial = mongoose.model("Tutorial", TutorialSchema);

  export interface ITutorial {
    _id: mongoose.Types.ObjectId;
    title: string;
    youtubeUrl: string;
    order: number;
    createdAt: Date;
  }
  