export const orderStatuses={pending:'Pendiente',ready:'Listo',delivered:'Entregado',cancelled:'Cancelado'};
export const orderPortions=(state,day,exceptId)=>day.id?(state.orders||[]).filter(o=>o.day===day.id&&o.status!=='cancelled'&&o.id!==exceptId).reduce((sum,o)=>sum+o.portions,0):0;
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
const text=(value,max)=>typeof value==='string'&&value.length<=max;
const familyCount=(state,day)=>(state.family||[]).filter(f=>f.kind==='prepared'&&f.day===day.id).reduce((sum,f)=>sum+f.portions,0);
const findDay=(state,reference)=>state.days.find(d=>d.id&&d.id===reference)||(/^day:\d+$/.test(reference||'')?state.days[Number(reference.slice(4))]:null);

function validateOrder(state,order){
 const recipe=state.recipes.find(r=>r.id===order?.recipe);
 if(!order||!text(order.id,200)||!order.id||!recipe||!text(order.name,999)||!order.name||!text(order.customer,120)||!order.customer.trim()||!Number.isSafeInteger(order.portions)||order.portions<=0||!validDate(order.date)||!Object.hasOwn(orderStatuses,order.status))throw Error('Revisá el cliente, el menú, la fecha y la cantidad entera de porciones.');
 if(!['pickup','delivery'].includes(order.fulfillment)||!text(order.address,500)||(order.fulfillment==='delivery'&&!order.address.trim())||(order.fulfillment==='pickup'&&order.address!==''))throw Error('Elegí retiro o entrega. Para entrega, completá la dirección.');
 if(!text(order.phone,100)||!text(order.notes,1000)||!text(order.time,5)||(order.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(order.time)))throw Error('Revisá el teléfono, el horario y las observaciones.');
 for(const key of ['createdAt','updatedAt'])if(!text(order[key],100)||!Number.isFinite(Date.parse(order[key])))throw Error('El pedido tiene una fecha de carga inválida.');
 if(order.day!=null){
  const day=state.days.find(d=>d.id&&d.id===order.day);
  if(!day||day.recipe!==order.recipe||day.date>order.date)throw Error('Elegí una jornada del mismo menú, preparada hasta la fecha del pedido.');
 }
}

export function validateOrders(state){
 if(state.orders==null)return;
 if(!Array.isArray(state.orders)||state.orders.length>10000)throw Error('El listado de pedidos no es válido.');
 const ids=new Set(),dayIds=new Set();
 for(const day of state.days)if(day.id!=null){if(!text(day.id,999)||!day.id||dayIds.has(day.id))throw Error('Identificador de jornada inválido.');dayIds.add(day.id)}
 for(const order of state.orders){validateOrder(state,order);if(ids.has(order.id))throw Error('Hay pedidos repetidos.');ids.add(order.id)}
 for(const day of state.days)if(orderPortions(state,day)+familyCount(state,day)>day.made)throw Error(`Los pedidos de ${day.name} superan las porciones preparadas para el negocio. Revisá las cantidades o asigná otra jornada.`);
}

export function saveOrder(state,input){
 const previous=(state.orders||[]).find(o=>o.id===input.id),next=structuredClone(state);
 const recipe=next.recipes.find(r=>r.id===input.recipe),day=input.day?findDay(next,input.day):null;
 if(input.day&&!day)throw Error('No se encontró la jornada del pedido.');
 if(day&&!day.id)day.id=crypto.randomUUID();
 const trim=value=>typeof value==='string'?value.trim():'';
 const now=new Date().toISOString(),order={id:input.id,recipe:input.recipe,name:day?.name||(previous?.recipe===input.recipe?previous.name:recipe?.name),customer:trim(input.customer),portions:input.portions,date:input.date,fulfillment:input.fulfillment,address:input.fulfillment==='delivery'?trim(input.address):'',phone:trim(input.phone),time:trim(input.time),notes:trim(input.notes),status:input.status,createdAt:previous?.createdAt||now,updatedAt:now};
 if(day)order.day=day.id;
 next.orders||=[];
 const index=next.orders.findIndex(o=>o.id===order.id);
 if(index<0)next.orders.push(order);else next.orders[index]=order;
 validateOrders(next);
 return next;
}

export function removeOrder(state,id){
 if(!(state.orders||[]).some(o=>o.id===id))throw Error('No se encontró el pedido.');
 const next=structuredClone(state);next.orders=next.orders.filter(o=>o.id!==id);return next;
}
