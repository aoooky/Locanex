
let lat = 999;
let long = 999;
let userLat = null;
let userLng = null;
let userGeolocated = false;

async function fetchAndInjectScript(url) {
    try {
        const response = await fetch(url);
        if (response.ok) {
            const scriptContent = await response.text();
            const scriptElement = document.createElement('script');
            scriptElement.textContent = scriptContent;
            (document.head || document.documentElement).appendChild(scriptElement);
            scriptElement.onload = function () { this.remove(); };
        }
    } catch (e) {}
}

const xhrUrl = chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('xhr_inject.js') : null;
if (xhrUrl) {
    fetchAndInjectScript(xhrUrl);
} else {
    fetchAndInjectScript('https://raw.githubusercontent.com/realapire/geoguessr-cheat/ui-fix/xhr_inject.js');
}

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        function(p) { userLat = p.coords.latitude; userLng = p.coords.longitude; userGeolocated = true; },
        function() {},
        { enableHighAccuracy: false, timeout: 5000 }
    );
}

function isDecimal(str) {
    str = String(str);
    return !isNaN(str) && str.includes('.') && !isNaN(parseFloat(str));
}

function haversine(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function countryToFlag(code) {
    if (!code || code.length !== 2) return '';
    var offset = 127397;
    return String.fromCodePoint(code.toUpperCase().charCodeAt(0) + offset, code.toUpperCase().charCodeAt(1) + offset);
}

function toDMS(decimal, isLat) {
    var dir = decimal >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
    var abs = Math.abs(decimal);
    var d = Math.floor(abs);
    var mFloat = (abs - d) * 60;
    var m = Math.floor(mFloat);
    var s = ((mFloat - m) * 60).toFixed(1);
    return d + '\u00B0' + m + '\u2032' + s + '\u2033' + ' ' + dir;
}

function playBeep() {
    try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        o.start(ctx.currentTime);
        o.stop(ctx.currentTime + 0.3);
    } catch(e) {}
}

function getHistory() {
    try { return JSON.parse(localStorage.getItem('lx_history') || '[]'); } catch { return []; }
}

function saveToHistory(data) {
    var h = getHistory();
    h.unshift({ lat: data.lat, lng: data.lng, city: data.city, country: data.country, country_code: data.country_code, ts: Date.now() });
    if (h.length > 5) h = h.slice(0, 5);
    try { localStorage.setItem('lx_history', JSON.stringify(h)); } catch {}
}

function getTimezone(lat, lng) {
    try {
        var now = new Date();
        var utcOffset = -now.getTimezoneOffset() / 60;
        var hourAngle = lng / 15;
        var tzOffset = Math.round(hourAngle);
        var diff = tzOffset - utcOffset;
        var local = new Date(now.getTime() + diff * 3600000);
        return {
            name: 'UTC' + (tzOffset >= 0 ? '+' : '') + tzOffset,
            time: local.toISOString().slice(11, 19)
        };
    } catch { return { name: '\u2014', time: '\u2014' }; }
}

var drivingSideData = {
    GB:'LHT',JP:'LHT',AU:'LHT',IN:'LHT',ZA:'LHT',TH:'LHT',ID:'LHT',
    MY:'LHT',SG:'LHT',HK:'LHT',NZ:'LHT',IE:'LHT',JM:'LHT',TT:'LHT',
    BS:'LHT',BB:'LHT',MU:'LHT',FJ:'LHT',SB:'LHT',LK:'LHT',PK:'LHT',
    BD:'LHT',KE:'LHT',TZ:'LHT',UG:'LHT',MW:'LHT',MG:'LHT',RE:'LHT',
    MT:'LHT',CY:'LHT',AL:'LHT',MD:'LHT',AZ:'LHT',GE:'LHT',KZ:'LHT',
    KG:'LHT',TJ:'LHT',TM:'LHT',BN:'LHT',TL:'LHT',WS:'LHT',TO:'LHT',
    VU:'LHT',PG:'LHT',LR:'LHT',SL:'LHT',GH:'LHT',NG:'LHT',CM:'LHT'
};

var geotipsRegion = {
    AL:'europe',AD:'europe',AT:'europe',BY:'europe',BE:'europe',BA:'europe',BG:'europe',
    HR:'europe',CY:'europe',CZ:'europe',DK:'europe',EE:'europe',FI:'europe',FR:'europe',
    DE:'europe',GR:'europe',HU:'europe',IS:'europe',IE:'europe',IT:'europe',XK:'europe',
    LV:'europe',LI:'europe',LT:'europe',LU:'europe',MT:'europe',MD:'europe',MC:'europe',
    ME:'europe',NL:'europe',MK:'europe',NO:'europe',PL:'europe',PT:'europe',RO:'europe',
    RU:'europe',SM:'europe',RS:'europe',SK:'europe',SI:'europe',ES:'europe',SE:'europe',
    CH:'europe',TR:'europe',UA:'europe',GB:'europe',VA:'europe',
    JP:'asia',CN:'asia',KR:'asia',IN:'asia',TH:'asia',VN:'asia',ID:'asia',MY:'asia',
    SG:'asia',PH:'asia',MM:'asia',KH:'asia',LA:'asia',BD:'asia',PK:'asia',LK:'asia',
    NP:'asia',BT:'asia',MN:'asia',KZ:'asia',UZ:'asia',TM:'asia',KG:'asia',TJ:'asia',
    AF:'asia',IQ:'asia',IR:'asia',SY:'asia',JO:'asia',LB:'asia',IL:'asia',PS:'asia',
    SA:'asia',AE:'asia',QA:'asia',KW:'asia',BH:'asia',OM:'asia',YE:'asia',GE:'asia',
    AM:'asia',AZ:'asia',
    BR:'south-america',AR:'south-america',CL:'south-america',CO:'south-america',
    PE:'south-america',VE:'south-america',EC:'south-america',BO:'south-america',
    PY:'south-america',UY:'south-america',GY:'south-america',SR:'south-america',GF:'south-america',
    AU:'oceania',NZ:'oceania',FJ:'oceania',PG:'oceania',WS:'oceania',TO:'oceania',
    VU:'oceania',SB:'oceania',KI:'oceania',NR:'oceania',PW:'oceania',FM:'oceania',
    MH:'oceania',NC:'oceania',
    US:'north-america',CA:'north-america',MX:'north-america',JM:'north-america',
    TT:'north-america',BB:'north-america',BS:'north-america',CU:'north-america',
    HT:'north-america',DO:'north-america',CR:'north-america',PA:'north-america',
    GT:'north-america',HN:'north-america',SV:'north-america',NI:'north-america',
    BZ:'north-america',
    NG:'africa',ZA:'africa',KE:'africa',ET:'africa',GH:'africa',TZ:'africa',UG:'africa',
    DZ:'africa',EG:'africa',MA:'africa',TN:'africa',LY:'africa',SD:'africa',CM:'africa',
    CI:'africa',SN:'africa',ML:'africa',BF:'africa',NE:'africa',TD:'africa',MG:'africa',
    MZ:'africa',AO:'africa',ZM:'africa',ZW:'africa',BW:'africa',NA:'africa',MW:'africa',
    RW:'africa',BI:'africa',SO:'africa',DJ:'africa',ER:'africa',SS:'africa',CG:'africa',
    GA:'africa',GQ:'africa',LR:'africa',SL:'africa',GN:'africa',GW:'africa',GM:'africa',
    MR:'africa',TG:'africa',BJ:'africa',CF:'africa',ST:'africa',CV:'africa',SC:'africa',
    MU:'africa',KM:'africa',RE:'africa'
};

