export class SeededRandom {
  private state:number;
  constructor(seed:number){this.state=seed>>>0||1;}
  next(){let t=this.state+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}
  range(min:number,max:number){return min+(max-min)*this.next();}
}
