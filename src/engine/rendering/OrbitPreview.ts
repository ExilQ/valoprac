import { ACESFilmicToneMapping, PerspectiveCamera, Raycaster, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, type Scene, type Object3D } from 'three';

export function createOrbitPreview(host: HTMLElement, scene: Scene, label: string, target: Vector3, distance: number, onPick?: (ray: Raycaster) => void) {
  const renderer = new WebGLRenderer({ antialias:true, alpha:false, powerPreference:'low-power' });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', label);
  const camera = new PerspectiveCamera(45, 1, .02, distance * 20);
  const orbit = { target:target.clone(), dist:distance, yaw:.7, pitch:.8 };
  const minimumDistance=Math.min(distance*.18,6);
  const pointer = new Vector2();
  const ray = new Raycaster();
  let frame = 0;
  let drag:{id:number;x:number;y:number;distance:number}|null = null;

  /*! openVaim v1.4.3 orbit calculation, Copyright (c) 2026 unkwsr. MIT notice: /licenses/openVaim-MIT.txt */
  const paint = () => {
    frame = 0;
    const { target, dist, yaw, pitch } = orbit;
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
  };
  const draw = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const resize = () => {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    draw();
  };
  const turn = (dx:number, dy:number) => {
    orbit.yaw -= dx * .006;
    orbit.pitch = Math.max(Math.PI * 8 / 180, Math.min(Math.PI * 88 / 180, orbit.pitch + dy * .006));
    draw();
  };
  const zoom = (factor:number) => {
    orbit.dist = Math.max(minimumDistance, Math.min(distance * 2.5, orbit.dist * factor));
    draw();
  };
  const start = (event:PointerEvent) => {
    if (drag || event.button !== 0) return;
    drag = {id:event.pointerId,x:event.clientX,y:event.clientY,distance:0};
    canvas.setPointerCapture(event.pointerId);
  };
  const move = (event:PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.distance += Math.hypot(dx,dy);
    drag.x=event.clientX;
    drag.y=event.clientY;
    if (drag.distance >= 5) turn(dx,dy);
  };
  const cancel = () => { drag = null; };
  const end = (event:PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return;
    const click = drag.distance < 5;
    cancel();
    if (!click || !onPick) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
    ray.setFromCamera(pointer,camera);
    onPick(ray);
  };
  canvas.addEventListener('pointerdown',start);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',end);
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
  host.appendChild(canvas);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  return {
    renderer, draw, turn, zoom,
    focus(point:Vector3, nextDistance:number) { orbit.target.copy(point); orbit.dist=Math.max(minimumDistance,nextDistance); draw(); },
    reset() { orbit.target.copy(target); orbit.dist=distance; orbit.yaw=.7; orbit.pitch=.8; draw(); },
    dispose() {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

export function disposePreviewGeometry(scene: Object3D) {
  scene.traverse(object => {
    const geometry = (object as Object3D & { geometry?:{dispose:()=>void} }).geometry;
    geometry?.dispose();
  });
}
