import { appState } from '../core/state.js';

export class UIAnalysis {
    constructor() {
        this.setupModal();
    }

    setupModal() {
        // Create modal structure if not exists
        if (!document.getElementById('analysis-modal')) {
            const modal = document.createElement('div');
            modal.id = 'analysis-modal';
            modal.className = 'modal hidden';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>Bảng Phân Tích Lượt Lóc Gà</h2>
                    
                    <div class="analysis-stats">
                        <div class="stat-box">
                            <span class="stat-label">Tổng Điểm</span>
                            <span class="stat-value" id="final-score">0</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Lệch Khớp TB</span>
                            <span class="stat-value" id="avg-error">0mm</span>
                        </div>
                    </div>
                    
                    <div class="analysis-diagram">
                        <h3>Sơ Đồ Nhát Dao</h3>
                        <canvas id="chicken-2d-canvas" width="400" height="200"></canvas>
                    </div>
                    
                    <div class="analysis-advice">
                        <h3>Lời Khuyên Từ Sư Phụ</h3>
                        <ul id="advice-list"></ul>
                    </div>
                    
                    <button id="btn-close-analysis" class="btn-primary">Đóng Lại</button>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('btn-close-analysis').addEventListener('click', () => {
                modal.classList.add('hidden');
            });
        }
    }

    showAnalysis() {
        const modal = document.getElementById('analysis-modal');
        modal.classList.remove('hidden');
        
        document.getElementById('final-score').innerText = appState.score;
        
        let totalError = 0;
        let cutCount = 0;
        
        const adviceList = document.getElementById('advice-list');
        adviceList.innerHTML = '';
        
        let boneHits = 0;
        let shallowCuts = 0;
        
        appState.cutHistory.forEach((cut, index) => {
            if (cut.distanceMm !== undefined) {
                totalError += cut.distanceMm;
                cutCount++;
            }
            if (cut.type === 'Phạm xương') boneHits++;
            if (cut.type === 'Sượt khớp') shallowCuts++;
        });
        
        if (cutCount > 0) {
            document.getElementById('avg-error').innerText = (totalError / cutCount).toFixed(1) + 'mm';
        }
        
        // Generate dynamic advice
        if (boneHits > 0) {
            adviceList.innerHTML += `<li>Bạn chém phạm xương ${boneHits} lần! Hãy rê dao sờ tìm khe khớp kỹ hơn trước khi xuống đao.</li>`;
        }
        if (shallowCuts > 0) {
            adviceList.innerHTML += `<li>Một số nhát bị sượt khớp. Góc dao chưa chuẩn xác, hãy chỉnh nghiêng dao bằng con lăn chuột (Q/E).</li>`;
        }
        if (boneHits === 0 && shallowCuts === 0) {
            adviceList.innerHTML += `<li>Tuyệt vời! Các nhát dao rất ngọt, không phạm xương chút nào!</li>`;
        }
        
        adviceList.innerHTML += `<li>Mức lực băm khá ổn định. Hãy duy trì nhịp độ này.</li>`;
        
        this.draw2DDiagram();
    }
    
    draw2DDiagram() {
        const canvas = document.getElementById('chicken-2d-canvas');
        const ctx = canvas.getContext('2d');
        
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Simple stylized body
        ctx.fillStyle = '#ddcbb5';
        ctx.beginPath();
        ctx.ellipse(200, 100, 120, 70, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#8b5a2b';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Draw cuts
        appState.cutHistory.forEach((cut) => {
            if (cut.distanceMm !== undefined) {
                const x = 100 + Math.random() * 200;
                const y = 50 + Math.random() * 100;
                
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                
                if (cut.type === 'Phạm xương') ctx.fillStyle = '#f44336';
                else if (cut.type === 'Sượt khớp') ctx.fillStyle = '#ffeb3b';
                else ctx.fillStyle = '#4caf50';
                
                ctx.fill();
            }
        });
    }
}
