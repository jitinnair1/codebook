import {
  runVerification,
  type VerificationItemResult
} from '../core/verifier';
import { getEnabledLanguages } from '../languages/language-registry';
import { elements } from '../core/elements';
import { ICONS } from './icons';

let isRunning = false;
let abortRequested = false;
let selectedLanguageFilter: string = 'all';
let isInitialized = false;

export function initSpeedrunButton() {
  if (!import.meta.env.DEV) return;

  const btn = elements.speedrunBtn;
  if (!btn) return;

  btn.innerHTML = ICONS.ROCKET;
  btn.classList.add('md:block');

  btn.addEventListener('click', openSpeedrunModal);
}

function initSpeedrunModal() {
  if (isInitialized) return;
  isInitialized = true;

  if (elements.speedrun.headerIcon) {
    elements.speedrun.headerIcon.innerHTML = ICONS.ROCKET;
  }
  if (elements.speedrun.closeBtn) {
    elements.speedrun.closeBtn.innerHTML = ICONS.CLOSE;
  }

  // Bind close events
  elements.speedrun.closeBtn?.addEventListener('click', closeSpeedrunModal);

  elements.speedrun.modal?.addEventListener('click', (e) => {
    if (e.target === elements.speedrun.modal && !isRunning) {
      closeSpeedrunModal();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.speedrun.modal && !elements.speedrun.modal.classList.contains('hidden') && !isRunning) {
      closeSpeedrunModal();
    }
  });

  // Bind actions
  elements.speedrun.startBtn?.addEventListener('click', handleToggleRun);
}

function renderLanguageFilters() {
  const container = elements.speedrun.langFilters;
  if (!container) return;

  const enabledLanguages = getEnabledLanguages();
  const options = [{ id: 'all', name: 'All Languages' }, ...enabledLanguages];

  container.innerHTML = options.map((opt) => {
    const isActive = selectedLanguageFilter === opt.id;
    return `
      <button data-lang="${opt.id}" class="speedrun-filter-btn px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${isActive
        ? 'bg-brand text-white shadow-xs'
        : 'bg-bg-surface text-fg-muted hover:text-fg-primary border border-border-default'
      }">
        ${opt.name}
      </button>
    `;
  }).join('');

  container.querySelectorAll('.speedrun-filter-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (isRunning) return;
      const target = e.currentTarget as HTMLElement;
      selectedLanguageFilter = target.dataset.lang || 'all';
      renderLanguageFilters();
    });
  });
}

function openSpeedrunModal() {
  initSpeedrunModal();
  renderLanguageFilters();
  if (elements.speedrun.modal) {
    elements.speedrun.modal.classList.remove('hidden');
    elements.speedrun.modal.classList.add('flex');
  }
}

function closeSpeedrunModal() {
  if (elements.speedrun.modal) {
    elements.speedrun.modal.classList.add('hidden');
    elements.speedrun.modal.classList.remove('flex');
  }
}

