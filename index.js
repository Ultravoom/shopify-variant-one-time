// index.js
// Uppdaterad med Webhook-logik

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { fetch } from "undici";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid"; // NYTT: För att skapa unika tokens
import bodyParser from "body-parser"; // NYTT: För att hantera webhook-data

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ----- Temporär lagring för tokens -----
// VIKTIGT: Denna nollställs om servern startas om.
// I ett senare steg byter vi ut detta mot en riktig databas.
const tokenStore = {};

// Middleware
// Vi använder inte express.json() för webhooken, därav den lite mer komplexa setupen.
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Miljövariabler
const PORT = process.env.PORT || 3000;
const SHOP = process.env.SHOP;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const API_VERSION = process.env.API_VERSION || "2025-10";
const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`; // Din app:s publika adress

// Nodemailer setup
const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ----- Webhook Routes -----
app.post("/webhooks/orders-paid", async (req, res) => {
  const order = req.body;
  console.log(`Webhook mottagen för order: ${order.name}`);

  try {
    // 1. Kolla om ordern innehåller "Sizing Kit First"
    const containsSizingKit = order.line_items.some(
      (item) => item.variant_title === "Sizing Kit First"
    );

    if (containsSizingKit) {
      console.log(`Order ${order.name} innehåller Sizing Kit. Skapar unik länk...`);

      // 2. Skapa en unik token
      const token = uuidv4();

      // 3. Spara token med orderinformation
      tokenStore[token] = {
        orderId: order.id,
        orderName: order.name,
        email: order.email,
        used: false,
        createdAt: new Date(),
      };

      // 4. Skapa den unika länken
      const uniqueUrl = `${APP_URL}/choose.html?token=${token}`;
      console.log(`Skapad länk för ${order.email}: ${uniqueUrl}`);

      // NÄSTA STEG: Här kommer vi lägga till kod för att maila länken till kunden.

    } else {
      console.log(`Order ${order.name} innehåller INTE Sizing Kit. Ignorerar.`);
    }

    // 5. Skicka alltid ett OK-svar till Shopify direkt
    res.status(200).send("OK");

  } catch (err) {
    console.error("Fel i webhook-hanteraren:", err);
    res.status(500).send("Error processing webhook");
  }
});

// ----- API Routes -----

// (Alla dina gamla API-routes som /api/products, /api/choose etc. är kvar här under)

// Shopify products
app.get("/api/products", async (_req, res) => {
  try {
    const url = `https://${SHOP}/admin/api/${API_VERSION}/products.json?handle=smart-ring-pro`;
    const r = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": ADMIN_TOKEN,
        "Accept": "application/json",
      },
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body.errors);
    return res.json({ ok: true, products: body.products });
  } catch (err) {
    console.error("Error in /api/products:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Customer chooses variant
app.post("/api/choose", async (req, res) => {
  // Denna funktion kommer vi också att bygga ut senare
  const { variantId } = req.body;
  if (!variantId) {
    return res.status(400).json({ ok: false, error: "variantId is required" });
  }
  try {
    console.log("Customer chose variant:", variantId);
    // Temporär mail till dig
    const info = await mailer.sendMail({
      from: `"Variant Selector" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: "New ring variant chosen (TEST)",
      text: `A customer has chosen variant ${variantId}. (Token-hantering ej implementerad än)`,
    });
    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("Error in /api/choose:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
