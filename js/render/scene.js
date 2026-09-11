import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';

export class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#1a1a1a'); // Dark warm bg
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 15, 15); // Default side/top angle
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.1; // Don't go below ground
        
        this.setupLighting();
        this.setupEnvironment();
        
        // Resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }
    
    setupLighting() {
        // Ambient light (warm)
        const ambientLight = new THREE.AmbientLight(0xfff0dd, 0.5);
        this.scene.add(ambientLight);
        
        // Main kitchen light (top down, warm)
        const dirLight = new THREE.DirectionalLight(0xffeedd, 2.5);
        dirLight.position.set(5, 20, 5);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 50;
        const d = 15;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0xddddff, 0.8);
        fillLight.position.set(-5, 10, -5);
        this.scene.add(fillLight);
    }
    
    setupEnvironment() {
        // Chopping board (Thớt gỗ nghiến)
        const boardGeometry = new THREE.CylinderGeometry(8, 8, 2, 64);
        const boardMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8b5a2b, 
            roughness: 0.9,
            metalness: 0.1
        });
        this.board = new THREE.Mesh(boardGeometry, boardMaterial);
        this.board.position.y = -1; // Top surface at y=0
        this.board.receiveShadow = true;
        this.scene.add(this.board);
        
        // Optional: A large table surface below
        const tableGeo = new THREE.PlaneGeometry(100, 100);
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 1 });
        const table = new THREE.Mesh(tableGeo, tableMat);
        table.rotation.x = -Math.PI / 2;
        table.position.y = -2;
        table.receiveShadow = true;
        this.scene.add(table);
        
        // Đĩa sứ trắng viền xanh (Plating phase)
        const plateGeo = new THREE.CylinderGeometry(10, 8, 0.5, 64);
        const plateMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.1,
            metalness: 0.1
        });
        this.plate = new THREE.Mesh(plateGeo, plateMat);
        this.plate.position.set(20, -1.75, 0); // Đặt bên phải thớt
        this.plate.receiveShadow = true;
        this.scene.add(this.plate);
        
        // Viền xanh của đĩa
        const rimGeo = new THREE.TorusGeometry(9.5, 0.15, 16, 100);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.2 });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(20, -1.5, 0);
        this.scene.add(rim);
        
        // Ẩn đĩa lúc đầu (M2)
        this.plate.visible = false;
        rim.visible = false;
        this.plateRim = rim; // Lưu tham chiếu để bật tắt
    }
    
    showPlate() {
        this.plate.visible = true;
        this.plateRim.visible = true;
    }
    
    setCameraView(viewType) {
        switch(viewType) {
            case 'top':
                this.camera.position.set(0, 20, 0.1); // slight offset to avoid gimble lock
                break;
            case 'side':
                this.camera.position.set(15, 15, 15);
                break;
            case 'front':
                this.camera.position.set(0, 5, 20);
                break;
        }
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    render() {
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
