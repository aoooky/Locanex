(function(){
  var cfg;
  try { cfg = JSON.parse(document.getElementById('ov-data').textContent); } catch(e) { return; }

  var btnDec = document.getElementById('btnDec');
  var btnDms = document.getElementById('btnDms');
  var decView = document.getElementById('decView');
  var dmsView = document.getElementById('dmsView');
  if (btnDec && btnDms && decView && dmsView) {
    btnDec.onclick = function() {
      decView.style.display = 'block';
      dmsView.style.display = 'none';
      btnDec.classList.add('active');
      btnDms.classList.remove('active');
    };
    btnDms.onclick = function() {
      decView.style.display = 'none';
      dmsView.style.display = 'block';
      btnDms.classList.add('active');
      btnDec.classList.remove('active');
    };
  }

  function showToast(msg) {
    var t = document.getElementById('copyToast');
    if (!t) return;
    t.textContent = msg;
    t.style.opacity = '1';
    setTimeout(function(){ t.style.opacity = '0'; }, 1200);
  }
  document.querySelectorAll('.coord-cell[data-copy]').forEach(function(cell) {
    cell.onclick = function() {
      var val = cell.getAttribute('data-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(val);
      }
      showToast(cell.querySelector('.label').textContent.toUpperCase() + ' copied');
    };
  });

  document.querySelectorAll('.hist-item[data-lat]').forEach(function(item) {
    item.onclick = function() {
      var hlat = item.getAttribute('data-lat');
      var hlng = item.getAttribute('data-lng');
      window.open('https://maps.google.com/?q=' + hlat + ',' + hlng, '_blank');
    };
  });

  var btnCopy = document.getElementById('btnCopy');
  if (btnCopy) {
    btnCopy.onclick = function() {
      var latV = document.getElementById('latVal');
      var lngV = document.getElementById('lngVal');
      if (latV && lngV) {
        navigator.clipboard.writeText(latV.textContent + ', ' + lngV.textContent);
        btnCopy.classList.add('copied');
        btnCopy.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> COPIED';
        setTimeout(function(){ btnCopy.classList.remove('copied'); btnCopy.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> COPY'; }, 1500);
      }
    };
  }

  var btnDownload = document.getElementById('btnDownload');
  if (btnDownload) {
    btnDownload.onclick = function() {
      var obj = {lat:cfg.lat,lng:cfg.lng,city:cfg.city,state:cfg.state,country:cfg.country,country_code:cfg.country_code};
      var blob = new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'lx_' + cfg.lat + '_' + cfg.lng + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  }

  var btnShare = document.getElementById('btnShare');
  if (btnShare) {
    btnShare.onclick = function() {
      var url = 'https://maps.google.com/?q=' + cfg.lat + ',' + cfg.lng;
      if (navigator.share) {
        navigator.share({title:'LOCANEX Location',url:url});
      } else {
        navigator.clipboard.writeText(url);
        btnShare.classList.add('copied');
        btnShare.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg> COPIED';
        setTimeout(function(){ btnShare.classList.remove('copied'); btnShare.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> SHARE'; }, 1500);
      }
    };
  }

  var canvas = document.createElement('canvas');
  canvas.id = 'particles-canvas';
  canvas.width = 340;
  canvas.height = 760;
  document.body.prepend(canvas);
  var ctx = canvas.getContext('2d');
  var particles = [];
  for (var i = 0; i < 30; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      o: Math.random() * 0.5 + 0.1
    });
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,212,170,' + p.o + ')';
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();

  var gc = document.getElementById('globeCanvas');
  if (gc) {
    var gctx = gc.getContext('2d');
    var gcx = 50, gcy = 50, gr = 38;
    var rotLng = -cfg.lng * Math.PI / 180;
    var rotLat = cfg.lat * Math.PI / 180;
    function drawGlobe() {
      gctx.clearRect(0, 0, 100, 100);
      gctx.strokeStyle = 'rgba(255,255,255,.08)';
      gctx.lineWidth = 0.5;
      gctx.beginPath();
      gctx.arc(gcx, gcy, gr, 0, Math.PI * 2);
      gctx.stroke();
      for (var i = -60; i <= 60; i += 30) {
        var latR = i * Math.PI / 180;
        var rr = gr * Math.cos(latR);
        var yy = gcy - gr * Math.sin(latR);
        gctx.beginPath();
        gctx.ellipse(gcx, yy, Math.abs(rr), Math.abs(rr) * 0.35, 0, 0, Math.PI * 2);
        gctx.stroke();
      }
      for (var j = 0; j < 360; j += 30) {
        var lngR = (j * Math.PI / 180) + rotLng;
        gctx.beginPath();
        for (var k = -90; k <= 90; k += 5) {
          var latRad = k * Math.PI / 180;
          var x = gr * Math.cos(latRad) * Math.sin(lngR);
          var y = -gr * Math.sin(latRad);
          var z = gr * Math.cos(latRad) * Math.cos(lngR);
          var projX = gcx + x;
          var projY = gcy + y;
          if (z > 0) {
            if (k === -90) gctx.moveTo(projX, projY);
            else gctx.lineTo(projX, projY);
          } else {
            gctx.moveTo(projX, projY);
          }
        }
        gctx.stroke();
      }
      var px = gr * Math.cos(rotLat) * Math.sin(rotLng);
      var py = -gr * Math.sin(rotLat);
      var pz = gr * Math.cos(rotLat) * Math.cos(rotLng);
      if (pz > 0) {
        gctx.beginPath();
        gctx.arc(gcx + px, gcy + py, 3, 0, Math.PI * 2);
        gctx.fillStyle = '#00d4aa';
        gctx.fill();
        gctx.beginPath();
        gctx.arc(gcx + px, gcy + py, 6, 0, Math.PI * 2);
        gctx.strokeStyle = 'rgba(0,212,170,.4)';
        gctx.lineWidth = 1;
        gctx.stroke();
      }
    }
    drawGlobe();
  }

  if (cfg.hasMap && typeof L !== 'undefined' && cfg.lat != null && cfg.lng != null) {
    var mapEl = document.getElementById('radar-map');
    if (mapEl) {
      var map = window._ovMap;
      if (map && mapEl._leaflet_id) {
        map.setView([cfg.lat, cfg.lng], 3);
      } else {
        map = L.map('radar-map',{zoomControl:false,attributionControl:false,maxBounds:[[-85,-180],[85,180]],maxBoundsViscosity:1.0,worldCopyJump:false,minZoom:3}).setView([cfg.lat,cfg.lng],3);
        window._ovMap = map;
        var darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19});
        var colorPane = map.createPane('colorPane');
        colorPane.style.zIndex = '320';
        window._ovColorPane = colorPane;
        var opentoLayer = L.tileLayer('https://tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,pane:'colorPane'});
        window._ovOpentoLayer = opentoLayer;
        darkLayer.addTo(map);
        L.control.zoom({position:'topright'}).addTo(map);
        window._ovPulseIcon = L.divIcon({
          className:'',
          html:'<div style="position:relative;width:24px;height:24px"><div style="position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(255,255,255,.25);animation:markerPulse 2.5s ease-out infinite"></div><div style="position:absolute;top:6px;left:6px;width:12px;height:12px;background:#fff;border-radius:50%;box-shadow:0 0 8px rgba(255,255,255,.6),0 0 20px rgba(255,255,255,.2)"></div></div>',
          iconSize:[24,24],
          iconAnchor:[12,12]
        });
        window._ovPulseIconBlack = L.divIcon({
          className:'',
          html:'<div style="position:relative;width:24px;height:24px"><div style="position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(0,0,0,.4);animation:markerPulse 2.5s ease-out infinite"></div><div style="position:absolute;top:6px;left:6px;width:12px;height:12px;background:#fff;border-radius:50%;box-shadow:0 0 8px rgba(255,255,255,.6),0 0 20px rgba(255,255,255,.15)"></div></div>',
          iconSize:[24,24],
          iconAnchor:[12,12]
        });
        window._ovMarker = L.marker([cfg.lat,cfg.lng],{icon:window._ovPulseIcon}).addTo(map);
        window._ovIsTerrain = false;
        window._ovGeoLayer = null;
        map.on('moveend',function(){
          if (window._ovGeoLayer) map.redraw();
        });
        fetch('https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json')
          .then(function(r){return r.json()})
          .then(function(geo){
            window._ovGeoLayer = L.geoJSON(geo,{
              style:{color:'#00d4aa',weight:1,opacity:0,fillOpacity:0},
              onEachFeature:function(f,layer){
                layer.on('mouseover',function(){this.setStyle({weight:2,opacity:0.8});});
                layer.on('mouseout',function(){this.setStyle({weight:1,opacity:0});});
              }
            }).addTo(map);
          });
        var terrainBtn = document.createElement('button');
        terrainBtn.className = 'terrain-btn';
        terrainBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 21l4-10 4 10"/><path d="M2 21h20"/><path d="M12 3l-8 18"/><path d="M12 3l8 18"/></svg> TOPO';
        terrainBtn.onclick = function(){
          var overlay = document.getElementById('mapOverlay');
          window._ovIsTerrain = !window._ovIsTerrain;
          if (window._ovIsTerrain) {
            map.removeLayer(window._ovOpentoLayer);
            window._ovOpentoLayer.addTo(map);
            window._ovMarker.setIcon(window._ovPulseIconBlack);
            window._ovColorPane.style.mixBlendMode = '';
            window._ovColorPane.style.opacity = '1';
            window._ovColorPane.style.filter = '';
            terrainBtn.classList.add('active');
            overlay.classList.add('visible');
            if (window._ovGeoLayer) {
              window._ovGeoLayer.eachLayer(function(l){l.setStyle({color:'#00d4aa',weight:2,opacity:0.9});});
              window._ovGeoLayer.eachLayer(function(l){
                l.off('mouseover');
                l.off('mouseout');
                l.on('mouseover',function(){this.setStyle({weight:3,opacity:1,color:'#00d4aa'});});
                l.on('mouseout',function(){this.setStyle({weight:2,opacity:0.9,color:'#00d4aa'});});
              });
              window._ovGeoLayer.bringToFront();
            }
          } else {
            map.removeLayer(window._ovOpentoLayer);
            window._ovMarker.setIcon(window._ovPulseIcon);
            window._ovColorPane.style.filter = '';
            window._ovColorPane.style.opacity = '';
            window._ovColorPane.style.mixBlendMode = '';
            terrainBtn.classList.remove('active');
            overlay.classList.remove('visible');
            if (window._ovGeoLayer) {
              window._ovGeoLayer.eachLayer(function(l){l.setStyle({color:'#00d4aa',weight:1,opacity:0,fillOpacity:0});});
              window._ovGeoLayer.eachLayer(function(l){
                l.off('mouseover');
                l.off('mouseout');
                l.on('mouseover',function(){this.setStyle({weight:2,opacity:0.8});});
                l.on('mouseout',function(){this.setStyle({weight:1,opacity:0});});
              });
            }
          }
          setTimeout(function(){ map.invalidateSize(); }, 100);
          setTimeout(function(){ map.invalidateSize(); }, 300);
        };
        terrainBtn.style.position = 'absolute';
        terrainBtn.style.bottom = '8px';
        terrainBtn.style.left = '8px';
        terrainBtn.style.zIndex = '1000';
        mapEl.appendChild(terrainBtn);
      }
      if (window._ovMarker) {
        window._ovMarker.setLatLng([cfg.lat, cfg.lng]);
      }
      function fixMapSize(){ map.invalidateSize(); }
      setTimeout(fixMapSize, 50);
      setTimeout(fixMapSize, 200);
      setTimeout(fixMapSize, 600);
      setTimeout(fixMapSize, 1500);
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(fixMapSize).observe(mapEl);
      }
    }
  }
})();
