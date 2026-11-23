using UnrealBuildTool;
using System.IO;
public class VALOPRAC : ModuleRules {
 public VALOPRAC(ReadOnlyTargetRules Target):base(Target){
  PCHUsage=PCHUsageMode.UseExplicitOrSharedPCHs;CppStandard=CppStandardVersion.Cpp20;
  PublicDependencyModuleNames.AddRange(new[]{"Core","CoreUObject","Engine","InputCore","Json","JsonUtilities","PixelStreaming2","ProceduralMeshComponent"});
  PublicIncludePaths.Add(Path.Combine(ModuleDirectory,"Core"));
  RuntimeDependencies.Add("$(ProjectDir)/Content/Data/...",StagedFileType.UFS);
 }
}
