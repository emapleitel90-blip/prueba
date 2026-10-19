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
export function changeStockUnit(state,id,to){
 const old=state.stock.find(s=>s.id===id);if(!old)throw Error('El ingrediente no existe.');
 if(old.unit===to)return state;
 if(!compatible(old.unit,to))throw Error('No se puede cambiar peso por volumen o unidades. Creá otro producto para esa medida.');
 const next=structuredClone(state),stock=next.stock.find(s=>s.id===id),from=old.unit;
 stock.qty=convertQuantity(stock.qty,from,to);stock.min=convertQuantity(stock.min,from,to);
 stock.cost=stock.cost/convertQuantity(1,from,to);stock.unit=to;
 // Completar unidades ausentes conserva el significado de los registros anteriores.
 for(const recipe of next.recipes)for(const item of recipe.items)if(item.id===id&&!item.unit)item.unit=from;
 for(const expense of next.expenses)if(expense.ingredient===id&&!expense.unit)expense.unit=from;
 for(const day of next.days)for(const item of day.consumed||[])if(item.id===id&&!item.unit)item.unit=from;
 return next;
}
