# Shopify One-Time Variant Picker (Server)

Detta är en minimal Express-server med tre endpoints:
- `POST /webhooks/orders-create` – skapar engångstoken på ordern
- `GET  /apps/valj-variant/check` – verifierar att token är giltig och oanvänd
- `POST /apps/valj-variant/submit` – markerar token som använd, hämtar orderinfo och skickar mejl till dig

## Snabbstart (översikt)
1) Kopiera `.env.example` till `.env` och fyll i `SHOP` och `ADMIN_TOKEN` (+ SMTP om du vill).
2) `npm install`
3) `npm run dev`
4) Ställ in Shopify **App Proxy** att peka mot din server:
   - Subpath: `/apps/valj-variant`
   - Proxy till din bas-URL (t.ex. `https://dinserver.se`)
5) Ställ in webhook `orders/create` till `POST https://dinserver.se/webhooks/orders-create`

> I nästa steg (efter du laddat ner detta) får du exakt guide för installation.
