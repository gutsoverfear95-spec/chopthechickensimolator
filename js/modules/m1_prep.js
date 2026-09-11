import { appState } from '../core/state.js';

export class M1PrepModule {
    constructor() {
        this.setupUI();
    }
    
    setupUI() {
        if (!document.getElementById('m1-ui')) {
            const m1UI = document.createElement('div');
            m1UI.id = 'm1-ui';
            m1UI.className = 'fullscreen-overlay';
            m1UI.innerHTML = `
                <div class="prep-container">
                    <h1>Sơ Chế Gà (M1)</h1>
                    
                    <div class="profile-info">
                        Cấp độ hiện tại: <strong id="player-level">${appState.playerProfile.level}</strong> | 
                        Điểm cao nhất: <strong>${appState.playerProfile.highScore}</strong>
                    </div>
                    
                    <div class="step-card">
                        <h3>1. Chọn Gà</h3>
                        <div class="options">
                            <label><input type="radio" name="chickenType" value="gata" checked> Gà ta (1.4kg) - Vừa vặn, da dai</label>
                            <label><input type="radio" name="chickenType" value="gacongnghiep"> Gà mái tơ (1.8kg) - Nhiều mỡ</label>
                        </div>
                    </div>
                    
                    <div class="step-card">
                        <h3>2. Buộc Gà & Luộc</h3>
                        <p>Bạn thả gà vào nồi nước lạnh, đun lửa vừa. (Nước sôi lăn tăn ~80-85°C).</p>
                        <div class="slider-container">
                            <label>Thời gian luộc (phút): <span id="boil-time-val">25</span></label>
                            <input type="range" id="boil-time" min="10" max="40" value="25">
                        </div>
                    </div>
                    
                    <div class="step-card">
                        <h3>3. Ngâm Đá</h3>
                        <label><input type="checkbox" id="ice-bath" checked> Ngâm nước đá 5 phút (Tăng độ giòn da)</label>
                    </div>
                    
                    <button id="btn-start-m2" class="btn-primary">Hoàn tất sơ chế - Đem Lên Thớt</button>
                </div>
            `;
            document.body.appendChild(m1UI);
            
            document.getElementById('boil-time').addEventListener('input', (e) => {
                document.getElementById('boil-time-val').innerText = e.target.value;
            });
            
            document.getElementById('btn-start-m2').addEventListener('click', () => {
                this.finishPrep();
            });
        }
    }
    
    finishPrep() {
        // Evaluate prep choices
        const boilTime = parseInt(document.getElementById('boil-time').value);
        const iceBath = document.getElementById('ice-bath').checked;
        
        let prepScore = 0;
        
        // 25 mins is ideal for 1.4kg chicken
        if (Math.abs(boilTime - 25) <= 2) {
            prepScore += 50;
        } else {
            prepScore -= Math.abs(boilTime - 25) * 5;
        }
        
        if (iceBath) prepScore += 20;
        
        // Add to main score
        appState.updatePlatingScore(prepScore); // Reusing method to add score safely
        
        // Hide M1
        document.getElementById('m1-ui').classList.add('hidden');
        
        // Start M2
        appState.changePhase('m2_chop');
    }
}
