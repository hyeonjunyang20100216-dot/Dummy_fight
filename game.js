(() => {
  "use strict";

  const canvas = document.getElementById("arena");
  const ctx = canvas.getContext("2d");

  const ui = {
    start: document.getElementById("startBtn"),
    pause: document.getElementById("pauseBtn"),
    reset: document.getElementById("resetBtn"),
    again: document.getElementById("againBtn"),
    speed: document.getElementById("speedRange"),
    speedLabel: document.getElementById("speedLabel"),
    redBleedBar: document.getElementById("redBleedBar"),
    blueBleedBar: document.getElementById("blueBleedBar"),
    redBleedText: document.getElementById("redBleedText"),
    blueBleedText: document.getElementById("blueBleedText"),
    redStatus: document.getElementById("redStatus"),
    blueStatus: document.getElementById("blueStatus"),
    bleedLimit: document.getElementById("bleedLimit"),
    bleedLimitValue: document.getElementById("bleedLimitValue"),
    bleedLimitText: document.getElementById("bleedLimitText"),
    detachChance: document.getElementById("detachChance"),
    detachChanceValue: document.getElementById("detachChanceValue"),
    aggression: document.getElementById("aggression"),
    aggressionValue: document.getElementById("aggressionValue"),
    matchState: document.getElementById("matchState"),
    timeLabel: document.getElementById("timeLabel"),
    winnerOverlay: document.getElementById("winnerOverlay"),
    winnerText: document.getElementById("winnerText"),
    combatLog: document.getElementById("combatLog"),
    clearLog: document.getElementById("clearLogBtn"),
    livePill: document.querySelector(".live-pill")
  };

  const PART_LABELS = {
    head: "머리",
    torso: "몸통",
    leftArm: "왼팔",
    rightArm: "오른팔",
    leftLeg: "왼다리",
    rightLeg: "오른다리"
  };

  const LIMBS = ["leftArm", "rightArm", "leftLeg", "rightLeg"];
  const TARGETS = ["torso", "leftArm", "rightArm", "leftLeg", "rightLeg", "head"];

  const state = {
    running: false,
    finished: false,
    time: 0,
    last: performance.now(),
    speed: 1,
    shake: 0,
    particles: [],
    detached: [],
    droppedWeapons: [],
    audio: null,
    red: null,
    blue: null
  };

  function partSet() {
    return {
      head: { hp: 72, max: 72, attached: true },
      torso: { hp: 150, max: 150, attached: true },
      leftArm: { hp: 70, max: 70, attached: true },
      rightArm: { hp: 70, max: 70, attached: true },
      leftLeg: { hp: 82, max: 82, attached: true },
      rightLeg: { hp: 82, max: 82, attached: true }
    };
  }

  function createFighter(team, x, facing, weapon) {
    return {
      team,
      x,
      y: 545,
      vx: 0,
      facing,
      color: team === "red" ? "#ff3b47" : "#3d7cff",
      dark: team === "red" ? "#821e2a" : "#1c428f",
      weapon,
      weaponHeld: true,
      bleed: 0,
      bleedRate: 0,
      parts: partSet(),
      attackCooldown: 0.35 + Math.random() * 0.3,
      attackTimer: 0,
      attackDuration: 0.42,
      attackKind: null,
      targetPart: null,
      hitCommitted: false,
      bob: Math.random() * Math.PI * 2,
      stagger: 0,
      intent: "대기",
      lastAction: "",
      seed: Math.random() * 1000
    };
  }

  function reset() {
    state.running = false;
    state.finished = false;
    state.time = 0;
    state.shake = 0;
    state.particles.length = 0;
    state.detached.length = 0;
    state.droppedWeapons.length = 0;
    state.red = createFighter("red", 355, 1, "knife");
    state.blue = createFighter("blue", 925, -1, "spear");
    ui.winnerOverlay.classList.add("hidden");
    ui.matchState.textContent = "READY";
    ui.livePill.classList.remove("running");
    ui.combatLog.innerHTML = "";
    log("SYSTEM", "시뮬레이션 초기화. 빨강: 검 / 파랑: 창");
    updateUI();
  }

  function start() {
    if (state.finished) reset();
    state.running = true;
    state.last = performance.now();
    ui.matchState.textContent = "RUNNING";
    ui.livePill.classList.add("running");
    initAudio();
  }

  function pause() {
    if (state.finished) return;
    state.running = !state.running;
    state.last = performance.now();
    ui.matchState.textContent = state.running ? "RUNNING" : "PAUSED";
    ui.livePill.classList.toggle("running", state.running);
  }

  function initAudio() {
    if (!state.audio) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) state.audio = new AC();
    }
    if (state.audio?.state === "suspended") state.audio.resume();
  }

  function tone(freq = 120, duration = .045, gain = .025) {
    if (!state.audio) return;
    const o = state.audio.createOscillator();
    const g = state.audio.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, state.audio.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, state.audio.currentTime + duration);
    o.connect(g).connect(state.audio.destination);
    o.start();
    o.stop(state.audio.currentTime + duration);
  }

  function config() {
    return {
      bleedLimit: Number(ui.bleedLimit.value),
      detachChance: Number(ui.detachChance.value) / 100,
      aggression: Number(ui.aggression.value) / 100
    };
  }

  function mobility(f) {
    const legs = Number(f.parts.leftLeg.attached) + Number(f.parts.rightLeg.attached);
    if (legs === 2) return 1;
    if (legs === 1) return .53;
    const arms = Number(f.parts.leftArm.attached) + Number(f.parts.rightArm.attached);
    return arms ? .16 : 0;
  }

  function canAttack(f) {
    const p = f.parts;
    if (f.weaponHeld && p.rightArm.attached) return true;
    if (p.leftArm.attached || p.rightArm.attached) return true;
    return p.leftLeg.attached || p.rightLeg.attached;
  }

  function attackProfile(f) {
    const p = f.parts;
    if (f.weaponHeld && p.rightArm.attached) {
      if (f.weapon === "spear") return { kind: "spear", reach: 182, min: 12, max: 23, duration: .50, label: "창 찌르기" };
      return { kind: "knife", reach: 104, min: 15, max: 28, duration: .40, label: "검 베기" };
    }
    if (p.leftArm.attached || p.rightArm.attached) {
      return { kind: "punch", reach: 66, min: 6, max: 11, duration: .34, label: "남은 팔 공격" };
    }
    if (p.leftLeg.attached || p.rightLeg.attached) {
      return { kind: "kick", reach: 75, min: 8, max: 13, duration: .42, label: "다리 공격" };
    }
    return null;
  }

  function aiStep(f, enemy, dt) {
    if (state.finished) return;
    f.attackCooldown = Math.max(0, f.attackCooldown - dt);
    f.stagger = Math.max(0, f.stagger - dt);

    if (f.attackTimer > 0) {
      f.attackTimer -= dt;
      const progress = 1 - f.attackTimer / f.attackDuration;
      if (!f.hitCommitted && progress > .52) {
        f.hitCommitted = true;
        resolveHit(f, enemy);
      }
      return;
    }

    const profile = attackProfile(f);
    const dist = Math.abs(enemy.x - f.x);
    const move = mobility(f);
    const aggro = config().aggression;

    if (!profile) {
      f.intent = "행동 불가";
      f.vx *= Math.pow(.001, dt);
      return;
    }

    if (dist > profile.reach * .91) {
      const desired = (enemy.x > f.x ? 1 : -1) * (75 + 72 * aggro) * move;
      f.vx += (desired - f.vx) * Math.min(1, dt * 6);
      f.intent = move < .2 ? "기어서 접근" : "접근";
    } else if (dist < Math.max(45, profile.reach * .42)) {
      f.vx += ((enemy.x > f.x ? -1 : 1) * 56 * move - f.vx) * Math.min(1, dt * 5);
      f.intent = "거리 조절";
    } else {
      f.vx *= Math.pow(.06, dt);
      f.intent = "공격 기회";
      if (f.attackCooldown <= 0 && Math.random() < dt * (2.4 + aggro * 3.3)) {
        beginAttack(f, enemy, profile);
      }
    }

    if (f.stagger > 0) f.vx *= .35;
    f.x += f.vx * dt;
    f.x = Math.max(110, Math.min(1170, f.x));
    f.facing = enemy.x > f.x ? 1 : -1;
  }

  function pickTarget(enemy, attacker) {
    const available = TARGETS.filter(k => enemy.parts[k].attached);
    if (!available.length) return "torso";

    // The spear prefers center mass, the short blade more often clips limbs in close range.
    const r = Math.random();
    if (attacker.weaponHeld && attacker.weapon === "spear" && r < .48) return "torso";
    if (attacker.weaponHeld && attacker.weapon === "knife" && r < .58) {
      const limbs = LIMBS.filter(k => enemy.parts[k].attached);
      if (limbs.length) return limbs[Math.floor(Math.random() * limbs.length)];
    }
    return available[Math.floor(Math.random() * available.length)];
  }

  function beginAttack(f, enemy, profile) {
    f.attackKind = profile.kind;
    f.attackDuration = profile.duration;
    f.attackTimer = profile.duration;
    f.hitCommitted = false;
    f.targetPart = pickTarget(enemy, f);
    f.intent = profile.label;
    f.attackCooldown = .48 + Math.random() * .5 + (1 - config().aggression) * .7;
  }

  function resolveHit(attacker, defender) {
    const profile = attackProfile(attacker);
    if (!profile) return;
    const dist = Math.abs(defender.x - attacker.x);
    if (dist > profile.reach + 26) {
      log(attacker.team, profile.label + " 빗나감");
      tone(82, .025, .012);
      return;
    }

    let hitChance = .73 + config().aggression * .13;
    if (defender.stagger > 0) hitChance += .08;
    if (Math.random() > hitChance) {
      log(attacker.team, profile.label + " 회피됨");
      spawnParticles((attacker.x + defender.x) / 2, 390, "#d9e4f5", 4);
      return;
    }

    const partName = defender.parts[attacker.targetPart]?.attached ? attacker.targetPart : "torso";
    const part = defender.parts[partName];
    const damage = profile.min + Math.random() * (profile.max - profile.min);
    part.hp = Math.max(0, part.hp - damage);

    const weaponFactor = profile.kind === "knife" ? 1.15 : profile.kind === "spear" ? .92 : .4;
    defender.bleed += damage * .11 * weaponFactor;
    defender.bleedRate += damage * .0025 * weaponFactor;
    defender.stagger = .12 + damage * .007;
    defender.vx += attacker.facing * damage * 1.15;
    state.shake = Math.min(7, 1.2 + damage * .12);

    const point = partWorldPoint(defender, partName);
    spawnParticles(point.x, point.y, "#eef4ff", Math.round(4 + damage / 5));
    tone(profile.kind === "spear" ? 155 : profile.kind === "knife" ? 190 : 95, .052, .024);

    log(attacker.team, profile.label + " → " + PART_LABELS[partName] + " (" + Math.round(damage) + " 손상)");

    if (LIMBS.includes(partName) && part.hp <= 0 && part.attached) {
      const chance = config().detachChance * (profile.kind === "knife" ? 1.15 : profile.kind === "spear" ? .78 : .16);
      if (Math.random() < chance) detachPart(defender, partName, attacker.facing);
      else {
        part.hp = 3;
        defender.bleedRate += .035;
      }
    }

    checkFinish();
  }

  function detachPart(f, partName, direction) {
    const part = f.parts[partName];
    if (!part.attached) return;
    part.attached = false;
    part.hp = 0;

    const p = partWorldPoint(f, partName);
    state.detached.push({
      team: f.team,
      color: f.color,
      kind: partName,
      x: p.x,
      y: p.y,
      vx: direction * (35 + Math.random() * 70),
      vy: -85 - Math.random() * 90,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - .5) * 5.5,
      life: 18
    });

    f.bleed += 5.5;
    f.bleedRate += partName.includes("Leg") ? .22 : .17;
    state.shake = 6;
    spawnParticles(p.x, p.y, f.color, 8);
    log(f.team, PART_LABELS[partName] + " 파츠 분리");

    if (partName === "rightArm" && f.weaponHeld) {
      f.weaponHeld = false;
      dropWeapon(f, p.x, p.y);
      log(f.team, "무기를 든 오른팔이 분리되어 무기 사용 불가");
    }
  }

  function dropWeapon(f, x, y) {
    state.droppedWeapons.push({
      type: f.weapon,
      x,
      y,
      vx: f.facing * (30 + Math.random() * 35),
      vy: -45,
      rot: f.facing > 0 ? -.3 : Math.PI + .3,
      vr: (Math.random() - .5) * 3.8
    });
  }

  function bleedingStep(f, dt) {
    const torsoRatio = f.parts.torso.hp / f.parts.torso.max;
    const headRatio = f.parts.head.hp / f.parts.head.max;
    const extra = (1 - torsoRatio) * .018 + (1 - headRatio) * .009;
    f.bleed += (f.bleedRate + extra) * dt * 8.0;
    f.bleedRate *= Math.pow(.996, dt * 60);
  }

  function checkFinish() {
    const limit = config().bleedLimit;
    if (state.red.bleed >= limit || state.blue.bleed >= limit) {
      finish(state.red.bleed >= limit ? state.blue : state.red);
    }
  }

  function finish(winner) {
    if (state.finished) return;
    state.finished = true;
    state.running = false;
    ui.livePill.classList.remove("running");
    ui.matchState.textContent = "COMPLETE";
    ui.winnerText.textContent = winner.team.toUpperCase() + " WINS";
    ui.winnerText.style.color = winner.color;
    ui.winnerOverlay.classList.remove("hidden");
    log("SYSTEM", winner.team.toUpperCase() + " 승리. 상대가 설정 출혈량에 먼저 도달함.");
    tone(260, .14, .035);
  }

  function partWorldPoint(f, name) {
    const pose = poseFor(f);
    return pose.points[name] || { x: f.x, y: f.y - 130 };
  }

  function poseFor(f) {
    const t = state.time;
    const moveAmt = Math.min(1, Math.abs(f.vx) / 115);
    const walk = Math.sin(t * 8 + f.seed) * .48 * moveAmt;
    const bob = Math.sin(t * 9 + f.bob) * 3 * moveAmt;
    const dir = f.facing;
    const bodyX = f.x;
    const hipY = f.y - 83 + bob;
    const shoulderY = f.y - 176 + bob;
    const centerY = (hipY + shoulderY) / 2;
    const atk = f.attackTimer > 0 ? 1 - f.attackTimer / f.attackDuration : 0;
    const swing = Math.sin(Math.min(1, atk) * Math.PI);
    const thrust = Math.sin(Math.min(1, atk) * Math.PI) * dir;
    const stagger = f.stagger > 0 ? -dir * 5 : 0;

    const points = {
      torso: { x: bodyX + stagger, y: centerY },
      head: { x: bodyX + stagger, y: shoulderY - 53 },
      leftArm: { x: bodyX - dir * 26, y: shoulderY + 41 },
      rightArm: { x: bodyX + dir * 30, y: shoulderY + 35 },
      leftLeg: { x: bodyX - 21, y: hipY + 69 },
      rightLeg: { x: bodyX + 21, y: hipY + 69 }
    };

    let weaponTip = null;
    if (f.weaponHeld && f.parts.rightArm.attached) {
      if (f.weapon === "spear") {
        weaponTip = { x: bodyX + dir * (92 + thrust * 78), y: shoulderY + 34 - swing * 4 };
      } else {
        const angle = dir > 0 ? (-.9 + atk * 1.75) : (Math.PI + .9 - atk * 1.75);
        weaponTip = { x: bodyX + Math.cos(angle) * 86, y: shoulderY + 34 + Math.sin(angle) * 86 };
      }
    }

    return { bodyX, hipY, shoulderY, centerY, walk, bob, swing, thrust, points, weaponTip };
  }

  function drawRoundedLine(ax, ay, bx, by, width, color, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  function bodyGradient(f, x1, x2) {
    const g = ctx.createLinearGradient(x1, 0, x2, 0);
    g.addColorStop(0, f.dark);
    g.addColorStop(.48, f.color);
    g.addColorStop(.72, lighten(f.color, 36));
    g.addColorStop(1, f.dark);
    return g;
  }

  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, (n >> 16) + amt);
    const g = Math.min(255, ((n >> 8) & 255) + amt);
    const b = Math.min(255, (n & 255) + amt);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function drawFighter(f) {
    const p = poseFor(f);
    const dir = f.facing;
    ctx.save();

    // floor shadow
    const shadowScale = mobility(f) === 0 ? 1.3 : 1;
    const shadow = ctx.createRadialGradient(f.x, f.y + 7, 8, f.x, f.y + 7, 74 * shadowScale);
    shadow.addColorStop(0, "rgba(0,0,0,.36)");
    shadow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 8, 82 * shadowScale, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = bodyGradient(f, f.x - 45, f.x + 45);
    const joint = "rgba(5,9,14,.82)";

    // legs behind torso
    const legStride = p.walk * 28;
    if (f.parts.leftLeg.attached) {
      const hipX = f.x - 20;
      const kneeX = hipX + legStride;
      const kneeY = p.hipY + 51;
      const footX = kneeX - legStride * .6 - dir * 4;
      drawRoundedLine(hipX, p.hipY, kneeX, kneeY, 25, grad);
      drawJoint(kneeX, kneeY, 13, f.color);
      drawRoundedLine(kneeX, kneeY, footX, f.y - 7, 22, grad);
      drawRoundedLine(footX - dir * 5, f.y - 5, footX + dir * 22, f.y - 5, 18, grad);
    }
    if (f.parts.rightLeg.attached) {
      const hipX = f.x + 20;
      const kneeX = hipX - legStride;
      const kneeY = p.hipY + 51;
      const footX = kneeX + legStride * .6 + dir * 5;
      drawRoundedLine(hipX, p.hipY, kneeX, kneeY, 25, grad);
      drawJoint(kneeX, kneeY, 13, f.color);
      drawRoundedLine(kneeX, kneeY, footX, f.y - 7, 22, grad);
      drawRoundedLine(footX - dir * 5, f.y - 5, footX + dir * 22, f.y - 5, 18, grad);
    }

    // torso, beveled mannequin body
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(f.x - 39, p.shoulderY + 7);
    ctx.quadraticCurveTo(f.x - 49, p.shoulderY + 20, f.x - 37, p.shoulderY + 55);
    ctx.lineTo(f.x - 30, p.hipY - 7);
    ctx.quadraticCurveTo(f.x, p.hipY + 10, f.x + 30, p.hipY - 7);
    ctx.lineTo(f.x + 37, p.shoulderY + 55);
    ctx.quadraticCurveTo(f.x + 49, p.shoulderY + 20, f.x + 39, p.shoulderY + 7);
    ctx.quadraticCurveTo(f.x, p.shoulderY - 8, f.x - 39, p.shoulderY + 7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.13)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // chest highlight
    ctx.globalAlpha = .14;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(f.x + dir * 9, p.centerY - 12, 11, 43, -.12 * dir, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // arms
    const atk = f.attackTimer > 0 ? 1 - f.attackTimer / f.attackDuration : 0;
    const wave = Math.sin(atk * Math.PI);
    const shoulderLeft = { x: f.x - 35, y: p.shoulderY + 18 };
    const shoulderRight = { x: f.x + 35, y: p.shoulderY + 18 };

    if (f.parts.leftArm.attached) {
      let elbowX = shoulderLeft.x - dir * 13;
      let elbowY = shoulderLeft.y + 47;
      let handX = elbowX + dir * 5;
      let handY = elbowY + 42;
      if (!f.weaponHeld && f.attackKind === "punch" && f.attackTimer > 0) {
        elbowX = shoulderLeft.x + dir * 25 * wave;
        elbowY = shoulderLeft.y + 25;
        handX = elbowX + dir * (28 + 22 * wave);
        handY = elbowY + 6;
      }
      drawRoundedLine(shoulderLeft.x, shoulderLeft.y, elbowX, elbowY, 20, grad);
      drawJoint(elbowX, elbowY, 10, f.color);
      drawRoundedLine(elbowX, elbowY, handX, handY, 17, grad);
      drawJoint(handX, handY, 9, f.color);
    }

    if (f.parts.rightArm.attached) {
      let shoulder = shoulderRight;
      let elbowX = shoulder.x + dir * 14;
      let elbowY = shoulder.y + 44;
      let handX = elbowX + dir * 8;
      let handY = elbowY + 40;

      if (f.weaponHeld && f.attackTimer > 0) {
        if (f.weapon === "spear") {
          elbowX = shoulder.x + dir * (23 + 20 * wave);
          elbowY = shoulder.y + 18;
          handX = elbowX + dir * (26 + 30 * wave);
          handY = elbowY + 2;
        } else {
          const ang = dir > 0 ? (-.78 + atk * 1.55) : (Math.PI + .78 - atk * 1.55);
          elbowX = shoulder.x + Math.cos(ang) * 39;
          elbowY = shoulder.y + Math.sin(ang) * 39;
          handX = elbowX + Math.cos(ang) * 34;
          handY = elbowY + Math.sin(ang) * 34;
        }
      } else if (!f.weaponHeld && f.attackKind === "punch" && f.attackTimer > 0) {
        elbowX = shoulder.x + dir * (25 + 20 * wave);
        elbowY = shoulder.y + 20;
        handX = elbowX + dir * (28 + 20 * wave);
        handY = elbowY + 5;
      }

      drawRoundedLine(shoulder.x, shoulder.y, elbowX, elbowY, 20, grad);
      drawJoint(elbowX, elbowY, 10, f.color);
      drawRoundedLine(elbowX, elbowY, handX, handY, 17, grad);
      drawJoint(handX, handY, 9, f.color);

      if (f.weaponHeld) drawWeapon(f, handX, handY, atk);
    }

    // head + neck
    drawRoundedLine(f.x, p.shoulderY + 1, f.x, p.shoulderY - 19, 19, grad);
    const hg = ctx.createRadialGradient(f.x + dir * 8, p.shoulderY - 61, 5, f.x, p.shoulderY - 53, 34);
    hg.addColorStop(0, lighten(f.color, 52));
    hg.addColorStop(.48, f.color);
    hg.addColorStop(1, f.dark);
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(f.x, p.shoulderY - 53, 31, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.15)";
    ctx.stroke();

    // minimal face direction marker
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.beginPath();
    ctx.arc(f.x + dir * 12, p.shoulderY - 57, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // team floor label
    ctx.font = "800 11px Inter, system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = f.color;
    ctx.globalAlpha = .76;
    ctx.fillText(f.team.toUpperCase(), f.x, f.y + 36);
    ctx.globalAlpha = 1;

    ctx.restore();
  }

  function drawJoint(x, y, r, color) {
    ctx.save();
    ctx.fillStyle = "#070b11";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = .55;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r - 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawWeapon(f, handX, handY, atk) {
    ctx.save();
    ctx.lineCap = "round";
    if (f.weapon === "spear") {
      const wave = f.attackTimer > 0 ? Math.sin(atk * Math.PI) : 0;
      const lenBack = 55;
      const lenFront = 132;
      const x1 = handX - f.facing * lenBack;
      const x2 = handX + f.facing * (lenFront + wave * 42);
      drawRoundedLine(x1, handY + 3, x2, handY - 2, 7, "#8a6a46");
      drawRoundedLine(x1, handY + 1, x2, handY - 4, 2, "#d4b17a", .8);
      ctx.fillStyle = "#dfe8f3";
      ctx.beginPath();
      const tip = { x: x2 + f.facing * 24, y: handY - 4 };
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(x2, handY - 14);
      ctx.lineTo(x2, handY + 7);
      ctx.closePath();
      ctx.fill();
    } else {
      const angle = f.attackTimer > 0
        ? (f.facing > 0 ? (-.82 + atk * 1.55) : (Math.PI + .82 - atk * 1.55))
        : (f.facing > 0 ? -.52 : Math.PI + .52);
      const hx = handX;
      const hy = handY;
      const tx = hx + Math.cos(angle) * 76;
      const ty = hy + Math.sin(angle) * 76;
      drawRoundedLine(hx, hy, hx + Math.cos(angle) * 19, hy + Math.sin(angle) * 19, 8, "#3a2c22");
      ctx.strokeStyle = "#edf4fb";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(angle) * 14, hy + Math.sin(angle) * 14);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.8)";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(angle) * 18, hy + Math.sin(angle) * 18);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDetached(dt) {
    const floor = 548;
    for (const d of state.detached) {
      d.vy += 560 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      d.life -= dt;
      if (d.y > floor) {
        d.y = floor;
        d.vy *= -.23;
        d.vx *= .78;
        d.vr *= .72;
      }
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      const isLeg = d.kind.includes("Leg");
      roundRect(-10, isLeg ? -38 : -31, 20, isLeg ? 76 : 62, 10);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.14)";
      ctx.stroke();
      ctx.restore();
    }
    state.detached = state.detached.filter(d => d.life > 0);
  }

  function drawDroppedWeapons(dt) {
    const floor = 557;
    for (const w of state.droppedWeapons) {
      w.vy += 560 * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.rot += w.vr * dt;
      if (w.y > floor) {
        w.y = floor;
        w.vy *= -.17;
        w.vx *= .68;
        w.vr *= .7;
      }
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.rot);
      if (w.type === "spear") {
        drawRoundedLine(-66, 0, 70, 0, 6, "#8a6a46");
        ctx.fillStyle = "#e3edf7";
        ctx.beginPath();
        ctx.moveTo(92, 0); ctx.lineTo(68, -10); ctx.lineTo(68, 10); ctx.closePath(); ctx.fill();
      } else {
        drawRoundedLine(-12, 0, 14, 0, 8, "#3a2c22");
        drawRoundedLine(12, 0, 69, 0, 8, "#e4edf6");
      }
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      state.particles.push({
        x, y,
        vx: (Math.random() - .5) * 150,
        vy: (Math.random() - .7) * 145,
        life: .25 + Math.random() * .35,
        max: .6,
        size: 1.2 + Math.random() * 2.6,
        color
      });
    }
  }

  function drawParticles(dt) {
    for (const p of state.particles) {
      p.vy += 250 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function drawArena(dt) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, "#0d1420");
    bg.addColorStop(.62, "#0a1019");
    bg.addColorStop(1, "#06090e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // atmospheric spotlights
    drawLight(250, 0, "rgba(255,59,71,.08)");
    drawLight(1030, 0, "rgba(61,124,255,.08)");

    // back wall grid
    ctx.strokeStyle = "rgba(160,185,220,.035)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= 1280; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 560); ctx.stroke();
    }
    for (let y = 80; y <= 560; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1280, y); ctx.stroke();
    }

    // horizon + floor
    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.beginPath(); ctx.moveTo(0, 560); ctx.lineTo(1280, 560); ctx.stroke();
    const floor = ctx.createLinearGradient(0, 560, 0, 720);
    floor.addColorStop(0, "rgba(255,255,255,.025)");
    floor.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 560, 1280, 160);

    ctx.save();
    if (state.shake > .05) {
      ctx.translate((Math.random() - .5) * state.shake, (Math.random() - .5) * state.shake);
      state.shake *= .84;
    }

    drawDroppedWeapons(dt);
    drawDetached(dt);
    drawFighter(state.red);
    drawFighter(state.blue);
    drawParticles(dt);

    ctx.restore();

    // vignette
    const vg = ctx.createRadialGradient(640, 330, 180, 640, 330, 760);
    vg.addColorStop(.5, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, 1280, 720);
  }

  function drawLight(x, y, color) {
    const g = ctx.createRadialGradient(x, y, 20, x, y, 460);
    g.addColorStop(0, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 600);
  }

  function log(team, message) {
    const row = document.createElement("div");
    row.className = "log-line";
    const teamClass = team === "red" || team === "blue" ? team : "";
    row.innerHTML =
      '<span class="log-time">' + state.time.toFixed(1).padStart(4, "0") + 's</span>' +
      '<span class="log-team ' + teamClass + '">' + team.toUpperCase() + '</span>' +
      '<span class="log-message">' + message + '</span>';
    ui.combatLog.prepend(row);
    while (ui.combatLog.children.length > 70) ui.combatLog.lastChild.remove();
  }

  function updateStatus(f, root) {
    const order = ["head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"];
    root.innerHTML = order.map(name => {
      const p = f.parts[name];
      const pct = Math.max(0, p.hp / p.max);
      const cls = !p.attached ? "off" : pct < .36 ? "warn" : "";
      const value = p.attached ? Math.round(pct * 100) + "%" : "분리";
      return '<div class="limb-chip ' + cls + '"><span>' + PART_LABELS[name] + '</span><b>' + value + '</b></div>';
    }).join("");
  }

  function updateUI() {
    const limit = config().bleedLimit;
    const red = Math.min(limit, state.red.bleed);
    const blue = Math.min(limit, state.blue.bleed);
    ui.redBleedBar.style.width = (red / limit * 100) + "%";
    ui.blueBleedBar.style.width = (blue / limit * 100) + "%";
    ui.redBleedText.textContent = red.toFixed(1) + " / " + limit;
    ui.blueBleedText.textContent = blue.toFixed(1) + " / " + limit;
    ui.timeLabel.textContent = state.time.toFixed(1).padStart(4, "0") + "s";
    updateStatus(state.red, ui.redStatus);
    updateStatus(state.blue, ui.blueStatus);
  }

  function frame(now) {
    const rawDt = Math.min(.033, (now - state.last) / 1000 || 0);
    state.last = now;
    const dt = rawDt * state.speed;

    if (state.running && !state.finished) {
      state.time += dt;
      aiStep(state.red, state.blue, dt);
      aiStep(state.blue, state.red, dt);
      bleedingStep(state.red, dt);
      bleedingStep(state.blue, dt);
      checkFinish();
      updateUI();
    }

    drawArena(rawDt);
    requestAnimationFrame(frame);
  }

  ui.start.addEventListener("click", start);
  ui.pause.addEventListener("click", pause);
  ui.reset.addEventListener("click", reset);
  ui.again.addEventListener("click", () => { reset(); start(); });
  ui.clearLog.addEventListener("click", () => ui.combatLog.innerHTML = "");

  ui.speed.addEventListener("input", () => {
    state.speed = Number(ui.speed.value);
    ui.speedLabel.textContent = state.speed.toFixed(2) + "×";
  });

  ui.bleedLimit.addEventListener("input", () => {
    ui.bleedLimitValue.textContent = ui.bleedLimit.value;
    ui.bleedLimitText.textContent = ui.bleedLimit.value;
    updateUI();
  });

  ui.detachChance.addEventListener("input", () => {
    ui.detachChanceValue.textContent = ui.detachChance.value + "%";
  });

  ui.aggression.addEventListener("input", () => {
    ui.aggressionValue.textContent = ui.aggression.value + "%";
  });

  reset();
  requestAnimationFrame(frame);
})();