import {recipeQuantity} from './units.js';

export function recipeCosts(recipe,stock){
 const percent=recipe.overheadPercent??0;
 if(!Number.isFinite(percent)||percent<0)throw Error('El porcentaje de gastos adicionales debe ser un número mayor o igual a cero.');
 if(!Number.isInteger(recipe.yield)||recipe.yield<=0)throw Error('Revisá el rendimiento de la receta.');
 if(!Array.isArray(recipe.items)||!recipe.items.length)throw Error('Agregá al menos un ingrediente a la receta.');
 let ingredients=0;
 for(const item of recipe.items){
  const product=stock.find(s=>s.id===item.id);
  if(!product)throw Error('No se encontró un ingrediente de la receta.');
  const qty=recipeQuantity(item,product);
  if(!Number.isFinite(qty)||qty<=0||!Number.isFinite(product.cost)||product.cost<0)throw Error('Revisá las cantidades y los precios de la receta.');
  ingredients+=qty*product.cost;
 }
 const extra=ingredients*(percent/100),total=ingredients+extra;
 if(![ingredients,extra,total].every(Number.isFinite))throw Error('El costo es demasiado grande. Revisá las cantidades o el porcentaje.');
 return {percent,ingredients,extra,total,ingredientPerPortion:ingredients/recipe.yield,extraPerPortion:extra/recipe.yield,perPortion:total/recipe.yield};
}
