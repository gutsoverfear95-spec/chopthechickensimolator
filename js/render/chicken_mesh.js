import * as THREE from 'three';

/**
 * Con gà được dựng HOÀN TOÀN từ js/anatomy/chicken-anatomy.json.
 * Không hard-code toạ độ ở đây — nếu cần chỉnh hình, chỉnh trong JSON.
 *
 * Hai hệ toạ độ:
 *  - `group`  : con gà còn nguyên. Có thể bị lật (rotation.z = PI). Mọi toạ độ
 *               khớp trong JSON là LOCAL trong group này.
 *  - `loose`  : các miếng đã cắt rời. Luôn ở identity transform (= world space),
 *               nên DragControls ở M3 hoạt động đúng.
 */
export class ChickenMesh {
    constructor(anatomyData) {
        this.anatomy = anatomyData;

        this.group = new THREE.Group();      // phần còn dính liền
        this.loose = new THREE.Group();      // các miếng đã rời ra
        this.isFlipped = false;
        this.boneShards = [];

        this.skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.35,
            metalness: 0.05
        });

        this.meatMaterial = new THREE.MeshStandardMaterial({
            color: 0xddcbb5,
            roughness: 0.8,
            metalness: 0
        });

        this.parts = {};
        this.buildFromAnatomy();
        this.createJointMarker();
    }

    buildGeometry(spec) {
        const a = spec.args;
        switch (spec.geo) {
            case 'capsule':  return new THREE.CapsuleGeometry(a[0], a[1], 12, 24);
            case 'sphere':   return new THREE.SphereGeometry(a[0], 24, 16);
            case 'cylinder': return new THREE.CylinderGeometry(a[0], a[1], a[2], 20);
            case 'box':      return new THREE.BoxGeometry(a[0], a[1], a[2]);
            default:
                console.warn('Không hiểu loại hình học:', spec.geo);
                return new THREE.SphereGeometry(1, 8, 8);
        }
    }

    buildFromAnatomy() {
        for (const [partId, partData] of Object.entries(this.anatomy.parts)) {
            const spec = partData.mesh;
            if (!spec) {
                console.warn(`Part "${partId}" không có định nghĩa mesh trong anatomy JSON`);
                continue;
            }

            const mesh = new THREE.Mesh(this.buildGeometry(spec), this.skinMaterial.clone());
            mesh.position.fromArray(spec.pos);
            mesh.rotation.fromArray(spec.rot);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = 'chicken_part';
            mesh.userData.partId = partId;
            mesh.userData.label = partData.label || partId;

            this.group.add(mesh);
            this.parts[partId] = mesh;
        }
    }

    /** Vòng tròn đánh dấu khớp mục tiêu ở chế độ hướng dẫn. */
    createJointMarker() {
        const geo = new THREE.TorusGeometry(0.8, 0.09, 8, 32);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x4caf50, transparent: true, opacity: 0.9, depthTest: false
        });
        this.jointMarker = new THREE.Mesh(geo, mat);
        this.jointMarker.renderOrder = 999;
        this.jointMarker.visible = false;
        this.group.add(this.jointMarker); // con của group => lật theo con gà
    }

    /** @param {string|null} jointId  null = ẩn marker */
    highlightJoint(jointId) {
        const joint = jointId && this.anatomy.joints[jointId];
        if (!joint) { this.jointMarker.visible = false; return; }

        this.jointMarker.visible = true;
        this.jointMarker.position.fromArray(joint.position);
        // Xoay vòng tròn cho vuông góc với pháp tuyến lý tưởng của khớp
        const n = new THREE.Vector3().fromArray(joint.normal).normalize();
        this.jointMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    }

    updateMarkerPulse(t) {
        if (!this.jointMarker.visible) return;
        const s = 1 + Math.sin(t * 0.005) * 0.12;
        this.jointMarker.scale.set(s, s, 1);
    }

    flip() {
        this.isFlipped = !this.isFlipped;
        this.group.rotation.z = this.isFlipped ? Math.PI : 0;
        this.group.position.y = this.isFlipped ? 9 : 0;
        this.group.updateMatrixWorld(true);
    }

    /**
     * Tách một miếng ra khỏi con gà.
     * Dùng loose.attach() — Three.js giữ nguyên transform WORLD của miếng,
     * nên miếng không nhảy chỗ và không còn bị ảnh hưởng bởi phép lật gà.
     */
    detachPart(partId) {
        const part = this.parts[partId];
        if (!part || part.parent === this.loose) return [];

        const detached = [];
        this.group.updateMatrixWorld(true);
        this.loose.attach(part);
        detached.push(partId);

        // Rơi xuống mặt thớt, xoay một chút cho tự nhiên
        const r = () => (Math.random() - 0.5);
        part.position.y = 0.9 + Math.random() * 0.3;
        part.position.x += r() * 2.0;
        part.position.z += r() * 2.0;
        part.rotation.z += r() * 0.8;
        part.rotation.x += r() * 0.8;

        // Các miếng đi kèm (ví dụ: cắt cổ thì đầu rời theo)
        const alsoDetach = this.anatomy.parts[partId]?.detachWith || [];
        for (const otherId of alsoDetach) {
            detached.push(...this.detachPart(otherId));
        }

        return detached;
    }

    isDetached(partId) {
        return this.parts[partId]?.parent === this.loose;
    }

    getLooseParts() {
        return Object.entries(this.parts)
            .filter(([id]) => this.isDetached(id))
            .map(([, mesh]) => mesh);
    }

    /** @param {THREE.Vector3} worldPosition */
    createBoneShards(worldPosition) {
        const shardGeo = new THREE.TetrahedronGeometry(0.18);
        const shardMat = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.7 });

        for (let i = 0; i < 5; i++) {
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.copy(worldPosition);
            shard.position.x += (Math.random() - 0.5) * 1.5;
            shard.position.y = 0.2 + Math.random() * 0.2;
            shard.position.z += (Math.random() - 0.5) * 1.5;
            shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            shard.castShadow = true;

            this.loose.add(shard);   // vụn xương nằm trên thớt, không lật theo gà
            this.boneShards.push(shard);
        }
    }
}
