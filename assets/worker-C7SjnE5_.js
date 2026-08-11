(function(){function e(e){Promise.resolve().then(()=>e.init?.()).then(()=>{self.postMessage({type:`READY`})}).catch(e=>{console.error(`[Worker Init Error]:`,e),self.postMessage({type:`INIT_ERROR`,error:e?.message||String(e)})}),self.onmessage=async t=>{let n=t.data;if(!n||n.type!==`RUN`)return;let{id:r,userCode:i,testCode:a=``}=n;try{let t=await e.execute(i,a);self.postMessage({type:`RESULT`,id:r,success:t.success,output:t.output,error:t.error})}catch(e){self.postMessage({type:`RESULT`,id:r,success:!1,output:``,error:e?.message||String(e)})}}}function t(e){let t=new Set;if(!e||!e.trim())return{imports:t,body:``};let n=e.split(`
`),r=!1,i=!0,a=[];for(let e=0;e<n.length;e++){let o=n[e],s=o.trim();if(i){if(s.startsWith(`package `))continue;if(s.startsWith(`import (`)||s===`import (`){r=!0;continue}if(r){if(s===`)`){r=!1;continue}s&&!s.startsWith(`//`)&&t.add(s);continue}if(s.startsWith(`import `)){let e=s.slice(7).trim();e&&t.add(e);continue}s!==``&&!s.startsWith(`//`)&&(i=!1,a.push(o))}else a.push(o)}return{imports:t,body:a.join(`
`).trim()}}let n=null;function r(){return n||=t(`package main

import (
	"fmt"
	"os"
	"reflect"
)

type TestHarness struct{}

var Tests TestHarness

func (t TestHarness) BoolCheck(msg string, b bool) {
	if b {
		fmt.Printf("Test passed: %s\\n", msg)
	} else {
		fmt.Printf("Test failed: %s\\n", msg)
		os.Exit(1)
	}
}

func (t TestHarness) EqualCheck(msg string, expected, actual interface{}) {
	if reflect.DeepEqual(expected, actual) {
		fmt.Printf("Test passed: %s\\n", msg)
	} else {
		fmt.Printf("Test failed: %s\\nExpected: %#v\\nActual:   %#v\\n", msg, expected, actual)
		os.Exit(1)
	}
}
`),n}function i(e,n){let i=r(),a=t(e),o=t(n),s=new Set(i.imports);a.imports.forEach(e=>s.add(e)),o.imports.forEach(e=>s.add(e));let c=[];return i.body&&c.push(i.body),a.body&&c.push(a.body),o.body&&c.push(o.body),`package main\n\n${s.size>0?`import (\n\t${Array.from(s).join(`
	`)}\n)`:``}\n\n${c.join(`

`)}`}async function a(e){if(typeof self.yaegiEval==`function`)return self.yaegiEval(e);throw Error(`WASM interpreter binary (yaegi.wasm) is not loaded.`)}async function o(e){let t=new URLSearchParams;t.append(`version`,`2`),t.append(`body`,e);let n=await fetch(`https://play.golang.org/compile`,{method:`POST`,headers:{"Content-Type":`application/x-www-form-urlencoded; title=GoPlayground`},body:t.toString()});if(!n.ok)throw Error(`Execution request failed with status ${n.status}`);let r=await n.json();if(r.Errors)return{success:!1,output:``,error:r.Errors};let i=``;return Array.isArray(r.Events)&&(i=r.Events.map(e=>e.Message||``).join(``)),{success:!0,output:i}}e({async init(){r(),typeof self.initYaegi==`function`&&await self.initYaegi()},async execute(e,t=``){let n=i(e,t);try{return await a(n)}catch(e){console.log(`[Go Worker]: Primary WASM route unavailable, attempting Playground API fallback:`,e?.message)}try{return await o(n)}catch(e){return{success:!1,output:``,error:e?.message||String(e)}}}})})();