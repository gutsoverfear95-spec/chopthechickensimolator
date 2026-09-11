import * as THREE from 'three';
import { appState } from '../core/state.js';
import { audioSystem } from '../core/audio.js';
import { ScoringSystem } from '../core/scoring.js';

const MAX_PITCH = THREE.MathUtils.degToRad(70);
const HOVER_HEIGHT = 1.2;
const MIN_DRAG_PX = 18;     // ngắn hơn thì chưa đủ để đọc ra hướng
const FULL_FORCE_PX = 185;  // kéo hết cỡ

/**
 * Thao tác chặt: KÉO VẼ ĐƯỜNG CHẶT.
 *
 * Bấm giữ trên thân gà để chốt vị trí, kéo một đường thẳng — hướng kéo là hướng
 * lưỡi dao, độ dài đường kéo là lực bổ — rồi thả tay. Một cử chỉ đặt xong cả ba
 * thông số, thay cho việc vừa rê chuột vừa lăn chuột vừa canh thời gian giữ như
 * trước. Đây cũng là cách người ta nghĩ về một nhát dao: một đường trên miếng thịt.
 */
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
        this.pointer = new THREE.Vector2();

        this.enabled = false;
        this.drawing = false;
        this.anchor = null;         // điểm ngắm đã chốt (world)
        this.anchorSurface = null;
        this.anchorScreen = null;
        this.dragPx = 0;
        this.hoverPoint = null;
        this.surfacePoint = null;

        this.yaw = 0;
        this.pitch = 0;

        this.createKnife();
        this.createGuides();
        this.createGauge();
        this.setupEvents();
    }

    setEnabled(on) {
        this.enabled = on;
        this.orbit.enabled = true;

        if (on) {
            // Chuột trái thuộc về con dao. Camera xoay bằng chuột phải.
            this.orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
        } else {
            this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
            this.cancelDraw();
            this.hoverPoint = null;
            this.showGuides(false);
            this.aimMarker.visible = false;
        }
    }

    /* ---------------------------------------------------------------- *
     *  Dựng hình
     * ---------------------------------------------------------------- */

    createKnife() {
        this.knifeGroup = new THREE.Group();

        const steel = new THREE.MeshPhysicalMaterial({
            color: 0xd9dee3, metalness: 0.92, roughness: 0.22, envMapIntensity: 1.4
        });

        // Dao phay Việt Nam: bản to hình chữ nhật, sống dày, lưỡi mỏng
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.6, 5.4), steel);
        blade.position.set(0, 1.45, 0);
        blade.castShadow = true;
        this.knifeGroup.add(blade);

        const spine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 5.4), steel);
        spine.position.set(0, 2.72, 0);
        this.knifeGroup.add(spine);

        const bolster = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.5), steel);
        bolster.position.set(0, 2.0, -2.85);
        this.knifeGroup.add(bolster);

        const handle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.26, 0.3, 3.2, 18),
            new THREE.MeshPhysicalMaterial({
                color: 0x4a2b18, roughness: 0.65, metalness: 0,
                clearcoat: 0.35, clearcoatRoughness: 0.5, envMapIntensity: 0.7
            })
        );
        handle.rotation.x = Math.PI / 2;
        handle.position.set(0, 2.35, -4.6);
        handle.castShadow = true;
        this.knifeGroup.add(handle);

        this.scene.add(this.knifeGroup);
        this.knifeGroup.visible = false;
    }

    createGuides() {
        // Đốm ngắm khi chưa kéo — gọn, không che con gà
        this.aimMarker = new THREE.Mesh(
            new THREE.RingGeometry(0.26, 0.36, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthTest: false })
        );
        this.aimMarker.renderOrder = 997;
        this.aimMarker.visible = false;
        this.scene.add(this.aimMarker);

        this.guideLine = new THREE.Mesh(
            new THREE.BoxGeometry(0.07, 0.07, 7.5),
            new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9, depthTest: false })
        );
        this.guideLine.renderOrder = 998;
        this.guideLine.visible = false;
        this.scene.add(this.guideLine);

        this.cutPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(7, 5.5),
            new THREE.MeshBasicMaterial({
                color: 0xff3b30, transparent: true, opacity: 0.13,
                side: THREE.DoubleSide, depthWrite: false
            })
        );
        this.cutPlane.visible = false;
        this.scene.add(this.cutPlane);
    }

    createGauge() {
        if (document.getElementById('force-gauge')) {
            this.gauge = document.getElementById('force-gauge');
            this.gaugeFill = document.getElementById('force-fill');
            this.gaugeLabel = document.getElementById('force-label');
            return;
        }

        const el = document.createElement('div');
        el.id = 'force-gauge';
        el.className = 'hidden';
        el.innerHTML = `
            <div class="gauge-track">
                <div class="gauge-zone"></div>
                <div class="gauge-fill" id="force-fill"></div>
            </div>
            <div class="gauge-label" id="force-label">Kéo dài hơn</div>
        `;
        document.getElementById('hud').appendChild(el);

        this.gauge = el;
        this.gaugeFill = document.getElementById('force-fill');
        this.gaugeLabel = document.getElementById('force-label');
    }

    /* ---------------------------------------------------------------- *
     *  Sự kiện
     * ---------------------------------------------------------------- */

    setupEvents() {
        this.domElement.addEventListener('pointerdown', this.onPointerDown.bind(this));
        this.domElement.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('pointerup', this.onPointerUp.bind(this));
        window.addEventListener('pointercancel', () => this.cancelDraw());
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        this.domElement.addEventListener('contextmenu', (e) => { if (this.enabled) e.preventDefault(); });
    }

    screenPos(event) {
        const rect = this.domElement.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top, rect };
    }

    /** Bắn tia từ con trỏ, trả về điểm ngắm (giữa dây cung) và điểm chạm mặt ngoài. */
    pick(event) {
        const { x, y, rect } = this.screenPos(event);
        this.pointer.set((x / rect.width) * 2 - 1, -(y / rect.height) * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);

        const targets = [this.chickenMesh.group];
        if (this.sceneManager.board) targets.push(this.sceneManager.board);

        const hits = this.raycaster.intersectObjects(targets, true).filter(h => h.object.visible);
        if (hits.length === 0) return null;

        // Dao bổ XUYÊN QUA miếng thịt chứ không dừng ở mặt ngoài, nên điểm ngắm là
        // giữa dây cung tia nhìn xuyên qua con gà. Lấy mặt ngoài thì mọi nhát nhìn
        // nghiêng đều lệch một khoảng đúng bằng bán kính miếng thịt.
        const flesh = hits.filter(h => h.object.userData.partId);

        const aim = flesh.length >= 2
            ? flesh[0].point.clone().add(flesh[flesh.length - 1].point).multiplyScalar(0.5)
            : (flesh[0] || hits[0]).point.clone();

        return { aim, surface: hits[0].point.clone() };
    }

    onPointerMove(event) {
        if (!this.enabled) return;

        if (!this.drawing) {
            const hit = this.pick(event);
            if (hit) {
                this.hoverPoint = hit.aim;
                this.surfacePoint = hit.surface;
                this.aimMarker.visible = true;
                this.aimMarker.position.copy(hit.surface);
                this.aimMarker.quaternion.copy(this.camera.quaternion);
            } else {
                this.hoverPoint = null;
                this.aimMarker.visible = false;
            }
            return;
        }

        // Đang kéo: vị trí đã chốt, chỉ cập nhật hướng và lực
        const { x, y } = this.screenPos(event);
        const dx = x - this.anchorScreen.x;
        const dy = y - this.anchorScreen.y;
        this.dragPx = Math.hypot(dx, dy);

        if (this.dragPx >= MIN_DRAG_PX) {
            this.yaw = this.screenDragToYaw(dx, dy);
        }

        this.updateGauge();
    }

    /**
     * Đổi hướng kéo trên màn hình thành hướng lưỡi dao trong không gian.
     * Lưỡi dao luôn nằm ngang (dao bổ thẳng xuống), nên chiếu hướng kéo lên mặt
     * phẳng ngang theo trục phải và trục tới của camera.
     */
    screenDragToYaw(dx, dy) {
        const right = new THREE.Vector3();
        const view = new THREE.Vector3();

        this.camera.getWorldDirection(view);
        right.crossVectors(view, new THREE.Vector3(0, 1, 0)).normalize();

        const forward = view.clone().setY(0).normalize();

        // Camera nhìn chúc xuống thì trục tới bị CO LẠI trên màn hình: đi 1 đơn vị
        // về phía trước chỉ dịch sin(góc chúc) pixel theo chiều dọc. Không bù lại
        // hệ số này thì hướng lưỡi dao luôn lệch một góc cố định — nhìn thì thẳng
        // mà chấm điểm vẫn báo sai góc.
        const sinElev = Math.max(Math.abs(view.y), 0.15);

        // Kéo lên trên màn hình = đi ra xa camera
        const dir = right.multiplyScalar(dx).add(forward.multiplyScalar(-dy / sinElev));
        if (dir.lengthSq() < 1e-6) return this.yaw;
        dir.normalize();

        // Trục dài của lưỡi dao ở yaw θ là (sin θ, 0, cos θ)
        return Math.atan2(dir.x, dir.z);
    }

    onPointerDown(event) {
        if (!this.enabled || event.button !== 0) return;

        const hit = this.pick(event);
        if (!hit) return;

        event.preventDefault();
        this.domElement.setPointerCapture?.(event.pointerId);

        const { x, y } = this.screenPos(event);
        this.drawing = true;
        this.anchor = hit.aim;
        this.anchorSurface = hit.surface;
        this.anchorScreen = { x, y };
        this.dragPx = 0;

        this.orbit.enabled = false;
        this.aimMarker.visible = false;
        this.showGuides(true);
        this.gauge.classList.remove('hidden');
        this.updateGauge();
    }

    onPointerUp(event) {
        if (!this.drawing) return;
        if (event.button !== undefined && event.button !== 0) return;

        const drag = this.dragPx;
        const anchor = this.anchor;
        this.cancelDraw();

        if (drag < MIN_DRAG_PX) {
            this.flash('Chưa thành nhát dao — bấm giữ rồi KÉO một đường theo hướng lưỡi dao.');
            return;
        }

        this.evaluateChop(anchor, Math.min(drag / FULL_FORCE_PX, 1));
    }

    cancelDraw() {
        this.drawing = false;
        this.anchor = null;
        this.anchorScreen = null;
        this.dragPx = 0;
        this.orbit.enabled = true;
        this.showGuides(false);
        this.gauge?.classList.add('hidden');
    }

    onKeyDown(event) {
        if (!this.enabled) return;
        const k = event.key.toLowerCase();
        if (k === 'q') this.pitch = THREE.MathUtils.clamp(this.pitch - 0.07, -MAX_PITCH, MAX_PITCH);
        if (k === 'e') this.pitch = THREE.MathUtils.clamp(this.pitch + 0.07, -MAX_PITCH, MAX_PITCH);
        if (k === 'r') this.pitch = 0;
    }

    /* ---------------------------------------------------------------- *
     *  Chấm điểm
     * ---------------------------------------------------------------- */

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

    /** Chấm thử nhát dao hiện tại mà không gây tác dụng phụ (dùng để tô màu guide). */
    previewCut(point = null) {
        const p = point || this.anchor || this.hoverPoint;
        if (!p) return null;

        this.chickenMesh.group.updateMatrixWorld(true);
        const local = this.chickenMesh.group.worldToLocal(p.clone());
        const { yaw, pitch } = this.localAngles();

        return this.scoringSystem.evaluateCut(
            local, yaw, pitch, 0.5,
            (partId) => this.chickenMesh.isDetached(partId),
            (jointId) => appState.isJointAvailable(jointId)
        );
    }

    evaluateChop(anchor, force) {
        this.chickenMesh.group.updateMatrixWorld(true);
        const local = this.chickenMesh.group.worldToLocal(anchor.clone());
        const { yaw, pitch } = this.localAngles();

        const result = this.scoringSystem.evaluateCut(
            local, yaw, pitch, force,
            (partId) => this.chickenMesh.isDetached(partId),
            (jointId) => appState.isJointAvailable(jointId)
        );

        this.flash(`${result.type} — ${result.message}`, result.score > 0);

        if (result.success && result.partB) {
            this.chickenMesh.addCutFaces(result.jointId);
            this.chickenMesh.detachPart(result.partB).forEach(id => appState.markPartDetached(id));
        }

        if (result.type === 'Phạm xương') {
            this.chickenMesh.createBoneShards(anchor);
            audioSystem.playChop(true);
            this.sceneManager.shake(0.45);
        } else if (result.type !== 'Chém trượt') {
            audioSystem.playChop(false);
            this.sceneManager.shake(0.12);
        }

        appState.addCutResult(result);
    }

    flash(text, good = false) {
        const el = document.getElementById('action-feedback');
        if (!el) return;
        el.className = good ? 'feedback-good' : 'feedback-bad';
        el.innerText = text;
        clearTimeout(this._feedbackTimer);
        this._feedbackTimer = setTimeout(() => el.classList.add('hidden'), 2600);
    }

    /* ---------------------------------------------------------------- *
     *  Hiển thị
     * ---------------------------------------------------------------- */

    showGuides(on) {
        this.knifeGroup.visible = on;
        this.guideLine.visible = on;
        this.cutPlane.visible = on;
    }

    updateGauge() {
        const pct = Math.min(this.dragPx / FULL_FORCE_PX, 1);
        this.gaugeFill.style.width = (pct * 100) + '%';

        let label, cls;
        if (this.dragPx < MIN_DRAG_PX)  { label = 'Kéo theo hướng lưỡi dao';  cls = 'weak'; }
        else if (pct < 0.2)             { label = 'Lực còn non — kéo dài thêm'; cls = 'weak'; }
        else if (pct > 0.9)             { label = 'Quá tham — nhả bớt';         cls = 'over'; }
        else if (pct < 0.35 || pct > 0.8) { label = 'Được, nhưng chưa đều tay'; cls = 'ok'; }
        else                            { label = 'Lực vừa tay';                cls = 'good'; }

        this.gaugeLabel.innerText = label;
        this.gaugeFill.className = 'gauge-fill ' + cls;
    }

    updateGuideColor() {
        const preview = this.previewCut();
        let color = 0xff3b30;

        if (preview && preview.jointId) {
            const tol = this.scoringSystem.anatomy.joints[preview.jointId].tolerance;
            if (preview.distanceMm <= tol && preview.angleDiffDeg <= 15) color = 0x4caf50;
            else if (preview.distanceMm <= 15) color = 0xffc107;
        }

        this.guideLine.material.color.setHex(color);
        this.cutPlane.material.color.setHex(color);
    }

    update(now) {
        if (!this.enabled) return;

        this.chickenMesh.updateMarkerPulse(now);
        if (!this.drawing || !this.anchor) return;

        const p = this.anchor;
        const s = this.anchorSurface || p;
        const lift = 1 + Math.min(this.dragPx / FULL_FORCE_PX, 1) * 3.2;

        this.knifeGroup.position.set(p.x, s.y + HOVER_HEIGHT + lift, p.z);

        const q = new THREE.Quaternion()
            .setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
            .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.pitch));

        this.knifeGroup.quaternion.copy(q);
        this.guideLine.position.copy(p);
        this.guideLine.quaternion.copy(q);
        this.cutPlane.position.copy(p);
        this.cutPlane.quaternion.copy(q);
        this.cutPlane.rotateY(Math.PI / 2);

        this.updateGuideColor();
    }
}
