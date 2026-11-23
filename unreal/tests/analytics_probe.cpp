#include "AnalyticsCore.h"
#include <iostream>
#include <cassert>
using namespace valoprac;
int main(){
 Analytics a;Braking b;Movement m;Input in;double time=0;
 for(int i=0;i<100;i++){in.strafe=-1;time+=Dt;b.update(in,0,m,time);m.step(in,0,Dt,time);b.observe(m,time);}
 in.strafe=0;time+=Dt;b.update(in,0,m,time);m.step(in,0,Dt,time);b.observe(m,time);
 Shot s;s.timestamp=time;s.weapon=0;s.hit=0;s.first=true;s.position=m.position;s.velocity=m.velocity;s.release=b.release;s.initial=b.initial;s.brakingKind=b.kind;s.accurate=false;s.spread.total=.25;s.recoilPitch=2;s.angularError=.1;s.targetId=0;s.generation=1;
 a.recordShot(s,b);a.recordKill({time,.4,0,1,true});a.recordReaction({0,time-.2,.2});
 for(int i=0;i<100;i++){in.strafe=i<3?0:1;time+=Dt;b.update(in,0,m,time);m.step(in,0,Dt,time);b.observe(m,time);a.observeBrake(b);a.tracking(.2,true);}
 assert(a.shots==1&&a.heads==1&&a.eliminations==1);assert(a.brake.n==1&&a.timing.n==1&&a.comparisons[1].duration.n==1);
 std::cout<<a.json()<<'\n';a.acknowledge(a.lastSequence());assert(a.json().find("\"events\":[]")!=std::string::npos);
 for(int i=0;i<600;i++){Shot extra;extra.weapon=2;extra.timestamp=i+2;extra.hit=4;extra.first=i%6==0;a.recordShot(extra,b);}
 assert(a.firstSequence()>1);
 uint64_t cursor=a.firstSequence()-1;
 while(cursor<a.lastSequence()){
  std::cout<<a.json()<<'\n';
  cursor=std::min(a.lastSequence(),cursor+16);a.acknowledge(cursor);
 }
 const auto previous=a.lastSequence();a.reset();
 assert(a.shots==0&&a.lastSequence()==previous&&a.firstSequence()==previous+1);
 std::cout<<a.json()<<'\n';
}
