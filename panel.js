var port;

function connect() {
    port = chrome.runtime.connect({ name: 'panel' });

    port.onMessage.addListener(function(msg) {
        if (msg.type === 'render' && msg.html) {
            renderHTML(msg.html);
        }
    });

    port.onDisconnect.addListener(function() {
        port = null;
        setTimeout(connect, 1000);
    });
}

connect();

function createSettingsBtn() {
    var btn = document.createElement('button');
    btn.id = 'settings-btn';
    btn.title = 'Settings';
    btn.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>';
    btn.onclick = function() {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    };
    return btn;
}

function renderHTML(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');

    document.head.innerHTML = '';

    doc.head.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
        var l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = link.getAttribute('href');
        document.head.appendChild(l);
    });
    doc.head.querySelectorAll('style').forEach(function(style) {
        var s = document.createElement('style');
        s.textContent = style.textContent;
        document.head.appendChild(s);
    });

    document.body.innerHTML = doc.body.innerHTML;

    document.body.appendChild(createSettingsBtn());

    var sBtn = document.createElement('style');
    sBtn.textContent = '#settings-btn{position:fixed;top:10px;right:10px;z-index:9999;width:28px;height:28px;border-radius:6px;border:1px solid rgba(255,255,255,.08);background:rgba(13,17,23,.8);backdrop-filter:blur(4px);cursor:pointer;display:flex;align-items:center;justify-content:center;color:#4a5a72;transition:color .15s,border-color .15s,background .15s}#settings-btn:hover{color:#00d4aa;border-color:rgba(0,212,170,.25);background:rgba(0,212,170,.06)}#settings-btn svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5}';
    document.head.appendChild(sBtn);

    doc.body.querySelectorAll('link[rel="stylesheet"]').forEach(function(link) {
        var href = link.getAttribute('href');
        if (!document.querySelector('head link[href="' + href + '"]')) {
            var l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            document.head.appendChild(l);
        }
    });

    var scripts = [];
    doc.querySelectorAll('script[src]').forEach(function(s) {
        scripts.push(s.getAttribute('src'));
    });

    function loadAll(i) {
        if (i >= scripts.length) return;
        var s = document.createElement('script');
        s.src = scripts[i];
        s.onload = function() { loadAll(i + 1); };
        s.onerror = function() { loadAll(i + 1); };
        document.body.appendChild(s);
    }
    loadAll(0);
}
