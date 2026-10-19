import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packageQuantity,purchaseChanges} from '../src/purchasing.js';
test('contenido de paquetes respeta peso, volumen y unidades',()=>{
 assert.equal(packageQuantity(15,500,'g','kg'),7.5);
 assert.equal(packageQuantity(5,1,'kg','g'),5000);
 assert.equal(packageQuantity(6,250,'ml','litro'),1.5);
 assert.equal(packageQuantity(4,6,'unidad','unidad'),24);
 for(const args of [[0,1,'kg','kg'],[2.5,1,'kg','kg'],[2,0,'kg','kg'],[2,1,'unidad','kg'],[1e308,100,'kg','kg']])assert.throws(()=>packageQuantity(...args));
});
test('una reposición valida todos los cambios antes de modificar stock o precio',()=>{
 const stock=[{id:'a',unit:'kg',qty:3,cost:980},{id:'b',unit:'kg',qty:1,cost:500}],before=structuredClone(stock);
 const previous={kind:'stock',ingredient:'a',qty:1,unit:'kg',total:980};
 assert.deepEqual(purchaseChanges(stock,{kind:'stock',ingredient:'a',qty:500,unit:'g',total:325},previous),[{id:'a',qty:2.5,cost:650}]);
 assert.deepEqual(stock,before);
 assert.throws(()=>purchaseChanges(stock,{kind:'stock',ingredient:'b',qty:2,unit:'kg',total:1000},{...previous,qty:5}),/negativo/);
 assert.deepEqual(stock,before);
 assert.throws(()=>purchaseChanges(stock,{kind:'stock',ingredient:'a',qty:0,unit:'kg',total:5}),/mayores/);
 assert.throws(()=>purchaseChanges([{id:'a',unit:'kg',qty:1e308,cost:2}],{kind:'stock',ingredient:'a',qty:1e308,unit:'kg',total:5}),/grande/);
 assert.deepEqual(stock,before);
});