function getDrivingSide(code) {
    if (!code) return null;
    return drivingSideData[code.toUpperCase()] || 'RHT';
}

var phoneCodeData = {
    US:'+1',CA:'+1',GB:'+44',DE:'+49',FR:'+33',IT:'+39',ES:'+34',PT:'+351',
    NL:'+31',BE:'+32',AT:'+43',CH:'+41',SE:'+46',NO:'+47',DK:'+45',FI:'+358',
    PL:'+48',CZ:'+420',SK:'+421',HU:'+36',RO:'+40',BG:'+359',HR:'+385',RS:'+381',
    GR:'+30',IE:'+353',LU:'+352',LT:'+370',LV:'+371',EE:'+372',SI:'+386',
    IS:'+354',AL:'+355',BA:'+387',ME:'+382',MK:'+389',XK:'+383',UA:'+380',
    RU:'+7',BY:'+375',MD:'+373',GE:'+995',AM:'+374',AZ:'+994',TR:'+90',
    JP:'+81',KR:'+82',CN:'+86',TW:'+886',HK:'+852',MO:'+853',TH:'+66',
    VN:'+84',MY:'+60',SG:'+65',ID:'+62',PH:'+63',IN:'+91',PK:'+92',BD:'+880',
    LK:'+94',NP:'+977',MM:'+95',KH:'+855',LA:'+856',BN:'+673',TL:'+670',
    AU:'+61',NZ:'+64',FJ:'+679',PG:'+675',
    BR:'+55',AR:'+54',CL:'+56',CO:'+57',PE:'+51',VE:'+58',EC:'+593',
    BO:'+591',PY:'+595',UY:'+598',GY:'+592',SR:'+597',
    EG:'+20',ZA:'+27',NG:'+234',KE:'+254',ET:'+251',GH:'+233',TZ:'+255',
    UG:'+256',MA:'+212',TN:'+216',DZ:'+213',LY:'+218',SD:'+249',CM:'+237',
    CI:'+225',SN:'+222',ML:'+223',MG:'+261',MZ:'+258',AO:'+244',ZM:'+260',
    ZW:'+263',BW:'+267',NA:'+264',MW:'+265',RW:'+250',SO:'+252',
    IL:'+972',SA:'+966',AE:'+971',QA:'+974',KW:'+965',BH:'+973',OM:'+968',
    JO:'+962',LB:'+961',    IQ:'+964',IR:'+98',SY:'+963',AF:'+93',PK:'+92'
};

var emergencyData = {
    US:'911',CA:'911',GB:'999/112',DE:'112',FR:'112/15/17/18',IT:'112/113/115/118',
    ES:'112',PT:'112',NL:'112',BE:'112',AT:'112',CH:'112',SE:'112',NO:'112',
    DK:'112',FI:'112',PL:'112',CZ:'112',SK:'112',HU:'112',RO:'112',
    BG:'112',HR:'112',RS:'112',GR:'112',IE:'112/999',LT:'112',LV:'112',
    EE:'112',IS:'112',AL:'112',BA:'112',UA:'112',RU:'112',BY:'112',
    GE:'112',TR:'112',JP:'110/119',KR:'112/119',CN:'110/120',TW:'110/119',
    TH:'191/199',VN:'113/115',MY:'999',ID:'112/110/119',PH:'911',
    IN:'112/100/101/102',PK:'15/115',BD:'999/199',LK:'119',NP:'100/101',
    AU:'000/112',NZ:'111',BR:'190/192/193',AR:'107/911',CL:'131/133',
    CO:'123',PE:'105',VE:'171',ZA:'10111/10177',NG:'112/199',KE:'999/112',
    EG:'122/123',GH:'191/192',TZ:'112/114',MA:'19',TN:'197',IL:'100/101',
    SA:'911',AE:'999/997',QA:'999',KW:'112',BH:'999',OM:'9999',
    IQ:'112',IR:'112',AF:'119'
};

var domainData = {
    US:'us',CA:'ca',GB:'uk',DE:'de',FR:'fr',IT:'it',ES:'es',PT:'pt',
    NL:'nl',BE:'be',AT:'at',CH:'ch',SE:'se',NO:'no',DK:'dk',FI:'fi',
    PL:'pl',CZ:'cz',SK:'sk',HU:'hu',RO:'ro',BG:'bg',HR:'hr',RS:'rs',
    GR:'gr',IE:'ie',LU:'lu',LT:'lt',LV:'lv',EE:'ee',SI:'si',
    IS:'is',AL:'al',BA:'ba',ME:'me',MK:'mk',UA:'ua',
    RU:'ru',BY:'by',MD:'md',GE:'ge',AM:'am',AZ:'az',TR:'tr',
    JP:'jp',KR:'kr',CN:'cn',TW:'tw',HK:'hk',TH:'th',
    VN:'vn',MY:'my',SG:'sg',ID:'id',PH:'ph',IN:'in',PK:'pk',BD:'bd',
    LK:'lk',NP:'np',MM:'mm',KH:'kh',
    AU:'au',NZ:'nz',FJ:'fj',PG:'pg',
    BR:'br',AR:'ar',CL:'cl',CO:'co',PE:'pe',VE:'ve',EC:'ec',
    BO:'bo',PY:'py',UY:'uy',
    EG:'eg',ZA:'za',NG:'ng',KE:'ke',GH:'gh',TZ:'tz',
    IL:'il',SA:'sa',AE:'ae',QA:'qa',KW:'kw',BH:'bh',OM:'om',
    JO:'jo',LB:'lb',IQ:'iq',IR:'ir'
};

