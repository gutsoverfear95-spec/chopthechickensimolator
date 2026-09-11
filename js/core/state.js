export class AppState {
    constructor() {
        this.score = 0;
        this.totalCuts = 0;
        this.cutHistory = [];
        this.detachedParts = new Set();
        this.currentPhase = 'm1_prep'; // M1, M2, M3, M4
        
        // M4: Cấp độ và Hồ sơ
        this.playerProfile = this.loadProfile();

        
        // Trình tự 7 bước lóc gà
        this.chopSequence = [
            { id: 'khop_co', name: 'Cổ & Đầu', instruction: 'Bước 1: Chặt rời đầu và cổ tại khớp cổ.' },
            { id: 'khop_vai_trai', name: 'Cánh Trái', instruction: 'Bước 2: Cắt rời cánh trái tại khớp vai.' },
            { id: 'khop_vai_phai', name: 'Cánh Phải', instruction: 'Bước 3: Cắt rời cánh phải tại khớp vai.' },
            { id: 'khop_hang_trai', name: 'Đùi Góc Tư Trái', instruction: 'Bước 4: Cắt đùi góc tư trái tại khớp háng.' },
            { id: 'khop_hang_phai', name: 'Đùi Góc Tư Phải', instruction: 'Bước 5: Cắt đùi góc tư phải tại khớp háng.' }
        ];
        this.currentChopStepIndex = 0;
        
        this.listeners = [];
    }

    subscribe(listener) {
        this.listeners.push(listener);
    }

    notify() {
        this.listeners.forEach(l => l(this));
    }

    addCutResult(result) {
        this.cutHistory.push(result);
        if (result.score) {
            this.score += result.score;
        }
        this.totalCuts++;
        this.notify();
    }

    markPartDetached(partId) {
        this.detachedParts.add(partId);
        this.notify();
    }

    isPartDetached(partId) {
        return this.detachedParts.has(partId);
    }

    getCurrentStep() {
        if (this.currentChopStepIndex < this.chopSequence.length) {
            return this.chopSequence[this.currentChopStepIndex];
        }
        return { id: 'done', name: 'Hoàn thành lóc', instruction: 'Bạn đã lóc xong các bộ phận chính. Giờ có thể chặt thành miếng vừa ăn.' };
    }

    advanceStep() {
        this.currentChopStepIndex++;
        this.notify();
    }
    
    updatePlatingScore(points) {
        this.score += points;
        this.notify();
    }
    
    changePhase(newPhase) {
        this.currentPhase = newPhase;
        this.notify();
    }
    
    // M4: Profile Management
    loadProfile() {
        const saved = localStorage.getItem('chopChickenProfile');
        if (saved) {
            return JSON.parse(saved);
        }
        return {
            level: 'Tập sự',
            highScore: 0,
            gamesPlayed: 0
        };
    }
    
    saveProfile() {
        if (this.score > this.playerProfile.highScore) {
            this.playerProfile.highScore = this.score;
        }
        this.playerProfile.gamesPlayed++;
        
        // Cập nhật hạng
        if (this.playerProfile.highScore > 900) this.playerProfile.level = 'Sư phụ';
        else if (this.playerProfile.highScore > 700) this.playerProfile.level = 'Bếp trưởng';
        else if (this.playerProfile.highScore > 500) this.playerProfile.level = 'Thợ chính';
        else if (this.playerProfile.highScore > 300) this.playerProfile.level = 'Thợ phụ';
        
        localStorage.setItem('chopChickenProfile', JSON.stringify(this.playerProfile));
    }
}

// Singleton instance
export const appState = new AppState();
