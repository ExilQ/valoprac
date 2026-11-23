import type {Mode,Settings} from '../engine/types';

export type TrainingNavigation='free'|'timed'|'braking'|'spray'|'tactical'|'vertical'|'bunny'|'wallbang';

/** One interpretation of the selected task, shared by cards and sidebar. */
export function selectedTraining(mode:Mode,settings:Pick<Settings,'practiceMap'|'drill'>):TrainingNavigation{
 if(mode==='braking')return 'braking';
 if(mode==='precision'||mode==='tracking')return 'timed';
 if(mode==='spray')return 'spray';
 if(settings.practiceMap==='bunny')return 'bunny';
 if(settings.practiceMap==='wallbang')return 'wallbang';
 if(settings.practiceMap==='range')return 'free';
 if(settings.drill==='vertical'&&['mid','tower','multi'].includes(settings.practiceMap))return 'vertical';
 return 'tactical';
}

/** Entering a named training task supplies its relevant defaults. Other saved
 * preferences (sensitivity, weapon, audio and bindings) are left to the store. */
export function trainingChoice(id:TrainingNavigation):{mode:Mode;settings:Partial<Settings>}{
 switch(id){
  case 'free':return{mode:'free',settings:{practiceMap:'range',drill:'none',analysisWall:false}};
  case 'timed':return{mode:'precision',settings:{practiceMap:'range',drill:'none',analysisWall:false}};
  case 'braking':return{mode:'braking',settings:{practiceMap:'range',drill:'tapAD',analysisWall:false}};
  case 'spray':return{mode:'spray',settings:{practiceMap:'range',drill:'none',analysisWall:false}};
  case 'bunny':return{mode:'free',settings:{practiceMap:'bunny',drill:'bunny',analysisWall:false,exposureEnabled:false,combatMode:'learning'}};
  case 'wallbang':return{mode:'free',settings:{practiceMap:'wallbang',drill:'wallbang',analysisWall:false,targetCount:3,eliminationRule:'damage',combatMode:'learning',exposureEnabled:false}};
  case 'vertical':return{mode:'free',settings:{practiceMap:'mid',drill:'vertical',analysisWall:false,targetCount:3,combatMode:'gunfight',exposureEnabled:true,eliminationRule:'damage'}};
  case 'tactical':return{mode:'free',settings:{practiceMap:'complex',peekScenario:'free',targetCount:11,combatMode:'gunfight',eliminationRule:'damage',drill:'none',analysisWall:false,exposureEnabled:true}};
 }
}
