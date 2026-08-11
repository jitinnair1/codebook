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
        this.setRunningState(false);
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
                this.setRunningState(this.isRunning);
                if (!elements.console.textContent || elements.console.textContent === "// Ready...") {
                    elements.console.textContent = `${activeRunner.name.toUpperCase()} runtime initialization failed:\n${initError}`;
                }
                return;
            }

            const ready = await activeRunner.isReady();
            if (ready !== this.isReady) {
                this.isReady = ready;
                if (ready) {
                    status.setReady();
                }
                this.setRunningState(this.isRunning);
            }
        }, 500);
    }
}

//export new instance of Orchestrator for the runner
export const runner = new Orchestrator();
