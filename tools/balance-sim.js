// AI-vs-AI balance simulator: runs the rules engine embedded in design/Main.dc.html headlessly.
// Usage: node tools/balance-sim.js [path/to/Main.dc.html]
const fs=require('fs');
const src=fs.readFileSync(process.argv[2] || __dirname + "/../design/Main.dc.html",'utf8');
const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
global.performance={now:()=>Date.now()};
class DCLogic{constructor(p){this.props=p||{}} setState(s){}}
const Component=new Function('DCLogic',m[1]+'\nreturn Component;')(DCLogic);
// Add variants here to test stat changes, e.g. heavier Reaver hull:
// heavierMaw:(D)=>{D.SHIPS.maw.hull=14;},
const variants={
 current:()=>{},
};
for(const [k,f] of Object.entries(variants)){
 const c=new Component({});f(c.D);
 let w={resolute:0,maw:0,draw:0},t=0,N=1500;
 for(let i=0;i<N;i++){c.newGame(true);let g=0;while(c.g.phase!=='over'&&g++<60){const pr=c.aiPlan(c.g.ships.resolute,c.g.ships.maw);c.ui.order=pr.order;c.g.dest=pr.dest;c.commitOrders();c.afterMove();c.afterFire();}
  if(c.g.phase==='over'){w[c.g.winner]++;t+=c.g.turn}}
 console.log(k.padEnd(20),JSON.stringify(w),'turns',(t/N).toFixed(1));
}
