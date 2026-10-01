(()=>{'use strict';
const API='https://txjuiaiwffsxfcrxpkvd.supabase.co/functions/v1/line-service-hub-web';
const KEY='linehub.cloudStaffToken';
const $=id=>document.getElementById(id);
async function call(body){const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const d=await r.json().catch(()=>({success:false,error:'ระบบตอบกลับไม่ถูกต้อง'}));if(!r.ok||d.success===false)throw new Error(d.error||'ไม่สามารถเชื่อมต่อระบบได้');return d}
function session(){return sessionStorage.getItem(KEY)||''}
function clear(){sessionStorage.removeItem(KEY);$('appCard').classList.add('hidden');$('loginCard').classList.remove('hidden');$('password').value=''}
function ageSec(v){if(!v)return Infinity;return Math.max(0,(Date.now()-new Date(v).getTime())/1000)}
function when(v){return v?new Date(v).toLocaleString('th-TH'):'ยังไม่มีข้อมูล'}
function statusCard(title,value,detail,state='neutral'){const el=document.createElement('article');el.className='status '+state;const a=document.createElement('small');a.textContent=title;const b=document.createElement('strong');b.textContent=value;const c=document.createElement('span');c.textContent=detail;el.append(a,b,c);return el}
function renderOps(s){
 const grid=$('opsGrid');grid.replaceChildren();
 const local=s.local||{},sync=s.sync||{},queue=s.queue||{};
 const hbAge=ageSec(local.heartbeat_at),localFresh=local.online===true&&hbAge<=90,connectorFresh=local.connector_ok===true&&hbAge<=90;
 grid.append(
   statusCard('Local Hub',localFresh?'ออนไลน์':'ออฟไลน์',local.heartbeat_at?'Heartbeat '+when(local.heartbeat_at):'ยังไม่มี heartbeat',localFresh?'good':'warn'),
   statusCard('JHCIS Connector',connectorFresh?'พร้อม':'ไม่พร้อม',local.heartbeat_at?'สถานะจาก heartbeat ล่าสุด':'ยังไม่มีข้อมูล',connectorFresh?'good':'warn'),
   statusCard('รอเชื่อมบัญชี',String(queue.pending_registration||0),'คำขอ Cloud pending',Number(queue.pending_registration||0)===0?'good':'attention'),
   statusCard('รออนุมัติครอบครัว',String(queue.pending_family||0),'คำขอวัยผู้ใหญ่',Number(queue.pending_family||0)===0?'good':'attention'),
   statusCard('นัดอนาคตบน Cloud',String(sync.active_appointments||0),'ช่วง 1 ปีข้างหน้า','neutral'),
   statusCard('Patient snapshot',ageSec(sync.patient_snapshot_at)<=900?'ล่าสุด':'ควรตรวจ',when(sync.patient_snapshot_at),ageSec(sync.patient_snapshot_at)<=900?'good':'warn'),
   statusCard('Appointment snapshot',ageSec(sync.appointment_snapshot_at)<=900?'ล่าสุด':'ควรตรวจ',when(sync.appointment_snapshot_at),ageSec(sync.appointment_snapshot_at)<=900?'good':'warn'),
   statusCard('Household snapshot',ageSec(sync.household_snapshot_at)<=900?'ล่าสุด':'ควรตรวจ',when(sync.household_snapshot_at),ageSec(sync.household_snapshot_at)<=900?'good':'warn')
 );
 $('opsUpdated').textContent='Cloud status อัปเดต '+when(s.generated_at);
}
function row(item){const wrap=document.createElement('article');wrap.className='request';const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.masked_name||'สมาชิกครอบครัว';const meta=document.createElement('p');meta.textContent=item.requested_at?'ขอเมื่อ '+new Date(item.requested_at).toLocaleString('th-TH'):'รอตรวจสอบ';info.append(name,meta);const acts=document.createElement('div');acts.className='actions';for(const [label,approve,cls] of [['อนุมัติ',true,''],['ปฏิเสธ',false,'secondary']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.onclick=async()=>{if(!confirm((approve?'อนุมัติ':'ปฏิเสธ')+'คำขอนี้?'))return;b.disabled=true;$('appMsg').textContent='กำลังบันทึก...';try{await call({action:'family-decide',token:session(),line_user_hash:item.line_user_hash,member_patient_ref:item.member_patient_ref,approve});$('appMsg').textContent=approve?'อนุมัติแล้ว และ Cloud แจ้งผู้ใช้ทาง LINE':'ปฏิเสธคำขอแล้ว';await load()}catch(e){$('appMsg').textContent=e.message}finally{b.disabled=false}};acts.append(b)}wrap.append(info,acts);return wrap}
async function load(){const token=session();if(!token)return clear();$('appMsg').textContent='';$('list').replaceChildren();try{const [snap,ops,fam]=await Promise.all([call({action:'snapshot',token}),call({action:'operations-status',token}),call({action:'family-pending',token})]);$('who').textContent=(snap.profile?.displayName||snap.profile?.adminId||'เจ้าหน้าที่')+' · '+(snap.profile?.role||'');renderOps(ops.status||{});const items=fam.items||[];if(!items.length){const e=document.createElement('div');e.className='empty';e.textContent='ไม่มีคำขอรออนุมัติ';$('list').append(e)}else items.forEach(x=>$('list').append(row(x)));$('loginCard').classList.add('hidden');$('appCard').classList.remove('hidden')}catch(e){$('appMsg').textContent=e.message;if(/เซสชัน/.test(e.message))clear()}}
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginMsg').textContent='';const b=e.submitter;b.disabled=true;try{const r=await call({action:'login',username:$('username').value,password:$('password').value});sessionStorage.setItem(KEY,r.token);$('password').value='';await load()}catch(err){$('loginMsg').textContent=err.message}finally{b.disabled=false}};
$('refreshBtn').onclick=load;$('logoutBtn').onclick=clear;load();
})();