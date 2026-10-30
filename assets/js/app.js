(function () {
  "use strict";

  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var total = slides.length;
  var cur = 0;
  var busy = false;

  var deck = document.getElementById("deck");
  var dotsEl = document.getElementById("dots");
  var progress = document.getElementById("progress-fill");
  var curNum = document.getElementById("cur-num");
  var chrono = document.getElementById("chrono-year");
  var notesDrawer = document.getElementById("notes-drawer");
  var ndBody = document.getElementById("nd-body");
  var ndTitle = document.getElementById("nd-title");

  var photoModal = document.getElementById("photo-modal");
  var pmImg = document.getElementById("pm-img");
  var pmTag = document.getElementById("pm-tag");
  var pmTitle = document.getElementById("pm-title");
  var pmKicker = document.getElementById("pm-kicker");
  var pmText = document.getElementById("pm-text");
  var pmFacts = document.getElementById("pm-facts");
  var pmCredit = document.getElementById("pm-credit");

  var creditsModal = document.getElementById("credits-modal");
  var creditsList = document.getElementById("cm-list");
  var overview = document.getElementById("overview");
  var ovGrid = document.getElementById("ov-grid");

  var PHOTOS = window.PHOTOS || {};
  var photoKeys = Object.keys(PHOTOS);
  var currentPhoto = null;

  /* ---------------- NAV ---------------- */
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function slideTitle(s) { return s.getAttribute("data-title") || ""; }

  function firstImage(s) {
    var img = s.querySelector("img");
    return img ? img.getAttribute("src") : "";
  }

  function buildDots() {
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "dot" + (i === 0 ? " is-on" : "");
      b.setAttribute("aria-label", "Trang " + (i + 1) + ": " + slideTitle(s));
      b.setAttribute("data-label", pad(i + 1) + " · " + slideTitle(s));
      b.addEventListener("click", function () { goTo(i); });
      dotsEl.appendChild(b);
    });
  }

  function buildOverview() {
    slides.forEach(function (s, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ov-card";
      b.innerHTML =
        '<span class="ov-thumb"><img src="' + firstImage(s) + '" alt="" loading="lazy"></span>' +
        '<span class="ov-meta"><b>' + pad(i + 1) + "</b><em>" + slideTitle(s) + "</em><i>" +
        (s.getAttribute("data-year") || "") + "</i></span>";
      b.addEventListener("click", function () {
        closeOverview();
        goTo(i);
      });
      ovGrid.appendChild(b);
    });
  }

  function updateChrome() {
    curNum.textContent = pad(cur + 1);
    progress.style.width = ((cur + 1) / total * 100).toFixed(2) + "%";
    var year = slides[cur].getAttribute("data-year") || "";
    chrono.textContent = year;
    Array.prototype.forEach.call(dotsEl.children, function (d, i) {
      d.classList.toggle("is-on", i === cur);
      d.classList.toggle("is-seen", i < cur);
    });
  }

  function goTo(i, silent) {
    i = Math.max(0, Math.min(total - 1, i));
    if (i === cur && !silent) return;
    var prev = slides[cur];
    cur = i;
    prev.classList.remove("is-active");
    slides[i].classList.add("is-active");

    if (window.Stage3D) {
      var stage = slides[i].getAttribute("data-stage");
      window.Stage3D.set(stage || null);
    }
    document.body.setAttribute("data-stage", slides[i].getAttribute("data-stage") || "");
    updateChrome();
    if (!silent) {
      try { history.replaceState(null, "", "#/" + (i + 1)); } catch (e) {}
    }
    updateNotes();
    resetTilt();
  }

  function step(d) { goTo(cur + d); }

  /* ---------------- TILT ---------------- */
  var tiltPlates = [];
  function resetTilt() {
    tiltPlates = Array.prototype.slice.call(
      slides[cur].querySelectorAll(".plate, .portrait")
    );
    tiltPlates.forEach(function (el) {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  }

  var tiltRaf = 0, mx = 0, my = 0;
  function onTiltMove(e) {
    mx = e.clientX / window.innerWidth - 0.5;
    my = e.clientY / window.innerHeight - 0.5;
    if (tiltRaf) return;
    tiltRaf = requestAnimationFrame(function () {
      tiltRaf = 0;
      tiltPlates.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var cx = (r.left + r.width / 2) / window.innerWidth - 0.5;
        var cy = (r.top + r.height / 2) / window.innerHeight - 0.5;
        var rx = (my - cy) * 7;
        var ry = (cx - mx) * 9;
        el.style.setProperty("--rx", rx.toFixed(2) + "deg");
        el.style.setProperty("--ry", ry.toFixed(2) + "deg");
      });
    });
  }

  /* ---------------- PHOTO RECORD ---------------- */
  function openPhoto(key) {
    var rec = PHOTOS[key];
    if (!rec) return;
    currentPhoto = key;
    pmImg.src = rec.src;
    pmImg.alt = rec.title;
    pmTag.textContent = rec.tag || "TƯ LIỆU";
    pmKicker.textContent = "Hồ sơ ảnh · " + pad(rec.slide + 1);
    pmTitle.textContent = rec.title;
    pmText.innerHTML = rec.text.map(function (p) { return "<p>" + p + "</p>"; }).join("");
    pmFacts.innerHTML = (rec.facts || []).map(function (f) {
      return "<span><b>" + f[0] + "</b>" + f[1] + "</span>";
    }).join("");
    pmCredit.textContent = rec.credit || "";
    photoModal.classList.add("is-open");
    photoModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal");
    setTimeout(function () {
      pmImg.style.opacity = "1";
    }, 30);
  }

  function closePhoto() {
    photoModal.classList.remove("is-open");
    photoModal.setAttribute("aria-hidden", "true");
    if (!creditsModal.classList.contains("is-open")) document.body.classList.remove("is-modal");
  }

  function stepPhoto(d) {
    if (!currentPhoto) return;
    var i = photoKeys.indexOf(currentPhoto);
    var n = (i + d + photoKeys.length) % photoKeys.length;
    openPhoto(photoKeys[n]);
  }

  function buildCredits() {
    var html = "";
    photoKeys.forEach(function (k) {
      var r = PHOTOS[k];
      html += '<div class="cm-row"><img src="' + r.src + '" alt="" loading="lazy">' +
        "<div><b>" + r.title + '</b><span>' + r.credit + '</span><i>Trang ' + pad(r.slide + 1) + "</i></div></div>";
    });
    html += '<div class="cm-row cm-row--note"><div><b>Ảnh nền trang cuối</b>' +
      "<span>Andrea Schaffer · CC BY 2.0 · Wikimedia Commons</span><i>Vịnh Hạ Long</i></div></div>";
    creditsList.innerHTML = html;
  }

  var creditsBuilt = false;
  function openCredits() {
    if (!creditsBuilt) { buildCredits(); creditsBuilt = true; }
    creditsModal.classList.add("is-open");
    creditsModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal");
  }
  function closeCredits() {
    creditsModal.classList.remove("is-open");
    creditsModal.setAttribute("aria-hidden", "true");
    if (!photoModal.classList.contains("is-open")) document.body.classList.remove("is-modal");
  }

  /* ---------------- NOTES ---------------- */
  function updateNotes() {
    var n = slides[cur].querySelector(".notes");
    ndTitle.textContent = slideTitle(slides[cur]);
    ndBody.innerHTML = n ? n.innerHTML : "<p>Trang này không có lời bình.</p>";
  }
  function toggleNotes(force) {
    var open = typeof force === "boolean" ? force : !notesDrawer.classList.contains("is-open");
    notesDrawer.classList.toggle("is-open", open);
    notesDrawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) updateNotes();
  }

  /* ---------------- OVERVIEW ---------------- */
  var overviewBuilt = false;
  function openOverview() {
    if (!overviewBuilt) { buildOverview(); overviewBuilt = true; }
    overview.classList.add("is-open");
    overview.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal");
  }
  function closeOverview() {
    overview.classList.remove("is-open");
    overview.setAttribute("aria-hidden", "true");
    if (!photoModal.classList.contains("is-open")) document.body.classList.remove("is-modal");
  }

  /* ---------------- INPUT ---------------- */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-goto]");
    if (t) { goTo(parseInt(t.getAttribute("data-goto"), 10)); return; }

    var p = e.target.closest("[data-photo]");
    if (p) { openPhoto(p.getAttribute("data-photo")); return; }

    if (e.target.closest("[data-overview]")) { openOverview(); return; }
    if (e.target.closest("[data-close-overview]")) { closeOverview(); return; }
    if (e.target.closest("[data-credits]")) { openCredits(); return; }
    if (e.target.closest("[data-close-credits]") || e.target.classList.contains("modal-bg")) {
      if (e.target.closest("#credits-modal")) closeCredits();
    }
    if (e.target.closest("[data-close-photo]") || e.target.classList.contains("modal-bg")) {
      if (e.target.closest("#photo-modal")) closePhoto();
    }
  });

  document.getElementById("pm-close").addEventListener("click", closePhoto);
  document.getElementById("pm-prev").addEventListener("click", function () { stepPhoto(-1); });
  document.getElementById("pm-next").addEventListener("click", function () { stepPhoto(1); });
  document.getElementById("pm-goto").addEventListener("click", function () {
    if (!currentPhoto) return;
    var s = PHOTOS[currentPhoto].slide;
    closePhoto();
    goTo(s);
  });

  document.querySelectorAll(".ov-close").forEach(function (b) {
    b.addEventListener("click", closeOverview);
  });
  Array.prototype.forEach.call(document.querySelectorAll(".m-close"), function (b) {
    if (b.closest("#photo-modal")) b.addEventListener("click", closePhoto);
    if (b.closest("#credits-modal")) b.addEventListener("click", closeCredits);
  });

  document.getElementById("nd-close").addEventListener("click", function () { toggleNotes(false); });

  window.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.key === "Escape") {
      if (photoModal.classList.contains("is-open")) return closePhoto();
      if (creditsModal.classList.contains("is-open")) return closeCredits();
      if (overview.classList.contains("is-open")) return closeOverview();
      if (notesDrawer.classList.contains("is-open")) return toggleNotes(false);
      return;
    }
    if (photoModal.classList.contains("is-open")) {
      if (e.key === "ArrowRight") { e.preventDefault(); stepPhoto(1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stepPhoto(-1); }
      return;
    }
    if (creditsModal.classList.contains("is-open") || overview.classList.contains("is-open")) return;

    switch (e.key) {
      case "ArrowRight": case "PageDown": case " ":
        e.preventDefault(); step(1); break;
      case "ArrowLeft": case "PageUp":
        e.preventDefault(); step(-1); break;
      case "Home": e.preventDefault(); goTo(0); break;
      case "End": e.preventDefault(); goTo(total - 1); break;
      case "o": case "O": openOverview(); break;
      case "n": case "N": toggleNotes(); break;
      case "c": case "C": openCredits(); break;
    }
  });

  /* swipe */
  var tsx = 0, tsy = 0, tracking = false;
  deck.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) return;
    tsx = e.touches[0].clientX;
    tsy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  deck.addEventListener("touchend", function (e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - tsx;
    var dy = t.clientY - tsy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      step(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  /* wheel */
  var wheelLock = 0;
  deck.addEventListener("wheel", function (e) {
    if (document.body.classList.contains("is-modal")) return;
    var now = Date.now();
    if (now < wheelLock) return;
    var active = slides[cur];
    var scrollable = active.scrollHeight > active.clientHeight + 4;
    if (scrollable && e.target.closest(".slide")) {
      var el = active;
      if (el.scrollTop > 0 || (el.scrollTop + el.clientHeight) < el.scrollHeight - 2) return;
    }
    if (Math.abs(e.deltaY) < 18) return;
    wheelLock = now + 780;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/#\/(\d+)/);
    if (m) {
      var n = parseInt(m[1], 10) - 1;
      if (n !== cur && n >= 0 && n < total) goTo(n, true);
    }
  });

  window.addEventListener("pointermove", onTiltMove, { passive: true });

  /* ---------------- HOA SEN & ĐỊA CẦU CSS 3D ---------------- */
  function buildLotus() {
    var host = document.getElementById("lotus-3d");
    if (!host) return;
    var rings = [
      { n: 9, tilt: 68, z: -10, off: 0, inner: false, op: 0.5, sc: 1 },
      { n: 8, tilt: 50, z: 8, off: 12, inner: false, op: 0.72, sc: 0.84 },
      { n: 6, tilt: 32, z: 22, off: 9, inner: true, op: 0.92, sc: 0.66 }
    ];
    var frag = document.createDocumentFragment();
    rings.forEach(function (ring) {
      for (var i = 0; i < ring.n; i++) {
        var p = document.createElement("span");
        p.className = "petal" + (ring.inner ? " p-in" : "");
        p.style.setProperty("--a", (i * 360 / ring.n + ring.off) + "deg");
        p.style.setProperty("--t", ring.tilt + "deg");
        p.style.setProperty("--z", ring.z + "px");
        p.style.setProperty("--s", ring.sc);
        p.style.setProperty("--o", ring.op);
        frag.appendChild(p);
      }
    });
    host.appendChild(frag);
  }

  function buildCssGlobe() {
    var rot = document.getElementById("cg-rot");
    if (!rot) return;
    for (var i = 0; i < 8; i++) {
      var m = document.createElement("span");
      m.className = "cg-mer";
      m.style.transform = "rotateY(" + (i * 22.5) + "deg)";
      rot.appendChild(m);
    }
    [-60, -40, -20, 0, 20, 40, 60].forEach(function (lat) {
      var c = Math.cos(lat * Math.PI / 180);
      var s = Math.sin(lat * Math.PI / 180);
      var l = document.createElement("span");
      l.className = "cg-lat";
      l.style.width = (c * 100) + "%";
      l.style.height = (c * 100) + "%";
      l.style.top = (50 - s * 50) + "%";
      l.style.transform = "translate(-50%,-50%) rotateX(90deg)";
      rot.appendChild(l);
    });
  }

  /* ---------------- BOOT ---------------- */
  buildLotus();
  buildCssGlobe();
  buildDots();

  var initial = 0;
  var hm = location.hash.match(/#\/(\d+)/);
  if (hm) initial = Math.max(0, Math.min(total - 1, parseInt(hm[1], 10) - 1));
  if (initial !== 0) {
    slides[0].classList.remove("is-active");
    cur = initial;
    slides[cur].classList.add("is-active");
  }
  if (window.Stage3D) window.Stage3D.set(slides[cur].getAttribute("data-stage") || null);
  document.body.setAttribute("data-stage", slides[cur].getAttribute("data-stage") || "");
  updateChrome();
  updateNotes();
  resetTilt();

  document.body.classList.add("is-ready");
})();

/* ---------- BỤI VÀNG (canvas 2D) ---------- */
(function () {
  var c = document.getElementById("dust");
  if (!c) return;
  var ctx = c.getContext("2d");
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = 0, h = 0, parts = [];
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function resize() {
    w = window.innerWidth; h = window.innerHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var n = Math.round(Math.min(70, w / 22));
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.4,
        vy: -(Math.random() * 0.16 + 0.04),
        vx: (Math.random() - 0.5) * 0.1,
        a: Math.random() * 0.45 + 0.1,
        p: Math.random() * Math.PI * 2
      });
    }
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx + Math.sin(t * 0.0004 + p.p) * 0.08;
      p.y += p.vy;
      if (p.y < -8) { p.y = h + 8; p.x = Math.random() * w; }
      if (p.x < -8) p.x = w + 8;
      if (p.x > w + 8) p.x = -8;
      ctx.beginPath();
      ctx.fillStyle = "rgba(240,206,140," + p.a + ")";
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  if (!reduced) requestAnimationFrame(frame);
})();
