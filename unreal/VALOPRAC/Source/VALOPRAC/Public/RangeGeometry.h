#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RangeGeometry.generated.h"
class UMaterialInstanceDynamic;
UCLASS()
class VALOPRAC_API ARangeGeometry: public AActor {
 GENERATED_BODY()
public:
 ARangeGeometry();virtual void BeginPlay() override;
 static UMaterialInstanceDynamic* Material(UObject* Owner,const FLinearColor& Color,float Roughness=.6f,float Metallic=0.f,const FLinearColor& Emissive=FLinearColor::Black);
 UPROPERTY() TArray<TObjectPtr<UMaterialInstanceDynamic>> Materials;
 void Box(const FVector& Position,const FVector& Size,UMaterialInterface* Mat,bool Collision=true);
};
