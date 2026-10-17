import { createClient } from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloud=url&&key?createClient(url,key):null;
export async function readShared(){
 const {data,error}=await cloud.from('filo_data').select('payload,version').eq('id','familia').maybeSingle();
 if(error)throw error;
 if(!data)throw Error('No hay acceso a los datos. Revisá la tabla de correos autorizados y ejecutá setup.sql.');
 return data;
}
export async function writeShared(payload,version){
 const {data,error}=await cloud.from('filo_data').update({payload,version:version+1,updated_at:new Date().toISOString()}).eq('id','familia').eq('version',version).select('version').maybeSingle();
 if(error)throw error;
 if(!data)throw Error('Otra persona guardó cambios o cambió tu acceso. Tu borrador se conserva en este dispositivo. Actualizá los datos compartidos antes de volver a editar.');
 return data.version;
}
