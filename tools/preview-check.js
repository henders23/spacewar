// Checks the firing-preview maths (expectedVolley) against 20,000 simulated volleys through the real gunnery code.
// Usage: node tools/preview-check.js [design/Main.dc.html]
const fs=require('fs');const src=fs.readFileSync(process.argv[2]||__dirname+"/../design/Main.dc.html","utf8");const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
global.performance={now:()=>Date.now()};class DCLogic{constructor(p){this.props=p||{}} setState(){}}
const C=new Function("DCLogic",m[1]+"\nreturn Component;")(DCLogic);const c=new C({});c.autoAll=true;let g;
const scen=[
 ['Resolute port broadside vs Maw beam-on @15u', {resolute:{x:0,y:0,h:0},maw:{x:0,y:15,h:0}}, 'auto','steady'],
 ['Resolute vs Maw bow-on (narrow) @20u', {resolute:{x:0,y:0,h:0},maw:{x:0,y:20,h:-Math.PI/2}}, 'auto','steady'],
 ['Maw lance+turrets fore vs Resolute @10u', {maw:{x:0,y:0,h:0},resolute:{x:10,y:0,h:Math.PI/2}}, 'auto','lock'],
 ['Resolute brace (half dice) @12u', {resolute:{x:0,y:0,h:0},maw:{x:0,y:12,h:0}}, 'auto','brace'],
];
for(const [name,pos,tgt,order] of scen){
  c.newGame(true); g=c.g;
  // park the other ships far away so only the pair interacts
  Object.assign(g.ships.vigilant,{x:-58,y:-38});Object.assign(g.ships.carrion,{x:58,y:-38});
  for(const id in pos) Object.assign(g.ships[id],pos[id]);
  const A=Object.keys(pos)[0],B=Object.keys(pos)[1];
  const snap=(s)=>({id:s.id,def:s.def,crits:s.crits,hull:s.hull,x:s.x,y:s.y,h:s.h});
  const exp=c.expectedVolley(snap(g.ships[A]),[snap(g.ships[B])],order,tgt)[B];
  let tot=0,N=20000;g.orders={};g.orders[A]={order:order,target:tgt};
  for(let i=0;i<N;i++){const pend=c.perShip(()=>({dmg:0,crits:[],shield:{fore:0,port:0,stbd:0,aft:0}}));g.tray=[];g.turnRolls=c.perShip(()=>[]);
    const it=c.attackSeq(g.ships[A],order,pend);let r=it.next();while(!r.done){r=it.next(r.value.type==='roll'?c.rollN(r.value.n):undefined);}
    tot+=pend[B].dmg-pend[B].crits.filter(k=>k.k==='breach').length;}
  console.log(name.padEnd(46),'preview',exp?exp.dmg.toFixed(3):'none','| simulated',(tot/N).toFixed(3),'|',exp?exp.detail:'');
}
