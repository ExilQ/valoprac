#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "SimulationCore.h"
#include "AnalyticsCore.h"
#include "InputCoreTypes.h"
#include "ValopracPawn.generated.h"
class UCameraComponent;class UCapsuleComponent;class UPixelStreaming2Input;class ATrainingTarget;class UProceduralMeshComponent;class UAudioComponent;class USoundBase;class FJsonObject;class FJsonValue;
UCLASS()
class VALOPRAC_API AValopracPawn:public APawn {
 GENERATED_BODY()
public:
 AValopracPawn();virtual void BeginPlay()override;virtual void Tick(float Delta)override;virtual void SetupPlayerInputComponent(UInputComponent* Input)override;virtual void EndPlay(const EEndPlayReason::Type Reason)override;
 UPROPERTY()TObjectPtr<UCapsuleComponent> Capsule;UPROPERTY()TObjectPtr<UCameraComponent> Camera;UPROPERTY()TObjectPtr<USceneComponent> GunRoot;UPROPERTY()TObjectPtr<UPixelStreaming2Input> Bridge;
 UPROPERTY()TArray<TObjectPtr<ATrainingTarget>> Targets;UPROPERTY()TArray<TObjectPtr<UProceduralMeshComponent>> GunParts;UPROPERTY()TMap<FString,TObjectPtr<USoundBase>> Sounds;
 UFUNCTION()void Command(const FString& Descriptor);
private:
 valoprac::Analytics Analysis;valoprac::Braking Brake;valoprac::Clock Clock;valoprac::Movement Movement;valoprac::Input Input;std::vector<valoprac::Weapon> Weapons;
 uint32 Seed=1947;int WeaponId=0,TargetCount=5;double LastContact=0;double Time=0,NextState=0,Yaw=0,Pitch=0,Sensitivity=.35,Degrees=.07,AdsSensitivity=1,Fov=103,Duration=60,Distance=20,Size=1,TargetSpeed=1,SpawnInterval=.6;
 bool Paused=true,Finished=false,AnalysisWall=false,HeadOnly=true,AnyHit=false,AdsToggle=false,AdsToggled=false;FString Mode=TEXT("free"),Behavior=TEXT("random"),Session;int64 LastSeq=0,Revision=0;
 double MasterVolume=.35,FiringVolume=.85,HandlingVolume=.65,FeedbackVolume=.7;TArray<TWeakObjectPtr<UAudioComponent>> Voices;
 TMap<FString,FKey> Keys;TSharedPtr<FJsonObject> MeshData;
 void FixedStep(double Dt);void SampleTracking();void RecordReaction(ATrainingTarget* Target);void Fire();void Switch(int Id);void BuildWeapon();void ResetTargets();void Play(const FString& Action);void Send(const TCHAR* Type=TEXT("state"),int64 Ack=0,const FString& Error=TEXT(""));void Configure(const TSharedPtr<FJsonObject>& Payload);void ClearInput();
 void FireDown();void FireUp();void AdsDown();void AdsUp();void Reload();void SelectOne();void SelectTwo();void SelectThree();void OpenMenu();
};
