import {finish,type Ring,type Point,type Finish} from './CharacterSurfaces';
import type {HitZone} from '../types';

type Loft=(rings:readonly Ring[],surface:Finish,facets?:number,zone?:HitZone,frontRelief?:(x:number,y:number)=>number)=>void;
type Panel=(outline:readonly Point[],baseZ:number,faceZ:number,surface:Finish,edge?:Finish,x?:number,y?:number,scale?:number,relief?:(x:number,y:number)=>number)=>void;

// Original range uniform. Large color fields remain legible at lane distance.
const skin=finish(0xb87c60,.79),skinLight=finish(0xce9473,.72),lip=finish(0x885446,.77);
const hair=finish(0x2b2832,.77),hairLight=finish(0x4e4146,.72);
const eye=finish(0xe0ceae,.29),iris=finish(0x323438,.22);
const shell=finish(0x246871,.84),shoulder=finish(0x528c92,.8),lining=finish(0x163741,.91);
const undershirt=finish(0x293442,.94),trousers=finish(0x3c4658,.91),fold=finish(0x505d6d,.86);
const piping=finish(0xd8cab3,.7),signal=finish(0xd16c4e,.75);
const leather=finish(0x514749,.67),sole=finish(0x292d39,.94),steel=finish(0x8d9895,.41,.34);

const chest:readonly Point[]=[[-.41,-.25],[-.11,-.38],[-.04,-.29],[-.05,.03],[-.13,.27],[-.27,.40],[-.42,.24]];
const lapel:readonly Point[]=[[-.37,.31],[-.14,.05],[-.20,.34],[-.20,.49],[-.30,.52]];
const pocket:readonly Point[]=[[-.19,-.22],[.12,-.29],[.25,-.16],[.23,.18],[-.16,.23],[-.24,.11]];
const brow:readonly Point[]=[[-.249,.094],[-.089,.084],[-.071,.106],[-.174,.132],[-.229,.122]];
const eyelid:readonly Point[]=[[-.231,.040],[-.17,.014],[-.088,.027],[-.079,.048],[-.166,.072],[-.216,.062]];
const chestPlate:readonly Point[]=[[-.255,.03],[-.16,-.115],[.16,-.115],[.255,.03],[.195,.195],[-.195,.195]];
const chestInset:readonly Point[]=[[-.165,.035],[.165,.035],[.133,.084],[-.133,.084]];
const shinGuard:readonly Point[]=[[-.216,-.075],[-.13,-.22],[.105,-.225],[.202,-.053],[.182,.297],[.041,.377],[-.189,.286]];
const warmShell=finish(0x3f696d,.84),warmShoulder=finish(0x699799,.77),plate=finish(0x293c46,.56,.12),bevel=finish(0x52646a,.48,.16);
const mirror=(outline:readonly Point[]):Point[]=>outline.map(([x,y]):Point=>[-x,y]).reverse();

