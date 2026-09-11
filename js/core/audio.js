export class AudioSystem {
    constructor() {
        this.ctx = null;   // tạo lazy — Chrome chặn AudioContext trước khi có tương tác
    }

    ensureContext() {
        if (!this.ctx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            this.ctx = new Ctor();
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }

    playChop(isBoneHit) {
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const gain = ctx.createGain();
        gain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.connect(gain);

        if (isBoneHit) {
            // "Khục" — đục, trầm, có đuôi: dao ăn vào thân xương
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);
            gain.gain.setValueAtTime(0.9, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.24);

            this.addNoise(ctx, gain, now, 0.18);
        } else {
            // "Cạch" — đanh, gọn: lưỡi dao chạm mặt thớt gỗ nghiến
            osc.type = 'square';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);
            gain.gain.setValueAtTime(0.55, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }

    addNoise(ctx, dest, now, duration) {
        const frames = Math.floor(ctx.sampleRate * duration);
        const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < frames; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
        }

        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.18, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + duration);

        src.connect(g);
        g.connect(dest);
        src.start(now);
    }
}

export const audioSystem = new AudioSystem();
