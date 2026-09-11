import * as THREE from 'three';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { appState } from '../core/state.js';

export class M3PlatingModule {
    constructor(sceneManager, chickenMesh) {
        this.sceneManager = sceneManager;
        this.chickenMesh = chickenMesh;
        
        this.dragControls = null;
        this.draggedObject = null;
        this.isActive = false;
        
        this.setupListeners();
    }
    
    setupListeners() {
        appState.subscribe((state) => {
            if (state.currentPhase === 'm3_plate' && !this.isActive) {
                this.activate();
            }
        });
        
        // Listen for scroll wheel to rotate dragged object
        window.addEventListener('wheel', (event) => {
            if (this.isActive && this.draggedObject) {
                this.draggedObject.rotation.y += event.deltaY * 0.005;
            }
        });
    }
    
    activate() {
        this.isActive = true;
        this.sceneManager.showPlate();
        
        // Move camera to see both board and plate
        this.sceneManager.camera.position.set(10, 25, 10);
        this.sceneManager.controls.target.set(10, 0, 0);
        this.sceneManager.controls.update();
        
        // Get all detached parts
        const draggableObjects = [];
        for (const [partName, mesh] of Object.entries(this.chickenMesh.parts)) {
            if (appState.isPartDetached(partName)) {
                draggableObjects.push(mesh);
                // Elevate them slightly to make dragging easier
                mesh.position.y = 1;
            }
        }
        
        // Initialize DragControls
        this.dragControls = new DragControls(draggableObjects, this.sceneManager.camera, this.sceneManager.renderer.domElement);
        
        // Event listeners for dragging
        this.dragControls.addEventListener('dragstart', (event) => {
            this.sceneManager.controls.enabled = false; // Disable orbit while dragging
            this.draggedObject = event.object;
            
            // Visual feedback
            event.object.material.emissive = new THREE.Color(0x333333);
        });
        
        this.dragControls.addEventListener('drag', (event) => {
            // Keep object at a certain height (e.g., y = 0.5) to avoid it going under the plate
            event.object.position.y = 0.5;
        });
        
        this.dragControls.addEventListener('dragend', (event) => {
            this.sceneManager.controls.enabled = true;
            this.draggedObject = null;
            event.object.material.emissive = new THREE.Color(0x000000);
            
            // Check if dropped on plate (X ~ 20)
            if (event.object.position.x > 10) {
                appState.updatePlatingScore(10); // Simple scoring for now
            }
        });
        
        // Show M3 UI
        document.getElementById('m3-ui').classList.remove('hidden');
        document.getElementById('m2-ui').classList.add('hidden');
    }
    
    showTemplate(templateId) {
        // Overlay a template image or mesh
        console.log("Showing template: " + templateId);
    }
}
