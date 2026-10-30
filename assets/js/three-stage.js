/* Hoạt họa 3D — sen, địa cầu hành trình, ngôi sao */
(function () {
  "use strict";

  var canvas = document.getElementById("gl-stage");
  var root = document.documentElement;
  if (!canvas || !window.THREE) { root.classList.add("no-gl"); return; }

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, alpha: true, antialias: true, powerPreference: "high-performance"
    });
  } catch (err) {
    root.classList.add("no-gl");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x000000, 0);
  if (THREE.ColorManagement) { renderer.outputColorSpace = THREE.SRGBColorSpace; }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  var clock = new THREE.Clock();
  var stages = {};
  var active = null;
  var activeName = null;
  var pointer = { x: 0, y: 0, tx: 0, ty: 0, down: false, lx: 0, ly: 0 };

  var GOLD = 0xd9a94e;
  var GOLD_LIGHT = 0xf7dfa8;
  var RED = 0xb5382b;

  function glowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 128;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,236,190,1)");
    grd.addColorStop(0.35, "rgba(226,180,95,.55)");
    grd.addColorStop(1, "rgba(226,180,95,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    var t = new THREE.CanvasTexture(c);
    if (THREE.SRGBColorSpace && t.colorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  var GLOW = glowTexture();

  function baseScene() {
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 6.2);
    scene.add(new THREE.AmbientLight(0x6a4a2a, 1.1));

    var key = new THREE.DirectionalLight(0xffe6bd, 2.1);
    key.position.set(3.4, 4.2, 4.5);
    scene.add(key);

    var rim = new THREE.PointLight(GOLD, 26, 22, 2);
    rim.position.set(-3.2, -1.4, 3.2);
    scene.add(rim);

    var red = new THREE.PointLight(RED, 14, 16, 2);
    red.position.set(2.6, -2.6, -1.8);
    scene.add(red);

    return { scene: scene, camera: camera };
  }

  function dust(scene, count, radius, color, size) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var r = radius * (0.35 + Math.random() * 0.65);
      var th = Math.random() * Math.PI * 2;
      var ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.7;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var mat = new THREE.PointsMaterial({
      color: color, size: size, transparent: true, opacity: 0.55,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    var pts = new THREE.Points(geo, mat);
    scene.add(pts);
    return pts;
  }

  /* ---------------- LOTUS ---------------- */
  function buildLotus() {
    var base = baseScene();
    var scene = base.scene, camera = base.camera;
    var group = new THREE.Group();
    scene.add(group);

    var petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0);
    petalShape.bezierCurveTo(0.26, 0.14, 0.4, 0.58, 0.03, 1.02);
    petalShape.bezierCurveTo(0.015, 1.045, -0.015, 1.045, -0.03, 1.02);
    petalShape.bezierCurveTo(-0.4, 0.58, -0.26, 0.14, 0, 0);

    var petalGeo = new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.018, bevelEnabled: true, bevelThickness: 0.012,
      bevelSize: 0.012, bevelSegments: 3, curveSegments: 18
    });
    petalGeo.center();

    var petalMat = new THREE.MeshStandardMaterial({
      color: 0xf3d8bd, emissive: 0x4a2410, emissiveIntensity: 0.55,
      metalness: 0.18, roughness: 0.52, side: THREE.DoubleSide,
      transparent: true, opacity: 0.94
    });
    var innerMat = petalMat.clone();
    innerMat.color.set(0xffe8d2);
    innerMat.emissive.set(0x6b3415);

    var rings = [
      { n: 14, tilt: 0.34, scale: 1.42, y: 0.02, mat: petalMat, off: 0 },
      { n: 11, tilt: 0.72, scale: 1.2, y: 0.06, mat: petalMat, off: 0.28 },
      { n: 8, tilt: 1.06, scale: 0.96, y: 0.1, mat: innerMat, off: 0.55 },
      { n: 6, tilt: 1.4, scale: 0.7, y: 0.14, mat: innerMat, off: 0.9 }
    ];

    var petals = [];
    rings.forEach(function (ring) {
      for (var i = 0; i < ring.n; i++) {
        var a = (i / ring.n) * Math.PI * 2 + ring.off;
        var m = new THREE.Mesh(petalGeo, ring.mat);
        m.scale.setScalar(ring.scale);
        m.position.y = ring.y;
        var pivot = new THREE.Group();
        pivot.rotation.y = a;
        m.rotation.x = -ring.tilt;
        m.position.z = 0.18 * ring.scale;
        pivot.add(m);
        group.add(pivot);
        petals.push({ pivot: pivot, mesh: m, phase: Math.random() * Math.PI * 2, base: ring.tilt });
      }
    });

    var podMat = new THREE.MeshStandardMaterial({
      color: GOLD, metalness: 0.85, roughness: 0.28,
      emissive: 0x3a2106, emissiveIntensity: 0.5
    });
    var pod = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 24), podMat);
    pod.scale.y = 0.72;
    pod.position.y = 0.34;
    group.add(pod);

    for (var d = 0; d < 14; d++) {
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), podMat);
      var ang = (d / 14) * Math.PI * 2;
      var rr = 0.155;
      dot.position.set(Math.cos(ang) * rr, 0.47, Math.sin(ang) * rr);
      group.add(dot);
    }

    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color: 0xffcf86, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(3.6);
    halo.position.set(0, 0.35, -0.8);
    group.add(halo);

    var embers = dust(scene, 320, 5.2, 0xf6d79c, 0.045);
    group.rotation.x = 0.22;

    function layout() {
      var wide = window.innerWidth / window.innerHeight > 1.05;
      group.position.set(wide ? 1.62 : 0, wide ? 0.02 : 1.15, 0);
      group.scale.setScalar(wide ? 1.28 : 0.95);
    }
    layout();

    return {
      scene: scene, camera: camera, layout: layout,
      update: function (t) {
        group.rotation.y = t * 0.22 + pointer.x * 0.5;
        group.rotation.x = 0.18 + Math.sin(t * 0.4) * 0.05 + pointer.y * 0.25;
        for (var i = 0; i < petals.length; i++) {
          var p = petals[i];
          p.mesh.rotation.x = -(p.base + Math.sin(t * 0.8 + p.phase) * 0.055);
        }
        pod.scale.y = 0.72 + Math.sin(t * 0.9) * 0.03;
        halo.material.opacity = 0.42 + Math.sin(t * 0.7) * 0.09;
        embers.rotation.y = -t * 0.04;
        embers.position.y = Math.sin(t * 0.3) * 0.15;
      }
    };
  }

  /* ---------------- GLOBE ---------------- */
  function buildGlobe() {
    var base = baseScene();
    var scene = base.scene, camera = base.camera;
    camera.position.set(0, 0, 7.4);

    var world = new THREE.Group();
    scene.add(world);

    var R = 1.55;
    var dotGeo = new THREE.BufferGeometry();
    var N = 2600, arr = new Float32Array(N * 3);
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = 1 - (i / (N - 1)) * 2;
      var rad = Math.sqrt(Math.max(0, 1 - y * y));
      var th = golden * i;
      arr[i * 3] = Math.cos(th) * rad * R;
      arr[i * 3 + 1] = y * R;
      arr[i * 3 + 2] = Math.sin(th) * rad * R;
    }
    dotGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    var dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({
      color: 0xd9b06a, size: 0.018, transparent: true, opacity: 0.72,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    world.add(dots);

    var globe = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.985, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0x100a07, transparent: true, opacity: 0.9 })
    );
    world.add(globe);

    var lineMat = new THREE.LineBasicMaterial({ color: 0xd9a94e, transparent: true, opacity: 0.16 });
    for (var la = -60; la <= 60; la += 30) {
      var pts = [];
      for (var lo = 0; lo <= 360; lo += 5) {
        var phi = (90 - la) * Math.PI / 180, theta = lo * Math.PI / 180;
        pts.push(new THREE.Vector3(
          -R * Math.sin(phi) * Math.cos(theta),
          R * Math.cos(phi),
          R * Math.sin(phi) * Math.sin(theta)
        ));
      }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (var lon = 0; lon < 360; lon += 30) {
      var pts2 = [];
      for (var lat = -90; lat <= 90; lat += 5) {
        var ph = (90 - lat) * Math.PI / 180, th2 = lon * Math.PI / 180;
        pts2.push(new THREE.Vector3(
          -R * Math.sin(ph) * Math.cos(th2),
          R * Math.cos(ph),
          R * Math.sin(ph) * Math.sin(th2)
        ));
      }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), lineMat));
    }

    function vec(lon, lat, r) {
      var phi = (90 - lat) * Math.PI / 180;
      var theta = lon * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    }

    var cities = [
      ["Sài Gòn", 106.7, 10.8], ["Marseille", 5.4, 43.3], ["Le Havre", 0.1, 49.5],
      ["London", -0.1, 51.5], ["New York", -74.0, 40.7], ["Boston", -71.1, 42.4],
      ["Paris", 2.35, 48.85], ["Moscow", 37.6, 55.75], ["Quảng Châu", 113.3, 23.1],
      ["Hồng Kông", 114.2, 22.3], ["Pác Bó", 106.0, 22.9]
    ];
    var order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    var routePts = [];
    for (var k = 0; k < order.length; k++) {
      var c = cities[order[k]];
      var p = vec(c[1], c[2], R * 1.012);
      routePts.push({ pos: p, name: c[0] });

      var marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.026, 12, 10),
        new THREE.MeshBasicMaterial({ color: 0xffe1a8 })
      );
      marker.position.copy(p);
      world.add(marker);

      var spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW, color: 0xffcf86, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      spr.position.copy(p);
      spr.scale.setScalar(0.22);
      world.add(spr);
    }

    var arcs = [];
    for (var a = 0; a < routePts.length - 1; a++) {
      var start = routePts[a].pos.clone();
      var end = routePts[a + 1].pos.clone();
      var mid = start.clone().add(end).multiplyScalar(0.5);
      var dist = start.distanceTo(end);
      mid.normalize().multiplyScalar(R + Math.min(0.9, dist * 0.42));
      var curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      var tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 64, 0.0085, 8, false),
        new THREE.MeshBasicMaterial({ color: 0xe9b96a, transparent: true, opacity: 0.55 })
      );
      world.add(tube);
      var spark = new THREE.Sprite(new THREE.SpriteMaterial({
        map: GLOW, color: 0xfff0c8, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      spark.scale.setScalar(0.1);
      world.add(spark);
      arcs.push({ curve: curve, spark: spark, offset: a * 0.17 });
    }

    var halo2 = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color: 0xd08a3a, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo2.scale.setScalar(5.2);
    scene.add(halo2);

    var embers = dust(scene, 260, 6.4, 0xe8c890, 0.04);
    var spin = 0;

    function layout() {
      var wide = window.innerWidth / window.innerHeight > 1.05;
      world.position.set(wide ? 1.72 : 0, wide ? -0.18 : 0.95, 0);
      world.scale.setScalar(wide ? 1.0 : 0.72);
      halo2.position.copy(world.position);
    }
    layout();

    return {
      scene: scene, camera: camera, layout: layout,
      drag: function (dx, dy) { spin += dx * 0.006; world.rotation.x += dy * 0.002; },
      update: function (t) {
        spin += reduced ? 0.0006 : 0.0022;
        world.rotation.y = spin;
        world.rotation.x = world.rotation.x * 0.98 + Math.sin(t * 0.18) * 0.02;
        for (var i = 0; i < arcs.length; i++) {
          var ar = arcs[i];
          var u = ((t * 0.12 + ar.offset) % 1);
          ar.spark.position.copy(ar.curve.getPoint(u));
          ar.spark.material.opacity = 0.35 + 0.6 * Math.sin(u * Math.PI);
        }
        dots.rotation.y = Math.sin(t * 0.1) * 0.04;
        embers.rotation.y = t * 0.03;
      }
    };
  }

  /* ---------------- STAR ---------------- */
  function buildStar() {
    var base = baseScene();
    var scene = base.scene, camera = base.camera;
    var group = new THREE.Group();
    scene.add(group);

    var shape = new THREE.Shape();
    var spikes = 5, outer = 1.0, inner = 0.42;
    for (var i = 0; i < spikes * 2; i++) {
      var r = i % 2 === 0 ? outer : inner;
      var ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
      var x = Math.cos(ang) * r, y = Math.sin(ang) * r;
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();

    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.14, bevelEnabled: true, bevelThickness: 0.05,
      bevelSize: 0.05, bevelSegments: 4
    });
    geo.center();

    var star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xe8b352, metalness: 0.92, roughness: 0.24,
      emissive: 0x542c07, emissiveIntensity: 0.55
    }));
    group.add(star);

    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.006, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0xd9a94e, transparent: true, opacity: 0.28 })
    );
    ring.rotation.x = Math.PI / 2.2;
    group.add(ring);

    var ring2 = ring.clone();
    ring2.scale.setScalar(1.28);
    ring2.material = ring.material.clone();
    ring2.material.opacity = 0.12;
    group.add(ring2);

    var halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color: 0xffcf86, transparent: true, opacity: 0.35,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(4);
    halo.position.z = -0.6;
    group.add(halo);

    var embers = dust(scene, 240, 5.4, 0xf2d097, 0.045);

    function layout() {
      var wide = window.innerWidth / window.innerHeight > 1.05;
      group.position.set(wide ? 2.0 : 0, wide ? 0.55 : -1.55, wide ? -1.2 : -2.2);
      group.scale.setScalar(wide ? 0.62 : 0.5);
      group.rotation.z = -0.12;
    }
    layout();

    return {
      scene: scene, camera: camera, layout: layout,
      update: function (t) {
        star.rotation.y = t * 0.35 + pointer.x * 0.4;
        star.rotation.x = Math.sin(t * 0.5) * 0.18 + pointer.y * 0.2;
        ring.rotation.z = t * 0.15;
        ring2.rotation.z = -t * 0.1;
        halo.material.opacity = 0.3 + Math.sin(t * 0.8) * 0.08;
        embers.rotation.y = -t * 0.03;
      }
    };
  }

  function ensure(name) {
    if (stages[name]) return stages[name];
    if (name === "lotus") stages[name] = buildLotus();
    else if (name === "globe") stages[name] = buildGlobe();
    else if (name === "star") stages[name] = buildStar();
    return stages[name];
  }

  function setStage(name) {
    if (name === activeName) return;
    if (root.classList.contains("no-gl")) { activeName = name; active = null; return; }
    activeName = name;
    try {
      active = name ? ensure(name) : null;
    } catch (err) {
      active = null;
      root.classList.add("no-gl");
    }
    if (active && active.layout) active.layout();
    document.body.classList.toggle("has-gl", !!active && !root.classList.contains("no-gl"));
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    Object.keys(stages).forEach(function (k) {
      var st = stages[k];
      st.camera.aspect = w / h;
      st.camera.updateProjectionMatrix();
      if (st.layout) st.layout();
    });
  }

  var pointerBound = false;
  function bindPointer() {
    if (pointerBound) return;
    pointerBound = true;
    window.addEventListener("pointermove", function (e) {
      pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (pointer.down && activeName === "globe" && active && active.drag) {
        active.drag(e.clientX - pointer.lx, e.clientY - pointer.ly);
      }
      pointer.lx = e.clientX;
      pointer.ly = e.clientY;
    }, { passive: true });
    window.addEventListener("pointerdown", function (e) {
      pointer.down = true; pointer.lx = e.clientX; pointer.ly = e.clientY;
    }, { passive: true });
    window.addEventListener("pointerup", function () { pointer.down = false; }, { passive: true });
    window.addEventListener("pointercancel", function () { pointer.down = false; }, { passive: true });
  }
  bindPointer();

  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!active || document.hidden || root.classList.contains("no-gl")) return;
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    if (reduced && now - last < 120) return;
    last = now;
    var t = clock.getElapsedTime();
    active.update(t);
    renderer.render(active.scene, active.camera);
  }

  window.addEventListener("resize", resize);
  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    root.classList.add("no-gl");
    document.body.classList.remove("has-gl");
  });

  window.Stage3D = {
    set: setStage,
    resize: resize,
    isActive: function () { return !!active; }
  };

  resize();
  requestAnimationFrame(frame);
})();
