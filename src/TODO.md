# Pre-public checklist

- ~~Clean up all source code files~~
- ~~Why is the JS file 40 MBs? How do I get it to be a reasonable size?~~
- ~~Review the architecture of the `CompilerResult`-based design? Does error reporting work as expected?~~
- ~~Build it on Ubuntu to check if the build is now consistent~~
- ~~Remove all debug logs~~
- ~~Add GH actions to build and deploy~~
- ~~Remove Tailwind CDN~~
- ~~Remove regex parsing for markdown exercises descriptions~~
- ~~Streamline `index.html` for better UX as needed~~
  - ~~Remove shading from Run button~~
  - ~~Add a light theme~~
- ~~Add a favicon~~
- ~~Fix selction highlight colours in code editor~~
- ~~Figure out a better pattern to replace the sidebar (dropdown? modal?)~~
- ~~Fix page end of exercise page~~
- ~~Fix tab indent in editor~~
- ~~Add a excercise progress bar~~
- ~~Add a README~~

# Later
- ~~Hightlight user selecrted exercise in the progress bar~~
- ~~Add keyboard shortcuts~~
- ~~Line by line `;;` vs once at the end of block appended manually?~~
- ~~Add a footer with link to GithHub repo~~
- ~~Add Vim mode~~
- ~~Split Run and Submit buttons (wontfix)~~
- Add (better) error reporting mechanism for users (than link to GH issues)
- Footnotes and "important" or "pro tip" section in problem descriptions

# Even Later
- Reduce the size of the toplevel from the current ~4MB. How is OCaml Playground doing it via `playground.min.js` in ~400KB?
- Do an accessibility audit and fix issues (insufficient contrast, missing labels)
- Remove any dependencies which could be implemented easily
- Should the re-render on submit/navigating between exercises be refactored? Can this be done without using a complicated framework?
- ~~Extract the core code workbook to a code-agnostic, template repo~~
- What happens to existing completion status if the exercises numbers change? Should the version history be maintained?
- Check for formatting issues with longer programs?
- For C binding of the FFTW implementation project, would additional libraries be required? How will the logistics of this work?
