import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function ordersCreate(req, res) {
  try {
    const order = req.body || {};
    const lineItems = order.line_items || [];

    const hasSizingKit = lineItems.some(li =>
      String(li.title || '').toLowerCase().includes('sizing kit first')
    );
    if (!hasSizingKit) return res.status(200).send('OK (no sizing-kit item)');

    const token = crypto.randomBytes(16).toString('hex');

    // Create/ensure selection_token
    await fetch(`https://${process.env.SHOP}/admin/api/2024-07/orders/${order.id}/metafields.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        metafield: {
          namespace: 'custom',
          key: 'selection_token',
          type: 'single_line_text_field',
          value: token
        }
      })
    });

    // Create/ensure selection_used=false
    await fetch(`https://${process.env.SHOP}/admin/api/2024-07/orders/${order.id}/metafields.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.ADMIN_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        metafield: {
          namespace: 'custom',
          key: 'selection_used',
          type: 'boolean',
          value: 'false'
        }
      })
    });

    res.status(200).send('OK (token created)');
  } catch (e) {
    console.error(e);
    res.status(500).send('ERR');
  }
}
