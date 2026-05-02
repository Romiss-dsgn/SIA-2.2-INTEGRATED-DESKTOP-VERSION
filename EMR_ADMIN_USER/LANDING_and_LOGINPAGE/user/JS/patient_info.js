// ============================================================
// PHILIPPINE ADDRESS MODULE — patient_info.js
// API: psgc.gitlab.io (official PSGC, stable)
// ZIP: Comprehensive PhilPost lookup by PSGC code + name fallback
// Search: startsWith-first → instant "QUE" = "Quezon City" on top
// Highlight: matched characters are bolded in the dropdown
// Barangay ZIP: auto-fills ZIP from barangay name, falls back to city ZIP
// ============================================================

const PSGC_BASE = "https://psgc.gitlab.io/api/";

// ============================================================
// ZIP CODE LOOKUP TABLE (PhilPost official)
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
  "barangka": "1800", "calumpang": "1808",
  "concepcion uno": "1810", "concepcion dos": "1811",
  "fortune": "1812", "industrial valley": "1800",
  "jesus dela peña": "1800", "malanday": "1800",
  "nangka": "1800", "parang": "1809",
  "san roque": "1800", "santa elena": "1800",
  "tañong": "1800",

  // Parañaque barangays (1700–1720)
  "bf homes": "1720", "don bosco": "1707",
  "don galo": "1713", "la huerta": "1700",
  "marcelo green": "1700", "merville": "1709",
  "moonshine": "1716", "san antonio": "1706",
  "san dionisio": "1700", "san isidro": "1700",
  "san martin de porres": "1700", "san pedro": "1700",
  "tambo": "1701", "vitalez": "1700",
  "baclaran": "1300", "sunville": "1714",

  // Las Piñas barangays (1740–1750)
  "almanza uno": "1750", "almanza dos": "1750",
  "bf international": "1743", "daniel fajardo": "1740",
  "elias aldana": "1741", "ilaya": "1740",
  "manuyo uno": "1746", "pamplona uno": "1743",
  "pamplona dos": "1744", "pamplona tres": "1744",
  "pilar": "1745", "pulang lupa uno": "1747",
  "pulang lupa dos": "1747", "talon uno": "1748",
  "talon dos": "1748", "talon tres": "1748",
  "talon kwatro": "1749", "talon singko": "1749",
  "zapote": "1740",

  // Muntinlupa barangays (1770–1781)
  "alabang": "1770", "bayanan": "1773",
  "buli": "1776", "cupang": "1771",
  "poblacion": "1776", "putatan": "1772",
  "sucat": "1770", "tunasan": "1774",
  "ayala alabang": "1780",

  // Caloocan barangays
  "bagong silang": "1428", "camarin": "1422",
  "deparo": "1424", "grace park east": "1403",
  "grace park west": "1406", "maypajo": "1409",
  "monumento": "1400", "novaliches": "1422",
  "sangandaan": "1400",

  // Valenzuela barangays (1440–1465)
  "arkong bato": "1441", "bignay": "1442",
  "bisig": "1443", "canumay east": "1444",
  "canumay west": "1444", "coloong": "1445",
  "dalandanan": "1446", "hen. t. de leon": "1442",
  "isla": "1447", "karuhatan": "1441",
  "lawang bato": "1447", "lingunan": "1453",
  "mabolo": "1448", "malanday": "1445",
  "malinta": "1449", "mapulang lupa": "1446",
  "marulas": "1450", "maysan": "1451",
  "palasan": "1452", "pariancillo villa": "1453",
  "paso de blas": "1440", "pasolo": "1440",
  "poblacion": "1460", "pulo": "1454",
  "punturin": "1440", "rincon": "1455",
  "tagalag": "1456", "ugong": "1457",
  "veinte reales": "1440", "wawang pulo": "1440",

  // Cebu City barangays (6000–6009)
  "apas": "6000", "banilad": "6000",
  "basak pardo": "6000", "basak san nicolas": "6000",
  "busay": "6000", "calamba": "6001",
  "capitol site": "6000", "carreta": "6000",
  "cogon ramos": "6000", "duljo": "6000",
  "ermita": "6000", "guadalupe": "6000",
  "guba": "6000", "inayawan": "6000",
  "kasambagan": "6000", "kinasang-an": "6000",
  "labangon": "6000", "lahug": "6000",
  "lorega": "6000", "lusaran": "6000",
  "luz": "6000", "mabini": "6000",
  "mabolo": "6000", "malubog": "6000",
  "mambaling": "6000", "pahina central": "6000",
  "pahina san nicolas": "6000", "pamutan": "6000",
  "pardo": "6000", "pari-an": "6000",
  "paril": "6000", "pasil": "6000",
  "pit-os": "6000", "poblacion lahug": "6000",
  "pung-ol-sibugay": "6000", "punta princesa": "6000",
  "quiot pardo": "6000", "sambag i": "6000",
  "sambag ii": "6000", "san antonio": "6000",
  "san jose": "6000", "san nicolas central": "6000",
  "san roque": "6000", "santa cruz": "6000",
  "sinsin": "6000", "suba": "6000",
  "sudlon i": "6000", "sudlon ii": "6000",
  "talamban": "6000", "taptap": "6000",
  "tejero": "6000", "tinago": "6000",
  "to-ong pardo": "6000", "zapatera": "6000",

  // Davao City barangays (8000)
  "agdao": "8000", "buhangin": "8000",
  "bunawan": "8000", "calinan": "8000",
  "catalunan grande": "8000", "catalunan pequeño": "8000",
  "centro": "8000", "communal": "8000",
  "cugman": "8000", "daliaon plantation": "8000",
  "indangan": "8000", "lacson": "8000",
  "lanang": "8000", "lasang": "8000",
  "leon garcia": "8000", "lizada": "8000",
  "lubogan": "8000", "maa": "8000",
  "mabuhay": "8000", "malagos": "8000",
  "malamba": "8000", "mandug": "8000",
  "mintal": "8000", "mudiang": "8000",
  "mulig": "8000", "panacan": "8000",
  "paquibato": "8000", "poblacion": "8000",
  "riverside": "8000", "san antonio": "8000",
  "santo niño": "8000", "sasa": "8000",
  "sirawan": "8000", "suawan": "8000",
  "talomo": "8000", "tibungco": "8000",
  "tigatto": "8000", "toril": "8000",
  "tugbok": "8000", "waan": "8000",

  // Cagayan de Oro barangays (9000)
  "agusan": "9000", "balubal": "9000",
  "bayabas": "9000", "bonbon": "9000",
  "bugo": "9000", "bulua": "9000",
  "camaman-an": "9000", "carmen": "9000",
  "canitoan": "9000", "consolacion": "9000",
  "corporate": "9000", "cowboy": "9000",
  "dansolihon": "9000", "de oro": "9000",
  "diversion": "9000", "echavez": "9000",
  "gusa": "9000", "iponan": "9000",
  "kauswagan": "9000", "lalawigan": "9000",
  "lapasan": "9000", "lumbia": "9000",
  "macabalan": "9000", "macasandig": "9000",
  "mambuaya": "9000", "nazareth": "9000",
  "pagalungan": "9000", "pagatpat": "9000",
  "patag": "9000", "san simon": "9000",
  "tablon": "9000", "taglimao": "9000",
  "tignapoloan": "9000", "tuburan": "9000",
  "tumpagon": "9000", "upper carmen": "9000",
  "west": "9000",

  // General Santos barangays (9500)
  "apopong": "9500", "baluan": "9500",
  "batomelong": "9500", "buayan": "9500",
  "bula": "9500", "calumpang": "9500",
  "catitipan": "9500", "conel": "9500",
  "dadiangas east": "9500", "dadiangas norte": "9500",
  "dadiangas south": "9500", "dadiangas west": "9500",
  "fatima": "9500", "katangawan": "9500",
  "labangal": "9500", "lagao": "9500",
  "ligaya": "9500", "mabuhay": "9500",
  "olympog": "9500", "san isidro": "9500",
  "san jose": "9500", "sinawal": "9500",
  "tambler": "9500", "united muslim": "9500",

  // Iloilo City barangays (5000)
  "arevalo": "5000", "bonifacio": "5000",
  "concepcion arroceros": "5000", "cuartero": "5000",
  "dungon": "5000", "guzman": "5000",
  "habog-habog": "5000", "hibao-an": "5000",
  "iloilo city proper": "5000", "jalandoni estate": "5000",
  "jibao-an": "5000", "lapaz": "5000",
  "leganes": "5000", "libertad": "5000",
  "luna": "5000", "maasin": "5000",
  "mandurriao": "5000", "molo": "5000",
  "nabitasan": "5000", "oñate de leon": "5000",
  "pale": "5000", "poblacion": "5000",
  "san isidro": "5000", "santa barbara": "5000",
  "tigbauan": "5000", "zarraga": "5000",

  // Bacolod barangays (6100)
  "alangilan": "6100", "alijis": "6100",
  "banago": "6100", "bata": "6100",
  "cabug": "6100", "estefania": "6100",
  "felisa": "6100", "granada": "6100",
  "handumanan": "6100", "lag-asan": "6100",
  "lupit": "6100", "mandalagan": "6100",
  "mansilingan": "6100", "montevista": "6100",
  "pahanocoy": "6100", "punta taytay": "6100",
  "singcang-airport": "6100", "sum-ag": "6100",
  "taculing": "6100", "tangub": "6100",
  "villamonte": "6100", "vista alegre": "6100",
  "zone i": "6100", "zone ii": "6100",

  // Baguio barangays (2600)
  "abanao-zandueta": "2600", "alfonso tabora": "2600",
  "ambiong": "2600", "andres bonifacio": "2600",
  "asin road": "2600", "atok trail": "2600",
  "aurora hill": "2600", "bakakeng central": "2600",
  "bakakeng norte": "2600", "bayan park village": "2600",
  "cabinet hill": "2600", "camdas subdivision": "2600",
  "camp 7": "2600", "camp 8": "2600",
  "camp allen": "2600", "campo filipino": "2600",
  "city camp central": "2600", "city camp lagoon": "2600",
  "country club village": "2600", "dagsian lower": "2600",
  "dagsian upper": "2600", "dizon subdivision": "2600",
  "dominican hill": "2600", "dontogan": "2600",
  "dry igorot village": "2600", "engineers hill": "2600",
  "fairview village": "2600", "happy hollow": "2600",
  "hillside": "2600", "holy ghost extension": "2600",
  "holy ghost proper": "2600", "honeymoon": "2600",
  "irisan": "2600", "imelda village": "2600",
  "kabayanihan": "2600", "kagitingan": "2600",
  "kennon road": "2600", "kias": "2600",
  "la trinidad": "2600", "lourdes subdivision": "2600",
  "lower rock quarry": "2600", "luneta hill": "2600",
  "magsaysay private road": "2600", "malcolm square": "2600",
  "military cut-off": "2600", "mines view park": "2600",
  "modern site east": "2600", "modern site west": "2600",
  "mount data": "2600", "mps building": "2600",
  "new pahayas": "2600", "new central business district": "2600",
  "p.u.p. village": "2600", "pacdal": "2600",
  "palma-urbano": "2600", "phil-am": "2600",
  "pinget": "2600", "pinsao pilot project": "2600",
  "pinsao proper": "2600", "poliwes": "2600",
  "pucsusan": "2600", "quezon hill proper": "2600",
  "rizal monument area": "2600", "rock quarry lower": "2600",
  "rock quarry middle": "2600", "rock quarry upper": "2600",
  "san antonio village": "2600", "san luis village": "2600",
  "san roque village": "2600", "session road area": "2600",
  "sierra del norte": "2600", "sierra del sur": "2600",
  "slaughterhouse area": "2600", "south drive": "2600",
  "tadiangan": "2600", "tam-awan": "2600",
  "teacher's camp": "2600", "tinongdan": "2600",
  "tiptop": "2600", "trancoville": "2600",
  "upper general luna road": "2600", "upper magsaysay": "2600",
  "upper market subdivision": "2600", "upper rock quarry": "2600",
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
function injectComboStyles() {
  if (document.getElementById("ph-combo-edit-style")) return;
  const s = document.createElement("style");
  s.id = "ph-combo-edit-style";
  s.textContent = `
    .ph-combo-wrap { position: relative; display: block; }
    .ph-combo-wrap input.ph-combo-input {
      width: 100%; box-sizing: border-box;
      padding-right: 30px !important; cursor: pointer; background-image: none !important;
    }
    .ph-combo-wrap input.ph-combo-input:disabled { cursor: not-allowed; opacity: 0.6; }
    .ph-combo-arrow {
      position: absolute; right: 9px; top: 50%;
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
  if (inputEl.parentElement.classList.contains("ph-combo-wrap")) {
    inputEl.parentElement.remove();
    inputEl.classList.remove("ph-combo-input");
    document.body.appendChild(inputEl);
  }

  const wrap = document.createElement("div");
  wrap.className = "ph-combo-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  inputEl.classList.add("ph-combo-input");
  inputEl.setAttribute("autocomplete", "off");
  inputEl.setAttribute("readonly", "true");
  inputEl.style.cursor = inputEl.disabled ? "not-allowed" : "pointer";

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

  function renderList(items, filterText = "") {
    list.innerHTML = "";
    const filtered = smartFilter(items, filterText);

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
      onOpen({ showLoading, renderList, allItems, setItems: items => { allItems = items; } });
    } else {
      renderList(allItems);
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
    if (!isOpen && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      openDropdown();
      setTimeout(() => { searchBox.value = e.key; renderList(allItems, e.key); searchBox.focus(); }, 60);
    }
  });
  searchBox.addEventListener("input", () => renderList(allItems, searchBox.value));
  searchBox.addEventListener("keydown", e => { if (e.key === "Escape") { closeDropdown(); inputEl.focus(); } });
  document.addEventListener("click", e => { if (!wrap.contains(e.target)) closeDropdown(); });

  return {
    open:    openDropdown,
    close:   closeDropdown,
    setItems(items) { allItems = items; },
    clear()  { inputEl.value = ""; allItems = []; },
    isOpen() { return isOpen; },
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
    console.error("PSGC cities load failed:", err);
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
    console.error("PSGC barangays load failed:", err);
  }
  return [];
}

// ============================================================
// INIT COMBOBOXES (called when edit mode is activated)
// ============================================================
let cityCombo     = null;
let barangayCombo = null;

function setupCityAutocomplete() {
  const cityInput     = document.getElementById("city");
  const barangayInput = document.getElementById("barangay");
  const zipcodeInput  = document.getElementById("zipcode");
  if (!cityInput) return;

  cityCombo = makeCombobox(cityInput, {
    placeholder: "Hanapin ang city o municipality…",
    onSelect: async item => {
      selectedCityCode = item.value;

      // Auto-fill ZIP from city lookup, and remember it as fallback
      const cityZip = getZipCode(item.label, item.value);
      currentCityZip = cityZip;
      if (zipcodeInput && !zipcodeInput.disabled) {
        zipcodeInput.value = cityZip;
      }

      // Reset barangay
      if (barangayInput) barangayInput.value = "";
      currentBarangays = [];
      if (barangayCombo) barangayCombo.setItems([]);

      // Load barangays
      if (barangayInput && !barangayInput.disabled) {
        const orig = barangayInput.placeholder;
        barangayInput.placeholder = "Loading barangays…";
        currentBarangays = await loadBarangaysForCity(selectedCityCode);
        barangayInput.placeholder = orig || "Pumili ng barangay";
        if (barangayCombo) {
          barangayCombo.setItems(
            currentBarangays.map(b => ({
              label: b.name,
              value: b.code,
              zip:   getZipFromBarangay(b.name, currentCityZip),
            }))
          );
        }
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
      renderList(items);
    },
  });
}

function setupBarangayAutocomplete() {
  const barangayInput = document.getElementById("barangay");
  const zipcodeInput  = document.getElementById("zipcode");
  if (!barangayInput) return;

  barangayCombo = makeCombobox(barangayInput, {
    placeholder: "Hanapin ang barangay…",
    onSelect(item) {
      // Auto-fill ZIP from barangay lookup, fall back to city ZIP
      if (zipcodeInput && !zipcodeInput.disabled) {
        zipcodeInput.value = getZipFromBarangay(item.label, currentCityZip);
      }
    },
    onOpen: ({ showLoading, renderList, setItems }) => {
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
      renderList(items);
    },
  });

  if (currentBarangays.length > 0) {
    barangayCombo.setItems(
      currentBarangays.map(b => ({
        label: b.name,
        value: b.code,
        zip:   getZipFromBarangay(b.name, currentCityZip),
      }))
    );
  }
}

// ============================================================
// LOAD PATIENT INFO
// ============================================================
async function loadPatientInfo() {
  const params    = new URLSearchParams(window.location.search);
  const patientId = params.get("patientId");
  if (!patientId) { alert("No patient selected!"); return; }

  try {
    const res = await fetch(`http://localhost:5000/api/patients/${patientId}`);
    if (!res.ok) throw new Error("Patient not found");
    const p = await res.json();

    document.getElementById("firstname").value    = p.firstname    || "";
    document.getElementById("middlename").value   = p.middlename   || "";
    document.getElementById("lastname").value     = p.lastname     || "";
    document.getElementById("dob").value          = p.dob ? p.dob.substring(0, 10) : "";
    document.getElementById("gender").value       = p.gender       || "";
    document.getElementById("status").value       = p.status?.toLowerCase() || "";
    document.getElementById("phone").value        = p.phone        || "";
    document.getElementById("email").value        = p.email        || "";
    document.getElementById("address").value      = p.address      || "";
    document.getElementById("barangay").value     = p.barangay     || "";
    document.getElementById("city").value         = p.city         || "";
    document.getElementById("zipcode").value      = p.zipcode      || "";
    document.getElementById("em_fullname").value  = p.em_fullname  || "";
    document.getElementById("em_phone").value     = p.em_phone     || "";
    document.getElementById("relationship").value = p.relationship || "";
    document.getElementById("em_email").value     = p.em_email     || "";

    let displayName = p.firstname || "";
    if (p.middlename && p.middlename.trim()) {
      displayName += " " + p.middlename.trim().charAt(0).toUpperCase() + ".";
    }
    displayName += " " + (p.lastname || "");
    document.querySelector("header h1").textContent = `Patient Information - ${displayName.trim()}`;

    let age = "";
    if (p.dob) {
      const today = new Date(), birth = new Date(p.dob);
      age = today.getFullYear() - birth.getFullYear();
      const notYet = today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (notYet) age--;
    }

    const sex = p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "";

    sessionStorage.setItem("rf_patientName",   displayName.trim());
    sessionStorage.setItem("rf_patientDOB",    p.dob ? p.dob.substring(0, 10) : "");
    sessionStorage.setItem("rf_patientID",     p.patientId || "");
    sessionStorage.setItem("rf_patientAge",    String(age));
    sessionStorage.setItem("rf_patientSex",    sex);
    sessionStorage.setItem("rf_contactNumber", p.phone || "");

    const followUpInput = document.getElementById("singleFollowUp");
    if (followUpInput) {
      followUpInput.addEventListener("change", () => {
        const followUpDate = followUpInput.value;
        if (!followUpDate) return;
        addRecentPatient(p.patientId, displayName.trim());
        window.location.href = `AppointmentScheduler.html?patientId=${p.patientId}&date=${followUpDate}`;
      });
    }

    // Pre-load barangays and city ZIP if city is already set
    if (p.city) {
      const cities = await loadAllCities();
      const matched = cities.find(c => c.name.toLowerCase() === p.city.toLowerCase());
      if (matched) {
        selectedCityCode = matched.code;
        currentCityZip   = getZipCode(matched.name, matched.code);
        loadBarangaysForCity(selectedCityCode).then(brgy => {
          currentBarangays = brgy;
          if (barangayCombo) {
            barangayCombo.setItems(brgy.map(b => ({
              label: b.name,
              value: b.code,
              zip:   getZipFromBarangay(b.name, currentCityZip),
            })));
          }
        });
      }
    }
  } catch (err) {
    console.error("Error loading patient info:", err);
    alert("Unable to load patient information.");
  }
}