var languageData = {
    US:'Hello · Welcome · Open · Exit',
    CA:'Bienvenue · Hello · Welcome',
    GB:'Hello · Welcome · Open · Exit',
    DE:'Willkommen · Bitte · Ausfahrt · Einbahnstraße',
    FR:'Bienvenue · Arrêt · Sens unique · Départ',
    IT:'Benvenuto · Uscita · Divieto · Entrata',
    ES:'Bienvenida · Salida · Prohibido · Entrada',
    PT:'Bem-vindo · Saída · Proibido · Entrada',
    NL:'Welkom · Uitgang · Verboden · Inrit',
    BE:'Bienvenue · Welkom · Uitgang · Sortie',
    AT:'Willkommen · Bitte · Ausfahrt · Einbahnstraße',
    CH:'Willkommen · Bienvenue · Benvenuto · Ausfahrt',
    SE:'Välkommen · Utgång · Förbjudet · Avfart',
    NO:'Velkommen · Utgang · Forbud · Avkjøring',
    DK:'Velkommen · Udgang · Forbudt · Udkørsel',
    FI:'Tervetuloa · Uloskäynti · Kielletty · Poistuminen',
    PL:'Witaj · Wyjazd · Zakaz · Wjazd',
    CZ:'Vítejte · Výjez · Zákaz · Vjezd',
    SK:'Vitajte · Výjazd · Zákaz · Vjazd',
    HU:'Üdvözlöm · Kijárat · Tiltott · Behajtás',
    RO:'Bun venit · Ieșire · Interzis · Intrare',
    BG:'Добре дошли · Изход · Забранено · Вход',
    HR:'Dobrodošli · Izlaz · Zabranjen · Ulaz',
    RS:'Добродошли · Излаз · Забрањено · Улаз',
    GR:'Καλώς ήρθατε · Έξοδος · Απαγορεύεται · Είσοδος',
    IE:'Welcome · Exit · No Entry · Slow',
    LU:'Bienvenue · Sortie · Entrée · Départ',
    LT:'Sveiki · Išvažiavimas · Draudžiama · Įvažiavimas',
    LV:'Laipni lūdzam · Izbraukšana · Aizliegts · Iebraukšana',
    EE:'Tere tulemast · Väljapääs · Keelatud · Sissesõit',
    SI:'Dobrodošli · Izhod · Prepovedano · Vhod',
    IS:'Velkomin · Útgangur · Bannað · Inngangur',
    AL:'Mirë se vini · Dalje · Ndalim · Hyrje',
    BA:'Dobrodošli · Izlaz · Zabranjen · Ulaz',
    ME:'Добродошли · Излаз · Забрањено · Улаз',
    MK:'Добредојде · Излез · Забрането · Влез',
    UA:'Ласкаво просимо · Виїзд · Заборонено · В\u0454їзд',
    RU:'Добро пожаловать · Выезд · Проезд запрещён · Въезд',
    BY:'Сардэчна запрашаем · Выезд · Забаронена · Уезд',
    MD:'Bun venit · Ieșire · Interzis · Intrare',
    GE:'მოგესალმებით · გასასვლელი · აკრძალული · შესასვლელი',
    AM:'Բարի գալուստ · Ելք · Արգելված · Մուտք',
    AZ:'Xoş gəlmisiniz · Çıxış · Qadağan · Giriş',
    TR:'Hoş geldiniz · Çıkış · Yasak · Giriş',
    JP:'ようこそ · 出口 · 禁止 · 入口',
    KR:'환영합니다 · 출구 · 금지 · 입구',
    CN:'欢迎 · 出口 · 禁止 · 入口',
    TW:'歡迎 · 出口 · 禁止 · 入口',
    HK:'歡迎 · 出口 · 禁止 · 入口',
    TH:'ยินดีต้อนรับ · ทางออก · ห้าม · ทางเข้า',
    VN:'Chào mừng · Lối ra · Cấm · Lối vào',
    MY:'Selamat datang · Keluar · Dilarang · Masuk',
    SG:'Welcome · Exit · No Entry · Slow',
    ID:'Selamat datang · Keluar · Dilarang · Masuk',
    PH:'Maligayang pagdating · Labas · Bawal · Pasok',
    IN:'स्वागत है · निकास · प्रतिबंध · प्रवेश',
    PK:'خوش آمدید · خروج · ممنوع · داخل',
    BD:'স্বাগতম · প্রস্থান · নিষিদ্ধ · প্রবেশ',
    LK:'ආයුබෝවන් · පිටවීම · තහනම් · ඇතුළුවීම',
    NP:'स्वागत छ · बाहिर निस्कन · निषेध · भित्र पस्न',
    MM:'ကြိုဆိုပါတယ် · ထွက်ပေါက် · ပိတ်ပင် · ဝင်ပေါက်',
    KH:'ស្វាគមន៍ · ចេញ · ហាមឃាត់ · ចូល',
    LA:'ຍິນດີຕ້ອນຮັບ · ທາງອອກ · ຫ້າມ · ທາງເຂົ້າ',
    TL:'Bem-vindo · Saída · Proibido · Entrada',
    AU:'Welcome · Exit · No Entry · Slow',
    NZ:'Welcome · Exit · No Entry · Slow',
    FJ:'Welcome · Vinaka · Exit · Bula',
    PG:'Welcome · Long Ples · No Go · Kom In',
    BR:'Bem-vindo · Saída · Proibido · Entrada',
    AR:'Bienvenido · Salida · Prohibido · Entrada',
    CL:'Bienvenido · Salida · Prohibido · Entrada',
    CO:'Bienvenido · Salida · Prohibido · Entrada',
    PE:'Bienvenido · Salida · Prohibido · Entrada',
    VE:'Bienvenido · Salida · Prohibido · Entrada',
    EC:'Bienvenido · Salida · Prohibido · Entrada',
    BO:'Bienvenido · Salida · Prohibido · Entrada',
    PY:'Bienvenido · Salida · Prohibido · Entrada',
    UY:'Bienvenido · Salida · Prohibido · Entrada',
    EG:'أهلا · خروج · ممنوع · دخول',
    ZA:'Welcome · Exit · No Entry · Slow',
    NG:'Welcome · Exit · No Entry · Slow',
    KE:'Karibu · Toka · Marufuku · Ingia',
    ET:'እንኳን ደህና መጡ · ዝግጅት · አይፈቀድም · መግቢያ',
    GH:'Welcome · Exit · No Entry · Slow',
    TZ:'Karibu · Toka · Marufuku · Ingia',
    UG:'Tukusanyukidde · Genda · Tegereko · Yingira',
    MA:'مرحبا · خروج · ممنوع · دخول',
    TN:'مرحبا · خروج · ممنوع · دخول',
    DZ:'مرحبا · خروج · ممنوع · دخول',
    LY:'مرحبا · خروج · ممنوع · دخول',
    SD:'مرحبا · خروج · ممنوع · دخول',
    CM:'Bienvenue · Karibu · Bonjour · Exit',
    CI:'Bienvenue · Sortie · Interdit · Entrée',
    SN:'Dalal jamm · Gënn · Baaxul · Dugg',
    ML:'Bonne bienvenue · Sortie · Interdit · Entrée',
    MG:'Tongasoa · Mandalo · Fady · Miditra',
    MZ:'Bem-vindo · Saída · Proibido · Entrada',
    AO:'Bem-vindo · Saída · Proibido · Entrada',
    ZM:'Welcome · Exit · No Entry · Slow',
    ZW:'Welcome · Exit · No Entry · Slow',
    BW:'Welcome · Exit · No Entry · Slow',
    NA:'Welcome · Exit · No Entry · Slow',
    MW:'Bienvenue · Pitani · Ch_bwera · Lowani',
    RW:'Murakaza neza · Igiseri · Birabujijwe · Injira',
    SO:'Soo dhawoow · Bixid · Mamnuuc · Galid',
    IL:'ברוכים הבאים · יציאה · אסורה · כניסה',
    SA:'مرحبا · خروج · ممنوع · دخول',
    AE:'مرحبا · خروج · ممنوع · دخول',
    QA:'مرحبا · خروج · ممنوع · دخول',
    KW:'مرحبا · خروج · ممنوع · دخول',
    BH:'مرحبا · خروج · ممنوع · دخول',
    OM:'مرحبا · خروج · ممنوع · دخول',
    JO:'مرحبا · خروج · ممنوع · دخول',
    LB:'مرحبا · خروج · ممنوع · دخول',
    IQ:'مرحبا · خروج · ممنوع · دخول',
    IR:'خوش آمدید · خروج · ممنوع · ورود',
    SY:'مرحبا · خروج · ممنوع · دخول',
    AF:'ښه راغلاست · وتلو · ممنوع · داخلو'
};

function getPhoneCode(code) {
    if (!code) return null;
    return phoneCodeData[code.toUpperCase()] || null;
}

function getDomain(code) {
    if (!code) return null;
    return '.' + (domainData[code.toUpperCase()] || code.toLowerCase());
}

