import {Color,type BufferGeometry,type BufferAttribute} from 'three';

/**
 * 12.40 training-bot finish. Appearance only: the character triangles that
 * bullets test are untouched; this rewrites the render copy's vertex colours.
 *
 * Original design for readability, not a copy of any game's bot. Most VALOPRAC
 * maps are bright (teal bands, beige, concrete, terracotta), and the agent's
 * teal jacket and skin tones sat inside that palette. The bot reads by value
 * instead of hue: a charcoal body against light walls, a mannequin-grey face,
 * a dark helmet with bright eyes at head height, and high-visibility orange
 * shoulders and yellow trim that outline the silhouette.
 */
export type BotAppearance='trainingBot'|'agent';
export const BOT_APPEARANCES:readonly BotAppearance[]=['trainingBot','agent'];
const SUIT=0x22262c,SUIT_DARK=0x15181c,SUIT_MID=0x313740,FACE=0x9aa1a8,FACE_LIGHT=0xb4bac0,FACE_SHADE=0x7d848b;
const HELMET=0x101216,HELMET_EDGE=0x23272e,EYES=0xfff3c4,ORANGE=0xff7a18,YELLOW=0xffc531,METAL=0xa8afb6;
/** Source finish colour (as authored in the character builders) -> bot colour. */
export const BOT_PALETTE:ReadonlyMap<number,number>=new Map([
  // Agent (tailored rig): skin, hair, eyes, clothing and kit.
  [0xb87c60,FACE],[0xce9473,FACE_LIGHT],[0x885446,FACE_SHADE],[0x2b2832,HELMET],[0x4e4146,HELMET_EDGE],[0xe0ceae,EYES],[0x323438,YELLOW],
  [0x246871,SUIT],[0x528c92,ORANGE],[0x163741,SUIT_DARK],[0x293442,SUIT_DARK],[0x3c4658,SUIT_MID],[0x505d6d,SUIT_MID],[0xd8cab3,YELLOW],[0xd16c4e,ORANGE],
  [0x514749,SUIT_DARK],[0x292d39,SUIT_DARK],[0x8d9895,METAL],[0x3f696d,SUIT],[0x699799,ORANGE],[0x293c46,SUIT_MID],[0x52646a,YELLOW],
  // Field rig.
  [0x647985,SUIT],[0x7c939b,SUIT_MID],[0x364c5a,SUIT_DARK],[0x354852,SUIT_MID],[0x50616a,ORANGE],[0x243039,SUIT_DARK],[0x3b4b53,SUIT_DARK],
  [0xb57d64,FACE],[0xbd9178,FACE],[0xd78a51,YELLOW],[0x283e48,HELMET],[0x637a81,EYES],
  // Legacy rig.
  [0x273d49,SUIT_DARK],[0x293941,SUIT_DARK],[0x334653,SUIT],[0x566b76,ORANGE],[0x596979,SUIT_MID],[0x94a7ac,METAL],[0xda8c72,FACE],[0xeab69b,FACE_LIGHT],
]);
const key=(r:number,g:number,b:number)=>(r<<16)|(g<<8)|b;
let lookup:Map<number,[number,number,number]>|null=null;
/** Vertex colours are stored as normalised bytes of the linear Color. */
const bytes=(hex:number):[number,number,number]=>{const c=new Color(hex);return[Math.round(c.r*255),Math.round(c.g*255),Math.round(c.b*255)];};
function table(){if(!lookup){lookup=new Map();for(const [from,to] of BOT_PALETTE)lookup.set(key(...bytes(from)),bytes(to));}return lookup;}
/** Recolour a cloned character part in place. Unlisted colours map by value. */
export function applyBotAppearance(geometry:BufferGeometry,appearance:BotAppearance|undefined){
  if(appearance==='agent')return geometry;
  const colors=geometry.getAttribute('color') as BufferAttribute|undefined;if(!colors)return geometry;
  const array=colors.array as Uint8Array,map=table(),dark=bytes(SUIT_DARK),mid=bytes(SUIT_MID),light=bytes(FACE);
  for(let i=0;i<array.length;i+=3){
    const found=map.get(key(array[i],array[i+1],array[i+2]));
    const luma=.2126*array[i]+.7152*array[i+1]+.0722*array[i+2],to=found??(luma<40?dark:luma<110?mid:light);
    array[i]=to[0];array[i+1]=to[1];array[i+2]=to[2];
  }
  colors.needsUpdate=true;return geometry;
}
