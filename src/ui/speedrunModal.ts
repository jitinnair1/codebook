import {
  runVerification,
  type VerificationItemResult
} from '../core/verifier';
import { getEnabledLanguages } from '../languages/language-registry';
import { getExercise } from '../exercises/exercise-registry';
import { getExerciseVariant } from '../core/types';
import { elements } from '../core/elements';
import { ICONS } from './icons';

type StatusFilter = 'all' | 'passed' | 'failed' | 'error' | 'missing_solution';
type SortOrder = 'default' | 'desc' | 'asc';

let isRunning = false;
let abortRequested = false;
let selectedLanguage = 'all';
let isInitialized = false;

let activeStatusFilter: StatusFilter = 'all';
let currentSortOrder: SortOrder = 'default';
let allResults: VerificationItemResult[] = [];

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
  if (elements.speedrun.exportIcon) {
    elements.speedrun.exportIcon.innerHTML = ICONS.DOWNLOAD;
  }
  if (elements.speedrun.sortIcon) {
    elements.speedrun.sortIcon.innerHTML = ICONS.SORT;
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
  elements.speedrun.exportBtn?.addEventListener('click', handleExportCases);
  elements.speedrun.sortBtn?.addEventListener('click', toggleDurationSort);

  initLanguageSelect();
  initStatusFilters();
}

function initLanguageSelect() {
  const select = elements.speedrun.langSelect;
  if (!select) return;

  const enabledLanguages = getEnabledLanguages();
  const options = [{ id: 'all', name: 'All Languages' }, ...enabledLanguages];

  select.innerHTML = options
    .map((opt) => `<option value="${opt.id}">${opt.name}</option>`)
    .join('');

  select.value = selectedLanguage;

  select.addEventListener('change', () => {
    if (isRunning) return;
    selectedLanguage = select.value;
    updateStartButtonText();
  });
}

function updateStartButtonText() {
  const { startBtnText, langSelect } = elements.speedrun;
  if (!startBtnText) return;

  if (isRunning) return;

  if (selectedLanguage === 'all') {
    startBtnText.textContent = 'Start Speedrun (All)';
  } else {
    const selectedOption = langSelect?.selectedOptions?.[0];
    const name = selectedOption?.textContent || selectedLanguage;
    startBtnText.textContent = `Run ${name}`;
  }
}

function initStatusFilters() {
  const container = elements.speedrun.statusFilters;
  if (!container) return;

  container.querySelectorAll('.speedrun-status-pill').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const filter = (target.dataset.filter || 'all') as StatusFilter;
      setStatusFilter(filter);
    });
  });
}

function setStatusFilter(filter: StatusFilter) {
  activeStatusFilter = filter;
  updateStatusFilterPills();
  renderResultsList();
  updateExportButton();
}

function updateStatusFilterPills() {
  const container = elements.speedrun.statusFilters;
  if (!container) return;

  container.querySelectorAll('.speedrun-status-pill').forEach((el) => {
    const btn = el as HTMLElement;
    const filter = btn.dataset.filter as StatusFilter;
    const isActive = activeStatusFilter === filter;

    btn.className = 'speedrun-status-pill px-2.5 py-1 rounded-md font-medium text-xs border transition-all cursor-pointer';

    if (isActive) {
      if (filter === 'all') {
        btn.classList.add('bg-brand', 'text-white', 'border-brand', 'shadow-xs');
      } else if (filter === 'passed') {
        btn.classList.add('bg-green-500/20', 'text-green-400', 'border-green-500/40', 'shadow-xs');
      } else if (filter === 'failed') {
        btn.classList.add('bg-yellow-500/20', 'text-yellow-400', 'border-yellow-500/40', 'shadow-xs');
      } else if (filter === 'error') {
        btn.classList.add('bg-red-500/20', 'text-red-400', 'border-red-500/40', 'shadow-xs');
      } else if (filter === 'missing_solution') {
        btn.classList.add('bg-zinc-500/20', 'text-zinc-300', 'border-zinc-500/40', 'shadow-xs');
      }
    } else {
      if (filter === 'all') {
        btn.classList.add('bg-bg-surface', 'text-fg-primary', 'border-border-default', 'hover:bg-bg-app');
      } else if (filter === 'passed') {
        btn.classList.add('bg-bg-surface', 'text-green-500', 'border-border-default', 'hover:bg-green-500/10', 'hover:border-green-500/30');
      } else if (filter === 'failed') {
        btn.classList.add('bg-bg-surface', 'text-yellow-500', 'border-border-default', 'hover:bg-yellow-500/10', 'hover:border-yellow-500/30');
      } else if (filter === 'error') {
        btn.classList.add('bg-bg-surface', 'text-red-500', 'border-border-default', 'hover:bg-red-500/10', 'hover:border-red-500/30');
      } else if (filter === 'missing_solution') {
        btn.classList.add('bg-bg-surface', 'text-fg-muted', 'border-border-default', 'hover:bg-zinc-500/10', 'hover:border-zinc-500/30');
      }
    }
  });
}

