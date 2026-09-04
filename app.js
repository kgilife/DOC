
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

const HEADERS = [
  "判斷碼", "保單號碼", "部門", "員工工號", "關係", "被保人姓名", "身分證號", "性別", "生日",
  "銀行代碼", "分行代碼", "銀行帳號", "信用卡卡號", "信用卡到期日", "生效日", "退保日", "等級",
  "險種", "保額", "薪資", "勞保薪資", "職級", "要保書填寫日", "監護宣告", "微型身障類別",
  "微型家屬", "原住民", "羅馬拼音", "付款人姓名", "付款人身份證號", "付款人生日", "付款人與員工關係",
  "聯絡電話(區碼)", "聯絡電話(不含區碼及分碼)", "聯絡電話(分機)", "連絡手機", "郵遞區號",
  "聯絡地址(縣市)", "聯絡地址(鄉鎮區)", "聯絡地址(地址)", "Email", "服務機關縣市", "服務機關",
  "部門單位", "工作內容", "登錄證字號1", "登錄證字號2", "X", "醫事機構代碼"
];

function generateAndDownloadExcel(payload) {
  if (typeof XLSX === "undefined") {
    throw new Error("Excel 模組尚未載入完成，請稍候重試或重新整理網頁。");
  }
  const people = [
    { rel: '會員本人', p: payload.insurance.self },
    { rel: '會員配偶', p: payload.insurance.spouse }
  ].filter(x => x.p && (x.p.name || x.p.id));

  if (!people.length) throw new Error('至少需要一位被保人');

  const rows = people.map(x => {
    const r = Array(49).fill('');
    const m = payload.member || {};
    const p = x.p || {};

    r[2]  = m.department || '';
    r[4]  = x.rel;
    r[5]  = p.name || '';
    r[6]  = p.id || '';
    r[8]  = p.birth || '';
    r[12] = payload.payment.cardNo || '';
    r[13] = payload.payment.expiry || '';
    r[28] = payload.payment.holder || '';

    const tel = String(m.phone || '').trim();
    const telMatch = tel.match(/^(0\d{1,2})[-\s]?(.+)$/);
    if (telMatch) {
      r[32] = telMatch[1];
      r[33] = String(telMatch[2]).replace(/\D/g, '');
    } else {
      r[33] = tel.replace(/\D/g, '');
    }

    r[34] = m.ext || '';
    r[35] = m.mobile || '';
    r[36] = m.zip || '';
    r[37] = m.city || '';
    r[38] = m.district || '';
    r[39] = (m.road || '') + (m.addressDetail || '');
    r[40] = m.email || '';
    r[42] = payload.institution.institutionName || '';
    r[43] = m.department || '';
    r[44] = p.job || '';
    r[45] = payload.agent.agentCode || '';
    r[48] = payload.institution.institutionCode || '';

    return r;
  });

  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "資料區");

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const fileName = `醫護公會送件_${payload.agent.agentCode}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
  return { rows: rows.length, fileName };
}

$("downloadBtn").onclick=()=>{
  clearError("finalErr");
  const errs=validate();
  if(errs.length) return showError("finalErr","資料已被修改，請返回重新檢核：\n"+errs.join("\n"));
  try{
    $("downloadBtn").disabled=true;
    $("downloadBtn").textContent="產生中…";
    currentPayload=buildPayload();
    const result=generateAndDownloadExcel(currentPayload);
    $("finalOk").innerHTML=`<strong>已成功產生並直接下載送件檔至您的裝置！</strong><br>檔案名稱：${result.fileName}（共 ${result.rows} 筆送件資料）。<br><small style="color:var(--muted)">檔案已下載儲存至您裝置的「下載」資料夾。若未自動下載，可再次點選按鈕。</small>`;
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
