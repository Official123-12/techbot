import rateLimit from "express-rate-limit";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});

export const signupRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});

export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many payment requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});