async function handleToggleRun() {
  if (isRunning) {
    abortRequested = true;
    if (elements.speedrun.startBtn) elements.speedrun.startBtn.textContent = 'Stopping...';
    return;
  }

  isRunning = true;
  abortRequested = false;

  const { startBtn, progressContainer, progressBar, progressStatus, progressCounter, resultsList, stats } = elements.speedrun;

  if (startBtn) {
    startBtn.textContent = 'Abort Run';
    startBtn.classList.remove('bg-brand');
    startBtn.classList.add('bg-red-500');
  }
  if (progressContainer) progressContainer.classList.remove('hidden');
  if (progressStatus) progressStatus.textContent = 'Initializing runtimes...';
  if (progressBar) progressBar.style.width = '0%';
  if (progressCounter) progressCounter.textContent = '0 / 0';
  if (stats.passed) stats.passed.textContent = 'Passed: 0';
  if (stats.failed) stats.failed.textContent = 'Failed: 0';
  if (stats.errors) stats.errors.textContent = 'Errors: 0';
  if (stats.missing) stats.missing.textContent = 'Missing: 0';
  if (stats.time) stats.time.textContent = '0.00s';
  if (resultsList) resultsList.innerHTML = '';

  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;
  let missingCount = 0;

  const startTime = performance.now();

  try {
    await runVerification({
      languageId: selectedLanguageFilter === 'all' ? undefined : selectedLanguageFilter,
      shouldAbort: () => abortRequested,
      onProgress: (prog) => {
        const percent = Math.round((prog.current / prog.total) * 100);
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressCounter) progressCounter.textContent = `${prog.current} / ${prog.total}`;

        if (prog.currentItem && !prog.latestResult) {
          if (progressStatus) {
            progressStatus.textContent = `Running ${prog.currentItem.exerciseId} (${prog.currentItem.languageId})...`;
          }
        }

        if (prog.latestResult && resultsList) {
          const res = prog.latestResult;
          if (res.status === 'passed') passedCount++;
          else if (res.status === 'failed') failedCount++;
          else if (res.status === 'error') errorCount++;
          else if (res.status === 'missing_solution') missingCount++;

          if (stats.passed) stats.passed.textContent = `Passed: ${passedCount}`;
          if (stats.failed) stats.failed.textContent = `Failed: ${failedCount}`;
          if (stats.errors) stats.errors.textContent = `Errors: ${errorCount}`;
          if (stats.missing) stats.missing.textContent = `Missing: ${missingCount}`;
          if (stats.time) stats.time.textContent = `${((performance.now() - startTime) / 1000).toFixed(2)}s`;

          appendResultCard(resultsList, res);
        }
      }
    });

    if (progressStatus) {
      progressStatus.textContent = abortRequested ? 'Verification Aborted' : 'Verification Complete';
    }
  } catch (err: any) {
    if (progressStatus) progressStatus.textContent = `Error: ${err?.message || err}`;
  } finally {
    isRunning = false;
    abortRequested = false;
    if (startBtn) {
      startBtn.textContent = 'Start Speedrun';
      startBtn.classList.remove('bg-red-500');
      startBtn.classList.add('bg-brand');
    }
  }
}

function appendResultCard(container: HTMLElement, result: VerificationItemResult) {
  const badgeColors: Record<string, { bg: string; text: string; label: string }> = {
    passed: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', label: 'PASS' },
    failed: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', label: 'FAIL' },
    error: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'ERROR' },
    missing_solution: { bg: 'bg-zinc-500/10 border-zinc-500/30', text: 'text-zinc-400', label: 'MISSING' }
  };

  const badge = badgeColors[result.status] || badgeColors.error;
  const hasLogs = Boolean(result.error || result.output);
  const cardId = `speedrun-card-${result.exerciseId.replace('.', '_')}-${result.languageId}`;

  const card = document.createElement('div');
  card.className = 'border border-border-default rounded-lg bg-bg-surface overflow-hidden transition-all text-xs';

  //JN: entry for each test result
  card.innerHTML = `
    <div class="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-bg-app/50 transition-colors" data-toggle="${cardId}">
      <div class="flex items-center gap-3">
        <span class="px-2 py-0.5 font-bold uppercase rounded text-[10px] border ${badge.bg} ${badge.text}">
          ${badge.label}
        </span>
        <span class="font-semibold text-fg-primary">${result.exerciseId} ${result.exerciseTitle}</span>
        <span class="font-mono text-fg-muted bg-bg-app px-1.5 py-0.5 rounded text-[11px]">${result.languageId}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-fg-muted">${result.durationMs}ms</span>
        ${hasLogs ? `<span class="text-fg-muted text-[10px] underline">Details</span>` : ''}
      </div>
    </div>
    ${hasLogs
      ? `
      <div id="${cardId}" class="hidden px-4 py-3 border-t border-border-default bg-bg-app/40 space-y-2 font-mono text-[11px]">
        ${result.error
        ? `<div><span class="text-red-400 font-bold block mb-1">Error / Failure:</span><pre class="p-2 bg-bg-app rounded border border-border-default overflow-x-auto text-red-300 whitespace-pre-wrap">${escapeHtml(result.error)}</pre></div>`
        : ''
      }
        ${result.output
        ? `<div><span class="text-fg-muted block mb-1">Standard Output:</span><pre class="p-2 bg-bg-app rounded border border-border-default overflow-x-auto text-fg-secondary whitespace-pre-wrap">${escapeHtml(result.output)}</pre></div>`
        : ''
      }
      </div>
    `
      : ''
    }
  `;

  if (hasLogs) {
    const toggleBtn = card.querySelector(`[data-toggle="${cardId}"]`);
    const details = card.querySelector(`#${cardId}`);
    toggleBtn?.addEventListener('click', () => {
      details?.classList.toggle('hidden');
    });
  }

  container.appendChild(card);
  // auto-scroll to bottom of result list
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
