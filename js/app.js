import { SceneManager } from './render/scene.js';
import { ChickenMesh } from './render/chicken_mesh.js';
import { KnifeControl } from './render/knife_control.js';
import { appState } from './core/state.js';
import { ScoringSystem } from './core/scoring.js';
import { M1PrepModule } from './modules/m1_prep.js';
import { M2ChopModule } from './modules/m2_chop.js';
import { M3PlatingModule } from './modules/m3_plating.js';
import { UIAnalysis } from './ui/ui_analysis.js';

class App {
    async init() {
        // Đường dẫn tương đối theo module này => chạy đúng cả khi deploy dưới subpath
        const url = new URL('./anatomy/chicken-anatomy.json', import.meta.url);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Không tải được dữ liệu giải phẫu (${response.status})`);
        this.anatomyData = await response.json();

        this.sceneManager = new SceneManager('canvas-container');

        this.chickenMesh = new ChickenMesh(this.anatomyData);
        this.sceneManager.scene.add(this.chickenMesh.group);
        this.sceneManager.scene.add(this.chickenMesh.loose);

        this.scoringSystem = new ScoringSystem(this.anatomyData);
        this.knifeControl = new KnifeControl(this.sceneManager, this.chickenMesh, this.scoringSystem);

        this.m1Module = new M1PrepModule();
        this.m2Module = new M2ChopModule(this.anatomyData, this.chickenMesh, this.sceneManager);
        this.m3Module = new M3PlatingModule(this.sceneManager, this.chickenMesh);
        this.uiAnalysis = new UIAnalysis(this.anatomyData);

        this.applyPhase(appState.currentPhase);
        appState.subscribe((state) => {
            if (state.currentPhase !== this._lastPhase) this.applyPhase(state.currentPhase);
        });

        this.setupUI();
        this.animate();
    }

    /** Một chỗ duy nhất quyết định UI/điều khiển nào bật theo giai đoạn. */
    applyPhase(phase) {
        this._lastPhase = phase;

        const inM2 = phase === 'm2_chop';
        const inM3 = phase === 'm3_plate';

        document.getElementById('m2-ui').classList.toggle('hidden', !inM2);
        document.getElementById('m3-ui').classList.toggle('hidden', !inM3);
        document.getElementById('camera-controls').classList.toggle('hidden', phase === 'm1_prep');

        this.knifeControl.setEnabled(inM2);
        this.m2Module.setVisible(inM2);

        const switchBtn = document.getElementById('btn-switch-m3');
        if (switchBtn) switchBtn.classList.toggle('hidden', !(inM2 && appState.isChopComplete()));
    }

    setupUI() {
        const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);

        on('btn-cam-top',   () => this.sceneManager.setCameraView('top'));
        on('btn-cam-side',  () => this.sceneManager.setCameraView('side'));
        on('btn-cam-front', () => this.sceneManager.setCameraView('front'));
        on('btn-flip-chicken', () => this.chickenMesh.flip());

        on('btn-switch-m3', () => appState.changePhase('m3_plate'));
        on('btn-compare',   () => this.m3Module.showTemplate());
        on('btn-finish',    () => {
            appState.saveProfile();
            this.uiAnalysis.showAnalysis();
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const now = performance.now();
        this.knifeControl.update(now);
        this.sceneManager.render();
    }
}

function showFatal(err) {
    console.error(err);
    const el = document.getElementById('action-feedback');
    if (el) {
        el.className = 'feedback-bad';
        el.innerText = 'Lỗi khởi động: ' + err.message;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    window.app.init().catch(showFatal);
});
