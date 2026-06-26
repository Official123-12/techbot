import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { 
    type: String, 
    enum: ["topup", "deploy", "panel", "renew", "refund", "admin_grant"], 
    required: true 
  },
  txAmount: { type: Number, required: true }, // SQ coins
  ksAmount: { type: Number, default: 0 }, // TSh amount
  paystackRef: { type: String, default: "" }, // Payment reference
  status: { 
    type: String, 
    enum: ["pending", "success", "failed"], 
    default: "pending" 
  },
  provider: { 
    type: String, 
    enum: ["paystack", "tigerpay", "minpay", "mobile_money"], 
    default: "paystack" 
  }, // Payment provider
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }, // Additional data (screenshot path, etc)
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for faster queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ paystackRef: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ provider: 1 });

// Update timestamp on save
TransactionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Transaction = mongoose.model("Transaction", TransactionSchema);

export interface ITransaction {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  type: "topup" | "deploy" | "panel" | "renew" | "refund" | "admin_grant";
  txAmount: number; // SQ coins
  ksAmount: number; // TSh
  paystackRef: string;
  status: "pending" | "success" | "failed";
  provider: "paystack" | "tigerpay" | "minpay" | "mobile_money";
  metadata: {
    screenshot?: string;
    uploadedAt?: string;
    uploadedBy?: string;
    phone?: string;
    provider?: string;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}