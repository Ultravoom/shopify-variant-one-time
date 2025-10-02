// index.js
// Test: dotenv är inaktiverat

// import dotenv from "dotenv";
// dotenv.config();

import express from "express";
import { fetch } from "undici";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import bodyParser from "body-parser";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const tokenStore = {};

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const SHOP = process.env.SHOP;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const API_VERSION = process.env.API_VERSION || "2025-10";
const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post("/webhooks/orders-paid", async (req, res) => {
  const order = req.body;
  console.log(`Webhook mottagen för order: ${order.name}`);
  try {
    const containsSizingKit = order.line_items.some(
      (item) => item.variant_title.includes("Sizing Kit First")
    );
    if (containsSizingKit) {
      console.log(`Order ${order.name} innehåller Sizing Kit. Skapar och mailar länk...`);
      const token = uuidv4();
      tokenStore[token] = {
        orderId: order.id,
        orderName: order.name,
        email: order.email,
        shippingAddress: order.shipping_address,
        used: false,
        createdAt: new Date(),
      };
      const uniqueUrl = `https://choose.ultravoom.se/choose.html?token=${token}`;
      console.log(`Skapad länk för ${order.email}: ${uniqueUrl}`);
      await mailer.sendMail({
        from: `"UltraVoom" <${process.env.SMTP_USER}>`,
        to: order.email,
        subject: "Viktigt: Välj storlek för din Smart Ring",
        text: `Hej ${order.customer.first_name || ''}!\n\nTack för din beställning. Välj din färg och storlek via länken nedan för att slutföra din order.\n\n${uniqueUrl}\n\nVänliga hälsningar,\nTeam UltraVoom`,
        html: `<p>Hej ${order.customer.first_name || ''}!</p><p>Tack för din beställning. Välj din färg och storlek via länken nedan för att slutföra din order.</p><p><a href="${uniqueUrl}"><strong>Klicka här för att välja din ring</strong></a></p><p>Vänliga hälsningar,<br>Team UltraVoom</p>`,
      });
      console.log(`Mejl skickat till ${order.email}`);
    } else {
      console.log(`Order ${order.name} innehåller INTE Sizing Kit. Ignorerar.`);
    }
    res.status(200).send("OK");
  } catch (err) {
    console.error("Fel i webhook-hanteraren:", err);
    res.status(500).send("Error processing webhook");
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const url = `https://${SHOP}/admin/api/${API_VERSION}/products.json`;
    const r = await fetch(url, { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN, "Accept": "application/json" } });
    const body = await r.json();
    if (!r.ok) throw new Error(body.errors);
    return res.json({ ok: true, products: body.products });
  } catch (err) {
    console.error("Error in /api/products:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post("/api/choose", async (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
