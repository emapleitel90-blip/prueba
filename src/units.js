// Las cantidades se convierten dentro de su dimensión; no se inventan densidades.
const definitions={kg:{family:'mass',factor:1000,label:'kg (kilogramos)'},g:{family:'mass',factor:1,label:'g (gramos)'},litro:{family:'volume',factor:1000,label:'L (litros)'},ml:{family:'volume',factor:1,label:'ml (mililitros)'},unidad:{family:'count',factor:1,label:'unidad'}};
export const units=Object.keys(definitions);
export const unitLabel=unit=>definitions[unit]?.label||unit;
export const compatibleUnits=unit=>units.filter(candidate=>definitions[candidate].family===definitions[unit]?.family);
export const compatible=(from,to)=>Boolean(definitions[from]&&definitions[to]&&definitions[from].family===definitions[to].family);
export function convertQuantity(quantity,from,to){
 if(!Number.isFinite(quantity)||!compatible(from,to))throw Error('Elegí unidades compatibles: gramos con kilos, o mililitros con litros. Las unidades no se convierten a peso o volumen.');
 if(from===to)return quantity;
 const result=quantity*definitions[from].factor/definitions[to].factor;
 if(!Number.isFinite(result))throw Error('La cantidad es demasiado grande.');
 return result;
}
export const formatQuantity=(quantity,unit)=>quantity.toLocaleString('es-AR',{minimumFractionDigits:['kg','litro'].includes(unit)?3:0,maximumFractionDigits:6});
export const inputQuantity=(quantity,unit)=>(['kg','litro'].includes(unit)&&Math.abs(quantity)<1e21&&Number(quantity.toFixed(3))===quantity?quantity.toFixed(3):quantity.toLocaleString('en-US',{useGrouping:false,maximumSignificantDigits:21})).replace('.',',');
export function recipeQuantity(item,stock){return convertQuantity(item.qty,item.unit||stock.unit,stock.unit)}
// Para corregir otra dimensión hace falta una equivalencia explícita por producto.
export function stockUnitFactor(from,to,equivalence){
 if(compatible(from,to))return convertQuantity(1,from,to);
 if(!units.includes(from)||!units.includes(to)||!equivalence||!Number.isFinite(equivalence.quantity)||equivalence.quantity<=0||!compatible(equivalence.unit,to))throw Error('Indicá a cuánto equivale cada unidad actual en la nueva medida. Ej.: 1 unidad = 900 ml.');
 const factor=convertQuantity(equivalence.quantity,equivalence.unit,to);
 if(!Number.isFinite(factor)||factor<=0)throw Error('La equivalencia es demasiado grande o demasiado pequeña.');
 return factor;
}
export function changeStockUnit(state,id,to,equivalence){
 const old=state.stock.find(s=>s.id===id);if(!old)throw Error('El ingrediente no existe.');
 if(old.unit===to)return state;
 const from=old.unit,factor=stockUnitFactor(from,to,equivalence),cross=!compatible(from,to);
 const next=structuredClone(state),stock=next.stock.find(s=>s.id===id);
 const scale=(value,factor)=>{const result=value*factor;if(!Number.isFinite(result)||(value>0&&result<=0))throw Error('La conversión es demasiado grande o demasiado pequeña.');return result};
 const rescale=item=>{const ratio=convertQuantity(1,item.unit||from,from)*factor;item.qty=scale(item.qty,ratio);if(item.cost!=null)item.cost=scale(item.cost,1/ratio);item.unit=to};
 stock.qty=scale(stock.qty,factor);stock.min=scale(stock.min,factor);
 stock.cost=scale(stock.cost,1/factor);stock.unit=to;
 if(cross){
  // Las cantidades cambian juntas; los totales pagados y costos históricos no se recalculan.
  for(const recipe of next.recipes)for(const item of recipe.items)if(item.id===id)rescale(item);
  for(const expense of next.expenses)if(expense.ingredient===id){
   if(expense.packages){const pack={qty:expense.packages.size,unit:expense.packages.unit};rescale(pack);expense.packages.size=pack.qty;expense.packages.unit=to}
   rescale(expense);
  }
  for(const day of next.days)for(const item of day.consumed||[])if(item.id===id)rescale(item);
  for(const entry of next.family||[])for(const key of ['items','recipeItems','consumed'])for(const item of entry[key]||[])if(item.id===id)rescale(item);
  stock.unitCorrections=[...(stock.unitCorrections||[]),{from,to,quantity:factor,at:new Date().toISOString()}];
  return next;
 }
 // Completar unidades ausentes conserva el significado de los registros anteriores.
 for(const recipe of next.recipes)for(const item of recipe.items)if(item.id===id&&!item.unit)item.unit=from;
 for(const expense of next.expenses)if(expense.ingredient===id&&!expense.unit)expense.unit=from;
 for(const day of next.days)for(const item of day.consumed||[])if(item.id===id&&!item.unit)item.unit=from;
 return next;
}
