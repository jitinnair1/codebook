(function(){var e=`module Tests = struct
  let bool_check msg b =
    if b then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\n" msg;
      failwith "Test failed"
    end

  let string_check to_str msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\nExpected: %s\\nActual:   %s\\n" msg (to_str expected) (to_str actual);
      failwith "Test failed"
    end

 let equal_check msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\n" msg;
      failwith "Test failed"
    end
end
`,t=``+new URL(`toplevel.bc-Def5EU6H.js`,self.location.href).href;function n(e){Promise.resolve().then(()=>e.init?.()).then(()=>{self.postMessage({type:`READY`})}).catch(e=>{console.error(`[Worker Init Error]:`,e),self.postMessage({type:`INIT_ERROR`,error:e?.message||String(e)})}),self.onmessage=async t=>{let n=t.data;if(n){if(n.type===`RUN`){let{id:t,userCode:r,testCode:i=``}=n;try{let n=await e.execute(r,i);self.postMessage({type:`RESULT`,id:t,success:n.success,output:n.output,error:n.error})}catch(e){self.postMessage({type:`RESULT`,id:t,success:!1,output:``,error:e?.message||String(e)})}}else if(n.type===`LINT`){let{id:t,code:r}=n;try{let n=e.lint?await e.lint(r):[];self.postMessage({type:`LINT_RESULT`,id:t,diagnostics:Array.isArray(n)?n:[]})}catch(e){console.error(`[Worker Lint Error]:`,e),self.postMessage({type:`LINT_RESULT`,id:t,diagnostics:[]})}}}}}function r(){let e=self.ocaml;if(e&&typeof e.run==`function`)return e;let t=globalThis.ocaml;if(t&&typeof t.run==`function`)return t}function i(e,t){if(!e||!e.trim())return[];let n=[],r=/(?:File "[^"]*", |Line |line )?line (\d+), characters (\d+)-(\d+):[\s\S]*?(Error|Warning[^\n:]*):\s*([\s\S]*?)(?=(?:File "[^"]*", |Line |line \d+, characters)|$)/gi,i;for(;(i=r.exec(e))!==null;){let e=parseInt(i[1],10)||1,r=parseInt(i[2],10)||0,a=parseInt(i[3],10)||r+1,o=i[4].toLowerCase(),s=i[5].trim().replace(/\s+/g,` `),c=e;t>0&&c>t?c-=t:t>0&&c<=t&&(c=1);let l=o.startsWith(`warning`)?`warning`:`error`;n.push({line:c,column:r+1,endLine:c,endColumn:a+1,severity:l,message:s,source:`ocaml`})}return n.length===0&&(e.toLowerCase().includes(`error`)||e.toLowerCase().includes(`syntax`))&&n.push({line:1,column:1,severity:`error`,message:e.trim().replace(/\s+/g,` `),source:`ocaml`}),n}n({async init(){let e=await fetch(t);if(!e.ok)throw Error(`HTTP ${e.status} fetching toplevel.bc.js`);let n=await e.text();if((0,eval)(n),!r())throw Error(`OCaml compiler runtime (ocaml.run) was not found after script execution`)},execute(e,t=``){let n=r();if(!n||!n.run)return{success:!1,output:``,error:`OCaml compiler not initialized in worker`};let i=`module Tests = struct
  let bool_check msg b =
    if b then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\n" msg;
      failwith "Test failed"
    end

  let string_check to_str msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\nExpected: %s\\nActual:   %s\\n" msg (to_str expected) (to_str actual);
      failwith "Test failed"
    end

 let equal_check msg expected actual =
    if expected = actual then
      Printf.printf "Test passed: %s\\n" msg
    else begin
      Printf.printf "Test failed: %s\\n" msg;
      failwith "Test failed"
    end
end

`+e+`
`+t+`;;`;try{let e=n.run(i),t=(e.out||``).replace(/module Tests :[\s\S]*?end\n/g,``);return{success:!!e.success,output:t,error:e.err||``}}catch(e){return{success:!1,output:``,error:e?.message||String(e)}}},lint(t){if(!t.trim())return[];let n=r();if(!n||!n.run)return[];let a=e.split(`
`).length,o=`${e}\n${t}\n;;`;try{let e=n.run(o);return!e.err||!e.err.trim()?[]:i(e.err,a)}catch(e){return console.warn(`[OCaml Worker Lint Error]:`,e),[]}}})})();