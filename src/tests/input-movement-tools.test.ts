import {afterEach,describe,expect,it,vi} from 'vitest';
import {BrowserInput} from '../engine/input/Input';
import {Simulation} from '../engine/simulation/Simulation';
import {DEFAULT_SETTINGS} from '../config/settings';

class Surface extends EventTarget{}
class DocumentMock extends Surface {pointerLockElement:unknown=null;fullscreenElement:unknown=null;hidden=false;exitPointerLock(){this.pointerLockElement=null;this.dispatchEvent(new Event('pointerlockchange'));}}
function key(code:string,repeat=false,type='keydown'){const event=new Event(type,{cancelable:true});Object.defineProperties(event,{code:{value:code},repeat:{value:repeat}});return event;}
function setup(enabled=true){
 const doc=new DocumentMock(),win=new Surface(),canvas=new Surface();vi.stubGlobal('document',doc);vi.stubGlobal('window',win);vi.stubGlobal('navigator',{});
 const settings=structuredClone(DEFAULT_SETTINGS);settings.movementTools.enabled=enabled;const sim=new Simulation('free','rifleA',settings),action=vi.fn();sim.running=true;
 const input=new BrowserInput(canvas as HTMLCanvasElement,sim,vi.fn(),vi.fn(),vi.fn(),vi.fn(),action);doc.pointerLockElement=canvas;return{doc,sim,input,action};
}
afterEach(()=>vi.unstubAllGlobals());
describe('Movement practice bindings preserve normal browser input contracts',()=>{
 it('releases Pointer Lock and buffered movement on Escape without relying on browser defaults',()=>{
  const {doc,input,action}=setup();doc.dispatchEvent(key('KeyW'));doc.dispatchEvent(key('Space'));doc.dispatchEvent(key('Escape'));
  expect(doc.pointerLockElement).toBeNull();expect(input.state.forward).toBe(0);expect(input.state.jump).toBe(false);expect(input.movementCommands.snapshot().queued).toBe(0);
  doc.dispatchEvent(key('KeyL'));expect(action).not.toHaveBeenCalled();input.dispose();
 });
 it('dispatches one explicit action per press, preserving held movement on save',()=>{
  const {doc,sim,input,action}=setup();doc.dispatchEvent(key('KeyW'));const save=key(sim.settings.movementTools.bindings.save);doc.dispatchEvent(save);doc.dispatchEvent(key(sim.settings.movementTools.bindings.save,true));doc.dispatchEvent(key(sim.settings.movementTools.bindings.save));
  expect(save.defaultPrevented).toBe(true);expect(action).toHaveBeenCalledOnce();expect(action).toHaveBeenCalledWith({kind:'movement-save'});expect(input.state.forward).toBe(1);
  doc.dispatchEvent(key(sim.settings.movementTools.bindings.save,false,'keyup'));doc.dispatchEvent(key(sim.settings.movementTools.bindings.save));expect(action).toHaveBeenCalledTimes(2);input.dispose();
 });
 it('does not consume disabled, conflicting, repeated or unlocked tool shortcuts',()=>{
  const {doc,sim,input,action}=setup(false);const disabled=key('KeyK');doc.dispatchEvent(disabled);expect(disabled.defaultPrevented).toBe(false);expect(action).not.toHaveBeenCalled();
  sim.settings.movementTools.enabled=true;sim.settings.movementTools.bindings.save='KeyW';doc.dispatchEvent(key('KeyW'));expect(input.state.forward).toBe(1);expect(action).not.toHaveBeenCalled();
  doc.pointerLockElement=null;doc.dispatchEvent(key('KeyL'));expect(action).not.toHaveBeenCalled();input.dispose();
 });
});
