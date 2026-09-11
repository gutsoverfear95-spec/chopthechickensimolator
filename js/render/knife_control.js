import * as THREE from 'three';
import { appState } from '../core/state.js';
import { audioSystem } from '../core/audio.js';

export class KnifeControl {
    constructor(scene, camera, domElement, chickenMesh, scoringSystem) {
        this.scene = scene;
        this.camera = camera;
        this.domElement = domElement;
        this.chickenMesh = chickenMesh;
        this.scoringSystem = scoringSystem;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.isChopping = false;
        this.chopStartTime = 0;
        this.knifeAngle = 0; // rotation around Y axis
        this.shakeIntensity = 0;
        this.originalCameraPos = camera.position.clone();
        
        this.createKnife();
        this.createGuideLine();
        
        this.setupEvents();
    }
    
    createKnife() {
        this.knifeGroup = new THREE.Group();
        
        // Lưỡi dao (Blade) - Dao phay VN bản to
        const bladeGeo = new THREE.BoxGeometry(0.1, 4, 8);
        const bladeMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.8,
            roughness: 0.2
        });
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        blade.position.set(0, 2, 0); // origin at bottom edge
        blade.castShadow = true;
        this.knifeGroup.add(blade);
        
        // Cán dao (Handle)
        const handleGeo = new THREE.CylinderGeometry(0.3, 0.3, 4, 16);
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x3e2723, // Dark wood
            roughness: 0.9
        });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 3, -6);
        handle.castShadow = true;
        this.knifeGroup.add(handle);
        
        this.scene.add(this.knifeGroup);
        this.knifeGroup.visible = false;
    }
    
    createGuideLine() {
        // Red line showing where the cut will happen
        this.guideLineGeo = new THREE.BoxGeometry(10, 0.05, 0.05);
        this.guideLineMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.7 });
        this.guideLine = new THREE.Mesh(this.guideLineGeo, this.guideLineMat);
        this.scene.add(this.guideLine);
        this.guideLine.visible = false;
        
        // Cutting plane representation (semi-transparent)
        const planeGeo = new THREE.PlaneGeometry(10, 10);
        const planeMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.cutPlane = new THREE.Mesh(planeGeo, planeMat);
        this.scene.add(this.cutPlane);
        this.cutPlane.visible = false;
    }
    
    setupEvents() {
        this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.domElement.addEventListener('wheel', this.onWheel.bind(this));
    }
    
    onMouseMove(event) {
        if (this.isChopping) return; // Don't move while charging power
        
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Intersect with board or chicken
        const board = this.scene.children.find(c => c.geometry?.type === 'CylinderGeometry');
        const intersectObjects = [this.chickenMesh.group];
        if (board) intersectObjects.push(board);
        
        const intersects = this.raycaster.intersectObjects(intersectObjects, true);
        
        if (intersects.length > 0) {
            const hit = intersects[0];
            this.knifeGroup.visible = true;
            this.guideLine.visible = true;
            this.cutPlane.visible = true;
            
            // Position knife above the hit point
            this.knifeGroup.position.copy(hit.point);
            this.knifeGroup.position.y += 2; // hover above
            
            // Apply rotation
            this.knifeGroup.rotation.y = this.knifeAngle;
            
            // Position guides
            this.guideLine.position.copy(hit.point);
            this.guideLine.rotation.y = this.knifeAngle + Math.PI / 2; // Box Geo is X long, Blade is Z long
            
            this.cutPlane.position.copy(hit.point);
            this.cutPlane.rotation.x = 0; // Vertical
            this.cutPlane.rotation.y = this.knifeAngle + Math.PI / 2; 
            
        } else {
            this.knifeGroup.visible = false;
            this.guideLine.visible = false;
            this.cutPlane.visible = false;
        }
    }
    
    onWheel(event) {
        // Rotate knife
        this.knifeAngle += event.deltaY * 0.001;
        this.knifeGroup.rotation.y = this.knifeAngle;
        
        // Ensure guideline and plane rotate with it
        this.guideLine.rotation.y = this.knifeAngle + Math.PI / 2;
        this.cutPlane.rotation.y = this.knifeAngle + Math.PI / 2;
    }
    
    onMouseDown(event) {
        if (!this.knifeGroup.visible) return;
        if (event.button !== 0) return; // left click only
        
        this.isChopping = true;
        this.chopStartTime = performance.now();
        
        // Lift knife up to prepare strike
        this.knifeGroup.position.y += 3;
    }
    
    onMouseUp(event) {
        if (!this.isChopping) return;
        if (event.button !== 0) return;
        
        this.isChopping = false;
        const holdTime = performance.now() - this.chopStartTime;
        
        // Strike down animation
        this.knifeGroup.position.y -= 3;
        
        this.evaluateChop(holdTime);
    }
    
    evaluateChop(holdTime) {
        // Force based on hold time (max 1000ms)
        const force = Math.min(holdTime / 1000, 1.0);
        
        const feedbackEl = document.getElementById('action-feedback');
        feedbackEl.className = ''; // remove hidden
        
        if (!this.scoringSystem) {
            feedbackEl.innerText = "Chưa tải dữ liệu chấm điểm!";
            setTimeout(() => feedbackEl.classList.add('hidden'), 1500);
            return;
        }

        // Tọa độ hiện tại của dao
        const cutPoint = this.knifeGroup.position.clone();
        
        // Chấm điểm
        const result = this.scoringSystem.evaluateCut(cutPoint, this.knifeAngle, force);
        
        // Hiển thị Feedback
        feedbackEl.innerText = `${result.type}: ${result.message}`;
        if (result.score > 0) {
            feedbackEl.classList.add('feedback-good');
        } else {
            feedbackEl.classList.add('feedback-bad');
        }
        
        // Xử lý tách part hoặc rơi vụn xương
        if (result.success) {
            // Tách cả 2 part của khớp (thực tế chỉ 1 part rớt ra tùy gốc, nhưng ta làm đơn giản tách cả 2 nếu chưa tách)
            if (!appState.isPartDetached(result.partA)) {
                this.chickenMesh.detachPart(result.partA);
                appState.markPartDetached(result.partA);
            }
            if (!appState.isPartDetached(result.partB)) {
                this.chickenMesh.detachPart(result.partB);
                appState.markPartDetached(result.partB);
            }
        }
        
        if (result.type === 'Phạm xương') {
            this.chickenMesh.createBoneShards(cutPoint);
            audioSystem.playChop(true); // Tiếng khục
            this.shakeIntensity = 0.5; // Rung mạnh
        } else {
            audioSystem.playChop(false); // Tiếng cạch
            this.shakeIntensity = 0.1; // Rung nhẹ
        }
        
        // Cập nhật State
        appState.addCutResult(result);
        
        setTimeout(() => {
            feedbackEl.classList.add('hidden');
        }, 3000);
    }
    
    update() {
        if (this.isChopping) {
            const chargeTime = performance.now() - this.chopStartTime;
            if (chargeTime > 500) {
                // Shake knife if holding too long
                this.knifeGroup.position.x += (Math.random() - 0.5) * 0.1;
                this.knifeGroup.position.z += (Math.random() - 0.5) * 0.1;
            }
        }
        
        // Camera shake
        if (this.shakeIntensity > 0) {
            this.camera.position.x = this.originalCameraPos.x + (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y = this.originalCameraPos.y + (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity -= 0.05;
            if (this.shakeIntensity <= 0) {
                this.shakeIntensity = 0;
                this.camera.position.copy(this.originalCameraPos);
            }
        } else {
            // Cập nhật original pos trong trường hợp user orbit
            this.originalCameraPos.copy(this.camera.position);
        }
    }
}
