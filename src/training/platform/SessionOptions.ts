import {validateExerciseOptions,type ExerciseOptions} from '../exercises/types';
import type {ScenarioDefinition} from '../scenarios/types';
import {validateScenario} from '../scenarios/validation';

/** Initial, versioned session conditions. They are data, never executable hooks.
 * Interactive changes belong to explicit replay commands, not this envelope. */
export interface SimulationOptions {
 readonly exercise?:ExerciseOptions;
 readonly scenario?:ScenarioDefinition;
}

function object(value:unknown):value is Record<string,unknown>{
 return!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}
function freeze<T>(value:T):T {
 if(value&&typeof value==='object'){
  for(const item of Object.values(value))freeze(item);
  Object.freeze(value);
 }
 return value;
}

/** Validators return fresh bounded canonical data. Freezing prevents a live UI
 * object from changing already recorded conditions between simulation ticks. */
export function validateSessionOptions(raw:unknown={}):SimulationOptions {
 if(!object(raw)||Object.keys(raw).some(key=>key!=='exercise'&&key!=='scenario'))throw new Error('지원하지 않는 훈련 세션 설정입니다.');
 if(Object.hasOwn(raw,'exercise')&&Object.hasOwn(raw,'scenario'))throw new Error('워밍업·반응 과제와 사용자 시나리오를 동시에 실행할 수 없습니다.');
 const options:SimulationOptions={};
 if(Object.hasOwn(raw,'exercise'))return freeze({exercise:validateExerciseOptions(raw.exercise)});
 if(Object.hasOwn(raw,'scenario'))return freeze({scenario:validateScenario(raw.scenario)});
 return freeze(options);
}
