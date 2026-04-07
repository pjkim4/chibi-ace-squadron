import * as THREE from 'three';

export class BulletPool {
  constructor(scene, count = 500) {
    this.count = count;
    this.scene = scene;
    this.geometry = new THREE.SphereGeometry(0.3, 8, 8);
    this.material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    this.bullets = [];
    this.dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      this.bullets.push({ active: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0 });
      this.setInstanceMatrix(i, new THREE.Vector3(0, -100, 0)); // Hide initially
    }
  }

  spawn(pos, vel, life = 3.0) {
    const idx = this.bullets.findIndex(b => !b.active);
    if (idx === -1) return;
    const b = this.bullets[idx];
    b.active = true; b.position.copy(pos); b.velocity.copy(vel); b.life = life;
    this.setInstanceMatrix(idx, b.position);
  }

  update(delta, playerPos, onHit) {
    for (let i = 0; i < this.count; i++) {
      const b = this.bullets[i];
      if (!b.active) continue;
      
      b.life -= delta;
      b.position.addScaledVector(b.velocity, delta);
      
      if (b.life <= 0) {
        b.active = false; this.setInstanceMatrix(i, new THREE.Vector3(0, -100, 0));
        continue;
      }

      this.setInstanceMatrix(i, b.position);

      // Collision check with player
      if (b.position.distanceTo(playerPos) < 2.0) {
        b.active = false; this.setInstanceMatrix(i, new THREE.Vector3(0, -100, 0));
        onHit();
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setInstanceMatrix(idx, pos) {
    this.dummy.position.copy(pos);
    this.dummy.updateMatrix();
    this.mesh.setMatrixAt(idx, this.dummy.matrix);
  }
}
