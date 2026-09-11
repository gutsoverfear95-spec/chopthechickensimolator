import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeWoodTexture } from './materials.js';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0e0906);
        this.scene.fog = new THREE.Fog(0x0e0906, 45, 95);

        this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 300);
        this.camera.position.set(0, 15, 18);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Tone mapping + môi trường phản chiếu: đây là hai thứ quyết định vật thể
        // trông như thịt hay như nhựa. MeshStandardMaterial không có envMap thì
        // highlight nào cũng là một đốm trắng phẳng — mắt đọc ngay ra là nhựa.
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.95;
        this.container.appendChild(this.renderer.domElement);

        const pmrem = new THREE.PMREMGenerator(this.renderer);
        this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.08;
        this.controls.minDistance = 8;
        this.controls.maxDistance = 45;

        // Người chơi động vào camera là huỷ ngay việc tự lượn — không bao giờ
        // giành quyền điều khiển với người dùng.
        this.controls.addEventListener('start', () => { this.tween = null; });

        this.shakeIntensity = 0;
        this.shakeOffset = new THREE.Vector3();
        this.tween = null;

        this.setupLighting();
        this.setupEnvironment();

        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    setupLighting() {
        this.scene.add(new THREE.AmbientLight(0xffe9cc, 0.35));

        // Đèn bếp treo trên cao, hơi lệch về trước
        const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
        key.position.set(6, 18, 9);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 0.5;
        key.shadow.camera.far = 60;
        const d = 16;
        key.shadow.camera.left = -d;
        key.shadow.camera.right = d;
        key.shadow.camera.top = d;
        key.shadow.camera.bottom = -d;
        key.shadow.bias = -0.0012;
        key.shadow.normalBias = 0.02;
        this.scene.add(key);

        // Hắt lạnh từ phía cửa sổ, tách con gà khỏi nền tối
        const fill = new THREE.DirectionalLight(0xbfd4ff, 0.5);
        fill.position.set(-9, 7, -8);
        this.scene.add(fill);

        // Viền sau cho thấy rõ mép da
        const rim = new THREE.DirectionalLight(0xffd9a0, 0.9);
        rim.position.set(-3, 5, -12);
        this.scene.add(rim);
    }

    setupEnvironment() {
        const wood = makeWoodTexture();

        const boardGeo = new THREE.CylinderGeometry(8.5, 8.3, 1.6, 72);
        const boardMat = new THREE.MeshStandardMaterial({
            map: wood,
            roughness: 0.85,
            metalness: 0,
            bumpMap: wood,
            bumpScale: 0.06,
            envMapIntensity: 0.35
        });
        this.board = new THREE.Mesh(boardGeo, boardMat);
        this.board.name = 'board';
        this.board.position.y = -0.8;   // mặt thớt ở y = 0
        this.board.receiveShadow = true;
        this.scene.add(this.board);

        const table = new THREE.Mesh(
            new THREE.PlaneGeometry(160, 160),
            new THREE.MeshStandardMaterial({ color: 0x17100b, roughness: 0.95, metalness: 0 })
        );
        table.rotation.x = -Math.PI / 2;
        table.position.y = -1.6;
        table.receiveShadow = true;
        this.scene.add(table);

        // Đĩa sứ trắng viền xanh
        this.plate = new THREE.Mesh(
            new THREE.CylinderGeometry(10, 8, 0.5, 72),
            new THREE.MeshPhysicalMaterial({
                color: 0xfbfaf7, roughness: 0.08, metalness: 0,
                clearcoat: 0.9, clearcoatRoughness: 0.05
            })
        );
        this.plate.position.set(20, -1.35, 0);
        this.plate.receiveShadow = true;
        this.plate.visible = false;
        this.scene.add(this.plate);

        this.plateRim = new THREE.Mesh(
            new THREE.TorusGeometry(9.5, 0.15, 16, 100),
            new THREE.MeshPhysicalMaterial({ color: 0x1565c0, roughness: 0.15, clearcoat: 0.8 })
        );
        this.plateRim.rotation.x = Math.PI / 2;
        this.plateRim.position.set(20, -1.1, 0);
        this.plateRim.visible = false;
        this.scene.add(this.plateRim);
    }

    showPlate() {
        this.plate.visible = true;
        this.plateRim.visible = true;
    }

    /**
     * Lượn camera tới một góc nhìn mới.
     * Dùng khi sang bước mới trong trình tự lóc — người chơi không phải tự xoay
     * đi tìm khớp nữa. Chạm vào chuột là tween huỷ ngay.
     */
    focusOn(cameraPos, target, duration = 900) {
        this.tween = {
            fromPos: this.camera.position.clone(),
            toPos: cameraPos.clone(),
            fromTarget: this.controls.target.clone(),
            toTarget: target.clone(),
            start: performance.now(),
            duration
        };
    }

    updateTween() {
        if (!this.tween) return;

        const t = Math.min((performance.now() - this.tween.start) / this.tween.duration, 1);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic

        this.camera.position.lerpVectors(this.tween.fromPos, this.tween.toPos, e);
        this.controls.target.lerpVectors(this.tween.fromTarget, this.tween.toTarget, e);

        if (t >= 1) this.tween = null;
    }

    shake(intensity) {
        this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    }

    setCameraView(viewType) {
        const target = new THREE.Vector3(0, 3, 0);
        const pos = {
            top:   new THREE.Vector3(0, 24, 0.1),
            side:  new THREE.Vector3(14, 13, 15),
            front: new THREE.Vector3(0, 7, 21)
        }[viewType];

        if (pos) this.focusOn(pos, target, 650);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.updateTween();
        this.controls.update();

        if (this.shakeIntensity > 0.001) {
            this.shakeOffset.set(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
            this.shakeIntensity *= 0.82;
            this.camera.position.add(this.shakeOffset);
            this.renderer.render(this.scene, this.camera);
            this.camera.position.sub(this.shakeOffset); // trả lại ngay, không tích luỹ trôi
            return;
        }

        this.shakeIntensity = 0;
        this.renderer.render(this.scene, this.camera);
    }
}
