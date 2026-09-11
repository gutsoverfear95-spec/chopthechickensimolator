import * as THREE from 'three';

export class ChickenMesh {
    constructor() {
        this.group = new THREE.Group();
        this.isFlipped = false;
        this.boneShards = []; // To store instanced meshes or particles

        
        // Boiled chicken skin color
        this.skinMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // Golden yellow
            roughness: 0.3, // Slightly shiny (greasy)
            metalness: 0.1
        });
        
        // Meat material for cross sections
        this.meatMaterial = new THREE.MeshStandardMaterial({
            color: 0xddcbb5, // White-ish meat
            roughness: 0.8,
            metalness: 0
        });
        
        this.parts = {};
        this.buildProceduralChicken();
    }
    
    buildProceduralChicken() {
        // This is a placeholder stylized chicken made of primitives
        // Body (Lưng + Ức)
        const bodyGeo = new THREE.CapsuleGeometry(2.5, 4, 16, 32);
        const body = new THREE.Mesh(bodyGeo, this.skinMaterial);
        body.rotation.x = Math.PI / 2;
        body.position.set(0, 2.5, 0);
        body.castShadow = true;
        body.receiveShadow = true;
        this.group.add(body);
        this.parts['uc'] = body; // Simplified
        
        // Đùi góc tư trái
        const thighGeo = new THREE.CapsuleGeometry(1.2, 2.5, 16, 16);
        const thighLeft = new THREE.Mesh(thighGeo, this.skinMaterial);
        thighLeft.rotation.z = -Math.PI / 6;
        thighLeft.rotation.x = Math.PI / 4;
        thighLeft.position.set(-2.5, 2, -2);
        thighLeft.castShadow = true;
        this.group.add(thighLeft);
        this.parts['dui_goc_tu_trai'] = thighLeft;
        
        // Đùi góc tư phải
        const thighRight = new THREE.Mesh(thighGeo, this.skinMaterial);
        thighRight.rotation.z = Math.PI / 6;
        thighRight.rotation.x = Math.PI / 4;
        thighRight.position.set(2.5, 2, -2);
        thighRight.castShadow = true;
        this.group.add(thighRight);
        this.parts['dui_goc_tu_phai'] = thighRight;
        
        // Cánh trái
        const wingGeo = new THREE.CapsuleGeometry(0.8, 2, 16, 16);
        const wingLeft = new THREE.Mesh(wingGeo, this.skinMaterial);
        wingLeft.rotation.z = -Math.PI / 4;
        wingLeft.position.set(-3, 3, 2);
        wingLeft.castShadow = true;
        this.group.add(wingLeft);
        this.parts['canh_trai'] = wingLeft;
        
        // Cánh phải
        const wingRight = new THREE.Mesh(wingGeo, this.skinMaterial);
        wingRight.rotation.z = Math.PI / 4;
        wingRight.position.set(3, 3, 2);
        wingRight.castShadow = true;
        this.group.add(wingRight);
        this.parts['canh_phai'] = wingRight;
        
        // Cổ và đầu
        const neckGeo = new THREE.CylinderGeometry(0.6, 0.8, 3, 16);
        const neck = new THREE.Mesh(neckGeo, this.skinMaterial);
        neck.rotation.x = Math.PI / 6;
        neck.position.set(0, 4, 3.5);
        neck.castShadow = true;
        this.group.add(neck);
        this.parts['co'] = neck;
        
        const headGeo = new THREE.SphereGeometry(1.2, 16, 16);
        const head = new THREE.Mesh(headGeo, this.skinMaterial);
        head.position.set(0, 5.5, 4.5);
        head.castShadow = true;
        this.group.add(head);
        this.parts['dau'] = head;
        
        // Name all meshes for raycasting
        this.group.traverse(child => {
            if (child.isMesh) {
                child.name = 'chicken_part';
            }
        });
    }
    
    flip() {
        this.isFlipped = !this.isFlipped;
        // Animation could be added here
        const targetRotation = this.isFlipped ? Math.PI : 0;
        
        // Simple instant flip for now
        this.group.rotation.z = targetRotation;
        
        // Adjust Y position since center of mass might change
        if (this.isFlipped) {
            this.group.position.y = 5; // move up when upside down
        } else {
            this.group.position.y = 0;
        }
    }
    
    detachPart(partName) {
        const part = this.parts[partName];
        if (!part) return;
        
        // Hiệu ứng rơi đơn giản
        // Nếu bộ phận vẫn là con của group chính, việc di chuyển vị trí local sẽ bị ảnh hưởng bởi phép lật con gà
        // Lý tưởng là tách hẳn ra add vào scene, nhưng để đơn giản ta đổi vị trí local
        part.position.y = (Math.random() * 0.5) - (this.isFlipped ? 5 : 0); // Drop to board level roughly
        part.position.x += (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
        part.position.z += (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random());
        
        part.rotation.z += Math.random() * Math.PI;
        part.rotation.x += Math.random() * Math.PI;
    }
    
    createBoneShards(position) {
        // Tạo vụn xương văng ra
        const shardGeo = new THREE.TetrahedronGeometry(0.2);
        const shardMat = new THREE.MeshBasicMaterial({ color: 0xaa0000 }); // Đỏ vụn xương/máu
        
        for (let i = 0; i < 5; i++) {
            const shard = new THREE.Mesh(shardGeo, shardMat);
            
            // Randomize position near the cut point
            shard.position.copy(position);
            shard.position.x += (Math.random() - 0.5);
            shard.position.y += Math.random();
            shard.position.z += (Math.random() - 0.5);
            
            // Randomize rotation
            shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            
            this.group.add(shard);
            this.boneShards.push(shard);
        }
    }
}
