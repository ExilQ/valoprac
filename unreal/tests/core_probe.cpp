#include "SimulationCore.h"
#include "GeneratedProfiles.h"
#include <iostream>
#include <iomanip>
#include <cstdlib>
#include <cassert>
using namespace valoprac;
int main(int argc,char** argv){int fps=argc>1?std::atoi(argv[1]):144,id=argc>2?std::atoi(argv[2]):0;Movement m;m.config=movementProfile();Weapon w(profile(id),1947);w.autoReload=false;Clock clock;int tick=0,count=0;double total=0,time=0,sumX=0,sumY=0;std::vector<double> shots;
 while(total<5-1e-10){double elapsed=std::min(1.0/fps,5-total);total+=elapsed;clock.advance(elapsed,[&](double dt){Input in;if(tick<120)in.strafe=-1;else if(tick>=160&&tick<200)in.strafe=1;else if(tick>=220&&tick<300){in.forward=1;in.strafe=1;}in.fire=tick>=320&&tick<560;in.presses=tick==320?1:0;in.ads=tick>=400;time+=dt;m.step(in,0,dt,time);w.step(time,dt,in,[&](){auto s=w.spread(m,false);sumX+=s.x;sumY+=s.y;w.recoil.kick(w.index,w.p,w.recoilRng,m.crouch,time);count++;shots.push_back(w.firedAt);});tick++;});}
 std::cout<<std::setprecision(17)<<"{\"ticks\":"<<tick<<",\"position\":["<<m.position.x<<","<<m.position.z<<"],\"speed\":"<<m.speed<<",\"shots\":"<<count<<",\"ammo\":"<<w.ammo<<",\"pitch\":"<<w.recoil.pitch<<",\"yaw\":"<<w.recoil.yaw<<",\"spread\":["<<sumX<<","<<sumY<<"],\"timestamps\":[";for(size_t i=0;i<shots.size();i++){if(i)std::cout<<",";std::cout<<shots[i];}std::cout<<"]}";
}
