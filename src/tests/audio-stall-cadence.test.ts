import {describe,it,expect} from 'vitest';
import {FiringTimeline} from '../engine/audio/FiringTimeline';

describe('F8 bounded timestamp-aware firing playout',()=>{
  it('preserves the actual cadence of retained 11 Hz shots after a 200 ms stall',()=>{
    const clock=new FiringTimeline(),interval=1/11;
    expect(clock.schedule('player',0,0,0)?.startsAt).toBe(0);
    // The authoritative 0.0 shot already played; the 0.09/0.18 shots arrive
    // together after a real-time pause. Both are inside the 120 ms late window.
    const starts=[interval,2*interval].map(time=>clock.schedule('player',time,time,.2)!.startsAt);
    starts.push(clock.schedule('player',3*interval,3*interval,3*interval)!.startsAt);
    expect(starts[0]).toBeCloseTo(.212,8);
    for(let i=1;i<starts.length;i++)expect(starts[i]-starts[i-1]).toBeCloseTo(interval,8);
    expect(starts[2]-3*interval).toBeLessThan(.15);
  });
  it('keeps independently simultaneous opponents and resets repair after an idle gap',()=>{
    const clock=new FiringTimeline();
    expect(clock.schedule('left',.1,.1,.2)?.startsAt).toBeCloseTo(.212,8);
    expect(clock.schedule('right',.1,.1,.2)?.startsAt).toBeCloseTo(.212,8);
    expect(clock.schedule('left',.2,.2,.2)?.startsAt).toBeCloseTo(.312);
    expect(clock.schedule('left',1,1,1)?.startsAt).toBe(1);
  });
  it('does not introduce delay to timely future events or carry it across pause/retry',()=>{
    const clock=new FiringTimeline();
    expect(clock.schedule('player',.1,.1,0)?.startsAt).toBe(.1);
    expect(clock.schedule('player',.2,.2,0)?.startsAt).toBe(.2);
    clock.clear();expect(clock.schedule('player',.3,.3,.3)?.startsAt).toBe(.3);
  });
  it('rejects a timeline that would add more than 150 ms instead of building an unbounded queue',()=>{
    const clock=new FiringTimeline();
    clock.schedule('player',0,.2,0);
    expect(clock.schedule('player',.1,0,0)).toBeNull();
  });
});
