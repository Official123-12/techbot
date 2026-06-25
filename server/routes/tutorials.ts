import { Router } from "express";
  import { Tutorial } from "../models/Tutorial.js";

  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      const tutorials = await Tutorial.find({}).sort({ order: 1, createdAt: -1 }).lean();
      res.json(tutorials);
    } catch { res.status(500).json({ error: "Server error" }); }
  });

  export default router;
  