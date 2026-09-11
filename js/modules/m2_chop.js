import * as THREE from 'three';
import { appState } from '../core/state.js';

const BODY_CENTER = new THREE.Vector3(0, 3, 0);

export class M2ChopModule {
    constructor(anatomyData, chickenMesh, sceneManager) {
        this.anatomy = anatomyData;
        this.chickenMesh = chickenMesh;
        this.sceneManager = sceneManager;
        this.visible = false;

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
            <button id="btn-refocus" class="btn-ghost">Đưa camera về khớp ⟳</button>
        `;
        document.getElementById('hud').appendChild(box);

        document.getElementById('btn-refocus')
            .addEventListener('click', () => this.focusCurrentJoint(600));
    }

    setVisible(on) {
        this.visible = on;
        document.getElementById('tutorial-box')?.classList.toggle('hidden', !on);
        if (!on) this.chickenMesh.highlightJoint(null);
        else { this.refresh(); this.focusCurrentJoint(1100); }
    }

    /**
     * Tiến độ xét theo jointId đã cắt thành công.
     * Xét theo part thì sai, vì partA dùng chung (`uc` cho hai khớp vai,
     * `lung` cho hai khớp háng) nên cắt một bên là bên kia tự tick xong.
     */
    checkStepProgress(state) {
        const step = state.getCurrentStep();
        if (step.id === 'done') return;

        if (state.isStepDone(step.id)) {
            appState.advanceStep();
            this.refresh();
            this.focusCurrentJoint(900);
        }
    }

    /**
     * Đưa camera tới góc nhìn thấy rõ khớp của bước hiện tại.
     * Hướng nhìn lấy từ chính vị trí khớp so với tâm thân gà, nên thêm khớp mới
     * vào JSON là camera tự biết đứng đâu, không phải khai báo gì thêm.
     */
    focusCurrentJoint(duration = 900) {
        if (!this.visible || !this.sceneManager) return;

        const step = appState.getCurrentStep();
        const joint = this.anatomy.joints[step.id];
        if (!joint) return;

        this.chickenMesh.group.updateMatrixWorld(true);
        const jointWorld = this.chickenMesh.group.localToWorld(
            new THREE.Vector3().fromArray(joint.position)
        );
        const centerWorld = this.chickenMesh.group.localToWorld(BODY_CENTER.clone());

        const outward = jointWorld.clone().sub(centerWorld);
        outward.y = 0;
        if (outward.lengthSq() < 0.01) outward.set(0, 0, 1);
        outward.normalize();

        // Nhìn THẲNG vào mặt phẳng cắt thì mặt phẳng phủ kín màn hình và che mất
        // con gà. Phải đứng lệch sang phía trục lưỡi dao để thấy mặt phẳng ở dạng
        // cạnh — lúc đó mới đọc được nó đang lệch khỏi khớp bao nhiêu.
        const normalWorld = new THREE.Vector3().fromArray(joint.normal)
            .applyQuaternion(this.chickenMesh.group.getWorldQuaternion(new THREE.Quaternion()))
            .setY(0).normalize();

        const blade = new THREE.Vector3().crossVectors(normalWorld, new THREE.Vector3(0, 1, 0)).normalize();

        // Chọn chiều gần với vị trí camera hiện tại để đỡ bị quay giật mình
        const fromCam = this.sceneManager.camera.position.clone().sub(jointWorld).setY(0);
        if (blade.dot(fromCam) < 0) blade.negate();

        const dir = blade.multiplyScalar(1.0).add(outward.multiplyScalar(0.55)).normalize();

        const camPos = jointWorld.clone()
            .add(dir.multiplyScalar(13))
            .add(new THREE.Vector3(0, 8.5, 0));

        const target = jointWorld.clone().lerp(centerWorld, 0.4);
        this.sceneManager.focusOn(camPos, target, duration);
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

        this.chickenMesh.highlightJoint(step.id === 'done' ? null : step.id);

        document.getElementById('btn-refocus')?.classList.toggle('hidden', step.id === 'done');

        const switchBtn = document.getElementById('btn-switch-m3');
        if (switchBtn) switchBtn.classList.toggle('hidden', !appState.isChopComplete());
    }

    updateScore(score) {
        const el = document.getElementById('total-score');
        if (el) el.innerText = score;
    }
}