function getLanguage(code) {
    if (!code) return null;
    return languageData[code.toUpperCase()] || null;
}

function getEmergency(code) {
    if (!code) return null;
    return emergencyData[code.toUpperCase()] || null;
}

var alphabetData = {
    US:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    CA:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    GB:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    DE:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü ß',
    FR:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z É È Ê Ë À Â Ç Œ',
    IT:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z À È É Ì Ò Ù',
    ES:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ ¿ ¡',
    PT:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ã Õ Ç',
    NL:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z IJ',
    BE:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z É Ê È Ë Î Ï Ô Û',
    AT:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü ß',
    CH:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ä Ö Ü',
    SE:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Å Ä Ö',
    NO:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å',
    DK:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Æ Ø Å',
    FI:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Å Ä Ö',
    PL:'A Ą B C Ć D E Ę F G H I J K L Ł M N Ń O Ó P R S Ś T U W Y Z Ź Ż',
    CZ:'A Á B C Č D E É Ě F G H I Í J K L M N Ň O Ó P Q R Ř S Š T Ů Ú Ů V W X Y Ý Z Ž',
    SK:'A Á Ä B C Č D Ď E É F G H I Í J K L Ĺ Ľ M N Ň O Ó P Q R Ř S Š T Ť U Ú V W X Y Ý Z Ž',
    HU:'A Á B C CS D dz DZS E É F G GY H I Í J K L LY M N NY O Ó Ö Ő P Q R S SZ T TY U Ú Ü Ű V Z ZS',
    RO:'A Ă Â B C D E F G H I Î J K L M N O P Q R S Ș T Ț U V W X Y Z',
    BG:'А Б В Г Д Е Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ь Ю Я',
    HR:'A B C Č Ć D DŽ Đ E F G H I J K L LJ M N Nj O P R S Š T U V Z Ž',
    RS:'А Б В Г Д Ђ Е Ж З И Ј К Л Љ М Н Њ О П Р С Т Ћ У Ф Х Ц Ч Џ Ш',
    GR:'Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω',
    UA:'А Б В Г Ґ Д Е Є Ж З И І Ї Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ь Ю Я',
    RU:'А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я',
    BY:'А Б В Г Д Е Ё Ж З И Й К Л М Н О П Р С Т У Ф Х Ц Ч Ш Щ Ъ Ы Ь Э Ю Я',
    GE:'ა ბ გ დ ე ვ ზ თ ი კ ლ მ ნ ო პ ჟ რ ს ტ უ ფ ქ ღ ყ შ ჩ ძ წ ჭ ხ ჯ ჰ',
    AM:'Ա Բ Գ Դ Ե Զ Է Ը Թ Ժ Ի Լ Խ Ծ Կ Հ Ձ Ղ Ճ Մ Յ Ն Շ Ո Չ Պ Ջ Ռ Ս Վ Տ Ր Ց Ու Փ Ք Օ Ֆ',
    TR:'A B C Ç D E F G Ğ H I İ J K L M N O Ö P R S Ş T U Ü V Y Z',
    JP:'アイウエオ カキクケコ サシスセソ タチツテト ナニヌネノ ハヒフヘホ マミムメモ ヤユヨ ラリルレロ ワヲン',
    KR:'ㄱ ㄴ ㄷ ㄹ ㅁ ㅂ ㅅ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ ㅏ ㅑ ㅓ ㅕ ㅗ ㅛ ㅜ ㅠ ㅡ ㅣ',
    CN:'一 丁 七 万 丈 三 上 下 不 与 专 且 世 丘 丙 业 丛 东 丝 丞 丢 两 严 丧 个 中 丰 串 临 丸 丹 为 主 丽 举 久 么 义 之 乌 乎 乐 乒乓 乔 习 乡 书 买 乱 了 予 争 事 二 于 亏 云 互 五 井 亚 些 亡 交 亥 亦 产 亨 亩 享 京 亭 亮 亲 亳 人 亿 什 仁 仅 仆 仇 今 介 仍 从 仑 仓 仔 他 仗 付 仙 代 令 以 仪 们 仰 仲 件 任 份 仿 伍 伏 伐 众 优 伙 会 伞 伟 传 伤 伦 伯 估 伴 伸 似 但 位 低 住 佑 体 余 佛 作 你 佩 佬 佳 使 例 侍 供 依 侈 例 侍 侣 侧 侦 依 侧 佩 佳 使 例 侍 供 依',
    TW:'ㄅ ㄆ ㄇ ㄈ ㄉ ㄊ ㄋ ㄌ ㄍ ㄎ ㄏ ㄐ ㄑ ㄒ ㄓ ㄔ ㄕ ㄖ ㄗ ㄘ ㄙ ㄚ ㄛ ㄜ ㄝ ㄞ ㄟ ㄠ ㄡ ㄢ ㄣ ㄤ ㄥ ㄦ ㄧ ㄨ ㄩ',
    TH:'ก ข ค ง จ ฉ ช ซ ฌ ญ ฎ ฏ ฐ ฑ ฒ ณ ด ต ถ ท ธ น บ ป ผ ฝ พ ฟ ภ ม ย ร ล ว ศ ษ ส ห ฬ อ ฮ',
    VN:'A Ă Â B C D Đ E Ê G H I K L M N O Ô Ơ P Q R S T U Ư V X Y Z',
    MY:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    ID:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    PH:'A B C D E F G H I J K L M N Ñ Ng O P Q R S T U V W X Y Z',
    IN:'अ आ इ ई उ ऊ ऋ ए ऐ ओ औ क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह ळ',
    PK:'ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی',
    BD:'অ আ ই ঈ উ ঊ ঋ এ ঐ ও ঔ ক খ গ ঘ চ ছ জ ঝ ট ঠ ড ঢ ণ ত থ দ ধ ন প ফ ব ভ ম য র ল শ ষ স হ ড় ঢ় য় ৎ ং ঃ ঁ',
    LK:'අ ආ ඇ ඈ ඉ ඊ උ ඌ ඍ ඎ එ ඒ ඓ ඔ ඕ ඖ ක ඛ ග ඝ ඞ ඟ ච ඡ ජ ඣ ඤ ඥ ඦ ට ඨ ඩ ඪ ණ ඬ ත ථ ද ධ න ඳ ප ඵ බ භ ම ය ර ල ව ශ ෂ ස හ ළ ෆ',
    NP:'अ आ इ ई उ ऊ ऋ ए ऐ ओ औ क ख ग घ च छ ज झ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह',
    MM:'က ခ ဂ ဃ င စ ဆ ဇ ဈ ည ဋ ဌ ဍ ဎ ဏ တ ထ ဒ ဓ န ပ ဖ ဗ ဘ မ ယ ရ လ ဝ သ ဟ ဠ အ',
    KH:'ក ខ គ ឃ ង ច ឆ ជ ឈ ញ ដ ឌ ឍ ណ ត ថ ទ ធ ន ប ផ ព ភ ម យ រ ល វ ស ហ ឡ អ',
    AU:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    NZ:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    BR:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ã Ç',
    AR:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ',
    CL:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ',
    CO:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ',
    PE:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z Ñ',
    EG:'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي',
    ZA:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    NG:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    KE:'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z',
    SA:'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي',
    AE:'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي',
    IL:'א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת',
    IR:'ا ب پ ت ث ج چ ح خ د ذ ر ز ژ س ش ص ض ط ظ ع غ ف ق ک گ ل م ن و ه ی',
    IQ:'ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي'
};

