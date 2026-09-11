import * as THREE from 'three';
import { appState } from '../core/state.js';
import { audioSystem } from '../core/audio.js';
import { ScoringSystem } from '../core/scoring.js';

const MAX_PITCH = THREE.MathUtils.degToRad(75);
const HOVER_HEIGHT = 1.2;
const CHARGE_LIFT = 3;

export class KnifeControl {
    constructor(sceneManager, chickenMesh, scoringSystem) {
        this.sceneManager = sceneManager;
        this.scene = sceneManager.scene;
        this.camera = sceneManager.camera;
        this.orbit = sceneManager.controls;
        this.domElement = sceneManager.renderer.domElement;
        this.chickenMesh = chickenMesh;
        this.scoringSystem = scoringSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.enabled = false;
        this.isChopping = false;
        this.chopStartTime = 0;
        this.yaw = 0;     // xoay quanh trục đứng
        this.pitch = 0;   // nghiêng lưỡi dao (0 = vuông góc thớt)
        this.hoverPoint = null;

        this.createKnife();
        this.createGuides();
        this.setupEvents();
    }

    setEnabled(on) {
        this.enabled = on;
        this.orbit.enabled = true;

        if (on) {
            // Trong M2, chuột trái thuộc về con dao. Camera xoay bằng chuột phải,
            // lăn chuột dùng để xoay lưỡi dao chứ không zoom.
            this.orbit.mouseButtons = {
                LEFT: null,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.ROTATE
            };
            this.orbit.enableZoom = false;
        } else {
            this.orbit.mouseButtons = {
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: THREE.MOUSE.PAN
            };
            this.orbit.enableZoom = true;

            this.isChopping = false;
            this.hoverPoint = null;
            this.showGuides(false);
        }
    }

