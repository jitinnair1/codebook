(function(){function e(){let e=self.ocaml;if(e&&typeof e.run==`function`)return e;let t=globalThis.ocaml;if(t&&typeof t.run==`function`)return t}async function t(){try{let e=await fetch(`/assets/toplevel.bc-BD3yGAFN.js`);if(!e.ok)throw Error(`HTTP ${e.status} fetching toplevel.bc.js`);let t=await e.text();(0,eval)(t)}catch(e){console.error(`[OCaml Worker] Failed to load runtime:`,e);return}e()?self.postMessage({type:`READY`}):console.error(`[OCaml Worker] Runtime loaded but ocaml.run not found on globalThis`)}t(),self.onmessage=t=>{let n=t.data;if(n&&n.type===`RUN`){let{id:t,userCode:r,testCode:i=``}=n,a=e();if(!a||!a.run){self.postMessage({type:`RESULT`,id:t,success:!1,output:``,error:`OCaml compiler not initialized in worker`});return}let o=`module Tests = struct
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
`+r+`
`+i+`;;`;try{let e=a.run(o),n=(e.out||``).replace(/module Tests :[\s\S]*?end\n/g,``);self.postMessage({type:`RESULT`,id:t,success:!!e.success,output:n,error:e.err||``})}catch(e){self.postMessage({type:`RESULT`,id:t,success:!1,output:``,error:e?.message||String(e)})}}}})();