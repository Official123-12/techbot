import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ imageUrl: process.env.IMAGE_URL || null });
});

export default router;