function getAlphabet(code) {
    if (!code) return null;
    return alphabetData[code.toUpperCase()] || null;
}

function getGeoTipsUrl(code) {
    if (!code) return 'https://geotips.net';
    var region = geotipsRegion[code.toUpperCase()];
    return region ? 'https://geotips.net/' + region + '/' : 'https://geotips.net';
}

async function getWikipedia(city, country) {
    var query = city || country;
    if (!query) return null;
    try {
        var r = await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(query));
        if (!r.ok) return null;
        var d = await r.json();
        return d.content_urls ? d.content_urls.desktop.page : null;
    } catch { return null; }
}

async function getClimate(lat, lng) {
    try {
        var r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng + '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto');
        if (!r.ok) return null;
        var d = await r.json();
        if (d.current) {
            var codes = {0:'Clear',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Rime fog',51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',61:'Slight rain',63:'Rain',65:'Heavy rain',71:'Slight snow',73:'Snow',75:'Heavy snow',80:'Rain showers',81:'Moderate showers',82:'Violent showers',95:'Thunderstorm',96:'Thunderstorm+hail',99:'Thunderstorm+heavy hail'};
            return {
                temp: Math.round(d.current.temperature_2m),
                humidity: d.current.relative_humidity_2m,
                precip: d.current.precipitation,
                weather: codes[d.current.weather_code] || 'Unknown'
            };
        }
        return null;
    } catch { return null; }
}

async function getPopulation(country) {
    if (!country) return null;
    try {
        var r = await fetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(country) + '?fields=population');
        if (!r.ok) return null;
        var d = await r.json();
        if (d && d[0] && d[0].population) {
            var pop = d[0].population;
            if (pop >= 1e9) return (pop / 1e9).toFixed(2) + 'B';
            if (pop >= 1e6) return (pop / 1e6).toFixed(1) + 'M';
            if (pop >= 1e3) return (pop / 1e3).toFixed(0) + 'K';
            return pop.toString();
        }
        return null;
    } catch { return null; }
}

let popupOpened = false;
let lastProcessedLat = null;
let lastProcessedLng = null;

window.addEventListener('message', async function (e) {
    if (!e.data || (e.data.type !== 'xhr' && e.data.type !== 'fetch')) return;
    const msg = e.data.data;
    if (!msg) return;
    try {
        const arr = JSON.parse(msg);
        let found = false;
        let newLat = null;
        let newLng = null;
        try { newLat = arr[1][0][5][0][1][0][2]; newLng = arr[1][0][5][0][1][0][3]; found = true; } catch {}
        if (!found) {
            try {
                if (isDecimal(arr[1][5][0][1][0][2]) && isDecimal(arr[1][5][0][1][0][3])) {
                    newLat = arr[1][5][0][1][0][2];
                    newLng = arr[1][5][0][1][0][3];
                    found = true;
                }
            } catch {}
        }
        if (!found || newLat === null || newLng === null) return;
        var latN = parseFloat(newLat);
        var lngN = parseFloat(newLng);
        if (isNaN(latN) || isNaN(lngN) || latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return;
        if (popupOpened && lastProcessedLat === latN && lastProcessedLng === lngN) return;
        lat = latN;
        long = lngN;
        lastProcessedLat = latN;
        lastProcessedLng = lngN;
        popupOpened = true;
        playBeep();
        updatePopup();
    } catch { return; }
});

let currentBlobUrl = null;

function buildHTML(data) {
    const { city, state, country, country_code, road, postcode, coordsText, dmsText, lat, lng, timezone, distance, history, wiki, climate, population, drivingSide, phoneCode, emergency, domain, language, alphabet, geotips } = data;
    const now = new Date();
    const ts = now.toISOString().replace('T',' ').slice(0,19) + ' UTC';
    const flag = countryToFlag(country_code);
    const histHtml = history.length > 0 ? history.map(function(h) {
        var hflag = countryToFlag(h.country_code || '');
        return '<div class="hist-item" data-lat="' + h.lat + '" data-lng="' + h.lng + '">' +
            '<span class="hist-flag">' + hflag + '</span>' +
            '<span class="hist-city">' + (h.city || h.country || 'Unknown') + '</span>' +
            '<span class="hist-time">' + new Date(h.ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}) + '</span>' +
        '</div>';
    }).join('') : '<div class="hist-empty">No history yet</div>';

    var streetViewUrl = 'https://www.google.com/maps/@' + lat + ',' + lng + ',3a,75y,90t/data=!3m6!1e1!3m4!1s!2e0!7i13312!8i6656';
    var gmapsUrl = 'https://maps.google.com/?q=' + lat + ',' + lng;
    var osmUrl = 'https://www.openstreetmap.org/?mlat=' + lat + '&mlon=' + lng + '#map=14/' + lat + '/' + lng;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>LOCANEX</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#080b12;
  --surface:#0d1117;
  --surface2:#111820;
  --border:rgba(255,255,255,.06);
  --accent:#00d4aa;
  --accent-dim:rgba(0,212,170,.12);
  --text:#ffffff;
  --text-dim:#8b9cb8;
  --text-muted:#4a5a72;
  --mono:'JetBrains Mono',monospace;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
}
html,body{height:100%}
body{
  font-family:var(--sans);
  background:var(--bg);
  background-image:
    linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px);
  background-size:40px 40px;
  color:var(--text);
  padding:0;
  overflow-y:auto;
}
.frame{
  display:flex;flex-direction:column;min-height:100vh;
  border:1px solid var(--border);
}
.header{
  display:flex;align-items:center;justify-content:space-between;
  padding:14px 18px 12px;
  border-bottom:1px solid var(--border);
}
.tag{
  font-size:9px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--accent);
  display:flex;align-items:center;gap:6px;
}
.dot{
  width:6px;height:6px;border-radius:50%;
  background:var(--accent);
  box-shadow:0 0 8px var(--accent);
  animation:pulse 2s ease-in-out infinite;
}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 8px var(--accent)}50%{opacity:.4;box-shadow:0 0 2px var(--accent)}}
.ts{
  font-family:var(--mono);
  font-size:9px;
  color:var(--text-muted);
  letter-spacing:.5px;
}
.body{flex:1;padding:18px;overflow-y:auto}

@keyframes fadeSlideIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

.section{margin-bottom:20px;animation:fadeSlideIn .4s ease both}
.section:nth-child(2){animation-delay:.05s}
.section:nth-child(3){animation-delay:.1s}
.section:nth-child(4){animation-delay:.15s}
.section:nth-child(5){animation-delay:.2s}
.section:nth-child(6){animation-delay:.25s}
.section:nth-child(7){animation-delay:.3s}
.section:nth-child(8){animation-delay:.35s}

