import * as THREE from 'three';
import { appState } from './state.js';

export class ScoringSystem {
    constructor(anatomyData) {
        this.anatomy = anatomyData;
    }

    /**
     * Đánh giá nhát chém
     * @param {THREE.Vector3} cutPoint Tọa độ dao chạm thớt/gà
     * @param {number} knifeAngle Góc xoay dao (Radian)
     * @param {number} force Lực băm (0.0 -> 1.0)
     */
    evaluateCut(cutPoint, knifeAngle, force) {
        // Calculate the normal of the cutting plane based on knifeAngle
        // Knife is rotated around Y axis. At angle 0, the blade aligns with Z axis.
        // So the normal to the blade is along the X axis, rotated by knifeAngle.
        const cutNormal = new THREE.Vector3(Math.cos(knifeAngle), 0, -Math.sin(knifeAngle));
        
        // Find the nearest joint
        let nearestJoint = null;
        let minDistance = Infinity;
        
        for (const [jointId, jointData] of Object.entries(this.anatomy.joints)) {
            // Check if parts are already detached
            if (appState.isPartDetached(jointData.partA) && appState.isPartDetached(jointData.partB)) {
                continue; // Joint no longer valid
            }
            
            const jointPos = new THREE.Vector3().fromArray(jointData.position);
            const distance = cutPoint.distanceTo(jointPos);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestJoint = { id: jointId, data: jointData };
            }
        }
        
        if (!nearestJoint) {
            return { type: 'invalid', message: 'Không tìm thấy khớp để cắt!', score: 0 };
        }
        
        // Cố định các mức tính điểm (Tolerance)
        // distance: mm (trong môi trường 3D giả định 1 đơn vị = 10mm, minDistance hiện tại tính theo đơn vị 3D)
        // Nên nhân distance * 10 để ra số mm
        const distanceMm = minDistance * 10;
        
        // Góc lệch
        const targetNormal = new THREE.Vector3().fromArray(nearestJoint.data.normal).normalize();
        let angleDiff = cutNormal.angleTo(targetNormal);
        // Angle diff can be supplementary because plane normal can point either way
        if (angleDiff > Math.PI / 2) {
            angleDiff = Math.PI - angleDiff;
        }
        const angleDiffDeg = THREE.MathUtils.radToDeg(angleDiff);
        
        // Đánh giá
        let resultType = '';
        let message = '';
        let score = 0;
        let success = false;
        
        if (force < 0.2) {
            resultType = 'Nhát non';
            message = 'Lực quá yếu, dao bị kẹt!';
            score = -10;
        } else if (force > 0.9) {
            resultType = 'Nhát tham';
            message = 'Lực quá mạnh, nát da gà!';
            score = -10;
            success = true;
        } else if (distanceMm > 15) {
            resultType = 'Phạm xương';
            message = `Chém trượt khớp hoàn toàn! Lệch ${distanceMm.toFixed(1)}mm`;
            score = -30;
        } else if (distanceMm > nearestJoint.data.tolerance) {
            resultType = 'Sượt khớp';
            message = `Chém sát khớp nhưng bị sứt. Lệch ${distanceMm.toFixed(1)}mm`;
            score = 10;
            success = true;
        } else if (angleDiffDeg > 15) {
            resultType = 'Sượt khớp';
            message = `Đúng vị trí nhưng sai góc dao! Lệch ${angleDiffDeg.toFixed(1)}°`;
            score = 20;
            success = true;
        } else {
            resultType = 'Ngọt khớp';
            message = 'Tuyệt vời! Chém chính xác vào sụn khớp.';
            score = 50;
            success = true;
        }
        
        const result = {
            type: resultType,
            message: message,
            score: score,
            distanceMm: distanceMm,
            angleDiffDeg: angleDiffDeg,
            force: force,
            jointId: nearestJoint.id,
            partA: nearestJoint.data.partA,
            partB: nearestJoint.data.partB,
            success: success
        };
        
        return result;
    }
}
