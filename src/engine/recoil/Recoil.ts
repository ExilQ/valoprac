import type { WeaponProfile } from '../../config/weapons';
import type { SeededRandom } from '../simulation/random';
export class Recoil {
  pitch=0;yaw=0;cameraPitch=0;cameraYaw=0;compensationPitch=0;compensationYaw=0;
  kick(index:number,profile:WeaponProfile,rng:SeededRandom,crouch:number){
    const pattern=profile.recoil[index%profile.recoil.length];const scale=1+(profile.crouchRecoil-1)*crouch;
    const pitch=(pattern[0]+rng.range(-profile.randomness,profile.randomness)*0.35)*scale;
    const yaw=(pattern[1]+rng.range(-profile.randomness,profile.randomness))*scale;
    this.pitch+=pitch;this.yaw+=yaw;this.cameraPitch=this.pitch*profile.cameraScale;this.cameraYaw=this.yaw*profile.cameraScale;
  }
  recover(dt:number,profile:WeaponProfile,sinceShot:number){
    if(sinceShot<profile.recoveryDelay)return;
    const factor=Math.exp(-profile.recoilRecovery*dt);this.pitch*=factor;this.yaw*=factor;
    this.cameraPitch=this.pitch*profile.cameraScale;this.cameraYaw=this.yaw*profile.cameraScale;
  }
  // Consume compensated kick first. Recovery never writes to the user's base aim.
  compensate(pitchDelta:number,yawDelta:number,scale:number){
    this.compensationPitch+=pitchDelta;this.compensationYaw+=yawDelta;
    let rp=pitchDelta,ry=yawDelta;
    const cp=this.pitch*scale,cy=this.yaw*scale;
    if(cp*rp<0){const amount=Math.min(Math.abs(cp),Math.abs(rp))*Math.sign(rp);this.pitch+=amount/scale;rp-=amount;}
    if(cy*ry<0){const amount=Math.min(Math.abs(cy),Math.abs(ry))*Math.sign(ry);this.yaw+=amount/scale;ry-=amount;}
    this.cameraPitch=this.pitch*scale;this.cameraYaw=this.yaw*scale;
    return [rp,ry] as const;
  }
}
