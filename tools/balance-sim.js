// AI-vs-AI balance simulator: runs the rules engine embedded in design/Main.dc.html headlessly.
// Usage: node tools/balance-sim.js [path/to/Main.dc.html] [games]
const fs=require('fs');
const src=fs.readFileSync(process.argv[2] || __dirname + "/../design/Main.dc.html",'utf8');
const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
global.performance={now:()=>Date.now()};
class DCLogic{constructor(p){this.props=p||{}} setState(s){}}
const Component=new Function('DCLogic',m[1]+'\nreturn Component;')(DCLogic);
const N=+(process.argv[3]||1500);
// Add variants here to test stat changes, e.g. tougherRaider:(D)=>{D.SHIPS.carrion.hull=10;},
const variants=JSON.parse(process.env.VARIANTS_JSON||'null')||{current:''};
for(const [k,code] of Object.entries(variants)){
  const c=new Component({});c.autoAll=true;if(code) new Function('D',code)(c.D);
  const w={concord:0,reaver:0,draw:0};let t=0;
  for(let i=0;i<N;i++){c.newGame(true);let g=0;while(c.g.phase!=='over'&&g++<60){c.aiOrders('concord');c.aiOrders('reaver');c.beginMovement();c.afterMove();}
    if(c.g.phase==='over'){w[c.g.winner]++;t+=c.g.turn}}
  console.log(k.padEnd(20),JSON.stringify(w),'turns',(t/N).toFixed(1));
}
