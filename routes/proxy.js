import express from 'express';
import fetch from 'node-fetch';
import nodemailer from 'nodemailer';

const router = express.Router();

const SHOP = process.env.SHOP;
const ADMIN = process.env.ADMIN_TOKEN;

async function getMetafields(orderId){
  const r = await fetch(`https://${SHOP}/admin/api/2024-07/orders/${orderId}/metafields.json`, {
    headers: { 'X-Shopify-Access-Token': ADMIN }
  });
  const j = await r.json();
  const byKey = {};
  (j.metafields || []).forEach(m => { byKey[`${m.namespace}.${m.key}`] = m; });
  return byKey;
}

router.get('/check', async (req, res) => {
  try{
    const { order: orderId, t } = req.query;
    if(!orderId || !t) return res.sendStatus(400);
    const metas = await getMetafields(orderId);
    const token = metas['custom.selection_token']?.value;
    const used  = (metas['custom.selection_used']?.value === 'true');
    if(!token || token !== t || used) return res.sendStatus(403);
    res.sendStatus(200);
  } catch(e){
    console.error(e);
    res.sendStatus(500);
  }
});

router.post('/submit', express.json(), async (req, res) => {
  try {
    const { orderId, token, selection } = req.body || {};
    if(!orderId || !token || !selection?.variantId) return res.sendStatus(400);

    // Verify token
    const metas = await getMetafields(orderId);
    const saved = metas['custom.selection_token']?.value;
    const used  = (metas['custom.selection_used']?.value === 'true');
    if(!saved || saved !== token || used) return res.sendStatus(403);

    // Get order details
    const orr = await fetch(`https://${SHOP}/admin/api/2024-07/orders/${orderId}.json`, {
      headers: { 'X-Shopify-Access-Token': ADMIN }
    });
    const { order } = await orr.json();

    const shipping = order.shipping_address || {};
    const phone = order.phone || order.customer?.phone || shipping.phone;
    const email = order.email || order.customer?.email;

    // Mark token used
    if (metas['custom.selection_used']?.id) {
      await fetch(`https://${SHOP}/admin/api/2024-07/metafields/${metas['custom.selection_used'].id}.json`, {
        method: 'PUT',
        headers: { 'X-Shopify-Access-Token': ADMIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metafield: { value: 'true', type: 'boolean' }})
      });
    } else {
      await fetch(`https://${SHOP}/admin/api/2024-07/orders/${orderId}/metafields.json`, {
        method: 'POST',
        headers: { 'X-Shopify-Access-Token': ADMIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ metafield: { namespace: 'custom', key: 'selection_used', type: 'boolean', value: 'true' }})
      });
    }

    // Save selection on order
    await fetch(`https://${SHOP}/admin/api/2024-07/orders/${orderId}/metafields.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': ADMIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ metafield: {
        namespace: 'custom', key: 'selection_result', type: 'json',
        value: JSON.stringify(selection)
      }})
    });

    // Send email notification
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });

    const lines = [
      `Order: ${order.name} (#${order.id})`,
      `Kund: ${(order.customer?.first_name||'')} ${(order.customer?.last_name||'')}`,
      `E-post: ${email}`,
      `Tel: ${phone||'-'}`,
      `Adress: ${shipping.address1||''} ${shipping.address2||''}, ${shipping.zip||''} ${shipping.city||''}, ${shipping.country||''}`,
      `Val: Storlek ${selection.size}, Färg ${selection.color}, VariantID ${selection.variantId}`
    ].join('\n');

    await transporter.sendMail({
      from: 'no-reply@dinbutik.se',
      to: 'din-inbox@dinbutik.se',
      subject: `Val ifrån ${order.name}`,
      text: lines
    });

    res.sendStatus(200);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

export default router;
