// Persist account credentials on this device only. The non-extractable AES key
// and ciphertext live in IndexedDB, never in localStorage or the server.
let dbPromise;
function db(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('bili-private',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function access(mode,fn){const d=await db();return new Promise((resolve,reject)=>{const t=d.transaction('vault',mode);const r=fn(t.objectStore('vault'));t.oncomplete=()=>resolve(r?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error)})}
export async function loadSession(){try{const key=await access('readonly',s=>s.get('key'));const record=await access('readonly',s=>s.get('session'));if(!key||!record)return '';const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:record.iv},key,record.data);return new TextDecoder().decode(bytes)}catch{return ''}}
export async function saveSession(cookie){let key=await access('readonly',s=>s.get('key'));if(!key){key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);await access('readwrite',s=>s.put(key,'key'))}const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(cookie));await access('readwrite',s=>s.put({iv,data},'session'))}
export async function clearSession(){await access('readwrite',s=>s.clear())}
