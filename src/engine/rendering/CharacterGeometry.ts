import {BufferGeometry,Float32BufferAttribute,ShapeUtils,Uint8BufferAttribute,Vector2} from 'three';
import {finish,type Finish,type Ring,type Point} from './CharacterSurfaces';
import {buildAgentPart} from './AgentSilhouette';
import type {HitZone} from '../types';
import {FIELD_CHARACTER_GEOMETRY,LEGACY_CHARACTER_GEOMETRY,usesTailoredRig,type CharacterGeometryVersion} from '../targets/characterProfile';
import {legacyCharacterPartGeometry} from './LegacyCharacterGeometry';

/** Each region is a span of triangle corners in draw order. For indexed
 * geometry these offsets address the index buffer, not unique vertices. */
export interface CharacterHitRegion {start:number;count:number;zone:HitZone;}
const TWILL=finish(0x647985,.89);
const WEAVE_LIGHT=finish(0x7c939b,.86);
const WEAVE_DARK=finish(0x364c5a,.94);
const ARMOR=finish(0x354852,.52,.08);
const ARMOR_EDGE=finish(0x50616a,.47,.12);
const RUBBER=finish(0x243039,.93);
const LEATHER=finish(0x3b4b53,.71);
const NECK=finish(0xb57d64,.78);
const FACE=finish(0xbd9178,.72);
const AMBER=finish(0xd78a51,.61,.04);
const LENS=finish(0x283e48,.24,.23);
const LENS_RIM=finish(0x637a81,.29,.26);

const CHASSIS:readonly Point[]=[[-.29,-.33],[.29,-.33],[.37,-.18],[.37,.23],[.26,.37],[-.26,.37],[-.37,.23],[-.37,-.18]];
const CHEVRON:readonly Point[]=[[-.28,-.11],[0,-.155],[.28,-.11],[.28,-.061],[0,-.096],[-.28,-.061]];
const VENT:readonly Point[]=[[-.39,.045],[.39,.045],[.36,.125],[.29,.165],[-.29,.165],[-.36,.125]];
const VISOR:readonly Point[]=[[-.32,.064],[.32,.064],[.29,.118],[-.29,.118]];
const LIGHT_STRIP:readonly Point[]=[[-.20,.108],[.20,.108],[.17,.128],[-.17,.128]];
const MASK:readonly Point[]=[[-.145,-.394],[.145,-.394],[.245,-.314],[.29,-.172],[.22,-.117],[-.22,-.117],[-.29,-.172],[-.245,-.314]];
const MASK_GRILLE:readonly Point[]=[[-.114,-.295],[.114,-.295],[.144,-.244],[-.144,-.244]];
const BUCKLE:readonly Point[]=[[-.14,.22],[.14,.22],[.13,.48],[-.13,.48]];
const HARNESS:readonly Point[]=[[-.32,.11],[-.239,.11],[-.176,.473],[-.253,.483]];

const canonical=new Map<CharacterGeometryVersion,BufferGeometry[]>();

