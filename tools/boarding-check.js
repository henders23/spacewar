// Checks the Risk-style boarding odds against the classic Risk exchange probabilities, then counts
// rams, boarding actions and captures across AI-vs-AI battles.  Usage: node tools/boarding-check.js [design/Main.dc.html] [battles]
const fs=require('fs');const src=fs.readFileSync(process.argv[2]||__dirname+"/../design/Main.dc.html","utf8");const m=src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
global.performance={now:()=>Date.now()};class DCLogic{constructor(p){this.props=p||{}} setState(){}}
const C=new Function("DCLogic",m[1]+"\nreturn Component;")(DCLogic);const c=new C({});c.autoAll=true;
// Classic Risk single-exchange odds: 3v2 attacker wins both = 2890/7776 = 0.372; defender wins both = 2275/7776 = 0.293
const t=c.riskTable(3,2);console.log('3v2 exchange: att wins both',t['0,2'].toFixed(3),'(0.372) split',t['1,1'].toFixed(3),'(0.336) def wins both',t['2,0'].toFixed(3),'(0.293)');
console.log('1v1 attacker wins',c.riskTable(1,1)['0,1'].toFixed(3),'(0.417)');
console.log('capture odds: 7 vs 4 =',c.boardOdds(7,4).toFixed(2),'| 5 vs 6 =',c.boardOdds(5,6).toFixed(2),'| 3 vs 3 =',c.boardOdds(3,3).toFixed(2),'| 7 vs 2 =',c.boardOdds(7,2).toFixed(2));
let rams=0,boards=0,caps=0,N=+(process.argv[3]||600),w={concord:0,reaver:0,draw:0},turns=0,errs=0;
const origRam=c.ramSeq.bind(c),origBoard=c.boardSeq.bind(c);
c.ramSeq=function*(A,B){rams++;yield* origRam(A,B);};
c.boardSeq=function*(A,B,f){const before=A.crew;yield* origBoard(A,B,f);if(A.crew<before||B.captured)boards++;};
for(let i=0;i<N;i++){c.newGame(true);let g=0;
  while(c.g.phase!=='over'&&g++<60){try{c.aiOrders('concord');c.aiOrders('reaver');c.beginMovement();c.afterMove();}catch(e){errs++;if(errs<3)console.log(e.stack.split('\n').slice(0,4).join('\n'));break;}}
  caps+=c.ids().filter(id=>c.g.ships[id].captured).length;if(c.g.phase==='over'){w[c.g.winner]++;turns+=c.g.turn;}}
console.log(N,'battles:',JSON.stringify(w),'avg turns',(turns/N).toFixed(1),'| rams',rams,'boarding actions',boards,'captures',caps,'| errors',errs);
