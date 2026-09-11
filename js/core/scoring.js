import * as THREE from 'three';

/**
 * Chấm điểm nhát dao.
 *
 * Nguyên tắc: một nhát dao không phải là một ĐIỂM, nó là một MẶT PHẲNG.
 * Cái quan trọng là khớp nằm cách mặt phẳng cắt bao xa (khoảng cách vuông góc),
 * chứ không phải cách điểm chạm dao bao xa. Nhờ vậy việc dao chạm vào mặt ngoài
 * của miếng thịt (thay vì tâm khớp) không hề bị tính là sai số — đúng như thật.
 */
export class ScoringSystem {
    constructor(anatomyData) {
        this.anatomy = anatomyData;
        this.unitMm = anatomyData.unitMm || 10;
        this.searchRadius = anatomyData.searchRadius || 3.5;
    }

    /**
     * Pháp tuyến của mặt phẳng cắt.
     * Lưỡi dao dài theo trục Z local. yaw xoay quanh Y, pitch nghiêng lưỡi
     * quanh chính trục lưỡi dao (tức là làm dao không còn vuông góc thớt).
     */
    static cutNormal(yaw, pitch) {
        return new THREE.Vector3(
            Math.cos(yaw) * Math.cos(pitch),
            Math.sin(pitch),
            -Math.sin(yaw) * Math.cos(pitch)
        ).normalize();
    }

    /**
     * @param {THREE.Vector3} cutPoint  Điểm dao chạm gà, trong LOCAL space của chickenMesh.group
     * @param {number} yaw    Góc xoay dao quanh trục đứng (radian)
     * @param {number} pitch  Góc nghiêng lưỡi dao so với phương thẳng đứng (radian)
     * @param {number} force  Lực băm 0..1
     * @param {(partId:string)=>boolean} isDetached
     * @param {(jointId:string)=>boolean} isAvailable  Khớp đã mở khoá theo trình tự chưa
     */
    evaluateCut(cutPoint, yaw, pitch, force, isDetached, isAvailable = () => true) {
        const cutNormal = ScoringSystem.cutNormal(yaw, pitch);

        let nearest = null;
        let bestRank = Infinity;

        for (const [jointId, joint] of Object.entries(this.anatomy.joints)) {
            // Khớp đã bị cắt rời thì không còn để cắt nữa
            if (isDetached(joint.partB)) continue;
            // Chưa tới lượt trong trình tự pha lóc thì cũng chưa được cắt
            if (!isAvailable(jointId)) continue;

            const jointPos = new THREE.Vector3().fromArray(joint.position);
            const pointDist = cutPoint.distanceTo(jointPos);

            // Mặt phẳng là vô hạn — phải có rào: dao phải ở gần khớp mới tính
            if (pointDist > this.searchRadius) continue;

            // Khoảng cách vuông góc từ khớp tới mặt phẳng cắt
            const planeDist = Math.abs(jointPos.clone().sub(cutPoint).dot(cutNormal));

            // Ưu tiên mặt phẳng gần, nhưng dùng khoảng cách điểm để phá thế hoà
            const rank = planeDist + pointDist * 0.25;

            if (rank < bestRank) {
                bestRank = rank;
                nearest = { id: jointId, data: joint, planeDist, pointDist };
            }
        }

        if (!nearest) {
            return {
                type: 'Chém trượt', success: false, score: -15,
                message: 'Chỗ này không có khớp nào. Rê dao tìm khe khớp trước đã!',
                distanceMm: null, angleDiffDeg: null, force,
                jointId: null, partA: null, partB: null,
                position: cutPoint.toArray()
            };
        }

        const distanceMm = nearest.planeDist * this.unitMm;

        // Góc lệch giữa mặt phẳng cắt và mặt phẳng lý tưởng của khớp
        const targetNormal = new THREE.Vector3().fromArray(nearest.data.normal).normalize();
        let angleDiff = cutNormal.angleTo(targetNormal);
        if (angleDiff > Math.PI / 2) angleDiff = Math.PI - angleDiff; // pháp tuyến quay hướng nào cũng được
        const angleDiffDeg = THREE.MathUtils.radToDeg(angleDiff);

        let type, message, score, success = false;

        if (force < 0.2) {
            type = 'Nhát non';
            message = 'Lực quá yếu, dao mắc kẹt trong thịt. Phải dứt khoát!';
            score = -10;
        } else if (force > 0.9) {
            type = 'Nhát tham';
            message = 'Lực quá mạnh, miếng bắn ra và nát da gà.';
            score = -10;
            success = true;
        } else if (distanceMm > 15) {
            type = 'Phạm xương';
            message = `Chém thẳng vào thân xương, sinh vụn xương dăm! Lệch ${distanceMm.toFixed(1)}mm`;
            score = -30;
        } else if (distanceMm > nearest.data.tolerance) {
            type = 'Sượt khớp';
            message = `Sát khớp nhưng còn sót thịt trên xương. Lệch ${distanceMm.toFixed(1)}mm`;
            score = 10;
            success = true;
        } else if (angleDiffDeg > 15) {
            type = 'Sượt khớp';
            message = `Đúng vị trí nhưng dao không vuông góc thớt! Nghiêng ${angleDiffDeg.toFixed(1)}°`;
            score = 20;
            success = true;
        } else {
            type = 'Ngọt khớp';
            message = 'Tuyệt vời! Ngọt lịm vào đúng sụn khớp.';
            score = 50;
            success = true;
        }

        return {
            type, message, score, success,
            distanceMm,
            angleDiffDeg,
            force,
            jointId: nearest.id,
            jointLabel: nearest.data.label || nearest.id,
            partA: nearest.data.partA,
            partB: nearest.data.partB,
            position: cutPoint.toArray()
        };
    }
}