function buildFieldPart(index:number,version:CharacterGeometryVersion){
  const positions:number[]=[],colors:number[]=[],response:number[]=[],indices:number[]=[],regions:CharacterHitRegion[]=[];
  const zone:HitZone=index===0?'head':index<3?'torso':index<7?'arm':'leg';

  function vertex(x:number,y:number,z:number,surface:Finish){
    const {r,g,b}=surface.color;
    positions.push(x,y,z);
    colors.push(Math.round(r*255),Math.round(g*255),Math.round(b*255));
    response.push(Math.round(surface.roughness*255),Math.round(surface.metalness*255));
  }
  function region(start:number,hitZone:HitZone){
    regions.push({start,count:indices.length-start,zone:hitZone});
  }
  function loft(rings:readonly Ring[],surface:Finish,facets=8,hitZone=zone,frontRelief?:(x:number,y:number)=>number){
    const start=indices.length,base=positions.length/3;
    function ringVertex(row:Ring,side:number){
      const [y,radiusX,radiusZ,z=0,mat=surface,x=0]=row,angle=side*Math.PI*2/facets;
      const vx=x+Math.sin(angle)*radiusX,cos=Math.cos(angle);
      vertex(vx,y,z+cos*radiusZ+(frontRelief&&cos>0?frontRelief(vx,y)*cos:0),mat);
    }
    for(const ring of rings)for(let side=0;side<facets;side++)ringVertex(ring,side);
    for(let row=1;row<rings.length;row++)for(let side=0;side<facets;side++){
      const a=base+(row-1)*facets+side,b=base+(row-1)*facets+(side+1)%facets;
      indices.push(a,b,b+facets,a,b+facets,a+facets);
    }
    // Duplicate only the cap rims to keep the longitudinal shading smooth
    // across the articulated surfaces and the shell ends crisp.
    for(const top of [false,true]){
      const cap=rings[top?rings.length-1:0],rim=positions.length/3;
      for(let side=0;side<facets;side++)ringVertex(cap,side);
      for(let side=1;side<facets-1;side++){
        if(top)indices.push(rim,rim+side,rim+side+1);
        else indices.push(rim,rim+side+1,rim+side);
      }
    }
    region(start,hitZone);
  }
  function panel(outline:readonly Point[],baseZ:number,faceZ:number,surface:Finish,edge=surface,x=0,y=0,scale=1,relief?:(x:number,y:number)=>number){
    const start=indices.length,base=positions.length/3,count=outline.length;
    const centerX=outline.reduce((sum,p)=>sum+p[0],0)/count,centerY=outline.reduce((sum,p)=>sum+p[1],0)/count;
    for(const [depth,shrink,material] of [[baseZ,1,edge],[faceZ,.88,surface]] as const){
      for(const [px,py] of outline){
        const vx=x+(centerX+(px-centerX)*shrink)*scale,vy=y+(centerY+(py-centerY)*shrink)*scale;
        vertex(vx,vy,depth+(relief?.(vx,vy)??0),material);
      }
    }
    function triangle(a:number,b:number,c:number){if(faceZ>baseZ)indices.push(a,b,c);else indices.push(a,c,b);}
    // The open back is embedded in the parent surface.
    for(let i=0;i<count;i++){
      const a=base+i,b=base+(i+1)%count;
      triangle(a,b,b+count);triangle(a,b+count,a+count);
    }
    for(const [a,b,c] of ShapeUtils.triangulateShape(outline.map(([px,py])=>new Vector2(px,py)),[]))triangle(base+count+a,base+count+b,base+count+c);
    region(start,zone);
  }

  if(usesTailoredRig(version)){
    buildAgentPart(index,loft,panel,version===FIELD_CHARACTER_GEOMETRY);
  }else if(index===0){
    loft([[-.69,.176,.186],[-.43,.18,.19],[-.28,.175,.17]],NECK,8,'torso');
    loft([[-.45,.14,.18,.025],[-.38,.23,.265,.03],[-.2,.31,.345,.015],[.04,.345,.38],[.28,.3,.32]],FACE,12);
    // Shell wraps the temples and occiput with the brow open for the visor.
    loft([[-.14,.31,.31,-.075,ARMOR],[-.005,.40,.365,-.047,ARMOR_EDGE],[.18,.421,.414,-.025,AMBER],
      [.37,.381,.382,-.03,AMBER],[.48,.27,.28,-.034,ARMOR_EDGE],[.5,.12,.12,-.04,ARMOR]],ARMOR,12);
    panel(VENT,.20,.411,ARMOR,ARMOR_EDGE);
    panel(VISOR,.34,.422,LENS,LENS_RIM);
    panel(LIGHT_STRIP,.395,.424,LENS_RIM,LENS);
    panel(MASK,.12,.375,WEAVE_DARK,ARMOR);
    panel(MASK_GRILLE,.365,.389,ARMOR_EDGE,ARMOR);
  }else if(index===1){
    loft([[-.53,.34,.36],[-.28,.37,.40,.008],[.12,.46,.465],[.36,.477,.42,-.028],
      [.489,.283,.299,-.026],[.576,.213,.252,-.024,ARMOR_EDGE]],TWILL,10);
    panel(HARNESS,.22,.466,WEAVE_DARK,ARMOR_EDGE);
    panel(HARNESS.map(([x,y]):Point=>[-x,y]).reverse(),.22,.466,WEAVE_DARK,ARMOR_EDGE);
    panel(CHASSIS,.31,.53,ARMOR,ARMOR_EDGE);
    panel(CHEVRON,.505,.552,AMBER,ARMOR_EDGE);
    panel(CHASSIS,-.32,-.51,WEAVE_DARK,ARMOR_EDGE,0,-.026,.86);
    panel(CHEVRON,-.48,-.53,WEAVE_LIGHT,ARMOR_EDGE,0,.03,.82);
  }else if(index===2){
    loft([[-.51,.37,.35],[-.34,.44,.425],[.21,.445,.46],[.36,.44,.48,0,ARMOR_EDGE],[.53,.40,.445,0,RUBBER]],TWILL,10);
    panel(BUCKLE,.40,.54,ARMOR_EDGE,ARMOR);
  }else if(index===3||index===5){
    const inward=index===3?1:-1;
    loft([[-.56,.27,.315],[-.37,.324,.36,-.025],[.11,.417,.42],[.43,.44,.435,0,TWILL,.11*inward],
      [.53,.327,.33,0,TWILL,.24*inward]],TWILL);
    panel(CHASSIS,.22,.48,ARMOR,ARMOR_EDGE,0,.22,.82);
    panel(CHEVRON,.433,.498,AMBER,ARMOR_EDGE,0,.24,.82);
  }else if(index===4||index===6){
    loft([[-.35,.295,.30,.027],[-.2,.328,.345],[.25,.385,.377,-.014],[.56,.30,.31]],TWILL);
    loft([[-.61,.205,.28,.052,RUBBER],[-.52,.355,.384,.062,LEATHER],[-.31,.391,.40,.04,LEATHER],[-.17,.30,.305,.015,ARMOR]],LEATHER);
    panel(CHASSIS,.25,.432,ARMOR_EDGE,ARMOR,0,-.36,.64);
  }else if(index===7||index===9){
    loft([[-.5,.342,.395],[-.31,.387,.42,.012],[.1,.442,.451],[.43,.452,.47,-.016],[.53,.39,.414]],TWILL,10);
    panel(CHASSIS,.22,.492,WEAVE_DARK,ARMOR_EDGE,index===7?-.09:.09,.02,.83);
  }else{
    loft([[-.315,.29,.34,-.05],[-.12,.335,.405,-.055],[.29,.383,.424,-.036],[.56,.346,.402,.022]],WEAVE_DARK);
    panel(CHASSIS,.16,.49,ARMOR,ARMOR_EDGE,0,.305,.77);
    // A longer toe and separate sole reroute the boot silhouette into the
    // character's planted stance. The lowest surface stays on the ground.
    loft([[-.5,.393,.681,.153,RUBBER],[-.461,.404,.69,.158,RUBBER],[-.36,.393,.643,.135,LEATHER],[-.19,.29,.381,-.042,LEATHER]],LEATHER,10);
  }

  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Uint8BufferAttribute(colors,3,true));
  geometry.setAttribute('characterFinish',new Uint8BufferAttribute(response,2,true));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  if(index===3||index===5)geometry.translate(index===3?.3:-.3,0,0);
  if(index===4||index===6)geometry.translate(index===4?.34:-.34,0,0);
  geometry.userData.hitRegions=regions;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Immutable CPU source. Both renderers and hit queries consume these triangles. */
export function characterPartSourceGeometry(index:number,version:CharacterGeometryVersion=FIELD_CHARACTER_GEOMETRY){
  if(!Number.isInteger(index)||index<0||index>=11)throw new RangeError('Invalid character part');
  if(version===LEGACY_CHARACTER_GEOMETRY)return legacyCharacterPartGeometry(index);
  let parts=canonical.get(version);
  if(!parts){parts=[];canonical.set(version,parts);}
  return parts[index]??(parts[index]=buildFieldPart(index,version));
}

export function characterPartGeometry(index:number,version:CharacterGeometryVersion=FIELD_CHARACTER_GEOMETRY){
  return characterPartSourceGeometry(index,version).clone();
}