function toggleDurationSort() {
  if (currentSortOrder === 'default') {
    currentSortOrder = 'desc';
  } else if (currentSortOrder === 'desc') {
    currentSortOrder = 'asc';
  } else {
    currentSortOrder = 'default';
  }
  updateSortButtonUI();
  renderResultsList();
}

function updateSortButtonUI() {
  const { sortLabel, sortBtn } = elements.speedrun;
  if (!sortLabel) return;

  if (currentSortOrder === 'desc') {
    sortLabel.textContent = 'Sort: Slowest First (↓)';
    sortBtn?.classList.add('border-brand', 'text-brand');
  } else if (currentSortOrder === 'asc') {
    sortLabel.textContent = 'Sort: Fastest First (↑)';
    sortBtn?.classList.add('border-brand', 'text-brand');
  } else {
    sortLabel.textContent = 'Sort: Default';
    sortBtn?.classList.remove('border-brand', 'text-brand');
  }
}

function openSpeedrunModal() {
  initSpeedrunModal();
  updateStartButtonText();
  updateStatusFilterPills();
  updateSortButtonUI();
  updateExportButton();
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

function getExportableResults(): VerificationItemResult[] {
  if (activeStatusFilter === 'all') {
    return allResults;
  }
  return allResults.filter((r) => r.status === activeStatusFilter);
}

function updateExportButton() {
  const { exportBtn, exportText } = elements.speedrun;
  if (!exportBtn) return;

  const currentExportList = getExportableResults();

  if (allResults.length > 0 && currentExportList.length > 0) {
    exportBtn.classList.remove('hidden');
    exportBtn.removeAttribute('disabled');
    if (exportText) {
      if (activeStatusFilter === 'all') {
        exportText.textContent = `Export All (${currentExportList.length})`;
      } else if (activeStatusFilter === 'failed') {
        exportText.textContent = `Export Failed (${currentExportList.length})`;
      } else if (activeStatusFilter === 'passed') {
        exportText.textContent = `Export Passed (${currentExportList.length})`;
      } else if (activeStatusFilter === 'error') {
        exportText.textContent = `Export Errors (${currentExportList.length})`;
      } else if (activeStatusFilter === 'missing_solution') {
        exportText.textContent = `Export Missing (${currentExportList.length})`;
      }
    }
  } else if (allResults.length > 0) {
    exportBtn.classList.remove('hidden');
    exportBtn.setAttribute('disabled', 'true');
    if (exportText) {
      exportText.textContent = `Export (0)`;
    }
  } else {
    exportBtn.classList.add('hidden');
  }
}

function handleExportCases() {
  const rawList = getExportableResults();
  if (rawList.length === 0) return;

  const exportList = rawList.map((item) => {
    if (item.description !== undefined && item.solutionCode !== undefined && item.testCode !== undefined) {
      return item;
    }
    const ex = getExercise(item.exerciseId);
    const variant = ex ? getExerciseVariant(ex, item.languageId) : undefined;
    return {
      ...item,
      description: item.description ?? ex?.description ?? '',
      solutionCode: item.solutionCode ?? variant?.solutionCode ?? '',
      testCode: item.testCode ?? variant?.testCode ?? ''
    };
  });

  const dataStr = JSON.stringify(exportList, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const prefix = activeStatusFilter === 'all' ? 'speedrun-report' : `speedrun-${activeStatusFilter}`;

  a.href = url;
  a.download = `${prefix}-${timestamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getFilteredAndSortedResults(): VerificationItemResult[] {
  let list = [...allResults];

  if (activeStatusFilter !== 'all') {
    list = list.filter((r) => r.status === activeStatusFilter);
  }

  if (currentSortOrder === 'desc') {
    list.sort((a, b) => b.durationMs - a.durationMs);
  } else if (currentSortOrder === 'asc') {
    list.sort((a, b) => a.durationMs - b.durationMs);
  }

  return list;
}

function renderResultsList() {
  const container = elements.speedrun.resultsList;
  if (!container) return;

  const results = getFilteredAndSortedResults();

  if (results.length === 0) {
    if (allResults.length === 0) {
      container.innerHTML = `
        <div class="text-center py-12 text-fg-muted text-sm flex flex-col items-center gap-2">
          <span>Click <strong>Start Speedrun</strong> to test reference solutions against active runtimes.</span>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="text-center py-8 text-fg-muted text-xs">
          No test items matching filter "<strong>${activeStatusFilter}</strong>".
        </div>
      `;
    }
    return;
  }

  container.innerHTML = '';
  for (const res of results) {
    appendResultCard(container, res);
  }
}

async function handleToggleRun() {
  if (isRunning) {
    abortRequested = true;
    if (elements.speedrun.startBtnText) elements.speedrun.startBtnText.textContent = 'Stopping...';
    return;
  }

  isRunning = true;
  abortRequested = false;
  allResults = [];
  activeStatusFilter = 'all';
  updateStatusFilterPills();
  updateSortButtonUI();
  updateExportButton();

  const { startBtn, startBtnText, progressContainer, progressBar, progressStatus, progressCounter, resultsList, stats } = elements.speedrun;

  if (startBtn) {
    startBtn.classList.remove('bg-brand');
    startBtn.classList.add('bg-red-500');
  }
  if (startBtnText) {
    startBtnText.textContent = 'Abort Run';
  }
  if (progressContainer) progressContainer.classList.remove('hidden');
  if (progressStatus) progressStatus.textContent = 'Initializing runtimes...';
  if (progressBar) progressBar.style.width = '0%';
  if (progressCounter) progressCounter.textContent = '0 / 0';
  if (stats.all) stats.all.textContent = '0';
  if (stats.passed) stats.passed.textContent = '0';
  if (stats.failed) stats.failed.textContent = '0';
  if (stats.errors) stats.errors.textContent = '0';
  if (stats.missing) stats.missing.textContent = '0';
  if (stats.time) stats.time.textContent = '0.00s';
  if (resultsList) resultsList.innerHTML = '';

  let passedCount = 0;
  let failedCount = 0;
  let errorCount = 0;
  let missingCount = 0;

  const startTime = performance.now();

  try {
    await runVerification({
      languageId: selectedLanguage === 'all' ? undefined : selectedLanguage,
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

        if (prog.latestResult) {
          const res = prog.latestResult;
          allResults.push(res);

          if (res.status === 'passed') passedCount++;
          else if (res.status === 'failed') failedCount++;
          else if (res.status === 'error') errorCount++;
          else if (res.status === 'missing_solution') missingCount++;

          if (stats.all) stats.all.textContent = String(allResults.length);
          if (stats.passed) stats.passed.textContent = String(passedCount);
          if (stats.failed) stats.failed.textContent = String(failedCount);
          if (stats.errors) stats.errors.textContent = String(errorCount);
          if (stats.missing) stats.missing.textContent = String(missingCount);
          if (stats.time) stats.time.textContent = `${((performance.now() - startTime) / 1000).toFixed(2)}s`;

          renderResultsList();
          updateExportButton();
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
    updateExportButton();
    if (startBtn) {
      startBtn.classList.remove('bg-red-500');
      startBtn.classList.add('bg-brand');
    }
    updateStartButtonText();
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
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
