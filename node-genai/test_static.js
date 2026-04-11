const { execSync, spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9999;
let serverProcess;
let passed = 0;
let failed = 0;

function request(urlPath) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
        }).on('error', reject);
    });
}

function assert(name, condition) {
    if (condition) {
        console.log(`  PASS: ${name}`);
        passed++;
    } else {
        console.log(`  FAIL: ${name}`);
        failed++;
    }
}

async function runTests() {
    console.log('Starting test server...');

    serverProcess = spawn('node', ['app.js'], {
        cwd: __dirname,
        env: { ...process.env, PORT: String(PORT), LLAMA_URL: 'http://localhost:11434', LLAMA_MODEL: 'test-model' },
        stdio: 'pipe',
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1500));

    try {
        // Test 1: Main page
        console.log('\nTest: Main page');
        const mainPage = await request('/');
        assert('returns 200', mainPage.status === 200);
        assert('contains title', mainPage.body.includes('Hello-GenAI in Node.js'));

        // Test 2: Health endpoint
        console.log('\nTest: Health endpoint');
        const health = await request('/health');
        assert('returns 200', health.status === 200);
        const healthData = JSON.parse(health.body);
        assert('has status field', healthData.status === 'healthy');
        assert('has version field', typeof healthData.version === 'string');
        assert('has uptime field', typeof healthData.uptime === 'string');
        assert('has node_version field', typeof healthData.node_version === 'string');
        assert('has memory field', typeof healthData.memory === 'object');

        // Test 3: Ping endpoint
        console.log('\nTest: Ping endpoint');
        const ping = await request('/ping');
        assert('returns 200', ping.status === 200);
        assert('returns pong', ping.body === 'pong');

        // Test 4: Favicon
        console.log('\nTest: Favicon');
        const favicon = await request('/static/favicon.ico');
        assert('returns 200', favicon.status === 200);

        // Test 5: Robots.txt
        console.log('\nTest: Robots.txt');
        const robots = await request('/static/robots.txt');
        assert('returns 200', robots.status === 200);

        // Test 6: CSS file
        console.log('\nTest: CSS file');
        const css = await request('/static/css/style.css');
        assert('returns 200', css.status === 200);
        assert('is CSS content type', css.headers['content-type'].includes('text/css'));

        // Test 7: JS file
        console.log('\nTest: JS file');
        const js = await request('/static/js/chat.js');
        assert('returns 200', js.status === 200);

        // Test 8: Swagger JSON
        console.log('\nTest: Swagger JSON');
        const swagger = await request('/api/swagger.json');
        assert('returns 200', swagger.status === 200);
        const swaggerData = JSON.parse(swagger.body);
        assert('has swagger version', swaggerData.swagger === '2.0');

        // Test 9: API docs page
        console.log('\nTest: API docs page');
        const docs = await request('/api/docs');
        assert('returns 200', docs.status === 200);
        assert('contains swagger-ui', docs.body.includes('swagger-ui'));

        // Test 10: Example endpoint
        console.log('\nTest: Example endpoint');
        const example = await request('/example');
        assert('returns 200', example.status === 200);
        const exampleData = JSON.parse(example.body);
        assert('has response field', typeof exampleData.response === 'string');
        assert('contains markdown', exampleData.response.includes('# Structured Response'));

        // Test 11: Security headers
        console.log('\nTest: Security headers');
        assert('has X-Content-Type-Options', mainPage.headers['x-content-type-options'] === 'nosniff');
        assert('has X-Frame-Options', mainPage.headers['x-frame-options'] === 'SAMEORIGIN');
        assert('has X-XSS-Protection', mainPage.headers['x-xss-protection'] === '1; mode=block');
        assert('has Content-Security-Policy', typeof mainPage.headers['content-security-policy'] === 'string');

    } catch (err) {
        console.error('Test error:', err.message);
        failed++;
    }

    // Summary
    console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);

    serverProcess.kill();
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
