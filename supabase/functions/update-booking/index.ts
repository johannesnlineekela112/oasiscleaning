import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const CUTOFF_SCHEDULE=15,CUTOFF_LOCATION=30,CUTOFF_LATE_CANCEL=30;
function parseSlotStart(s){const m=s.replace(/^VIP\s+/,"").match(/^(\d{2}):(\d{2})/);if(!m)return null;return{h:parseInt(m[1],10),m:parseInt(m[2],10)};}
function bookingToUTC(d,t){const s=parseSlotStart(t);if(!s)return null;return new Date(`${d}T${String(s.h).padStart(2,"0")}:${String(s.m).padStart(2,"0")}:00+02:00`);}
function json(body,status=200){return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"}});
  try{
    const jwt=(req.headers.get("Authorization")??"").replace(/^Bearer\s+/,"");
    if(!jwt)return json({error:"Unauthorized"},401);
    const U=Deno.env.get("SUPABASE_URL"),AK=Deno.env.get("SUPABASE_ANON_KEY"),SK=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const{data:{user},error:ae}=await createClient(U,AK).auth.getUser(jwt);
    if(ae||!user)return json({error:"Unauthorized"},401);
    const db=createClient(U,SK);
    let body;try{body=await req.json();}catch{return json({error:"Invalid JSON"},400);}
    const{bookingId,updates}=body;
    if(!bookingId||!updates)return json({error:"bookingId and updates required"},400);
    const{data:bk,error:fe}=await db.from("bookings").select("id,customer_id,booking_date,time_slot,status,is_vip").eq("id",bookingId).single();
    if(fe||!bk)return json({error:"Booking not found"},404);
    if(bk.customer_id!==user.id)return json({error:"Forbidden"},403);
    if(bk.status==="completed")return json({error:"Cannot modify completed booking"},422);
    const bUTC=bookingToUTC(bk.booking_date,bk.time_slot);
    const now=new Date();
    const min=bUTC?(bUTC.getTime()-now.getTime())/60000:-Infinity;
    if(updates.action==="cancel"){
      if(bk.status==="cancelled"||bk.status==="late_cancelled")return json({error:"Already cancelled"},422);
      const late=min<=CUTOFF_LATE_CANCEL;
      const{error:ce}=await db.from("bookings").update({status:late?"late_cancelled":"cancelled",late_cancel:late,cancelled_at:now.toISOString()}).eq("id",bookingId);
      if(ce)throw ce;
      return json({success:true,action:"cancelled",isLate:late,newStatus:late?"late_cancelled":"cancelled"});
    }
    if(bk.status==="cancelled"||bk.status==="late_cancelled")return json({error:"Cannot edit cancelled booking"},422);
    if(min<=0)return json({error:"Booking time has passed"},422);
    const p={};
    const es="booking_date"in updates||"time_slot"in updates||"service_type"in updates;
    const el="latitude"in updates||"longitude"in updates||"address_text"in updates||"area_name"in updates||"landmark"in updates;
    if(es){if(min<=CUTOFF_SCHEDULE)return json({error:`Schedule edits locked within ${CUTOFF_SCHEDULE} min`},422);["booking_date","time_slot","service_type"].forEach(k=>{if(k in updates)p[k]=updates[k];});}
    if(el){if(min<=CUTOFF_LOCATION)return json({error:`Location edits locked within ${CUTOFF_LOCATION} min`},422);["latitude","longitude","address_text","area_name","landmark"].forEach(k=>{if(k in updates)p[k]=updates[k];});}
    if(!Object.keys(p).length)return json({error:"No valid fields"},400);
    if("time_slot"in p)p.is_vip=String(p.time_slot).startsWith("VIP");
    const{error:ue}=await db.from("bookings").update(p).eq("id",bookingId);
    if(ue)throw ue;
    return json({success:true,action:"updated",updatedFields:Object.keys(p)});
  }catch(e){const m=e instanceof Error?e.message:"Unknown error";console.error("[update-booking]",m);return json({error:m},500);}
});
