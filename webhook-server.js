const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || 'change-this-secret';

function log(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

function verifySignature(payload, sig) {
    const hmac = crypto.createHmac('sha256', SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(digest));
}

function deploy(env) {
    const script = env === 'test' ? './deploy-test.sh' : './deploy-prod.sh';
    log(`Starting ${env} deployment...`);
    
    const child = exec(`cd /home/ubuntu/relist && ${script}`, { maxBuffer: 1024 * 1024 });
    child.stdout.on('data', d => console.log(d));
    child.stderr.on('data', d => console.error(d));
    child.on('close', code => {
        log(`${env} deployment ${code === 0 ? 'succeeded' : 'failed'}`);
    });
}

const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook') {
        res.statusCode = 404;
        res.end('Not Found');
        return;
    }
    
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        const sig = req.headers['x-hub-signature-256'];
        const event = req.headers['x-github-event'];
        
        if (!sig || !verifySignature(body, sig)) {
            res.statusCode = 401;
            res.end('Unauthorized');
            return;
        }
        
        if (event !== 'push') {
            res.end('OK');
            return;
        }
        
        try {
            const payload = JSON.parse(body);
            const branch = payload.ref.replace('refs/heads/', '');
            log(`Push to ${branch}`);
            
            if (branch === 'test') {
                res.end('Deploying test');
                deploy('test');
            } else if (branch === 'main') {
                res.end('Deploying prod');
                deploy('prod');
            } else {
                res.end('Ignored');
            }
        } catch (e) {
            res.statusCode = 400;
            res.end('Bad Request');
        }
    });
});

server.listen(PORT, () => {
    log(`Webhook server on port ${PORT}`);
    log(`Configure GitHub: http://YOUR_IP:${PORT}/webhook`);
});
