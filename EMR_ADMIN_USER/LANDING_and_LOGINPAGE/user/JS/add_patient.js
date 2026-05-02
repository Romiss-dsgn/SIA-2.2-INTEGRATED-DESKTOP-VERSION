// ============================================================
// PHILIPPINE ADDRESS MODULE — add_patients.js
// API: psgc.gitlab.io (official PSGC, stable)
// ZIP: Comprehensive PhilPost lookup by PSGC code + name fallback
// Search: startsWith-first → instant "QUE" = "Quezon City" on top
// Highlight: matched characters are bolded in the dropdown
// Barangay ZIP: auto-fills ZIP from barangay name, falls back to city ZIP
// ============================================================

const PSGC_BASE = "https://psgc.gitlab.io/api/";

// ============================================================
// ZIP CODE LOOKUP TABLE (PhilPost official)
// Primary key: first 6 digits of PSGC city/municipality code
// ============================================================
const ZIP_TABLE = {
  // NCR
  "133901": "1000", "137601": "1100", "133801": "1400", "137401": "1740",
  "137501": "1200", "137701": "1470", "137801": "1550", "137901": "1800",
  "138001": "1770", "138101": "1485", "138301": "1700", "138401": "1300",
  "138501": "1600", "138601": "1620", "138701": "1500", "138801": "1630",
  "138901": "1440",
  // Region I
  "012801": "2900", "012802": "2906", "015504": "2700", "015518": "2517",
  "015532": "2500", "015511": "2400", "015505": "2404", "015533": "2428",
  "015516": "2401",
  // Region II
  "023103": "3500", "021501": "3305", "023109": "3311", "023104": "3300",
  // Region III
  "035401": "2009", "035402": "2200", "030801": "2100", "034901": "3100",
  "034902": "3105", "031401": "3000", "031403": "3020", "031404": "3023",
  "030201": "3200",
  // Region IV-A
  "042101": "4102", "042103": "4100", "042105": "4114", "042107": "4107",
  "042108": "4103", "042113": "4120", "042114": "4109", "043401": "1870",
  "043402": "1900", "043403": "1920", "041201": "4200", "041204": "4217",
  "041214": "4232", "042701": "4027", "042706": "4000", "042709": "4023",
  "042710": "4026", "042702": "4024", "043601": "4301",
  // Region V
  "050501": "4500", "054801": "4400", "050505": "4431", "050504": "4511",
  "054101": "5400", "056201": "4700",
  // Region VI
  "063001": "5000", "061401": "5800", "060401": "6100", "060403": "6101",
  "060404": "6121", "060406": "6111", "060407": "6130", "060409": "6122",
  "060410": "6116", "060412": "6045", "060413": "6119",
  // Region VII
  "072217": "6000", "072204": "6004", "072209": "6015", "072211": "6014",
  "072221": "6038", "074617": "6200", "071201": "6300",
  // Region VIII
  "083701": "6500", "083708": "6541", "083704": "6521", "086001": "6700",
  "086301": "6710",
  // Region IX
  "097301": "7000", "097201": "7101", "097202": "7100", "097601": "7016",
  // Region X
  "104301": "9000", "104303": "9014", "102201": "9200", "104501": "7200",
  "101401": "8700",
  // Region XI
  "112401": "8000", "112403": "8002", "118201": "8200", "112301": "8100",
  // Region XII
  "124701": "9600", "124702": "9400", "124704": "9506", "124301": "9500",
  "124306": "9800",
  // Region XIII
  "160201": "8600", "166701": "8400", "166702": "8300",
  // CAR
  "141401": "2600", "142701": "3800",
  // BARMM
  "153601": "9700",
  // MIMAROPA
  "175801": "5300",
};

