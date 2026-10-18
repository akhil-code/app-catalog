/* =====================================================================
   tools.url2.at — page behaviour and the four live demos.
   Plain JavaScript, no build step, no dependencies.
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
      label.textContent = ok ? "Copied!" : "Selected";
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
  }

  /* Tiny Python highlighter for the code blocks. */
  function highlightPython(code) {
    var re = /("[^"\n]*"|'[^'\n]*')|(#.*$)|\b(\d+(?:\.\d+)?)\b|\b(def|class|for|in|if|elif|else|while|return|not|and|or|is|None|True|False|continue|break|lambda)\b|([A-Za-z_]\w*)(?=\()/gm;
    var out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      var cls = m[1] ? "str" : m[2] ? "cm" : m[3] ? "num" : m[4] ? "kw" : "fn";
      out += '<span class="' + cls + '">' + escapeHtml(m[0]) + "</span>";
      last = re.lastIndex;
    }
    return out + escapeHtml(code.slice(last));
  }

  /* =====================================================================
     Theme toggle
     ===================================================================== */
  (function theme() {
    var root = document.documentElement;
    var btn = $("#theme-toggle");
    if (!btn) return;
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    var effective = function () { return root.getAttribute("data-theme") || (mq.matches ? "dark" : "light"); };
    var sync = function () {
      var t = effective();
      btn.setAttribute("data-mode", t);
      btn.setAttribute("aria-label", t === "dark" ? "Switch to light theme" : "Switch to dark theme");
    };
    btn.addEventListener("click", function () {
      var next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      storeSet("tools-theme", next);
      sync();
    });
    if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
    if (typeof MutationObserver !== "undefined") {
      new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    }
    sync();
  })();

  /* =====================================================================
     Directory: user total + category filters
     ===================================================================== */
  (function directory() {
    var total = $$("[data-users]").reduce(function (sum, el) { return sum + (parseInt(el.getAttribute("data-users"), 10) || 0); }, 0);
    var stat = $("#stat-users");
    if (stat) stat.textContent = total.toLocaleString("en-US");

    var buttons = $$(".filter");
    var products = $$(".product");
    var countEl = $("#filter-count");
    var emptyEl = $("#filter-empty");

    function apply(id) {
      var shown = 0;
      products.forEach(function (p) {
        var match = id === "all" || p.getAttribute("data-tags").split(" ").indexOf(id) !== -1;
        p.hidden = !match;
        if (match) shown++;
      });
      var label = "";
      buttons.forEach(function (b) {
        var on = b.getAttribute("data-filter") === id;
        b.setAttribute("aria-pressed", String(on));
        if (on) label = b.textContent;
      });
      countEl.textContent = id === "all"
        ? "Showing all " + products.length + " products"
        : "Showing " + shown + " of " + products.length + " · " + label;
      emptyEl.hidden = shown > 0;
    }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () { apply(b.getAttribute("data-filter")); });
    });
  })();

  /* =====================================================================
     Demo 1 · Word of the Day (live Words API, sample fallback)
     ===================================================================== */
  (function wordOfTheDay() {
    var WORDS_API = "https://words.url2.at/api/words";
    var SAMPLE_WORDS = [
      { word: "serendipity", pos: "noun", def: "The occurrence of events by chance in a happy or beneficial way.", ex: "A fortunate stroke of serendipity brought them together.", syn: ["chance", "fortune"] },
      { word: "ephemeral", pos: "adjective", def: "Lasting for a very short time.", ex: "Fashion is ephemeral; style is eternal.", syn: ["fleeting", "transient"] },
      { word: "ubiquitous", pos: "adjective", def: "Present, appearing, or found everywhere.", ex: "Smartphones have become ubiquitous in modern life.", syn: ["omnipresent", "pervasive"] },
      { word: "lucid", pos: "adjective", def: "Expressed clearly; easy to understand.", ex: "She gave a lucid explanation of the problem.", syn: ["clear", "coherent"] },
      { word: "resilient", pos: "adjective", def: "Able to withstand or recover quickly from difficulties.", ex: "The community proved resilient after the storm.", syn: ["tough", "adaptable"] },
      { word: "laconic", pos: "adjective", def: "Using very few words.", ex: "His laconic reply ended the meeting early.", syn: ["terse", "succinct"] },
      { word: "sanguine", pos: "adjective", def: "Optimistic, especially in a difficult situation.", ex: "She stayed sanguine about the release date.", syn: ["hopeful", "upbeat"] },
      { word: "candor", pos: "noun", def: "The quality of being open and honest.", ex: "I appreciated the candor of the code review.", syn: ["frankness", "honesty"] },
      { word: "meticulous", pos: "adjective", def: "Showing great attention to detail; very careful and precise.", ex: "Her meticulous notes made the review easy.", syn: ["careful", "thorough"] }
    ];

    var card = $("#wotd-card");
    if (!card) return;
    var els = {
      word: $("#wotd-word"), pos: $("#wotd-pos"), def: $("#wotd-def"), ex: $("#wotd-ex"), syn: $("#wotd-syn"),
      next: $("#wotd-next"), source: $("#wotd-source"), list: $("#wotd-history-list"), count: $("#wotd-count"), speak: $("#wotd-speak")
    };

    var state = {
      idx: 0,
      busy: false,
      current: SAMPLE_WORDS[0],
      history: [
        { w: SAMPLE_WORDS[0], when: "Today" },
        { w: SAMPLE_WORDS[5], when: "Yesterday", example: true },
        { w: SAMPLE_WORDS[7], when: fmtDate(daysFromToday(-2)), example: true },
        { w: SAMPLE_WORDS[8], when: fmtDate(daysFromToday(-3)), example: true }
      ]
    };

    function parseApiWord(d) {
      if (!d || !d._id) throw new Error("Unexpected payload");
      var m = Array.isArray(d.meanings) && d.meanings[0] ? d.meanings[0] : {};
      return {
        word: d._id,
        pos: m.speech_part || "",
        def: m.definition || "Definition not available.",
        ex: m.example || "",
        syn: Array.isArray(m.synonyms) ? m.synonyms.slice(0, 4) : []
      };
    }

    function render(w) {
      els.word.textContent = w.word;
      els.pos.textContent = w.pos;
      els.pos.parentElement.hidden = !w.pos;
      els.def.textContent = w.def;
      els.ex.textContent = w.ex ? "“" + w.ex + "”" : "";
      els.syn.innerHTML = w.syn.map(function (s) { return "<li>" + escapeHtml(s) + "</li>"; }).join("");
    }

    function setSource(live) {
      els.source.innerHTML = live
        ? '<span class="dot dot--ok" aria-hidden="true"></span>Live from words.url2.at/api/words'
        : '<span class="dot dot--idle" aria-hidden="true"></span>Sample word · the live API isn’t reachable from here';
    }

    function renderHistory() {
      els.list.innerHTML = state.history.map(function (h) {
        return '<li class="' + (h.example ? "is-example" : "") + '">' +
          '<span class="history__word">' + escapeHtml(h.w.word) + "</span>" +
          '<span class="history__when">' + escapeHtml(h.when) + (h.example ? " · example" : "") + "</span>" +
          '<span class="history__def">' + (h.w.pos ? escapeHtml(h.w.pos) + " · " : "") + escapeHtml(h.w.def) + "</span>" +
          "</li>";
      }).join("");
      els.count.textContent = String(state.history.length);
    }

    function getWord() {
      return fetchWithTimeout(WORDS_API, { headers: { Accept: "application/json" } }, 4500)
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) { return { w: parseApiWord(d), live: true }; })
        .catch(function () {
          state.idx = (state.idx + 1) % SAMPLE_WORDS.length;
          return { w: SAMPLE_WORDS[state.idx], live: false };
        });
    }

    function load(initial) {
      if (state.busy) return;
      state.busy = true;
      els.next.disabled = true;
      card.setAttribute("aria-busy", "true");
      if (!initial) card.classList.add("is-swapping");

      getWord().then(function (res) {
        if (initial && !res.live) {
          // Keep the sample already on screen; the next click moves to the following sample.
          state.idx = 0;
          setSource(false);
          return;
        }
        return wait(reduceMotion ? 0 : 180).then(function () {
          state.current = res.w;
          render(res.w);
          setSource(res.live);
          if (initial) state.history[0] = { w: res.w, when: "Today" };
          else state.history.unshift({ w: res.w, when: "Today" });
          renderHistory();
        });
      }).finally(function () {
        card.classList.remove("is-swapping");
        card.removeAttribute("aria-busy");
        els.next.disabled = false;
        state.busy = false;
      });
    }

    els.next.addEventListener("click", function () { load(false); });

    if (!("speechSynthesis" in window)) {
      els.speak.hidden = true;
    } else {
      els.speak.addEventListener("click", function () {
        try {
          window.speechSynthesis.cancel();
          var u = new SpeechSynthesisUtterance(state.current.word);
          u.lang = "en-US";
          u.rate = 0.9;
          window.speechSynthesis.speak(u);
        } catch (e) { /* speech not available */ }
      });
    }

    setupTabs($('#wotd .seg'));
    renderHistory();
    load(true);
  })();

  /* =====================================================================
     Demo 2 · url2.at (real shortening via the public API, preview fallback)
     ===================================================================== */
  (function shortener() {
    var SHORTEN_API = "https://url2.at/api/tinyurl";
    var form = $("#short-form");
    if (!form) return;
    var input = $("#short-input");
    var submit = $("#short-submit");
    var errorEl = $("#short-error");
    var result = $("#short-result");
    var linkEl = $("#short-link");
    var noteEl = $("#short-note");
    var copyBtn = $("#short-copy");
    var tbody = $("#links-body");
    var currentShort = "";

    function stripScheme(u) { return u.replace(/^https?:\/\//i, "").replace(/\/$/, ""); }

    function normalize(raw) {
      var v = raw.trim();
      if (!v) return { error: "Paste a link to shorten." };
      if (/\s/.test(v)) return { error: "Links can\u2019t contain spaces. Paste the full URL, like https://example.com/page." };
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = "https://" + v;
      var u;
      try { u = new URL(v); } catch (e) { return { error: "That doesn’t look like a link. Try something like https://example.com/page." }; }
      if (!/^https?:$/.test(u.protocol)) return { error: "Only http and https links can be shortened." };
      if (u.hostname.indexOf(".") === -1) return { error: "Add the full domain, like example.com." };
      return { url: u.href };
    }

    /* Deterministic 5-character code, used only when the API can't be reached. */
    function previewCode(str) {
      var h = 2166136261;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      h = h >>> 0;
      var chars = "abcdefghijkmnpqrstuvwxyz23456789", out = "";
      for (var j = 0; j < 5; j++) { out += chars[h % chars.length]; h = Math.floor(h / chars.length) + (j + 1) * 7919; }
      return out;
    }

    function showError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
      input.setAttribute("aria-invalid", "true");
    }

    function resetButton() {
      submit.disabled = false;
      submit.textContent = "Shorten URL";
    }

    function linkMarkup(shortUrl, live) {
      return live
        ? '<a href="' + escapeHtml(shortUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(stripScheme(shortUrl)) + "</a>"
        : '<span class="mono">' + escapeHtml(stripScheme(shortUrl)) + "</span>";
    }

    function addRow(shortUrl, longUrl, live) {
      var tr = document.createElement("tr");
      tr.className = "is-new";
      tr.innerHTML =
        "<td>" + linkMarkup(shortUrl, live) + (live ? "" : ' <span class="tag">preview</span>') + "</td>" +
        '<td class="dest" title="' + escapeHtml(longUrl) + '">' + escapeHtml(stripScheme(longUrl)) + "</td>" +
        "<td>Just now</td>";
      tbody.insertBefore(tr, tbody.firstChild);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = normalize(input.value);
      if (n.error) { showError(n.error); input.focus(); return; }
      errorEl.hidden = true;
      input.removeAttribute("aria-invalid");
      submit.disabled = true;
      submit.textContent = "Shortening…";

      fetchWithTimeout(SHORTEN_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ longUrl: n.url })
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
        .catch(function () { return { shortUrl: "https://url2.at/" + previewCode(n.url), live: false }; })
        .then(function (res) {
          resetButton();
          if (res.error) { showError(res.error); return; }
          currentShort = res.shortUrl;
          linkEl.innerHTML = linkMarkup(res.shortUrl, res.live);
          noteEl.textContent = res.live
            ? "Live link. Anyone who opens it lands on your page."
            : "Preview only. url2.at couldn’t be reached from here, so this link isn’t live. Shorten it on url2.at to make it real.";
          result.hidden = false;
          addRow(res.shortUrl, n.url, res.live);
        });
    });

    copyBtn.addEventListener("click", function () {
      if (currentShort) copyText(currentShort, copyBtn, linkEl);
    });

    /* Extension view: the popup shortens the tab you're on. */
    var pageUrl = "https://" + $("#ext-page-url").textContent;
    var extLink = $("#ext-link");
    var extUrl = "https://url2.at/" + previewCode(pageUrl);
    extLink.textContent = stripScheme(extUrl);
    $("#ext-copy").addEventListener("click", function () { copyText(extUrl, $("#ext-copy"), extLink); });

    var icon = $("#url-ext-icon");
    var popup = $("#url-popup");
    var hint = $("#url-ext-hint");
    icon.addEventListener("click", function () {
      var open = popup.hidden;
      popup.hidden = !open;
      hint.hidden = open;
      icon.setAttribute("aria-expanded", String(open));
    });

    setupTabs($('#demo-url .seg'));
  })();

  /* =====================================================================
     Demo 3 · Cursor Usage Tracker popup (simulated numbers)
     ===================================================================== */
  (function cursorUsage() {
    var INCLUDED = 50;
    var ON_DEMAND_LIMIT = 20;
    var RESET_IN_DAYS = 11;
    var SPLIT = { auto: 0.42, api: 0.58, claude: 0.55, gpt: 0.30, gemini: 0.15 };

    var range = $("#cu-range");
    if (!range) return;
    var od = $("#cu-ondemand");
    var els = {
      out: $("#cu-range-out"), total: $("#cu-total"), pct: $("#cu-pct"), sub: $("#cu-sub"), meter: $("#cu-meter"), fill: $("#cu-meter-fill"),
      used: $("#cu-used"), resetDays: $("#cu-reset-days"), resetDate: $("#cu-reset-date"),
      auto: $("#cu-auto"), autoBar: $("#cu-auto-bar"), api: $("#cu-api"),
      m1: $("#cu-m1"), m2: $("#cu-m2"), m3: $("#cu-m3"), b1: $("#cu-b1"), b2: $("#cu-b2"), b3: $("#cu-b3"),
      odRow: $("#cu-od"), odVal: $("#cu-od-val"), updated: $("#cu-updated"), refresh: $("#cu-refresh"),
      icon: $("#cu-icon"), popup: $("#cu-popup"), hint: $("#cu-hint")
    };

    els.resetDays.textContent = RESET_IN_DAYS + "d";
    els.resetDate.textContent = "on " + fmtDate(daysFromToday(RESET_IN_DAYS));

    function pctOfIncluded(amount) { return Math.min(100, (amount / INCLUDED) * 100).toFixed(1) + "%"; }

    function compute() {
      var raw = parseFloat(range.value);
      var onDemand = od.checked;
      var used = onDemand ? raw : Math.min(raw, INCLUDED);
      var included = Math.min(used, INCLUDED);
      return {
        raw: raw, onDemand: onDemand, used: used,
        included: included,
        pct: Math.round((included / INCLUDED) * 100),
        over: Math.max(0, used - INCLUDED)
      };
    }

    function render(animatePct) {
      var s = compute();
      els.out.textContent = money(s.used) + (!s.onDemand && s.raw > INCLUDED ? " · limit" : "");

      els.total.classList.toggle("is-warn", s.pct >= 80 && s.pct < 100);
      els.total.classList.toggle("is-crit", s.pct >= 100);
      els.sub.textContent = s.pct >= 100
        ? (s.onDemand ? "Included limit used · on-demand active" : "Included limit reached")
        : "of included limit";
      els.fill.style.width = s.pct + "%";
      els.meter.setAttribute("aria-valuenow", String(s.pct));
      els.used.textContent = money(s.included);

      var auto = s.used * SPLIT.auto;
      var api = s.used * SPLIT.api;
      els.auto.textContent = money(auto);
      els.api.textContent = money(api);
      els.autoBar.style.width = pctOfIncluded(auto);
      els.m1.textContent = money(api * SPLIT.claude);
      els.m2.textContent = money(api * SPLIT.gpt);
      els.m3.textContent = money(api * SPLIT.gemini);
      els.b1.style.width = pctOfIncluded(api * SPLIT.claude);
      els.b2.style.width = pctOfIncluded(api * SPLIT.gpt);
      els.b3.style.width = pctOfIncluded(api * SPLIT.gemini);

      els.odRow.classList.toggle("is-on", s.onDemand);
      els.odVal.textContent = s.onDemand ? money(s.over) + " of " + money(ON_DEMAND_LIMIT) : "Off";

      if (animatePct && !reduceMotion) {
        var start = performance.now(), target = s.pct;
        var step = function (now) {
          var t = Math.min(1, (now - start) / 600);
          els.pct.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      } else {
        els.pct.textContent = String(s.pct);
      }
    }

    range.addEventListener("input", function () { render(false); });
    od.addEventListener("change", function () { render(false); });

    els.refresh.addEventListener("click", function () {
      els.refresh.classList.remove("is-spinning");
      void els.refresh.offsetWidth;
      els.refresh.classList.add("is-spinning");
      els.updated.textContent = "Updating…";
      setTimeout(function () {
        els.updated.textContent = "Updated just now";
        render(true);
      }, reduceMotion ? 0 : 450);
    });

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
     Demo 4 · Leetcode Notes (extension capture → web app review)
     ===================================================================== */
  (function leetcodeNotes() {
    var approachEl = $("#ln-approach");
    if (!approachEl) return;
    var mistakesEl = $("#ln-mistakes");
    var folderEl = $("#ln-folder");
    var reviewEl = $("#ln-review");
    var saveEl = $("#ln-save");
    var queueEl = $("#ln-queue");
    var dueEl = $("#ln-due");
    var cardEl = $("#ln-card");

    var NOTES = {
      "3sum": {
        num: 15, title: "3Sum", diff: "Medium", folder: "Two Pointers", tags: ["array", "two pointers", "sorting"],
        time: "O(n²)", space: "O(1)", approach: "", mistakes: "",
        code: [
          "def threeSum(nums):",
          "    nums.sort()",
          "    res = []",
          "    for i in range(len(nums) - 2):",
          "        if i and nums[i] == nums[i - 1]:",
          "            continue",
          "        l, r = i + 1, len(nums) - 1",
          "        while l < r:",
          "            s = nums[i] + nums[l] + nums[r]",
          "            if s < 0:",
          "                l += 1",
          "            elif s > 0:",
          "                r -= 1",
          "            else:",
          "                res.append([nums[i], nums[l], nums[r]])",
          "                l += 1",
          "                while l < r and nums[l] == nums[l - 1]:",
          "                    l += 1",
          "    return res"
        ].join("\n")
      },
      "coin-change": {
        num: 322, title: "Coin Change", diff: "Medium", folder: "Dynamic Programming", tags: ["dynamic programming", "array"],
        time: "O(amount · coins)", space: "O(amount)",
        approach: "Bottom-up DP. dp[a] is the fewest coins that make amount a. Start with dp[0] = 0, then for every a take min(dp[a - c] + 1) over the coins.",
        mistakes: "Returned dp[amount] without checking for infinity, so unreachable amounts came back as a huge number instead of -1.",
        code: [
          "def coinChange(coins, amount):",
          "    dp = [0] + [float(\"inf\")] * amount",
          "    for a in range(1, amount + 1):",
          "        for c in coins:",
          "            if c <= a:",
          "                dp[a] = min(dp[a], dp[a - c] + 1)",
          "    return dp[amount] if dp[amount] != float(\"inf\") else -1"
        ].join("\n")
      },
      "number-of-islands": {
        num: 200, title: "Number of Islands", diff: "Medium", folder: "Trees & Graphs", tags: ["graph", "dfs", "matrix"],
        time: "O(m·n)", space: "O(m·n)",
        approach: "Every unvisited land cell starts a new island. Count it, then flood it with DFS so the rest of that island is never counted again.",
        mistakes: "Checked bounds after indexing into the grid and hit IndexError on the edges.",
        code: [
          "def numIslands(grid):",
          "    rows, cols = len(grid), len(grid[0])",
          "",
          "    def sink(r, c):",
          "        if r < 0 or c < 0 or r >= rows or c >= cols:",
          "            return",
          "        if grid[r][c] != \"1\":",
          "            return",
          "        grid[r][c] = \"0\"",
          "        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):",
          "            sink(r + dr, c + dc)",
          "",
          "    count = 0",
          "    for r in range(rows):",
          "        for c in range(cols):",
          "            if grid[r][c] == \"1\":",
          "                count += 1",
          "                sink(r, c)",
          "    return count"
        ].join("\n")
      },
      "valid-parentheses": {
        num: 20, title: "Valid Parentheses", diff: "Easy", folder: "Stacks & Queues", tags: ["string", "stack"],
        time: "O(n)", space: "O(n)",
        approach: "Push every opening bracket. On a closing bracket the top of the stack must be its partner, or the string is invalid.",
        mistakes: "Forgot to check that the stack is empty at the end, so \"((\" passed.",
        code: [
          "def isValid(s):",
          "    pairs = {\")\": \"(\", \"]\": \"[\", \"}\": \"{\"}",
          "    stack = []",
          "    for ch in s:",
          "        if ch in pairs:",
          "            if not stack or stack.pop() != pairs[ch]:",
          "                return False",
          "        else:",
          "            stack.append(ch)",
          "    return not stack"
        ].join("\n")
      },
      "trapping-rain-water": {
        num: 42, title: "Trapping Rain Water", diff: "Hard", folder: "Arrays & Strings", tags: ["array", "two pointers"],
        time: "O(n)", space: "O(1)",
        approach: "Two pointers from both ends with leftMax and rightMax. Move the side whose max is smaller: the water above it is bounded by that max.",
        mistakes: "Compared heights instead of the running maxes and undercounted water in the valleys.",
        code: [
          "def trap(height):",
          "    l, r = 0, len(height) - 1",
          "    left_max = right_max = water = 0",
          "    while l < r:",
          "        if height[l] < height[r]:",
          "            left_max = max(left_max, height[l])",
          "            water += left_max - height[l]",
          "            l += 1",
          "        else:",
          "            right_max = max(right_max, height[r])",
          "            water += right_max - height[r]",
          "            r -= 1",
          "    return water"
        ].join("\n")
      }
    };

    var DEFAULT_META = {
      "3sum": "Due today",
      "coin-change": "Shaky last time",
      "number-of-islands": "Forgot last time",
      "valid-parentheses": "Due today",
      "trapping-rain-water": "Due today"
    };
    var RATING_LABEL = { forgot: "Forgot", shaky: "Shaky", got: "Got it" };

    var state = {
      order: ["3sum", "coin-change", "number-of-islands", "valid-parentheses", "trapping-rain-water"],
      pos: 0,
      revealed: false,
      ratings: {},
      meta: Object.assign({}, DEFAULT_META)
    };

    /* --- Step 1: the sidebar saves as you type --- */
    function syncFromSidebar() {
      NOTES["3sum"].approach = approachEl.value.trim() || "No approach written yet.";
      NOTES["3sum"].mistakes = mistakesEl.value.trim() || "No mistakes noted yet.";
      NOTES["3sum"].folder = folderEl.value;
    }
    var saveTimer = null;
    function markSaving() {
      saveEl.innerHTML = '<span class="dot dot--idle" aria-hidden="true"></span>Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        syncFromSidebar();
        saveEl.innerHTML = '<span class="dot dot--ok" aria-hidden="true"></span>Saved';
      }, 650);
    }
    [approachEl, mistakesEl].forEach(function (el) { el.addEventListener("input", markSaving); });
    folderEl.addEventListener("change", markSaving);
    reviewEl.addEventListener("change", function () {
      markSaving();
      state.pos = 0;
      state.revealed = false;
      state.ratings = {};
      renderReview();
    });

    $("#ln-editor-code").innerHTML = highlightPython(NOTES["3sum"].code);

    /* --- Step 2: recall, reveal, rate --- */
    function queue() {
      return state.order.filter(function (id) { return id !== "3sum" || reviewEl.checked; });
    }

    function renderQueue(q) {
      var rated = 0;
      queueEl.innerHTML = q.map(function (id, i) {
        var n = NOTES[id];
        var r = state.ratings[id];
        if (r) rated++;
        var cls = r ? "is-done" : (i === state.pos ? "is-current" : "");
        var meta = r ? RATING_LABEL[r] : (i === state.pos ? "Now" : state.meta[id]);
        return '<li class="' + cls + '"' + (i === state.pos && !r ? ' aria-current="step"' : "") + ">" +
          '<span class="q-dot q-dot--' + n.diff.toLowerCase() + '" aria-hidden="true"></span>' +
          '<span class="q-name">' + escapeHtml(n.title) + "</span>" +
          '<span class="q-meta">' + escapeHtml(meta) + "</span></li>";
      }).join("");
      dueEl.textContent = String(q.length - rated);
    }

    function renderCard(q) {
      if (state.pos >= q.length) {
        var tally = { forgot: 0, shaky: 0, got: 0 };
        Object.keys(state.ratings).forEach(function (k) { tally[state.ratings[k]]++; });
        cardEl.innerHTML =
          '<div class="rcard__done">' +
          '<p class="rcard__title">Review done for today.</p>' +
          '<ul class="tally">' +
          '<li style="background:var(--hard)">Forgot ' + tally.forgot + "</li>" +
          '<li style="background:var(--medium)">Shaky ' + tally.shaky + "</li>" +
          '<li style="background:var(--easy)">Got it ' + tally.got + "</li>" +
          "</ul>" +
          "<p>Forgotten and shaky problems come back first next time, so the weak spots get the most practice.</p>" +
          '<button type="button" class="btn btn--ink" id="ln-again">Review again</button>' +
          "</div>";
        return;
      }
      var id = q[state.pos];
      var n = NOTES[id];
      var head =
        '<div class="rcard__top"><span>Card ' + (state.pos + 1) + " of " + q.length + "</span><span>" + escapeHtml(n.folder) + "</span></div>" +
        '<p class="rcard__title">' + n.num + ". " + escapeHtml(n.title) + ' <span class="diff diff--' + n.diff.toLowerCase() + '">' + n.diff + "</span></p>" +
        '<ul class="chips chips--sm" aria-label="Tags">' + n.tags.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("") + "</ul>";

      if (!state.revealed) {
        cardEl.innerHTML = head +
          '<p class="rcard__prompt">Recall the approach first. Say it out loud, then check it against your notes.</p>' +
          '<button type="button" class="btn btn--ink" id="ln-reveal">Reveal notes</button>';
        return;
      }
      cardEl.innerHTML = head +
        '<div class="rcard__notes" id="ln-notes" tabindex="-1">' +
        "<div><h4>Key insight &amp; approach</h4><p>" + escapeHtml(n.approach) + "</p></div>" +
        "<div><h4>Mistakes made</h4><p>" + escapeHtml(n.mistakes) + "</p></div>" +
        '<div class="cx"><span>Time ' + escapeHtml(n.time) + "</span><span>Space " + escapeHtml(n.space) + "</span></div>" +
        '<pre class="code code--out"><code>' + highlightPython(n.code) + "</code></pre>" +
        "</div>" +
        '<div class="rate" role="group" aria-label="How well did you remember it?">' +
        '<button type="button" class="btn btn--sm btn--forgot" data-rate="forgot">Forgot</button>' +
        '<button type="button" class="btn btn--sm btn--shaky" data-rate="shaky">Shaky</button>' +
        '<button type="button" class="btn btn--sm btn--got" data-rate="got">Got it</button>' +
        "</div>";
    }

    function renderReview(focusSel) {
      var q = queue();
      renderQueue(q);
      renderCard(q);
      if (focusSel) {
        var el = $(focusSel, cardEl);
        if (el) el.focus({ preventScroll: true });
      }
    }

    cardEl.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      var q = queue();
      if (btn.id === "ln-reveal") {
        state.revealed = true;
        renderReview("#ln-notes");
      } else if (btn.hasAttribute("data-rate")) {
        state.ratings[q[state.pos]] = btn.getAttribute("data-rate");
        state.pos++;
        state.revealed = false;
        renderReview(state.pos >= q.length ? "#ln-again" : "#ln-reveal");
      } else if (btn.id === "ln-again") {
        var rank = { forgot: 0, shaky: 1, got: 2 };
        var prev = state.ratings;
        state.order.sort(function (a, b) {
          return (rank[prev[a]] !== undefined ? rank[prev[a]] : 1) - (rank[prev[b]] !== undefined ? rank[prev[b]] : 1);
        });
        state.order.forEach(function (k) {
          state.meta[k] = prev[k] ? RATING_LABEL[prev[k]] + " last time" : DEFAULT_META[k];
        });
        state.ratings = {};
        state.pos = 0;
        state.revealed = false;
        renderReview("#ln-reveal");
      }
    });

    setupTabs($(".steptabs"), function (tab) {
      if (tab.id === "ln-tab-2") { syncFromSidebar(); renderReview(); }
    });

    syncFromSidebar();
    renderReview();
  })();

  /* =====================================================================
     API snippets + footer year
     ===================================================================== */
  $$("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy"));
      if (target) copyText(target.textContent, btn, target);
    });
  });

  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