.section-label{
  font-size:8px;font-weight:600;letter-spacing:2px;text-transform:uppercase;
  color:var(--text-muted);
  margin-bottom:10px;
  padding-bottom:6px;
  border-bottom:1px solid var(--border);
}
.loc-name{
  font-size:20px;font-weight:500;letter-spacing:-.3px;
  margin-bottom:2px;
  color:var(--text);
}
.loc-flag{font-size:20px;margin-right:6px;vertical-align:middle}
.loc-region{
  font-size:12px;
  color:var(--text-dim);
  letter-spacing:.2px;
}
.coord-grid{
  display:grid;grid-template-columns:1fr 1fr;gap:8px;
}
.coord-cell{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  padding:10px 12px;
  transition:border-color .2s,box-shadow .2s;
  cursor:pointer;
  position:relative;
}
.coord-cell:hover{
  border-color:rgba(0,212,170,.25);
  box-shadow:0 0 16px rgba(0,212,170,.08);
}
.coord-cell .label{
  font-size:8px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--text-muted);
  margin-bottom:4px;
}
.coord-cell .value{
  font-family:var(--mono);
  font-size:14px;font-weight:500;
  color:var(--accent);
  letter-spacing:.5px;
}
.coord-toggle{
  display:flex;gap:0;margin-bottom:8px;
}
.coord-toggle button{
  flex:1;
  padding:6px;
  font-family:var(--mono);
  font-size:9px;
  font-weight:500;
  letter-spacing:1px;
  text-transform:uppercase;
  background:transparent;
  border:1px solid var(--border);
  color:var(--text-muted);
  cursor:pointer;
  transition:all .15s;
}
.coord-toggle button:first-child{border-radius:6px 0 0 6px}
.coord-toggle button:last-child{border-radius:0 6px 6px 0}
.coord-toggle button.active{
  background:var(--accent-dim);
  border-color:rgba(0,212,170,.3);
  color:var(--accent);
}
.detail-row{
  display:flex;justify-content:space-between;align-items:center;
  padding:8px 0;
  border-bottom:1px solid var(--border);
  transition:background .15s;
}
.detail-row:hover{background:rgba(255,255,255,.02);margin:0 -8px;padding:8px 8px;border-radius:4px}
.detail-row:last-child{border-bottom:none}
.detail-row .k{
  font-size:10px;font-weight:500;letter-spacing:1px;text-transform:uppercase;
  color:var(--text-muted);
}
.detail-row .v{
  font-family:var(--mono);
  font-size:11px;
  color:var(--text-dim);
}
.detail-row .v a{
  color:var(--text-dim);
  text-decoration:none;
  transition:color .15s;
}
.detail-row .v a:hover{color:var(--accent)}
.distance-badge{
  display:inline-flex;align-items:center;gap:4px;
  background:var(--accent-dim);
  border:1px solid rgba(0,212,170,.2);
  border-radius:20px;
  padding:4px 10px;
  font-family:var(--mono);
  font-size:11px;
  font-weight:500;
  color:var(--accent);
  margin-top:8px;
}
.distance-badge svg{width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:1.5}
.info-grid{
  display:grid;grid-template-columns:1fr 1fr;gap:8px;
}
.info-cell{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  padding:10px 12px;
  text-align:center;
}
.info-cell .info-label{
  font-size:8px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;
  color:var(--text-muted);
  margin-bottom:6px;
}
.info-cell .info-value{
  font-family:var(--mono);
  font-size:12px;
  font-weight:500;
  color:var(--text-dim);
}
.info-cell .info-sub{
  font-family:var(--mono);
  font-size:8px;
  color:var(--text-muted);
  margin-top:2px;
}
.map-wrap{
  position:relative;
  border-radius:6px;
  overflow:hidden;
  border:1px solid var(--border);
  background:var(--surface);
}
.map-glow{
  position:absolute;inset:-1px;
  border-radius:7px;
  background:linear-gradient(135deg,rgba(0,212,170,.2),transparent 40%,transparent 60%,rgba(0,212,170,.15));
  z-index:0;
  pointer-events:none;
  animation:glowShift 4s ease-in-out infinite alternate;
}
@keyframes glowShift{from{opacity:.6}to{opacity:1}}
.leaflet-control-zoom a{
  background:#0d1117!important;
  color:#8b9cb8!important;
  border:1px solid rgba(255,255,255,.06)!important;
  width:28px!important;
  height:28px!important;
  line-height:28px!important;
  font-size:14px!important;
}
.leaflet-control-zoom a:hover{
  background:#161b22!important;
  color:#00d4aa!important;
}
.leaflet-control-zoom{
  border:none!important;
  box-shadow:none!important;
}
.btn-row{display:flex;gap:8px}
.btn-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.btn{
  display:flex;align-items:center;justify-content:center;gap:6px;
  flex:1;height:34px;
  background:transparent;
  border:1px solid var(--border);
  border-radius:6px;
  color:var(--text-dim);
  font-family:var(--sans);
  font-size:11px;font-weight:500;letter-spacing:.5px;
  cursor:pointer;
  transition:all .15s;
  text-decoration:none;
}
.btn:hover{
  background:var(--accent-dim);
  border-color:rgba(0,212,170,.3);
  color:var(--accent);
}
.btn svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.btn.copied{
  border-color:rgba(0,212,170,.4);
  color:var(--accent);
  background:var(--accent-dim);
}
.no-data{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  height:100%;
  gap:12px;
}
.no-data-text{
  font-size:11px;
  color:var(--text-muted);
  letter-spacing:1px;
  text-transform:uppercase;
}
.skeleton{
  background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%);
  background-size:200% 100%;
  animation:shimmer 1.5s infinite;
  border-radius:4px;
  height:14px;
  width:100%;
}
.skeleton-sm{width:60%;height:10px}
.skeleton-lg{width:80%;height:18px}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.footer{
  padding:12px 18px;
  border-top:1px solid var(--border);
}
.hist-section{margin-top:4px}
.hist-item{
  display:flex;align-items:center;gap:8px;
  padding:7px 10px;
  border:1px solid var(--border);
  border-radius:6px;
  margin-bottom:6px;
  cursor:pointer;
  transition:all .15s;
  background:var(--surface);
}
.hist-item:hover{
  border-color:rgba(0,212,170,.2);
  background:var(--surface2);
}
.hist-flag{font-size:14px}
.hist-city{
  flex:1;
  font-size:11px;
  color:var(--text-dim);
  font-family:var(--mono);
}
.hist-time{
  font-size:9px;
  color:var(--text-muted);
  font-family:var(--mono);
}
.hist-empty{
  font-size:10px;
  color:var(--text-muted);
  text-align:center;
  padding:12px 0;
  letter-spacing:.5px;
}
.sound-indicator{
  display:flex;align-items:center;gap:4px;
  font-size:8px;color:var(--text-muted);
  letter-spacing:1px;text-transform:uppercase;
}
.sound-bar{width:2px;background:var(--accent);border-radius:1px;animation:soundPulse .6s ease infinite alternate}
.sound-bar:nth-child(1){height:4px;animation-delay:0s}
.sound-bar:nth-child(2){height:7px;animation-delay:.1s}
.sound-bar:nth-child(3){height:5px;animation-delay:.2s}
.sound-bar:nth-child(4){height:8px;animation-delay:.15s}
@keyframes soundPulse{from{opacity:.3}to{opacity:1}}
.coord-animated{
  position:relative;
  overflow:hidden;
}
.coord-animated::before{
  content:'';
  position:absolute;inset:-1px;
  border-radius:7px;
  padding:1px;
  background:conic-gradient(from var(--angle,0deg),transparent 60%,var(--accent) 100%);
  -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);
  -webkit-mask-composite:xor;
  mask-composite:exclude;
  animation:rotateBorder 4s linear infinite;
  opacity:0;
  transition:opacity .3s;
}
.coord-animated:hover::before{opacity:1}
@keyframes rotateBorder{to{--angle:360deg}}
@property --angle{syntax:'<angle>';initial-value:0deg;inherits:false}
#particles-canvas{
  position:fixed;inset:0;z-index:0;
  pointer-events:none;
  opacity:.3;
}
.climate-grid{
  display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;
}
.climate-cell{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  padding:8px;
  text-align:center;
}
.climate-cell .c-icon{font-size:14px;margin-bottom:2px}
.climate-cell .c-val{
  font-family:var(--mono);
  font-size:12px;font-weight:500;
  color:var(--text-dim);
}
.climate-cell .c-lbl{
  font-size:7px;font-weight:600;letter-spacing:1px;text-transform:uppercase;
  color:var(--text-muted);
  margin-top:2px;
}
.pop-badge{
  display:inline-flex;align-items:center;gap:4px;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  padding:4px 10px;
  font-family:var(--mono);
  font-size:11px;
  color:var(--text-dim);
  margin-top:6px;
}
.pop-badge .pop-icon{font-size:10px}
.globe-wrap{
  width:100px;height:100px;flex-shrink:0;
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:6px;
  overflow:hidden;
}
.compass{
  width:40px;height:40px;
  border:1px solid var(--border);
  border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  position:relative;
  background:var(--surface);
}
.compass-needle{
  width:2px;height:16px;
  background:linear-gradient(to bottom,var(--accent) 50%,var(--text-muted) 50%);
  border-radius:1px;
}
.compass-n{
  position:absolute;top:2px;
  font-size:7px;font-weight:600;color:var(--accent);letter-spacing:1px;
}
.terrain-btn{
  position:absolute;bottom:8px;left:8px;z-index:1000;
  display:flex;align-items:center;gap:5px;
  padding:6px 12px;
  background:rgba(8,11,18,.85);
  backdrop-filter:blur(8px);
  -webkit-backdrop-filter:blur(8px);
  border:1px solid rgba(255,255,255,.08);
  border-radius:4px;
  color:var(--text-muted);
  font-family:var(--mono);
  font-size:8px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;
  cursor:pointer;
  transition:all .2s ease;
}
.terrain-btn:hover{
  background:rgba(13,17,23,.95);
  border-color:rgba(0,212,170,.25);
  color:var(--accent);
}
.terrain-btn.active{
  background:rgba(0,212,170,.08);
  border-color:rgba(0,212,170,.35);
  color:var(--accent);
  box-shadow:0 0 12px rgba(0,212,170,.1);
}
.terrain-btn svg{width:10px;height:10px;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.map-overlay-dark{
  position:absolute;inset:0;z-index:999;
  background:linear-gradient(180deg,rgba(8,11,18,.75) 0%,rgba(8,11,18,.5) 50%,rgba(8,11,18,.75) 100%);
  pointer-events:none;
  opacity:0;
  transition:opacity .4s ease;
}
.map-overlay-dark.visible{opacity:1}
</style>
</head>
<body>
<div class="frame">
  <div class="header">
    <div class="tag"><span class="dot"></span> LOCANEX</div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="sound-indicator"><span class="sound-bar"></span><span class="sound-bar"></span><span class="sound-bar"></span><span class="sound-bar"></span> SIGNAL</div>
      <div class="ts">${ts}</div>
    </div>
  </div>
  <div class="body">
    ${(lat && lng) ? `
    <div class="section" style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
      <div style="flex:1;min-width:0">
        <div class="section-label">Location</div>
        <div class="loc-name">${flag ? '<span class="loc-flag">' + flag + '</span>' : ''}${city || state || country || 'Unknown'}</div>
        <div class="loc-region">${[road, postcode, state, country].filter(Boolean).join(' \u00B7 ') || '\u2014'}</div>
        ${distance ? '<div class="distance-badge"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' + distance + ' from you</div>' : ''}
      </div>
      <div class="globe-wrap">
        <canvas id="globeCanvas" width="100" height="100"></canvas>
      </div>
    </div>
    <div class="section">
      <div class="section-label">Coordinates</div>
      <div class="coord-toggle">
        <button class="active" id="btnDec">DEC</button>
        <button id="btnDms">DMS</button>
      </div>
      <div id="decView">
        <div class="coord-grid">
        <div class="coord-cell coord-animated" data-copy="${Number(lat).toFixed(6)}">
          <div class="label">Latitude</div>
          <div class="value" id="latVal">${Number(lat).toFixed(6)}</div>
        </div>
        <div class="coord-cell coord-animated" data-copy="${Number(lng).toFixed(6)}">
          <div class="label">Longitude</div>
          <div class="value" id="lngVal">${Number(lng).toFixed(6)}</div>
        </div>
        </div>
      </div>
      <div id="dmsView" style="display:none">
        <div class="coord-grid">
          <div class="coord-cell coord-animated" data-copy="${toDMS(lat,true)}">
            <div class="label">Latitude</div>
            <div class="value">${toDMS(lat,true)}</div>
          </div>
          <div class="coord-cell coord-animated" data-copy="${toDMS(lng,false)}">
            <div class="label">Longitude</div>
            <div class="value">${toDMS(lng,false)}</div>
          </div>
        </div>
      </div>
      <div id="copyToast" style="text-align:center;margin-top:8px;font-size:9px;color:var(--accent);letter-spacing:1px;text-transform:uppercase;opacity:0;transition:opacity .2s">copied</div>
    </div>
    <div class="section">
      <div class="section-label">Details</div>
      ${road ? '<div class="detail-row"><span class="k">Street</span><span class="v">' + road + '</span></div>' : ''}
      ${postcode ? '<div class="detail-row"><span class="k">Postcode</span><span class="v">' + postcode + '</span></div>' : ''}
      ${state ? '<div class="detail-row"><span class="k">State</span><span class="v">' + state + '</span></div>' : ''}
      ${country ? '<div class="detail-row"><span class="k">Country</span><span class="v">' + (flag ? flag + ' ' : '') + country + '</span></div>' : ''}
      <div class="detail-row"><span class="k">Timezone</span><span class="v">${timezone.name} \u00B7 ${timezone.time}</span></div>
      <div class="detail-row"><span class="k">Raw</span><span class="v">${coordsText}</span></div>
    </div>
    <div class="section">
      <div class="section-label">Climate</div>
      <div class="climate-grid">
        <div class="climate-cell">
          <div class="c-icon"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#00d4aa;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M14 4v1a2 2 0 002 2h1"/><path d="M18 11h1a2 2 0 012 2v1"/><path d="M8 4v1a2 2 0 01-2 2H5"/><path d="M6 11H5a2 2 0 00-2 2v1"/><line x1="12" y1="3" x2="12" y2="21"/><path d="M9 17l3 3 3-3"/></svg></div>
          <div class="c-val">${climate ? climate.temp + '\u00B0C' : '\u2014'}</div>
          <div class="c-lbl">${climate ? climate.weather : ''}</div>
        </div>
        <div class="climate-cell">
          <div class="c-icon"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#00d4aa;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2v20"/><path d="M12 2a10 10 0 00-4 18h8a10 10 0 00-4-18"/><path d="M12 12l-3-4"/><path d="M12 12l3-4"/></svg></div>
          <div class="c-val">${climate ? climate.humidity + '%' : '\u2014'}</div>
          <div class="c-lbl">Humidity</div>
        </div>
        <div class="climate-cell">
          <div class="c-icon"><svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:#00d4aa;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round"><path d="M4 14.5A7.5 7.5 0 0111.5 7h1A7.5 7.5 0 0120 14.5"/><path d="M16 17l-4 4-4-4"/><path d="M12 12v9"/></svg></div>
          <div class="c-val">${climate ? climate.precip + 'mm' : '\u2014'}</div>
          <div class="c-lbl">Precip</div>
        </div>
      </div>
      ${population ? '<div class="pop-badge"><svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:#4a5a72;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:4px"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>Pop: ' + population + '</div>' : ''}
    </div>
    <div class="section">
      <div class="section-label">Environment</div>
      <div class="info-grid">
        <div class="info-cell">
          <div class="info-label">Domain</div>
          <div class="info-value">${domain || '\u2014'}</div>
        </div>
        <div class="info-cell">
          <div class="info-label">Phone</div>
          <div class="info-value">${phoneCode || '\u2014'}</div>
          <div class="info-sub" style="font-size:8px;color:var(--text-muted);margin-top:2px">${emergency || ''}</div>
        </div>
        <div class="info-cell" style="grid-column:span 2">
          <div class="info-label">Language</div>
          <div class="info-value" style="font-size:9px;line-height:1.3">${language || '\u2014'}</div>
          ${alphabet ? '<div class="info-sub" style="font-size:8px;color:var(--text-muted);margin-top:3px;letter-spacing:.5px">' + alphabet + '</div>' : ''}
        </div>
        <div class="info-cell" style="grid-column:span 2">
          <div class="info-label">Drive Side</div>
          <div class="info-value">${drivingSide === 'LHT' ? '\u2190 Left' : '\u2192 Right'}</div>
        </div>
      </div>
    </div>
      <div class="section">
      <div class="section-label">Radar</div>
      <div class="map-wrap">
        <div class="map-glow"></div>
        <div class="map-overlay-dark" id="mapOverlay"></div>
        <div id="radar-map" style="width:100%;height:300px;border-radius:6px;position:relative;z-index:1;"></div>
        <link rel="stylesheet" href="leaflet.css" />
        <script src="leaflet.js"><\/script>
      </div>
    </div>
    <div class="section">
      <div class="section-label">Quick Links</div>
      <div class="btn-row">
        <a class="btn" href="${streetViewUrl}" target="_blank">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 000 20 14.5 14.5 0 000-20"/><path d="M2 12h20"/></svg>
          Street View
        </a>
        <a class="btn" href="${gmapsUrl}" target="_blank">
          <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          Maps
        </a>
        <a class="btn" href="${osmUrl}" target="_blank">
          <svg viewBox="0 0 24 24"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
          OSM
        </a>
      </div>
      ${wiki ? '<div class="btn-row" style="margin-top:8px"><a class="btn" href="' + wiki + '" target="_blank"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>Wikipedia</a><a class="btn" href="' + data.geotips + '" target="_blank"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>GeoTips</a></div>' : '<div class="btn-row" style="margin-top:8px"><a class="btn" href="' + data.geotips + '" target="_blank"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>GeoTips</a></div>'}
    </div>
    ${history.length > 0 ? `
    <div class="section hist-section">
      <div class="section-label">History</div>
      ${histHtml}
    </div>
    ` : ''}
    ` : '<div class="no-data"><div class="skeleton skeleton-lg"></div><div class="skeleton skeleton-sm"></div><div class="skeleton"></div><div class="no-data-text" style="margin-top:8px">Awaiting signal...</div></div>'}
  </div>
  <div class="footer">
    <div class="btn-row-3">
      <button class="btn" id="btnCopy">
        <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        COPY
      </button>
      <button class="btn" id="btnDownload">
        <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        JSON
      </button>
      <button class="btn" id="btnShare">
        <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        SHARE
      </button>
    </div>
  </div>
</div>
<script type="application/json" id="ov-data">${JSON.stringify({lat:Number(lat),lng:Number(long),dmsLat:toDMS(lat,true),dmsLng:toDMS(long,false),city:city||'',state:state||'',country:country||'',country_code:country_code||'',btnCopy:true,btnDownload:true,btnShare:true,hasMap:true})}<\/script>
<style>@keyframes markerPulse{0%{transform:scale(1);opacity:.6}100%{transform:scale(2.5);opacity:0}}</style>
<script src="panel-render.js"><\/script>
</body>
</html>`;
}

async function getCoordInfo() {
    try {
        var r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + long + '&zoom=18&accept-language=en');
        if (!r.ok) return null;
        return await r.json();
    } catch { return null; }
}

async function buildData(info) {
    var address = info ? (info.address || {}) : {};
    var countryCode = info ? (info.country_code || address.country_code || '') : '';
    var tz = getTimezone(lat, long);
    var dist = null;
    if (userGeolocated && userLat !== null) {
        var d = haversine(userLat, userLng, lat, long);
        dist = d >= 1000 ? (d / 1000).toFixed(1) + 'k km' : d.toFixed(0) + ' km';
    }
    var historyData = getHistory();

    var wiki = null;
    var climate = null;
    var population = null;
    var city = address.city || address.town || address.village || address.hamlet || address.municipality || address.county || '';
    var country = address.country || '';
    try {
        wiki = await getWikipedia(city, country);
    } catch {}
    try {
        climate = await getClimate(lat, long);
    } catch {}
    try {
        population = await getPopulation(country);
    } catch {}

    var data = {
        lat: lat,
        lng: long,
        coordsText: Math.abs(lat).toFixed(5) + '\u00B0 ' + (lat >= 0 ? 'N' : 'S') + '  ' + Math.abs(long).toFixed(5) + '\u00B0 ' + (long >= 0 ? 'E' : 'W'),
        dmsText: toDMS(lat, true) + '  ' + toDMS(long, false),
        city: city,
        state: address.state || address.region || '',
        country: country,
        country_code: countryCode,
        road: address.road || address.pedestrian || address.path || '',
        postcode: address.postcode || '',
        timezone: tz,
        distance: dist,
        history: historyData,
        wiki: wiki,
        climate: climate,
        population: population,
        drivingSide: getDrivingSide(countryCode),
        phoneCode: getPhoneCode(countryCode),
        emergency: getEmergency(countryCode),
        domain: getDomain(countryCode),
        language: getLanguage(countryCode),
        alphabet: getAlphabet(countryCode),
        geotips: getGeoTipsUrl(countryCode),
    };

    saveToHistory(data);
    return data;
}

function openOrFocusPopup(html) {
    try {
        document.dispatchEvent(new CustomEvent('ov-render', { detail: html }));
    } catch(e) {}
}

async function updatePopup() {
    if (lat === 999 && long === 999) return;
    const info = await getCoordInfo();
    const html = buildHTML(await buildData(info));
    openOrFocusPopup(html);
}

let wasInGame = false;
setInterval(() => {
    const isGame = document.querySelector('[class*="leaflet-container"]') ||
                   document.querySelector('[class*="guess-map"]') ||
                   document.querySelector('[data-testid="guess-button"]') ||
                   document.querySelector('[class*="pano_"]') ||
                   (location.pathname.includes('/game/') && document.querySelector('canvas'));
    if (wasInGame && !isGame) {
        popupOpened = false;
        lastProcessedLat = null;
        lastProcessedLng = null;
        lat = 999;
        long = 999;
    }
    wasInGame = !!isGame;
}, 2000);

document.addEventListener('keydown', async function (event) {
    if (lat == 999 && long == 999) return;
    if (event.ctrlKey && event.shiftKey && !popupOpened) updatePopup();
});