// Fallback by lowercase city name (handles edge cases + name variants)
const ZIP_BY_NAME = {
  "manila": "1000", "quezon city": "1100", "quezon": "1100",
  "caloocan": "1400", "las piñas": "1740", "las pinas": "1740",
  "makati": "1200", "malabon": "1470", "mandaluyong": "1550",
  "marikina": "1800", "muntinlupa": "1770", "navotas": "1485",
  "parañaque": "1700", "paranaque": "1700", "pasay": "1300",
  "pasig": "1600", "pateros": "1620", "san juan": "1500",
  "taguig": "1630", "valenzuela": "1440",
  "laoag": "2900", "batac": "2906", "vigan": "2700", "candon": "2517",
  "san fernando": "2500", "dagupan": "2400", "alaminos": "2404",
  "urdaneta": "2428", "lingayen": "2401",
  "tuguegarao": "3500", "cauayan": "3305", "santiago": "3311", "ilagan": "3300",
  "angeles": "2009", "olongapo": "2200", "balanga": "2100",
  "cabanatuan": "3100", "gapan": "3105", "malolos": "3000",
  "meycauayan": "3020", "san jose del monte": "3023", "baler": "3200",
  "bacoor": "4102", "cavite": "4100", "dasmariñas": "4114", "dasmarinas": "4114",
  "general trias": "4107", "imus": "4103", "tagaytay": "4120",
  "trece martires": "4109", "antipolo": "1870", "cainta": "1900",
  "taytay": "1920", "batangas": "4200", "lipa": "4217", "tanauan": "4232",
  "calamba": "4027", "san pablo": "4000", "san pedro": "4023",
  "santa rosa": "4026", "biñan": "4024", "binan": "4024", "lucena": "4301",
  "legazpi": "4500", "naga": "4400", "iriga": "4431", "tabaco": "4511",
  "masbate": "5400", "sorsogon": "4700",
  "iloilo": "5000", "roxas": "5800", "bacolod": "6100", "bago": "6101",
  "cadiz": "6121", "kabankalan": "6111", "la carlota": "6130",
  "sagay": "6122", "silay": "6116", "talisay": "6045", "victorias": "6119",
  "cebu": "6000", "danao": "6004", "lapu-lapu": "6015", "lapulapu": "6015",
  "mandaue": "6014", "toledo": "6038", "dumaguete": "6200", "tagbilaran": "6300",
  "tacloban": "6500", "ormoc": "6541", "baybay": "6521",
  "catbalogan": "6700", "calbayog": "6710",
  "zamboanga": "7000", "dapitan": "7101", "dipolog": "7100", "pagadian": "7016",
  "cagayan de oro": "9000", "gingoog": "9014", "iligan": "9200",
  "ozamiz": "7200", "malaybalay": "8700",
  "davao": "8000", "digos": "8002", "mati": "8200", "tagum": "8100",
  "cotabato": "9600", "kidapawan": "9400", "koronadal": "9506",
  "general santos": "9500", "tacurong": "9800",
  "butuan": "8600", "surigao": "8400", "tandag": "8300",
  "baguio": "2600", "tabuk": "3800", "marawi": "9700", "puerto princesa": "5300",
};

