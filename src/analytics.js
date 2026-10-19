import {familyPortions} from './family.js';
// Los importes de ventas se consideran cobrados: aún no se registran deudas.
export function previousMonth(month){const [y,m]=month.split('-').map(Number);return `${m===1?y-1:y}-${String(m===1?12:m-1).padStart(2,'0')}`;}
function endOfMonth(month){const [y,m]=month.split('-').map(Number);return new Date(y,m,0).getDate();}
export function report(state,month,now){
 const current=month===now.slice(0,7),last=current?Number(now.slice(8,10)):endOfMonth(month);
 const prev=previousMonth(month),priorLast=current?Math.min(last,endOfMonth(prev)):endOfMonth(prev);
 const total=(period,limit)=>{
  const until=`${period}-${String(limit).padStart(2,'0')}`;
  const days=state.days.filter(d=>d.date.startsWith(period)&&d.date<=until&&d.date<=now);
  const expenses=state.expenses.filter(e=>e.date.startsWith(period)&&e.date<=until&&e.date<=now);
  const family=(state.family||[]).filter(e=>e.date.startsWith(period)&&e.date<=until&&e.date<=now);
  const homePortions=d=>familyPortions({...state,family:(state.family||[]).filter(e=>e.date<=now)},d);
  const sales=days.reduce((s,d)=>s+d.sold*d.price,0),production=days.reduce((s,d)=>s+(d.made-homePortions(d))*d.cost,0),outflow=expenses.reduce((s,e)=>s+e.total,0),other=expenses.filter(e=>e.kind==='other').reduce((s,e)=>s+e.total,0),made=days.reduce((s,d)=>s+d.made,0),sold=days.reduce((s,d)=>s+d.sold,0),atHome=days.reduce((s,d)=>s+homePortions(d),0),familyCost=family.reduce((sum,e)=>sum+e.total,0);
  const menus=new Map();for(const d of days){const m=menus.get(d.recipe)||{id:d.recipe,name:d.name,made:0,sold:0,family:0,sales:0,cost:0,dates:new Set()},home=homePortions(d);m.made+=d.made;m.sold+=d.sold;m.family+=home;m.sales+=d.sold*d.price;m.cost+=(d.made-home)*d.cost;m.dates.add(d.date);menus.set(d.recipe,m)}
  const categories=new Map();for(const e of expenses){const category=e.category||(e.kind==='stock'?'Ingredientes e insumos':'Otros gastos');categories.set(category,(categories.get(category)||0)+e.total)}
  return {days,expenses,family,familyCost,atHome,sales,production,outflow,other,made,sold,left:made-sold-atHome,profit:sales-production-other,cash:sales-outflow,dates:new Set(days.map(d=>d.date)).size,sellThrough:made-atHome?sold/(made-atHome):null,margin:sales?(sales-production-other)/sales:null,menus:[...menus.values()].map(m=>({...m,dates:m.dates.size,contribution:m.sales-m.cost,perSold:m.sold?(m.sales-m.cost)/m.sold:null})).sort((a,b)=>b.contribution-a.contribution),categories:[...categories].sort((a,b)=>b[1]-a[1])};
 };
 const currentData=total(month,last),previous=total(prev,priorLast);let cursor=month;const trend=[];for(let i=0;i<6;i++){const t=total(cursor,cursor===now.slice(0,7)?Number(now.slice(8,10)):endOfMonth(cursor));trend.unshift({month:cursor,sales:t.sales,sold:t.sold,dates:t.dates,profit:t.profit});cursor=previousMonth(cursor)}
 return {...currentData,previous,trend,month,current,comparisonLabel:current?`Del 1 al ${last}; mes anterior del 1 al ${priorLast}`:'Mes completo contra mes completo'};
}
export function advice(r){
 const result=[];
 if(!r.days.length)return [{title:'Empezá con un registro diario',text:'Cargá el menú, las porciones preparadas y las vendidas. Con varios días podremos distinguir patrones de un día aislado.'}];
 if(r.dates<3||r.sold<10)result.push({title:'Todavía hay pocos datos',text:'Antes de cambiar precios o cantidades, registrá al menos 3 días y 10 ventas. Las señales de abajo son orientativas.'});
 if(r.left>0)result.push({title:`Quedaron ${r.left} viandas sin vender`,text:r.dates>=3&&r.sellThrough<.85?'Probá tomar reservas hasta una hora de corte. Ajustá el lote a los pedidos confirmados y un pequeño extra; revisá el resultado durante una semana.':'Registrá si esos sobrantes se aprovecharon o se perdieron. Por ahora su costo se incluye completo en producción; no todo sobrante representa desperdicio.'});
 const negative=r.menus.filter(m=>m.contribution<0);if(negative.length)result.push({title:`Revisar ${negative[0].name}`,text:'Las ventas de este menú no cubrieron la producción registrada. Revisá cantidades, sobrantes, porción, envase y precio antes de ofrecer descuentos. Aún faltan los gastos generales.'});
 const candidates=r.menus.filter(m=>m.dates>=2&&m.sold>=10&&m.contribution>0);if(candidates.length>1){const best=[...candidates].sort((a,b)=>b.perSold-a.perSold)[0];result.push({title:`Probar una preventa de ${best.name}`,text:'Entre los menús con al menos 2 días y 10 ventas, deja la mayor contribución por vianda vendida. Ofrecelo por reserva y medí cuántos pedidos consigue antes de aumentar producción.'});}
 if(!r.other)result.push({title:'Completá los costos de la cocina',text:'Todavía no hay otros gastos cargados en este período. Registrá gas, reparto, limpieza y el trabajo familiar para que el resultado no parezca mayor de lo real.'});
 if(r.previous.dates&&r.dates>=3&&r.previous.dates>=3){const daily=r.sold/r.dates,prior=r.previous.sold/r.previous.dates;if(prior>0)result.push({title:daily>=prior?'Más ventas por día registrado':'Menos ventas por día registrado',text:`Promedio actual: ${daily.toFixed(1)} viandas; anterior: ${prior.toFixed(1)}. Compará también los días sin ventas y las jornadas que faltan cargar; no es una predicción de demanda.`});}
 result.push({title:'Una rutina comercial simple',text:'Publicá el menú y precio el día anterior, pedí reserva y horario de entrega, y anotá cuántas consultas se convierten en pedidos. Probá un solo cambio por semana para saber qué funciona.'});
 return result;
}
