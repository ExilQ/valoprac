// Generated from src/config; run npm run export:unreal. Do not edit.
#pragma once
#include "SimulationCore.h"
namespace valoprac {
inline Profile profile(int id){Profile p;switch(id){
case 0:
p.semi=false;
p.fireRate=9.75;
p.adsFireRate=8.775;
p.adsZoom=1.25;
p.equipTime=1;
p.reserve=75;
p.magazine=25;
p.reloadTime=2.5;
p.firstSpread=0.25;
p.movementSpread=3.5;
p.airSpread=6.5;
p.bloomPerShot=0.13;
p.maxBloom=1.25;
p.bloomRecovery=2.3;
p.resetTime=0.38;
p.recoilRecovery=6.8;
p.recoveryDelay=0.18;
p.cameraScale=1;
p.randomness=0.065;
p.crouchSpread=0.72;
p.crouchRecoil=0.8;
p.adsSpread=0.8;
p.adsMoveModifier=0.76;
p.yawSwitchTime=0.6;
p.yawSwitchChance=0.1;
p.protectedBullets=6;
p.damage={{-1,160,40,34}};
p.pattern={{0.2,0},{0.4,0.025},{0.57,-0.035},{0.69,0.045},{0.78,0.065},{0.78,0.04},{0.69,0.18},{0.59,0.27},{0.47,0.37},{0.37,0.43},{0.28,0.48},{0.2,0.45},{0.14,0.4},{0.08,0.43},{0.04,0.48},{0.03,0.5},{0.02,0.5},{0.01,0.48},{0.01,0.46}};
break;
case 1:
p.semi=false;
p.fireRate=11;
p.adsFireRate=9.9;
p.adsZoom=1.25;
p.equipTime=1;
p.reserve=90;
p.magazine=30;
p.reloadTime=2.5;
p.firstSpread=0.2;
p.movementSpread=3.2;
p.airSpread=6;
p.bloomPerShot=0.105;
p.maxBloom=1.1;
p.bloomRecovery=2.5;
p.resetTime=0.35;
p.recoilRecovery=7.2;
p.recoveryDelay=0.16;
p.cameraScale=1;
p.randomness=0.055;
p.crouchSpread=0.68;
p.crouchRecoil=0.78;
p.adsSpread=0.78;
p.adsMoveModifier=0.76;
p.yawSwitchTime=0.6;
p.yawSwitchChance=0.1;
p.protectedBullets=8;
p.damage={{20,156,39,33.15},{-1,140,35,29.75}};
p.pattern={{0.14,0},{0.3,-0.025},{0.41,0.025},{0.49,0.03},{0.57,-0.03},{0.59,0.04},{0.56,0.08},{0.5,0.1},{0.42,0.21},{0.34,0.3},{0.26,0.34},{0.19,0.36},{0.12,0.34},{0.07,0.36},{0.03,0.38},{0.02,0.4},{0.01,0.39},{0.01,0.38}};
break;
case 2:
p.semi=true;
p.fireRate=4;
p.adsFireRate=4;
p.adsZoom=1;
p.equipTime=1;
p.reserve=24;
p.magazine=6;
p.reloadTime=2.25;
p.firstSpread=0.25;
p.movementSpread=5.2;
p.airSpread=8;
p.bloomPerShot=0.9;
p.maxBloom=3.2;
p.bloomRecovery=2.4;
p.resetTime=0.55;
p.recoilRecovery=5.7;
p.recoveryDelay=0.25;
p.cameraScale=1;
p.randomness=0.025;
p.crouchSpread=0.75;
p.crouchRecoil=0.9;
p.adsSpread=1;
p.adsMoveModifier=1;
p.yawSwitchTime=0.6;
p.yawSwitchChance=0;
p.protectedBullets=6;
p.damage={{30,159.5,55,46.75},{-1,145,50,42.5}};
p.pattern={{1.8,0.08},{1.95,-0.04},{2.05,0.06},{2.1,0.1},{2.15,-0.06},{2.2,0.08}};
break;
default:break;}return p;}
inline MovementTuning movementProfile(){MovementTuning p;
p.maxSpeed=5.4;
p.groundAcceleration=38;
p.groundDeceleration=20;
p.friction=3.5;
p.reverseAcceleration=45;
p.lateralModifier=1;
p.backwardModifier=0.92;
p.walkModifier=0.48;
p.crouchModifier=0.36;
p.airAcceleration=3.5;
p.airMaxSpeed=5.4;
p.jumpImpulse=5.2;
p.gravity=18;
p.accuracyVelocityThreshold=0.65;
p.standingEyeHeight=1.64;
p.crouchingEyeHeight=1.12;
p.radius=0.28;
return p;}
}