// ============================================================
// BARANGAY ZIP LOOKUP TABLE (PhilPost — barangay-level ZIPs)
// Key: lowercase barangay name  Value: ZIP code
// These are barangays that have their own distinct ZIP from their city.
// If a barangay is not listed here, the city ZIP is used as fallback.
// ============================================================
const BARANGAY_ZIP = {
  // Manila barangays (1001–1096)
  "tondo": "1012", "binondo": "1006", "quiapo": "1001", "sampaloc": "1008",
  "santa cruz": "1003", "san nicolas": "1010", "port area": "1018",
  "intramuros": "1002", "ermita": "1000", "malate": "1004",
  "paco": "1007", "pandacan": "1011", "santa ana": "1009",
  "san andres": "1015",

  // Quezon City barangays (1100–1135)
  "commonwealth": "1119", "fairview": "1118", "novaliches": "1117",
  "batasan hills": "1126", "payatas": "1119", "bagong silangan": "1119",
  "tandang sora": "1116", "east triangle": "1101", "west triangle": "1104",
  "san bartolome": "1116", "apolonio samson": "1106",
  "diliman": "1101", "central": "1100", "cubao": "1109",
  "kamuning": "1103", "kristong hari": "1111", "loyola heights": "1108",
  "new manila": "1112", "philam": "1104", "pinyahan": "1100",
  "quirino 2-a": "1113", "quirino 3-a": "1114", "roxas": "1107",
  "sacred heart": "1115", "san isidro labrador": "1114",
  "santa teresita": "1115", "talipapa": "1116",
  "teachers village east": "1101", "teachers village west": "1101",
  "white plains": "1110", "bagong pag-asa": "1105",
  "balingasa": "1115", "bungad": "1105", "damayang lagi": "1112",
  "don manuel": "1113", "escopa": "1109",
  "greater lagro": "1118", "gulod": "1117",
  "holy spirit": "1127", "immaculate concepcion": "1111",
  "la loma": "1114", "laging handa": "1103",
  "manresa": "1115", "maharlika": "1111",
  "old capitol site": "1101", "pag-ibig sa nayon": "1118",
  "pasong putik": "1118", "pasong tamo": "1107",
  "project 6": "1100", "project 7": "1105", "project 8": "1106",
  "san agustin": "1117", "san antonio": "1105",
  "sangandaan": "1116", "sauyo": "1116",
  "sienna": "1119", "silangan": "1119",
  "tagumpay": "1109", "ugong norte": "1110",
  "villa maria clara": "1109", "pinagkaisahan": "1111",

  // Makati barangays (1200–1235)
  "ayala alabang": "1209", "bangkal": "1233",
  "bel-air": "1209", "carmona": "1202",
  "cembo": "1213", "comembo": "1213",
  "dasmariñas": "1214", "dasmarinas village": "1214",
  "east rembo": "1213", "forbes park": "1201",
  "guadalupe nuevo": "1212", "guadalupe viejo": "1211",
  "kasilawan": "1210", "la paz": "1204",
  "magallanes": "1232", "olympia": "1207",
  "palanan": "1235", "pembo": "1218",
  "pinagkaisahan": "1215", "pio del pilar": "1230",
  "pitogo": "1214", "post proper northside": "1213",
  "post proper southside": "1213", "rizal": "1210",
  "rockwell": "1210", "san antonio": "1203",
  "san isidro": "1234", "san lorenzo": "1223",
  "santa cruz": "1201", "singkamas": "1208",
  "south cembo": "1213", "tejeros": "1233",
  "urdaneta": "1222", "valenzuela": "1206",
  "west rembo": "1216",

  // Pasig barangays (1600–1612)
  "bagong ilog": "1600", "bagong katipunan": "1609",
  "bambang": "1607", "buting": "1602",
  "caniogan": "1603", "dela paz": "1600",
  "kalawaan": "1600", "kapasigan": "1600",
  "kapitolyo": "1603", "malinao": "1600",
  "manggahan": "1611", "maybunga": "1607",
  "oranbo": "1600", "ortigas center": "1605",
  "palatiw": "1606", "pinagbuhatan": "1600",
  "pineda": "1600", "rosario": "1609",
  "sagad": "1611", "san antonio": "1600",
  "san joaquin": "1601", "san jose": "1600",
  "san miguel": "1600", "san nicolas": "1600",
  "santa lucia": "1608", "santa rosa": "1600",
  "santo tomas": "1600", "santolan": "1610",
  "sumilang": "1600", "ugong": "1604",

  // Taguig barangays (1630–1637)
  "bgc": "1634", "bonifacio global city": "1634",
  "fort bonifacio": "1634", "ususan": "1637",
  "tuktukan": "1637", "hagonoy": "1636",
  "ligid-tipas": "1631", "napindan": "1632",
  "palingon": "1637", "san miguel": "1636",
  "santa ana": "1637", "tanyag": "1635",
  "upper bicutan": "1634", "western bicutan": "1633",
  "wawa": "1638",

  // Mandaluyong barangays (1550)
  "barangka": "1550", "buayang bato": "1550",
  "addition hills": "1550", "bagong silang": "1550",
  "hulo": "1550", "mauway": "1550",
  "plainview": "1550", "poblacion": "1550",
  "pag-asa": "1550",

  // Marikina barangays (1800–1811)
  "calumpang": "1808", "concepcion uno": "1810",
  "concepcion dos": "1811", "fortune": "1812",
  "nangka": "1800", "parang": "1809",
  "san roque": "1800", "santa elena": "1800",

  // Parañaque barangays (1700–1720)
  "bf homes": "1720", "don bosco": "1707",
  "don galo": "1713", "merville": "1709",
  "moonshine": "1716", "san antonio": "1706",
  "tambo": "1701", "baclaran": "1300",
  "sunville": "1714",

  // Las Piñas barangays (1740–1750)
  "almanza uno": "1750", "almanza dos": "1750",
  "bf international": "1743", "elias aldana": "1741",
  "manuyo uno": "1746", "pamplona uno": "1743",
  "pamplona dos": "1744", "pamplona tres": "1744",
  "pilar": "1745", "pulang lupa uno": "1747",
  "pulang lupa dos": "1747", "talon uno": "1748",
  "talon dos": "1748", "talon tres": "1748",
  "talon kwatro": "1749", "talon singko": "1749",

  // Muntinlupa barangays (1770–1781)
  "alabang": "1770", "bayanan": "1773",
  "buli": "1776", "cupang": "1771",
  "putatan": "1772", "sucat": "1770",
  "tunasan": "1774", "ayala alabang": "1780",

  // Caloocan barangays
  "bagong silang": "1428", "camarin": "1422",
  "deparo": "1424", "grace park east": "1403",
  "grace park west": "1406", "maypajo": "1409",

  // Valenzuela barangays (1440–1465)
  "arkong bato": "1441", "bignay": "1442",
  "bisig": "1443", "canumay east": "1444",
  "canumay west": "1444", "coloong": "1445",
  "dalandanan": "1446", "gen. t. de leon": "1442",
  "isla": "1447", "karuhatan": "1441",
  "lawang bato": "1447", "lingunan": "1453",
  "mabolo": "1448", "malanday": "1445",
  "malinta": "1449", "mapulang lupa": "1446",
  "marulas": "1450", "maysan": "1451",
  "palasan": "1452", "paso de blas": "1440",
  "pasolo": "1440", "pulo": "1454",
  "punturin": "1440", "rincon": "1455",
  "tagalag": "1456", "ugong": "1457",
  "veinte reales": "1440",

  // Cebu City barangays (6000)
  "apas": "6000", "banilad": "6000",
  "capitol site": "6000", "cogon ramos": "6000",
  "guadalupe": "6000", "lahug": "6000",
  "mabolo": "6000", "mambaling": "6000",
  "pardo": "6000", "pasil": "6000",
  "talamban": "6000", "tinago": "6000",
  "zapatera": "6000",

  // Davao City barangays (8000)
  "agdao": "8000", "buhangin": "8000",
  "bunawan": "8000", "catalunan grande": "8000",
  "catalunan pequeño": "8000", "lanang": "8000",
  "maa": "8000", "panacan": "8000",
  "sasa": "8000", "talomo": "8000",
  "toril": "8000",

  // Cagayan de Oro barangays (9000)
  "agusan": "9000", "bulua": "9000",
  "camaman-an": "9000", "carmen": "9000",
  "gusa": "9000", "lapasan": "9000",
  "lumbia": "9000", "macabalan": "9000",
  "macasandig": "9000", "nazareth": "9000",
  "tablon": "9000",

  // General Santos barangays (9500)
  "apopong": "9500", "buayan": "9500",
  "bula": "9500", "calumpang": "9500",
  "dadiangas east": "9500", "dadiangas norte": "9500",
  "dadiangas south": "9500", "dadiangas west": "9500",
  "fatima": "9500", "labangal": "9500",
  "lagao": "9500", "tambler": "9500",

  // Iloilo City barangays (5000)
  "arevalo": "5000", "lapaz": "5000",
  "mandurriao": "5000", "molo": "5000",
  "poblacion": "5000",

  // Bacolod barangays (6100)
  "alangilan": "6100", "alijis": "6100",
  "banago": "6100", "bata": "6100",
  "mandalagan": "6100", "mansilingan": "6100",
  "taculing": "6100", "villamonte": "6100",

  // Baguio barangays (2600)
  "aurora hill": "2600", "cabinet hill": "2600",
  "camp 7": "2600", "camp 8": "2600",
  "camp allen": "2600", "city camp central": "2600",
  "engineers hill": "2600", "holy ghost proper": "2600",
  "honeymoon": "2600", "irisan": "2600",
  "pacdal": "2600", "session road area": "2600",
  "quezon hill proper": "2600",
};

