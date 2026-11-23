import {MOVEMENT} from '../../config/movement';
// Same SI acceleration/reversal as the player. Pattern complexity never increases the speed cap.
export function approachVelocity(current:number,desired:number,dt:number){const a=current*desired<0?MOVEMENT.reverseAcceleration:desired===0?MOVEMENT.groundDeceleration+MOVEMENT.friction*Math.abs(current):MOVEMENT.groundAcceleration;return current+Math.sign(desired-current)*Math.min(Math.abs(desired-current),a*dt);}
export const BOT_DIFFICULTY={easy:{reaction:.4,complexity:.25,reposition:.15},normal:{reaction:.25,complexity:.6,reposition:.4},hard:{reaction:.16,complexity:1,reposition:.7}};
