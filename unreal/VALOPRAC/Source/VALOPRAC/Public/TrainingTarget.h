#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SimulationCore.h"
#include "TrainingTarget.generated.h"
class UMaterialInstanceDynamic;
UCLASS()
class VALOPRAC_API ATrainingTarget:public AActor {
 GENERATED_BODY()
public:
 ATrainingTarget();void Step(double Time,double Dt);void SpawnAt(const FVector& Position,double Time,int Seed);bool Hit(FName Zone,double Damage,bool HeadOnly,bool AnyHit,double Time);FVector HeadPosition()const;
 UPROPERTY()TObjectPtr<USceneComponent> Upper;UPROPERTY()TArray<TObjectPtr<USceneComponent>> Hips;UPROPERTY()TArray<TObjectPtr<USceneComponent>> Knees;UPROPERTY()TArray<TObjectPtr<USceneComponent>> Arms;
 UPROPERTY()TArray<TObjectPtr<UPrimitiveComponent>> Parts;
 UPROPERTY()TObjectPtr<UPrimitiveComponent> Head;
 UPROPERTY()TObjectPtr<UMaterialInstanceDynamic> HeadMaterial;UPROPERTY()TObjectPtr<UMaterialInstanceDynamic> BodyMaterial;
 FString Behavior=TEXT("stationary");double SpawnTime=0,DeadAt=-100,NextChange=0,ChangedAt=-100,Crouch=0,SpeedMultiplier=1,Health=150;bool Active=true,Enabled=true,ReactionRecorded=true;int Generation=0,ShotsReceived=0;
 FVector Anchor,Previous;double Lateral=0;int Direction=1;valoprac::Random Random;
private:
 UPrimitiveComponent* Part(USceneComponent* Parent,const TCHAR* Name,FName Zone,const FVector& P,const FVector& Size,bool Sphere=false);
};
