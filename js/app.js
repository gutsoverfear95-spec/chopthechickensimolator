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
    constructor() {
        this.init();
    }
    
    async init() {
        // Load anatomy data
        const response = await fetch('js/anatomy/chicken-anatomy.json');
        this.anatomyData = await response.json();
        
        this.sceneManager = new SceneManager('canvas-container');
        this.chickenMesh = new ChickenMesh();
        this.sceneManager.scene.add(this.chickenMesh.group);
        
        this.scoringSystem = new ScoringSystem(this.anatomyData);
        
        this.knifeControl = new KnifeControl(
            this.sceneManager.scene, 
            this.sceneManager.camera, 
            this.sceneManager.renderer.domElement, 
            this.chickenMesh,
            this.scoringSystem
        );
        
        this.m1Module = new M1PrepModule();
        this.m2Module = new M2ChopModule(this.anatomyData);
        this.m3Module = new M3PlatingModule(this.sceneManager, this.chickenMesh);
        this.uiAnalysis = new UIAnalysis();
        
        // Hide M2 initially since we start in M1
        document.getElementById('m2-ui').classList.add('hidden');
        if (this.knifeControl.knifeGroup) this.knifeControl.knifeGroup.visible = false;
        
        appState.subscribe((state) => {
            if (state.currentPhase === 'm2_chop') {
                document.getElementById('m2-ui').classList.remove('hidden');
                document.getElementById('btn-switch-m3').classList.remove('hidden');
            }
        });
        
        this.setupUI();
        this.animate();
    }
    
    setupUI() {
        document.getElementById('btn-cam-top').addEventListener('click', () => this.sceneManager.setCameraView('top'));
        document.getElementById('btn-cam-side').addEventListener('click', () => this.sceneManager.setCameraView('side'));
        document.getElementById('btn-cam-front').addEventListener('click', () => this.sceneManager.setCameraView('front'));
        
        document.getElementById('btn-flip-chicken').addEventListener('click', () => {
            this.chickenMesh.flip();
        });
        
        document.getElementById('btn-switch-m3').addEventListener('click', () => {
            appState.changePhase('m3_plate');
            // Hide M2 controls
            document.getElementById('btn-switch-m3').classList.add('hidden');
            if (this.knifeControl.knifeGroup) this.knifeControl.knifeGroup.visible = false;
        });
        
        document.getElementById('btn-compare').addEventListener('click', () => {
            this.m3Module.showTemplate('tai_dung');
        });
        
        document.getElementById('btn-finish').addEventListener('click', () => {
            // Lưu profile ở đây
            appState.saveProfile();
            this.uiAnalysis.showAnalysis();
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.knifeControl && appState.currentPhase === 'm2_chop') {
            this.knifeControl.update();
        }
        if (this.sceneManager) this.sceneManager.render();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

