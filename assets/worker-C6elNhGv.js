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
`,t=``+new URL(`toplevel.bc-Def5EU6H.js`,self.location.href).href;function n(e){function t(e){self.postMessage(e)}let n=[],r=!1,i=new Set,a=null;Promise.resolve().then(()=>e.init?.()).then(()=>{t({type:`READY`})}).catch(e=>{console.error(`[Worker Init Error]:`,e),t({type:`INIT_ERROR`,error:e?.message||String(e)})});async function o(n){let{id:r,userCode:a,testCode:o=``}=n;if(i.has(r)){i.delete(r),t({type:`RESULT`,id:r,success:!1,output:``,error:`Execution cancelled.`});return}let s={id:r,userCode:a,testCode:o,isCancelled:()=>i.has(r)};try{let n=await e.execute(a,o,s);t({type:`RESULT`,id:r,success:n.success,output:n.output,error:n.error})}catch(e){t({type:`RESULT`,id:r,success:!1,output:``,error:e?.message||String(e)})}finally{i.delete(r)}}async function s(n){let{id:r,code:o}=n;if(a&&a!==r){t({type:`LINT_RESULT`,id:r,diagnostics:[]});return}if(i.has(r)){i.delete(r),t({type:`LINT_RESULT`,id:r,diagnostics:[]});return}let s={id:r,code:o,isCancelled:()=>i.has(r)||a!==null&&a!==r};try{let n=e.lint?await e.lint(o,s):[];t({type:`LINT_RESULT`,id:r,diagnostics:Array.isArray(n)?n:[]})}catch(e){console.error(`[Worker Lint Error]:`,e),t({type:`LINT_RESULT`,id:r,diagnostics:[]})}finally{i.delete(r)}}async function c(n){try{e.reset&&await e.reset(),t({type:`RESET_DONE`,id:n.id})}catch(e){console.error(`[Worker Reset Error]:`,e),t({type:`RESET_DONE`,id:n.id})}}async function l(){if(!r){r=!0;try{for(;n.length>0;){let e=n.shift();e.type===`RUN`?await o(e):e.type===`LINT`?await s(e):e.type===`RESET`&&await c(e)}}finally{r=!1}}}self.onmessage=e=>{let t=e.data;if(!(!t||!t.type)){if(t.type===`CANCEL`){i.add(t.id);return}t.type===`LINT`&&(a=t.id),n.push(t),l()}}}function r(){let e=self.ocaml;if(e&&typeof e.run==`function`)return e;let t=globalThis.ocaml;if(t&&typeof t.run==`function`)return t}function i(e,t){if(!e||!e.trim())return[];let n=[],r=/(?:File "[^"]*", |Line |line )?line (\d+), characters (\d+)-(\d+):[\s\S]*?(Error|Warning[^\n:]*):\s*([\s\S]*?)(?=(?:File "[^"]*", |Line |line \d+, characters)|$)/gi,i;for(;(i=r.exec(e))!==null;){let e=parseInt(i[1],10)||1,r=parseInt(i[2],10)||0,a=parseInt(i[3],10)||r+1,o=i[4].toLowerCase(),s=i[5].trim().replace(/\s+/g,` `),c=e;t>0&&c>t?c-=t:t>0&&c<=t&&(c=1);let l=o.startsWith(`warning`)?`warning`:`error`;n.push({line:c,column:r+1,endLine:c,endColumn:a+1,severity:l,message:s,source:`ocaml`})}return n.length===0&&(e.toLowerCase().includes(`error`)||e.toLowerCase().includes(`syntax`)||e.toLowerCase().includes(`failure`))&&n.push({line:1,column:1,severity:`error`,message:e.trim().replace(/\s+/g,` `),source:`ocaml`}),n}function a(e){return e?e.replace(/^module Tests : sig[\s\S]*?end\n?/m,``).replace(/^module Tests :[\s\S]*?end\n?/m,``).trimStart():``}n({async init(){let e=await fetch(t);if(!e.ok)throw Error(`HTTP ${e.status} fetching toplevel.bc.js`);let n=await e.text();if((0,eval)(n),!r())throw Error(`OCaml compiler runtime (ocaml.run) was not found after script execution`)},execute(t,n=``){let o=r();if(!o||!o.run)return{success:!1,output:``,error:`OCaml compiler not initialized in worker`};let s=e.split(`
`).length,c=`${e}\n${t}\n${n};;`;try{let e=o.run(c),t=a(e.out||``),n=(e.err||``).trim(),r=i(n,s);return r.some(e=>e.severity===`error`)||!e.success&&n.length>0&&!r.every(e=>e.severity===`warning`)?{success:!1,output:t,error:n||`OCaml execution failed`}:{success:!0,output:n?t?`${t}\n${n}`:n:t,error:void 0}}catch(e){return{success:!1,output:``,error:e?.message||String(e)}}},lint(t){if(!t.trim())return[];let n=r();if(!n||!n.run)return[];let a=e.split(`
`).length,o=`${e}\n${t}\n;;`;try{let e=n.run(o);return!e.err||!e.err.trim()?[]:i(e.err,a)}catch(e){return console.warn(`[OCaml Worker Lint Error]:`,e),[]}},reset(){let e=r();if(e&&typeof e.reset==`function`)try{e.reset()}catch(e){console.warn(`[OCaml Reset Warning]:`,e)}}})})();