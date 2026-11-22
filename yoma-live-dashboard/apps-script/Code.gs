/**
 * YOMA Activation Roadshow: live dashboard (free, Google Apps Script).
 * Reads the three Google Form response sheets and serves one web page that
 * refreshes by itself. Shows totals only: no names or phone numbers.
 */

const CONFIG = {
  // 1) The response spreadsheet of each form (already filled in).
  SHEETS: {
    registration: 'https://docs.google.com/spreadsheets/d/174-Jy4L7AYpGINDiQqOyCC57KG4Pbd8owfM39GGU4W0/edit?gid=51193718',
    wave1: 'https://docs.google.com/spreadsheets/d/1OJvBsdCSJxujw9f-fZZwkY3QDcY0FREl9rHNsxXu6MU/edit?gid=761615593',
    wave2: 'https://docs.google.com/spreadsheets/d/1ckhksRxJ_Viql-iNxGKBseythsNYTAfuXi6S7NTrGMY/edit?gid=1362070162'
  },
  // 2) Login. The password is stored only as a SHA-256 fingerprint, never as plain text.
  //    To change it: run makePasswordHash() (see the bottom of this file) and paste the result here.
  LOGIN_USER: 'yoma@plantonetree.eco',
  PASSWORD_SHA256: '88949db1057176466d9f01f0b9ef3a2d9ef38bae02400af62657b7932bb4d45b',
  SESSION_HOURS: 6,
  // 3) Where logo.png and background.png live (your GitHub Pages address, ending in /).
  //    Example: 'https://yourname.github.io/yoma-live-dashboard/'
  //    Leave empty to use the built-in POT logo and a plain green background.
  IMAGES_URL: '',
  // 4) Plan window and targets.
  PLAN_START: '2026-11-19',
  PLAN_END: '2027-01-31',
  VOLUNTEER_TARGET: 50,
  CACHE_SECONDS: 20
};

const DISTRICTS = [
  { key: 'buthabuthe', name: 'Butha-Buthe', region: 'North', target: 100 },
  { key: 'leribe', name: 'Leribe', region: 'North', target: 100 },
  { key: 'berea', name: 'Berea', region: 'North', target: 100 },
  { key: 'mokhotlong', name: 'Mokhotlong', region: 'North', target: 100 },
  { key: 'maseru', name: 'Maseru', region: 'Central', target: 150 },
  { key: 'thabatseka', name: 'Thaba-Tseka', region: 'Central', target: 100 },
  { key: 'mafeteng', name: 'Mafeteng', region: 'South', target: 100 },
  { key: 'mohaleshoek', name: "Mohale's Hoek", region: 'South', target: 100 },
  { key: 'quthing', name: 'Quthing', region: 'South', target: 100 },
  { key: 'qachasnek', name: "Qacha's Nek", region: 'South', target: 100 }
];
const REGIONS = [
  { name: 'North', coordinator: 'Miss Palesa' },
  { name: 'Central', coordinator: 'Miss Portia' },
  { name: 'South', coordinator: 'Mr. Justice' }
];
const MONTHS = ['2026-11', '2026-12', '2027-01', '2027-02'];
const MONTH_LABELS = ['Nov', 'Dec', 'Jan', 'Feb'];
const PLAN_BY_MONTH = [350, 700, 1050, 1050];

const BUY_OPTIONS = ['Airtime or data', 'Food or groceries', 'Clothes or shoes', 'School fees, books or uniform',
  'Taxi or bus fare', 'Sanitary pads and toiletries', 'Phone, charger or power bank',
  'Start or support a small business', 'Pay for a short course or training', 'Sports, hobbies or music',
  'Haircut or beauty', 'Help my family at home', 'Save it'];
const PROBLEM_OPTIONS = ['Phone or device', 'Cost of data', 'Poor network', 'Login or password', 'Hard to understand',
  'Hard to use with my disability', 'Needed help', 'No problems'];
const DIFFICULTIES = [
  ['Seeing', /seeing/i], ['Hearing', /hearing/i], ['Walking or moving', /walking/i],
  ['Remembering or concentrating', /remembering/i], ['Speaking or understanding', /speaking/i],
  ['Self-care', /self-care/i]
];

