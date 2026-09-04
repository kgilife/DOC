
const $ = id => document.getElementById(id);
const API = (window.APP_CONFIG && window.APP_CONFIG.GAS_WEB_APP_URL || "").trim();

let currentAgent = null;
let currentInstitution = null;
let currentPayload = null;
let addressData = [];

for(let m=1;m<=12;m++) $("cardMonth").insertAdjacentHTML("beforeend",`<option>${String(m).padStart(2,"0")}</option>`);
for(let y=25;y<=40;y++) $("cardYear").insertAdjacentHTML("beforeend",`<option>${y}</option>`);

function setStep(n){ [1,2,3].forEach(i=>$("st"+i).classList.toggle("active",i===n)); }
function showError(id,msg){ const e=$(id); e.textContent=msg; e.style.display="block"; }
function clearError(id){ $(id).style.display="none"; $(id).textContent=""; }
function v(id){ return $(id).value.trim(); }

function assertApi(){
  if(!API || API.includes("PASTE_YOUR_GAS")){
    throw new Error("尚未設定 GAS Web App URL。請先修改 config.js。");
  }
}

async function api(action, payload={}){
  assertApi();
  const res = await fetch(API, {
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body: JSON.stringify({action, ...payload})
  });
  const data = await res.json();
  if(!data.ok) throw new Error(data.error || "API 發生錯誤");
  return data;
}

async function initAddress(){
  try{
    const data = await api("getAddresses");
    addressData = data.addresses || [];
    const cities=[...new Set(addressData.map(x=>x[0]))];
    $("city").innerHTML='<option value="">選擇縣市</option>'+cities.map(x=>`<option>${x}</option>`).join("");
  }catch(err){
    console.error(err);
    $("city").innerHTML='<option value="">地址資料載入失敗</option>';
  }
}
initAddress();

function refreshDistrict(){
  const c=v("city");
  const ds=[...new Set(addressData.filter(x=>x[0]===c).map(x=>x[1]))];
  $("district").innerHTML='<option value="">選擇鄉鎮市區</option>'+ds.map(x=>`<option>${x}</option>`).join("");
  refreshRoad();
}
function refreshRoad(){
  const c=v("city"), d=v("district");
  const rs=[...new Set(addressData.filter(x=>x[0]===c&&x[1]===d).map(x=>x[2]))];
  $("road").innerHTML='<option value="">選擇路名</option>'+rs.map(x=>`<option>${x}</option>`).join("");
}
$("city").onchange=refreshDistrict;
$("district").onchange=refreshRoad;

$("agentNext").onclick = async ()=>{
  clearError("agentErr");
  const code=v("agentCode");
  if(!/^\d{10}$/.test(code)) return showError("agentErr","業務員代碼必須為 10 碼數字。");

  try{
    $("page1").classList.add("loading");
    const data = await api("lookupAgent",{agentCode:code});
    currentAgent = data.agent;

    $("greeting").textContent = `${currentAgent.office} ${currentAgent.agentName} ${currentAgent.agentCode} 您好。`;

    const opts = data.institutions || [];
    $("institution").innerHTML = '<option value="">請選擇機構名稱</option>' +
      opts.map(x=>`<option value="${x.institutionCode}">${x.institutionName}</option>`).join("");
    $("institution").dataset.list = JSON.stringify(opts);

    $("page1").classList.add("hidden");
    $("page2").classList.remove("hidden");
    setStep(2);
    window.scrollTo({top:0,behavior:"smooth"});
  }catch(err){
    showError("agentErr",err.message);
  }finally{
    $("page1").classList.remove("loading");
  }
};

$("institution").onchange=()=>{
  const list=JSON.parse($("institution").dataset.list||"[]");
  currentInstitution=list.find(x=>x.institutionCode===v("institution"))||null;
  $("institutionHint").textContent=currentInstitution
    ? `系統已自動對照醫事機構代碼：${currentInstitution.institutionCode}`
    : "只顯示此業務員可服務的機構。";
};

$("memberName").oninput=()=>{ if(!$("selfName").dataset.edited) $("selfName").value=v("memberName"); };
$("memberId").oninput=()=>{ if(!$("selfId").dataset.edited) $("selfId").value=v("memberId").toUpperCase(); };
$("memberBirth").onchange=()=>{ if(!$("selfBirth").dataset.edited) $("selfBirth").value=v("memberBirth"); };
["selfName","selfId","selfBirth"].forEach(id=>$(id).addEventListener("input",()=>$(id).dataset.edited="1"));

function taiwanIdOk(s){
  s=s.toUpperCase();
  if(!/^[A-Z][12]\d{8}$/.test(s)) return false;
  const map={A:10,B:11,C:12,D:13,E:14,F:15,G:16,H:17,I:34,J:18,K:19,L:20,M:21,N:22,O:35,P:23,Q:24,R:25,S:26,T:27,U:28,V:29,W:32,X:30,Y:31,Z:33};
  const n=map[s[0]], d=[Math.floor(n/10),n%10,...s.slice(1).split("").map(Number)], w=[1,9,8,7,6,5,4,3,2,1,1];
  return d.reduce((a,v,i)=>a+v*w[i],0)%10===0;
}
function emailOk(s){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }
function luhn(s){ let sum=0,alt=false; for(let i=s.length-1;i>=0;i--){let n=+s[i];if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt} return sum%10===0; }

