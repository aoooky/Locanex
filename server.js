

const http   = require('http');
const crypto = require('crypto');
const os     = require('os');
const QRCode = require('qrcode');

function generateQRSvg(text) {
    var qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
    var size = qr.modules.size;
    var data = qr.modules.data;
    var cell = 6, pad = 24, imgSize = size * cell + pad * 2;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + imgSize + ' ' + imgSize + '">';

    for (var row = 0; row < size; row++) {
        for (var col = 0; col < size; col++) {
            if (data[row * size + col]) {
                var x = pad + col * cell, y = pad + row * cell;
                svg += '<rect x="' + x + '" y="' + y + '" width="' + (cell - 0.5) + '" height="' + (cell - 0.5) + '" rx="1.8" fill="#00d4aa" opacity="0.92"/>';
            }
        }
    }

    var c = imgSize / 2;
    var logoR = Math.round(size * cell * 0.24);
    svg += '<circle cx="' + c + '" cy="' + c + '" r="' + (logoR + 4) + '" fill="#080b12"/>';
    svg += '<circle cx="' + c + '" cy="' + c + '" r="' + logoR + '" fill="none" stroke="#00d4aa" stroke-width="' + Math.round(imgSize * 0.025) + '" opacity="0.95"/>';
    svg += '<circle cx="' + c + '" cy="' + c + '" r="' + Math.round(imgSize * 0.015) + '" fill="#00d4aa" opacity="0.95"/>';

    svg += '</svg>';
    return svg;
}

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets))
        for (const net of nets[name])
            if (net.family === 'IPv4' && !net.internal) return net.address;
    return 'localhost';
}

function doHandshake(req, socket) {
    const key    = req.headers['sec-websocket-key'];
    const accept = crypto.createHash('sha1')
        .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');
    socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
    );
}

function wsFrame(text) {
    const payload = Buffer.from(text, 'utf8');
    const len     = payload.length;
    let   header;
    if      (len < 126)   { header = Buffer.alloc(2);  header[0]=0x81; header[1]=len; }
    else if (len < 65536) { header = Buffer.alloc(4);  header[0]=0x81; header[1]=126; header.writeUInt16BE(len,2); }
    else                  { header = Buffer.alloc(10); header[0]=0x81; header[1]=127; header.writeBigUInt64BE(BigInt(len),2); }
    return Buffer.concat([header, payload]);
}

function sendWS(socket, text) {
    try { socket.write(wsFrame(text)); } catch {}
}

function decodeFrame(buf) {
    if (buf.length < 2) return null;
    const masked = !!(buf[1] & 0x80);
    let   len    = buf[1] & 0x7f;
    let   offset = 2;
    if (len === 126) { len = buf.readUInt16BE(2); offset = 4; }
    if (len === 127) { len = Number(buf.readBigUInt64BE(2)); offset = 10; }
    if (buf.length < offset + (masked ? 4 : 0) + len) return null;
    if (masked) {
        const mask = buf.slice(offset, offset + 4); offset += 4;
        const data = Buffer.alloc(len);
        for (let i = 0; i < len; i++) data[i] = buf[offset + i] ^ mask[i % 4];
        return data.toString('utf8');
    }
    return buf.slice(offset, offset + len).toString('utf8');
}

let   lastHtml    = null;
const phones      = new Set();
let   extSocket   = null;

function notifyPhoneCount() {
    if (extSocket) {
        try { sendWS(extSocket, JSON.stringify({ type: 'phone_count', count: phones.size })); } catch {}
    }
}

const SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>LOCANEX</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%;background:#080b12;font-family:system-ui,-apple-system,sans-serif;color:#4a5a72}
#root{height:100%;overflow-y:auto}
#waiting{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;padding:24px}
.w-brand{font-size:18px;font-weight:600;letter-spacing:4.5px;text-transform:uppercase;color:#fff;margin-bottom:4px}
.w-sub{font-size:11px;color:#2a3a52;text-align:center;letter-spacing:.3px;line-height:1.5;max-width:260px}
</style>
</head>
<body>
<div id="root">
  <div id="waiting">
    <div class="w-brand">LOCANEX</div>
    <div class="w-sub">Connected to relay<br>Waiting for game data</div>
  </div>
</div>
<script>
(function(){
  var ws, delay=1000;
  function connect(){
    ws=new WebSocket('ws://'+location.host);
    ws.onopen=function(){delay=1000;};
    ws.onmessage=function(e){
      try{var m=JSON.parse(e.data);if(m.type==='render'&&m.html)render(m.html);}catch(err){}
    };
    ws.onclose=function(){setTimeout(connect,delay);delay=Math.min(delay*1.5,8000);};
    ws.onerror=function(){try{ws.close();}catch{}};
  }
  function render(html){
    var root=document.getElementById('root');
    var parser=new DOMParser();
    var doc=parser.parseFromString(html,'text/html');
    doc.head.querySelectorAll('style').forEach(function(s){
      if(!document.querySelector('head style[data-ov]')){
        var el=document.createElement('style');el.setAttribute('data-ov','1');
        el.textContent=s.textContent;document.head.appendChild(el);}
    });
    doc.head.querySelectorAll('link[rel="stylesheet"]').forEach(function(l){
      var href=l.getAttribute('href');
      if(!document.querySelector('head link[href="'+href+'"]')){
        var el=document.createElement('link');el.rel='stylesheet';el.href=href;
        document.head.appendChild(el);}
    });
    root.innerHTML=doc.body.innerHTML;
    var scripts=[];
    doc.querySelectorAll('script').forEach(function(s){scripts.push({src:s.getAttribute('src'),inline:s.textContent});});
    function next(i){
      if(i>=scripts.length)return;
      var item=scripts[i],el=document.createElement('script');
      if(item.src){el.src=item.src;el.onload=function(){next(i+1);};el.onerror=function(){next(i+1);};document.body.appendChild(el);}
      else if(item.inline){el.textContent=item.inline;document.body.appendChild(el);next(i+1);}
      else next(i+1);
    }
    next(0);
  }
  connect();
})();
</script>
</body>
</html>`;

const fs   = require('fs');
const path = require('path');

const STATIC_EXT = {
    '.js':  'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/qr.svg') {
        var iface = 'http://' + getLocalIP() + ':' + PORT;
        var qrSvg = generateQRSvg(iface);
        res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' });
        res.end(qrSvg);
        return;
    }

    if (url === '/leaflet.js' || url === '/leaflet.css' || url === '/panel-render.js') {
        const filePath = path.join(__dirname, url);
        try {
            const data = fs.readFileSync(filePath);
            const ext  = path.extname(url);
            res.writeHead(200, { 'Content-Type': STATIC_EXT[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
            res.end(data);
        } catch (e) {
            res.writeHead(404); res.end('Not found');
        }
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(SHELL);
});

server.on('upgrade', (req, socket) => {
    if (!req.headers['sec-websocket-key']) { socket.destroy(); return; }
    doHandshake(req, socket);

    if (req.url === '/ws') {

        if (extSocket) { try { extSocket.destroy(); } catch {} }
        extSocket = socket;
        notifyPhoneCount();

        let buf = Buffer.alloc(0);
        socket.on('data', (chunk) => {
            buf = Buffer.concat([buf, chunk]);
            const text = decodeFrame(buf);
            if (text === null) return;
            buf = Buffer.alloc(0);
            try {
                const msg = JSON.parse(text);
                if (msg.type === 'render' && msg.html) {
                    lastHtml = msg.html;
                    const packet = wsFrame(JSON.stringify({ type: 'render', html: lastHtml }));
                    phones.forEach(s => { try { s.write(packet); } catch {} });
                }
            } catch {}
        });

        socket.on('close',   () => { extSocket = null; });
        socket.on('error',   () => { extSocket = null; });

    } else {

        phones.add(socket);
        clearAndRedraw();
        notifyPhoneCount();

        if (lastHtml) sendWS(socket, JSON.stringify({ type: 'render', html: lastHtml }));

        socket.on('close', () => {
            phones.delete(socket);
            clearAndRedraw();
            notifyPhoneCount();
        });
        socket.on('error', () => phones.delete(socket));
    }
});

const PORT = 3000;

let _scrambled = false;
let _ifaceUrl = '';
let _localUrl = '';
let _pulseOn = true;
const glitchChars = '═╪╬╦╩║╠╣┼┬┴├┤▼▲◆◇□■●○☆★♦♣♠•·';

function getSignal() { return phones.size > 0 ? ' ·' : ''; }

function printRunning() {
    const dot = _pulseOn ? '◉' : '◌';
    process.stdout.write('\r▌ ' + dot + ' RUNNING' + getSignal() + '  ');
}

function scrambleUrls() {
    _scrambled = true;
    console.clear();
    _pulseOn = true;
    printRunning();
}

function clearAndRedraw() {
    console.clear();
    if (_scrambled) {
        _pulseOn = true;
        printRunning();
    } else {
        process.stdout.write('▌ iface: ' + _ifaceUrl + '\n');
        process.stdout.write('▌ local: ' + _localUrl + '\n');
        process.stdout.write('▌──────────────────────────────\n');
        _pulseOn = true;
        printRunning();
    }
}

function boot() {
    const ip = getLocalIP();
    _ifaceUrl = 'http://' + ip + ':' + PORT;
    _localUrl = 'http://localhost:' + PORT;

    console.clear();

    let step = 0;
    const total = 30;

    const loadInterval = setInterval(() => {
        step++;
        const pct = Math.min(Math.round((step / total) * 100), 100);
        const filled = Math.round((step / total) * 20);
        const empty = 20 - filled;
        const bar = '█'.repeat(filled) + '░'.repeat(empty);
        process.stdout.write('\r  BOOT  ' + bar + '  ' + String(pct).padStart(3) + '%  ');
        if (step >= total) {
            clearInterval(loadInterval);
            setTimeout(phase2, 200);
        }
    }, 30);

    function phase2() {
        const final = [
            '▌ iface: ' + _ifaceUrl,
            '▌ local: ' + _localUrl,
            '▌──────────────────────────────',
            '▌ ◉ RUNNING'
        ];

        const frame1 = final.map(l => {
            let g = '';
            for (let i = 0; i < l.length; i++) {
                g += Math.random() > 0.6 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : l[i];
            }
            return g;
        });

        const frame2 = final.map(l => {
            let g = '';
            for (let i = 0; i < l.length; i++) {
                g += Math.random() > 0.85 ? glitchChars[Math.floor(Math.random() * glitchChars.length)] : l[i];
            }
            return g;
        });

        console.clear();
        frame1.forEach(l => process.stdout.write(l + '\n'));
        setTimeout(() => {
            console.clear();
            frame2.forEach(l => process.stdout.write(l + '\n'));
        }, 80);
        setTimeout(() => {
            console.clear();
            final.forEach(l => process.stdout.write(l + '\n'));
            showQRCode();
            phase3();
            setTimeout(scrambleUrls, 120000);
        }, 200);
    }

    async function showQRCode() {
        try {
            const qr = await QRCode.toString(_ifaceUrl, { type: 'terminal', small: true });
            process.stdout.write('\n  ▌ Scan on your phone:\n\n');
            process.stdout.write(qr + '\n');
        } catch {}
    }

    function phase3() {
        setInterval(() => {
            _pulseOn = !_pulseOn;
            printRunning();
        }, 300);
    }
}

server.listen(PORT, '0.0.0.0', () => {
    boot();
});
