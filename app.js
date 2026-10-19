/* =====================================================================
   tools.url2.at (studio edition) — page behaviour and the live demos.
   Plain JavaScript. The Leetcode Notes screens come from notes-demo.js,
   which is bundled from the Next app (see build-notes-demo.mjs).
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- Helpers ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  function storeGet(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function storeSet(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fetchWithTimeout(url, opts, ms) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 5000);
    var options = Object.assign({}, opts || {}, ctrl ? { signal: ctrl.signal } : {});
    return fetch(url, options).finally(function () { clearTimeout(timer); });
  }

  function fmtDate(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  function daysFromToday(n) { var d = new Date(); d.setDate(d.getDate() + n); return d; }
  function money(n) { return "$" + n.toFixed(2); }
  function effectiveTheme() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t === "light" || t === "dark") return t;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  /* Copy inside the click handler; if the clipboard is refused, select the text instead. */
  function copyText(text, btn, selectEl) {
    var label = btn.querySelector("span") || btn;
    var original = label.getAttribute("data-label") || label.textContent;
    label.setAttribute("data-label", original);
    var done = function (ok) {
      if (!ok && selectEl) {
        var range = document.createRange();
        range.selectNodeContents(selectEl);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      label.textContent = ok ? "Copied" : "Selected";
      setTimeout(function () { label.textContent = original; }, 1800);
    };
    try {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } catch (e) {
      done(false);
    }
  }

  /* Accessible tabs: click + arrow keys inside the tablist. */
  function setupTabs(tablist, onChange) {
    var tabs = $$('[role="tab"]', tablist);
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      if (onChange) onChange(tab);
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { select(t, false); }); });
    tablist.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = tabs.length - 1;
      if (n !== null) { e.preventDefault(); select(tabs[n], true); }
    });
    return function (tabOrId) {
      var t = typeof tabOrId === "string" ? document.getElementById(tabOrId) : tabOrId;
      if (t) select(t, false);
    };
  }

  /* Types a window's address the way a browser fills it in. */
  var typingTimer = null;
  function typeAddress(scope) {
    if (!scope) return;
    var win = $$(".window", scope).filter(function (w) { return !w.hidden; })[0];
    if (!win) return;
    var el = $(".address__text", win);
    if (!el) return;
    var full = el.getAttribute("data-url") || el.textContent;
    clearInterval(typingTimer);
    if (reduceMotion) { el.textContent = full; return; }
    var i = 0;
    el.textContent = "";
    el.classList.add("is-typing");
    typingTimer = setInterval(function () {
      i += Math.max(1, Math.round(full.length / 28));
      el.textContent = full.slice(0, i);
      if (i >= full.length) {
        clearInterval(typingTimer);
        el.textContent = full;
        el.classList.remove("is-typing");
      }
    }, 16);
  }

  /* ---------- Public APIs for the demos ---------- */
  var WORDS_API = "https://words.url2.at/api/words";
  var SHORTEN_API = "https://url2.at/api/tinyurl";
  var SAMPLE_WORDS = [
    { word: "serendipity", pos: "noun", def: "The occurrence of events by chance in a happy or beneficial way." },
    { word: "ephemeral", pos: "adjective", def: "Lasting for a very short time." },
    { word: "ubiquitous", pos: "adjective", def: "Present, appearing, or found everywhere." },
    { word: "lucid", pos: "adjective", def: "Expressed clearly; easy to understand." },
    { word: "resilient", pos: "adjective", def: "Able to withstand or recover quickly from difficulties." },
    { word: "laconic", pos: "adjective", def: "Using very few words." },
    { word: "sanguine", pos: "adjective", def: "Optimistic, especially in a difficult situation." },
    { word: "candor", pos: "noun", def: "The quality of being open and honest." },
    { word: "meticulous", pos: "adjective", def: "Showing great attention to detail; very careful and precise." }
  ];
  var sampleIdx = 0;

  /* Resolves to { w: {word, pos, def}, live: boolean }. Falls back to a sample word. */
  function apiWord() {
    return fetchWithTimeout(WORDS_API, { headers: { Accept: "application/json" } }, 4500)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (!d || !d._id) throw new Error("Unexpected payload");
        var m = Array.isArray(d.meanings) && d.meanings[0] ? d.meanings[0] : {};
        return { w: { word: d._id, pos: m.speech_part || "", def: m.definition || "Definition not available." }, live: true };
      })
      .catch(function () {
        sampleIdx = (sampleIdx + 1) % SAMPLE_WORDS.length;
        return { w: SAMPLE_WORDS[sampleIdx], live: false };
      });
  }

  function normalizeUrl(raw) {
    var v = raw.trim();
    if (!v) return { error: "Paste a link to shorten." };
    if (/\s/.test(v)) return { error: "Links can’t contain spaces. Paste the full URL, like https://example.com/page." };
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v;
    var u;
    try { u = new URL(v); } catch (e) { return { error: "That doesn’t look like a link. Try something like https://example.com/page." }; }
    if (!/^https?:$/.test(u.protocol)) return { error: "Only http and https links can be shortened." };
    if (u.hostname.indexOf(".") === -1) return { error: "Add the full domain, like example.com." };
    return { url: u.href };
  }

  /* Deterministic 5-character code, shown only when the API can't be reached. */
  function previewCode(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    h = h >>> 0;
    var chars = "abcdefghijkmnpqrstuvwxyz23456789", out = "";
    for (var j = 0; j < 5; j++) { out += chars[h % chars.length]; h = Math.floor(h / chars.length) + (j + 1) * 7919; }
    return out;
  }

  /* Resolves to { shortUrl, live } or { error }. */
  function apiShorten(longUrl) {
    return fetchWithTimeout(SHORTEN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ longUrl: longUrl })
    }, 6000)
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (r.status === 400 && data.error) return { error: data.error };
          if (!r.ok) throw new Error("HTTP " + r.status);
          var s = data.tinyUrl || data.shortUrl;
          if (!s) throw new Error("No short URL in response");
          return { shortUrl: s, live: true };
        });
      })
      .catch(function () { return { shortUrl: "https://url2.at/" + previewCode(longUrl), live: false }; });
  }

  /* =====================================================================
     Theme toggle
     ===================================================================== */
  var themeListeners = [];
  (function theme() {
    var root = document.documentElement;
    var btn = $("#theme-toggle");
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var sync = function () {
      var t = effectiveTheme();
      if (btn) {
        btn.setAttribute("data-mode", t);
        btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
      }
      themeListeners.forEach(function (fn) { fn(t); });
    };
    if (btn) {
      btn.addEventListener("click", function () {
        var next = effectiveTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        storeSet("tools-theme", next);
        sync();
      });
    }
    if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }
    sync();
  })();

  /* =====================================================================
     Live stage: product switcher + Leetcode Notes views
     ===================================================================== */
  var stageApi = (function stage() {
    var switcher = $(".switcher");
    if (!switcher) return { select: function () {}, setMode: function () {} };
    var modeGroups = { notes: $("#modes-notes") };

    function setMode(group, mode) {
      $$(".modes__btn", modeGroups[group]).forEach(function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode));
      });
      $$('.view[data-group="' + group + '"]').forEach(function (v) {
        v.hidden = v.getAttribute("data-mode") !== mode;
      });
    }

    Object.keys(modeGroups).forEach(function (group) {
      $$(".modes__btn", modeGroups[group]).forEach(function (b) {
        b.addEventListener("click", function () { setMode(group, b.getAttribute("data-mode")); });
      });
    });

    var select = setupTabs(switcher, function (tab) {
      var tool = tab.getAttribute("data-tool");
      Object.keys(modeGroups).forEach(function (g) { modeGroups[g].hidden = g !== tool; });
      typeAddress(document.getElementById("panel-" + tool));
    });

    /* Any [data-try] link (hero, directory) jumps to the stage and opens that tool. */
    $$("[data-try]").forEach(function (a) {
      a.addEventListener("click", function () {
        var tool = a.getAttribute("data-try");
        select("tab-" + tool);
        var mode = a.getAttribute("data-try-mode");
        if (mode && modeGroups[tool]) setMode(tool, mode);
      });
    });

    return { select: select, setMode: setMode };
  })();
  void stageApi;

  /* =====================================================================
     Directory: user total + platform filters
     ===================================================================== */
  (function directory() {
    var total = $$("[data-users]").reduce(function (sum, el) { return sum + (parseInt(el.getAttribute("data-users"), 10) || 0); }, 0);
    var stat = $("#stat-users");
    if (stat) stat.textContent = total.toLocaleString("en-US");

    var buttons = $$(".filters__btn");
    var rows = $$(".row");
    var countEl = $("#filter-count");

    function apply(id) {
      var shown = 0;
      rows.forEach(function (r) {
        var match = id === "all" || r.getAttribute("data-tags").split(" ").indexOf(id) !== -1;
        r.hidden = !match;
        if (match) shown++;
      });
      var label = "";
      buttons.forEach(function (b) {
        var on = b.getAttribute("data-filter") === id;
        b.setAttribute("aria-pressed", String(on));
        if (on) label = b.firstChild.textContent.trim();
      });
      countEl.textContent = id === "all"
        ? "Showing all " + rows.length + " products"
        : "Showing " + shown + " of " + rows.length + " · " + label;
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
    });
  })();

  /* =====================================================================
     Responsive hero
     ===================================================================== */
  (function responsiveHero() {
    var variants = $$(".hero-variant");

    function applyHero(v) {
      variants.forEach(function (el) { el.hidden = el.getAttribute("data-variant") !== v; });
      if (v === "collage") collageFit();
    }

    /* Scale the 480 × 500 collage to fill the visual column, including zooming in. */
    function collageFit() {
      var wrap = $(".collage-fit");
      var collage = $("#collage");
      if (!wrap || !collage || wrap.hidden) return;
      var k = wrap.clientWidth / 480;
      collage.style.transform = "scale(" + k + ")";
      wrap.style.height = Math.round(500 * k) + "px";
    }
    function updateHero() {
      var hero = $(".hero");
      var visual = $(".hero__visual");
      var copy = $(".hero__copy");
      var nav = $(".nav");
      if (!hero || !visual || !copy) return;
      var style = getComputedStyle(hero);
      var availableHeight = window.innerHeight - (nav ? nav.getBoundingClientRect().height : 0)
        - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      var collageHeight = 500 * visual.clientWidth / 480;
      // Keep the real screens at least their original size and inside the first viewport.
      var fits = window.innerWidth > 1000 && visual.clientWidth >= 480
        && Math.max(collageHeight, copy.getBoundingClientRect().height) <= availableHeight;
      applyHero(fits ? "collage" : "mosaic");
    }
    window.addEventListener("resize", updateHero);
    if (document.fonts) document.fonts.ready.then(updateHero);

    updateHero();
  })();

  /* =====================================================================
     Logo-mark background: drifting marks with a pointer-following spotlight
     ===================================================================== */
  (function backgroundMarks() {
    var canvas = $("#bg-marks");
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext("2d");
    var SPACING = 68;
    var SQ = 6;
    var GAP = 2;
    var W = 0, H = 0, dpr = 1;
    var colors = ["#7C5CF0", "#0A55F5", "#1B2D45", "#F5A524"];
    var baseAlpha = 0.13;
    var marks = [];
    var raf = 0;
    var start = performance.now();
    var pointer = { x: 0, y: 0, last: -1e9 };

    function readColors(theme) {
      var cs = getComputedStyle(document.documentElement);
      colors = ["--t-words", "--t-url", "--t-cursor", "--t-notes"].map(function (v, i) {
        return cs.getPropertyValue(v).trim() || colors[i];
      });
      baseAlpha = (theme || effectiveTheme()) === "dark" ? 0.2 : 0.13;
    }

    function build() {
      var cols = Math.ceil(W / SPACING) + 3;
      var rows = Math.ceil(H / SPACING) + 3;
      marks = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          marks.push({
            gx: c * SPACING + (r % 2 ? SPACING / 2 : 0),
            gy: r * SPACING,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
      frame(performance.now());
    }

    function drawMark(x, y, scale, alpha) {
      if (alpha <= 0.004 || scale <= 0.05) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      var o = -(SQ + GAP / 2);
      for (var i = 0; i < 4; i++) {
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.fillStyle = colors[i];
        var dx = o + (i % 2) * (SQ + GAP);
        var dy = o + (i > 1 ? 1 : 0) * (SQ + GAP);
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(dx, dy, SQ, SQ, 1.6); ctx.fill(); }
        else ctx.fillRect(dx, dy, SQ, SQ);
      }
      ctx.restore();
    }

    function frame(now) {
      var t = (now - start) / 1000;
      ctx.clearRect(0, 0, W, H);
      var spot = now - pointer.last < 3500
        ? { x: pointer.x, y: pointer.y }
        : { x: W * (0.5 + 0.32 * Math.sin(t * 0.35)), y: H * (0.42 + 0.25 * Math.sin(t * 0.52 + 1)) };
      var driftX = (t * 14) % SPACING;
      var driftY = (t * 9) % SPACING;

      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        var x = m.gx - SPACING + driftX;
        var y = m.gy - SPACING + driftY;
        var fade = 1 - 0.55 * Math.max(0, Math.min(1, y / H));
        y += Math.sin(t * 0.9 + m.phase) * 3;
        var alpha = baseAlpha * (0.8 + 0.25 * Math.sin(t * 0.7 + m.phase));
        var dx = x - spot.x, dy = y - spot.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var s = Math.max(0, 1 - d / 260);
        var scale = 0.7 + 0.85 * s * s;
        alpha *= 0.45 + 2.6 * s * s;
        drawMark(x, y, scale, alpha * fade);
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", function (e) {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.last = performance.now();
    }, { passive: true });
    themeListeners.push(function (theme) { readColors(theme); if (!raf) frame(performance.now()); });

    readColors();
    resize();
    if (!reduceMotion) raf = requestAnimationFrame(loop);
  })();

  /* =====================================================================
     url2.at: the real shorten card
     ===================================================================== */
  (function shortener() {
    var form = $("#short-form");
    if (!form) return;
    var input = $("#short-input");
    var submit = $("#short-submit");
    var errorEl = $("#short-error");
    var result = $("#short-result");
    var linkEl = $("#short-link");
    var noteEl = $("#short-note");
    var copyBtn = $("#short-copy");
    var currentShort = "";

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      input.setAttribute("aria-invalid", "true");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = normalizeUrl(input.value);
      if (n.error) { showError(n.error); input.focus(); return; }
      errorEl.hidden = true;
      input.removeAttribute("aria-invalid");
      submit.disabled = true;
      submit.textContent = "Shortening...";

      apiShorten(n.url).then(function (res) {
        submit.disabled = false;
        submit.textContent = "Shorten URL";
        if (res.error) { showError(res.error); return; }
        currentShort = res.shortUrl;
        linkEl.innerHTML = res.live
          ? '<a href="' + escapeHtml(res.shortUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(res.shortUrl) + "</a>"
          : "<span>" + escapeHtml(res.shortUrl) + "</span>";
        noteEl.hidden = res.live;
        noteEl.textContent = res.live ? "" : "Preview only. url2.at couldn’t be reached from here, so this link isn’t live. Shorten it on url2.at to make it real.";
        copyBtn.textContent = "Copy";
        result.hidden = false;
        /* Replay the reveal animation on every new link, like the real card. */
        result.style.animation = "none";
        void result.offsetWidth;
        result.style.animation = "";
      });
    });

    copyBtn.addEventListener("click", function () {
      if (!currentShort) return;
      var done = function (ok) {
        copyBtn.textContent = ok ? "Copied!" : "Copy";
        if (!ok) {
          var range = document.createRange();
          range.selectNodeContents(linkEl);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        setTimeout(function () { copyBtn.textContent = "Copy"; }, 2000);
      };
      try {
        navigator.clipboard.writeText(currentShort).then(function () { done(true); }, function () { done(false); });
      } catch (err) {
        done(false);
      }
    });
  })();

  /* =====================================================================
     Word of the Day: the real card, fed by the public Words API
     ===================================================================== */
  (function wordOfTheDay() {
    var card = $("#wotd-card");
    if (!card) return;
    var els = { word: $("#wotd-word"), pos: $("#wotd-pos"), def: $("#wotd-def"), next: $("#wotd-next"), source: $("#wotd-source") };
    var busy = false;

    function setSource(live) {
      els.source.innerHTML = live
        ? '<span class="dot dot--ok" aria-hidden="true"></span>Live from words.url2.at/api/words'
        : '<span class="dot dot--idle" aria-hidden="true"></span>Sample word · the live API isn’t reachable from here';
    }

    /* Same sequence as the real WordCard: fade the word out, swap, fade back in. */
    function load(initial) {
      if (busy) return;
      busy = true;
      els.next.disabled = true;
      card.setAttribute("aria-busy", "true");
      if (!initial) els.word.style.opacity = "0";

      apiWord().then(function (res) {
        if (initial && !res.live) { setSource(false); return; }
        if (initial) els.word.style.opacity = "0";
        return wait(reduceMotion ? 0 : 200).then(function () {
          els.word.textContent = res.w.word;
          els.pos.textContent = res.w.pos;
          els.def.textContent = res.w.def;
          setSource(res.live);
        });
      }).finally(function () {
        els.word.style.opacity = "1";
        card.removeAttribute("aria-busy");
        els.next.disabled = false;
        busy = false;
      });
    }

    els.next.addEventListener("click", function () { load(false); });
    load(true);
  })();

  /* =====================================================================
     Cursor Usage Tracker: the real popup card, driven by the simulator
     ===================================================================== */
  (function cursorUsage() {
    var INCLUDED = 50;
    var ON_DEMAND_LIMIT = 20;
    var RESET_IN_DAYS = 11;

    var range = $("#cu-range");
    if (!range) return;
    var od = $("#cu-ondemand");
    var els = {
      out: $("#cu-range-out"), pct: $("#cu-pct"), sub: $("#cu-sub"), meter: $("#cu-meter"), fill: $("#cu-meter-fill"),
      used: $("#cu-used"), resetDays: $("#cu-reset-days"), resetDate: $("#cu-reset-date"),
      odBox: $("#cu-od"), odVal: $("#cu-od-val"), icon: $("#cu-icon"), popup: $("#cu-popup"), hint: $("#cu-hint")
    };

    els.resetDays.textContent = RESET_IN_DAYS + "d";
    els.resetDate.textContent = "on " + fmtDate(daysFromToday(RESET_IN_DAYS));

    function render(animatePct) {
      var raw = parseFloat(range.value);
      var onDemand = od.checked;
      var used = onDemand ? raw : Math.min(raw, INCLUDED);
      var included = Math.min(used, INCLUDED);
      var pct = Math.round((included / INCLUDED) * 100);
      var over = Math.min(ON_DEMAND_LIMIT, Math.max(0, used - INCLUDED));

      els.out.textContent = money(used) + (!onDemand && raw > INCLUDED ? " · limit" : "");
      els.sub.textContent = pct >= 100 ? "included limit reached" : "of included limit";
      els.fill.style.width = pct + "%";
      els.meter.setAttribute("aria-valuenow", String(pct));
      els.used.textContent = money(included);
      els.odBox.hidden = !onDemand;
      els.odVal.textContent = money(over);

      if (animatePct && !reduceMotion) {
        var startTime = performance.now();
        var step = function (now) {
          var t = Math.min(1, (now - startTime) / 600);
          els.pct.textContent = Math.round(pct * (1 - Math.pow(1 - t, 3))) + "%";
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      } else {
        els.pct.textContent = pct + "%";
      }
    }

    range.addEventListener("input", function () { render(false); });
    od.addEventListener("change", function () { render(false); });

    els.icon.addEventListener("click", function () {
      var open = els.popup.hidden;
      els.popup.hidden = !open;
      els.hint.hidden = open;
      els.icon.setAttribute("aria-expanded", String(open));
      if (open) render(true);
    });

    render(false);
  })();

  /* =====================================================================
     API endpoints, copy buttons, footer year
     ===================================================================== */
  var endpoints = $(".endpoints");
  if (endpoints) setupTabs(endpoints);

  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy"));
      if (target) copyText(target.textContent, btn, target);
    });
  });

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
