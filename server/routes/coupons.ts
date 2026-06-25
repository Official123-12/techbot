import { Router } from "express";
import { z } from "zod";
import { Coupon } from "../models/Coupon.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";

const router = Router();

router.use(authGuard);
router.use(banCheck);

router.post("/claim", async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ code: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid coupon code" }); return; }
    const { code } = parsed.data;
    const upperCode = code.toUpperCase().trim();

    const coupon = await Coupon.findOne({ code: upperCode });
    if (!coupon) { res.status(404).json({ error: "Invalid coupon code" }); return; }
    if (coupon.claimedBy) { res.status(409).json({ error: "Coupon already claimed" }); return; }

    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    coupon.claimedBy = user._id;
    coupon.claimedAt = new Date();
    await coupon.save();

    user.txCoins += coupon.txAmount;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: "admin_grant",
      txAmount: coupon.txAmount,
      ksAmount: 0,
      status: "success"
    });

    res.json({
      success: true,
      message: `You've redeemed ${upperCode} and received ${coupon.txAmount} TX!`,
      txAmount: coupon.txAmount,
      newBalance: user.txCoins
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
