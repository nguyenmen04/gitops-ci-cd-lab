const express = require('express');
const cors = require('cors');
const client = require('prom-client'); // Import prom-client

const app = express();
const port = 3000;

app.use(cors());

// Collect default metrics (CPU, Memory, v.v.)
client.collectDefaultMetrics();

// Define a custom metric to count requests
const httpRequestCounter = new client.Counter({
  name: 'flask_http_request_total', // Tên giống slide để dễ query
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Mock Error Rate từ environment variable (mặc định 0)
const ERROR_RATE = parseFloat(process.env.ERROR_RATE || "0");
const VERSION = process.env.VERSION || "v1";

// Readiness Probe endpoint
app.get('/healthz', (req, res) => {
    res.status(200).send("ok");
});

// Expose /metrics endpoint cho Prometheus
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.send(await client.register.metrics());
});

app.get('/api/status', (req, res) => {
    const isError = Math.random() < ERROR_RATE;
    
    if (isError) {
        httpRequestCounter.labels('GET', '/api/status', '500').inc();
        return res.status(500).json({
            error: "injected",
            version: VERSION,
            message: "Simulated internal server error"
        });
    }

    httpRequestCounter.labels('GET', '/api/status', '200').inc();
    res.status(200).json({
        message: "GitOps Backend API is up and running!",
        architecture: "Microservices (App of Apps)",
        version: VERSION,
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
