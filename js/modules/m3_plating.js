import * as THREE from 'three';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { appState } from '../core/state.js';

const PLATE_CENTER = new THREE.Vector3(20, 0, 0);
const PLATE_RADIUS = 8.5;

export class M3PlatingModule {
    constructor(sceneManager, chickenMesh) {
        this.sceneManager = sceneManager;
        this.chickenMesh = chickenMesh;

        this.dragControls = null;
        this.draggedObject = null;
        this.isActive = false;
        this.scoredParts = new Set();
        this._symmetryBonus = 0;

        this.setupListeners();
    }

    setupListeners() {
        appState.subscribe((state) => {
            if (state.currentPhase === 'm3_plate' && !this.isActive) this.activate();
        });

        window.addEventListener('wheel', (event) => {
            if (this.isActive && this.draggedObject) {
                event.preventDefault();
                this.draggedObject.rotation.y += event.deltaY * 0.005;
            }
        }, { passive: false });
    }

    activate() {
        this.isActive = true;
        this.sceneManager.showPlate();

        this.sceneManager.camera.position.set(12, 26, 16);
        this.sceneManager.controls.target.set(10, 0, 0);
        this.sceneManager.controls.update();

        // Các miếng đã rời nằm trong chickenMesh.loose — group này luôn ở identity
        // transform, tức là local == world, nên DragControls hoạt động đúng.
        const draggable = this.chickenMesh.getLooseParts();
        draggable.forEach(mesh => { mesh.position.y = 1; });

        this.dragControls = new DragControls(
            draggable, this.sceneManager.camera, this.sceneManager.renderer.domElement
        );

        this.dragControls.addEventListener('dragstart', (event) => {
            this.sceneManager.controls.enabled = false;
            this.draggedObject = event.object;
            event.object.material.emissive = new THREE.Color(0x553311);
        });

        this.dragControls.addEventListener('drag', (event) => {
            event.object.position.y = 0.8;
        });

        this.dragControls.addEventListener('dragend', (event) => {
            this.sceneManager.controls.enabled = true;
            this.draggedObject = null;
            event.object.material.emissive = new THREE.Color(0x000000);
            this.scorePlacement(event.object);
        });

        document.getElementById('m3-ui').classList.remove('hidden');
        document.getElementById('m2-ui').classList.add('hidden');
        document.getElementById('tutorial-box')?.classList.add('hidden');
    }

    scorePlacement(mesh) {
        const partId = mesh.userData.partId;
        const flat = new THREE.Vector3(mesh.position.x, 0, mesh.position.z);
        const onPlate = flat.distanceTo(PLATE_CENTER) < PLATE_RADIUS;

        if (onPlate && !this.scoredParts.has(partId)) {
            this.scoredParts.add(partId);
            appState.updatePlatingScore(12);
            this.flash(`Đã xếp ${mesh.userData.label} lên đĩa (+12)`);
        } else if (!onPlate && this.scoredParts.has(partId)) {
            this.scoredParts.delete(partId);
            appState.updatePlatingScore(-12);
        }

        this.scoreSymmetry();
    }

    /** Thưởng thêm cho bố cục đối xứng trái–phải quanh trục đĩa. */
    scoreSymmetry() {
        const pairs = [
            ['canh_trai', 'canh_phai'],
            ['dui_goc_tu_trai', 'dui_goc_tu_phai']
        ];
        let bonus = 0;

        for (const [a, b] of pairs) {
            if (!this.scoredParts.has(a) || !this.scoredParts.has(b)) continue;
            const ma = this.chickenMesh.parts[a], mb = this.chickenMesh.parts[b];
            const da = ma.position.z - PLATE_CENTER.z;
            const db = mb.position.z - PLATE_CENTER.z;
            if (Math.abs(da + db) < 2.0) bonus += 10;
        }

        if (bonus !== this._symmetryBonus) {
            appState.updatePlatingScore(bonus - this._symmetryBonus);
            this._symmetryBonus = bonus;
        }
    }

    flash(text) {
        const el = document.getElementById('action-feedback');
        if (!el) return;
        el.className = 'feedback-good';
        el.innerText = text;
        clearTimeout(this._t);
        this._t = setTimeout(() => el.classList.add('hidden'), 1800);
    }

    showTemplate() {
        if (this.template) {
            this.template.visible = !this.template.visible;
            return;
        }

        // Bản mẫu "tái dựng dáng gà": các ô mờ chỉ chỗ đặt từng miếng
        this.template = new THREE.Group();
        const slots = [
            { id: 'lung',            pos: [20, 0.3, 0],    r: 2.2 },
            { id: 'uc',              pos: [20, 0.3, 2.6],  r: 1.8 },
            { id: 'dui_goc_tu_trai', pos: [16.5, 0.3, -2], r: 1.4 },
            { id: 'dui_goc_tu_phai', pos: [23.5, 0.3, -2], r: 1.4 },
            { id: 'canh_trai',       pos: [16.5, 0.3, 2.5],r: 1.1 },
            { id: 'canh_phai',       pos: [23.5, 0.3, 2.5],r: 1.1 },
            { id: 'co',              pos: [20, 0.3, 5.5],  r: 1.1 }
        ];

        for (const s of slots) {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(s.r - 0.12, s.r, 32),
                new THREE.MeshBasicMaterial({ color: 0x1565c0, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.fromArray(s.pos);
            this.template.add(ring);
        }

        this.sceneManager.scene.add(this.template);
    }
}
