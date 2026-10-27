/* 地方 DNA 設計轉譯｜網頁版電子書 — reader behaviour */
(function () {
  'use strict';

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('dna-book:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dna-book:' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var app = $('.app');
  var mqMobile = window.matchMedia('(max-width: 1080px)');
  var BASE = (document.body.getAttribute('data-base') || '');
  var PAGE = document.body.getAttribute('data-page') || '';

  /* ---------- Reading settings ---------- */
  var SIZES = [15, 16, 17, 18, 19, 20, 22, 24];
  function applySettings() {
    var theme = store.get('theme', 'auto');
    if (theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    root.setAttribute('data-font', store.get('font', 'serif'));
    root.style.setProperty('--fs-base', store.get('size', 18) + 'px');
    $$('[data-set-theme]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-theme') === theme)); });
    $$('[data-set-font]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-set-font') === store.get('font', 'serif'))); });
    var out = $('#sizeOut'); if (out) out.textContent = store.get('size', 18) + ' px';
  }
  applySettings();

  var settingsBtn = $('#settingsBtn'), pop = $('#settingsPop');
  function closePop() { if (!pop) return; pop.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); }
  if (settingsBtn && pop) {
    settingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = pop.hidden; pop.hidden = !open; settingsBtn.setAttribute('aria-expanded', String(open));
      if (open) { var f = pop.querySelector('button'); if (f) f.focus(); }
    });
    pop.addEventListener('click', function (e) {
      e.stopPropagation();
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-set-theme')) store.set('theme', b.getAttribute('data-set-theme'));
      if (b.hasAttribute('data-set-font')) store.set('font', b.getAttribute('data-set-font'));
      if (b.hasAttribute('data-size')) {
        var cur = store.get('size', 18), i = SIZES.indexOf(cur); if (i < 0) i = 3;
        i = Math.max(0, Math.min(SIZES.length - 1, i + Number(b.getAttribute('data-size'))));
        store.set('size', SIZES[i]);
      }
      applySettings();
    });
    document.addEventListener('click', closePop);
  }

  /* ---------- Sidebar ---------- */
  var menuBtn = $('#menuBtn'), scrim = $('.scrim'), sidebar = $('.sidebar');
  function isMobile() { return mqMobile.matches; }
  function setSidebar(open) {
    if (isMobile()) {
      app.classList.remove('sidebar-collapsed');
      app.classList.toggle('sidebar-open', open);
      if (open) { var cur = $('.toc-item.is-current > a', sidebar) || $('a', sidebar); setTimeout(function () { cur && cur.focus({ preventScroll: true }); }, 50); }
    } else {
      app.classList.remove('sidebar-open');
      app.classList.toggle('sidebar-collapsed', !open);
      store.set('sidebar', open ? 'open' : 'closed');
    }
    menuBtn && menuBtn.setAttribute('aria-expanded', String(open));
    if (sidebar) sidebar.setAttribute('aria-hidden', String(!open && isMobile()));
  }
  function sidebarOpen() { return isMobile() ? app.classList.contains('sidebar-open') : !app.classList.contains('sidebar-collapsed'); }
  if (!isMobile() && store.get('sidebar', 'open') === 'closed') app.classList.add('sidebar-collapsed');
  if (menuBtn) {
    menuBtn.setAttribute('aria-expanded', String(sidebarOpen()));
    menuBtn.addEventListener('click', function () { setSidebar(!sidebarOpen()); });
  }
  scrim && scrim.addEventListener('click', function () { setSidebar(false); });
  mqMobile.addEventListener && mqMobile.addEventListener('change', function () {
    app.classList.remove('sidebar-open');
    if (!isMobile() && store.get('sidebar', 'open') === 'closed') app.classList.add('sidebar-collapsed'); else app.classList.remove('sidebar-collapsed');
    menuBtn && menuBtn.setAttribute('aria-expanded', String(sidebarOpen()));
  });
  // close drawer after choosing a link on mobile
  sidebar && sidebar.addEventListener('click', function (e) {
    if (e.target.closest('a') && isMobile()) setSidebar(false);
  });

  // collapsible parts
  var collapsed = store.get('collapsedParts', []);
  $$('.toc-part').forEach(function (p) {
    var id = p.getAttribute('data-part'), btn = $('.toc-part-btn', p);
    if (collapsed.indexOf(id) > -1 && !p.querySelector('.is-current')) { p.classList.add('collapsed'); btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function () {
      var c = p.classList.toggle('collapsed'); btn.setAttribute('aria-expanded', String(!c));
      var list = store.get('collapsedParts', []).filter(function (x) { return x !== id; });
      if (c) list.push(id); store.set('collapsedParts', list);
    });
  });

  // read marks
  var readSet = store.get('read', []);
  $$('.toc-item[data-page]').forEach(function (li) { if (readSet.indexOf(li.getAttribute('data-page')) > -1) li.classList.add('is-read'); });

  // keep current item in view
  var curItem = $('.toc-item.is-current');
  var nav = $('.sb-nav');
  if (curItem && nav) {
    var saved = null; try { saved = sessionStorage.getItem('dna-book:sbScroll'); } catch (e) {}
    if (saved !== null) nav.scrollTop = Number(saved);
    var r = curItem.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    if (r.top < nr.top + 40 || r.top > nr.bottom - 120) nav.scrollTop += r.top - nr.top - 80;
    window.addEventListener('pagehide', function () { try { sessionStorage.setItem('dna-book:sbScroll', String(nav.scrollTop)); } catch (e) {} });
  }

  /* ---------- Scroll: progress, scrollspy, back-to-top, last position ---------- */
  var bar = $('.progress span'), toTop = $('.to-top');
  var secLinks = $$('.toc-sec a');
  var heads = secLinks.map(function (a) { var id = decodeURIComponent(a.hash.slice(1)); return document.getElementById(id); });
  var ticking = false, markedRead = readSet.indexOf(PAGE) > -1;
  function onScroll() {
    ticking = false;
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight, y = h.scrollTop || document.body.scrollTop;
    var p = max > 0 ? y / max : 1;
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
    if (toTop) toTop.classList.toggle('show', y > 900);
    // scrollspy
    if (heads.length) {
      var idx = -1, line = Math.min(window.innerHeight * 0.3, 280);
      for (var i = 0; i < heads.length; i++) { if (heads[i] && heads[i].getBoundingClientRect().top <= line) idx = i; }
      secLinks.forEach(function (a, i) {
        var on = i === idx; a.classList.toggle('active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    if (PAGE && PAGE !== 'index') {
      store.set('last', { page: PAGE, title: document.body.getAttribute('data-title') || document.title, p: p });
      if (!markedRead && p > 0.92 && max > 400) {
        markedRead = true; var rs = store.get('read', []); if (rs.indexOf(PAGE) < 0) { rs.push(PAGE); store.set('read', rs); }
        var li = $('.toc-item[data-page="' + PAGE + '"]'); li && li.classList.add('is-read');
      }
    }
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  toTop && toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // restore position when coming back via "繼續閱讀"
  if (/[?&]resume=1/.test(location.search)) {
    var last = store.get('last', null);
    if (last && last.page === PAGE && last.p > 0.01) {
      window.addEventListener('load', function () {
        var h = document.documentElement; window.scrollTo(0, last.p * (h.scrollHeight - h.clientHeight));
      });
    }
  }

  // home: continue reading
  var cont = $('#continueBtn');
  if (cont) {
    var l = store.get('last', null);
    if (l && l.page) { cont.href = BASE + l.page + '.html?resume=1'; $('#continueTitle').textContent = l.title; cont.hidden = false; }
  }

  /* ---------- Lightbox ---------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('img', lb), lbCap = $('p', lb), lastFocus = null;
    document.addEventListener('click', function (e) {
      var img = e.target.closest('.figure img'); if (!img) return;
      lastFocus = img;
      lbImg.src = img.currentSrc || img.src; lbImg.alt = img.alt;
      var cap = img.closest('figure').querySelector('figcaption'); lbCap.textContent = cap ? cap.textContent : '';
      lb.hidden = false; $('.icon-btn', lb).focus();
    });
    lb.addEventListener('click', function () { lb.hidden = true; lastFocus && lastFocus.focus && lastFocus.focus(); });
  }
  $$('.figure img').forEach(function (img) {
    img.setAttribute('tabindex', '0');
    img.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); img.click(); } });
  });

  /* ---------- Wide tables: scroll hint ---------- */
  function markScrollable() {
    $$('.table-wrap').forEach(function (w) { w.classList.toggle('scrollable', w.scrollWidth > w.clientWidth + 4); });
  }
  markScrollable();
  window.addEventListener('resize', function () { clearTimeout(markScrollable.t); markScrollable.t = setTimeout(markScrollable, 150); });

  /* ---------- Copy prompt ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.copy-btn'); if (!b) return;
    var body = b.closest('.prompt-card').querySelector('.pc-body');
    var text = $$('p, li', body).map(function (x) { return x.innerText.trim(); }).join('\n');
    function done() { b.textContent = '已複製'; b.classList.add('done'); setTimeout(function () { b.textContent = '複製'; b.classList.remove('done'); }, 1600); }
    if (navigator.clipboard && window.isSecureContext) { navigator.clipboard.writeText(text).then(done, fallback); } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (err) {} document.body.removeChild(ta);
    }
  });

  /* ---------- Search ---------- */
  var dlg = $('#searchDlg'), input = $('#searchInput'), list = $('#searchResults');
  var indexLoaded = false, indexLoading = false, sel = -1, results = [];
  function loadIndex(cb) {
    if (indexLoaded) return cb();
    if (indexLoading) return;
    indexLoading = true;
    list.innerHTML = '<li class="search-empty">正在載入全文索引…</li>';
    var s = document.createElement('script'); s.src = BASE + 'assets/js/search-index.js';
    s.onload = function () { indexLoaded = true; cb(); };
    s.onerror = function () { list.innerHTML = '<li class="search-empty">索引載入失敗，請重新整理頁面。</li>'; };
    document.head.appendChild(s);
  }
  function openSearch(q) {
    if (!dlg) return;
    dlg.hidden = false; document.body.style.overflow = 'hidden';
    if (typeof q === 'string') input.value = q;
    input.focus(); input.select();
    loadIndex(function () { runSearch(); });
  }
  function closeSearch() { if (!dlg) return; dlg.hidden = true; document.body.style.overflow = ''; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function runSearch() {
    if (!indexLoaded) return;
    var q = input.value.trim();
    sel = -1;
    if (!q) { list.innerHTML = '<li class="search-empty">輸入關鍵字搜尋全書，例如：核心本質句、四方連續、竹山、LGSD</li>'; results = []; return; }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var data = window.BOOK_INDEX || [];
    results = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i], hay = (d.t + ' ' + d.x).toLowerCase(), ok = true, score = 0;
      for (var j = 0; j < terms.length; j++) {
        var at = hay.indexOf(terms[j]); if (at < 0) { ok = false; break; }
        if (d.t.toLowerCase().indexOf(terms[j]) > -1) score += 10;
        score += Math.min(5, hay.split(terms[j]).length - 1);
      }
      if (ok) results.push({ d: d, s: score });
    }
    results.sort(function (a, b) { return b.s - a.s; });
    results = results.slice(0, 60);
    if (!results.length) { list.innerHTML = '<li class="search-empty">找不到「' + esc(q) + '」，試試較短或不同的關鍵字。</li>'; return; }
    var re = new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi');
    list.innerHTML = results.map(function (r, k) {
      var d = r.d, x = d.x, low = x.toLowerCase(), at = low.indexOf(terms[0]);
      var start = Math.max(0, at - 36), snip = (start > 0 ? '…' : '') + x.substr(start, 140) + (x.length > start + 140 ? '…' : '');
      var href = BASE + d.u.replace('#', '?hl=' + encodeURIComponent(terms[0]) + '#');
      if (d.u.indexOf('#') < 0) href = BASE + d.u + '?hl=' + encodeURIComponent(terms[0]);
      return '<li role="option" id="sr' + k + '"><a href="' + href + '"><div class="sr-where">' + esc(d.c) + '</div><div class="sr-title">' +
        esc(d.t).replace(re, '<mark>$1</mark>') + '</div><div class="sr-snip">' + esc(snip).replace(re, '<mark>$1</mark>') + '</div></a></li>';
    }).join('');
  }
  function move(delta) {
    var links = $$('a', list); if (!links.length) return;
    sel = (sel + delta + links.length) % links.length;
    links.forEach(function (a, i) { a.classList.toggle('sel', i === sel); });
    links[sel].scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', 'sr' + sel);
  }
  if (dlg) {
    $$('[data-open-search]').forEach(function (b) { b.addEventListener('click', function () { openSearch(); }); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('[data-close-search]')) closeSearch(); });
    input.addEventListener('input', function () { loadIndex(runSearch); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { var links = $$('a', list); var t = links[sel > -1 ? sel : 0]; if (t) { e.preventDefault(); location.href = t.href; } }
    });
  }

  // highlight search hits on arrival
  var hl = (location.search.match(/[?&]hl=([^&]+)/) || [])[1];
  if (hl) {
    try { hl = decodeURIComponent(hl); } catch (e) {}
    var content = $('.content');
    if (content && hl.length) {
      var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null), nodes = [], n;
      while ((n = walker.nextNode())) { if (n.nodeValue.toLowerCase().indexOf(hl.toLowerCase()) > -1) nodes.push(n); }
      var first = null, target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
      nodes.slice(0, 300).forEach(function (node) {
        var re = new RegExp(escRe(hl), 'gi'), txt = node.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
        while ((m = re.exec(txt))) {
          frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
          var mk = document.createElement('mark'); mk.className = 'hit'; mk.textContent = m[0]; frag.appendChild(mk);
          last = m.index + m[0].length;
        }
        frag.appendChild(document.createTextNode(txt.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
      var marks = $$('mark.hit', content);
      if (target) { for (var i = 0; i < marks.length; i++) { if (target.compareDocumentPosition(marks[i]) & Node.DOCUMENT_POSITION_FOLLOWING) { first = marks[i]; break; } } }
      first = first || marks[0];
      if (first) window.addEventListener('load', function () { first.scrollIntoView({ block: 'center' }); });
    }
  }

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (e.key === 'Escape') {
      if (lb && !lb.hidden) { lb.hidden = true; return; }
      if (dlg && !dlg.hidden) { closeSearch(); return; }
      if (pop && !pop.hidden) { closePop(); settingsBtn.focus(); return; }
      if (isMobile() && sidebarOpen()) { setSidebar(false); menuBtn && menuBtn.focus(); return; }
    }
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); return; }
    if (typing || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === '/') { e.preventDefault(); openSearch(); }
    else if (e.key === 'ArrowLeft') { var p = $('link[rel=prev]'); if (p) location.href = p.href; }
    else if (e.key === 'ArrowRight') { var nx = $('link[rel=next]'); if (nx) location.href = nx.href; }
  });
})();
