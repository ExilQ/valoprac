import {describe,it,expect} from 'vitest';
import {InputLatencyProbe} from '../benchmarks/InputLatencyProbe';
describe('Bounded CPU latency proxy',()=>{
 it('measures queued event to render submission separately for mouse and click',()=>{const p=new InputLatencyProbe();p.mark('look',100,103);p.mark('click',102,104);p.submitted(108);const s=p.snapshot();expect(s.mouse.medianMs).toBe(8);expect(s.click.p95Ms).toBe(6);expect(s.inputToPhotonMs).toBeNull();});
 it('bounds storage and discards paused inputs',()=>{const p=new InputLatencyProbe();for(let i=0;i<10000;i++){p.mark('look',100+i,100+i);p.submitted(101+i);}expect(p.snapshot().mouse.samples).toBe(512);p.mark('click',5,5);p.clearPending();p.submitted(10);expect(p.snapshot().click.samples).toBe(0);});
 it('does not invent results when no actual input was recorded',()=>{const p=new InputLatencyProbe();expect(p.snapshot().mouse.p95Ms).toBeNull();expect(p.snapshot().click.p95Ms).toBeNull();});
});
