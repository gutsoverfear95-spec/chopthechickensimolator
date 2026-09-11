export class AppState {
    constructor() {
        this.score = 0;
        this.totalCuts = 0;
        this.cutHistory = [];
        this.detachedParts = new Set();
        this.currentPhase = 'm1_prep'; // m1_prep | m2_chop | m3_plate
        this.platingScore = 0;

        this.playerProfile = this.loadProfile();

        // Trình tự 7 bước pha lóc — id phải trùng với key trong chicken-anatomy.json
        this.chopSequence = [
            { id: 'khop_co',          name: 'Cổ & Đầu',      instruction: 'Bước 1/7 — Chặt rời đầu và cổ tại khớp cổ. Dao dựng đứng, bổ dứt khoát một nhát.' },
            { id: 'khop_vai_trai',    name: 'Cánh Trái',     instruction: 'Bước 2/7 — Cắt rời cánh trái tại khớp vai. Rạch da trước, tìm khe khớp rồi mới xuống đao.' },
            { id: 'khop_vai_phai',    name: 'Cánh Phải',     instruction: 'Bước 3/7 — Cắt rời cánh phải tại khớp vai.' },
            { id: 'khop_hang_trai',   name: 'Đùi Trái',      instruction: 'Bước 4/7 — Cắt đùi góc tư trái tại khớp háng. Bẻ ngửa khớp cho lộ ra trước.' },
            { id: 'khop_hang_phai',   name: 'Đùi Phải',      instruction: 'Bước 5/7 — Cắt đùi góc tư phải tại khớp háng.' },
            { id: 'khop_uc_lung',     name: 'Tách Ức',       instruction: 'Bước 6/7 — Tách ức khỏi lưng: cắt dọc theo đường xương sườn, dao song song thân gà.' },
            { id: 'khop_phao_cau',    name: 'Phao Câu',      instruction: 'Bước 7/7 — Cắt rời phao câu ở cuối lưng.' }
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

    /** Điểm không bao giờ âm — HUD và hồ sơ dùng chung một con số. */
    addScore(points) {
        this.score = Math.max(0, this.score + points);
    }

    addCutResult(result) {
        this.cutHistory.push(result);
        this.addScore(result.score || 0);
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

    /** Bước này đã hoàn thành chưa — xét theo jointId đã cắt THÀNH CÔNG, không xét theo part. */
    isStepDone(jointId) {
        return this.cutHistory.some(c => c.success && c.jointId === jointId);
    }

    /**
     * Khớp này đã "mở khoá" chưa.
     * Trình tự pha lóc là một phần của bài học, nên không cho phép nhảy cóc sang
     * khớp của bước sau — nhất là khi hai khớp nằm gần nhau (vai và đường xương
     * sườn chỉ cách nhau 1 đơn vị và có cùng hướng cắt).
     */
    isJointAvailable(jointId) {
        const idx = this.chopSequence.findIndex(s => s.id === jointId);
        if (idx === -1) return true;
        return idx <= this.currentChopStepIndex;
    }

    getCurrentStep() {
        if (this.currentChopStepIndex < this.chopSequence.length) {
            return this.chopSequence[this.currentChopStepIndex];
        }
        return {
            id: 'done',
            name: 'Hoàn thành lóc',
            instruction: 'Đã lóc xong toàn bộ. Bấm "Chuyển sang Xếp Đĩa" để trình bày.'
        };
    }

    advanceStep() {
        this.currentChopStepIndex++;
        this.notify();
    }

    isChopComplete() {
        return this.currentChopStepIndex >= this.chopSequence.length;
    }

    updatePlatingScore(points) {
        this.platingScore += points;
        this.addScore(points);
        this.notify();
    }

    changePhase(newPhase) {
        this.currentPhase = newPhase;
        this.notify();
    }

    loadProfile() {
        try {
            const saved = localStorage.getItem('chopChickenProfile');
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.warn('Không đọc được hồ sơ đã lưu:', e);
        }
        return { level: 'Tập sự', highScore: 0, gamesPlayed: 0 };
    }

    saveProfile() {
        if (this.score > this.playerProfile.highScore) {
            this.playerProfile.highScore = this.score;
        }
        this.playerProfile.gamesPlayed++;

        const hs = this.playerProfile.highScore;
        if (hs > 900) this.playerProfile.level = 'Sư phụ';
        else if (hs > 700) this.playerProfile.level = 'Bếp trưởng';
        else if (hs > 500) this.playerProfile.level = 'Thợ chính';
        else if (hs > 300) this.playerProfile.level = 'Thợ phụ';
        else this.playerProfile.level = 'Tập sự';

        try {
            localStorage.setItem('chopChickenProfile', JSON.stringify(this.playerProfile));
        } catch (e) {
            console.warn('Không lưu được hồ sơ:', e);
        }
    }
}

export const appState = new AppState();