    createKnife() {
        this.knifeGroup = new THREE.Group();

        // Lưỡi dao vừa phải: to quá thì che mất chính chỗ đang cần nhìn.
        // metalness thấp vì cảnh không có envMap — để 0.85 thì lưỡi dao ra màu đen kịt.
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.09, 2.8, 6),
            new THREE.MeshStandardMaterial({ color: 0xe8edf2, metalness: 0.45, roughness: 0.28 })
        );
        blade.position.set(0, 1.4, 0);
        blade.castShadow = true;
        this.knifeGroup.add(blade);

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.28, 0.28, 3.4, 16),
            new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 })
        );
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 2.2, -4.6);
        handle.castShadow = true;
        this.knifeGroup.add(handle);

        this.scene.add(this.knifeGroup);
        this.knifeGroup.visible = false;
    }

    createGuides() {
        this.guideLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 9),
            new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.85, depthTest: false })
        );
        this.guideLine.renderOrder = 998;
        this.guideLine.visible = false;
        this.scene.add(this.guideLine);

        this.cutPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(9, 7),
            new THREE.MeshBasicMaterial({
                color: 0xff3b30, transparent: true, opacity: 0.13,
                side: THREE.DoubleSide, depthWrite: false
            })
        );
        this.cutPlane.visible = false;
        this.scene.add(this.cutPlane);
    }

    setupEvents() {
        this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        // mouseup gắn lên window: nhả chuột ngoài canvas vẫn kết thúc nhát dao
        window.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.domElement.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        window.addEventListener('keydown', this.onKeyDown.bind(this));

        // Cảm ứng (tablet là thiết bị mục tiêu)
        this.domElement.addEventListener('touchstart', (e) => {
            if (!this.enabled || e.touches.length !== 1) return;
            this.onMouseMove(e.touches[0]);
            this.onMouseDown({ button: 0, preventDefault: () => {} });
        }, { passive: true });
        window.addEventListener('touchend', () => this.onMouseUp({ button: 0 }));
    }

    /** NDC tính theo hộp bao của canvas, không theo cửa sổ. */
    updateMouseNDC(event) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    onMouseMove(event) {
        if (!this.enabled || this.isChopping) return;

        this.updateMouseNDC(event);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const targets = [this.chickenMesh.group, this.chickenMesh.loose];
        if (this.sceneManager.board) targets.push(this.sceneManager.board);

        const hits = this.raycaster.intersectObjects(targets, true).filter(h => h.object.visible);
        if (hits.length === 0) {
            this.hoverPoint = null;
            this.surfacePoint = null;
            this.showGuides(false);
            return;
        }

        // Dao bổ XUYÊN QUA miếng thịt, không dừng ở mặt ngoài.
        // Nên điểm ngắm là GIỮA dây cung mà tia nhìn xuyên qua con gà, không phải
        // điểm chạm mặt ngoài — nếu lấy mặt ngoài thì mọi nhát nhìn nghiêng đều bị
        // lệch một khoảng bằng bán kính miếng thịt.
        const flesh = hits.filter(h => h.object.userData.partId);
        this.surfacePoint = hits[0].point.clone();

        if (flesh.length >= 2) {
            this.hoverPoint = flesh[0].point.clone()
                .add(flesh[flesh.length - 1].point).multiplyScalar(0.5);
        } else {
            this.hoverPoint = (flesh[0] || hits[0]).point.clone();
        }

        this.showGuides(true);
    }

    /**
     * Chấm thử nhát dao hiện tại mà không gây tác dụng phụ.
     * Dùng để tô màu đường chỉ dao — người chơi thấy ngay mình đang lệch bao nhiêu
     * TRƯỚC khi bổ, thay vì chỉ biết sau khi đã lỡ tay.
     */
    previewCut() {
        if (!this.hoverPoint) return null;

        this.chickenMesh.group.updateMatrixWorld(true);
        const localPoint = this.chickenMesh.group.worldToLocal(this.hoverPoint.clone());
        const { yaw, pitch } = this.localAngles();

        return this.scoringSystem.evaluateCut(
            localPoint, yaw, pitch, 0.5,
            (partId) => this.chickenMesh.isDetached(partId),
            (jointId) => appState.isJointAvailable(jointId)
        );
    }

    /** Hướng dao quy về hệ toạ độ local của con gà (để nút Lật Gà không phá chấm điểm). */
    localAngles() {
        const worldNormal = ScoringSystem.cutNormal(this.yaw, this.pitch);
        const inv = this.chickenMesh.group.getWorldQuaternion(new THREE.Quaternion()).invert();
        const n = worldNormal.clone().applyQuaternion(inv);
        return {
            yaw: Math.atan2(-n.z, n.x),
            pitch: Math.asin(THREE.MathUtils.clamp(n.y, -1, 1))
        };
    }

    updateGuideColor() {
        const preview = this.previewCut();
        let color = 0xff3b30;                       // đỏ: không trúng khớp nào

        if (preview && preview.jointId) {
            const tol = this.scoringSystem.anatomy.joints[preview.jointId].tolerance;
            if (preview.distanceMm <= tol && preview.angleDiffDeg <= 15) color = 0x4caf50;  // xanh: ngọt khớp
            else if (preview.distanceMm <= 15) color = 0xffc107;                            // vàng: sượt khớp
        }

        this.guideLine.material.color.setHex(color);
        this.cutPlane.material.color.setHex(color);
    }

    showGuides(on) {
        this.knifeGroup.visible = on;
        this.guideLine.visible = on;
        this.cutPlane.visible = on;
    }

    onWheel(event) {
        if (!this.enabled) return;
        event.preventDefault();           // không cho OrbitControls zoom cùng lúc
        this.yaw += event.deltaY * 0.0015;
    }

    onKeyDown(event) {
        if (!this.enabled) return;
        const k = event.key.toLowerCase();
        if (k === 'q') this.pitch = THREE.MathUtils.clamp(this.pitch - 0.08, -MAX_PITCH, MAX_PITCH);
        if (k === 'e') this.pitch = THREE.MathUtils.clamp(this.pitch + 0.08, -MAX_PITCH, MAX_PITCH);
        if (k === 'r') { this.pitch = 0; this.yaw = 0; }
    }

    onMouseDown(event) {
        if (!this.enabled || event.button !== 0) return;
        if (!this.hoverPoint) return;

        this.isChopping = true;
        this.chopStartTime = performance.now();
        this.orbit.enabled = false;       // dừng xoay camera trong lúc lấy đà
    }

    onMouseUp(event) {
        if (!this.isChopping || (event.button !== undefined && event.button !== 0)) return;

        this.isChopping = false;
        this.orbit.enabled = true;

        const holdTime = performance.now() - this.chopStartTime;
        this.evaluateChop(holdTime);
    }

    evaluateChop(holdTime) {
        const force = Math.min(holdTime / 1000, 1.0);
        const feedbackEl = document.getElementById('action-feedback');

        if (!this.scoringSystem || !this.hoverPoint) return;

        // Điểm chạm THẬT trên bề mặt gà, đổi về local space của con gà
        // (nhờ vậy nút "Lật Gà" không còn làm sai toàn bộ toạ độ khớp)
        const worldPoint = this.hoverPoint.clone();
        this.chickenMesh.group.updateMatrixWorld(true);
        const localPoint = this.chickenMesh.group.worldToLocal(worldPoint.clone());

        // Hướng dao cũng phải đổi về local space
        const { yaw, pitch } = this.localAngles();

        const result = this.scoringSystem.evaluateCut(
            localPoint, yaw, pitch, force,
            (partId) => this.chickenMesh.isDetached(partId),
            (jointId) => appState.isJointAvailable(jointId)
        );

        feedbackEl.className = '';
        feedbackEl.innerText = `${result.type} — ${result.message}`;
        feedbackEl.classList.add(result.score > 0 ? 'feedback-good' : 'feedback-bad');

        // CHỈ tách partB (miếng rời ra). partA là thân gà — không được văng đi.
        if (result.success && result.partB) {
            this.chickenMesh.detachPart(result.partB).forEach(id => appState.markPartDetached(id));
        }

        if (result.type === 'Phạm xương') {
            this.chickenMesh.createBoneShards(worldPoint);
            audioSystem.playChop(true);
            this.sceneManager.shake(0.45);
        } else if (result.type !== 'Chém trượt') {
            audioSystem.playChop(false);
            this.sceneManager.shake(0.12);
        }

        appState.addCutResult(result);

        clearTimeout(this._feedbackTimer);
        this._feedbackTimer = setTimeout(() => feedbackEl.classList.add('hidden'), 2600);
    }

    update(now) {
        if (!this.enabled) return;

        this.chickenMesh.updateMarkerPulse(now);

        if (!this.hoverPoint) return;

        const lift = this.isChopping
            ? CHARGE_LIFT * Math.min((performance.now() - this.chopStartTime) / 600, 1)
            : 0;

        // Đặt lại vị trí mỗi frame — không dùng += / -= nên dao không bao giờ trôi
        const p = this.hoverPoint;
        const s = this.surfacePoint || p;
        this.knifeGroup.position.set(p.x, s.y + HOVER_HEIGHT + lift, p.z);

        const q = new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.pitch));

        this.knifeGroup.quaternion.copy(q);
        this.guideLine.position.copy(p);
        this.guideLine.quaternion.copy(q);
        this.cutPlane.position.copy(p);
        this.cutPlane.quaternion.copy(q);
        this.cutPlane.rotateY(Math.PI / 2); // mặt phẳng nằm dọc theo lưỡi dao

        this.updateGuideColor();

        // Rung tay khi giữ quá lâu
        if (this.isChopping && performance.now() - this.chopStartTime > 900) {
            this.knifeGroup.position.x += (Math.random() - 0.5) * 0.12;
            this.knifeGroup.position.z += (Math.random() - 0.5) * 0.12;
        }
    }
}
