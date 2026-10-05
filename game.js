(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $('game');
  var ctx = canvas.getContext('2d');
  var keys = {};
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var COLORS = ['#1e88e5', '#8e24aa', '#fb8c00', '#00897b', '#6d4c41', '#fdd835'];
  var g = null, raf = 0, lastT = 0, lastMode = 'drive';

  // ---------- helpers ----------
  function rr(x, y, w, h, r, fill) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function circle(x, y, r, fill) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  }
  function person(x, y, shirt) {
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(x, y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    rr(x - 7, y - 8, 14, 16, 4, shirt);
    circle(x, y - 14, 6, '#ffcc80');
  }
  var up = function () { return keys.arrowup || keys.w; };
  var down = function () { return keys.arrowdown || keys.s; };
  var left = function () { return keys.arrowleft || keys.a; };
  var right = function () { return keys.arrowright || keys.d; };

  function add(n, msg) {
    g.score += n;
    if (n < 0 && g.round) g.round.clean = false;
    var d = document.createElement('div');
    d.className = n > 0 ? 'good' : n < 0 ? 'bad' : 'info';
    d.textContent = (n > 0 ? '+' : '') + (n !== 0 ? n + ' ' : '') + msg;
    var log = $('log');
    log.insertBefore(d, log.firstChild);
    while (log.children.length > 5) log.removeChild(log.lastChild);
    if (n !== 0) g.flash = { t: 0.45, c: n < 0 ? 'rgba(220,0,0,.25)' : 'rgba(0,200,80,.2)' };
  }

  function doAction() {
    if (!g || g.over) return;
    if (g.type === 'drive') {
      if (g.belt) return;
      g.belt = true;
      if (g.speed < 1 && !g.beltPen) add(5, 'Seat belt fastened');
      else add(0, 'Seat belt fastened');
    } else {
      g.look = 1.2;
      g.round.looked = true;
      add(0, 'You looked left and right');
    }
  }

  // ---------- input ----------
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].indexOf(k) >= 0) e.preventDefault();
    if (!e.repeat && (k === 'l' || k === 'b')) doAction();
    keys[k] = true;
  });
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });

  document.querySelectorAll('#controls button[data-key]').forEach(function (b) {
    var k = b.getAttribute('data-key');
    var on = function (e) { e.preventDefault(); keys[k] = true; };
    var off = function (e) { e.preventDefault(); keys[k] = false; };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });
  $('actBtn').addEventListener('click', doAction);

  // ======================================================
  //  DRIVING MODE
  // ======================================================
  var DLX = [150, 330];

  function newDrive() {
    var d = {
      type: 'drive', score: 50, t: 0, dist: 0, speed: 0, x: DLX[0], lane: 0,
      belt: false, beltPen: false, over: false, length: 6000, osCd: 0, hitCd: 0,
      flash: null, round: null, prevL: false, prevR: false, braking: false
    };
    d.lights = [[800, 9], [2400, 1], [4000, 6]].map(function (a) {
      return { p: a[0], off: a[1], passed: false, stopped: false };
    });
    d.crossings = [1500, 3200, 4800].map(function (p) {
      return { p: p, state: 'idle', prog: 0, passed: false, rew: false };
    });
    d.zones = [{ a: 2000, b: 2800, limit: 30 }, { a: 4300, b: 5000, limit: 30 }];
    d.cars = [[1, 1100], [0, 2000], [1, 3600], [0, 5300]].map(function (a, i) {
      return { lane: a[0], y: a[1], sp: 100, color: COLORS[i % COLORS.length] };
    });

    d.phase = function (l) {
      var x = (d.t + l.off) % 12;
      return x < 5 ? 'green' : x < 7 ? 'yellow' : 'red';
    };
    d.limit = function () {
      for (var i = 0; i < d.zones.length; i++) {
        var z = d.zones[i];
        if (d.dist >= z.a && d.dist <= z.b) return z.limit;
      }
      return 60;
    };

    d.update = function (dt) {
      d.t += dt;
      if (d.flash) d.flash.t -= dt;

      var gas = up(), brake = down() || keys[' '];
      d.braking = !!brake;
      if (gas) d.speed += 260 * dt;
      else if (brake) d.speed -= 650 * dt;
      else d.speed -= 70 * dt;
      d.speed = clamp(d.speed, 0, 400);

      if (d.speed > 1 && !d.belt && !d.beltPen) {
        d.beltPen = true;
        add(-5, 'Fasten your seat belt before driving');
      }

      var L = !!left(), R = !!right();
      if (L && !d.prevL) d.lane = 0;
      if (R && !d.prevR) d.lane = 1;
      d.prevL = L; d.prevR = R;
      d.x += (DLX[d.lane] - d.x) * Math.min(1, 8 * dt);
      d.dist += d.speed * dt;

      // speed limit
      var kmh = d.speed * 0.2, lim = d.limit();
      d.osCd -= dt;
      if (kmh > lim + 2 && d.osCd <= 0) {
        add(-3, 'Over the speed limit (' + lim + ' km/h)');
        d.osCd = 2;
      }

      // traffic lights
      d.lights.forEach(function (l) {
        if (l.passed) return;
        var ph = d.phase(l), gap = l.p - d.dist;
        if (ph === 'red' && !l.stopped && d.speed < 5 && gap < 150 && gap > 0) {
          l.stopped = true; add(5, 'Stopped at the red light');
        }
        if (d.dist >= l.p) {
          l.passed = true;
          if (ph === 'red') add(-15, 'You ran a red light!');
          else if (ph === 'yellow') add(0, 'Crossed on yellow. Slow down and stop next time');
          else add(10, 'Passed the green light safely');
        }
      });

      // zebra crossings
      d.crossings.forEach(function (c) {
        var gap = c.p - d.dist;
        if (c.state === 'idle' && gap < 520) c.state = 'crossing';
        if (c.state === 'crossing') {
          c.prog += dt / 5;
          if (c.prog >= 1) { c.prog = 1; c.state = 'done'; }
        }
        if (c.passed) return;
        if (c.state === 'crossing' && !c.rew && d.speed < 5 && gap < 170 && gap > 0) {
          c.rew = true; add(5, 'Stopped for the pedestrian');
        }
        if (d.dist >= c.p) {
          c.passed = true;
          if (c.state === 'crossing') {
            var px = 30 + c.prog * 420;
            if (Math.abs(px - d.x) < 45 && c.prog > 0.05 && c.prog < 0.95) {
              add(-30, 'You hit a pedestrian!'); d.speed = 0;
            } else add(-20, 'You must give way at a zebra crossing');
          } else add(10, 'Gave way at the zebra crossing');
        }
      });

      // other cars
      d.hitCd -= dt;
      d.cars.forEach(function (c) {
        c.y += c.sp * dt;
        if (d.hitCd <= 0 && Math.abs(c.y - d.dist) < 75 && Math.abs(DLX[c.lane] - d.x) < 48) {
          add(-20, 'Collision! Keep a safe distance or change lanes to overtake');
          d.speed = 0; d.dist = c.y - 95; d.hitCd = 1.2;
        }
      });

      if (d.score <= 0) { finish(false, 'You ran out of safety points.'); return; }
      if (d.dist >= d.length) { add(20, 'Route completed!'); finish(true); }
    };

    function lamp(x, y, ph) {
      rr(x - 13, y - 70, 26, 66, 6, '#212121');
      circle(x, y - 58, 8, ph === 'red' ? '#f44336' : '#4a1a1a');
      circle(x, y - 37, 8, ph === 'yellow' ? '#ffeb3b' : '#4a4a1a');
      circle(x, y - 16, 8, ph === 'green' ? '#4caf50' : '#1a4a1a');
    }
    function drawCar(x, y, color, player, braking) {
      rr(x - 24, y - 40, 48, 80, 8, color);
      rr(x - 17, y - 24, 34, 18, 4, '#b3e5fc');
      rr(x - 17, y + 8, 34, 12, 4, '#81d4fa');
      ctx.fillStyle = '#fff59d';
      ctx.fillRect(x - 20, y - 40, 8, 5); ctx.fillRect(x + 12, y - 40, 8, 5);
      ctx.fillStyle = player && braking ? '#ff1744' : '#b71c1c';
      ctx.fillRect(x - 20, y + 35, 8, 5); ctx.fillRect(x + 12, y + 35, 8, 5);
    }
    function sign(x, y, txt) {
      circle(x, y, 17, '#fff'); ctx.lineWidth = 4; ctx.strokeStyle = '#d32f2f';
      ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#000'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(txt, x, y + 5);
    }

    d.draw = function () {
      var W = 480, H = 640, CY = 500;
      var sy = function (p) { return CY - (p - d.dist); };
      ctx.fillStyle = '#4caf50'; ctx.fillRect(0, 0, W, H);

      d.zones.forEach(function (z) {
        var y1 = sy(z.b), y2 = sy(z.a);
        ctx.fillStyle = 'rgba(255,235,59,.35)'; ctx.fillRect(0, y1, W, y2 - y1);
      });

      ctx.fillStyle = '#424242'; ctx.fillRect(60, 0, 360, H);
      ctx.fillStyle = '#fff'; ctx.fillRect(60, 0, 4, H); ctx.fillRect(416, 0, 4, H);
      var off = d.dist % 80;
      for (var y = -80 + off; y < H; y += 80) ctx.fillRect(238, y, 4, 40);

      for (var p = Math.floor((d.dist - 200) / 160) * 160; p < d.dist + 560; p += 160) {
        var ty = sy(p);
        circle(28, ty, 15, '#2e7d32'); circle(452, ty + 50, 15, '#2e7d32');
      }

      d.zones.forEach(function (z) {
        var zy = sy(z.a);
        if (zy > -40 && zy < H + 40) {
          sign(440, zy, String(z.limit));
          ctx.fillStyle = '#000'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('SCHOOL', 440, zy + 32);
        }
      });

      d.lights.forEach(function (l) {
        var ly = sy(l.p);
        if (ly < -80 || ly > H + 80) return;
        ctx.fillStyle = '#fff'; ctx.fillRect(64, ly - 3, 352, 6);
        lamp(447, ly, d.phase(l));
      });

      d.crossings.forEach(function (c) {
        var cy = sy(c.p);
        if (cy < -80 || cy > H + 80) return;
        ctx.fillStyle = 'rgba(255,255,255,.9)';
        for (var x = 72; x < 410; x += 44) ctx.fillRect(x, cy - 30, 24, 60);
        person(30 + c.prog * 420, cy, '#d81b60');
      });

      d.cars.forEach(function (c) {
        var cy = sy(c.y);
        if (cy > -60 && cy < H + 60) drawCar(DLX[c.lane], cy, c.color, false, false);
      });

      var fy = sy(d.length);
      if (fy > -30 && fy < H + 30) {
        for (var i = 0; i < 15; i++) for (var j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#000' : '#fff';
          ctx.fillRect(60 + i * 24, fy - 12 + j * 12, 24, 12);
        }
      }

      drawCar(d.x, CY, '#e53935', true, d.braking);

      if (!d.belt) {
        rr(30, 556, 420, 42, 8, 'rgba(0,0,0,.65)');
        ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Press B (or tap Seat belt) to fasten your seat belt', 240, 583);
      }

      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, 8);
      ctx.fillStyle = '#ffeb3b'; ctx.fillRect(0, 0, W * Math.min(1, d.dist / d.length), 8);

      if (d.flash && d.flash.t > 0) { ctx.fillStyle = d.flash.c; ctx.fillRect(0, 0, W, H); }
    };

    return d;
  }

  // ======================================================
  //  WALKING MODE
  // ======================================================
  var ZL = 470, ZR = 590, ROAD_T = 110, ROAD_B = 350, LANEY = [170, 290];

  function newWalk() {
    var w = {
      type: 'walk', score: 50, t: 0, over: false, rounds: 5, roundNo: 1, flash: null,
      ped: { x: 200, y: 455 }, look: 0, sig: 'red', sigT: 0, cars: [], spawn: [0.5, 1.2],
      prevOn: false, round: null
    };

    w.newRound = function () {
      w.round = { looked: false, clean: true, left: false };
      w.resetPed();
    };
    w.resetPed = function () {
      w.ped.x = 140 + Math.random() * 120; w.ped.y = 455;
      w.prevOn = false; w.look = 0;
      if (w.round) { w.round.looked = false; w.round.left = false; }
    };
    w.newRound();

    w.update = function (dt) {
      w.t += dt; w.sigT += dt;
      if (w.flash) w.flash.t -= dt;
      if (w.look > 0) w.look -= dt;

      var dur = { red: 6, clear: 2.5, green: 8 };
      if (w.sigT >= dur[w.sig]) {
        w.sigT = 0;
        w.sig = { red: 'clear', clear: 'green', green: 'red' }[w.sig];
      }

      // spawn cars (only while cars have the green light)
      for (var i = 0; i < 2; i++) {
        w.spawn[i] -= dt;
        if (w.spawn[i] <= 0) {
          w.spawn[i] = 1.0 + Math.random() * 1.6;
          if (w.sig !== 'red') continue;
          var dir = i === 0 ? 1 : -1, sx = dir > 0 ? -60 : 860;
          var busy = w.cars.some(function (c) { return c.lane === i && Math.abs(c.x - sx) < 130; });
          if (!busy) w.cars.push({
            lane: i, dir: dir, x: sx, y: LANEY[i], w: 90, h: 46, v: 0,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
          });
        }
      }

      // move cars
      var MAXV = 170, stopL = ZL - 14, stopR = ZR + 14;
      w.cars.forEach(function (c) {
        var target = MAXV;
        var front = c.dir > 0 ? c.x + c.w / 2 : c.x - c.w / 2;
        if (w.sig !== 'red') {
          var dl = c.dir > 0 ? stopL - front : front - stopR;
          if (dl >= -2) target = Math.min(target, Math.max(0, dl * 2.5));
        }
        w.cars.forEach(function (o) {
          if (o === c || o.lane !== c.lane) return;
          var gap = c.dir > 0 ? (o.x - o.w / 2) - front : front - (o.x + o.w / 2);
          if (gap >= 0 && gap < 200) target = Math.min(target, Math.max(0, (gap - 20) * 2.5));
        });
        c.v += (target - c.v) * Math.min(1, 4 * dt);
        c.x += c.dir * c.v * dt;
      });
      w.cars = w.cars.filter(function (c) { return c.x > -140 && c.x < 940; });

      // move pedestrian
      var dx = 0, dy = 0;
      if (left()) dx -= 1; if (right()) dx += 1; if (up()) dy -= 1; if (down()) dy += 1;
      var m = Math.hypot(dx, dy) || 1, sp = 120;
      w.ped.x = clamp(w.ped.x + dx / m * sp * dt, 15, 785);
      w.ped.y = clamp(w.ped.y + dy / m * sp * dt, 70, 505);

      // rules
      var on = w.ped.y > ROAD_T + 4 && w.ped.y < ROAD_B - 4;
      var inZ = w.ped.x > ZL && w.ped.x < ZR;
      if (on && !w.prevOn) {
        if (!w.round.looked) add(-5, 'Look left and right before crossing (press L)');
        if (!inZ) { add(-10, 'Jaywalking! Cross only at the zebra crossing'); w.round.left = true; }
        else if (w.sig !== 'green') add(-15, 'Do not cross until the signal turns green');
        else add(5, 'Stepped out on the green signal');
      } else if (on && w.prevOn && !inZ && !w.round.left) {
        w.round.left = true;
        add(-5, 'Stay on the zebra crossing');
      }
      w.prevOn = on;

      // collision
      for (var k = 0; k < w.cars.length; k++) {
        var c = w.cars[k];
        if (Math.abs(c.x - w.ped.x) < c.w / 2 + 8 && Math.abs(c.y - w.ped.y) < c.h / 2 + 10) {
          add(-20, 'A car hit you! Always look and wait for the signal');
          w.resetPed();
          break;
        }
      }

      if (w.score <= 0) { finish(false, 'You ran out of safety points.'); return; }

      // goal
      if (w.ped.y <= 95) {
        add(15, 'Crossing ' + w.roundNo + ' complete');
        if (w.round.clean) add(10, 'Perfect crossing bonus!');
        if (w.roundNo >= w.rounds) { finish(true); return; }
        w.roundNo++; w.newRound();
      }
    };

    w.draw = function () {
      var W = 800, H = 520;
      ctx.fillStyle = '#cfd8dc'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, ROAD_T, W, ROAD_B - ROAD_T);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, ROAD_T, W, 3); ctx.fillRect(0, ROAD_B - 3, W, 3);
      ctx.fillStyle = '#ffd54f';
      for (var x = 0; x < W; x += 60) ctx.fillRect(x, 228, 34, 4);

      ctx.fillStyle = 'rgba(255,255,255,.92)';
      for (var y = ROAD_T + 10; y < ROAD_B - 12; y += 24) ctx.fillRect(ZL, y, ZR - ZL, 13);
      ctx.fillStyle = '#fff';
      ctx.fillRect(ZL - 16, ROAD_T, 4, 120); ctx.fillRect(ZR + 12, 230, 4, 120);

      ctx.fillStyle = '#37474f'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Reach this side safely', 400, 60);
      ctx.font = '13px sans-serif';
      ctx.fillText('ZEBRA CROSSING', (ZL + ZR) / 2, ROAD_B + 22);

      // pedestrian signal
      var sx = ZL - 50, sy = 375;
      rr(sx - 14, sy, 28, 64, 6, '#212121');
      circle(sx, sy + 18, 9, w.sig !== 'green' ? '#f44336' : '#4a1a1a');
      circle(sx, sy + 46, 9, w.sig === 'green' ? '#4caf50' : '#1a4a1a');
      ctx.fillStyle = '#37474f'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(w.sig === 'green' ? 'WALK' : 'WAIT', sx, sy + 82);

      w.cars.forEach(function (c) {
        rr(c.x - c.w / 2, c.y - c.h / 2, c.w, c.h, 8, c.color);
        var wx = c.dir > 0 ? c.x + c.w / 2 - 30 : c.x - c.w / 2 + 12;
        rr(wx, c.y - c.h / 2 + 6, 18, c.h - 12, 3, '#b3e5fc');
        ctx.fillStyle = '#fff59d';
        var hx = c.dir > 0 ? c.x + c.w / 2 - 5 : c.x - c.w / 2;
        ctx.fillRect(hx, c.y - c.h / 2 + 4, 5, 8); ctx.fillRect(hx, c.y + c.h / 2 - 12, 5, 8);
      });

      person(w.ped.x, w.ped.y, '#1e88e5');
      if (w.look > 0) { ctx.font = '22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('\uD83D\uDC40', w.ped.x, w.ped.y - 28); }

      if (w.flash && w.flash.t > 0) { ctx.fillStyle = w.flash.c; ctx.fillRect(0, 0, W, H); }
    };

    return w;
  }

  // ======================================================
  //  GAME FLOW
  // ======================================================
  function hud() {
    if (!g) return;
    var s = $('score');
    s.textContent = g.score;
    s.className = g.score < 25 ? 'low' : '';
    if (g.type === 'drive') {
      $('info').textContent = 'Speed ' + Math.round(g.speed * 0.2) + ' km/h  |  Limit ' +
        g.limit() + ' km/h  |  ' + Math.min(100, Math.round(g.dist / g.length * 100)) + '% of route';
    } else {
      $('info').textContent = 'Crossing ' + g.roundNo + '/' + g.rounds + '  |  Signal: ' +
        (g.sig === 'green' ? 'WALK (green)' : 'WAIT (red)');
    }
  }

  function finish(win, reason) {
    g.over = true;
    $('endTitle').textContent = win ? 'Well done!' : 'Game over';
    $('stars').textContent = win ? (g.score >= 90 ? '\u2B50\u2B50\u2B50' : g.score >= 65 ? '\u2B50\u2B50' : '\u2B50') : '';
    $('endMsg').textContent = (win ? 'You finished safely. ' : (reason + ' ')) + 'Final score: ' + g.score;
    $('end').classList.remove('hidden');
  }

  function loop(t) {
    if (!g) return;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    g.update(dt);
    g.draw();
    hud();
    if (!g.over) raf = requestAnimationFrame(loop);
  }

  function start(mode) {
    lastMode = mode;
    Object.keys(keys).forEach(function (k) { keys[k] = false; });
    $('menu').classList.add('hidden');
    $('end').classList.add('hidden');
    $('play').classList.remove('hidden');
    $('log').innerHTML = '';
    if (mode === 'drive') {
      canvas.width = 480; canvas.height = 640; g = newDrive();
      $('actBtn').textContent = 'Seat belt (B)';
      $('help').textContent = 'Up/W = gas, Down/S/Space = brake, Left/Right = change lane, B = seat belt';
      add(0, 'Fasten your seat belt, then drive to the finish line following the rules.');
    } else {
      canvas.width = 800; canvas.height = 520; g = newWalk();
      $('actBtn').textContent = 'Look (L)';
      $('help').textContent = 'Arrow keys / WASD = walk, L = look left and right';
      add(0, 'Cross the road 5 times. Look, use the zebra crossing and wait for green.');
    }
    cancelAnimationFrame(raf);
    lastT = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function toMenu() {
    cancelAnimationFrame(raf);
    g = null;
    $('play').classList.add('hidden');
    $('menu').classList.remove('hidden');
  }

  document.querySelectorAll('[data-mode]').forEach(function (b) {
    b.addEventListener('click', function () { start(b.getAttribute('data-mode')); });
  });
  $('again').addEventListener('click', function () { start(lastMode); });
  $('toMenu').addEventListener('click', toMenu);
  $('quit').addEventListener('click', toMenu);
})();