/**
 * Resolves ZIP code from PSGC city/municipality code and/or name.
 * Tries code lookup first (first 6 digits), then name fallback.
 * Also strips " City" suffix for fallback matching.
 */
function getZipCode(cityName, cityCode) {
  const code6 = (cityCode || "").toString().replace(/\D/g, "").substring(0, 6);
  if (code6 && ZIP_TABLE[code6]) return ZIP_TABLE[code6];

  const name = (cityName || "").toLowerCase().trim();
  if (ZIP_BY_NAME[name]) return ZIP_BY_NAME[name];

  const stripped = name.replace(/\s+city$/i, "").trim();
  return ZIP_BY_NAME[stripped] || "";
}

/**
 * Resolves ZIP code from barangay name.
 * Falls back to the current city ZIP if barangay not found in the table.
 */
function getZipFromBarangay(barangayName, fallbackCityZip) {
  const name = (barangayName || "").toLowerCase().trim();
  return BARANGAY_ZIP[name] || fallbackCityZip || "";
}

// ============================================================
// SHARED STATE
// ============================================================
let allCitiesCache   = null;
let currentBarangays = [];
let selectedCityCode = null;
let currentCityZip   = "";   // ← tracks the ZIP of the currently selected city

// ============================================================
// STYLES
// ============================================================
function injectStyles() {
  if (document.getElementById("ph-combo-style")) return;
  const s = document.createElement("style");
  s.id = "ph-combo-style";
  s.textContent = `
    .ph-combo-wrap { position: relative; display: block; }
    .ph-combo-wrap input.ph-combo-input {
      width: 100%; box-sizing: border-box;
      padding-right: 30px !important; cursor: pointer;
    }
    .ph-combo-wrap input.ph-combo-input:disabled { cursor: not-allowed; opacity: 0.6; }
    .ph-combo-arrow {
      position: absolute; right: 10px; top: 50%;
      transform: translateY(-50%); pointer-events: none;
      color: #888; font-size: 10px; transition: transform 0.2s;
    }
    .ph-combo-wrap.ph-open .ph-combo-arrow {
      transform: translateY(-50%) rotate(180deg);
    }
    .ph-combo-drop {
      position: absolute; top: calc(100% + 3px); left: 0; right: 0;
      background: #fff; border: 1.5px solid #2e7d32; border-radius: 8px;
      z-index: 99999; box-shadow: 0 8px 24px rgba(0,0,0,0.15); overflow: hidden;
    }
    .ph-combo-search-wrap {
      padding: 8px 8px 6px; border-bottom: 1px solid #e8f5e9; background: #f9fdf9;
    }
    .ph-combo-search-wrap input {
      width: 100%; box-sizing: border-box; border: 1px solid #c8e6c9;
      border-radius: 6px; padding: 6px 10px; font-size: 13px;
      outline: none; background: #fff; font-family: inherit;
    }
    .ph-combo-search-wrap input:focus {
      border-color: #2e7d32; box-shadow: 0 0 0 2px rgba(46,125,50,0.12);
    }
    .ph-combo-list { max-height: 220px; overflow-y: auto; }
    .ph-combo-item {
      padding: 9px 13px; cursor: pointer; font-size: 13.5px; color: #333;
      border-bottom: 1px solid #f5f5f5; transition: background 0.1s;
      display: flex; align-items: center; justify-content: space-between;
    }
    .ph-combo-item:last-child { border-bottom: none; }
    .ph-combo-item:hover, .ph-combo-item.ph-selected {
      background: #e8f5e9; color: #1b5e20; font-weight: 500;
    }
    .ph-combo-item mark {
      background: #fff176; color: #1b5e20; font-weight: 700;
      border-radius: 2px; padding: 0 1px; font-style: normal;
    }
    .ph-zip-badge {
      font-size: 11px; background: #e8f5e9; color: #2e7d32;
      border-radius: 4px; padding: 2px 6px; margin-left: 8px;
      white-space: nowrap; flex-shrink: 0;
    }
    .ph-combo-empty, .ph-combo-loading {
      padding: 12px 13px; font-size: 13px; color: #aaa;
      text-align: center; font-style: italic;
    }
    .ph-combo-loading { color: #888; }
  `;
  document.head.appendChild(s);
}

