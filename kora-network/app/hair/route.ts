export const dynamic = 'force-static';

const html = String.raw\`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#120910">
<title>CROWNÉ Hair — Every shade. Every texture. Every crown.</title>
<meta name="description" content="Luxury wigs, weaves, bundles, frontals, closures and extensions for every skin tone and every crown.">
<style>
:root{--ink:#120910;--plum:#3b172d;--rose:#7e3158;--gold:#f0cf8b;--cream:#fff8f1;--line:rgba(255,255,255,.14)}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--ink);color:#fff;font-family:Arial,sans-serif;overflow-x:hidden}img{width:100%;height:100%;object-fit:cover;display:block}a{text-decoration:none;color:inherit}button{font:inherit}
.topbar{background:var(--gold);color:#1a0b12;padding:9px 5vw;text-align:center;font-size:11px;font-weight:900;letter-spacing:.15em}
nav{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 5vw;background:rgba(18,9,16,.9);backdrop-filter:blur(14px);position:sticky;top:0;z-index:30;border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:11px}.mark{width:44px;height:44px;border:1px solid var(--gold);border-radius:50%;display:grid;place-items:center;font:italic 700 25px Georgia,serif;color:var(--gold)}.brand b{font:700 23px Georgia,serif;letter-spacing:.08em}.brand small{display:block;color:var(--gold);font-size:8px;letter-spacing:.5em;margin-top:4px}.navlinks{display:flex;gap:24px;font-size:11px;letter-spacing:.11em;text-transform:uppercase}.navlinks a:hover{color:var(--gold)}.share{border:1px solid var(--line);background:transparent;color:#fff;border-radius:999px;padding:10px 14px;cursor:pointer}
.hero{min-height:720px;display:grid;grid-template-columns:.9fr 1.1fr;align-items:center;gap:4vw;padding:6vw 6vw;background:radial-gradient(circle at 15% 20%,rgba(126,49,88,.3),transparent 30%),linear-gradient(135deg,#160a12,#27111f 58%,#10070d)}.eyebrow{font-size:11px;letter-spacing:.22em;font-weight:900;color:var(--gold)}h1,h2{font-family:Georgia,serif;letter-spacing:-.045em}.hero h1{font-size:clamp(58px,7vw,102px);line-height:.88;margin:18px 0 24px;font-weight:500}.hero h1 em,h2 em{color:var(--gold);font-weight:400}.lede{max-width:620px;color:#dfced8;font-size:18px;line-height:1.7}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:0 22px;border-radius:999px;font-size:11px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;border:1px solid transparent;cursor:pointer}.btn.gold{background:linear-gradient(135deg,#f7dfaa,#c69c58);color:#170a11}.btn.ghost{border-color:rgba(255,255,255,.25);background:transparent;color:#fff}
.heroart{height:600px;position:relative}.pillimg{position:absolute;overflow:hidden;border-radius:180px 180px 26px 26px;border:1px solid rgba(240,207,139,.25);box-shadow:0 30px 80px rgba(0,0,0,.36)}.mainimg{width:62%;height:92%;left:19%;top:3%}.sideimg.a{width:29%;height:42%;right:0;top:6%}.sideimg.b{width:29%;height:42%;left:0;bottom:0}.seal{position:absolute;right:2%;bottom:7%;width:126px;height:126px;border-radius:50%;background:var(--gold);color:#170a11;display:grid;place-items:center;text-align:center;align-content:center;transform:rotate(7deg);font-size:9px;letter-spacing:.14em}.seal b{font:700 18px Georgia,serif;margin:5px}
.ticker{overflow:hidden;background:#fff;color:#170a11}.track{display:flex;gap:26px;width:max-content;padding:14px 0;animation:move 28s linear infinite;font:700 14px Georgia,serif}.track span{white-space:nowrap}@keyframes move{to{transform:translateX(-50%)}}
.section{padding:96px 6vw}.heading{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:42px}.heading h2{font-size:clamp(46px,6vw,78px);margin:10px 0 0}.heading p{max-width:500px;color:#cdbcc7;line-height:1.7}
.showroom{background:#0c0509}.stage{min-height:540px;border:1px solid var(--line);border-radius:34px;display:grid;place-items:center;position:relative;overflow:hidden;background:radial-gradient(circle,rgba(240,207,139,.15),transparent 38%),#180c14}.carousel{width:min(1000px,90vw);height:470px;position:relative;display:grid;place-items:center}.card{position:absolute;width:280px;height:390px;border-radius:160px 160px 24px 24px;overflow:hidden;background:#2c1624;border:1px solid rgba(240,207,139,.3);box-shadow:0 25px 65px rgba(0,0,0,.55);transition:transform .7s ease,opacity .7s ease}.card img{height:76%}.card div{padding:14px 18px}.card h3{font:600 24px Georgia,serif;margin:0 0 5px}.card p{margin:0;color:#cbbbc4;font-size:12px}.stage button.arrow{position:absolute;z-index:5;width:52px;height:52px;border-radius:50%;border:1px solid var(--line);background:rgba(255,255,255,.06);color:#fff;font-size:30px;cursor:pointer}.left{left:22px}.right{right:22px}.status{position:absolute;bottom:18px;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#c8b7c1}
.shop{background:var(--cream);color:#160a12}.shop .heading p{color:#725f69}.shop .eyebrow{color:#895e2d}.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:26px}.filter{border:1px solid #d9ccd3;background:#fff;border-radius:999px;padding:9px 14px;cursor:pointer}.filter.active{background:#160a12;color:#fff}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.product{background:#fff;border:1px solid #ebdfe5;border-radius:22px;overflow:hidden;box-shadow:0 8px 25px rgba(40,10,25,.05)}.product figure{height:340px;margin:0;overflow:hidden}.product figure img{transition:transform .8s ease}.product:hover figure img{transform:scale(1.05) rotateY(7deg)}.product .info{padding:17px}.meta{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:#8b7481;display:flex;justify-content:space-between}.product h3{font:600 24px Georgia,serif;margin:9px 0 5px}.product p{font-size:12px;color:#76616d;min-height:32px}.buy{display:flex;justify-content:space-between;align-items:center;margin-top:14px}.buy strong{font-size:18px}.buy button{border:0;background:#160a12;color:#fff;border-radius:999px;padding:10px 12px;cursor:pointer;font-weight:800}
.inclusive{display:grid;grid-template-columns:1fr 1fr;gap:5vw;align-items:center;background:linear-gradient(135deg,#491b37,#1b0c16)}.inclusive .photo{height:610px;border-radius:34px;overflow:hidden}.inclusive h2{font-size:clamp(48px,5.5vw,78px);margin:15px 0 20px}.inclusive p{color:#ddced7;line-height:1.8}.tones{display:flex;margin:27px 0}.tones span{width:46px;height:46px;border-radius:50%;margin-left:-6px;border:2px solid #1b0c16;background:var(--c)}
footer{padding:60px 6vw;background:#090407;border-top:1px solid var(--line);color:#b5a3ad}.footbrand{font:700 26px Georgia,serif;color:#fff}.note{font-size:11px;line-height:1.6;max-width:780px}
.toast{position:fixed;right:18px;bottom:18px;background:#fff;color:#160a12;border-radius:16px;padding:14px 18px;box-shadow:0 18px 50px rgba(0,0,0,.3);transform:translateY(120px);transition:.3s;z-index:50;font-size:13px}.toast.show{transform:translateY(0)}
@media(max-width:950px){.navlinks{display:none}.hero{grid-template-columns:1fr}.heroart{height:560px}.grid{grid-template-columns:repeat(2,1fr)}.inclusive{grid-template-columns:1fr}.heading{align-items:start;flex-direction:column}}
@media(max-width:600px){nav{height:68px}.brand b{font-size:19px}.hero{padding:48px 5vw 65px;min-height:auto}.hero h1{font-size:55px}.lede{font-size:15px}.heroart{height:450px}.seal{width:100px;height:100px}.section,.inclusive{padding:74px 5vw}.heading h2,.inclusive h2{font-size:48px}.stage{min-height:480px}.carousel{height:420px}.card{width:225px;height:330px}.grid{grid-template-columns:1fr}.product figure{height:430px}.inclusive .photo{height:500px}.topbar{font-size:9px}}
</style>
</head>
<body>
<div class="topbar">CROWNÉ HAIR ✦ EVERY SHADE · EVERY TEXTURE · EVERY CROWN</div>
<nav>
<a class="brand" href="#top"><span class="mark">C</span><span><b>CROWNÉ</b><small>HAIR</small></span></a>
<div class="navlinks"><a href="#showroom">Showroom</a><a href="#shop">Shop</a><a href="#everyone">Every crown</a></div>
<button class="share" id="share">Share ↗</button>
</nav>
<main id="top">
<section class="hero">
<div>
<p class="eyebrow">LUXURY HAIR. LIMITLESS YOU.</p>
<h1>Wear the <em>moment.</em><br>Own the room.</h1>
<p class="lede">Wigs, weaves, bundles, frontals, closures, ponytails and extensions presented with high-glamour editorial energy — designed to celebrate every complexion and every texture.</p>
<div class="actions"><a class="btn gold" href="#shop">Shop the collection</a><a class="btn ghost" href="#showroom">See hair rotate</a></div>
</div>
<div class="heroart">
<figure class="pillimg mainimg"><img src="https://images.pexels.com/photos/9167117/pexels-photo-9167117.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Diverse beauty editorial"></figure>
<figure class="pillimg sideimg a"><img src="https://images.pexels.com/photos/9167178/pexels-photo-9167178.jpeg?auto=compress&cs=tinysrgb&w=700" alt="Textured natural hair"></figure>
<figure class="pillimg sideimg b"><img src="https://images.pexels.com/photos/5901063/pexels-photo-5901063.jpeg?auto=compress&cs=tinysrgb&w=700" alt="Hair colour beauty portrait"></figure>
<div class="seal">EVERY<b>SKIN TONE</b>EVERY CROWN</div>
</div>
</section>
<section class="ticker"><div class="track"><span>LACE FRONTS ✦</span><span>BOB WIGS ✦</span><span>BODY WAVE ✦</span><span>DEEP CURL ✦</span><span>BUNDLES ✦</span><span>CLIP-INS ✦</span><span>PONYTAILS ✦</span><span>FRONTALS ✦</span><span>LACE FRONTS ✦</span><span>BOB WIGS ✦</span><span>BODY WAVE ✦</span><span>DEEP CURL ✦</span><span>BUNDLES ✦</span><span>CLIP-INS ✦</span><span>PONYTAILS ✦</span><span>FRONTALS ✦</span></div></section>
<section class="section showroom" id="showroom">
<div class="heading"><div><p class="eyebrow">ROTATING SHOWROOM</p><h2>See the hair <em>move.</em></h2></div><p>The pieces rotate automatically and can be moved forward or backward, giving shoppers more than a flat catalogue view.</p></div>
<div class="stage"><button class="arrow left" id="prev">‹</button><div class="carousel" id="carousel"></div><button class="arrow right" id="next">›</button><div class="status">AUTO-ROTATING · TAP TO EXPLORE</div></div>
</section>
<section class="section shop" id="shop">
<div class="heading"><div><p class="eyebrow">THE CROWN ROOM</p><h2>Choose your <em>energy.</em></h2></div><p>Browse the launch collection by category. Final stock, lengths, density, colours and pricing are confirmed at checkout.</p></div>
<div class="filters" id="filters"></div><div class="grid" id="grid"></div>
</section>
<section class="section inclusive" id="everyone">
<div class="photo"><img src="https://images.pexels.com/photos/5254288/pexels-photo-5254288.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Women with different complexions and hair textures"></div>
<div><p class="eyebrow">BEAUTY WITHOUT A SHADE CHART</p><h2>Glorious on <em>everyone.</em></h2><p>CROWNÉ celebrates light, medium, olive, brown and deep skin tones, with sleek, wavy, curly, kinky and coily looks across natural and fashion colours.</p><div class="tones"><span style="--c:#f2d3bf"></span><span style="--c:#dfb08c"></span><span style="--c:#bd805a"></span><span style="--c:#915b3b"></span><span style="--c:#653b28"></span><span style="--c:#3d241d"></span></div><a class="btn gold" href="#shop">Find your crown</a></div>
</section>
</main>
<footer><div class="footbrand">CROWNÉ HAIR</div><p>Every shade. Every texture. Every crown.</p><p class="note">Public launch bridge powered by existing external infrastructure while the permanent IZAKHONO-owned hostname is completed. Secure payment remains on the protected IZAKHONO PAY/iKhokha rail.</p></footer>
<div class="toast" id="toast">Added to your Crown Room ✦</div>
<script>
var items=[
{name:'Velvet Curl',cat:'Wigs',texture:'Deep Curl',img:'https://images.pexels.com/photos/6484129/pexels-photo-6484129.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Rich, soft volume with defined glamour.'},
{name:'Bombshell Body',cat:'Wigs',texture:'Body Wave',img:'https://images.pexels.com/photos/15868319/pexels-photo-15868319.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Flowing movement for maximum-impact styling.'},
{name:'Signature Bundles',cat:'Weaves',texture:'Multi Texture',img:'https://images.pexels.com/photos/14730867/pexels-photo-14730867.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Build length, fullness and your own finish.'},
{name:'The Wig Vault',cat:'Wigs',texture:'All Styles',img:'https://images.pexels.com/photos/13439624/pexels-photo-13439624.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Cuts, colours and textures for every mood.'},
{name:'Power Pony',cat:'Ponytails',texture:'Sleek / Wave',img:'https://images.pexels.com/photos/9167117/pexels-photo-9167117.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Fast glamour for polished ponytail looks.'},
{name:'Texture Edit',cat:'Extensions',texture:'Coil / Curl',img:'https://images.pexels.com/photos/5254288/pexels-photo-5254288.jpeg?auto=compress&cs=tinysrgb&w=900',copy:'Texture-forward fullness and blending.'}
];
var active='All',index=0,timer;
var carousel=document.getElementById('carousel'),grid=document.getElementById('grid'),filters=document.getElementById('filters'),toast=document.getElementById('toast');
function drawCarousel(){
carousel.innerHTML=items.slice(0,5).map(function(x,i){var offset=((i-index+5)%5);if(offset>2)offset-=5;var scale=offset===0?1:0.82;var opacity=Math.abs(offset)>1?0.35:1;return '<article class="card" style="transform:translateX('+(offset*220)+'px) scale('+scale+') rotateY('+(offset*-18)+'deg);opacity:'+opacity+';z-index:'+(10-Math.abs(offset))+'"><img src="'+x.img+'" alt="'+x.name+'"><div><h3>'+x.name+'</h3><p>'+x.texture+'</p></div></article>'}).join('');
}
function rotate(dir){index=(index+dir+5)%5;drawCarousel();restart()}
function restart(){clearInterval(timer);timer=setInterval(function(){rotate(1)},3200)}
document.getElementById('prev').onclick=function(){rotate(-1)};document.getElementById('next').onclick=function(){rotate(1)};
function drawFilters(){var cats=['All'];items.forEach(function(x){if(cats.indexOf(x.cat)<0)cats.push(x.cat)});filters.innerHTML=cats.map(function(c){return '<button class="filter '+(c===active?'active':'')+'" data-f="'+c+'">'+c+'</button>'}).join('');Array.from(filters.querySelectorAll('button')).forEach(function(b){b.onclick=function(){active=b.dataset.f;drawFilters();drawGrid()}})}
function drawGrid(){var list=active==='All'?items:items.filter(function(x){return x.cat===active});grid.innerHTML=list.map(function(x){return '<article class="product"><figure><img src="'+x.img+'" alt="'+x.name+'"></figure><div class="info"><div class="meta"><span>'+x.cat+'</span><span>'+x.texture+'</span></div><h3>'+x.name+'</h3><p>'+x.copy+'</p><div class="buy"><strong>View options</strong><button data-add="'+x.name+'">Add</button></div></div></article>'}).join('');Array.from(grid.querySelectorAll('[data-add]')).forEach(function(b){b.onclick=function(){toast.textContent=b.dataset.add+' added to your Crown Room ✦';toast.classList.add('show');setTimeout(function(){toast.classList.remove('show')},1800)}})}
document.getElementById('share').onclick=async function(){var data={title:'CROWNÉ Hair',text:'Every shade. Every texture. Every crown.',url:location.href};if(navigator.share){try{await navigator.share(data)}catch(e){}}else{navigator.clipboard&&navigator.clipboard.writeText(location.href);this.textContent='Link copied ✓'}};
drawCarousel();drawFilters();drawGrid();restart();
</script>
</body></html>\`;

export async function GET() {
  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  });
}
