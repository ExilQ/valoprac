#include "ValopracGameMode.h"
#include "ValopracPawn.h"
#include "RangeGeometry.h"
#include "Engine/World.h"
AValopracGameMode::AValopracGameMode(){DefaultPawnClass=AValopracPawn::StaticClass();}
void AValopracGameMode::BeginPlay(){Super::BeginPlay();GetWorld()->SpawnActor<ARangeGeometry>();}