export function buildAgentPart(index:number,loft:Loft,panel:Panel,fieldKit:boolean){
  const jacket=fieldKit?warmShell:shell,shoulderCloth=fieldKit?warmShoulder:shoulder;
  if(index===0){
    loft([[-.70,.174,.181,-.018],[-.52,.174,.178,-.008],[-.34,.165,.17]],skin,10,'torso');
    // Vary depth and width independently from chin to brow. The hairline
    // follows the temples and leaves the cheeks and ears in silhouette.
    const face:Ring[]=[
      [-.415,.113,.163,.082,skin],[-.346,.218,.231,.075,skin],[-.263,.278,.265,.05],
      [-.211,.284,.279,.044],[-.141,.302,.295,.032],[-.094,.316,.307,.028],
      [-.054,.324,.318,.023],[.035,.319,.327,.015],[.096,.325,.337,.009],
      [.169,.318,.329,-.004],[.24,.307,.321,-.015],[.345,.225,.241,-.035]
    ];
    // Sculpt the bridge, brow, orbital recess, cheekbones and chin into one
    // continuous surface. These offsets only run while the shared mesh is built.
    const ridge=(x:number,width:number)=>Math.max(0,1-Math.abs(x)/width);
    const sculpt=(x:number,y:number)=>{
      const side=Math.abs(x);
      return ridge(x,.093)*(.083*ridge(y+.083,.19)+.035*ridge(y+.094,.045))
        -.034*ridge(side-.15,.11)*ridge(y-.035,.058)
        +.029*ridge(side-.177,.13)*ridge(y+.058,.081)
        +.025*ridge(side-.132,.16)*ridge(y-.106,.047)
        +.021*ridge(x,.12)*ridge(y+.345,.065);
    };
    const facets=24;
    loft(face,skinLight,facets,'head',sculpt);
    // Interpolate the same ring edges for the small features laid over them.
    const cheekDepth=(row:Ring,x:number)=>{
      const [y,rx,rz,offset=0]=row,angle=Math.asin(Math.min(1,Math.abs(x)/rx));
      const step=Math.PI*2/facets,i=Math.min(facets/4-1,Math.floor(angle/step));
      const x0=rx*Math.sin(i*step),x1=rx*Math.sin((i+1)*step);
      const z0=Math.cos(i*step)*(rz+sculpt(x0,y)),z1=Math.cos((i+1)*step)*(rz+sculpt(x1,y));
      return offset+z0+(z1-z0)*(Math.abs(x)-x0)/(x1-x0);
    };
    const depth=(x:number,y:number)=>{
      const i=face.findIndex(row=>row[0]>=y),lo=face[Math.max(0,i-1)],hi=face[i];
      if(!hi||hi===lo)return cheekDepth(hi??face[face.length-1],x);
      const t=(y-lo[0])/(hi[0]-lo[0]);return cheekDepth(lo,x)*(1-t)+cheekDepth(hi,x)*t;
    };
    const detail=(shape:readonly Point[],surface:Finish,edge:Finish,raise:number,x=0,y=0)=>
      panel(shape,raise-.005,raise,surface,edge,x,y,1,depth);
    for(const side of [-1,1]){
      loft([[-.174,.032,.050,0,skin,.318*side],[-.067,.056,.075,-.006,skinLight,.318*side],
        [.044,.048,.058,-.021,skin,.309*side]],skin,8);
      detail(side===1?mirror(eyelid):eyelid,eye,lip,.012);
      detail([[-.025,-.016],[0,-.025],[.022,-.014],[.022,.014],[.011,.023],[-.018,.023],[-.025,.012]],iris,hair,.019,.153*side,.042);
      detail(side===1?mirror(brow):brow,hair,hairLight,.012);
    }
    detail([[-.114,-.217],[-.049,-.233],[.006,-.238],[.088,-.226],[.109,-.213],[.029,-.209],[0,-.214],[-.038,-.207]],lip,skin,.012);
    detail([[-.083,-.239],[-.025,-.257],[.034,-.253],[.084,-.237],[.012,-.239]],skinLight,lip,.013);
    loft([[.122,.315,.32,-.033],[.224,.342,.354,-.046,hairLight],
      [.335,.331,.319,-.058,hair,-.019],[.425,.244,.261,-.079,hairLight,-.067],
      [.453,.102,.155,-.082,hair,-.11]],hair,10);
    panel([[-.31,.196],[-.295,.054],[-.214,.124],[-.162,.207],[.016,.173],[.215,.214],[.29,.29],[.13,.368],[-.16,.364]],.13,.31,hair,hairLight);
    if(fieldKit){
      // The earpiece is attached to the same head surface used for hit testing.
      loft([[-.124,.051,.067,-.036,sole,.327],[-.092,.071,.083,-.044,sole,.34],
        [.041,.068,.085,-.057,plate,.349],[.074,.041,.055,-.061,bevel,.348]],plate,8);
      panel([[.275,-.144],[.305,-.159],[.341,-.122],[.326,-.083]],.097,.194,signal,plate);
    }
    panel([[-.281,.245],[-.216,.187],[-.054,.233],[.169,.285],[.203,.317],[.019,.291]],.251,.319,hairLight,hair);
  }else if(index===1){
    loft([[-.515,.346,.397,0,lining],[-.433,.352,.402,0,lining],[-.409,.35,.396,0,jacket],[-.35,.35,.39],[.015,.428,.455,.018],[.255,.489,.44],
      [.392,.458,.381,-.014,shoulderCloth],[.482,.371,.322,-.021,shoulderCloth],[.513,.245,.287,-.023,lining],[.619,.217,.247,-.029,lining],[.641,.209,.239,-.030,shoulderCloth]],jacket,10);
    panel([[-.105,-.38],[.118,-.38],[.205,.33],[.123,.442],[-.137,.442],[-.195,.30]],.273,.471,undershirt,lining);
    panel(chest,.185,.471,jacket,shoulderCloth);
    panel(mirror(chest),.181,.474,shoulderCloth,jacket);
    panel(lapel,.153,.433,lining,shoulderCloth);
    panel(mirror(lapel),.154,.435,jacket,piping);
    // A diagonal webbing strap crosses the open shell and terminates at a
    // contrasting rectangular adjuster above the waist.
    panel([[-.285,-.299],[-.214,-.331],[.31,.29],[.252,.341]],.37,.498,lining,undershirt);
    panel([[-.093,-.094],[-.02,-.135],[.029,-.076],[-.05,-.032]],.482,.511,steel,lining);
    panel([[-.338,.014],[-.165,.005],[-.146,.057],[-.314,.075]],.434,.487,piping,lining);
    panel([[-.36,.24],[-.20,.176],[.265,.267],[.35,.347],[.238,.37],[-.22,.30]],-.275,-.43,shoulderCloth,jacket);
    if(fieldKit){
      panel(chestPlate,.40,.535,plate,bevel,.0,-.035,.86);
      panel(chestInset,.522,.548,piping,bevel,.0,-.053,.8);
    }
  }else if(index===2){
    loft([[-.59,.322,.314],[-.37,.403,.395],[-.02,.437,.431],[.204,.421,.44],[.222,.425,.449,0,leather],[.48,.389,.42,0,leather]],trousers,8);
    panel([[-.113,.25],[.091,.25],[.117,.324],[.104,.446],[-.105,.439]],.365,.473,steel,sole);
  }else if(index===3||index===5){
    const side=index===3?1:-1;
    loft([[-.56,.27,.31],[-.43,.321,.344,.011,lining],[-.31,.348,.376,-.005,shell],
      [.026,.422,.415,0,shell],[.19,.466,.442,-.009,shoulder,.037*side],
      [.405,.452,.427,-.01,shoulder,.14*side],[.56,.29,.31,.004,shoulder,.26*side]],shell,8);
    // The single woven band breaks symmetry, also readable in side view.
    if(index===3)loft([[.006,.431,.431],[.046,.443,.44],[.15,.464,.448]],signal,8);
    else panel([[-.235,.141],[.06,.103],[.225,.199],[.238,.26],[.028,.185],[-.178,.214]],.29,.452,piping,shell);
  }else if(index===4||index===6){
    const side=index===4?1:-1;
    loft([[-.26,.272,.313,.066,lining],[-.134,.281,.308,.059,lining],[-.112,.282,.305,.06,undershirt],[.12,.346,.354,.022],
      [.32,.368,.362,.005],[.56,.303,.317,-.006]],undershirt);
    loft([[-.626,.18,.245,.135],[-.546,.29,.328,.139],[-.359,.317,.346,.111],[-.205,.236,.306,.064]],leather);
    loft([[-.485,.080,.135,.227,leather,.29*side],[-.338,.119,.15,.203,leather,.265*side],[-.277,.08,.12,.135,undershirt,.229*side]],leather,6);
  }else if(index===7||index===9){
    const side=index===7?-1:1;
    loft([[-.52,.29,.347,.032],[-.34,.334,.38,.026],[-.06,.412,.422],
      [.117,.442,.45,-.019],[.135,.453,.459,-.022,lining],[.203,.468,.471,-.025,lining],[.226,.47,.466,-.026],[.485,.48,.482,-.042],[.56,.431,.413,-.036]],trousers,8);
    panel(pocket,.19,.447,fold,trousers,side*.112,.13,.86);
  }else{
    loft([[-.38,.263,.302,-.058],[-.14,.286,.357,-.087],[.12,.351,.413,-.085],
      [.32,.362,.405,-.035],[.53,.306,.356,.035]],trousers,8);
    panel([[-.197,.34],[.02,.254],[.214,.31],[.205,.396],[-.048,.385]],.235,.414,fold,trousers);
    if(fieldKit)panel(shinGuard,.202,.421,plate,bevel,0,.08,.83);
    loft([[-.50,.368,.644,.151,sole],[-.464,.387,.673,.152,sole],[-.39,.38,.638,.14,leather],
      [-.309,.327,.503,.08,leather],[-.20,.297,.366,-.019,leather],[-.15,.323,.369,-.036,lining]],leather,8);
  }
}