/* ---------- web page ---------- */

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.imgBase = CONFIG.IMAGES_URL || '';
  return t.evaluate()
    .setTitle('YOMA Lesotho Analytics')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Used by the GitHub Pages copy of the dashboard. */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const args = req.args || [];
    if (req.fn === 'login') out = { result: login(args[0], args[1]) };
    else if (req.fn === 'getStats') out = { result: getStats(args[0]) };
    else if (req.fn === 'logout') out = { result: logout(args[0]) };
    else out = { error: 'Unknown request' };
  } catch (err) {
    out = { error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Checks the username and password. Returns a session token for SESSION_HOURS. */
function login(user, pass) {
  const okUser = String(user || '').trim().toLowerCase() === CONFIG.LOGIN_USER.toLowerCase();
  const okPass = sha256Hex_(pass || '') === CONFIG.PASSWORD_SHA256;
  if (!okUser || !okPass) {
    Utilities.sleep(1200); // slows down guessing
    throw new Error('Wrong username or password');
  }
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('tok_' + token, '1', Math.min(21600, CONFIG.SESSION_HOURS * 3600));
  return token;
}

function logout(token) {
  if (token) CacheService.getScriptCache().remove('tok_' + token);
  return true;
}

function checkToken_(token) {
  if (!token || !CacheService.getScriptCache().get('tok_' + token)) throw new Error('SIGN_IN_NEEDED');
}

/** Called by the page every few seconds, only after login. */
function getStats(token) {
  checkToken_(token);
  const cache = CacheService.getScriptCache();
  const hit = cache.get('stats');
  if (hit) return JSON.parse(hit);
  const out = buildStats();
  try { cache.put('stats', JSON.stringify(out), CONFIG.CACHE_SECONDS); } catch (err) { /* too big: skip cache */ }
  return out;
}

/** Run this once from the editor to give the script permission to read your sheets. */
function authorize() {
  const s = buildStats();
  Logger.log('Registrations: ' + s.registration.total + ', Wave 1: ' + s.wave1.total + ', Wave 2: ' + s.wave2.total);
}

/* ---------- numbers ---------- */

function buildStats() {
  const tz = Session.getScriptTimeZone() || 'Africa/Maseru';
  const reg = readTable(CONFIG.SHEETS.registration);
  const w1 = readTable(CONFIG.SHEETS.wave1);
  const w2 = readTable(CONFIG.SHEETS.wave2);
  const r = analyseRegistration(reg, tz);
  const a = analyseWave1(w1);
  const b = analyseWave2(w2);

  const districts = DISTRICTS.map(function (d) {
    return {
      name: d.name, region: d.region, target: d.target,
      count: r.byDistrict[d.key] || 0, wave1: a.byDistrict[d.key] || 0, wave2: b.byDistrict[d.key] || 0
    };
  });
  const totalTarget = DISTRICTS.reduce(function (s, d) { return s + d.target; }, 0);

  const now = new Date();
  const start = new Date(CONFIG.PLAN_START + 'T00:00:00');
  const end = new Date(CONFIG.PLAN_END + 'T23:59:59');
  const frac = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const expected = Math.round(totalTarget * frac);

  const regions = REGIONS.map(function (rg) {
    const ds = districts.filter(function (d) { return d.region === rg.name; });
    const target = ds.reduce(function (s, d) { return s + d.target; }, 0);
    const count = ds.reduce(function (s, d) { return s + d.count; }, 0);
    const x = r.regions[rg.name] || { today: 0, byMonth: {}, female: 0, male: 0, finishedYes: 0, finishedAll: 0, volunteers: 0 };
    return {
      name: rg.name, coordinator: rg.coordinator, districts: ds.length, target: target, count: count,
      expected: Math.round(target * frac),
      wave1: ds.reduce(function (s, d) { return s + d.wave1; }, 0),
      wave2: ds.reduce(function (s, d) { return s + d.wave2; }, 0),
      today: x.today, byMonth: x.byMonth, female: x.female, male: x.male,
      finishedYes: x.finishedYes, finishedAll: x.finishedAll, volunteers: Object.keys(x.vols || {}).length,
      planByMonth: [Math.round(target / 3), Math.round(target * 2 / 3), target, target]
    };
  });

  return {
    regions: regions,
    updated: Utilities.formatDate(now, tz, 'HH:mm:ss'),
    today: Utilities.formatDate(now, tz, 'EEE d MMM yyyy'),
    missing: { registration: reg.missing, wave1: w1.missing, wave2: w2.missing },
    errors: { registration: reg.error || '', wave1: w1.error || '', wave2: w2.error || '' },
    check: {
      registration: checkForm(reg, REQUIRED.registration),
      wave1: checkForm(w1, REQUIRED.wave1),
      wave2: checkForm(w2, REQUIRED.wave2)
    },
    totalTarget: totalTarget,
    expectedByNow: expected,
    planStarted: now >= start,
    monthNow: Utilities.formatDate(now, tz, 'yyyy-MM'),
    volunteerTarget: CONFIG.VOLUNTEER_TARGET,
    months: MONTH_LABELS,
    plan: PLAN_BY_MONTH,
    districts: districts,
    registration: r, wave1: a, wave2: b
  };
}

function sheetId(v) {
  const s = String(v || '').trim();
  const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : s;
}

function readTable(raw) {
  if (!raw || String(raw).indexOf('PASTE_') === 0) return { rows: [], headers: [], missing: true };
  try {
    const book = SpreadsheetApp.openById(sheetId(raw));
    const tabs = book.getSheets();
    let sheet = null;
    const g = String(raw).match(/gid=(\d+)/);
    if (g) for (let i = 0; i < tabs.length; i++) { if (String(tabs[i].getSheetId()) === g[1]) { sheet = tabs[i]; break; } }
    if (!sheet) for (let i = 0; i < tabs.length; i++) {
      if (/form responses|responses/i.test(tabs[i].getName())) { sheet = tabs[i]; break; }
    }
    if (!sheet) sheet = tabs[0];
    const v = sheet.getDataRange().getValues();
    if (v.length < 1) return { rows: [], headers: [] };
    const headers = v[0].map(String);
    const rows = v.slice(1).filter(function (row) {
      return row.some(function (c) { return c !== '' && c !== null; });
    });
    return { headers: headers, rows: rows };
  } catch (err) {
    return { rows: [], headers: [], error: String(err && err.message ? err.message : err) };
  }
}

/** The columns each form must have, found by the wording of the question. */
const REQUIRED = {
  registration: [['Volunteer name', /volunteer/i], ['District', /^district/i], ['Age', /^age/i], ['Gender', /gender/i],
    ['Difficulty', /difficulty/i], ['Finished registering', /finished/i], ['Parent or guardian', /parent|guardian/i], ['OK to contact', /contact them/i]],
  wave1: [['District', /^district/i], ['Age', /^age/i], ['Gender', /gender/i], ['Buy first', /buy first|would you buy/i], ['Heard of YOMA', /heard of/i]],
  wave2: [['District', /^district/i], ['Gender', /gender/i], ['Registered and used', /register and use/i], ['Problems', /problems/i], ['Make YOMA better', /better/i]]
};

function checkForm(t, required) {
  const found = [], missing = [];
  required.forEach(function (r) { (col(t.headers || [], r[1]) >= 0 ? found : missing).push(r[0]); });
  return { rows: (t.rows || []).length, found: found, missing: missing, headers: (t.headers || []).length };
}

function col(headers, re) {
  for (let i = 0; i < headers.length; i++) { if (re.test(headers[i])) return i; }
  return -1;
}
function cell(row, i) { return i < 0 || i >= row.length ? '' : row[i]; }
function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }
function districtKey(raw) {
  const n = norm(raw);
  for (let i = 0; i < DISTRICTS.length; i++) { if (n === DISTRICTS[i].key) return DISTRICTS[i].key; }
  for (let j = 0; j < DISTRICTS.length; j++) { if (n.indexOf(DISTRICTS[j].key) >= 0) return DISTRICTS[j].key; }
  return '';
}
function bump(map, k, n) { map[k] = (map[k] || 0) + (n || 1); }
function toDate(v) { return v instanceof Date ? v : (v ? new Date(v) : null); }
function titleCase(s) {
  return String(s).toLowerCase().replace(/(^|[\s-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
}
function genderOf(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s.indexOf('f') === 0) return 'Female';
  if (s.indexOf('m') === 0) return 'Male';
  return 'Prefer not to say';
}
function ageBand(n) {
  if (!(n >= 0)) return null;
  if (n < 16) return 'Under 16';
  if (n < 18) return '16 to 17';
  if (n < 25) return '18 to 24';
  if (n < 36) return '25 to 35';
  return '36 and over';
}
function difficultyOf(text, out) {
  const s = String(text || '').trim();
  if (!s) return false;
  if (/prefer not/i.test(s) && !/seeing|hearing|walking|remembering|speaking|self-care/i.test(s)) return false;
  if (/^no difficulty/i.test(s) && !/seeing|hearing|walking|remembering|speaking|self-care/i.test(s)) return false;
  let any = false;
  DIFFICULTIES.forEach(function (d) { if (d[1].test(s)) { bump(out, d[0]); any = true; } });
  if (!any) { bump(out, 'Other'); any = true; }
  return any;
}
function splitChoices(text) {
  return String(text || '').split(/,\s*(?=[A-Z])/).map(function (x) { return x.trim(); }).filter(String);
}
function matchOption(text, options) {
  const t = String(text).toLowerCase();
  for (let i = 0; i < options.length; i++) {
    if (t.indexOf(options[i].toLowerCase().slice(0, 14)) === 0) return options[i];
  }
  return 'Other';
}

function analyseRegistration(t, tz) {
  const H = t.headers || [];
  const cV = col(H, /volunteer/i), cD = col(H, /^district/i), cAge = col(H, /^age/i), cG = col(H, /gender/i);
  const cDis = col(H, /difficulty/i), cFin = col(H, /finished/i), cCons = col(H, /parent|guardian/i), cOk = col(H, /contact them/i);
  const out = {
    total: 0, today: 0, byDistrict: {}, byMonth: {}, gender: {}, ages: {}, finished: { Yes: 0, 'Not yet': 0 },
    contactOk: { Yes: 0, No: 0 }, under16: 0, under16WithConsent: 0, difficulty: { any: 0, types: {} },
    volunteers: [], latest: [], regions: {}
  };
  const vols = {};
  const todayKey = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const stamped = [];
  (t.rows || []).forEach(function (row) {
    out.total++;
    const dk = districtKey(cell(row, cD));
    if (dk) bump(out.byDistrict, dk);
    const dd = DISTRICTS.filter(function (x) { return x.key === dk; })[0];
    let rgn = null;
    if (dd) {
      rgn = out.regions[dd.region] = out.regions[dd.region] ||
        { today: 0, byMonth: {}, female: 0, male: 0, finishedYes: 0, finishedAll: 0, vols: {} };
      const vname = String(cell(row, cV)).replace(/\s+/g, ' ').trim().toLowerCase();
      if (vname) rgn.vols[vname] = 1;
      const gnd = genderOf(cell(row, cG));
      if (gnd === 'Female') rgn.female++; else if (gnd === 'Male') rgn.male++;
      const fz = String(cell(row, cFin)).trim().toLowerCase();
      if (fz) { rgn.finishedAll++; if (fz.indexOf('yes') === 0) rgn.finishedYes++; }
    }
    const d = toDate(row[0]);
    if (d && !isNaN(d)) {
      const mk = Utilities.formatDate(d, tz, 'yyyy-MM');
      bump(out.byMonth, mk);
      if (rgn) bump(rgn.byMonth, mk);
      if (Utilities.formatDate(d, tz, 'yyyy-MM-dd') === todayKey) { out.today++; if (rgn) rgn.today++; }
      stamped.push({ d: d, district: dk });
    }
    bump(out.gender, genderOf(cell(row, cG)));
    const age = parseFloat(cell(row, cAge));
    const band = ageBand(age);
    if (band) bump(out.ages, band);
    if (age < 16) {
      out.under16++;
      if (String(cell(row, cCons)).trim()) out.under16WithConsent++;
    }
    if (difficultyOf(cell(row, cDis), out.difficulty.types)) out.difficulty.any++;
    const fin = String(cell(row, cFin)).trim().toLowerCase();
    if (fin.indexOf('yes') === 0) out.finished.Yes++; else if (fin) out.finished['Not yet']++;
    const ok = String(cell(row, cOk)).trim().toLowerCase();
    if (ok.indexOf('yes') === 0) out.contactOk.Yes++; else if (ok) out.contactOk.No++;
    const vn = String(cell(row, cV)).replace(/\s+/g, ' ').trim();
    if (vn) {
      const vk = vn.toLowerCase();
      if (!vols[vk]) vols[vk] = { name: titleCase(vn), count: 0, districts: {} };
      vols[vk].count++;
      if (dk) bump(vols[vk].districts, dk);
    }
  });
  out.volunteers = Object.keys(vols).map(function (k) {
    const v = vols[k];
    let best = '', bestN = 0;
    Object.keys(v.districts).forEach(function (dk) { if (v.districts[dk] > bestN) { best = dk; bestN = v.districts[dk]; } });
    const dn = DISTRICTS.filter(function (d) { return d.key === best; })[0];
    return { name: v.name, count: v.count, district: dn ? dn.name : '' };
  }).sort(function (a, b) { return b.count - a.count; }).slice(0, 60);
  stamped.sort(function (a, b) { return b.d - a.d; });
  out.latest = stamped.slice(0, 8).map(function (s) {
    const dn = DISTRICTS.filter(function (d) { return d.key === s.district; })[0];
    return { district: dn ? dn.name : 'District not set', when: Utilities.formatDate(s.d, tz, 'd MMM HH:mm') };
  });
  return out;
}

function analyseWave1(t) {
  const H = t.headers || [];
  const cD = col(H, /^district/i), cG = col(H, /gender/i), cAge = col(H, /^age/i), cBuy = col(H, /buy first|would you buy/i), cHeard = col(H, /heard of/i);
  const out = { total: 0, byDistrict: {}, gender: {}, buy: {}, heard: { Yes: 0, No: 0 }, under16: 0 };
  (t.rows || []).forEach(function (row) {
    out.total++;
    const dk = districtKey(cell(row, cD));
    if (dk) bump(out.byDistrict, dk);
    bump(out.gender, genderOf(cell(row, cG)));
    if (parseFloat(cell(row, cAge)) < 16) out.under16++;
    const b = String(cell(row, cBuy)).trim();
    if (b) bump(out.buy, matchOption(b, BUY_OPTIONS));
    const h = String(cell(row, cHeard)).trim().toLowerCase();
    if (h.indexOf('yes') === 0) out.heard.Yes++; else if (h) out.heard.No++;
  });
  return out;
}

function analyseWave2(t) {
  const H = t.headers || [];
  const cD = col(H, /^district/i), cG = col(H, /gender/i), cUse = col(H, /register and use/i), cProb = col(H, /problems/i), cIdea = col(H, /better/i);
  const out = { total: 0, byDistrict: {}, gender: {}, usage: { 'Registered and used it': 0, 'Registered but not used': 0, 'Did not register': 0 }, problems: {}, ideas: [] };
  (t.rows || []).forEach(function (row) {
    out.total++;
    const dk = districtKey(cell(row, cD));
    if (dk) bump(out.byDistrict, dk);
    bump(out.gender, genderOf(cell(row, cG)));
    const u = String(cell(row, cUse)).toLowerCase();
    if (u.indexOf('did not') === 0) out.usage['Did not register']++;
    else if (u.indexOf('registered but') === 0) out.usage['Registered but not used']++;
    else if (u.indexOf('registered and') === 0) out.usage['Registered and used it']++;
    splitChoices(cell(row, cProb)).forEach(function (p) { bump(out.problems, matchOption(p, PROBLEM_OPTIONS)); });
    const idea = String(cell(row, cIdea)).trim();
    if (idea) {
      const dn = DISTRICTS.filter(function (d) { return d.key === dk; })[0];
      out.ideas.push({ text: idea.slice(0, 160), district: dn ? dn.name : '' });
    }
  });
  out.ideas = out.ideas.slice(-6).reverse();
  return out;
}


/**
 * To change the password: type the new password between the quotes below,
 * choose makePasswordHash in the menu at the top, click Run, and copy the
 * long code from the log into PASSWORD_SHA256 above. Then clear the quotes again.
 */
function makePasswordHash() {
  const NEW_PASSWORD = '';
  if (!NEW_PASSWORD) { Logger.log('Type the new password in NEW_PASSWORD first.'); return; }
  Logger.log(sha256Hex_(NEW_PASSWORD));
}