function validate(){
  const e=[];
  if(!currentAgent)e.push("尚未完成業務員驗證。");
  if(!currentInstitution)e.push("請選擇機構名稱。");
  if(!v("department"))e.push("請填寫部門單位。");
  if(!v("memberName"))e.push("請填寫會員姓名。");
  if(!v("memberId"))e.push("請填寫會員身分證號。");
  if(v("memberForeign")!=="是" && v("memberId") && !taiwanIdOk(v("memberId")))e.push("會員身分證號格式或檢查碼錯誤。");
  if(!v("memberBirth"))e.push("請填寫會員出生日期。");
  if(!/^09\d{8}$/.test(v("mobile")))e.push("行動電話必須為 09 開頭的 10 碼數字。");
  if(!v("city")||!v("district")||!v("road")||!v("addressDetail"))e.push("請完整填寫聯絡地址。");
  if(!/^\d{3,6}$/.test(v("zipCode")))e.push("郵遞區號請輸入 3～6 碼數字。");
  if(!emailOk(v("email")))e.push("會員電子郵件格式不正確。");
  if(!["方案一","方案二","方案三"].includes(v("plan")))e.push("請選擇投保方案。");
  if(!v("selfName")||!v("selfId")||!v("selfBirth")||!v("selfJob"))e.push("會員本人投保資料尚未填完整。");
  if(v("selfForeign")!=="是" && v("selfId") && !taiwanIdOk(v("selfId")))e.push("會員本人身分證號格式或檢查碼錯誤。");

  const spouseAny=[v("spouseName"),v("spouseId"),v("spouseBirth"),v("spouseJob")].some(Boolean);
  if(spouseAny && ![v("spouseName"),v("spouseId"),v("spouseBirth"),v("spouseJob")].every(Boolean))
    e.push("若填寫配偶資料，姓名、身分證號、出生日期、工作職稱必須完整。");
  if(spouseAny && v("spouseForeign")!=="是" && !taiwanIdOk(v("spouseId")))
    e.push("會員配偶身分證號格式或檢查碼錯誤。");

  if(!["VISA","MASTER","JCB"].includes(v("cardType")))e.push("請選擇信用卡卡別。");
  const card=v("cardNo").replace(/\D/g,"");
  if(!/^\d{16}$/.test(card))e.push("信用卡卡號必須為 16 碼。");
  else if(!luhn(card))e.push("信用卡卡號檢查碼不正確。");
  if(!v("cardMonth")||!v("cardYear"))e.push("請填寫信用卡效期。");
  if(!v("cardHolder"))e.push("請填寫持卡人姓名。");
  return e;
}

function buildPayload(){
  return {
    agent:currentAgent,
    institution:currentInstitution,
    member:{
      department:v("department"),name:v("memberName"),id:v("memberId").toUpperCase(),birth:v("memberBirth"),
      foreign:v("memberForeign"),phone:v("phone"),ext:v("ext"),mobile:v("mobile"),
      city:v("city"),district:v("district"),road:v("road"),addressDetail:v("addressDetail"),
      zip:v("zipCode"),email:v("email")
    },
    insurance:{
      plan:v("plan"),
      self:{name:v("selfName"),id:v("selfId").toUpperCase(),birth:v("selfBirth"),job:v("selfJob"),foreign:v("selfForeign")},
      spouse:{name:v("spouseName"),id:v("spouseId").toUpperCase(),birth:v("spouseBirth"),job:v("spouseJob"),foreign:v("spouseForeign")}
    },
    payment:{
      cardType:v("cardType"),cardNo:v("cardNo").replace(/\D/g,""),
      expiry:`${v("cardMonth")}/20${v("cardYear")}`,holder:v("cardHolder")
    }
  };
}

$("reviewBtn").onclick=()=>{
  clearError("formErr");
  const errs=validate();
  if(errs.length) return showError("formErr",errs.map((x,i)=>`${i+1}. ${x}`).join("\n"));
  currentPayload=buildPayload();
  $("review").textContent =
`業務員：${currentAgent.office} / ${currentAgent.agentName} / ${currentAgent.agentCode}
機構：${currentInstitution.institutionName}
會員：${currentPayload.member.name} (${currentPayload.member.id})
方案：${currentPayload.insurance.plan}
被保人：${[currentPayload.insurance.self.name,currentPayload.insurance.spouse.name].filter(Boolean).join("、")}
地址：${currentPayload.member.city}${currentPayload.member.district}${currentPayload.member.road}${currentPayload.member.addressDetail}
會員電子郵件：${currentPayload.member.email}

全部檢核通過，可產生送件檔。`;
  $("page2").classList.add("hidden");
  $("page3").classList.remove("hidden");
  setStep(3);
  window.scrollTo({top:0,behavior:"smooth"});
};

$("downloadBtn").onclick=async()=>{
  clearError("finalErr");
  const errs=validate();
  if(errs.length) return showError("finalErr","資料已被修改，請返回重新檢核：\n"+errs.join("\n"));
  try{
    $("downloadBtn").disabled=true;
    $("downloadBtn").textContent="產生中…";
    currentPayload=buildPayload();
    const data=await api("generateSubmission",{payload:currentPayload});
    let links = `<a href="${data.fileUrl}" target="_blank" rel="noopener">開啟送件檔：${data.fileName}</a>`;
    if (data.downloadUrl && data.downloadUrl !== data.fileUrl) {
      links += ` &nbsp;|&nbsp; <a href="${data.downloadUrl}" target="_blank" rel="noopener">下載 Excel 檔 (.xlsx)</a>`;
    }
    $("finalOk").innerHTML=`已產生 ${data.rows} 筆送件資料。<br>${links}`;
    $("finalOk").style.display="block";
  }catch(err){
    showError("finalErr",err.message);
  }finally{
    $("downloadBtn").disabled=false;
    $("downloadBtn").textContent="產生送件檔";
  }
};

$("back1").onclick=()=>{$("page2").classList.add("hidden");$("page1").classList.remove("hidden");setStep(1);}
$("back2").onclick=()=>{$("page3").classList.add("hidden");$("page2").classList.remove("hidden");setStep(2);}
