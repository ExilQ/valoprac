import {Color} from 'three';
export interface Finish {color:Color;roughness:number;metalness:number;}
export type Ring=readonly [y:number,radiusX:number,radiusZ:number,offsetZ?:number,finish?:Finish,offsetX?:number];
export type Point=readonly [x:number,y:number];

export function finish(color:number,roughness:number,metalness=0):Finish{return{color:new Color(color),roughness,metalness};}
