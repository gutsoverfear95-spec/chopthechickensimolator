import { appState } from '../core/state.js';

// Vùng toạ độ local của con gà, dùng để chiếu sơ đồ nhìn từ trên xuống
const VIEW = { xMin: -4.2, xMax: 4.2, zMin: -3.8, zMax: 5.2 };

export class UIAnalysis {
    constructor(anatomyData) {
        this.anatomy = anatomyData;
        this.setupModal();
    }

    setupModal() {
        if (document.getElementById('analysis-modal')) return;

        const modal = document.createElement('div');
        modal.id = 'analysis-modal';
        modal.className = 'modal hidden';
        modal.innerHTML = `
            <div class="modal-content">
                <h2>Bảng Phân Tích Lượt Lóc Gà</h2>

                <div class="analysis-stats">
                    <div class="stat-box"><span class="stat-label">Tổng Điểm</span><span class="stat-value" id="final-score">0</span></div>
                    <div class="stat-box"><span class="stat-label">Lệch Khớp TB</span><span class="stat-value" id="avg-error">–</span></div>
                    <div class="stat-box"><span class="stat-label">Số Nhát Dao</span><span class="stat-value" id="cut-count">0</span></div>
                    <div class="stat-box"><span class="stat-label">Hạng</span><span class="stat-value" id="final-rank">Tập sự</span></div>
                </div>

                <div class="analysis-diagram">
                    <h3>Sơ Đồ Nhát Dao <small>(nhìn từ trên xuống)</small></h3>
                    <canvas id="chicken-2d-canvas" width="420" height="260"></canvas>
                    <div class="legend">
                        <span><i class="dot green"></i> Ngọt khớp</span>
                        <span><i class="dot yellow"></i> Sượt khớp</span>
                        <span><i class="dot red"></i> Phạm xương</span>
                    </div>
                </div>

                <div class="analysis-advice">
                    <h3>Lời Khuyên Từ Sư Phụ</h3>
                    <ul id="advice-list"></ul>
                </div>

                <button id="btn-close-analysis" class="btn-primary">Đóng Lại</button>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('btn-close-analysis')
            .addEventListener('click', () => modal.classList.add('hidden'));
    }

    showAnalysis() {
        document.getElementById('analysis-modal').classList.remove('hidden');
        document.getElementById('final-score').innerText = appState.score;
        document.getElementById('cut-count').innerText = appState.totalCuts;
        document.getElementById('final-rank').innerText = appState.playerProfile.level;

        const scored = appState.cutHistory.filter(c => c.distanceMm !== null && c.distanceMm !== undefined);
        if (scored.length) {
            const avg = scored.reduce((s, c) => s + c.distanceMm, 0) / scored.length;
            document.getElementById('avg-error').innerText = avg.toFixed(1) + 'mm';
        }

        this.renderAdvice();
        this.draw2DDiagram();
    }

    renderAdvice() {
        const list = document.getElementById('advice-list');
        list.innerHTML = '';

        const cuts = appState.cutHistory;
        const advice = [];

        // Nhát tệ nhất — nói cụ thể, không nói chung chung
        const worst = cuts
            .filter(c => c.distanceMm != null)
            .sort((a, b) => b.distanceMm - a.distanceMm)[0];
        if (worst && worst.distanceMm > 6) {
            const idx = cuts.indexOf(worst) + 1;
            advice.push(`Nhát số ${idx} lệch ${worst.distanceMm.toFixed(1)}mm ở ${worst.jointLabel}. Hãy sờ tìm khe khớp trước khi bổ, đừng bổ theo cảm giác.`);
        }

        const boneHits = cuts.filter(c => c.type === 'Phạm xương').length;
        if (boneHits > 0) {
            advice.push(`Phạm xương ${boneHits} lần — đó là nguồn gốc của vụn xương dăm trong đĩa. Chém vào khe khớp, đừng chém vào thân xương.`);
        }

        const tilted = cuts.filter(c => c.angleDiffDeg > 15);
        if (tilted.length > 0) {
            const avgTilt = tilted.reduce((s, c) => s + c.angleDiffDeg, 0) / tilted.length;
            advice.push(`${tilted.length} nhát dao không vuông góc thớt (nghiêng trung bình ${avgTilt.toFixed(0)}°). Dùng Q/E để chỉnh lại, R để đưa dao về thẳng đứng.`);
        }

        const weak = cuts.filter(c => c.type === 'Nhát non').length;
        const heavy = cuts.filter(c => c.type === 'Nhát tham').length;
        if (weak > 0) advice.push(`${weak} nhát non làm dao mắc kẹt và rách da. Giữ chuột lâu hơn một chút rồi hãy thả.`);
        if (heavy > 0) advice.push(`${heavy} nhát quá mạnh làm miếng bắn ra khỏi thớt. Lực vừa đủ là đủ — dao sắc làm việc thay tay.`);

        if (advice.length === 0) {
            advice.push('Không có lỗi nào đáng kể. Các nhát dao rất ngọt — giữ nhịp độ này.');
        }

        list.innerHTML = advice.slice(0, 4).map(a => `<li>${a}</li>`).join('');
    }

    project(x, z, canvas) {
        return {
            px: ((x - VIEW.xMin) / (VIEW.xMax - VIEW.xMin)) * canvas.width,
            // z lớn (phía đầu) vẽ lên trên
            py: canvas.height - ((z - VIEW.zMin) / (VIEW.zMax - VIEW.zMin)) * canvas.height
        };
    }

    /** Vẽ sơ đồ từ chính dữ liệu anatomy + toạ độ nhát dao THẬT (không còn Math.random). */
    draw2DDiagram() {
        const canvas = document.getElementById('chicken-2d-canvas');
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#1c120c';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Bóng các bộ phận, nhìn từ trên xuống
        ctx.strokeStyle = '#6d4c32';
        ctx.lineWidth = 2;
        for (const [, part] of Object.entries(this.anatomy.parts)) {
            const m = part.mesh;
            if (!m) continue;
            const { px, py } = this.project(m.pos[0], m.pos[2], canvas);
            const r = (m.args[0] || 1);
            const rx = (r / (VIEW.xMax - VIEW.xMin)) * canvas.width;
            const ry = (r / (VIEW.zMax - VIEW.zMin)) * canvas.height;

            ctx.fillStyle = 'rgba(221, 203, 181, 0.22)';
            ctx.beginPath();
            ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Vị trí các khớp
        for (const [, joint] of Object.entries(this.anatomy.joints)) {
            const { px, py } = this.project(joint.position[0], joint.position[2], canvas);
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Các nhát dao thật
        appState.cutHistory.forEach((cut, i) => {
            if (!cut.position) return;
            const { px, py } = this.project(cut.position[0], cut.position[2], canvas);

            if (cut.type === 'Phạm xương' || cut.type === 'Chém trượt') ctx.fillStyle = '#f44336';
            else if (cut.type === 'Sượt khớp') ctx.fillStyle = '#ffeb3b';
            else if (cut.type === 'Ngọt khớp') ctx.fillStyle = '#4caf50';
            else ctx.fillStyle = '#ff9800';

            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(i + 1), px, py);
        });
    }
}