// ============================================================
// HIGHLIGHT HELPER
// ============================================================
function highlightMatch(text, query) {
  if (!query) return document.createTextNode(text);
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return document.createTextNode(text);
  const frag = document.createDocumentFragment();
  if (idx > 0) frag.appendChild(document.createTextNode(text.slice(0, idx)));
  const mark = document.createElement("mark");
  mark.textContent = text.slice(idx, idx + query.length);
  frag.appendChild(mark);
  frag.appendChild(document.createTextNode(text.slice(idx + query.length)));
  return frag;
}

// ============================================================
// SMART FILTER — startsWith results appear first
// ============================================================
function smartFilter(items, query) {
  if (!query) return items;
  const q = query.toLowerCase();
  const starts   = items.filter(i => i.label.toLowerCase().startsWith(q));
  const contains = items.filter(i =>
    !i.label.toLowerCase().startsWith(q) && i.label.toLowerCase().includes(q)
  );
  return [...starts, ...contains];
}

// ============================================================
// COMBOBOX FACTORY
// ============================================================
function makeCombobox(inputEl, { placeholder, onSelect, onOpen }) {
  if (inputEl.parentElement.classList.contains("ph-combo-wrap")) return null;

  const wrap = document.createElement("div");
  wrap.className = "ph-combo-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  inputEl.classList.add("ph-combo-input");
  inputEl.setAttribute("autocomplete", "off");
  inputEl.setAttribute("readonly", "true");

  const arrow = document.createElement("span");
  arrow.className = "ph-combo-arrow";
  arrow.innerHTML = "&#9660;";
  wrap.appendChild(arrow);

  const drop = document.createElement("div");
  drop.className = "ph-combo-drop";
  drop.style.display = "none";
  wrap.appendChild(drop);

  const searchWrap = document.createElement("div");
  searchWrap.className = "ph-combo-search-wrap";
  const searchBox = document.createElement("input");
  searchBox.type = "text";
  searchBox.placeholder = placeholder || "Type to search…";
  searchBox.setAttribute("autocomplete", "off");
  searchWrap.appendChild(searchBox);
  drop.appendChild(searchWrap);

  const list = document.createElement("div");
  list.className = "ph-combo-list";
  drop.appendChild(list);

  let allItems = [];
  let isOpen   = false;

  function renderList(filterText = "") {
    list.innerHTML = "";
    const filtered = smartFilter(allItems, filterText);

    if (filtered.length === 0) {
      const el = document.createElement("div");
      el.className = "ph-combo-empty";
      el.textContent = filterText ? "Walang nahanap" : "Wala pang options";
      list.appendChild(el);
      return;
    }

    filtered.forEach(item => {
      const el = document.createElement("div");
      el.className = "ph-combo-item";
      if (inputEl.value === item.label) el.classList.add("ph-selected");

      const labelSpan = document.createElement("span");
      labelSpan.appendChild(highlightMatch(item.label, filterText));
      el.appendChild(labelSpan);

      if (item.zip) {
        const badge = document.createElement("span");
        badge.className = "ph-zip-badge";
        badge.textContent = item.zip;
        el.appendChild(badge);
      }

      el.addEventListener("mousedown", e => {
        e.preventDefault();
        inputEl.value = item.label;
        closeDropdown();
        if (onSelect) onSelect(item);
      });
      list.appendChild(el);
    });
  }

  function showLoading(msg = "Loading…") {
    list.innerHTML = `<div class="ph-combo-loading">${msg}</div>`;
  }

  function openDropdown() {
    if (isOpen || inputEl.disabled) return;
    isOpen = true;
    wrap.classList.add("ph-open");
    drop.style.display = "block";
    searchBox.value = "";
    if (onOpen) {
      onOpen({ showLoading, renderList, setItems(items) { allItems = items; } });
    } else {
      renderList();
    }
    requestAnimationFrame(() => searchBox.focus());
  }

  function closeDropdown() {
    if (!isOpen) return;
    isOpen = false;
    wrap.classList.remove("ph-open");
    drop.style.display = "none";
    searchBox.value = "";
  }

  inputEl.addEventListener("click", e => { e.stopPropagation(); isOpen ? closeDropdown() : openDropdown(); });
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!isOpen) openDropdown(); return; }
    if (!isOpen && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      openDropdown();
      setTimeout(() => { searchBox.value = e.key; renderList(e.key); searchBox.focus(); }, 80);
    }
  });
  searchBox.addEventListener("input", () => renderList(searchBox.value));
  searchBox.addEventListener("keydown", e => { if (e.key === "Escape") { closeDropdown(); inputEl.focus(); } });
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) closeDropdown(); });

  return {
    open:  openDropdown,
    close: closeDropdown,
    setItems(items) { allItems = items; if (isOpen) renderList(searchBox.value); },
    clear() { inputEl.value = ""; allItems = []; },
  };
}

