(() => {
'use strict';
const identity=document.querySelector('#identity-form'),delivery=document.querySelector('#delivery-form');
if(!identity||!delivery)return;
const cpf=identity.elements.document,phone=identity.elements.phone,zip=delivery.elements.zip;
const digits=value=>String(value).replace(/\D/g,'');
function cpfMask(value){return digits(value).slice(0,11).replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/,'$1.$2.$3-$4');}
function phoneDigits(value){let s=digits(value);if(s.startsWith('55')&&s.length>11)s=s.slice(2);return s.slice(0,11);}
function phoneMask(value){const s=phoneDigits(value);if(!s)return '';if(s.length<3)return '('+s;const rest=s.slice(2),split=rest.length>8?5:4;return '('+s.slice(0,2)+') '+rest.slice(0,split)+(rest.length>split?'-'+rest.slice(split):'');}
function zipMask(value){return digits(value).slice(0,8).replace(/^(\d{5})(\d)/,'$1-$2');}
function mask(input,formatter){input.addEventListener('input',()=>{const before=input.value,position=input.selectionStart??before.length;const count=digits(before.slice(0,position)).length;const after=formatter(before);input.value=after;if(position<before.length){let seen=0,next=0;for(;next<after.length;next++){if(/\d/.test(after[next]))seen++;if(seen>=count){next++;break;}}if(count===0)next=0;input.setSelectionRange(next,next);}input.setCustomValidity('');input.removeAttribute('aria-invalid');});input.addEventListener('blur',()=>{input.value=formatter(input.value);});input.value=formatter(input.value);}
mask(cpf,cpfMask);mask(phone,phoneMask);mask(zip,zipMask);
cpf.maxLength=14;phone.maxLength=20;zip.maxLength=9;
function hint(input,id){const el=document.createElement('span');el.id=id;el.className='field-hint';el.setAttribute('aria-live','polite');input.after(el);input.setAttribute('aria-describedby',id);input.setAttribute('aria-label',input===cpf?'CPF':input===phone?'Celular / WhatsApp':'CEP');return el;}
const cpfHint=hint(cpf,'cpf-hint'),phoneHint=hint(phone,'phone-hint');
function validCpf(value){const s=digits(value);if(s.length!==11||/^(\d)\1+$/.test(s))return false;for(let n=9;n<11;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(s[i])*(n+1-i);let check=sum*10%11;if(check===10)check=0;if(check!==Number(s[n]))return false;}return true;}
function validate(input,output,valid,message){if(!input.value){output.textContent='';output.className='field-hint';input.setCustomValidity('');input.removeAttribute('aria-invalid');return;}output.textContent=valid?'':message;output.className='field-hint '+(valid?'success':'invalid');input.setAttribute('aria-invalid',String(!valid));input.setCustomValidity(valid?'':message);}
function checkCpf(){validate(cpf,cpfHint,validCpf(cpf.value),'Confira o CPF: informe os 11 dígitos válidos.');}
function checkPhone(){validate(phone,phoneHint,/^[1-9]\d[2-9]\d{7,8}$/.test(phoneDigits(phone.value)),'Informe DDD e telefone com 10 ou 11 dígitos.');}
cpf.addEventListener('blur',checkCpf);phone.addEventListener('blur',checkPhone);
cpf.addEventListener('input',()=>{cpfHint.textContent='';if(digits(cpf.value).length===11)checkCpf();});phone.addEventListener('input',()=>{phoneHint.textContent='';if(phoneDigits(phone.value).length===11)checkPhone();});
const zipStatus=hint(zip,'zip-status');zipStatus.setAttribute('role','status');
let pending=null,sequence=0,lastZip='',lastFilled={};const cache=new Map();
function status(text,type=''){zipStatus.textContent=text;zipStatus.className='field-hint '+type;}
function clearAutofill(){for(const [name,value]of Object.entries(lastFilled)){if(delivery.elements[name].value===value)delivery.elements[name].value='';}lastFilled={};}
async function lookup(){const cep=digits(zip.value);if(cep.length!==8)return;if(cep===lastZip)return;lastZip=cep;const request=++sequence;if(pending)pending.abort();pending=new AbortController();const controller=pending;const snapshot=Object.fromEntries(['street','district','city','state'].map(name=>[name,delivery.elements[name].value]));status('Buscando endereço…');zip.setAttribute('aria-busy','true');let timeout=setTimeout(()=>controller.abort(),8000);
try{let result=cache.get(cep);if(!result){const response=await fetch('https://viacep.com.br/ws/'+cep+'/json/',{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Consulta indisponível');result=await response.json();if(!result.erro)cache.set(cep,result);}
if(request!==sequence||digits(zip.value)!==cep)return;if(result.erro){status('CEP não encontrado. Confira o número ou preencha o endereço manualmente.','invalid');lastZip='';return;}
const values={street:result.logradouro||'',district:result.bairro||'',city:result.localidade||'',state:result.uf||''};lastFilled={};for(const [name,value]of Object.entries(values)){const field=delivery.elements[name];if(field.value===snapshot[name]){field.value=value;lastFilled[name]=value;field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));}}
status(values.street&&values.district?'Endereço encontrado. Confira os dados e informe o número.':'CEP encontrado. Complete a rua, o bairro e o número que faltarem.','success');
}catch(err){if(request!==sequence)return;status('Não foi possível consultar o CEP. Preencha o endereço manualmente ou tente novamente.','invalid');lastZip='';}
finally{clearTimeout(timeout);if(request===sequence){zip.removeAttribute('aria-busy');pending=null;}}}
zip.addEventListener('input',()=>{if(pending){pending.abort();pending=null;}sequence++;zip.removeAttribute('aria-busy');const cep=digits(zip.value);if(cep!==lastZip){clearAutofill();lastZip='';}if(cep.length===8)lookup();else status('Digite os 8 dígitos para buscar o endereço.');});
zip.addEventListener('blur',()=>{if(digits(zip.value).length===8)lookup();});
})();
