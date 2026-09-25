export type SiteTemplate = { key:string; name:string; description:string; sections:string[] };
export const SITE_TEMPLATES: SiteTemplate[] = [
 {key:'small-business',name:'Small Business',description:'Services, trust signals and contact information.',sections:['hero','about','services','contact']},
 {key:'clothing',name:'Clothing & Fashion',description:'Catalogue-style site for apparel, uniforms and fashion brands.',sections:['hero','about','products','gallery','contact']},
 {key:'school-training',name:'School & Training',description:'Professional education site for schools and training centres.',sections:['hero','about','programmes','admissions','contact']},
 {key:'church',name:'Church & Ministry',description:'Welcoming ministry website with services and ministries.',sections:['hero','about','services','ministries','contact']},
 {key:'non-profit',name:'Non-Profit',description:'Mission-led site for community organisations and NPOs.',sections:['hero','mission','programmes','impact','contact']},
 {key:'artist',name:'Artist & Creative',description:'Visual portfolio for musicians, artists and performers.',sections:['hero','bio','work','gallery','contact']},
 {key:'radio',name:'Online Radio',description:'Station website with listen links, shows and presenters.',sections:['hero','listen','shows','presenters','advertise','contact']},
 {key:'professional',name:'Professional Services',description:'Polished site for consultants and service providers.',sections:['hero','about','services','credentials','contact']},
 {key:'catalogue',name:'Product Catalogue',description:'Product showcase with enquiry-driven calls to action.',sections:['hero','about','products','contact']},
];
export function getTemplate(key:string){ return SITE_TEMPLATES.find(t=>t.key===key); }
