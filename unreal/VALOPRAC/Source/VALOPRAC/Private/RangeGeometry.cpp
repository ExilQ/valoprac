#include "RangeGeometry.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/RectLight.h"
#include "Components/RectLightComponent.h"
#include "Engine/PostProcessVolume.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Engine/World.h"
ARangeGeometry::ARangeGeometry(){RootComponent=CreateDefaultSubobject<USceneComponent>(TEXT("Range"));RootComponent->SetMobility(EComponentMobility::Static);PrimaryActorTick.bCanEverTick=false;}
UMaterialInstanceDynamic* ARangeGeometry::Material(UObject* Owner,const FLinearColor& Color,float Roughness,float Metallic,const FLinearColor& Emissive){
 auto* Base=LoadObject<UMaterialInterface>(nullptr,TEXT("/Game/Materials/M_Tactical.M_Tactical"));
 if(!Base)Base=LoadObject<UMaterialInterface>(nullptr,TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
 auto* M=UMaterialInstanceDynamic::Create(Base,Owner);M->SetVectorParameterValue(TEXT("Color"),Color);M->SetScalarParameterValue(TEXT("Roughness"),Roughness);M->SetScalarParameterValue(TEXT("Metallic"),Metallic);M->SetVectorParameterValue(TEXT("Emissive"),Emissive);return M;
}
void ARangeGeometry::Box(const FVector& P,const FVector& S,UMaterialInterface* M,bool Collision){
 // One instanced mesh batch per material/collision group, including static architecture.
 UInstancedStaticMeshComponent* Batch=nullptr;for(auto* C:GetComponentsByClass(UInstancedStaticMeshComponent::StaticClass())){auto* I=Cast<UInstancedStaticMeshComponent>(C);if(I->GetMaterial(0)==M&&(I->GetCollisionEnabled()!=ECollisionEnabled::NoCollision)==Collision){Batch=I;break;}}
 if(!Batch){Batch=NewObject<UInstancedStaticMeshComponent>(this);Batch->SetStaticMesh(LoadObject<UStaticMesh>(nullptr,TEXT("/Engine/BasicShapes/Cube.Cube")));Batch->SetMaterial(0,M);Batch->SetMobility(EComponentMobility::Static);Batch->SetCollisionEnabled(Collision?ECollisionEnabled::QueryAndPhysics:ECollisionEnabled::NoCollision);Batch->SetCollisionResponseToAllChannels(ECR_Block);Batch->SetupAttachment(RootComponent);Batch->RegisterComponent();AddInstanceComponent(Batch);}
 Batch->AddInstance(FTransform(FRotator::ZeroRotator,P,S/100.f));
}
void ARangeGeometry::BeginPlay(){Super::BeginPlay();auto* Concrete=Material(this,FLinearColor(.26,.32,.35),.88);auto* Backdrop=Material(this,FLinearColor(.10,.16,.19),.82);auto* Metal=Material(this,FLinearColor(.13,.20,.24),.4,.55);auto* Rubber=Material(this,FLinearColor(.055,.075,.085),.95);auto* Accent=Material(this,FLinearColor(.4,.13,.14),.5,.15);auto* Light=Material(this,FLinearColor(.65,.76,.8),.4,0,FLinearColor(1.8,2,2.1));Materials={Concrete,Backdrop,Metal,Rubber,Accent,Light};
 Box({1300,0,-25},{4600,2800,50},Concrete);Box({1300,0,605},{4600,2800,50},Concrete);Box({3575,0,285},{50,2800,620},Backdrop);Box({1300,-1375,285},{4600,50,620},Concrete);Box({1300,1375,285},{4600,50,620},Concrete);Box({-975,0,285},{50,2800,620},Concrete);
 Box({-200,0,1},{1350,2500,2},Rubber,false);
 for(int Lane=-3;Lane<=3;Lane++){Box({1800,float(Lane*340),1},{3300,4,2},Metal,false);Box({3545,float(Lane*340),170},{10,275,320},Metal);Box({3535,float(Lane*340),170},{6,250,295},Backdrop,false);Box({3530,float(Lane*340),330},{5,240,4},Accent,false);}
 for(int X=-600;X<=3400;X+=800){Box({float(X),0,552},{28,2700,65},Metal);Box({float(X),0,516},{12,2300,5},Light,false);for(int Y:{-1320,1320})Box({float(X),float(Y),270},{55,65,540},Metal);}
 Box({1700,-1000,100},{180,120,200},Metal);Box({2600,1050,70},{160,120,140},Concrete);
 auto* Sun=GetWorld()->SpawnActor<ADirectionalLight>(FVector(0,0,500),FRotator(-65,-25,0));Sun->GetDirectionalLightComponent()->SetIntensity(3.f);Sun->GetDirectionalLightComponent()->SetLightColor(FLinearColor(1,.94,.88));Sun->GetDirectionalLightComponent()->LightSourceAngle=2.5f;
 auto* Fill=GetWorld()->SpawnActor<ASkyLight>();Fill->GetLightComponent()->SetIntensity(.8f);Fill->GetLightComponent()->SetLightColor(FLinearColor(.73,.84,1));Fill->GetLightComponent()->SetMobility(EComponentMobility::Movable);Fill->GetLightComponent()->RecaptureSky();
 for(int X:{300,2300}){auto* L=GetWorld()->SpawnActor<ARectLight>(FVector(X,0,500),FRotator(-90,0,0));auto* C=Cast<URectLightComponent>(L->GetLightComponent());C->SetMobility(EComponentMobility::Movable);C->SetIntensity(14000);C->SetAttenuationRadius(2100);C->SetSourceWidth(1600);C->SetSourceHeight(100);C->SetCastShadows(false);C->SetLightColor(FLinearColor(.9,.95,1));}
 auto* PP=GetWorld()->SpawnActor<APostProcessVolume>();PP->bUnbound=true;auto& S=PP->Settings;S.bOverride_AutoExposureMethod=true;S.AutoExposureMethod=AEM_Manual;S.bOverride_AutoExposureBias=true;S.AutoExposureBias=0;S.bOverride_MotionBlurAmount=true;S.MotionBlurAmount=0;S.bOverride_BloomIntensity=true;S.BloomIntensity=.12;S.bOverride_AmbientOcclusionIntensity=true;S.AmbientOcclusionIntensity=.35;
}
