// Plays every Operation Iron Tide mission AI-vs-AI through the battle board's engine and checks the save write-back.
// The Concord AI only fights (it ignores objectives), so escort/raid/breakthrough wins are rare here: this checks
// that missions start, end and score cleanly, not how winnable they are for a player.
// Usage: node tools/campaign-sim.js [path/to/Main.dc.html] [games per mission]
const fs=require('fs');
const src=fs.readFileSync(process.argv[2] || __dirname + '/../design/Main.dc.html','utf8');
const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
global.performance={now:()=>Date.now()};
class DCLogic{constructor(p){this.props=p||{}} setState(s){this.state={...this.state,...s}}}
const Component=new Function('DCLogic',m[1]+'\nreturn Component;')(DCLogic);
const c=new Component({mode:"Versus AI"});c.autoAll=true;
const fresh=()=>({v:1,op:'iron_tide',credits:600,renown:0,done:{},docked:'start',current:null,mods:{},
 fleet:[{id:'resolute',cls:'resolute',name:'CNS Resolute',hull:14,crew:8,crits:[],fit:{},battles:0,captain:'Cdr. Varga'},
        {id:'vigilant',cls:'vigilant',name:'CNS Vigilant',hull:8,crew:6,crits:[],fit:{},battles:0,captain:'Lt. Rheel'}]});
const N=+(process.argv[3]||60);
for(const code of ['m1','m2a','m2b','m3','m4','m5']){
  const st={won:0,lost:0,turns:0,err:0,credits:0,prizes:0,shipsLost:0,noEnd:0};
  for(let k=0;k<N;k++){
    c.save=fresh(); if(code==='m4'||code==='m5') c.save.fleet[0].fit={a:'drives'};
    c.startMission(code); let guard=0;
    while(c.g.phase!=='over'&&guard++<40){
      try{ c.aiOrders('concord');c.aiOrders('reaver');c.beginMovement();c.afterMove(); if(k===0&&guard===1) c.renderVals(); }catch(x){st.err++; if(st.err<2) console.log(code,x.stack.split('\n').slice(0,5).join('\n')); break;}
    }
    if(c.g.phase!=='over'){st.noEnd++;continue;}
    const d=c.save.debrief; if(!d){st.noEnd++;continue;}
    d.won?st.won++:st.lost++; st.turns+=c.g.turn; st.credits+=d.credits; st.prizes+=d.prizes.length; st.shipsLost+=d.lost.length;
    if(k===0) console.log(code,'sample debrief',JSON.stringify({won:d.won,lines:d.lines.map(l=>(l.ok?'✓ ':'✗ ')+l.text),cr:d.credits,lost:d.lost,prizes:d.prizes,fleet:c.save.fleet.map(f=>f.name+' '+f.hull+'h/'+f.crew+'c'),done:c.save.done}));
  }
  console.log(code.toUpperCase(),JSON.stringify(st),'avg turns',(st.turns/Math.max(1,st.won+st.lost)).toFixed(1));
}
