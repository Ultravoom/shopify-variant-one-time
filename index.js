// index.js
// SLUTGILTIG VERSION 2.1 - Renstädad

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

const mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// Webhook som skickar länk till kund
app.post("/webhooks/orders-paid", async (req, res) => {
    const order = req.body;
    console.log(`Webhook mottagen för order: ${order.name}`);
    try {
        const sizingKitItem = order.line_items.find((item) => item.variant_title.includes("Sizing Kit First"));
        if (sizingKitItem) {
            console.log(`Order ${order.name} innehåller Sizing Kit. Skapar och mailar länk...`);
            const titleParts = sizingKitItem.variant_title.split('/');
            const colorName = titleParts[0].trim().toLowerCase();
            const token = uuidv4();
            tokenStore[token] = { orderId: order.id, orderName: order.name, email: order.email, shippingAddress: order.shipping_address, used: false, createdAt: new Date() };
            const uniqueUrl = `https://choose.ultravoom.se/choose.html?token=${token}&color=${colorName}`;
            await mailer.sendMail({
                from: `"UltraVoom" <${process.env.SMTP_USER}>`,
                to: order.email,
                subject: "Viktigt: Välj storlek för din Smart Ring",
                html: `<p>Hej ${order.customer.first_name || ''}!</p><p>Tack för din beställning. Välj storlek för din ${colorName}-ring via länken nedan för att slutföra din order.</p><p><a href="${uniqueUrl}"><strong>Klicka här för att välja din storlek</strong></a></p><p>Vänliga hälsningar,<br>Team UltraVoom</p>`,
            });
            console.log(`Mejl skickat till ${order.email} med färg: ${colorName}`);
        } else {
            console.log(`Order ${order.name} innehåller INTE Sizing Kit. Ignorerar.`);
        }
        res.status(200).send("OK");
    } catch (err) {
        console.error("Fel i webhook-hanteraren:", err);
        res.status(500).send("Error processing webhook");
    }
});

// API för att hämta produkter
app.get("/api/products", async (_req, res) => {
    try {
        const url = `https://${SHOP}/admin/api/${API_VERSION}/products.json?handle=smart-ring-pro`;
        const r = await fetch(url, { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN, "Accept": "application/json" } });
        const body = await r.json();
        if (!r.ok) throw new Error(body.errors || 'Unknown API error');
        return res.json({ ok: true, products: body.products });
    } catch (err) {
        console.error("Error in /api/products:", err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// API som tar emot kundens val och mailar butiksägaren
app.post("/api/choose", async (req, res) => {
    const { variantId, token } = req.body;
    if (!variantId || !token) {
        return res.status(400).json({ ok: false, error: "variantId and token are required" });
    }
    const tokenData = tokenStore[token];
    if (!tokenData || tokenData.used) {
        return res.status(401).json({ ok: false, error: "Invalid or already used token." });
    }
    try {
        tokenData.used = true;
        const variantUrl = `https://${SHOP}/admin/api/${API_VERSION}/variants/${variantId}.json`;
        const r = await fetch(variantUrl, { headers: { "X-Shopify-Access-Token": ADMIN_TOKEN, "Accept": "application/json" } });
        const { variant } = await r.json();
        const adr = tokenData.shippingAddress;
        const addressString = `${adr.name}<br>${adr.address1}<br>${adr.zip} ${adr.city}<br>${adr.country}`;
        await mailer.sendMail({
            from: `"UltraVoom App" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: `✅ Nytt val för order ${tokenData.orderName}`,
            html: `<h3>Ett val har gjorts för order ${tokenData.orderName}</h3>
                   <p><strong>Vald variant:</strong> ${variant.title}</p>
                   <p><strong>Variant-ID:</strong> ${variant.id}</p>
                   <hr>
                   <h4>Leveransadress:</h4>
                   <p>${addressString}</p>`,
        });
        res.json({ ok: true });
    } catch (err) {
        console.error("Error in /api/choose:", err);
        res.status(500).json({ ok: false, error: String(err) });
    }
});

// Starta servern
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
