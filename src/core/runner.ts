import { store } from './store';
import { exercises } from '../exercises/exercise-registry';
import { getExerciseVariant } from './types';
import { getCode } from './editor';
import { status } from '../ui/status';
import { confetti } from '../ui/confetti';
import { showPopup } from '../ui/popup';
import { elements } from './elements';
import { activeRunner } from '../language';
import { ICONS } from '../ui/icons';

class Orchestrator {
    private isRunning = false;
    private isReady = false;

    constructor() {
        //JN: setting runningState as false so that run button is disabled until
        //the page loads. This also injects the stop icon into the run button. However,
        //this does require the default run SVG to be hardcoded in the index.html file
        //which might not be the best way to do this, might fix it later  ¯\_(ツ)_/¯
        this.setRunningState(false);
        elements.runBtn.innerHTML = `<span>${ICONS.STOP}</span><span>Run</span>`;
    }

    async run() {
        if (this.isRunning) return;

        //check if coderunner is ready
        const ready = await activeRunner.isReady();
        if (!ready) {
            alert("Loading...");
            return;
        }

        const { currentExerciseId, currentLanguageId, completedIds } = store.getState();
        const currentEx = exercises.find(e => e.id === currentExerciseId);
        if (!currentEx) return;

        const exerciseVariant = getExerciseVariant(currentEx, currentLanguageId);

        //prepare ui
        this.setRunningState(true);
        status.setRunning();
        elements.console.textContent = "";

        try {
            //get code
            const userCode = getCode();
            store.getState().saveUserCode(currentExerciseId, currentLanguageId, userCode);

            //run via adapter
            const finalTestCode = exerciseVariant.testCode || "";
            const result = await activeRunner.run(userCode, finalTestCode);

            //handle result
            if (!result.success) {
                this.handleFailure(result.error || "Unknown Error", result.output);
                return;
            }

            elements.console.textContent = result.output;

            //output-based validation (Runtime tests)
            if (result.output.includes("Test failed") || result.output.includes("Failure")) {
                status.setFailed();
                return;
            }

            //structural/custom validation
            if (exerciseVariant.validate) {
                const validation = exerciseVariant.validate(userCode, result.output);
                if (validation !== true) {
                    status.setFailed();
                    elements.console.textContent += `\n\n${validation}`;
                    return;
                }
            }

            //success
            this.handleSuccess(currentEx.id, completedIds);

        } catch (e: any) {
            this.handleError(e.message);
        } finally {
            this.setRunningState(false);
        }
    }

    private handleFailure(error: string, output: string) {
        status.setFailed();
        elements.console.textContent = output ? output + "\n" + error : error;
    }

    private handleError(msg: string) {
        status.setError();
        elements.console.textContent = "Runtime Error: " + msg;
    }

    private handleSuccess(id: string, completedIds: string[]) {
        status.setPassed();
        elements.console.textContent += "\nALL TESTS PASSED!";

        const alreadyCompleted = completedIds.includes(id);
        store.getState().markComplete(id);

        if (!alreadyCompleted) {
            confetti();
        } else {
            showPopup('Passed!');
        }
    }

    private setRunningState(running: boolean) {
        this.isRunning = running;
        elements.runBtn.disabled = running || !this.isReady;

        if (running) {
            elements.runBtn.classList.add("run-btn-fill");
            elements.runBtn.innerHTML = `<span>${ICONS.STOP}</span><span>Run</span>`;
        } else {
            elements.runBtn.classList.remove("run-btn-fill");
            elements.runBtn.innerHTML = `<span>${ICONS.PLAY}</span><span>Run</span>`;
        }
    }

    waitForCompiler() {
        const check = setInterval(async () => {
            const initError = activeRunner.getInitError?.();
            if (initError) {
                this.isReady = false;
                status.setError();
                elements.runBtn.classList.add('opacity-50', 'cursor-not-allowed');
                elements.runBtn.disabled = true;
                if (!elements.console.textContent || elements.console.textContent === "// Ready...") {
                    elements.console.textContent = `${activeRunner.name.toUpperCase()} runtime initialization failed:\n${initError}`;
                }
                return;
            }

            if (await activeRunner.isReady()) {
                this.isReady = true;
                status.setReady();
                elements.runBtn.classList.remove('opacity-50', 'cursor-not-allowed');
                this.setRunningState(false);
            } else {
                this.isReady = false;
                elements.runBtn.classList.add('opacity-50', 'cursor-not-allowed');
                elements.runBtn.disabled = true;
            }
        }, 500);
    }
}

//export new instance of Orchestrator for the runner
export const runner = new Orchestrator();
