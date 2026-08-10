(function(){async function e(){try{typeof self.initYaegi==`function`&&await self.initYaegi(),self.postMessage({type:`READY`})}catch(e){console.error(`[Go Worker Error]: Failed to initialize Go runtime`,e),self.postMessage({type:`INIT_ERROR`,error:e?.message||String(e)})}}e();function t(e,t,n){let r=[e,t,n],i=new Set,a=[];for(let e of r){if(!e||!e.trim())continue;let t=e.split(`
`),n=!1,r=!0,o=[];for(let e=0;e<t.length;e++){let a=t[e],s=a.trim();if(r){if(s.startsWith(`package `))continue;if(s.startsWith(`import (`)||s===`import (`){n=!0;continue}if(n){if(s===`)`){n=!1;continue}s&&!s.startsWith(`//`)&&i.add(s);continue}if(s.startsWith(`import `)){let e=s.slice(7).trim();e&&i.add(e);continue}s!==``&&!s.startsWith(`//`)&&(r=!1,o.push(a))}else o.push(a)}let s=o.join(`
`).trim();s&&a.push(s)}return`package main\n\n${i.size>0?`import (\n\t${Array.from(i).join(`
	`)}\n)`:``}\n\n${a.join(`

`)}`}async function n(e){if(typeof self.yaegiEval==`function`)return self.yaegiEval(e);throw Error(`WASM interpreter binary (yaegi.wasm) is not loaded.`)}async function r(e){let t=new URLSearchParams;t.append(`version`,`2`),t.append(`body`,e);let n=await fetch(`https://play.golang.org/compile`,{method:`POST`,headers:{"Content-Type":`application/x-www-form-urlencoded; title=GoPlayground`},body:t.toString()});if(!n.ok)throw Error(`Execution request failed with status ${n.status}`);let r=await n.json();if(r.Errors)return{success:!1,output:``,error:r.Errors};let i=``;return Array.isArray(r.Events)&&(i=r.Events.map(e=>e.Message||``).join(``)),{success:!0,output:i}}self.onmessage=async e=>{let i=e.data;if(!i||i.type!==`RUN`)return;let{id:a,userCode:o,testCode:s=``}=i,c=t(o,s,`package main

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
`);try{let e=await n(c);self.postMessage({type:`RESULT`,id:a,...e});return}catch(e){console.log(`[Go Worker]: Primary WASM route unavailable, attempting Playground API fallback:`,e?.message)}try{let e=await r(c);self.postMessage({type:`RESULT`,id:a,...e})}catch(e){self.postMessage({type:`RESULT`,id:a,success:!1,output:``,error:e?.message||String(e)})}}})();