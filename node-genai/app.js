const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 8080;
const startTime = Date.now();
const VERSION = '1.0.0';

// --- Configuration ---

function loadConfig() {
    const llamaUrl = process.env.LLAMA_URL;
    const llamaModel = process.env.LLAMA_MODEL;

    if (!llamaUrl) {
        logger('WARNING: No LLM endpoint configured. Set LLAMA_URL.');
    }
    if (!llamaModel) {
        logger('WARNING: No LLM model configured. Set LLAMA_MODEL.');
    }

    return { llamaUrl, llamaModel };
}

function getLLMEndpoint() {
    return `${config.llamaUrl}/chat/completions`;
}

function getModelName() {
    return config.llamaModel;
}

// --- Logger ---

function logger(msg) {
    const timestamp = new Date().toISOString();
    console.log(`[hello-genai] ${timestamp} ${msg}`);
}

// --- In-memory Cache (5 minute TTL, matching Go) ---

class Cache {
    constructor(ttlMs = 5 * 60 * 1000) {
        this.items = new Map();
        this.ttlMs = ttlMs;
    }

    get(key) {
        const item = this.items.get(key);
        if (!item) return null;
        if (Date.now() > item.expiration) {
            this.items.delete(key);
            return null;
        }
        return item.value;
    }

    set(key, value) {
        this.items.set(key, {
            value,
            expiration: Date.now() + this.ttlMs,
        });
    }
}

// --- Rate Limiter (10 requests/minute per IP, matching Go/Rust) ---

class RateLimiter {
    constructor(limit = 10, windowMs = 60 * 1000) {
        this.clients = new Map();
        this.limit = limit;
        this.windowMs = windowMs;
    }

    allow(clientIP) {
        const now = Date.now();
        let timestamps = this.clients.get(clientIP) || [];

        // Remove timestamps outside the window
        timestamps = timestamps.filter(ts => now - ts <= this.windowMs);

        if (timestamps.length >= this.limit) {
            this.clients.set(clientIP, timestamps);
            return false;
        }

        timestamps.push(now);
        this.clients.set(clientIP, timestamps);
        return true;
    }
}

// --- Initialize ---

const config = loadConfig();
const cache = new Cache();
const rateLimiter = new RateLimiter();

// --- Middleware ---

app.use(express.json());

// Security headers (matching Go/Python/Rust)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://unpkg.com; font-src 'self' data: https://unpkg.com"
    );
    next();
});

// Request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        logger(`${req.method} ${req.originalUrl} ${Date.now() - start}ms`);
    });
    next();
});

// Static files
app.use('/static', express.static(path.join(__dirname, 'static')));

// --- Routes ---

// Main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

// Health check (detailed, matching Go)
app.get('/health', (req, res) => {
    const uptimeMs = Date.now() - startTime;
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const seconds = Math.floor((uptimeMs % 60000) / 1000);
    const mem = process.memoryUsage();

    res.json({
        status: 'healthy',
        llm_api: config.llamaUrl ? 'ok' : 'not_configured',
        timestamp: new Date().toISOString(),
        version: VERSION,
        uptime: `${hours}h ${minutes}m ${seconds}s`,
        memory: {
            rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
            heap_used: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heap_total: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        },
        node_version: process.version,
    });
});

// Ping endpoint
app.get('/ping', (req, res) => {
    res.type('text/plain').send('pong');
});

// Example structured response
app.get('/example', (req, res) => {
    const examplePath = path.join(__dirname, 'static', 'examples', 'structured_response_example.md');
    try {
        const data = fs.readFileSync(examplePath, 'utf8');
        res.json({ response: data });
    } catch {
        res.status(404).json({ error: 'Example not found' });
    }
});

// Swagger UI
app.get('/api/docs', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'swagger-interactive.html'));
});

// Swagger JSON
app.get('/api/swagger.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'static', 'swagger.json'));
});

// Chat API
app.post('/api/chat', (req, res) => {
    // Rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    if (!rateLimiter.allow(clientIP)) {
        return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { message } = req.body;

    // Input validation (matching Go)
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    if (message.length > 4000) {
        return res.status(400).json({ error: 'Message too long (max 4000 characters)' });
    }

    // Special command for model info
    if (message === '!modelinfo') {
        return res.json({ model: getModelName() });
    }

    // Check cache
    const cached = cache.get(message);
    if (cached) {
        logger('Cache hit for message');
        return res.json({ response: cached });
    }

    // Call LLM API
    callLLMAPI(message)
        .then(response => {
            cache.set(message, response);
            res.json({ response });
        })
        .catch(error => {
            logger(`Error calling LLM API: ${error.message}`);
            res.status(500).json({ error: 'Failed to get response from LLM' });
        });
});

// --- LLM API Call ---

async function callLLMAPI(userMessage) {
    const chatRequest = {
        model: getModelName(),
        messages: [
            {
                role: 'system',
                content:
                    'You are a helpful assistant. Please provide structured responses using markdown formatting. Use headers (# for main points), bullet points (- for lists), bold (**text**) for emphasis, and code blocks (```code```) for code examples. Organize your responses with clear sections and concise explanations.',
            },
            {
                role: 'user',
                content: userMessage,
            },
        ],
    };

    const response = await axios.post(getLLMEndpoint(), chatRequest, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });

    if (response.data && response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content.trim();
    }

    throw new Error('No response choices returned from API');
}

// --- Start Server ---

app.listen(PORT, () => {
    logger(`Server starting on http://localhost:${PORT}`);
    logger(`Using LLM endpoint: ${getLLMEndpoint()}`);
    logger(`Using model: ${getModelName()}`);
});
