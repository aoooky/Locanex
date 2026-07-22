var togPc     = document.getElementById('togPc');
var togMobile = document.getElementById('togMobile');
var urlField  = document.getElementById('serverUrl');
var dot       = document.getElementById('dot');
var statusTxt = document.getElementById('statusText');
var toast     = document.getElementById('toast');
var qrSection = document.getElementById('qrSection');
var qrImg     = document.getElementById('qrCode');
var qrLabel   = document.getElementById('qrLabel');

function setStatus(connected) {
    dot.className = 'dot ' + (connected ? 'on' : 'off');
    statusTxt.textContent = connected ? 'Connected to server' : 'Server not reachable — run server.js';
}

function updateQR(settings, wsConnected) {
    if (settings.mobileRelay && wsConnected) {
        qrSection.style.display = '';
        var httpUrl = settings.serverUrl.replace(/^ws:\/\//, 'http://').replace(/\/ws$/, '') + '/qr.svg';
        qrImg.src = httpUrl;
        qrImg.style.display = '';
        qrLabel.textContent = settings.phoneConnected
            ? 'Phone connected — relay active'
            : 'Scan this QR with your phone to connect';
    } else {
        qrSection.style.display = 'none';
    }
}

chrome.runtime.sendMessage({ type: 'get_settings' }, function(s) {
    togPc.checked     = !!s.pcPopup;
    togMobile.checked = !!s.mobileRelay;
    urlField.value    = (s.serverUrl || 'ws://localhost:3000').replace(/\/ws$/, '');
    setStatus(!!s.wsConnected);
    updateQR(s, !!s.wsConnected);
});

chrome.runtime.onMessage.addListener(function(msg) {
    if (msg.type === 'ws_status_update') {
        setStatus(!!msg.wsConnected);
        chrome.runtime.sendMessage({ type: 'get_settings' }, function(s) {
            updateQR(s, !!msg.wsConnected);
        });
    }
});

document.getElementById('btnSave').addEventListener('click', function() {
    var url = urlField.value.trim() || 'ws://localhost:3000';
    url = url.replace(/^http:\/\//, 'ws://').replace(/\/ws$/, '').replace(/\/$/, '');
    chrome.runtime.sendMessage({
        type: 'save_settings',
        settings: { pcPopup: togPc.checked, mobileRelay: togMobile.checked, serverUrl: url }
    }, function() {
        toast.textContent = 'Saved';
        toast.style.opacity = '1';
        setTimeout(function() { toast.style.opacity = '0'; }, 1500);
    });
});
