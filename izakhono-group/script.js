const y=document.querySelector('#year');if(y)y.textContent=new Date().getFullYear();
const share=document.querySelector('#shareSite');
if(share){share.addEventListener('click',async()=>{
  const data={title:'IZAKHONO',text:'IZAKHONO — Build. Trade. Grow.',url:'https://izakhono.co.za/'};
  try{if(navigator.share){await navigator.share(data)}else{await navigator.clipboard.writeText(data.url);share.textContent='LINK COPIED'}}catch{}
});}
