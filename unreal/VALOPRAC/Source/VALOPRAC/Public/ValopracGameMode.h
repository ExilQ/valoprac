#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ValopracGameMode.generated.h"
UCLASS()
class VALOPRAC_API AValopracGameMode:public AGameModeBase {
 GENERATED_BODY()
public:AValopracGameMode();virtual void BeginPlay()override;
};
