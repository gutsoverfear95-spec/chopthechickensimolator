import { appState } from '../core/state.js';

export class M2ChopModule {
    constructor(anatomyData, chickenMesh) {
        this.anatomy = anatomyData;
        this.chickenMesh = chickenMesh;
        this.renderTutorialUI();
        this.setupListeners();
        this.refresh();
    }

    setupListeners() {
        appState.subscribe((state) => {
            this.updateScore(state.score);
            this.checkStepProgress(state);
        });
    }

    renderTutorialUI() {
        if (document.getElementById('tutorial-box')) return;

        const box = document.createElement('div');
        box.id = 'tutorial-box';
        box.className = 'hidden';
        box.innerHTML = `
            <h3>Sư Phụ Chỉ:</h3>
            <p id="tutorial-text">Đang tải...</p>
            <div id="step-progress"></div>
        `;
        document.getElementById('hud').appendChild(box);
    }

    setVisible(on) {
        document.getElementById('tutorial-box')?.classList.toggle('hidden', !on);
        if (!on) this.chickenMesh.highlightJoint(null);
        else this.refresh();
    }

    /**
     * Tiến độ xét theo jointId đã cắt thành công.
     * Trước đây xét theo part, mà partA dùng chung (`uc` cho 2 khớp vai,
     * `lung` cho 2 khớp háng) nên cắt một bên là bên kia tự tick xong.
     */
    checkStepProgress(state) {
        const step = state.getCurrentStep();
        if (step.id === 'done') return;

        if (state.isStepDone(step.id)) {
            appState.advanceStep();
            this.refresh();
        }
    }

    refresh() {
        const step = appState.getCurrentStep();

        const textEl = document.getElementById('tutorial-text');
        if (textEl) {
            textEl.innerText = step.instruction;
            textEl.classList.remove('blink');
            void textEl.offsetWidth;
            textEl.classList.add('blink');
        }

        const progressEl = document.getElementById('step-progress');
        if (progressEl) {
            progressEl.innerHTML = appState.chopSequence.map((s, i) => {
                const done = appState.isStepDone(s.id);
                const active = i === appState.currentChopStepIndex;
                return `<span class="step-dot ${done ? 'done' : ''} ${active ? 'active' : ''}" title="${s.name}"></span>`;
            }).join('');
        }

        // Chế độ hướng dẫn: đánh dấu khớp mục tiêu ngay trên con gà
        this.chickenMesh.highlightJoint(step.id === 'done' ? null : step.id);

        const switchBtn = document.getElementById('btn-switch-m3');
        if (switchBtn) switchBtn.classList.toggle('hidden', !appState.isChopComplete());
    }

    updateScore(score) {
        const el = document.getElementById('total-score');
        if (el) el.innerText = score;
    }
}
