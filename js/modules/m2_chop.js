import { appState } from '../core/state.js';

export class M2ChopModule {
    constructor(anatomyData) {
        this.anatomy = anatomyData;
        this.setupListeners();
        this.renderTutorialUI();
        this.updateTutorialUI();
    }

    setupListeners() {
        appState.subscribe((state) => {
            this.updateScore(state.score);
            this.checkStepProgress(state);
        });
    }

    renderTutorialUI() {
        const hud = document.getElementById('hud');
        
        const tutorialBox = document.createElement('div');
        tutorialBox.id = 'tutorial-box';
        tutorialBox.innerHTML = `
            <h3>Sư Phụ Chỉ:</h3>
            <p id="tutorial-text">Đang tải...</p>
        `;
        hud.appendChild(tutorialBox);
    }

    updateTutorialUI() {
        const step = appState.getCurrentStep();
        const textEl = document.getElementById('tutorial-text');
        if (textEl) {
            textEl.innerText = step.instruction;
            // Hiệu ứng nhấp nháy cho text
            textEl.classList.remove('blink');
            void textEl.offsetWidth; // trigger reflow
            textEl.classList.add('blink');
        }
    }

    checkStepProgress(state) {
        const step = state.getCurrentStep();
        if (step.id === 'done') return;

        // Kiểm tra xem khớp mục tiêu của bước hiện tại đã bị cắt rời chưa
        // Nếu là khớp nối thông thường
        if (this.anatomy.joints[step.id]) {
            const joint = this.anatomy.joints[step.id];
            if (state.isPartDetached(joint.partB) || state.isPartDetached(joint.partA)) {
                // Đã cắt thành công
                appState.advanceStep();
                this.updateTutorialUI();
            }
        }
    }

    updateScore(score) {
        const scoreEl = document.getElementById('total-score');
        if (scoreEl) {
            scoreEl.innerText = Math.max(0, score);
        }
    }
}
