import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Package } from "./models/Package.js";
import { Team } from "./models/Team.js";
import { User } from "./models/User.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "";

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // SEED PACKAGES (TSh)
    const packageCount = await Package.countDocuments();
    if (packageCount === 0) {
      console.log("Seeding packages...");
      await Package.insertMany([
        { name: "Starter",   ksPrice: 500,  txAmount: 10,  bonusTx: 0,  isBestDeal: false, active: true, order: 1 },
        { name: "Basic",     ksPrice: 1000, txAmount: 20,  bonusTx: 0,  isBestDeal: false, active: true, order: 2 },
        { name: "Standard",  ksPrice: 1500, txAmount: 30,  bonusTx: 0,  isBestDeal: false, active: true, order: 3 },
        { name: "Best Deal", ksPrice: 2000, txAmount: 50,  bonusTx: 20, isBestDeal: true,  active: true, order: 4 },
        { name: "Pro",       ksPrice: 2500, txAmount: 50,  bonusTx: 0,  isBestDeal: false, active: true, order: 5 },
        { name: "Elite",     ksPrice: 5000, txAmount: 100, bonusTx: 0,  isBestDeal: false, active: true, order: 6 },
        { name: "Ultimate",  ksPrice: 10000, txAmount: 200, bonusTx: 0,  isBestDeal: false, active: true, order: 7 }
      ]);
      console.log("Packages seeded (TSh)");
    }

    // SEED TEAMS
    const teamCount = await Team.countDocuments();
    if (teamCount === 0) {
      console.log("Seeding teams...");
      await Team.insertMany([
        { name: "stany-host1", active: true },
        { name: "stany-host2", active: true }
      ]);
      console.log("Teams seeded");
    }

    // SEED ADMIN
    const adminEmail = "stanytz@gmail.com";
    const adminUsername = "stanytz";
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      console.log("Creating admin user...");
      const passwordHash = await bcrypt.hash("@Stanytz2024!", 12);
      await User.create({
        email: adminEmail,
        username: adminUsername,
        password: passwordHash,
        txCoins: 999999,
        isAdmin: true,
        isBanned: false,
        referralCode: `STANY${Date.now().toString(36).toUpperCase()}`,
        paymentFailCount: 0,
        paymentFailDate: "",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("Admin user created");
    } else {
      if (existingAdmin.txCoins < 999999 || !existingAdmin.isAdmin) {
        console.log("Updating admin user...");
        await User.updateOne(
          { email: adminEmail },
          { 
            txCoins: 999999,
            isAdmin: true,
            username: adminUsername
          }
        );
        console.log("Admin updated");
      } else {
        console.log(`Admin already exists (${existingAdmin.txCoins} SQ)`);
      }
    }

    console.log("Seeding completed successfully!");
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");

  } catch (err) {
    console.error("Seeding failed:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();