// ============================================================
// PSGC DATA LOADERS
// ============================================================
async function loadAllCities() {
  if (allCitiesCache) return allCitiesCache;
  try {
    const res = await fetch(`${PSGC_BASE}/cities-municipalities.json`);
    if (res.ok) {
      const data = await res.json();
      allCitiesCache = data.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (err) {
    console.warn("PSGC cities load failed:", err);
    allCitiesCache = [];
  }
  return allCitiesCache || [];
}

async function loadBarangaysForCity(code) {
  try {
    const res = await fetch(`${PSGC_BASE}/cities-municipalities/${code}/barangays.json`);
    if (res.ok) {
      const data = await res.json();
      return data.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (err) {
    console.warn("PSGC barangays load failed:", err);
  }
  return [];
}

// ============================================================
// INIT COMBOBOXES
// ============================================================
let cityCombo     = null;
let barangayCombo = null;

function initAddressComboboxes() {
  const cityInput     = document.getElementById("city");
  const barangayInput = document.getElementById("barangay");
  const zipcodeInput  = document.getElementById("zipcode");
  if (!cityInput || !barangayInput) return;

  // ---- BARANGAY COMBOBOX ----
  barangayCombo = makeCombobox(barangayInput, {
    placeholder: "Hanapin ang barangay…",
    onSelect(item) {
      // Auto-fill ZIP from barangay lookup, fall back to city ZIP
      if (zipcodeInput) {
        zipcodeInput.value = getZipFromBarangay(item.label, currentCityZip);
      }
    },
    onOpen({ showLoading, renderList, setItems }) {
      if (currentBarangays.length === 0) {
        showLoading("Pumili muna ng city…");
        return;
      }
      const items = currentBarangays.map(b => ({
        label: b.name,
        value: b.code,
        zip:   getZipFromBarangay(b.name, currentCityZip),
      }));
      setItems(items);
      renderList();
    },
  });

  // ---- CITY COMBOBOX ----
  cityCombo = makeCombobox(cityInput, {
    placeholder: "Hanapin ang city o municipality…",
    onSelect: async item => {
      selectedCityCode = item.value;

      // Auto-fill ZIP from city lookup, remember as fallback for barangays
      const cityZip = getZipCode(item.label, item.value);
      currentCityZip = cityZip;
      if (zipcodeInput) {
        zipcodeInput.value = cityZip;
      }

      // Reset barangay
      barangayInput.value = "";
      currentBarangays = [];
      if (barangayCombo) barangayCombo.setItems([]);

      // Load barangays
      barangayInput.placeholder = "Loading barangays…";
      currentBarangays = await loadBarangaysForCity(selectedCityCode);
      barangayInput.placeholder = "Pumili ng barangay";
      if (barangayCombo) {
        barangayCombo.setItems(
          currentBarangays.map(b => ({
            label: b.name,
            value: b.code,
            zip:   getZipFromBarangay(b.name, currentCityZip),
          }))
        );
      }
    },
    onOpen: async ({ showLoading, renderList, setItems }) => {
      showLoading("Loading cities…");
      const cities = await loadAllCities();
      const items = cities.map(c => ({
        label: c.name,
        value: c.code,
        zip:   getZipCode(c.name, c.code),
      }));
      setItems(items);
      renderList();
    },
  });

  loadAllCities(); // preload in background
}

document.addEventListener("DOMContentLoaded", () => {
  injectStyles();
  initAddressComboboxes();
});

// ============================================================
// FORM SUBMIT
// ============================================================
document.getElementById("addPatient").addEventListener("submit", async function (e) {
  e.preventDefault();

  const phone   = document.getElementById("phone").value;
  const emPhone = document.getElementById("em_phone").value;
  const zipcode = document.getElementById("zipcode").value;
  const dob     = document.getElementById("dob").value;
  const email   = document.getElementById("email").value.trim();
  const emEmail = document.getElementById("em_email").value.trim();

  if (!/^\d{11}$/.test(phone))           { alert("Phone number must be exactly 11 digits"); return; }
  if (emPhone && !/^\d{11}$/.test(emPhone)) { alert("Emergency phone number must be exactly 11 digits"); return; }
  if (!/^\d{4}$/.test(zipcode))          { alert("Zip code must be exactly 4 digits"); return; }
  if (new Date(dob) > new Date())        { alert("Date of birth cannot be in the future"); return; }

  const gmailRegex = /^[^\s@]+@gmail\.com$/i;
  if (email && !gmailRegex.test(email))     { alert("The primary email address must be a valid @gmail.com account."); return; }
  if (emEmail && !gmailRegex.test(emEmail)) { alert("The emergency contact email must be a valid @gmail.com account if provided."); return; }

  if (email) {
    try {
      const chk = await fetch("http://localhost:5000/api/patients");
      if (chk.ok) {
        const list = await chk.json();
        const dup = list.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());
        if (dup) { alert("This email address is already registered. Please use a different email."); return; }
      }
    } catch (err) { console.error("Duplicate check error:", err); }
  }

  const formData = {
    firstname:    document.getElementById("firstname").value.trim(),
    middlename:   document.getElementById("middlename").value.trim() || null,
    lastname:     document.getElementById("lastname").value.trim(),
    dob, gender: document.getElementById("gender").value,
    address:      document.getElementById("address").value.trim(),
    city:         document.getElementById("city").value.trim(),
    barangay:     document.getElementById("barangay").value.trim(),
    zipcode, email: email || null, phone,
    em_fullname:  document.getElementById("em_fullname").value.trim(),
    em_phone:     emPhone,
    relationship: document.getElementById("relationship").value.trim(),
    em_email:     emEmail || null,
  };

  try {
    const response = await fetch("http://localhost:5000/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      alert(result.message);
      if (response.ok) window.location.href = "Patients.html";
    } catch {
      console.error("Non-JSON response:", text);
      alert("Server returned non-JSON response. Check backend URL.");
    }
  } catch (err) { alert("Network error: " + err.message); }
});

// ============================================================
// REAL-TIME INPUT VALIDATION
// ============================================================
document.getElementById("phone").addEventListener("input", function () {
  this.value = this.value.replace(/\D/g, "").slice(0, 11);
});
document.getElementById("em_phone").addEventListener("input", function () {
  this.value = this.value.replace(/\D/g, "").slice(0, 11);
});
document.getElementById("zipcode").addEventListener("input", function () {
  this.value = this.value.replace(/\D/g, "").slice(0, 4);
});
["firstname", "middlename", "lastname", "em_fullname"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("input", function () {
    this.value = this.value.replace(/[^A-Za-zÑñ\s\-']/g, "");
  });
});
document.getElementById("dob").setAttribute("max", new Date().toISOString().split("T")[0]);