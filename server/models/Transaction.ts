import mongoose from "mongoose";

  const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["topup", "deploy", "panel", "renew", "refund", "admin_grant"], required: true },
    txAmount: { type: Number, required: true },
    ksAmount: { type: Number, default: 0 },
    paystackRef: { type: String, default: "" },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    createdAt: { type: Date, default: Date.now }
  });

  export const Transaction = mongoose.model("Transaction", TransactionSchema);

  export interface ITransaction {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: "topup" | "deploy" | "panel" | "renew" | "refund" | "admin_grant";
    txAmount: number;
    ksAmount: number;
    paystackRef: string;
    status: "pending" | "success" | "failed";
    createdAt: Date;
  }
  