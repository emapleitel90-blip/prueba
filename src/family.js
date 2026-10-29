import {convertQuantity,compatible} from './units.js';
import {orderPortions} from './orders.js';

export const familyPortions=(state,day,exceptId)=>day.id?(state.family||[]).filter(x=>x.kind==='prepared'&&x.day===day.id&&(exceptId==null||x.id!==exceptId)).reduce((sum,x)=>sum+x.portions,0):0;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const positive=n=>Number.isFinite(n)&&n>0;
const whole=n=>Number.isInteger(n)&&n>0;
const text=s=>typeof s==='string'&&s.length<1000;

function quantities(state,items){
 if(!Array.isArray(items)||!items.length)throw Error('Agregá al menos un ingrediente.');
 const result=new Map();
 for(const item of items){
  const stock=state.stock.find(s=>s.id===item.id);
  if(!stock||!positive(item.qty)||!compatible(item.unit,stock.unit))throw Error('Revisá los ingredientes, las cantidades y las unidades.');
  const qty=(result.get(stock.id)||0)+convertQuantity(item.qty,item.unit,stock.unit);
  if(!positive(qty))throw Error('La cantidad es demasiado grande o demasiado pequeña.');
  result.set(stock.id,qty);
 }
 return result;
}

export function familyEntry(state,input,now){
 const previous=(state.family||[]).find(x=>x.id===input.id);
 if(!input.id||!text(input.id)||!validDate(input.date)||input.date>now)throw Error('Elegí una fecha válida, hasta hoy.');
 if(!whole(input.portions))throw Error('Ingresá una cantidad entera de porciones o personas, mayor que cero.');
 if(!text(input.detail||''))throw Error('El detalle es demasiado largo.');
 const entry={id:input.id,kind:input.kind,date:input.date,detail:input.detail||'',portions:input.portions,createdAt:previous?.createdAt||new Date().toISOString(),consumed:[]};
 if(input.kind==='prepared'){
  const day=state.days.find(d=>d.id&&d.id===input.day)||(/^day:\d+$/.test(input.day||'')?state.days[Number(input.day.slice(4))]:null);
  if(!day||input.date<day.date)throw Error('Elegí una jornada que ya estuviera preparada en la fecha del consumo.');
  const available=day.made-Math.max(day.sold,orderPortions(state,day))-familyPortions(state,day,previous?.id);
  if(input.portions>available)throw Error(`Quedan ${available} porciones disponibles de esa jornada. Revisá las ventas, los pedidos y los consumos familiares.`);
  entry.day=day.id||input.day;entry.name=day.name;entry.total=day.cost*input.portions;
 }else{
  let items;
  if(input.kind==='recipe'){
   const recipe=state.recipes.find(r=>r.id===input.recipe);
   if(!recipe)throw Error('Elegí una receta.');
   // Corregir un registro conserva la receta que efectivamente se utilizó.
   const same=previous?.kind==='recipe'&&previous.recipe===recipe.id;
   entry.recipe=recipe.id;entry.name=same?previous.name:recipe.name;
   entry.recipeYield=same?previous.recipeYield:recipe.yield;
   entry.recipeItems=structuredClone(same?previous.recipeItems:recipe.items.map(i=>({...i,unit:i.unit||state.stock.find(s=>s.id===i.id)?.unit})));
   items=entry.recipeItems.map(i=>({...i,qty:i.qty*input.portions/entry.recipeYield}));
  }else if(input.kind==='ingredients'){entry.name='Ingredientes para casa';items=input.items}
  else throw Error('Elegí el tipo de consumo familiar.');
  entry.items=structuredClone(items);
  entry.consumed=[...quantities(state,items)].map(([id,qty])=>{
   const stock=state.stock.find(s=>s.id===id),old=previous?.consumed.find(i=>i.id===id);
   const cost=old?old.cost/convertQuantity(1,old.unit,stock.unit):stock.cost;
   return {id,name:stock.name,qty,unit:stock.unit,cost};
  });
  entry.total=entry.consumed.reduce((sum,i)=>sum+i.qty*i.cost,0);
 }
 if(!Number.isFinite(entry.total)||entry.total<0)throw Error('Revisá los costos y las cantidades del consumo.');
 return entry;
}

