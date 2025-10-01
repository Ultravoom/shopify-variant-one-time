import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import ordersCreate from './routes/orders-create.js';
import proxyRouter from './routes/proxy.js';

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get('/', (req, res) => res.send('OK'));

// Webhooks
app.post('/webhooks/orders-create', ordersCreate);

// App Proxy
app.use('/apps/valj-variant', proxyRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
