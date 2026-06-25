# Toxic Host

  WhatsApp bot hosting platform with TX coin economy, Pterodactyl panel shop, and automated deployment.

  ## Stack

  - **Frontend**: React + Vite + TypeScript + Tailwind CSS
  - **Backend**: Express 5 + MongoDB (Mongoose) + TypeScript
  - **Payments**: Paystack (M-Pesa, Airtel, Card)
  - **Bot hosting**: Heroku (via API)
  - **Panel hosting**: Pterodactyl

  ## Features

  - Deploy any WhatsApp bot template in < 2 minutes
  - TX coin economy (1 TX = KSh 5 top-up rate)
  - Free 24-hour trial (one per number, ever)
  - Panel Shop — buy Pterodactyl hosting panels with TX coins (40% off launch pricing)
  - Referral system (both sides earn 1 TX on signup)
  - Coupon codes redeemable on dashboard
  - Full admin panel: user management, bot control, transactions, coupons, DB stats
  - Payment spam protection: 7 failed payments/day → automatic account ban
  - OG meta tags for shareable bot deployment links
  - Dark/light mode

  ## TX Coin System

  | Action | Cost |
  |---|---|
  | Deploy bot | 10 TX/month |
  | Renew bot | 10 TX/month |
  | Mini 400MB Panel | 5 TX (was 8 TX) |
  | Basic 800MB Panel | 10 TX (was 16 TX) |
  | Unlimited Panel | 12 TX (was 20 TX) |

  ## Development

  ```bash
  npm install
  npm run dev        # frontend (Vite)
  npm run server     # backend (Express)
  ```

  Required env: `MONGODB_URI`, `JWT_SECRET`, `SESSION_SECRET`, `HEROKU_API_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`

  ## Deployment

  Hosted on Heroku. Build command: `npm run build`.
  