// Una corrección devuelve el consumo anterior y descuenta el nuevo sobre el stock actual.
function updateStock(state,next,previous){
 const delta=new Map();
 for(const [entry,sign] of [[previous,1],[next,-1]])for(const item of entry?.consumed||[]){
  const stock=state.stock.find(s=>s.id===item.id);
  if(!stock)throw Error('No se encontró un ingrediente del consumo.');
  delta.set(stock.id,(delta.get(stock.id)||0)+sign*convertQuantity(item.qty,item.unit,stock.unit));
 }
 const changes=[...delta].map(([id,change])=>{
  const stock=state.stock.find(s=>s.id===id),qty=stock.qty+change;
  if(!Number.isFinite(qty))throw Error('La cantidad es demasiado grande.');
  if(qty< -1e-9)throw Error(`No alcanza el stock de ${stock.name}. Revisá la cantidad o registrá la compra.`);
  return {id,qty:Math.max(0,qty)};
 });
 for(const change of changes)state.stock.find(s=>s.id===change.id).qty=change.qty;
}

export function saveFamily(state,input,now){
 const entry=familyEntry(state,input,now),next=structuredClone(state),previous=(next.family||[]).find(x=>x.id===entry.id);
 updateStock(next,entry,previous);
 if(entry.kind==='prepared'&&!next.days.some(d=>d.id===entry.day)){
  const day=next.days[Number(entry.day.slice(4))];day.id=crypto.randomUUID();entry.day=day.id;
 }
 next.family||=[];
 const index=next.family.findIndex(x=>x.id===entry.id);
 if(index<0)next.family.push(entry);else next.family[index]=entry;
 return next;
}

export function removeFamily(state,id){
 const previous=(state.family||[]).find(x=>x.id===id);
 if(!previous)throw Error('No se encontró el consumo familiar.');
 const next=structuredClone(state);updateStock(next,null,previous);
 next.family=next.family.filter(x=>x.id!==id);
 return next;
}

export function validateFamily(state){
 if(state.family==null)return;
 if(!Array.isArray(state.family))throw Error('Historial familiar inválido.');
 const ids=new Set(),dayIds=new Set();
 for(const day of state.days)if(day.id!=null){if(!text(day.id)||!day.id||dayIds.has(day.id))throw Error('Identificador de jornada inválido.');dayIds.add(day.id)}
 for(const entry of state.family){
  if(!entry||!text(entry.id)||!entry.id||ids.has(entry.id)||!validDate(entry.date)||!text(entry.detail)||!text(entry.name)||!whole(entry.portions)||!Number.isFinite(entry.total)||entry.total<0||!Array.isArray(entry.consumed)||!text(entry.createdAt)||!Number.isFinite(Date.parse(entry.createdAt)))throw Error('Consumo familiar inválido.');
  ids.add(entry.id);
  if(entry.kind==='prepared'){
   const day=state.days.find(d=>d.id===entry.day);
   if(!day||entry.date<day.date||entry.consumed.length||Math.abs(entry.total-day.cost*entry.portions)>1e-6)throw Error('Consumo de viandas preparadas inválido.');
  }else if(['ingredients','recipe'].includes(entry.kind)){
   const qty=quantities(state,entry.items),seen=new Set();
   for(const item of entry.consumed){
    const stock=state.stock.find(s=>s.id===item.id);
    if(!stock||seen.has(item.id)||!text(item.name)||!positive(item.qty)||!compatible(item.unit,stock.unit)||!Number.isFinite(item.cost)||item.cost<0||Math.abs(convertQuantity(item.qty,item.unit,stock.unit)-(qty.get(item.id)||0))>1e-6)throw Error('Ingredientes del consumo familiar inválidos.');
    seen.add(item.id);
   }
   if(seen.size!==qty.size||Math.abs(entry.total-entry.consumed.reduce((sum,i)=>sum+i.qty*i.cost,0))>1e-6)throw Error('Costo del consumo familiar inválido.');
   if(entry.kind==='recipe'&&(!state.recipes.some(r=>r.id===entry.recipe)||!whole(entry.recipeYield)||!Array.isArray(entry.recipeItems)))throw Error('Receta familiar inválida.');
   if(entry.kind==='recipe')quantities(state,entry.recipeItems);
  }else throw Error('Tipo de consumo familiar inválido.');
 }
 for(const day of state.days)if(familyPortions(state,day)>day.made-Math.max(day.sold,orderPortions(state,day)))throw Error('Los consumos familiares superan las viandas disponibles. Revisá también los pedidos.');
}
