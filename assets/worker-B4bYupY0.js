(function(){var e=``+new URL(`toplevel.bc-BD3yGAFN.js`,self.location.href).href;function t(){let e=self.ocaml;if(e&&typeof e.run==`function`)return e;let t=globalThis.ocaml;if(t&&typeof t.run==`function`)return t}async function n(){try{let t=await fetch(e);if(!t.ok)throw Error(`HTTP ${t.status} fetching toplevel.bc.js`);let n=await t.text();(0,eval)(n)}catch(e){let t=e?.message||String(e);console.error(`[OCaml Worker] Failed to load runtime:`,t),self.postMessage({type:`INIT_ERROR`,error:`Failed to load OCaml runtime script: ${t}`});return}if(t())self.postMessage({type:`READY`});else{let e=`OCaml compiler runtime (ocaml.run) was not found after script execution`;console.error(`[OCaml Worker]:`,e),self.postMessage({type:`INIT_ERROR`,error:e})}}n(),self.onmessage=e=>{let n=e.data;if(n&&n.type===`RUN`){let{id:e,userCode:r,testCode:i=``}=n,a=t();if(!a||!a.run){self.postMessage({type:`RESULT`,id:e,success:!1,output:``,error:`OCaml compiler not initialized in worker`});return}let o=`module Tests = struct
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
`+i+`;;`;try{let t=a.run(o),n=(t.out||``).replace(/module Tests :[\s\S]*?end\n/g,``);self.postMessage({type:`RESULT`,id:e,success:!!t.success,output:n,error:t.err||``})}catch(t){self.postMessage({type:`RESULT`,id:e,success:!1,output:``,error:t?.message||String(t)})}}}})();