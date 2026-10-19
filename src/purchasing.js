import {convertQuantity} from './units.js';

// La cantidad de un paquete se define explícitamente: nunca se supone que pesa 1 kg.
export function packageQuantity(count,size,unit,target){
 if(!Number.isInteger(count)||count<=0||!Number.isFinite(size)||size<=0)throw Error('Revisá la cantidad de paquetes y el contenido de cada uno.');
 const qty=convertQuantity(count*size,unit,target);
 if(!Number.isFinite(qty)||qty<=0)throw Error('La cantidad es demasiado grande o demasiado pequeña.');
 return qty;
}

// Se aplica solo la diferencia, para conservar los consumos posteriores a una compra.
// Primero se valida todo: un error no puede dejar una actualización parcial.
export function purchaseChanges(stock,next,previous){
 const deltas=new Map();
 for(const [movement,sign] of [[previous,-1],[next,1]])if(movement?.kind==='stock'){
  const item=stock.find(i=>i.id===movement.ingredient);
  if(!item)throw Error('El ingrediente no existe.');
  if(!Number.isFinite(movement.qty)||movement.qty<=0||!Number.isFinite(movement.total)||movement.total<=0)throw Error('La cantidad y el total pagado deben ser mayores que cero.');
  const qty=convertQuantity(movement.qty,movement.unit||item.unit,item.unit);
  deltas.set(item.id,(deltas.get(item.id)||0)+sign*qty);
 }
 const changes=[...deltas].map(([id,delta])=>{
  const item=stock.find(i=>i.id===id),qty=item.qty+delta;
  if(!Number.isFinite(qty))throw Error('La cantidad es demasiado grande.');
  if(qty< -1e-8)throw Error('Esta corrección dejaría stock negativo. Revisá primero los consumos y la cantidad disponible.');
  return {id,qty:Math.max(0,qty)};
 });
 if(next?.kind==='stock'){
  const item=stock.find(i=>i.id===next.ingredient);
  const cost=next.total/convertQuantity(next.qty,next.unit||item.unit,item.unit);
  if(!Number.isFinite(cost)||cost<=0)throw Error('Revisá el precio de la compra.');
  changes.find(x=>x.id===item.id).cost=cost;
 }
 return changes;
}
