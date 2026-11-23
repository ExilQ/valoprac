import type {Settings,Vec3,WeaponId} from '../../engine/types';
import type {AngleSector} from '../../engine/tactical/levels';

export const SCENARIO_SCHEMA=1 as const;
export const SCENARIO_CODE_PREFIX='VP-S1.';
export const MAX_SCENARIO_BYTES=24_000;
export const MAX_SCENARIO_BOTS=12;
export const SCENARIO_ROUTE_IDS=['long-lane','close-corner','off-angle','vertical','sequential'] as const;
export type ScenarioRouteId=typeof SCENARIO_ROUTE_IDS[number];
export const SCENARIO_ROUTE_TITLES:Record<ScenarioRouteId,string>={'long-lane':'깊은 회랑','close-corner':'좁은 코너 진입','off-angle':'엄폐 옆 오프앵글',vertical:'계단 위 수비각',sequential:'세 개의 분리 사선'};
export type ScenarioTemplate='long'|'garage'|'site'|'tower'|'complex';
export interface ScenarioBot {
 id:string;position:Vec3;weapon:WeaponId;movement:'hold'|'reposition';alternatives:Vec3[];
}
export interface ScenarioDefinition {
 schema:1;id:string;title:string;template:ScenarioTemplate;routeId:ScenarioRouteId;seed:number;
 player:{position:Vec3;yaw:number;pitch:number;weapon:WeaponId};bots:ScenarioBot[];
 rules:{difficulty:Settings['defenderSkill'];combatMode:Settings['combatMode'];duration:number|null;exposureLimit:number;randomSpawns:boolean;infiniteReserve:boolean;autoReload:boolean;exposurePolicy:'sequential'|'crossfire'};
}
export interface ScenarioRoute {
 id:ScenarioRouteId;title:string;description:string;objective:string;template:ScenarioTemplate;route:Vec3[];spawn:Vec3;yaw:number;
 primaryBots:ScenarioBot[];difficulty:'입문'|'보통'|'고급';recommended:WeaponId;verticalMeters:number;sectorCount:number;
}
export interface ScenarioGeometryReport {
 routeId:ScenarioRouteId;routeSamples:number;maxSimultaneousThreats:number;newlyExposed:{index:number;bots:string[]}[];revealed:string[];spawnThreats:string[];navigationSamples:number;
}
export interface CompiledScenario {
 definition:ScenarioDefinition;settingsPatch:Partial<Settings>;sectors:AngleSector[];spawn:Vec3;yaw:number;pitch:number;weapon:WeaponId;route:Vec3[];geometry:ScenarioGeometryReport;
}
export class ScenarioError extends Error {constructor(message:string){super(message);this.name='ScenarioError';}}
