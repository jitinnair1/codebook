(function(){var e=``+new URL(`toplevel.bc-BD3yGAFN.js`,self.location.href).href;function t(e){Promise.resolve().then(()=>e.init?.()).then(()=>{self.postMessage({type:`READY`})}).catch(e=>{console.error(`[Worker Init Error]:`,e),self.postMessage({type:`INIT_ERROR`,error:e?.message||String(e)})}),self.onmessage=async t=>{let n=t.data;if(!n||n.type!==`RUN`)return;let{id:r,userCode:i,testCode:a=``}=n;try{let t=await e.execute(i,a);self.postMessage({type:`RESULT`,id:r,success:t.success,output:t.output,error:t.error})}catch(e){self.postMessage({type:`RESULT`,id:r,success:!1,output:``,error:e?.message||String(e)})}}}function n(){let e=self.ocaml;if(e&&typeof e.run==`function`)return e;let t=globalThis.ocaml;if(t&&typeof t.run==`function`)return t}t({async init(){let t=await fetch(e);if(!t.ok)throw Error(`HTTP ${t.status} fetching toplevel.bc.js`);let r=await t.text();if((0,eval)(r),!n())throw Error(`OCaml compiler runtime (ocaml.run) was not found after script execution`)},execute(e,t=``){let r=n();if(!r||!r.run)return{success:!1,output:``,error:`OCaml compiler not initialized in worker`};let i=`module Tests = struct
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
end
`+e+`
`+t+`;;`;try{let e=r.run(i),t=(e.out||``).replace(/module Tests :[\s\S]*?end\n/g,``);return{success:!!e.success,output:t,error:e.err||``}}catch(e){return{success:!1,output:``,error:e?.message||String(e)}}}})})();