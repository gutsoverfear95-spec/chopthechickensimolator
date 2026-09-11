import * as THREE from 'three';
import { makeSkinTextures, makeMeatTexture, deform, taper } from './materials.js';

/**
 * Con gà được dựng HOÀN TOÀN từ js/anatomy/chicken-anatomy.json.
 * Không hard-code toạ độ ở đây — cần chỉnh hình thì chỉnh trong JSON.
 *
 * Hai hệ toạ độ:
 *  - `group` : con gà còn nguyên. Có thể bị lật (rotation.z = PI). Mọi toạ độ
 *              khớp trong JSON là LOCAL trong group này.
 *  - `loose` : các miếng đã cắt rời. Luôn ở identity transform (= world space),
 *              nên DragControls ở M3 hoạt động đúng.
 */
export class ChickenMesh {
    constructor(anatomyData) {
        this.anatomy = anatomyData;

        this.group = new THREE.Group();
        this.loose = new THREE.Group();
        this.isFlipped = false;
        this.boneShards = [];

        const skin = makeSkinTextures();
        this.skinMap = skin.map;
        this.skinBump = skin.bumpMap;
        this.meatMap = makeMeatTexture();

        this.parts = {};
        this.buildFromAnatomy();
        this.createJointMarker();
    }

    /**
     * Da gà luộc để nguội: hơi bóng mỡ chứ không bóng như nhựa.
     *  - clearcoat mỏng  = lớp mỡ đọng trên mặt da
     *  - sheen           = ánh mềm ở rìa, thứ làm da khác hẳn plastic
     *  - bumpMap         = lỗ chân lông và nếp nhăn
     *  - roughness cao   = highlight tán rộng, không thành đốm trắng cứng
     */
    makeSkinMaterial(tint) {
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(tint || '#ddab52'),
            map: this.skinMap,
            bumpMap: this.skinBump,
            bumpScale: 0.16,
            roughness: 0.56,
            metalness: 0,
            clearcoat: 0.35,
            clearcoatRoughness: 0.55,
            sheen: 0.55,
            sheenRoughness: 0.75,
            sheenColor: new THREE.Color('#ffcf8a'),
            envMapIntensity: 0.75
        });
    }

    makeMeatMaterial() {
        return new THREE.MeshPhysicalMaterial({
            color: 0xf2e2d2,
            map: this.meatMap,
            roughness: 0.78,
            metalness: 0,
            clearcoat: 0.18,
            clearcoatRoughness: 0.7,
            envMapIntensity: 0.5
        });
    }

    buildGeometry(spec, seed) {
        const a = spec.args;
        let geo;

        switch (spec.geo) {
            case 'capsule':  geo = new THREE.CapsuleGeometry(a[0], a[1], 14, 36); break;
            case 'sphere':   geo = new THREE.SphereGeometry(a[0], 44, 30); break;
            case 'cylinder': geo = new THREE.CylinderGeometry(a[0], a[1], a[2], 24, 4); break;
            case 'cone':     geo = new THREE.ConeGeometry(a[0], a[1], 26, 3); break;
            default:
                console.warn('Không hiểu loại hình học:', spec.geo);
                geo = new THREE.SphereGeometry(1, 16, 12);
        }

        // taper: [trục, tỉ lệ ở đầu nhỏ, tỉ lệ ở đầu lớn] — thân gà thon dần về phía đuôi
        if (spec.taper) taper(geo, spec.taper[0], spec.taper[1], spec.taper[2]);
        if (spec.scale) geo.scale(spec.scale[0], spec.scale[1], spec.scale[2]);
        if (spec.noise) deform(geo, spec.noise, 3.1, seed);

        return geo;
    }

    buildFromAnatomy() {
        let seed = 0;

        for (const [partId, partData] of Object.entries(this.anatomy.parts)) {
            const spec = partData.mesh;
            if (!spec) {
                console.warn(`Part "${partId}" không có định nghĩa mesh trong anatomy JSON`);
                continue;
            }

            const mesh = new THREE.Mesh(
                this.buildGeometry(spec, seed++ * 7.3),
                this.makeSkinMaterial(spec.tint)
            );
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

    /** Vòng tròn đánh dấu khớp mục tiêu, kèm vạch chỉ hướng lưỡi dao đúng. */
    createJointMarker() {
        this.jointMarker = new THREE.Group();

        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.85, 0.07, 8, 40),
            new THREE.MeshBasicMaterial({ color: 0x5ddb6a, transparent: true, opacity: 0.95, depthTest: false })
        );
        ring.renderOrder = 999;
        this.jointMarker.add(ring);

        // Vạch nằm TRONG mặt phẳng cắt lý tưởng — người chơi kéo dao dọc theo vạch này
        const bar = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 3.4, 0.05),
            new THREE.MeshBasicMaterial({ color: 0x5ddb6a, transparent: true, opacity: 0.5, depthTest: false })
        );
        bar.renderOrder = 999;
        this.jointMarker.add(bar);

        this.jointMarker.visible = false;
        this.group.add(this.jointMarker); // con của group => lật theo con gà
    }

    /** @param {string|null} jointId  null = ẩn marker */
    highlightJoint(jointId) {
        const joint = jointId && this.anatomy.joints[jointId];
        if (!joint) { this.jointMarker.visible = false; return; }

        this.jointMarker.visible = true;
        this.jointMarker.position.fromArray(joint.position);

        const n = new THREE.Vector3().fromArray(joint.normal).normalize();
        this.jointMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    }

    updateMarkerPulse(t) {
        if (!this.jointMarker.visible) return;
        const s = 1 + Math.sin(t * 0.005) * 0.1;
        this.jointMarker.scale.set(s, s, 1);
    }

    flip() {
        this.isFlipped = !this.isFlipped;
        this.group.rotation.z = this.isFlipped ? Math.PI : 0;
        this.group.position.y = this.isFlipped ? 9 : 0;
        this.group.updateMatrixWorld(true);
    }

    /**
     * Dán mặt cắt lộ thịt và lõi xương lên cả hai bên vết chặt.
     * Không có nó thì miếng gà rời ra trông như một viên kẹo nhẵn thín.
     */
    addCutFaces(jointId) {
        const joint = this.anatomy.joints[jointId];
        if (!joint) return;

        const r = joint.capRadius || 0.7;
        const jointLocal = new THREE.Vector3().fromArray(joint.position);
        const normal = new THREE.Vector3().fromArray(joint.normal).normalize();

        for (const [partId, sign] of [[joint.partA, -1], [joint.partB, 1]]) {
            const part = this.parts[partId];
            if (!part) continue;

            const face = new THREE.Group();

            const meat = new THREE.Mesh(new THREE.CircleGeometry(r, 28), this.makeMeatMaterial());
            face.add(meat);

            if (this.anatomy.parts[partId]?.bone) {
                const bone = new THREE.Mesh(
                    new THREE.CircleGeometry(r * 0.32, 20),
                    new THREE.MeshPhysicalMaterial({
                        color: 0xf6efe2, roughness: 0.45, metalness: 0,
                        clearcoat: 0.3, envMapIntensity: 0.6
                    })
                );
                bone.position.z = 0.004;
                face.add(bone);
            }

            // Đặt vào đúng vị trí khớp, trong hệ toạ độ của miếng thịt
            part.updateMatrixWorld(true);
            this.group.updateMatrixWorld(true);

            const worldPos = this.group.localToWorld(
                jointLocal.clone().add(normal.clone().multiplyScalar(sign * 0.02))
            );
            face.position.copy(part.worldToLocal(worldPos));

            const q = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                normal.clone().multiplyScalar(sign)
            );
            face.quaternion.copy(part.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));

            part.add(face);
        }
    }

    /**
     * Tách một miếng ra khỏi con gà.
     * Dùng loose.attach() — Three.js giữ nguyên transform WORLD của miếng, nên
     * miếng không nhảy chỗ và không còn bị ảnh hưởng bởi phép lật gà.
     */
    detachPart(partId) {
        const part = this.parts[partId];
        if (!part || part.parent === this.loose) return [];

        const detached = [];
        this.group.updateMatrixWorld(true);
        this.loose.attach(part);
        detached.push(partId);

        const r = () => (Math.random() - 0.5);
        part.position.y = 0.9 + Math.random() * 0.3;
        part.position.x += r() * 2.0;
        part.position.z += r() * 2.0;
        part.rotation.z += r() * 0.8;
        part.rotation.x += r() * 0.8;

        // Các miếng đi kèm (cắt cổ thì đầu rời theo, cắt đùi thì đùi tỏi theo)
        for (const otherId of this.anatomy.parts[partId]?.detachWith || []) {
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
        const shardGeo = new THREE.TetrahedronGeometry(0.16);
        const shardMat = new THREE.MeshPhysicalMaterial({
            color: 0xf3ece0, roughness: 0.5, metalness: 0, envMapIntensity: 0.6
        });

        for (let i = 0; i < 5; i++) {
            const shard = new THREE.Mesh(shardGeo, shardMat);
            shard.position.copy(worldPosition);
            shard.position.x += (Math.random() - 0.5) * 1.5;
            shard.position.y = 0.15 + Math.random() * 0.2;
            shard.position.z += (Math.random() - 0.5) * 1.5;
            shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            shard.castShadow = true;

            this.loose.add(shard);   // vụn xương nằm trên thớt, không lật theo gà
            this.boneShards.push(shard);
        }
    }
}
