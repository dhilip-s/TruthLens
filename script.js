/* ═══════════════════════════════════════════
   TruthLens v7 — script.js
   Full 3-tier engine + typing animation + particles + URL checker
   ═══════════════════════════════════════════ */
'use strict';

// ════════════════════════════════════════════
// PARTICLE BACKGROUND
// ════════════════════════════════════════════
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  const resize = () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(37,99,235,', 'rgba(124,58,237,', 'rgba(59,130,246,'];

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x    = Math.random() * W;
      this.y    = Math.random() * H;
      this.r    = Math.random() * 2 + .5;
      this.vx   = (Math.random() - .5) * .4;
      this.vy   = (Math.random() - .5) * .4;
      this.alpha= Math.random() * .5 + .1;
      this.color= COLORS[Math.floor(Math.random() * COLORS.length)];
    }
    update() {
      this.x += this.vx; this.y += this.vy;
      if (this.x < 0 || this.x > W || this.y < 0 || this.y > H) this.reset();
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.alpha + ')';
      ctx.fill();
    }
  }

  for (let i = 0; i < 80; i++) particles.push(new Particle());

  // Draw connecting lines between nearby particles
  function drawLines() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(37,99,235,${.06 * (1 - dist/100)})`;
          ctx.lineWidth   = .5;
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => { p.update(); p.draw(); });
    drawLines();
    requestAnimationFrame(animate);
  }
  animate();
}

// ════════════════════════════════════════════
// CONFIG & STATE
// ════════════════════════════════════════════
const API_BASE         = 'http://localhost:8000';
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1/dist/transformers.min.js';
const BERT_MODEL       = 'Xenova/mobilebert-uncased-mnli';
const ZS_LABELS        = [
  'fake news, misinformation, conspiracy theory, hoax, disinformation',
  'real news, factual reporting, credible journalism, verified facts',
];

const S = { pythonOnline: false, bertReady: false, bertLoading: false, bert: null };

// ════════════════════════════════════════════
// STATIC DATA
// ════════════════════════════════════════════
const SAMPLES = [
  'BREAKING: Deep state using 5G towers to spread deadly radiation — government covering up thousands of deaths. Share before deleted!!!',
  'Doctors HATE this man! He cures cancer overnight with one weird kitchen trick Big Pharma doesn\'t want you to know about.',
  'Federal Reserve raised interest rates by 25 basis points on Wednesday, according to officials, as inflation data shows gradual decline toward the 2% target.',
  'Researchers at Harvard University published a peer-reviewed study in Nature showing daily exercise reduces heart disease risk by 35 percent.',
  'Some experts suggest alkaline water may improve metabolism, though scientists say more research is needed before conclusions can be drawn.',
];

const FEED_HEADLINES = [
  { t:'fake',      text:'Viral claim: Microchips found in vaccine batch — debunked by health authorities worldwide.' },
  { t:'real',      text:'IPCC report: Global temperatures rose 1.1°C above pre-industrial levels, scientists confirm.' },
  { t:'uncertain', text:'Poll suggests public trust in media hits new low, though methodology is disputed by analysts.' },
  { t:'fake',      text:'Electric cars spontaneously combust at 100x rate of gasoline vehicles — claim officially rated false.' },
  { t:'real',      text:'WHO officials confirmed end of mpox public health emergency following declining global case counts.' },
  { t:'fake',      text:'Fabricated quote attributed to world leader spreads rapidly across major social media platforms.' },
  { t:'real',      text:'Global renewable energy capacity surpassed 3,000 GW for the first time ever, IEA report confirms.' },
  { t:'uncertain', text:'Leaked document raises questions about pharmaceutical trial data transparency requirements.' },
];

const TYPING_STEPS = [
  { icon: '🔍', text: 'Analysing article content…' },
  { icon: '🧠', text: 'Checking credibility signals…' },
  { icon: '⚡', text: 'Running AI detection model…' },
  { icon: '📊', text: 'Calculating confidence score…' },
  { icon: '✅', text: 'Generating result…' },
];

// Domain credibility database for URL checker
const FAKE_DOMAINS = ['beforeitsnews','infowars','naturalnews','worldnewsdailyreport',
  'empirenews','newspunch','yournewswire','nodisinfo','realrawmedia',
  'thegatewaypundit','globalresearch','activistpost','zerohedge'];
const REAL_DOMAINS = ['reuters','bbc','apnews','nytimes','washingtonpost',
  'theguardian','bloomberg','wsj','npr','pbs','nasa','who','cdc','nih',
  'nature','science','economist','bbc.co.uk','abc.net.au'];

// ════════════════════════════════════════════
// RULE ENGINE
// ════════════════════════════════════════════
const FAKE_RULES = [
  { r:/\b(plandemic|scamdemic)\b/i,                                         w:5, l:'Plandemic/scamdemic conspiracy term' },
  { r:/crisis\s+actor|false\s+flag/i,                                       w:5, l:'False flag / crisis actor claim' },
  { r:/new\s+world\s+order/i,                                               w:5, l:'New World Order conspiracy' },
  { r:/microchip.{0,20}vaccine/i,                                           w:5, l:'Vaccine microchip conspiracy claim' },
  { r:/\b(BREAKING|URGENT|BOMBSHELL|EXPLOSIVE)\b/,                          w:4, l:'Sensational all-caps alarm word' },
  { r:/government\s+(covering\s+up|hiding|suppressing)/i,                   w:4, l:'Government cover-up framing' },
  { r:/mainstream\s+media\s+(won'?t|refuses|hides)/i,                       w:4, l:'Mainstream media dismissal' },
  { r:/they\s+don'?t\s+want\s+you/i,                                        w:4, l:'Suppression framing' },
  { r:/wake\s+up\s+(sheeple|people)/i,                                      w:4, l:'Wake up sheeple language' },
  { r:/share\s+before\s+(deleted|removed)/i,                                w:4, l:'Share before deleted urgency' },
  { r:/you\s+won'?t\s+believe/i,                                            w:4, l:'Clickbait framing' },
  { r:/chemtrail/i,                                                          w:4, l:'Chemtrail conspiracy' },
  { r:/\bdeep\s+state\b/i,                                                  w:4, l:'Deep state conspiracy' },
  { r:/doctors?\s+hate\s+(him|her|this)/i,                                  w:3, l:'Clickbait "doctors hate" pattern' },
  { r:/\b(cures?|cured)\s+(cancer|diabetes|covid|hiv|aids)\b/i,             w:3, l:'Unverified disease cure claim' },
  { r:/miracle\s+(cure|pill|remedy|treatment)/i,                            w:3, l:'Miracle cure claim' },
  { r:/weird\s+(trick|hack|secret|method)/i,                                w:3, l:'Weird trick clickbait' },
  { r:/big\s+pharma\s+(doesn'?t|won'?t|hates?|hiding)/i,                   w:3, l:'Big Pharma conspiracy' },
  { r:/\b5[Gg]\s+(causes?|spreads?|transmit)/i,                             w:3, l:'5G conspiracy claim' },
  { r:/vaccines?\s+(cause[sd]?|linked\s+to)\s+(autism|death|microchip)/i,  w:3, l:'Vaccine harm conspiracy' },
  { r:/\billuminati\b|\bQAnon\b/i,                                          w:3, l:'Illuminati / QAnon reference' },
  { r:/leaked\s+(documents?|footage)\s+(confirm|prove)/i,                   w:3, l:'Unverified leaked documents claim' },
  { r:/!!!+/,                                                                w:2, l:'Excessive exclamation marks' },
  { r:/SHOCKING\b|EXPOSED\b/,                                               w:2, l:'Sensational SHOCKING/EXPOSED' },
  { r:/globalist|bankster|\bcabal\b/i,                                      w:2, l:'Conspiracy jargon' },
  { r:/allegedly|rumou?red/i,                                               w:1, l:'Unconfirmed language' },
];

const REAL_RULES = [
  { r:/according\s+to\s+(WHO|CDC|FDA|NIH|NASA|Reuters|AP\b|BBC)/i,         w:4, l:'Major credible organisation cited' },
  { r:/peer[\-\s]reviewed/i,                                                w:4, l:'Peer-reviewed research' },
  { r:/published\s+in\s+(nature|science|lancet|journal)/i,                  w:4, l:'Published in scientific journal' },
  { r:/\b(Reuters|Associated\s+Press|BBC|New\s+York\s+Times)\b/i,          w:4, l:'Major trusted news outlet' },
  { r:/university\s+of\s+\w+/i,                                             w:4, l:'University / academic source' },
  { r:/clinical\s+trial/i,                                                  w:3, l:'Clinical trial cited' },
  { r:/officials?\s+(said|confirmed|announced|stated)/i,                    w:3, l:'Official statement' },
  { r:/\b(FDA|CDC|WHO|NIH|NASA)\b/,                                         w:3, l:'Health / science authority cited' },
  { r:/\d+\.?\d*\s*(percent|%)/i,                                           w:2, l:'Specific statistical data' },
  { r:/basis\s+points?/i,                                                   w:2, l:'Financial precision data' },
  { r:/confirmed\s+by|verified\s+by/i,                                      w:2, l:'Independently verified' },
  { r:/according\s+to/i,                                                    w:1, l:'Cited sourcing' },
  { r:/report(s|ed|ing)\b/i,                                                w:1, l:'Reporting language' },
];

function runRules(text) {
  const words = text.split(/\s+/).filter(Boolean);
  let fs = 0, rs = 0;
  const redFlags = [], greenFlags = [];

  FAKE_RULES.forEach(({ r, w, l }) => { if (r.test(text)) { fs += w; redFlags.push(l); } });
  REAL_RULES.forEach(({ r, w, l }) => { if (r.test(text)) { rs += w; greenFlags.push(l); } });

  const caps  = words.filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const ratio = caps.length / Math.max(words.length, 1);
  const excl  = (text.match(/!/g) || []).length;

  if      (ratio > 0.35) { fs += 5; redFlags.push('Very high ALL-CAPS density'); }
  else if (ratio > 0.20) { fs += 3; redFlags.push('High ALL-CAPS density'); }
  else if (ratio > 0.10) { fs += 1; }

  if      (excl >= 4) fs += 4;
  else if (excl >= 3) fs += 3;
  else if (excl >= 2) fs += 2;
  else if (excl === 1) fs += 0.5;

  const net = fs - rs;
  let verdict, cls, conf;
  if      (net >= 6)  { verdict = 'LIKELY FAKE'; cls = 'fake';      conf = Math.min(72 + net*1.5, 97); }
  else if (net >= 3)  { verdict = 'LIKELY FAKE'; cls = 'fake';      conf = Math.min(58 + net*3, 85);   }
  else if (net <= -4) { verdict = 'LIKELY REAL'; cls = 'real';      conf = Math.min(70 + Math.abs(net)*2, 95); }
  else if (net <= -1) { verdict = 'LIKELY REAL'; cls = 'real';      conf = Math.min(55 + Math.abs(net)*4, 80); }
  else                { verdict = 'UNCERTAIN';   cls = 'uncertain'; conf = 45 + Math.floor(Math.random()*12); }

  return {
    verdict, cls,
    confidence    : parseFloat(conf.toFixed(1)),
    prob_fake     : cls === 'fake' ? parseFloat(conf.toFixed(1)) : parseFloat((100-conf).toFixed(1)),
    prob_real     : cls === 'real' ? parseFloat(conf.toFixed(1)) : parseFloat((100-conf).toFixed(1)),
    top_fake_words: redFlags.slice(0,4),
    top_real_words: greenFlags.slice(0,4),
    engine: 'Rule Engine', _tier: 3,
  };
}

// ════════════════════════════════════════════
// PYTHON API
// ════════════════════════════════════════════
async function checkPython() {
  try {
    const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      S.pythonOnline = true;
      setNavStatus('online', '🐍 Python model active');
      return true;
    }
  } catch (_) {}
  S.pythonOnline = false;
  if (!S.bertReady) setNavStatus('offline', '⚡ Rule engine active');
  return false;
}

async function callPython(text) {
  const r = await fetch(`${API_BASE}/predict`, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ text }),
    signal : AbortSignal.timeout(8000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  d._tier = 1;

  // Build reasons from API signals if available
  if (!d.top_fake_words || !d.top_fake_words.length) {
    const rule = runRules(text);
    d.top_fake_words = rule.top_fake_words;
    d.top_real_words = rule.top_real_words;
  }
  return d;
}

// ════════════════════════════════════════════
// BROWSER BERT
// ════════════════════════════════════════════
async function loadBERT() {
  if (S.bertReady || S.bertLoading) return;
  S.bertLoading = true;
  try {
    const { pipeline, env } = await import(TRANSFORMERS_CDN);
    env.allowLocalModels = false;
    env.useBrowserCache  = true;
    S.bert      = await pipeline('zero-shot-classification', BERT_MODEL);
    S.bertReady = true;
    S.bertLoading = false;
    if (!S.pythonOnline) setNavStatus('online', '🤖 BERT model active');
    showToast('🤖 BERT model loaded — enhanced accuracy active!');
  } catch (e) {
    S.bertLoading = false;
    console.warn('BERT load failed:', e.message);
  }
}

async function callBERT(text) {
  if (!S.bertReady) throw new Error('BERT not ready');
  const t0  = performance.now();
  const res = await S.bert(text.substring(0, 512), ZS_LABELS, { multi_label: false });
  const ms  = (performance.now() - t0).toFixed(0);

  const fi = res.labels.indexOf(ZS_LABELS[0]);
  const ri = res.labels.indexOf(ZS_LABELS[1]);
  const pf = res.scores[fi] * 100;
  const pr = res.scores[ri] * 100;

  let verdict, cls, conf;
  if      (pf >= 55) { verdict = 'LIKELY FAKE'; cls = 'fake';      conf = pf; }
  else if (pr >= 55) { verdict = 'LIKELY REAL'; cls = 'real';      conf = pr; }
  else               { verdict = 'UNCERTAIN';   cls = 'uncertain'; conf = Math.max(pf, pr); }

  const rule = runRules(text);
  return {
    verdict, cls,
    confidence    : parseFloat(conf.toFixed(1)),
    prob_fake     : parseFloat(pf.toFixed(1)),
    prob_real     : parseFloat(pr.toFixed(1)),
    top_fake_words: rule.top_fake_words,
    top_real_words: rule.top_real_words,
    engine: 'Browser BERT', _tier: 2,
    processing_ms: parseFloat(ms),
  };
}

// ════════════════════════════════════════════
// TYPING ANIMATION
// ════════════════════════════════════════════
function runTypingAnimation(callback, engineLabel) {
  const steps = [
    { icon:'🔍', text:'Analysing article content…' },
    { icon:'🧠', text:'Checking credibility signals…' },
    { icon:'⚡', text:`Running ${engineLabel}…` },
    { icon:'📊', text:'Calculating confidence score…' },
    { icon:'✅', text:'Generating result…' },
  ];

  showState('typing');
  const container = document.getElementById('typingSteps');
  container.innerHTML = '';
  let i = 0;

  const addStep = () => {
    if (i < steps.length - 1) {
      const el = document.createElement('div');
      el.className = 'typing-step';
      el.style.animationDelay = `${i * 0.05}s`;
      el.innerHTML = `
        <div class="step-icon done">✓</div>
        <div class="step-text done">${steps[i].icon} ${steps[i].text}</div>`;
      container.appendChild(el);
      i++;
      setTimeout(addStep, 380);
    } else {
      // Last step — spinner
      const el = document.createElement('div');
      el.className = 'typing-step';
      el.innerHTML = `
        <div class="step-icon spin"></div>
        <div class="step-text">${steps[i].icon} ${steps[i].text}</div>`;
      container.appendChild(el);
      callback();
    }
  };
  addStep();
}

// ════════════════════════════════════════════
// MAIN ANALYZE HANDLER
// ════════════════════════════════════════════
let currentTab = 'text';

function handleAnalyze() {
  if (currentTab === 'text') analyzeText();
  else analyzeUrl();
}

async function analyzeText() {
  const text = document.getElementById('textInput').value.trim();
  if (!text || text.length < 10) { showToast('⚠️ Please enter more text.'); return; }

  if (!S.bertReady && !S.bertLoading) loadBERT();

  const engineLabel = S.pythonOnline ? 'Python WELFake model' : S.bertReady ? 'Browser BERT' : 'Rule Engine';

  runTypingAnimation(async () => {
    let result;

    // Tier 1: Python
    if (S.pythonOnline) {
      try { result = await callPython(text); }
      catch (e) {
        S.pythonOnline = false;
        setNavStatus('offline', 'API disconnected');
      }
    }

    // Tier 2: BERT
    if (!result && S.bertReady) {
      try { result = await callBERT(text); }
      catch (e) { console.warn('BERT error:', e); }
    }

    // Tier 3: Rules
    if (!result) {
      result = runRules(text);
      if (S.bertLoading) {
        // Auto-upgrade when BERT loads
        const iv = setInterval(async () => {
          if (S.bertReady) {
            clearInterval(iv);
            try {
              const br = await callBERT(text);
              renderResult(br);
              showToast('🤖 Result upgraded to BERT!');
            } catch (_) {}
          }
        }, 2000);
      }
    }

    renderResult(result);
  }, engineLabel);
}

async function analyzeUrl() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) { showToast('⚠️ Please enter a URL.'); return; }

  const domain   = url.replace(/https?:\/\//, '').split('/')[0].toLowerCase();
  const fakeHits = FAKE_DOMAINS.filter(d => domain.includes(d));
  const realHits = REAL_DOMAINS.filter(d => domain.includes(d));

  runTypingAnimation(async () => {
    // Try Python API with domain text
    if (S.pythonOnline) {
      try {
        const result = await callPython(`News article from domain: ${domain}. URL: ${url}`);
        renderResult(result);
        return;
      } catch (_) {}
    }

    // Domain DB fallback
    let verdict, cls, conf;
    if      (fakeHits.length > 0) { verdict='LIKELY FAKE'; cls='fake';      conf=91; }
    else if (realHits.length > 0) { verdict='LIKELY REAL'; cls='real';      conf=87; }
    else                          { verdict='UNCERTAIN';   cls='uncertain'; conf=52; }

    const result = {
      verdict, cls, confidence: conf,
      prob_fake     : cls==='fake' ? conf : 100-conf,
      prob_real     : cls==='real' ? conf : 100-conf,
      top_fake_words: fakeHits.length > 0 ? [`Known unreliable domain: ${domain}`, 'Flagged misinformation source'] : [],
      top_real_words: realHits.length > 0 ? [`Known credible domain: ${domain}`, 'Established news outlet'] : ['Domain unknown — verify manually'],
      engine        : 'Domain Database', _tier: 3,
    };
    renderResult(result);
  }, 'Domain Checker');
}

// ════════════════════════════════════════════
// RENDER RESULT
// ════════════════════════════════════════════
function renderResult(data) {
  const cls     = data.cls || data.verdict_class || 'uncertain';
  const conf    = parseFloat(data.confidence) || 0;
  const pf      = parseFloat(data.prob_fake)  || 0;
  const pr      = parseFloat(data.prob_real)  || 0;
  const verdict = data.verdict || 'UNCERTAIN';

  // Determine confidence level label
  const confLevel = conf >= 90 ? 'Very High' : conf >= 75 ? 'High' : conf >= 55 ? 'Medium' : 'Low';
  const verdictIcon = cls === 'fake' ? '🟥' : cls === 'real' ? '🟩' : '🟨';

  showState('result');

  // Verdict banner
  const banner = document.getElementById('verdictBanner');
  banner.className = `verdict-banner ${cls}`;
  document.getElementById('verdictIcon').textContent  = verdictIcon;
  document.getElementById('verdictLabel').textContent = verdict;
  document.getElementById('verdictSub').textContent   = `Confidence Level: ${confLevel}`;
  document.getElementById('verdictPct').textContent   = conf.toFixed(1) + '%';

  // Confidence meter
  setTimeout(() => {
    const fill = document.getElementById('meterFill');
    fill.style.width = Math.min(conf, 100) + '%';
    // Animate number
    let cur = 0;
    const target = conf;
    const iv = setInterval(() => {
      cur = Math.min(cur + target/40, target);
      document.getElementById('meterVal').textContent = cur.toFixed(1) + '%';
      if (cur >= target) clearInterval(iv);
    }, 20);
  }, 60);

  // Prob bars
  setTimeout(() => {
    document.getElementById('probFake').style.width    = Math.min(pf, 100) + '%';
    document.getElementById('probReal').style.width    = Math.min(pr, 100) + '%';
    document.getElementById('probFakeNum').textContent = pf.toFixed(1) + '%';
    document.getElementById('probRealNum').textContent = pr.toFixed(1) + '%';
  }, 100);

  // Reasons list
  const reasonsList = document.getElementById('reasonsList');
  const fakeWords   = data.top_fake_words || [];
  const realWords   = data.top_real_words || [];

  let reasonsHTML = '';
  if (fakeWords.length) {
    fakeWords.slice(0,3).forEach(w => {
      reasonsHTML += `<div class="reason-item">
        <div class="reason-bullet fake">✕</div>
        <span>${w}</span>
      </div>`;
    });
  }
  if (realWords.length) {
    realWords.slice(0,3).forEach(w => {
      reasonsHTML += `<div class="reason-item">
        <div class="reason-bullet real">✓</div>
        <span>${w}</span>
      </div>`;
    });
  }
  if (!fakeWords.length && !realWords.length) {
    reasonsHTML = `<div class="reason-item"><span style="color:var(--text-muted)">No specific signals detected — result based on overall language patterns.</span></div>`;
  }
  reasonsList.innerHTML = reasonsHTML;

  // Engine badge
  const tier  = data._tier || 3;
  const ecls  = tier === 1 ? 'python' : tier === 2 ? 'bert' : 'rule';
  const elbl  = tier === 1 ? '🐍 Python WELFake' : tier === 2 ? '🤖 Browser BERT' : '⚡ Rule Engine';
  const ms    = data.processing_ms > 0 ? ` · ${data.processing_ms}ms` : '';
  document.getElementById('engineBadgeRow').innerHTML =
    `<span class="eng-chip ${ecls}">${elbl}</span><span>${ms}</span>`;
}

// ════════════════════════════════════════════
// UI HELPERS
// ════════════════════════════════════════════
function showState(state) {
  document.getElementById('stateEmpty').style.display   = state==='empty'   ? 'flex' : 'none';
  document.getElementById('stateTyping').style.display  = state==='typing'  ? 'flex' : 'none';
  document.getElementById('stateResult').style.display  = state==='result'  ? 'flex' : 'none';
}

function clearAll() {
  document.getElementById('textInput').value  = '';
  document.getElementById('urlInput').value   = '';
  document.getElementById('charCount').textContent = '0 chars';
  showState('empty');
}

function updateChar(el) {
  document.getElementById('charCount').textContent = el.value.length + ' chars';
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('active');
  document.getElementById(`content${tab.charAt(0).toUpperCase()+tab.slice(1)}`).classList.add('active');
}

function loadSample(i) {
  // Switch to text tab
  switchTab('text');
  const ta = document.getElementById('textInput');
  ta.value = SAMPLES[i];
  updateChar(ta);
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => analyzeText(), 300);
}

function setNavStatus(state, text) {
  const dot  = document.getElementById('statusDot');
  const span = document.getElementById('statusText');
  if (dot)  dot.className   = `status-dot ${state}`;
  if (span) span.textContent = text;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ════════════════════════════════════════════
// LIVE FEED
// ════════════════════════════════════════════
let feedIdx = 0;
function addFeedItem() {
  const item = FEED_HEADLINES[feedIdx++ % FEED_HEADLINES.length];
  const list = document.getElementById('feedList');
  const el   = document.createElement('div');
  el.className = 'feed-item';
  const lbl  = item.t === 'real' ? 'Real' : item.t === 'fake' ? 'Fake' : 'Uncertain';
  const time = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  el.innerHTML = `
    <div class="feed-badge ${item.t}">${lbl}</div>
    <div class="feed-text">${item.text}</div>
    <div class="feed-time">${time}</div>`;
  list.insertBefore(el, list.firstChild);
  if (list.children.length > 6) list.removeChild(list.lastChild);
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
window.addEventListener('load', () => {
  initParticles();
  showState('empty');
  setNavStatus('offline', 'Connecting…');
  checkPython();
  setInterval(checkPython, 15000);
  setTimeout(() => loadBERT(), 2500);
  addFeedItem();
  setInterval(addFeedItem, 4000);
});
