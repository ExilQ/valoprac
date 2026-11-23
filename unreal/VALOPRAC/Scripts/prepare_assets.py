"""Run in UE 5.7 Editor via -ExecutePythonScript. Creates original map/material/audio assets."""
import os
import unreal
root = unreal.Paths.project_dir()
assets = unreal.EditorAssetLibrary
assets.make_directory('/Game/Materials')
assets.make_directory('/Game/Maps')
assets.make_directory('/Game/Audio')
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
path = '/Game/Materials/M_Tactical'
material = assets.load_asset(path)
if material is None:
    material = asset_tools.create_asset('M_Tactical', '/Game/Materials', unreal.Material, unreal.MaterialFactoryNew())
    library = unreal.MaterialEditingLibrary
    for name, value, prop in [('Color', unreal.LinearColor(.3,.35,.38,1), unreal.MaterialProperty.MP_BASE_COLOR), ('Emissive', unreal.LinearColor(0,0,0,1), unreal.MaterialProperty.MP_EMISSIVE_COLOR)]:
        expression = library.create_material_expression(material, unreal.MaterialExpressionVectorParameter)
        expression.set_editor_property('parameter_name', name)
        expression.set_editor_property('default_value', value)
        library.connect_material_property(expression, '', prop)
    for name, value, prop in [('Roughness', .6, unreal.MaterialProperty.MP_ROUGHNESS), ('Metallic', 0., unreal.MaterialProperty.MP_METALLIC)]:
        expression = library.create_material_expression(material, unreal.MaterialExpressionScalarParameter)
        expression.set_editor_property('parameter_name', name)
        expression.set_editor_property('default_value', value)
        library.connect_material_property(expression, '', prop)
    library.recompile_material(material)
    assets.save_asset(path)
if not assets.does_asset_exist('/Game/Maps/Range'):
    world = unreal.EditorLevelLibrary.new_level('/Game/Maps/Range')
    if not world:
        raise RuntimeError('Could not create training map')
    unreal.EditorLevelLibrary.save_current_level()
tasks = []
for filename in sorted(os.listdir(os.path.join(root, 'SourceAssets', 'Audio'))):
    if filename.endswith('.wav'):
        task = unreal.AssetImportTask()
        task.set_editor_property('filename', os.path.join(root, 'SourceAssets', 'Audio', filename))
        task.set_editor_property('destination_path', '/Game/Audio')
        task.set_editor_property('automated', True)
        task.set_editor_property('replace_existing', True)
        task.set_editor_property('save', True)
        tasks.append(task)
asset_tools.import_asset_tasks(tasks)
for task in tasks:
    if not task.get_editor_property('imported_object_paths'):
        raise RuntimeError('Audio asset import failed: '+task.get_editor_property('filename'))
assets.save_directory('/Game', only_if_is_dirty=False, recursive=True)
unreal.log('VALOPRAC original assets prepared; no Riot recordings included.')
