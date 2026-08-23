export const languages = [
  ['en','English','ltr'],['zu','isiZulu','ltr'],['xh','isiXhosa','ltr'],['af','Afrikaans','ltr'],
  ['st','Sesotho','ltr'],['tn','Setswana','ltr'],['nso','Sepedi','ltr'],['ts','siTsonga','ltr'],
  ['ve','Tshivenda','ltr'],['ss','siSwati','ltr'],['nr','isiNdebele','ltr'],['sw','Kiswahili','ltr'],
  ['fr','Français','ltr'],['pt','Português','ltr'],['es','Español','ltr'],['ar','العربية','rtl'],
  ['hi','हिन्दी','ltr'],['ur','اردو','rtl'],['zh','中文','ltr'],['bn','বাংলা','ltr'],
  ['de','Deutsch','ltr'],['it','Italiano','ltr'],['ja','日本語','ltr'],['ko','한국어','ltr'],
  ['tr','Türkçe','ltr'],['ru','Русский','ltr'],['id','Bahasa Indonesia','ltr']
].map(([code,name,dir])=>({code,name,dir}));

export function resolveLanguage(code='en') {
  return languages.find(x=>x.code===code) || languages[0];
}
