const express = require('express');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(cors());

app.get('/api/status', (req, res) => {
    res.json({
        message: "GitOps Backend API is up and running!",
        architecture: "Microservices (App of Apps)",
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
