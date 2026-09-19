// 剪报拼贴诗 - SillyTavern Extension

jQuery(async () => {

    if (!window.html2canvas) {
        await new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            try { s.src = new URL('./lib/html2canvas.min.js', import.meta.url).href; }
            catch(e) { s.src = '/scripts/extensions/third-party/st-blackout-poetry/lib/html2canvas.min.js'; }
            s.onload = resolve;
            s.onerror = function() {
                var s2 = document.createElement('script');
                s2.src = 'https://cdn.staticfile.org/html2canvas/1.4.1/html2canvas.min.js';
                s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2);
            };
            document.head.appendChild(s);
        });
    }

    var FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;600&display=swap';
    var fl = document.createElement('link'); fl.href = FONT_HREF; fl.rel = 'stylesheet'; document.head.appendChild(fl);

    var customFonts = [];
    var BP_DB_NAME = 'bp-blackout-poetry', BP_DB_STORE = 'appdata', BP_DB_VERSION = 1;
    function openBpDB(){ return new Promise(function(resolve,reject){ var req=indexedDB.open(BP_DB_NAME,BP_DB_VERSION); req.onupgradeneeded=function(e){ var db=e.target.result; if(!db.objectStoreNames.contains(BP_DB_STORE))db.createObjectStore(BP_DB_STORE); }; req.onsuccess=function(e){resolve(e.target.result);}; req.onerror=function(e){reject(e.target.error);}; }); }
    function saveCustomFontsToStorage(){ openBpDB().then(function(db){ var tx=db.transaction(BP_DB_STORE,'readwrite'); tx.objectStore(BP_DB_STORE).put(customFonts,'customFonts'); }).catch(function(e){}); }
    function loadCustomFontsFromStorage(){ return openBpDB().then(function(db){ return new Promise(function(resolve){ var tx=db.transaction(BP_DB_STORE,'readonly'); var req=tx.objectStore(BP_DB_STORE).get('customFonts'); req.onsuccess=function(e){ if(Array.isArray(e.target.result))customFonts=e.target.result; resolve(); }; req.onerror=function(){resolve();}; }); }).catch(function(){}); }
    await loadCustomFontsFromStorage();
    function injectCustomFonts(){ var el=document.getElementById('bp-custom-fonts'); if(!el){el=document.createElement('style');el.id='bp-custom-fonts';document.head.appendChild(el);} el.textContent=customFonts.map(function(f){return f.rule;}).join('\n'); }
    injectCustomFonts();

    var BP_BUBBLE_KEY = 'bp-show-bubble';
    var BP_BUBBLE_POS_KEY = 'bp-bubble-pos';
    var showBubble = localStorage.getItem(BP_BUBBLE_KEY) !== 'false';
    var bubblePos = null;
    try { bubblePos = JSON.parse(localStorage.getItem(BP_BUBBLE_POS_KEY)); } catch(e){}

    var currentCutShape = 'default';
    var syncShapeToScrap = false;
    var customSymbol = '';
    var customShapeDataUrl = null;
    var scrapSize = 28;

    var SHAPE_CLIPS = {
        'default': '',
        'square': 'inset(0)',
        'circle': 'circle(50% at 50% 50%)',
        'star5': 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
        'star4': 'polygon(50% 0%,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0% 50%,38% 38%)',
        'star8': 'polygon(50% 0%,57% 28%,79% 10%,72% 37%,100% 37%,78% 50%,100% 63%,72% 63%,79% 90%,57% 72%,50% 100%,43% 72%,21% 90%,28% 63%,0% 63%,22% 50%,0% 37%,28% 37%,21% 10%,43% 28%)',
        'raindrop': 'polygon(50% 0%,57% 12%,70% 32%,82% 52%,85% 62%,85% 72%,80% 82%,70% 92%,58% 98%,50% 100%,42% 98%,30% 92%,20% 82%,15% 72%,15% 62%,18% 52%,30% 32%,43% 12%)'
    };
    var PUZZLE_VARIANTS = [
        'polygon(0% 0%,100% 0%,100% 40%,92% 40%,88% 45%,88% 55%,92% 60%,100% 60%,100% 100%,60% 100%,60% 92%,55% 88%,45% 88%,40% 92%,40% 100%,0% 100%,0% 0%)',
        'polygon(0% 0%,40% 0%,40% 8%,45% 12%,55% 12%,60% 8%,60% 0%,100% 0%,100% 100%,60% 100%,60% 92%,55% 88%,45% 88%,40% 92%,40% 100%,0% 100%,0% 0%)',
        'polygon(0% 0%,100% 0%,100% 100%,60% 100%,60% 92%,65% 88%,65% 80%,60% 76%,40% 76%,35% 80%,35% 88%,40% 92%,40% 100%,0% 100%,0% 60%,8% 60%,12% 55%,12% 45%,8% 40%,0% 40%)',
        'polygon(0% 0%,40% 0%,40% 8%,45% 12%,55% 12%,60% 8%,60% 0%,100% 0%,100% 40%,92% 40%,88% 45%,88% 55%,92% 60%,100% 60%,100% 100%,0% 100%,0% 0%)'
    ];
    function getRandomPuzzleClip(){ return PUZZLE_VARIANTS[Math.floor(Math.random()*PUZZLE_VARIANTS.length)]; }
    function getClipForShape(shape){ if(shape==='puzzle') return getRandomPuzzleClip(); return SHAPE_CLIPS[shape]||''; }

    var SHAPE_SVGS = {
        'default': '<svg viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" rx="1" fill="#333"/></svg>',
        'square': '<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="#333"/></svg>',
        'circle': '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#333"/></svg>',
        'star5': '<svg viewBox="0 0 16 16"><polygon points="8,1 10,6 15.5,6 11,9.5 12.5,158,11.5 3.5,15 5,9.5 0.5,6 6,6" fill="#333"/></svg>',
        'star4': '<svg viewBox="0 0 16 16"><polygon points="8,0 10,6 16,8 10,10 8,16 6,10 0,8 6,6" fill="#333"/></svg>',
        'star8': '<svg viewBox="0 0 16 16"><polygon points="8,0 9.2,4.5 12.6,1.6 11.5,6.2 16,612.4,816,1011.5,9.8 12.6,14.4 9.2,11.5 8,16 6.8,11.5 3.4,14.4 4.5,9.8 0,10 3.6,8 0,64.5,6.2 3.4,1.6 6.8,4.5" fill="#333"/></svg>',
        'raindrop': '<svg viewBox="0 0 16 16"><path d="M8,1 C8,1 13.5,7.5 13.5,10.5 C13.5,13.5 11,16 8,16 C5,16 2.5,13.5 2.5,10.5 C2.5,7.5 8,1 8,1Z" fill="#333"/></svg>',
        'puzzle': '<svg viewBox="0 0 16 16"><path d="M1,1 H6 V3.5 Q5,3.5 5,5 Q5,6.5 6,6.5 V10H1Z M7,1 H11 V3 Q12,3 12,4.5 Q12,6 11,6 V10 H7 V6.5 Q8,6.5 8,5 Q8,3.5 7,3.5Z" fill="#333"/></svg>',
        'symbol': '<svg viewBox="0 0 16 16"><text x="8" y="12" text-anchor="middle" font-size="12" font-weight="bold" fill="#333">A</text></svg>',
        'image': '<svg viewBox="0 0 16 16"><rect x="1" y="3" width="14" height="10" rx="1" fill="none" stroke="#333" stroke-width="1.2"/><circle cx="5" cy="7" r="1.5" fill="#333"/><polyline points="1,13 6,8 9,1111,915,13" fill="none" stroke="#333" stroke-width="1"/></svg>'
    };

    var defaultText = "我们讨论爱就像讨论牡蛎：盲目，伪装，愚钝，嫉羡，隐于黑暗、不为人道的部分，才是让爱成为爱本身的东西。爱之于你我，就像泥沙之于牡蛎，痛苦忍耐，最后流出几滴眼泪。有人说，咦，原来你有这么多珍珠呀。";

    var CSS_TEXT = `
#bp-app-container {
    --page-bg:#F5F5F7; --top-bg:#FFFFFF; --top-bg-img:none; --top-cut-color:rgba(0,0,0,0.06);
    --top-font-size:14.5px; --top-grain-opacity:0; --top-font-family:'Noto Serif SC',serif;
    --bottom-bg:#111111; --bottom-bg-img:none; --scrap-bg:#FFFFFF;
    --scrap-font-size:14.5px; --bottom-grain-opacity:0; --scrap-font-family:'Noto Serif SC',serif;
    --shared-text-color:#1A1A1A; --scrap-text-color:#1A1A1A;
    --scrap-w:26px; --scrap-h:30px;
    --wm-color:var(--shared-text-color);
    position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:var(--page-bg);
    z-index:999999; display:none; justify-content:center; align-items:center; overflow:auto; padding:60px 20px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
}
#bp-app-container, #bp-app-container *, #bp-app-container *::before, #bp-app-container *::after { box-sizing:border-box; margin:0; padding:0; user-select:none; -webkit-user-select:none; }
#bp-app-container input[type="file"], #bp-app-container input[type="color"], #bp-app-container input[type="text"], #bp-app-container input[type="checkbox"], #bp-app-container input[type="range"], #bp-app-container select, #bp-app-container textarea { user-select:auto !important; -webkit-user-select:auto !important; pointer-events:auto !important; -webkit-tap-highlight-color:transparent; }
#bp-app-container #top-left-bar { position:fixed; top:calc(env(safe-area-inset-top, 0px) + 14px); left:14px; display:flex; align-items:center; gap:6px; z-index:2005; }
#bp-app-container #top-right-bar { position:fixed; top:calc(env(safe-area-inset-top, 0px) + 14px); right:14px; display:flex; align-items:center; gap:6px; z-index:2005; }
#bp-app-container .icon-btn { width:34px; height:34px; display:flex; justify-content:center; align-items:center; cursor:pointer; background:rgba(255,255,255,0.92); border:1px solid rgba(0,0,0,0.08); border-radius:4px; backdrop-filter:blur(8px); box-shadow:0 4px 15px rgba(0,0,0,0.04); transition:all 0.2s ease; }
#bp-app-container .icon-btn:hover { background:#FFF; border-color:#000; }
#bp-app-container .icon-btn svg { width:16px; height:16px; stroke:#1C1C1C; stroke-width:1.6; fill:none; }
#bp-app-container #menu-trigger .bar { width:14px; height:1.5px; background-color:#1C1C1C; }
#bp-app-container #common-mask { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.18); z-index:1998; display:none; opacity:0; transition:opacity 0.25s ease; }
#bp-app-container #common-mask.visible { display:block; opacity:1; }
#bp-app-container #drawer { position:fixed; top:0; left:-370px; width:350px; height:100vh; background:rgba(255,255,255,0.98); border-right:1px solid rgba(0,0,0,0.08); backdrop-filter:blur(20px); box-shadow:10px 0 35px rgba(0,0,0,0.04); z-index:1999; display:flex; flex-direction:column; padding:75px 20px 30px 20px; overflow-y:auto; transition:left 0.3s cubic-bezier(0.22,1,0.36,1); color:#222; font-size:11.5px; }
#bp-app-container #drawer.open { left:0; }
#bp-app-container #settings-drawer { position:fixed; top:0; right:-370px; width:340px; height:100vh; background:rgba(255,255,255,0.98); border-left:1px solid rgba(0,0,0,0.08); backdrop-filter:blur(20px); box-shadow:-10px 0 35px rgba(0,0,0,0.04); z-index:1999; display:flex; flex-direction:column; padding:75px 20px 30px 20px; overflow-y:auto; transition:right 0.3s cubic-bezier(0.22,1,0.36,1); color:#222; font-size:11.5px; }
#bp-app-container #settings-drawer.open { right:0; }
#bp-app-container .drawer-section { margin-bottom:18px; border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:14px; }
#bp-app-container .drawer-section:last-child { border-bottom:none; }
#bp-app-container .section-title { font-size:9.5px; letter-spacing:0.1em; color:#888; margin-bottom:8px; font-weight:600; text-transform:uppercase; }
#bp-app-container .color-group-label { font-size:9px; color:#999; margin:4px 0 2px 0; }
#bp-app-container .color-palette-row { display:grid; grid-template-columns:repeat(6,1fr); gap:4px; margin-bottom:5px; }
#bp-app-container .color-dot { height:20px; border-radius:2px; border:1px solid rgba(0,0,0,0.1); cursor:pointer; transition:transform 0.15s; }
#bp-app-container .color-dot:hover { transform:scale(1.1); z-index:2; }
#bp-app-container .color-picker-wrapper { display:flex; align-items:center; gap:6px; margin:4px 0 8px 0; background:#F4F4F4; padding:4px 8px; border-radius:2px; }
#bp-app-container .color-picker-input { width:22px; height:22px; border:none; padding:0; cursor:pointer; background:none; }
#bp-app-container .grid-buttons { display:grid; grid-template-columns:repeat(3,1fr); gap:4px; margin-bottom:6px; }
#bp-app-container .action-chip { background:#F4F4F4; border:1px solid rgba(0,0,0,0.05); color:#333; padding:6px 0; text-align:center; border-radius:2px; cursor:pointer; font-size:10px; transition:all 0.15s; }
#bp-app-container .action-chip:hover, #bp-app-container .action-chip.active { background:#1C1C1C; color:#FFF; }
#bp-app-container label.file-label { display:block; cursor:pointer; -webkit-tap-highlight-color:transparent; }
#bp-app-container label.file-label input[type="file"] { display:none; }
#bp-app-container .slider-row { display:flex; align-items:center; justify-content:space-between; margin-top:6px; }
#bp-app-container .slider-row span { color:#777; font-size:9.5px; }
#bp-app-container .slider-row input[type="range"] { width:130px; accent-color:#000; }
#bp-app-container .slider-val { min-width:30px; text-align:right; font-size:9px; color:#999; }
#bp-app-container .sub-panel-box { background:#FBFBFB; border:1px solid #EBEBEB; border-radius:4px; padding:10px; margin-top:8px; }
#bp-app-container .sub-panel-title { font-size:10px; font-weight:600; color:#1C1C1C; margin-bottom:6px; display:flex; justify-content:space-between; }
#bp-app-container .font-compact-list { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; max-height:110px; overflow-y:auto; }
#bp-app-container .font-compact-item { display:flex; align-items:center; justify-content:space-between; background:#FFF; border:1px solid #E5E5E5; border-radius:2px; padding:4px 8px; cursor:pointer; transition:all 0.15s ease; }
#bp-app-container .font-compact-item:hover { border-color:#1C1C1C; }
#bp-app-container .font-compact-item.selected { border-color:#1C1C1C; background:#F0F0F0; font-weight:600; }
#bp-app-container .font-name-col { font-size:10px; color:#444; }
#bp-app-container .setting-field { margin-bottom:12px; }
#bp-app-container .setting-input { width:100%; background:#F7F7F7; border:1px solid #E5E5E5; padding:6px 8px; font-size:11px; border-radius:2px; outline:none; color:#111; }
#bp-app-container .setting-toggle-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
#bp-app-container .icon-preview-row { display:flex; align-items:center; justify-content:space-between; background:#F7F7F7; border:1px solid #E5E5E5; padding:6px 10px; border-radius:2px; margin-top:6px; }
#bp-app-container .icon-preview-box { width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:#FFF; border:1px solid #DDD; border-radius:50%; overflow:hidden; }
#bp-app-container .icon-preview-box img { width:18px; height:18px; object-fit:cover; border-radius:50%; }
#bp-app-container #poster-canvas { box-shadow:0 12px 45px rgba(0,0,0,0.08); position:relative; display:flex; flex-direction:column; border:1px solid rgba(0,0,0,0.06); touch-action:none; width:440px; }
#bp-app-container #poster-canvas.layout-horizontal { flex-direction:row !important; width:auto !important; }
#bp-app-container #source-area { background-color:var(--top-bg); background-image:var(--top-bg-img); background-size:cover; background-position:center; padding:40px 36px 30px 36px; position:relative; flex-shrink:0; height:auto; font-family:var(--top-font-family); }
#bp-app-container #poster-canvas.layout-horizontal #source-area { width:360px; }
#bp-app-container .text-flow { color:var(--shared-text-color); font-size:var(--top-font-size); line-height:2.2; letter-spacing:0.06em; text-align:justify; word-break:break-all; }
#bp-app-container .char-node { cursor:pointer; position:relative; display:inline-block; transition:transform 0.1s ease; }
#bp-app-container .char-node:hover:not(.is-cut) { opacity:0.5; }
#bp-app-container .char-node.is-cut { color:transparent !important; }
#bp-app-container .char-node.is-cut::after { content:""; position:absolute; top:50%; left:50%; width:var(--scrap-w); height:var(--scrap-h); transform:translate(-50%,-50%); background-color:var(--top-cut-color); border-radius:1px; box-shadow:inset 0 0 1px rgba(0,0,0,0.15); }
#bp-app-container .char-node.is-cut.shape-symbol::after { content:attr(data-symbol); background:transparent !important; box-shadow:none !important; display:flex; align-items:center; justify-content:center; color:var(--top-cut-color); font-size:0.85em; opacity:0.7; border-radius:0; }
#bp-app-container #collage-area { position:relative; background-color:var(--bottom-bg); background-image:var(--bottom-bg-img); background-size:cover; background-position:center; border-top:1px solid rgba(0,0,0,0.04); flex-shrink:0; min-height:180px; min-width:180px; overflow:hidden; font-family:var(--scrap-font-family); padding-bottom:35px; }
#bp-app-container #poster-canvas.layout-horizontal #collage-area { border-top:none; border-left:1px solid rgba(0,0,0,0.04); }
#bp-app-container #poster-canvas.swapped #source-area { order:2; }
#bp-app-container #poster-canvas.swapped #collage-area { order:1; }
#bp-app-container #collage-resizer { position:absolute; z-index:1000; display:flex; align-items:center; justify-content:center; }
#bp-app-container #poster-canvas:not(.layout-horizontal) #collage-resizer { bottom:0; left:0; width:100%; height:12px; cursor:ns-resize; }
#bp-app-container #poster-canvas:not(.layout-horizontal) #collage-resizer::after { content:""; width:32px; height:3px; background:rgba(0,0,0,0.2); border-radius:2px; }
#bp-app-container #poster-canvas.layout-horizontal #collage-resizer { right:0; top:0; width:12px; height:100%; cursor:ew-resize; }
#bp-app-container #poster-canvas.layout-horizontal #collage-resizer::after { content:""; width:3px; height:32px; background:rgba(0,0,0,0.2); border-radius:2px; }
#bp-app-container .scrap-word { position:absolute; background-color:var(--scrap-bg); color:var(--scrap-text-color); padding:0; font-size:var(--scrap-font-size); line-height:var(--scrap-h); border-radius:1px; cursor:grab; box-shadow:1px 2px 5px rgba(0,0,0,0.15); font-family:inherit; touch-action:none; z-index:10; display:inline-flex; justify-content:center; align-items:center; width:var(--scrap-w); height:var(--scrap-h); text-align:center; }
#bp-app-container .scrap-word:active { cursor:grabbing; box-shadow:2px 6px 14px rgba(0,0,0,0.25); z-index:100; }
#bp-app-container .texture-layer { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; mix-blend-mode:overlay; z-index:800; }
#bp-app-container #top-texture { opacity:var(--top-grain-opacity); }
#bp-app-container #bottom-texture { opacity:var(--bottom-grain-opacity); }
#bp-app-container #poster-bottom-meta { position:absolute; bottom:12px; left:0; width:100%; display:flex; justify-content:center; align-items:center; gap:8px; font-size:8.5px; letter-spacing:0.1em; color:var(--wm-color); opacity:0.45; pointer-events:none; }
#bp-app-container #bottom-icon-slot { display:inline-flex; align-items:center; justify-content:center; }
#bp-app-container #bottom-icon-slot img { width:11px; height:11px; object-fit:cover; vertical-align:middle; border-radius:50%; }
#bp-app-container .bp-float-panel { position:fixed; top:calc(env(safe-area-inset-top, 0px) + 52px); left:14px; width:220px; background:rgba(255,255,255,0.98); border:1px solid rgba(0,0,0,0.08); border-radius:6px; backdrop-filter:blur(20px); box-shadow:0 8px 30px rgba(0,0,0,0.08); z-index:2006; padding:10px; display:none; color:#222; font-size:11px; }
#bp-app-container .bp-float-panel.open { display:block; }
#bp-app-container .shape-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:8px; }
#bp-app-container .shape-item { width:100%; aspect-ratio:1; background:#F4F4F4; border:1.5px solid transparent; border-radius:4px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; transition:all 0.15s; }
#bp-app-container .shape-item:hover { border-color:#999; }
#bp-app-container .shape-item.active { border-color:#1C1C1C; background:#E8E8E8; }
#bp-app-container .shape-item svg { width:16px; height:16px; fill:#333; stroke:none; }
#bp-app-container .shape-item .shape-label { font-size:7px; color:#888; line-height:1; }
#bp-app-container .shape-extra { border-top:1px solid rgba(0,0,0,0.06); padding-top:8px; margin-top:4px; }
#bp-app-container .shape-extra .setting-toggle-row { font-size:10px; }
#bp-app-container .layout-grid { display:flex; gap:6px; }
#bp-app-container .layout-grid .action-chip { flex:1; padding:8px 4px; font-size:10px; }
#bp-bubble-btn { position:fixed; background:transparent; border:none; box-shadow:none; z-index:9990; display:flex; justify-content:center; align-items:center; cursor:pointer; font-size:26px; line-height:1; padding:0; opacity:0.85; -webkit-tap-highlight-color:transparent; touch-action:none; }
#bp-bubble-btn:active { opacity:1; }
#bp-sel-popup { position:fixed; bottom:90px; left:50%; transform:translateX(-50%); z-index:99999; background:rgba(28,28,28,0.92); color:#fff; padding:8px 16px; border-radius:20px; box-shadow:0 4px 12px rgba(0,0,0,0.2); font-size:12px; display:none; align-items:center; gap:6px; cursor:pointer; backdrop-filter:blur(6px); }
#bp-cssfont-mask { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.6); z-index:2147483000; display:none; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
#bp-cssfont-box { background:#fff; border-radius:10px; padding:18px; max-width:480px; width:100%; box-sizing:border-box; }
#bp-cssfont-box textarea { -webkit-user-select:auto; user-select:auto; }`;var css = document.createElement('style'); css.textContent = CSS_TEXT; document.head.appendChild(css);var dynStyle = document.createElement('style');
    dynStyle.textContent = '#bp-app-container .char-node.is-cut:not(.shape-symbol):not(.shape-image)::after { clip-path: var(--cut-clip, none); -webkit-clip-path: var(--cut-clip, none); }';
    document.head.appendChild(dynStyle);
