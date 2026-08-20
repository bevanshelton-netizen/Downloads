export type Show = { title:string; genre:string; language:string; format:string; badge?:string; description:string };
export const featured: Show[] = [
  {title:'Taxi Boss',genre:'Drama',language:'isiZulu / English',format:'Vertical Series',badge:'KORA ORIGINAL',description:'Power, family and ambition collide in Johannesburg.'},
  {title:'The Inheritance',genre:'Family Drama',language:'English / isiXhosa',format:'Series',badge:'TRENDING',description:'One will. Three families. A secret nobody was meant to uncover.'},
  {title:'Durban Nights',genre:'Youth Drama',language:'English / isiZulu',format:'Short Drama',description:'Dreams, music and hard choices after dark.'},
  {title:'Africa Creates',genre:'Creator Showcase',language:'Multilingual',format:'Channel',badge:'LIVE',description:'A continuous showcase of independent African creators.'}
];
export const channels = ['KORA One','KORA Drama','KORA Family','KORA Faith','KORA Music','KORA Kids','KORA Creators'];
