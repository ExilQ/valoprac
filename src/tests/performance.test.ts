import { it,expect } from 'vitest';
import { Simulation } from '../engine/simulation/Simulation';
import { DEFAULT_SETTINGS } from '../config/settings';
import { emptyInput } from '../engine/types';
it('executes a ten-minute engine-only workload without invalid state (not a WebGL/FPS benchmark)',()=>{
  const s=new Simulation('tracking','rifleB',{...DEFAULT_SETTINGS,duration:600});s.running=true;const input={...emptyInput(),fire:true};
  const start=performance.now();for(let i=0;i<72000;i++){input.strafe=Math.floor(i/90)%2?1:-1;s.step(1/120,input);}const elapsed=performance.now()-start;
  expect(s.time).toBe(600);expect(s.completed).toBe(true);expect(Number.isFinite(s.movement.position.x)).toBe(true);expect(s.shots.length).toBeGreaterThan(3000);expect(s.shots.length).toBeLessThan(6600);
  console.info(JSON.stringify({benchmark:'engine-only',simulationSeconds:600,fixedTicks:72000,targets:s.targets.length,shots:s.shots.length,elapsedMilliseconds:Math.round(elapsed),ticksPerSecond:Math.round(72000/elapsed*1000),webglTested:false}));
});
