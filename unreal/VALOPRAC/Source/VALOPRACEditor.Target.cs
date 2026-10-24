using UnrealBuildTool;
using System.Collections.Generic;
public class VALOPRACEditorTarget : TargetRules {
 public VALOPRACEditorTarget(TargetInfo Target):base(Target){Type=TargetType.Editor;DefaultBuildSettings=BuildSettingsVersion.V6;IncludeOrderVersion=EngineIncludeOrderVersion.Unreal5_7;ExtraModuleNames.Add("VALOPRAC");}
}
