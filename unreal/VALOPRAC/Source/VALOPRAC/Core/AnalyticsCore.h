#pragma once
// Authoritative, bounded analytics. No Unreal types and no allocation in fixed-step sampling.
#include "SimulationCore.h"
#include <optional>
#include <sstream>
#include <locale>
#include <iomanip>
#include <string>
namespace valoprac {
struct Moment {
 uint64_t n=0;double sum=0,squares=0;
 void add(double value){n++;sum+=value;squares+=value*value;}
 Moment with(const std::optional<double>& value)const{auto result=*this;if(value)result.add(*value);return result;}
};
struct Braking {
 std::optional<double> release,threshold,stop,initial;double initialX=0,initialZ=0,previousX=0,previousZ=0;int kind=0;bool active=false,shotRecorded=false;
 void update(const Input& input,double yaw,const Movement& m,double time){
  double x=input.strafe*std::cos(yaw)-input.forward*std::sin(yaw),z=-input.forward*std::cos(yaw)-input.strafe*std::sin(yaw);
  bool had=previousX!=0||previousZ!=0,neutral=input.strafe==0&&input.forward==0,reversed=input.strafe*previousX+input.forward*previousZ<0;
  if(m.grounded&&had&&(neutral||reversed)&&m.speed>m.config.accuracyVelocityThreshold){release=time;threshold.reset();stop.reset();initial=m.speed;initialX=m.velocity.x;initialZ=m.velocity.z;kind=reversed?2:1;active=true;shotRecorded=false;}
  if(active&&!threshold&&!neutral&&x*m.velocity.x+z*m.velocity.z<0)kind=2;
  if(active&&!threshold&&m.accurate())threshold=time;
  if(active&&release&&time-*release>1.5)active=false;
  previousX=input.strafe;previousZ=input.forward;
 }
 void observe(const Movement& m,double time){if(!active)return;if(!threshold&&m.accurate())threshold=time;if(!stop&&(m.speed<.02||m.velocity.x*initialX+m.velocity.z*initialZ<=0))stop=time;}
 std::optional<double> duration()const{return threshold&&release?std::optional<double>(*threshold-*release):std::nullopt;}
 std::optional<double> fullDuration()const{return stop&&release?std::optional<double>(*stop-*release):std::nullopt;}
};
struct Shot {
 double timestamp=0,damage=0,aimPitch=0,aimYaw=0,recoilPitch=0,recoilYaw=0,compensationPitch=0,compensationYaw=0;
 int weapon=0,index=0,magazineShot=0,hit=5,targetId=-1,generation=-1,behavior=0,accuracyState=0,horizontalDirection=1;
 bool first=false,accurate=true,ads=false;Vec position,velocity,direction,impact,targetPosition,movementDirection;Spread spread;
 std::optional<double> release,delta,initial,brakeDuration,deceleration,angularError;int brakingKind=0;
};
struct Kill {double timestamp=0,elapsed=0;int targetId=0,generation=0;bool first=false;};
struct Reaction {int targetId=0;double changeTime=0,latency=0;};
struct Event {uint64_t seq=0,shotSeq=0;int type=0;Shot shot;Kill kill;Reaction reaction;};
struct WeaponTotals {uint64_t shots=0,hits=0,heads=0;double recoilSquared=0,spreadSum=0;};
struct Comparison {Moment duration,timing;uint64_t heads=0;};
class Analytics {
 static constexpr size_t Capacity=512;
 std::array<Event,Capacity> journal{};uint64_t oldest=1,sequence=0,acked=0,start=1;bool hasPending=false;Event pending;
 Event& emit(int type){auto& e=journal[(++sequence)%Capacity];e=Event{};e.seq=sequence;e.type=type;if(sequence-oldest>=Capacity)oldest=sequence-Capacity+1;return e;}
 void settle(){if(!hasPending)return;const auto& s=pending.shot;if(s.brakeDuration){brake.add(*s.brakeDuration);if(s.brakingKind){auto& c=comparisons[s.brakingKind-1];c.duration.add(*s.brakeDuration);if(s.delta)c.timing.add(*s.delta);c.heads+=s.hit==0;}}if(s.delta)timing.add(*s.delta);if(s.deceleration)deceleration.add(*s.deceleration);hasPending=false;}
public:
 uint64_t epoch=1,shots=0,heads=0,bodies=0,limbs=0,eliminations=0,first=0,firstHits=0,firstHeads=0,early=0,brakes=0,trackingSamples=0,trackingOnHead=0;
 double trackingErrorSquared=0;Moment elimination,brake,deceleration,speed,timing,angular;std::array<Comparison,2> comparisons;std::array<WeaponTotals,3> weapons;
 void reset(){uint64_t nextEpoch=epoch+1,seq=sequence;*this=Analytics{};epoch=nextEpoch;sequence=acked=seq;oldest=start=seq+1;}
 uint64_t lastSequence()const{return sequence;}uint64_t firstSequence()const{return oldest;}
 void acknowledge(uint64_t seq){if(seq>sequence)return;acked=std::max(acked,seq);}
 const Event* event(uint64_t seq)const{return seq>=oldest&&seq<=sequence?&journal[seq%Capacity]:nullptr;}
 void recordShot(Shot s,Braking& b){
  bool hit=s.hit<=3;shots++;heads+=s.hit==0;bodies+=s.hit==1;limbs+=s.hit==2||s.hit==3;
  if(s.first){first++;firstHits+=hit;firstHeads+=s.hit==0;}
  if(s.release){brakes++;early+=!s.accurate;speed.add(std::hypot(s.velocity.x,s.velocity.z));}
  if(s.angularError)angular.add(*s.angularError);
  auto& w=weapons.at(size_t(s.weapon));w.shots++;w.hits+=hit;w.heads+=s.hit==0;w.recoilSquared+=s.recoilPitch*s.recoilPitch+s.recoilYaw*s.recoilYaw;w.spreadSum+=s.spread.total;
  auto& e=emit(0);e.shot=s;
  if(s.release){if(hasPending)settle();pending=e;hasPending=true;b.shotRecorded=true;if(s.delta&&s.deceleration)settle();}
 }
 void observeBrake(const Braking& b){
  if(!hasPending){return;}
  bool done=false;auto& s=pending.shot;auto previous=s;
  if(s.release==b.release){s.brakingKind=b.kind;if(b.threshold&&!s.delta){s.delta=s.timestamp-*b.threshold;s.brakeDuration=b.duration();}if(b.stop)s.deceleration=b.fullDuration();done=s.delta.has_value()&&s.deceleration.has_value();}else done=true;
  if(previous.brakingKind!=s.brakingKind||previous.delta!=s.delta||previous.deceleration!=s.deceleration){auto& e=emit(3);e.shotSeq=pending.seq;e.shot=s;}
  if(done)settle();
 }
 void recordKill(const Kill& k){eliminations++;elimination.add(k.elapsed);emit(1).kill=k;}
 void recordReaction(const Reaction& r){emit(2).reaction=r;}
 void tracking(double error,bool onHead){if(!std::isfinite(error))return;trackingSamples++;trackingErrorSquared+=error*error;trackingOnHead+=onHead;}
 std::string json(size_t maximumEvents=16)const;
};
namespace wire {
inline const char* boolean(bool v){return v?"true":"false";}
inline void optional(std::ostream& o,const std::optional<double>& v){if(v)o<<*v;else o<<"null";}
inline void vector(std::ostream& o,const Vec& v){o<<"{\"x\":"<<v.x<<",\"y\":"<<v.y<<",\"z\":"<<v.z<<"}";}
inline void moment(std::ostream& o,const Moment& m){o<<"{\"n\":"<<m.n<<",\"sum\":"<<m.sum<<",\"squares\":"<<m.squares<<"}";}
inline const char* weapon(int w){return w==0?"rifleA":w==1?"rifleB":"sheriff";}
inline const char* hit(int h){static const char* names[]={"head","torso","arm","leg","wall","miss"};return names[std::clamp(h,0,5)];}
inline const char* behavior(int b){static const char* names[]={"stationary","strafe","random","stopGo","crouch","peek","appearing"};return names[std::clamp(b,0,6)];}
inline const char* kind(int k){return k==1?"\"neutral\"":k==2?"\"opposite\"":"null";}
inline void brake(std::ostream& o,const Shot& s){o<<"\"brakingKind\":"<<kind(s.brakingKind)<<",\"brakingDuration\":";optional(o,s.brakeDuration);o<<",\"thresholdDelta\":";optional(o,s.delta);o<<",\"decelerationDuration\":";optional(o,s.deceleration);}
inline void shot(std::ostream& o,const Shot& s){
 static const char* accuracy[]={"stationary","walking","running","braking","crouching","crouchMoving","airborne","landing"};
 o<<"{\"timestamp\":"<<s.timestamp<<",\"weapon\":\""<<weapon(s.weapon)<<"\",\"damage\":"<<s.damage<<",\"ads\":"<<boolean(s.ads)<<",\"accuracyState\":\""<<accuracy[std::clamp(s.accuracyState,0,7)]<<"\",\"horizontalDirection\":"<<s.horizontalDirection<<",\"shotIndex\":"<<s.index<<",\"magazineShot\":"<<s.magazineShot<<",\"firstShot\":"<<boolean(s.first)<<",\"accurate\":"<<boolean(s.accurate);
 o<<",\"position\":";vector(o,s.position);o<<",\"velocity\":";vector(o,s.velocity);o<<",\"direction\":";vector(o,s.direction);o<<",\"impact\":";vector(o,s.impact);
 o<<",\"aim\":{\"pitch\":"<<s.aimPitch<<",\"yaw\":"<<s.aimYaw<<"},\"recoil\":{\"pitch\":"<<s.recoilPitch<<",\"yaw\":"<<s.recoilYaw<<"},\"playerCompensation\":{\"pitch\":"<<s.compensationPitch<<",\"yaw\":"<<s.compensationYaw<<"}";
 const auto& p=s.spread;o<<",\"spread\":{\"base\":"<<p.base<<",\"movement\":"<<p.movement<<",\"bloom\":"<<p.bloom<<",\"air\":"<<p.air<<",\"total\":"<<p.total<<",\"x\":"<<p.x<<",\"y\":"<<p.y<<"},\"hit\":\""<<hit(s.hit)<<"\",\"targetId\":";
 if(s.targetId<0)o<<"null";else o<<s.targetId;o<<",\"targetGeneration\":";if(s.targetId<0)o<<"null";else o<<s.generation;o<<",\"targetPosition\":";if(s.targetId<0)o<<"null";else vector(o,s.targetPosition);o<<",\"targetState\":";if(s.targetId<0)o<<"null";else o<<'"'<<behavior(s.behavior)<<'"';
 o<<",\"releaseTime\":";optional(o,s.release);o<<",\"initialSpeed\":";optional(o,s.initial);o<<",";brake(o,s);o<<",\"movementDirection\":{\"x\":"<<s.movementDirection.x<<",\"z\":"<<s.movementDirection.z<<"},\"angularError\":";optional(o,s.angularError);o<<"}";
}
}
inline std::string Analytics::json(size_t maximumEvents)const {
 std::ostringstream o;o.imbue(std::locale::classic());o<<std::setprecision(17);o<<"{\"schema\":1,\"epoch\":"<<epoch<<",\"startSequence\":"<<start<<",\"firstSequence\":"<<oldest<<",\"lastSequence\":"<<sequence<<",\"acknowledged\":"<<acked<<",\"totals\":{\"shots\":"<<shots<<",\"heads\":"<<heads<<",\"bodies\":"<<bodies<<",\"limbs\":"<<limbs<<",\"eliminations\":"<<eliminations<<",\"first\":"<<first<<",\"firstHits\":"<<firstHits<<",\"firstHeads\":"<<firstHeads<<",\"early\":"<<early<<",\"brakes\":"<<brakes;
 auto output=[&](const char* name,const Moment& m){o<<",\""<<name<<"\":";wire::moment(o,m);};
 output("elimination",elimination);output("brake",hasPending?brake.with(pending.shot.brakeDuration):brake);output("deceleration",hasPending?deceleration.with(pending.shot.deceleration):deceleration);output("speed",speed);output("timing",hasPending?timing.with(pending.shot.delta):timing);output("angular",angular);
 o<<",\"comparison\":{";for(int i=0;i<2;i++){if(i)o<<",";o<<'"'<<(i==0?"neutral":"opposite")<<"\":{\"duration\":";auto c=comparisons[i];if(hasPending&&pending.shot.brakingKind==i+1&&pending.shot.brakeDuration){c.duration.add(*pending.shot.brakeDuration);if(pending.shot.delta)c.timing.add(*pending.shot.delta);c.heads+=pending.shot.hit==0;}wire::moment(o,c.duration);o<<",\"timing\":";wire::moment(o,c.timing);o<<",\"heads\":"<<c.heads<<"}";}o<<"},\"weapons\":{";
 for(int i=0;i<3;i++){if(i)o<<",";const auto& w=weapons[i];o<<'"'<<wire::weapon(i)<<"\":{\"shots\":"<<w.shots<<",\"hits\":"<<w.hits<<",\"heads\":"<<w.heads<<",\"recoilSquared\":"<<w.recoilSquared<<",\"spreadSum\":"<<w.spreadSum<<"}";}
 o<<"},\"tracking\":{\"samples\":"<<trackingSamples<<",\"onHead\":"<<trackingOnHead<<",\"errorSquared\":"<<trackingErrorSquared<<"}},\"events\":[";
 uint64_t start=std::max(oldest,acked+1);size_t count=0;for(uint64_t seq=start;seq<=sequence&&count<maximumEvents;seq++,count++){if(count)o<<",";const auto& e=journal[seq%Capacity];o<<"{\"seq\":"<<seq<<",\"type\":\""<<(e.type==0?"shot":e.type==1?"kill":e.type==2?"reaction":"brake")<<"\",\"data\":";
  if(e.type==0)wire::shot(o,e.shot);else if(e.type==1)o<<"{\"timestamp\":"<<e.kill.timestamp<<",\"targetId\":"<<e.kill.targetId<<",\"generation\":"<<e.kill.generation<<",\"elapsed\":"<<e.kill.elapsed<<",\"firstShot\":"<<wire::boolean(e.kill.first)<<"}";
  else if(e.type==2)o<<"{\"targetId\":"<<e.reaction.targetId<<",\"changeTime\":"<<e.reaction.changeTime<<",\"latency\":"<<e.reaction.latency<<"}";
  else{o<<"{\"shotSeq\":"<<e.shotSeq<<",";wire::brake(o,e.shot);o<<"}";}o<<"}";
 }
 o<<"]}";return o.str();
}
}
