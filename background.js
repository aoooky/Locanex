let panelWinId    = null;
let panelPort     = null;
let lastHtml      = '';
let isOpening     = false;
let phoneConnected = false;

let ws          = null;
let wsConnected = false;
let wsReconnectTimer = null;

let settings = {
    pcPopup:     true,
    mobileRelay: false,
    serverUrl:   'ws://localhost:3000'
};

chrome.storage.session.get(['lx_lastHtml', 'lx_panelWinId'], (res) => {
    if (res.lx_lastHtml) lastHtml = res.lx_lastHtml;
    if (res.lx_panelWinId != null) {
        panelWinId = res.lx_panelWinId;
        chrome.windows.get(panelWinId, (w) => {
            if (chrome.runtime.lastError || !w) { panelWinId = null; }
        });
    }
});

chrome.storage.local.get(['lx_settings'], (res) => {
    if (res.lx_settings) {
        settings.pcPopup     = res.lx_settings.pcPopup !== false;
        settings.mobileRelay = !!res.lx_settings.mobileRelay;
        settings.serverUrl   = res.lx_settings.serverUrl || 'ws://localhost:3000';
    }
    if (settings.mobileRelay) connectWS();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'render') {
        lastHtml = msg.html;
        chrome.storage.session.set({ lx_lastHtml: lastHtml });
        if (settings.mobileRelay) wsSend(lastHtml);
        if (settings.pcPopup && !phoneConnected) tryRender();
        sendResponse({ ok: true });
    }
    if (msg.type === 'get_settings') {
        sendResponse({ ...settings, wsConnected, phoneConnected });
    }
    if (msg.type === 'save_settings') {
        const wasRelay = settings.mobileRelay;
        settings = Object.assign(settings, msg.settings);
        chrome.storage.local.set({ lx_settings: settings });

        if (settings.mobileRelay && !wasRelay) {
            connectWS();
        } else if (!settings.mobileRelay && wasRelay) {
            disconnectWS();
        } else if (settings.mobileRelay) {

            disconnectWS();
            connectWS();
        }
        sendResponse({ ok: true });
    }
    if (msg.type === 'ws_status') {
        sendResponse({ wsConnected, phoneConnected });
    }
    return true;
});

function tryRender() {
    if (panelPort) {
        panelPort.postMessage({ type: 'render', html: lastHtml });
        return;
    }
    if (panelWinId !== null) {
        chrome.windows.get(panelWinId, (w) => {
            if (chrome.runtime.lastError || !w) {
                panelWinId = null;
                if (!isOpening) openPanel();
            }
        });
        return;
    }
    if (!isOpening) openPanel();
}

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'panel') {
        panelPort = port;
        if (lastHtml) {
            port.postMessage({ type: 'render', html: lastHtml });
        } else {
            chrome.storage.session.get('lx_lastHtml', (res) => {
                if (res.lx_lastHtml) port.postMessage({ type: 'render', html: res.lx_lastHtml });
            });
        }
        port.onDisconnect.addListener(() => { panelPort = null; });
    }
});

chrome.windows.onRemoved.addListener((winId) => {
    if (winId === panelWinId) { panelWinId = null; panelPort = null; isOpening = false; }
});

function openPanel() {
    if (isOpening) return;
    isOpening = true;
    chrome.windows.create({
        url: chrome.runtime.getURL('panel.html'),
        type: 'popup', width: 360, height: 780, focused: false
    }, (w) => {
        isOpening = false;
        if (w) {
            panelWinId = w.id;
            chrome.storage.session.set({ lx_panelWinId: panelWinId });
        }
    });
    setTimeout(function() { isOpening = false; }, 3000);
}

function getWsUrl() {

    return (settings.serverUrl || 'ws://localhost:3000')
        .replace(/^http:\/\//, 'ws://')
        .replace(/\/relay$/, '');
}

function connectWS() {
    if (ws) return;
    clearTimeout(wsReconnectTimer);
    try {
        ws = new WebSocket(getWsUrl() + '/ws');

        ws.onopen = () => {
            wsConnected = true;
            notifySettingsPage({ wsConnected: true });
            if (lastHtml) wsSend(lastHtml);
        };

        ws.onmessage = (e) => {
            try {
                var msg = JSON.parse(e.data);
                if (msg.type === 'phone_count') {
                    phoneConnected = msg.count > 0;
                    if (phoneConnected && panelWinId !== null) {
                        chrome.windows.remove(panelWinId);
                        panelWinId = null;
                        panelPort = null;
                        isOpening = false;
                    }
                    notifySettingsPage({ phoneConnected });
                }
            } catch {}
        };

        ws.onclose = () => {
            wsConnected = false;
            phoneConnected = false;
            ws = null;
            notifySettingsPage({ wsConnected: false, phoneConnected: false });
            if (settings.mobileRelay) {
                wsReconnectTimer = setTimeout(connectWS, 3000);
            }
        };

        ws.onerror = () => {
            ws && ws.close();
        };

    } catch(e) {
        ws = null;
        if (settings.mobileRelay) wsReconnectTimer = setTimeout(connectWS, 3000);
    }
}

function disconnectWS() {
    clearTimeout(wsReconnectTimer);
    if (ws) { try { ws.close(); } catch {} ws = null; }
    wsConnected = false;
    phoneConnected = false;
}

function wsSend(html) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {

        if (!ws) connectWS();
        return;
    }
    try {
        ws.send(JSON.stringify({ type: 'render', html }));
    } catch {}
}

function notifySettingsPage(data) {
    chrome.runtime.sendMessage({ type: 'ws_status_update', ...data }).catch(() => {});
}