window.addEventListener("DOMContentLoaded", loadPatientInfo);

// ============================================================
// EDIT + SAVE FUNCTIONALITY
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  injectComboStyles();
  loadAllCities(); // preload in background

  const editBtn    = document.querySelector(".editbtn");
  const buttonCon  = document.getElementById("buttonCon");
  const formInputs = document.querySelectorAll("#patientForm input, #patientForm select");
  const saveBtn    = document.querySelector(".savebtn");
  const cancelBtn  = document.querySelector(".cancelbtn");

  if (buttonCon) buttonCon.style.display = "none";

  const userRole = sessionStorage.getItem("role");
  if (editBtn && (userRole === "Doctor" || userRole === "Medtech")) {
    editBtn.style.display = "none";
  }

  if (editBtn) {
    editBtn.addEventListener("click", e => {
      e.preventDefault();
      const isEditing = editBtn.classList.toggle("editing");
      if (isEditing) {
        formInputs.forEach(input => (input.disabled = false));
        if (buttonCon) buttonCon.style.display = "flex";
        editBtn.innerHTML = `<i class="fa-solid fa-xmark"></i> Exit Edit Mode`;
        setupCityAutocomplete();
        setupBarangayAutocomplete();
      } else {
        formInputs.forEach(input => (input.disabled = true));
        if (buttonCon) buttonCon.style.display = "none";
        editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
        if (cityCombo)     cityCombo.close();
        if (barangayCombo) barangayCombo.close();
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", e => {
      e.preventDefault();
      if (cityCombo)     cityCombo.close();
      if (barangayCombo) barangayCombo.close();
      loadPatientInfo();
      formInputs.forEach(input => (input.disabled = true));
      if (buttonCon) buttonCon.style.display = "none";
      if (editBtn) {
        editBtn.classList.remove("editing");
        editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async e => {
      e.preventDefault();
      const params    = new URLSearchParams(window.location.search);
      const patientId = params.get("patientId");
      const emailVal   = document.getElementById("email").value.trim();
      const emEmailVal = document.getElementById("em_email").value.trim();

      const gmailRegex = /^[^\s@]+@gmail\.com$/i;
      if (emailVal && !gmailRegex.test(emailVal)) {
        alert("The primary email address must be a valid @gmail.com account."); return;
      }
      if (emEmailVal && !gmailRegex.test(emEmailVal)) {
        alert("The emergency contact email must be a valid @gmail.com account if provided."); return;
      }

      const updatedData = {
        firstname:    document.getElementById("firstname").value.trim(),
        middlename:   document.getElementById("middlename").value.trim(),
        lastname:     document.getElementById("lastname").value.trim(),
        dob:          document.getElementById("dob").value,
        gender:       document.getElementById("gender").value,
        status:       document.getElementById("status").value,
        phone:        document.getElementById("phone").value,
        email:        emailVal || null,
        address:      document.getElementById("address").value.trim(),
        barangay:     document.getElementById("barangay").value.trim(),
        city:         document.getElementById("city").value.trim(),
        zipcode:      document.getElementById("zipcode").value,
        em_fullname:  document.getElementById("em_fullname").value.trim(),
        em_phone:     document.getElementById("em_phone").value,
        relationship: document.getElementById("relationship").value.trim(),
        em_email:     emEmailVal || null,
      };

      try {
        const res = await fetch(`http://localhost:5000/api/patients/${patientId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Error saving data");

        alert("✅ Patient information saved successfully!");
        formInputs.forEach(input => (input.disabled = true));
        if (buttonCon) buttonCon.style.display = "none";
        if (cityCombo)     cityCombo.close();
        if (barangayCombo) barangayCombo.close();
        if (editBtn) {
          editBtn.classList.remove("editing");
          editBtn.innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Edit`;
        }
      } catch (err) {
        console.error("Save error:", err);
        alert("❌ Failed to save changes.");
      }
    });
  }
});

// ============================================================
// UPDATE NAV LINKS & ACCESS CONTROL
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const patientId = new URLSearchParams(window.location.search).get("patientId");
  if (!patientId) return;

  document.querySelectorAll("nav-bar a").forEach(link => {
    const href = link.getAttribute("href");
    if (href && !href.includes("?patientId=")) {
      link.setAttribute("href", `${href}?patientId=${patientId}`);
    }
  });

  const userRole      = sessionStorage.getItem("role");
  const labResultsTab = document.getElementById("labResultsTab");
  if (labResultsTab) {
    labResultsTab.style.display =
      userRole === "Doctor" || userRole === "Medtech" ? "inline-flex" : "none";
  }

  const requestFormBtn  = document.getElementById("requestFormBtn");
  const referralFormBtn = document.getElementById("referralFormBtn");
  if (userRole === "Doctor") {
    if (requestFormBtn)  requestFormBtn.style.display  = "inline-flex";
    if (referralFormBtn) referralFormBtn.style.display = "inline-flex";
  } else {
    if (requestFormBtn)  requestFormBtn.style.display  = "none";
    if (referralFormBtn) referralFormBtn.style.display = "none";
  }
});