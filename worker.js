/* =====================================================================
   وسيط آمن بين موقع طموح و Gemini (Cloudflare Workers - خطة مجانية)
   خطوات التشغيل (10 دقائق):
   1) aistudio.google.com  ->  Get API key  (انسخ المفتاح، لا ترسله لأحد)
   2) dash.cloudflare.com -> Workers & Pages -> Create -> Hello World -> Deploy
      ثم Edit code والصق هذا الملف كاملًا ثم Deploy
   3) Settings -> Variables and Secrets:
        GEMINI_API_KEY  (نوع Secret) = مفتاحك
        ALLOWED_ORIGIN  = https://abdelrhmanaboelsod122-svg.github.io,http://localhost:8000
        MODEL (اختياري) = اسم نموذج Flash أو Flash-Lite كما يظهر في AI Studio
   4) انسخ رابط الـ Worker (https://xxxx.workers.dev) وضعه في app.js:
        const CONFIG={AI_URL:"الرابط هنا"};
   5) الحماية من الاستخدام المفرط (إلزامية: بدونها يرفض الـ Worker كل الطلبات):
        أ) Rate Limiting binding باسم RL (Workers -> Settings -> Bindings -> Rate Limiting)
        ب) و/أو KV namespace باسم KV لحد يومي لكل IP (40 رسالة)
   ملاحظة: الحد هنا على عنوان IP وليس على حساب الطالب. للحد لكل حساب اربطه بتحقق JWT من Supabase لاحقًا.
   ===================================================================== */
const SYSTEM=`أنت "طموح"، مساعد تعليمي لطلاب الثانوية العامة والبكالوريا المصرية. اشرح بالعربية المبسطة (ويمكن بلهجة مصرية خفيفة) خطوة بخطوة وبأمثلة. إذا لم تكن متأكدًا من معلومة فقل ذلك ولا تخترع. ارفض أي طلب غير دراسي بلطف وأعد الطالب للدراسة. لا تطلب بيانات شخصية. انصح الطالب بمراجعة كتاب الوزارة عند الحاجة.`;
export default{async fetch(req,env){
const origin=req.headers.get("Origin")||"",ok=(env.ALLOWED_ORIGIN||"").split(",").map(s=>s.trim()).includes(origin);
const cors={"Access-Control-Allow-Origin":ok?origin:"null","Access-Control-Allow-Methods":"GET, POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type","Vary":"Origin"};
const out=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...cors,"Content-Type":"application/json"}});
if(req.method==="OPTIONS")return new Response(null,{headers:cors});
if(req.method==="GET")return out({ok:true});
if(req.method!=="POST"||!ok)return out({error:"غير مسموح"},403);
if(!env.RL&&!env.KV)return out({error:"الحماية من الاستخدام المفرط غير مفعّلة على الخادم."},503);
const ip=req.headers.get("CF-Connecting-IP")||"x";
if(env.RL){const r=await env.RL.limit({key:ip});if(!r.success)return out({error:"طلبات كثيرة، انتظر دقيقة."},429)}
if(env.KV){const k="d:"+new Date().toISOString().slice(0,10)+":"+ip,n=+(await env.KV.get(k)||0);if(n>=40)return out({error:"وصلت للحد اليومي، كمّل بكرة."},429);await env.KV.put(k,String(n+1),{expirationTtl:90000})}
const raw=await req.text();if(raw.length>8000)return out({error:"الطلب كبير جدًا."},413);
let b;try{b=JSON.parse(raw)}catch{return out({error:"طلب غير صالح"},400)}
const msgs=(Array.isArray(b.messages)?b.messages:[]).slice(-8).map(m=>({role:m.role==="model"?"model":"user",parts:[{text:String(m.text||"").slice(0,1500)}]}));
if(!msgs.length||msgs[msgs.length-1].role!=="user")return out({error:"طلب غير صالح"},400);
const c=b.ctx||{},ctx=`الطالب في ${String(c.grade||"").slice(0,40)} - ${String(c.system||"").slice(0,40)} ${String(c.track||"").slice(0,40)}. مواده: ${(Array.isArray(c.subjects)?c.subjects:[]).slice(0,12).map(s=>String(s).slice(0,30)).join("، ")}. طريقة التعلم المفضلة: ${String(c.learningStyle||"غير محددة").slice(0,40)}. الهواية: ${String(c.hobby||"غير محددة").slice(0,30)}.`;
const model=env.MODEL||"gemini-flash-lite-latest";
try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM+"\n"+ctx}]},contents:msgs,generationConfig:{maxOutputTokens:900,temperature:0.5}})});
if(r.status===429)return out({error:"الخدمة مزدحمة، جرّب بعد دقيقة."},429);
if(!r.ok)return out({error:"تعذر الحصول على رد الآن."},502);
const j=await r.json(),t=(j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||"").join("");
if(!t)return out({error:"لم يصل رد. جرّب صياغة أخرى."},502);return out({reply:t})}catch{return out({error:"تعذر الاتصال."},502)}}};
