import * as THREE from "three";

export function createGallery(canvas, onEnterDoor) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x14141c, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x14141c, 12, 42);
  scene.background = new THREE.Color(0x14141c);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 120);
  camera.position.set(0, 1.55, 8);

  const world = new THREE.Group();
  scene.add(world);

  scene.add(new THREE.HemisphereLight(0xc9d4e8, 0x2a2018, 1.1));
  const key = new THREE.PointLight(0xffe4b5, 40, 36, 1.4);
  key.position.set(0, 3.4, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x88d8e0, 28, 32, 1.4);
  rim.position.set(0, 2.6, -4);
  scene.add(rim);

  const matFloor = new THREE.MeshStandardMaterial({
    color: 0x2a2c36,
    roughness: 0.28,
    metalness: 0.45,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(28, 48), matFloor);
  floor.rotation.x = -Math.PI / 2;
  world.add(floor);

  const grid = new THREE.GridHelper(48, 24, 0x6b6458, 0x3a3c48);
  grid.position.y = 0.01;
  world.add(grid);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 48),
    new THREE.MeshStandardMaterial({ color: 0x1c1e28, roughness: 0.9 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 4.2;
  world.add(ceil);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x242632, roughness: 0.7 });
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4.2, 48), wallMat);
  left.position.set(-6.2, 2.1, 0);
  const right = left.clone();
  right.position.x = 6.2;
  world.add(left, right);

  const end = new THREE.Mesh(new THREE.BoxGeometry(12.8, 4.2, 0.4), wallMat);
  end.position.set(0, 2.1, -22);
  world.add(end);

  for (let i = 0; i < 12; i += 1) {
    const z = 18 - i * 3.4;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(12.8, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xe8d5a3, emissive: 0xe8d5a3, emissiveIntensity: 0.85 })
    );
    rib.position.set(0, 4.05, z);
    world.add(rib);
    const lamp = new THREE.PointLight(0xf0e6d0, 8, 9, 2);
    lamp.position.set(0, 3.6, z);
    world.add(lamp);
  }

  const dust = makeDust();
  scene.add(dust);

  const doors = [];
  const doorGroup = new THREE.Group();
  world.add(doorGroup);

  const keys = new Set();
  const look = { yaw: 0, pitch: -0.08, locked: false };
  let enabled = false;
  let vel = new THREE.Vector3();

  function makeDust() {
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xe8d5a3, size: 0.03, transparent: true, opacity: 0.35 })
    );
  }

  function labelTexture(text) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#0c0d12";
    g.fillRect(0, 0, 512, 256);
    g.strokeStyle = "#e8d5a3";
    g.lineWidth = 6;
    g.strokeRect(18, 18, 476, 220);
    g.fillStyle = "#e8e0d0";
    g.font = "italic 64px 'Cormorant Garamond', serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 256, 128);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    return t;
  }

  function setDoors(list) {
    while (doorGroup.children.length) {
      const ch = doorGroup.children[0];
      doorGroup.remove(ch);
      ch.traverse?.((node) => {
        node.geometry?.dispose?.();
        node.material?.map?.dispose?.();
        node.material?.dispose?.();
      });
    }
    doors.length = 0;
    list.forEach((spec, i) => {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 3.4, 0.18),
        new THREE.MeshStandardMaterial({
          color: 0x101218,
          emissive: spec.glow || 0x7ec8c8,
          emissiveIntensity: 1.1,
          roughness: 0.4,
        })
      );
      const portal = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 2.8),
        new THREE.MeshStandardMaterial({
          map: labelTexture(spec.label),
          emissive: 0x222433,
          emissiveIntensity: 1.2,
        })
      );
      portal.position.z = 0.12;
      const group = new THREE.Group();
      group.add(frame, portal);
      if (list.length === 1) {
        group.position.set(0, 1.7, -3.2);
      } else {
        const side = i % 2 === 0 ? -1 : 1;
        const z = 2 - i * 5;
        group.position.set(side * 5.7, 1.7, z);
        group.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      doorGroup.add(group);
      const light = new THREE.PointLight(spec.glow || 0xe8d5a3, 22, 14, 1.6);
      light.position.copy(group.position);
      light.position.y += 0.6;
      doorGroup.add(light);
      doors.push({ group, spec });
    });
  }

  function resize() {
    const w = canvas.clientWidth || innerWidth;
    const h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function nearestDoor() {
    let best = null;
    let bestD = 1.35;
    for (const d of doors) {
      const p = d.group.position;
      const dx = camera.position.x - p.x;
      const dz = camera.position.z - p.z;
      const dist = Math.hypot(dx, dz);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return best;
  }

  function tick(dt) {
    if (!enabled) {
      renderer.render(scene, camera);
      return null;
    }
    dust.rotation.y += dt * 0.02;
    const forward = new THREE.Vector3(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    const rightV = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const wish = new THREE.Vector3();
    if (keys.has("w") || keys.has("arrowup")) wish.add(forward);
    if (keys.has("s") || keys.has("arrowdown")) wish.sub(forward);
    if (keys.has("a") || keys.has("arrowleft")) wish.sub(rightV);
    if (keys.has("d") || keys.has("arrowright")) wish.add(rightV);
    if (wish.lengthSq()) wish.normalize().multiplyScalar(4.6);
    vel.lerp(wish, 1 - Math.pow(0.001, dt));
    camera.position.x = THREE.MathUtils.clamp(camera.position.x + vel.x * dt, -5.2, 5.2);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + vel.z * dt, -18, 14);
    camera.position.y = 1.55;
    camera.rotation.set(look.pitch, look.yaw, 0, "YXZ");
    renderer.render(scene, camera);
    const door = nearestDoor();
    return door ? door.spec : null;
  }

  function onKey(e, down) {
    keys[down ? "add" : "delete"](e.key.toLowerCase());
  }

  function onMouse(e) {
    if (!enabled) return;
    if (look.locked) {
      look.yaw -= e.movementX * 0.0022;
      look.pitch = THREE.MathUtils.clamp(look.pitch - e.movementY * 0.002, -0.9, 0.6);
    }
  }

  canvas.addEventListener("click", () => {
    if (enabled) canvas.requestPointerLock?.();
  });
  document.addEventListener("pointerlockchange", () => {
    look.locked = document.pointerLockElement === canvas;
  });
  window.addEventListener("mousemove", onMouse);
  window.addEventListener("keydown", (e) => onKey(e, true));
  window.addEventListener("keyup", (e) => onKey(e, false));
  window.addEventListener("resize", resize);
  resize();

  return {
    setDoors,
    tick,
    enable(v) {
      enabled = v;
      if (!v && document.pointerLockElement === canvas) document.exitPointerLock?.();
    },
    reset() {
      camera.position.set(0, 1.55, 8);
      look.yaw = 0;
      look.pitch = -0.08;
      vel.set(0, 0, 0);
    },
    enterNearest() {
      const d = nearestDoor();
      if (d) onEnterDoor(d.spec);
      return d;
    },
    glitchHue(t) {
      renderer.toneMappingExposure = 1.35 + Math.sin(t * 40) * 0.4;
    },
    calm() {
      renderer.toneMappingExposure = 1.35;
    },
  };
}
