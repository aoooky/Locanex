document.addEventListener('ov-render', function(e) {
    const html = e.detail;
    try {
        chrome.runtime.sendMessage({ type: 'render', html: html });
    } catch(err) {}
});
