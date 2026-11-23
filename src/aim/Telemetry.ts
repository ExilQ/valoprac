import {COLS} from './types';
export class MouseTelemetry {
 readonly data:Float64Array;count=0;overflow=0;reordered=0;last=-Infinity;
 constructor(readonly capacity=16384){this.data=new Float64Array(capacity*COLS);}
 clear(){this.count=0;this.overflow=0;this.reordered=0;this.last=-Infinity;}
 push(t:number,dx:number,dy:number,yaw:number,pitch:number,tx:number,ty:number,radius:number,kind:number,delay=0,deltaYaw=0,deltaPitch=0,px=0,py=1.64,pz=0,targetX=0,targetY=1.64,targetZ=-20,speed=0,recoil=0,ads=0){
  if(!Number.isFinite(t)||!Number.isFinite(dx)||!Number.isFinite(dy)||!Number.isFinite(yaw)||!Number.isFinite(pitch)||!Number.isFinite(tx)||!Number.isFinite(ty)||!Number.isFinite(radius))return;
  if(t<this.last){this.reordered++;t=this.last;}this.last=t;
  if(this.count===this.capacity){this.overflow++;return;}
  const i=this.count++*COLS,d=this.data;d[i]=t;d[i+1]=dx;d[i+2]=dy;d[i+3]=yaw;d[i+4]=pitch;d[i+5]=tx;d[i+6]=ty;d[i+7]=radius;d[i+8]=kind;d[i+9]=delay;d[i+10]=deltaYaw;d[i+11]=deltaPitch;d[i+12]=this.count;d[i+13]=px;d[i+14]=py;d[i+15]=pz;d[i+16]=targetX;d[i+17]=targetY;d[i+18]=targetZ;d[i+19]=speed;d[i+20]=recoil;d[i+21]=ads;
 }
 snapshot(){return this.data.slice(0,this.count*COLS);}
 get bytes(){return this.data.byteLength;}
}
