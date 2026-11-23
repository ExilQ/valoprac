#include "ValopracPawn.h"
#include "TrainingTarget.h"
#include "Components/PrimitiveComponent.h"
#include "Engine/World.h"
namespace {
valoprac::Vec BrowserVector(const FVector& Value){return {Value.Y/100,Value.Z/100,-Value.X/100};}
int BehaviorCode(const FString& Value){const TCHAR* Values[]={TEXT("stationary"),TEXT("strafe"),TEXT("random"),TEXT("stopGo"),TEXT("crouch"),TEXT("peek"),TEXT("appearing")};for(int I=0;I<7;I++)if(Value==Values[I])return I;return 0;}
}
void AValopracPawn::RecordReaction(ATrainingTarget* Target){
 if(!Target||Target->ReactionRecorded||Target->ChangedAt<0)return;
 const double Delay=Time-Target->ChangedAt;
 if(Delay>=0&&Delay<2){Analysis.recordReaction({Targets.IndexOfByKey(Target),Target->ChangedAt,Delay});Target->ReactionRecorded=true;}
}
void AValopracPawn::Fire(){
 auto& W=Weapons[WeaponId];auto& M=Movement;
 const bool First=W.index==0;if(First){W.recoil.compensationPitch=0;W.recoil.compensationYaw=0;}
 valoprac::Shot S;S.timestamp=Time;S.weapon=WeaponId;S.index=W.index;S.magazineShot=W.magazineShot;S.first=First;S.accurate=M.accurate();S.ads=W.ads;S.spread=W.spread(M,Time-M.landedAt<.09);S.position=M.position;S.velocity=M.velocity;
 S.aimPitch=FMath::DegreesToRadians(Pitch);S.aimYaw=FMath::DegreesToRadians(Yaw);S.compensationPitch=W.recoil.compensationPitch;S.compensationYaw=W.recoil.compensationYaw;
 const double P=FMath::DegreesToRadians(Pitch+W.recoil.pitch+S.spread.y),Y=FMath::DegreesToRadians(Yaw+W.recoil.yaw+S.spread.x);
 S.direction={-std::sin(Y)*std::cos(P),std::sin(P),-std::cos(Y)*std::cos(P)};
 const double Eye=M.config.standingEyeHeight+(M.config.crouchingEyeHeight-M.config.standingEyeHeight)*M.crouch;
 FVector Origin(float(-M.position.z*100),float(M.position.x*100),float((M.position.y+Eye)*100));
 FVector Direction(float(-S.direction.z),float(S.direction.x),float(S.direction.y));
 FHitResult Hit;FCollisionQueryParams Query(SCENE_QUERY_STAT(ValopracShot),false,this);
 const bool Blocking=GetWorld()->LineTraceSingleByChannel(Hit,Origin,Origin+Direction*20000,ECC_Visibility,Query);
 S.impact=BrowserVector(Blocking?Hit.ImpactPoint:Origin+Direction*20000);
 auto* Target=Cast<ATrainingTarget>(Hit.GetActor());FName Zone=TEXT("miss");
 if(Target&&Hit.GetComponent()&&Hit.GetComponent()->ComponentTags.Num())Zone=Hit.GetComponent()->ComponentTags[0];else if(Blocking)Zone=TEXT("wall");
 S.hit=Zone==TEXT("head")?0:Zone==TEXT("torso")?1:Zone==TEXT("arm")?2:Zone==TEXT("leg")?3:Zone==TEXT("wall")?4:5;
 S.damage=Target?W.p.damageAt(S.hit==0,S.hit==3,Hit.Distance/100):0;
 if(Target){S.targetId=Targets.IndexOfByKey(Target);S.generation=Target->Generation;S.targetPosition=BrowserVector(Target->GetActorLocation());S.behavior=BehaviorCode(Target->Behavior);RecordReaction(Target);}
 double Nearest=DBL_MAX;
 for(ATrainingTarget* Candidate:Targets){if(!Candidate->Enabled||!Candidate->Active)continue;const FVector To=(Candidate->HeadPosition()-Origin).GetSafeNormal();const double Error=FMath::RadiansToDegrees(std::acos(FMath::Clamp(FVector::DotProduct(To,Direction),-1.0,1.0)));if(Candidate==Target){Nearest=Error;break;}Nearest=FMath::Min(Nearest,Error);}
 if(Mode==TEXT("spray")&&!Target){const FVector To=(FVector(3500,0,164)-Origin).GetSafeNormal();Nearest=FMath::RadiansToDegrees(std::acos(FMath::Clamp(FVector::DotProduct(To,Direction),-1.0,1.0)));}
 if(Nearest!=DBL_MAX)S.angularError=Nearest;
 const bool Episode=Brake.active&&!Brake.shotRecorded&&Brake.release.has_value();
 if(Episode){S.release=Brake.release;S.initial=Brake.initial;S.brakingKind=Brake.kind;S.brakeDuration=Brake.duration();S.deceleration=Brake.fullDuration();if(Brake.threshold)S.delta=Time-*Brake.threshold;}
 const double Radians=FMath::DegreesToRadians(Yaw);S.movementDirection={Input.strafe*std::cos(Radians)-Input.forward*std::sin(Radians),0,-Input.forward*std::cos(Radians)-Input.strafe*std::sin(Radians)};
 S.accuracyState=!M.grounded?6:Time-M.landedAt<.09?7:M.accurate()?(M.crouch>.5?4:0):M.crouch>.5?5:Brake.active?3:Input.walk?1:2;
 // This shot follows pre-kick aim; the recorded residual kick applies to the next shot.
 W.recoil.kick(W.index,W.p,W.recoilRng,M.crouch,Time);S.recoilPitch=W.recoil.pitch;S.recoilYaw=W.recoil.yaw;S.horizontalDirection=W.recoil.direction;
 Analysis.recordShot(S,Brake);
 if(Target){const bool FirstOnTarget=Target->ShotsReceived==0;if(Target->Hit(Zone,S.damage,HeadOnly,AnyHit,Time)){Analysis.recordKill({Time,Time-Target->SpawnTime,S.targetId,Target->Generation,FirstOnTarget});Play(TEXT("elimination"));}}
 Play(TEXT("fire"));
}
void AValopracPawn::SampleTracking(){
 if(Mode!=TEXT("free")&&Mode!=TEXT("tracking"))return;
 const auto& M=Movement;const auto& W=Weapons[WeaponId];const double P=FMath::DegreesToRadians(Pitch+W.recoil.pitch),Y=FMath::DegreesToRadians(Yaw+W.recoil.yaw);
 const FVector Origin(float(-M.position.z*100),float(M.position.x*100),float((M.position.y+M.config.standingEyeHeight+(M.config.crouchingEyeHeight-M.config.standingEyeHeight)*M.crouch)*100));
 const FVector Direction(float(std::cos(Y)*std::cos(P)),float(-std::sin(Y)*std::cos(P)),float(std::sin(P)));
 FHitResult Hit;FCollisionQueryParams Query(SCENE_QUERY_STAT(ValopracTracking),false,this);GetWorld()->LineTraceSingleByChannel(Hit,Origin,Origin+Direction*20000,ECC_Visibility,Query);
 auto* Visible=Cast<ATrainingTarget>(Hit.GetActor());const bool OnHead=Visible&&Hit.GetComponent()&&Hit.GetComponent()->ComponentHasTag(TEXT("head"));
 double Nearest=DBL_MAX;for(ATrainingTarget* Target:Targets){if(!Target->Enabled||!Target->Active)continue;const FVector To=(Target->HeadPosition()-Origin).GetSafeNormal();Nearest=FMath::Min(Nearest,FMath::RadiansToDegrees(std::acos(FMath::Clamp(FVector::DotProduct(To,Direction),-1.0,1.0))));if(OnHead&&Visible==Target)RecordReaction(Target);}
 if(Nearest!=DBL_MAX)Analysis.tracking(Nearest,OnHead);
}
