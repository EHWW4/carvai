/*
 * © 2025 Edward Hirth WoodWorks. All Rights Reserved. Patent Pending.
 * PROPRIETARY — 3D CNC Rendering Engine
 * Inventor: Edward Hirth
 */
'use strict';

const Engine = (() => {
  let scene, camera, renderer, mesh, edges, grid, lights = [];
  let phi = 0.42, theta = 0.68, radius = 9;
  let dragging = false, lastMouse = {x:0,y:0};
  let canvas, animId;

  const MAT_PROPS = {
    Oak:       { color:0xC8874A, roughness:.72, metalness:.01 },
    Walnut:    { color:0x5C3A1A, roughness:.78, metalness:.01 },
    Maple:     { color:0xE8C870, roughness:.65, metalness:.01 },
    Cherry:    { color:0x8B3A2A, roughness:.74, metalness:.01 },
    Pine:      { color:0xE8C87A, roughness:.60, metalness:.01 },
    Mahogany:  { color:0x6B2A1A, roughness:.76, metalness:.01 },
    MDF:       { color:0xC8A878, roughness:.90, metalness:.00 },
    Plywood:   { color:0xD4B864, roughness:.80, metalness:.00 },
    'HDU Foam':{ color:0xE0E0D8, roughness:.95, metalness:.00 },
    Aluminum:  { color:0x9AA8B8, roughness:.30, metalness:.85 },
    Acrylic:   { color:0xA8C8E8, roughness:.10, metalness:.00, transparent:true, opacity:.7 },
    Brass:     { color:0xB8962A, roughness:.25, metalness:.90 },
  };

  function init(canvasEl) {
    canvas = canvasEl;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight - 90;
    canvas.width = W; canvas.height = H;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060A06);
    scene.fog = new THREE.FogExp2(0x060A06, 0.035);

    // Camera
    camera = new THREE.PerspectiveCamera(42, W/H, 0.05, 200);
    positionCamera();

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    // Lighting rig
    const ambient = new THREE.AmbientLight(0xfff8f0, 0.38);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff8ec, 1.3);
    sun.position.set(6, 12, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.001;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88B8FF, 0.28);
    fill.position.set(-8, 4, -6);
    scene.add(fill);

    const rim = new THREE.PointLight(0xFFD080, 0.6, 30);
    rim.position.set(0, 10, -8);
    scene.add(rim);

    const under = new THREE.PointLight(0x204830, 0.4, 20);
    under.position.set(0, -4, 0);
    scene.add(under);

    lights = [sun, fill, rim, under];

    // Ground grid
    grid = new THREE.GridHelper(30, 30, 0x1A2820, 0x121C14);
    grid.position.y = -0.02;
    scene.add(grid);

    // Ground plane (for shadows)
    const groundGeo = new THREE.PlaneGeometry(30, 30);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Controls
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('mouseup', () => { dragging = false; });
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('wheel', onWheel, { passive:true });

    // Touch
    let lastTouches = null;
    canvas.addEventListener('touchstart', e => { lastTouches = e.touches; });
    canvas.addEventListener('touchmove', e => {
      if (!lastTouches) return;
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - lastTouches[0].clientX;
        const dy = e.touches[0].clientY - lastTouches[0].clientY;
        theta -= dx * 0.012;
        phi = Math.max(0.05, Math.min(Math.PI/2 - 0.03, phi + dy * 0.012));
        positionCamera();
      } else if (e.touches.length === 2) {
        const d0 = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY);
        const d1 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        radius = Math.max(1.5, Math.min(25, radius * (d0/d1)));
        positionCamera();
      }
      lastTouches = e.touches;
      e.preventDefault();
    }, { passive:false });

    window.addEventListener('resize', onResize);
    animate();
    return Engine;
  }

  function onMouseDown(e) {
    dragging = true;
    lastMouse = { x:e.clientX, y:e.clientY };
  }
  function onMouseMove(e) {
    if (!dragging) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    if (e.buttons === 1) {
      theta -= dx * 0.007;
      phi = Math.max(0.05, Math.min(Math.PI/2 - 0.03, phi + dy * 0.007));
    } else if (e.buttons === 2) {
      // Pan
      const right = new THREE.Vector3(-Math.cos(theta), 0, Math.sin(theta));
      const up = new THREE.Vector3(0, 1, 0);
      scene.position.addScaledVector(right, dx * 0.01);
      scene.position.addScaledVector(up, -dy * 0.01);
    }
    lastMouse = { x:e.clientX, y:e.clientY };
    positionCamera();
  }
  function onWheel(e) {
    radius = Math.max(1.5, Math.min(25, radius + e.deltaY * 0.012));
    positionCamera();
  }
  function onResize() {
    if (!canvas) return;
    const W = canvas.parentElement.clientWidth;
    const H = canvas.parentElement.clientHeight - 90;
    camera.aspect = W/H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }

  function positionCamera() {
    camera.position.set(
      radius * Math.sin(theta) * Math.cos(phi),
      radius * Math.sin(phi) + 0.5,
      radius * Math.cos(theta) * Math.cos(phi)
    );
    camera.lookAt(0, 0.3, 0);
  }

  function animate() {
    animId = requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }

  // ── BUILD MODEL ──
  function build(state) {
    // Remove old mesh + edges
    if (mesh) { scene.remove(mesh); mesh.geometry?.dispose(); mesh.material?.dispose(); }
    if (edges) { scene.remove(edges); edges.geometry?.dispose(); }

    const { w, h, t, tool, profile, material, wireframe,
            profileDepth, profileWidth, cutDepth, reliefH } = state;

    const geo = buildGeo(tool, w, h, t, profile, profileDepth, profileWidth, reliefH);
    const props = MAT_PROPS[material] || MAT_PROPS.Oak;

    const mat = new THREE.MeshStandardMaterial({
      color: props.color,
      roughness: props.roughness,
      metalness: props.metalness,
      wireframe: wireframe,
      transparent: props.transparent || false,
      opacity: props.opacity !== undefined ? props.opacity : 1,
    });

    mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = 0;
    scene.add(mesh);

    // Edge highlight (non-wireframe)
    if (!wireframe) {
      const edgesGeo = new THREE.EdgesGeometry(geo, 18);
      const edgesMat = new THREE.LineBasicMaterial({ color: 0x34A85A, transparent:true, opacity:.25 });
      edges = new THREE.LineSegments(edgesGeo, edgesMat);
      edges.position.copy(mesh.position);
      scene.add(edges);
    }

    return {
      polys: geo.index ? geo.index.count/3 : geo.attributes.position.count/3,
      verts: geo.attributes.position.count
    };
  }

  function buildGeo(tool, w, h, t, profile, pd, pw, relief) {
    switch(tool) {
      case 'circle':   return buildLathe(w/2, t, profile, pd, pw);
      case 'oval':     return buildOval(w/2, h/2, t, profile, pd);
      case 'rect':     return buildRect(w, h, t, profile, pd);
      case 'star':     return buildStar(w/2, t, 5, profile, pd);
      case 'hex':      return buildPoly(w/2, t, 6, profile, pd);
      case 'octagon':  return buildPoly(w/2, t, 8, profile, pd);
      case 'diamond':  return buildPoly(w/2, t, 4, profile, pd);
      case 'arrow':    return buildArrow(w, h, t, pd);
      case 'cross':    return buildCross(w, t, pd);
      case 'text':     return buildRect(w, h*.4, t, profile, pd); // placeholder
      default:         return buildLathe(w/2, t, profile, pd, pw);
    }
  }

  function buildLathe(r, h, profile, pd, pw) {
    const pts = [];
    const N = 32;
    const bevel = r * pw * 0.38;
    const phd = h * pd;
    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(r * 0.97, 0));

    switch(profile) {
      case 'chamfer':
        pts.push(new THREE.Vector2(r, h - phd));
        pts.push(new THREE.Vector2(r - bevel, h));
        break;
      case 'roundover':
        for (let i=0; i<=N; i++) {
          const a = (i/N) * Math.PI/2;
          pts.push(new THREE.Vector2(r - bevel + bevel*Math.sin(a), (h-phd) + phd*(1-Math.cos(a))));
        }
        break;
      case 'cove':
        for (let i=0; i<=N; i++) {
          const a = (i/N) * Math.PI/2;
          pts.push(new THREE.Vector2(r - bevel*(1-Math.cos(a)), (h-phd) + phd*Math.sin(a)));
        }
        break;
      case 'ogee':
        for (let i=0; i<=N; i++) {
          const t2 = i/N, a = t2*Math.PI;
          pts.push(new THREE.Vector2(r - bevel*0.5*(1-Math.cos(a*0.5)), (h-phd)+phd*t2));
        }
        break;
      case 'vcarve':
        pts.push(new THREE.Vector2(r, h*0.5));
        pts.push(new THREE.Vector2(r - bevel, h));
        break;
      case 'bead':
        for (let i=0; i<=N; i++) {
          const a = (i/N)*Math.PI;
          pts.push(new THREE.Vector2(r - bevel*0.5 + bevel*0.5*Math.cos(a+Math.PI), (h-phd)+phd*(i/N)));
        }
        break;
      case 'bullnose':
        for (let i=0; i<=N; i++) {
          const a = (i/N)*Math.PI;
          pts.push(new THREE.Vector2(r + bevel*0.5*Math.cos(a+Math.PI), (h-phd)+phd*(i/N)));
        }
        break;
      case 'fillet':
        for (let i=0; i<=N; i++) {
          const a = (i/N)*Math.PI*0.5;
          pts.push(new THREE.Vector2(r - bevel*(1-Math.cos(a)), (h-phd)+phd*Math.sin(a)));
        }
        break;
      default: // flat
        pts.push(new THREE.Vector2(r, h));
        break;
    }
    pts.push(new THREE.Vector2(0, h));
    return new THREE.LatheGeometry(pts, 128);
  }

  function buildRect(w, h, t, profile, pd) {
    const shape = new THREE.Shape();
    const r = Math.min(w,h)*0.025;
    shape.moveTo(-w/2+r, -h/2);
    shape.lineTo(w/2-r, -h/2);
    shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    shape.lineTo(w/2, h/2-r);
    shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
    shape.lineTo(-w/2+r, h/2);
    shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
    shape.lineTo(-w/2, -h/2+r);
    shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);

    const bv = Math.min(w,h)*pd*0.12;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: t,
      bevelEnabled: profile !== 'flat',
      bevelThickness: profile === 'chamfer' ? bv : bv*0.5,
      bevelSize: bv,
      bevelOffset: 0,
      bevelSegments: ['roundover','bullnose','ogee'].includes(profile) ? 8 : 3,
    });
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  function buildOval(rx, ry, t, profile, pd) {
    const pts = [];
    for (let i=0; i<=64; i++) {
      const a = (i/64)*Math.PI*2;
      pts.push(new THREE.Vector2(rx*Math.cos(a), ry*Math.sin(a)));
    }
    const shape = new THREE.Shape(pts);
    const bv = Math.min(rx,ry)*pd*0.15;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth:t, bevelEnabled:profile!=='flat',
      bevelThickness:bv*0.5, bevelSize:bv, bevelSegments:6
    });
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  function buildStar(r, t, points, profile, pd) {
    const pts = [];
    for (let i=0; i<points*2; i++) {
      const a = (i*Math.PI)/points - Math.PI/2;
      const ri = i%2===0 ? r : r*0.42;
      pts.push(new THREE.Vector2(ri*Math.cos(a), ri*Math.sin(a)));
    }
    const shape = new THREE.Shape(pts);
    const bv = r*pd*0.06;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth:t, bevelEnabled:profile!=='flat',
      bevelThickness:bv, bevelSize:bv, bevelSegments:3
    });
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  function buildPoly(r, t, sides, profile, pd) {
    const pts = [];
    for (let i=0; i<sides; i++) {
      const a = (i/sides)*Math.PI*2 - Math.PI/sides;
      pts.push(new THREE.Vector2(r*Math.cos(a), r*Math.sin(a)));
    }
    const shape = new THREE.Shape(pts);
    shape.closePath();
    const bv = r*pd*0.08;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth:t, bevelEnabled:profile!=='flat',
      bevelThickness:bv, bevelSize:bv,
      bevelSegments:['roundover','bullnose'].includes(profile)?6:2
    });
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  function buildArrow(w, h, t, pd) {
    const shape = new THREE.Shape();
    const hw = w/2, hh = h/2;
    shape.moveTo(0, hh);
    shape.lineTo(hw, 0);
    shape.lineTo(hw*0.5, 0);
    shape.lineTo(hw*0.5, -hh);
    shape.lineTo(-hw*0.5, -hh);
    shape.lineTo(-hw*0.5, 0);
    shape.lineTo(-hw, 0);
    shape.closePath();
    const bv = Math.min(w,h)*pd*0.06;
    const geo = new THREE.ExtrudeGeometry(shape, {depth:t, bevelEnabled:true, bevelThickness:bv, bevelSize:bv, bevelSegments:2});
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  function buildCross(w, t, pd) {
    const shape = new THREE.Shape();
    const a = w/2, b = w/6;
    shape.moveTo(-b,-a); shape.lineTo(b,-a); shape.lineTo(b,-b);
    shape.lineTo(a,-b); shape.lineTo(a,b); shape.lineTo(b,b);
    shape.lineTo(b,a); shape.lineTo(-b,a); shape.lineTo(-b,b);
    shape.lineTo(-a,b); shape.lineTo(-a,-b); shape.lineTo(-b,-b);
    shape.closePath();
    const bv = w*pd*0.04;
    const geo = new THREE.ExtrudeGeometry(shape, {depth:t, bevelEnabled:true, bevelThickness:bv, bevelSize:bv, bevelSegments:2});
    geo.rotateX(-Math.PI/2);
    return geo;
  }

  // ── GCODE PREVIEW ──
  function showToolpath(state) {
    // Draw simulated toolpath lines over the model
    const { w, h, t, tool } = state;
    clearToolpath();
    const mat = new THREE.LineBasicMaterial({ color:0xFFAA00, transparent:true, opacity:.7 });
    const r = Math.min(w,h)/2;
    const passes = 8;
    const group = new THREE.Group();
    group.name = 'toolpath';
    for (let p=0; p<passes; p++) {
      const pr = r*(p/passes);
      const pts2 = [];
      for (let i=0; i<=64; i++) {
        const a = (i/64)*Math.PI*2;
        pts2.push(new THREE.Vector3(pr*Math.cos(a), t+0.02, pr*Math.sin(a)));
      }
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), mat));
    }
    scene.add(group);
    return group;
  }

  function clearToolpath() {
    const old = scene.getObjectByName('toolpath');
    if (old) scene.remove(old);
  }

  // ── CAMERA VIEWS ──
  function setView(view) {
    const views = {
      perspective: { theta:0.68, phi:0.42, r:9 },
      top:         { theta:0,    phi:1.55, r:10 },
      front:       { theta:0,    phi:0.04, r:9 },
      side:        { theta:1.57, phi:0.04, r:9 },
      isometric:   { theta:0.79, phi:0.62, r:10 },
    };
    const v = views[view] || views.perspective;
    theta = v.theta; phi = v.phi; radius = v.r;
    positionCamera();
  }

  function resetCamera() { setView('perspective'); scene.position.set(0,0,0); }

  function zoomFit(w, h) {
    radius = Math.max(w, h) * 0.9;
    positionCamera();
  }

  function toggleGrid(show) {
    if (grid) grid.visible = show;
  }

  function setWireframe(on) {
    if (mesh) mesh.material.wireframe = on;
  }

  function getMeshStats() {
    if (!mesh) return { polys:0, verts:0 };
    const g = mesh.geometry;
    return {
      polys: g.index ? Math.floor(g.index.count/3) : Math.floor(g.attributes.position.count/3),
      verts: g.attributes.position.count
    };
  }

  // ── STL EXPORT ──
  function exportSTL(state) {
    if (!mesh) return null;
    const geo = mesh.geometry.clone();
    const pos = geo.attributes.position;
    const idx = geo.index;
    const triCount = idx ? idx.count/3 : pos.count/3;
    const { w, h, t, material, profile, tool } = state;
    const yr = new Date().getFullYear();

    let stl = `solid EHW_${tool}_Design\n`;
    stl += `; =====================================================\n`;
    stl += `; © ${yr} Edward Hirth WoodWorks. All Rights Reserved.\n`;
    stl += `; Patent Pending. PROPRIETARY SOFTWARE.\n`;
    stl += `; Inventor: Edward Hirth\n`;
    stl += `; AI-Assisted Development — Human-Invented & Human-Owned\n`;
    stl += `; Software: Edward Hirth WoodWorks CNC Design Studio Pro\n`;
    stl += `; Design: ${tool} | ${w}"×${h}"×${t}" | ${material} | ${profile}\n`;
    stl += `; =====================================================\n\n`;

    for (let i = 0; i < triCount; i++) {
      const ai = idx ? idx.getX(i*3)   : i*3;
      const bi = idx ? idx.getX(i*3+1) : i*3+1;
      const ci = idx ? idx.getX(i*3+2) : i*3+2;
      const ax=pos.getX(ai), ay=pos.getY(ai), az=pos.getZ(ai);
      const bx=pos.getX(bi), by=pos.getY(bi), bz=pos.getZ(bi);
      const cx=pos.getX(ci), cy=pos.getY(ci), cz=pos.getZ(ci);
      const ux=bx-ax,uy=by-ay,uz=bz-az;
      const vx=cx-ax,vy=cy-ay,vz=cz-az;
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
      stl += `  facet normal ${(nx/nl).toFixed(6)} ${(ny/nl).toFixed(6)} ${(nz/nl).toFixed(6)}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${ax.toFixed(6)} ${ay.toFixed(6)} ${az.toFixed(6)}\n`;
      stl += `      vertex ${bx.toFixed(6)} ${by.toFixed(6)} ${bz.toFixed(6)}\n`;
      stl += `      vertex ${cx.toFixed(6)} ${cy.toFixed(6)} ${cz.toFixed(6)}\n`;
      stl += `    endloop\n  endfacet\n`;
    }
    stl += `endsolid EHW_${tool}_Design\n`;
    return stl;
  }

  function exportGCode(state) {
    const { w, h, t, material, profile, tool } = state;
    const feed = 100, rpm = 18000, pass = 0.125, passes = Math.ceil(t/pass);
    const yr = new Date().getFullYear();
    let gc = `; =====================================================\n`;
    gc += `; © ${yr} Edward Hirth WoodWorks. All Rights Reserved.\n`;
    gc += `; Patent Pending. PROPRIETARY.\n`;
    gc += `; Inventor: Edward Hirth\n`;
    gc += `; Design: ${tool} | ${w}"×${h}"×${t}" | ${material} | ${profile}\n`;
    gc += `; =====================================================\n\n`;
    gc += `G21 G90 G17\n`;
    gc += `G0 Z5.0 (Safe height)\n`;
    gc += `G0 X0 Y0\n`;
    gc += `M3 S${rpm} (Spindle on)\n`;
    gc += `F${feed}\n\n`;
    gc += `; --- Perimeter passes (${passes} depth passes) ---\n`;
    const r = Math.min(w,h)/2*25.4; // convert to mm
    for (let p=1; p<=passes; p++) {
      const z = -(p*pass*25.4);
      gc += `; Pass ${p} of ${passes}\n`;
      gc += `G0 Z2.0\nG0 X${r.toFixed(3)} Y0\n`;
      gc += `G1 Z${z.toFixed(3)}\n`;
      gc += `G2 X${r.toFixed(3)} Y0 I${(-r).toFixed(3)} J0 (Full circle)\n`;
    }
    gc += `\nG0 Z5.0\nG0 X0 Y0\nM5 (Spindle off)\nM30 (End)\n`;
    return gc;
  }

  return { init, build, setView, resetCamera, zoomFit, toggleGrid, setWireframe,
           getMeshStats, exportSTL, exportGCode, showToolpath, clearToolpath, positionCamera };
})();

window.Engine = Engine;
