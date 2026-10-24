#pragma once
// Portable SI-unit gameplay core; UE owns collision sweeps and ray queries.
// Provisional calibration, intentionally independent of rendering and audio.
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>
namespace valoprac {
constexpr double Dt=1.0/120.0;
constexpr double Pi=3.14159265358979323846;
struct Vec {double x=0,y=0,z=0;};
inline double approach(double x,double y,double amount){return x+std::copysign(std::min(std::abs(y-x),amount),y-x);}
struct Random {
 uint32_t state;explicit Random(uint32_t seed=1):state(seed?seed:1){}
 double next(){uint32_t t=(state+=0x6d2b79f5u);t=(t^(t>>15))*(t|1u);t^=t+(t^(t>>7))*(t|61u);return double(t^(t>>14))/4294967296.0;}
 double range(double a,double b){return a+(b-a)*next();}
};
struct Input {double forward=0,strafe=0;bool walk=false,crouch=false,jump=false,fire=false,ads=false,reload=false;int presses=0;};
struct MovementTuning {double maxSpeed=5.4,groundAcceleration=38,groundDeceleration=20,friction=3.5,reverseAcceleration=45,lateralModifier=1,backwardModifier=.92,walkModifier=.48,crouchModifier=.36,airAcceleration=3.5,airMaxSpeed=5.4,jumpImpulse=5.2,gravity=18,accuracyVelocityThreshold=.65,standingEyeHeight=1.64,crouchingEyeHeight=1.12,radius=.28;};
struct Movement {MovementTuning config;
 Vec position{0,0,5},previous{0,0,5},velocity;double crouch=0,speed=0,landedAt=-100,modifier=1;bool grounded=true;
 bool accurate()const{return grounded&&speed<=config.accuracyVelocityThreshold;}
 void step(const Input& in,double yaw,double dt,double time){
  previous=position;crouch=approach(crouch,in.crouch?1:0,dt*8);
  double f=in.forward,s=in.strafe,len=std::hypot(f,s);if(len>1){f/=len;s/=len;}
  double dx=s*std::cos(yaw)-f*std::sin(yaw),dz=-f*std::cos(yaw)-s*std::sin(yaw);
  double target=config.maxSpeed*(in.walk?config.walkModifier:1)*(1+(config.crouchModifier-1)*crouch)*(f<0?config.backwardModifier:1)*(std::abs(s)>0?config.lateralModifier:1)*modifier;
  if(grounded){
   if(len>0){double acceleration=dx*velocity.x+dz*velocity.z<0?config.reverseAcceleration:config.groundAcceleration;double tx=dx*target-velocity.x,tz=dz*target-velocity.z,d=std::hypot(tx,tz),amount=std::min(d,acceleration*dt);if(d>1e-9){velocity.x+=tx/d*amount;velocity.z+=tz/d*amount;}}
   else {double v=std::hypot(velocity.x,velocity.z),next=std::max(0.0,v-(config.groundDeceleration+config.friction*v)*dt);if(v>0){velocity.x*=next/v;velocity.z*=next/v;}}
   if(in.jump){velocity.y=config.jumpImpulse;grounded=false;}
  }else if(len>0){double along=velocity.x*dx+velocity.z*dz,add=std::min(config.airAcceleration*dt,std::max(0.0,config.airMaxSpeed-along));velocity.x+=dx*add;velocity.z+=dz*add;double v=std::hypot(velocity.x,velocity.z);if(v>config.airMaxSpeed){velocity.x*=config.airMaxSpeed/v;velocity.z*=config.airMaxSpeed/v;}}
  if(!grounded)velocity.y-=config.gravity*dt;
  position.x+=velocity.x*dt;position.z+=velocity.z*dt;position.y+=velocity.y*dt;
  if(position.y<=0){if(!grounded)landedAt=time;position.y=0;velocity.y=0;grounded=true;}
  speed=std::hypot(velocity.x,velocity.z);
 }
};
struct DamageBand {double distance,head,body,leg;};
struct Profile {
 std::vector<DamageBand> damage;
 double damageAt(bool head,bool leg,double distance)const{for(const auto& d:damage)if(d.distance<0||distance<=d.distance)return head?d.head:leg?d.leg:d.body;return 0;}
 bool semi=false;double fireRate=9.75,adsFireRate=8.775,adsZoom=1.25,equipTime=1,reserve=75,magazine=25,reloadTime=2.5;
 double firstSpread=.25,movementSpread=3.5,airSpread=6.5,bloomPerShot=.13,maxBloom=1.25,bloomRecovery=2.3,resetTime=.38;
 double recoilRecovery=6.8,recoveryDelay=.18,cameraScale=1,randomness=.065,crouchSpread=.72,crouchRecoil=.8,adsSpread=.8,adsMoveModifier=.76;
 double yawSwitchTime=.6,yawSwitchChance=.1;int protectedBullets=6;
 std::vector<std::array<double,2>> pattern{{.2,0}};
};
struct Recoil {
 double pitch=0,yaw=0,compensationPitch=0,compensationYaw=0,nextSwitchAt=0;int direction=1,switches=0;
 void kick(int index,const Profile& p,Random& rng,double crouch,double time){
  if(index==0){direction=rng.next()<.5?-1:1;nextSwitchAt=time+p.yawSwitchTime;}
  if(index>=p.protectedBullets&&time+1e-9>=nextSwitchAt){if(rng.next()<p.yawSwitchChance){direction*=-1;switches++;}nextSwitchAt=time+p.yawSwitchTime;}
  auto a=p.pattern[std::min<size_t>(index,p.pattern.size()-1)];double scale=1+(p.crouchRecoil-1)*crouch;
  pitch+=(a[0]+rng.range(-p.randomness,p.randomness)*.35)*scale;
  yaw+=((index<p.protectedBullets?a[1]:std::abs(a[1])*direction)+rng.range(-p.randomness,p.randomness)*.3)*scale;
 }
 void recover(double dt,const Profile& p,double since){if(since<p.recoveryDelay)return;double f=std::exp(-p.recoilRecovery*dt);pitch*=f;yaw*=f;}
 std::array<double,2> compensate(double dp,double dy,double scale){
  compensationPitch+=dp;compensationYaw+=dy;
  if(pitch*scale*dp<0){double a=std::copysign(std::min(std::abs(pitch*scale),std::abs(dp)),dp);pitch+=a/scale;dp-=a;}
  if(yaw*scale*dy<0){double a=std::copysign(std::min(std::abs(yaw*scale),std::abs(dy)),dy);yaw+=a/scale;dy-=a;}
  return {dp,dy};
 }
};
struct Spread {double base=0,movement=0,bloom=0,air=0,total=0,x=0,y=0;};
struct Weapon {
 Profile p;int ammo=0,reserve=0,index=0,magazineShot=0;double reloadUntil=-1,reloadStarted=0,equipUntil=0,lastShot=-100,nextShot=0,bloom=0,firedAt=0,lastInterval=0;
 bool infinite=true,autoReload=true,ads=false,wasFire=false;Recoil recoil;Random spreadRng,recoilRng;
 explicit Weapon(Profile profile={},uint32_t seed=1947):p(profile),ammo(int(p.magazine)),reserve(int(p.reserve)),spreadRng(seed),recoilRng(seed^0xa91e){}
 bool reload(double time){if(reloadUntil<0&&time>=equipUntil&&ammo<p.magazine&&(infinite||reserve>0)){reloadStarted=time;reloadUntil=time+p.reloadTime;return true;}return false;}
 void equip(double time){reloadUntil=-1;equipUntil=time+p.equipTime;wasFire=true;ads=false;}
 template<class Fire> void step(double time,double dt,const Input& in,Fire&& fire){
  ads=in.ads&&p.adsZoom>1;bool pressed=in.presses>0||(in.fire&&!wasFire);wasFire=in.fire;
  if(in.reload)reload(time);
  if(reloadUntil>=0&&time+1e-9>=reloadUntil){int n=std::min(int(p.magazine)-ammo,infinite?int(p.magazine):reserve);ammo+=n;if(!infinite)reserve-=n;magazineShot=0;reloadUntil=-1;}
  bloom=std::max(0.0,bloom-p.bloomRecovery*dt);recoil.recover(dt,p,time-lastShot);if(time-lastShot>p.resetTime)index=0;
  double interval=1/(ads?p.adsFireRate:p.fireRate);if(lastInterval&&interval!=lastInterval)nextShot=firedAt+interval;lastInterval=interval;
  if(ammo==0&&autoReload)reload(time);
  bool wants=p.semi?pressed:(in.fire||pressed);
  if(wants&&reloadUntil<0&&time+1e-9>=equipUntil&&ammo>0&&time+1e-9>=nextShot){
   double due=nextShot;firedAt=time-due>Dt+1e-9||lastShot<0?time:due;nextShot=firedAt+interval;fire();lastShot=time;ammo--;index++;magazineShot++;bloom=std::min(p.maxBloom,bloom+p.bloomPerShot);
  }
 }
 Spread spread(const Movement& m,bool landing){Spread s;double c=1+(p.crouchSpread-1)*m.crouch,a=ads?p.adsSpread:1;s.base=p.firstSpread*c*a;double f=std::max(0.0,(m.speed-m.config.accuracyVelocityThreshold)/(m.config.maxSpeed-m.config.accuracyVelocityThreshold));s.movement=p.movementSpread*std::pow(std::min(1.5,f),1.3)*c*a;s.bloom=bloom*c*a;s.air=m.grounded?(landing?.35:0):p.airSpread;s.total=s.base+s.movement+s.bloom+s.air;double theta=spreadRng.next()*Pi*2,r=std::sqrt(spreadRng.next())*s.total;s.x=std::cos(theta)*r;s.y=std::sin(theta)*r;return s;}
};
struct Clock {double debt=0;template<class Step>void advance(double elapsed,Step&& step){debt+=std::max(0.0,elapsed);int n=0;while(debt+1e-12>=Dt&&n++<240){step(Dt);debt-=Dt;}}};
}
