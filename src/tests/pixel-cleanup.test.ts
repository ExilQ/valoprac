import {describe,it,expect,vi} from 'vitest';
// Runs the official player against a minimal DOM adapter; this is listener lifecycle QA,
// not a browser video/WebRTC test.

describe('Official Pixel Streaming video element cleanup patch',()=>{
 it('removes window listeners and media elements over repeated construction/destruction',async()=>{
  vi.stubGlobal('location',{protocol:'https:',hostname:'valoprac.trade',port:''});
  const path='@epicgames-ps/lib-pixelstreamingfrontend-ue5.7/dist/esm/VideoPlayer/VideoPlayer.js';const {VideoPlayer}=await import(path);
  const listeners=new Set<unknown>(),elements:{srcObject:unknown;removed:boolean}[]=[];
  vi.stubGlobal('window',{addEventListener:(_t:string,fn:unknown)=>listeners.add(fn),removeEventListener:(_t:string,fn:unknown)=>listeners.delete(fn),clearTimeout:vi.fn()});
  vi.stubGlobal('document',{createElement:()=>{const element={style:{},srcObject:null,removed:false,remove(){this.removed=true;}};elements.push(element);return element;}});
  try{for(let i=0;i<20;i++){const player=new VideoPlayer({appendChild:()=>{}},{});expect(listeners.size).toBe(2);player.destroy();expect(listeners.size).toBe(0);}expect(elements).toHaveLength(20);expect(elements.every(x=>x.removed&&x.srcObject===null)).toBe(true);}finally{vi.unstubAllGlobals();}
 });
});
