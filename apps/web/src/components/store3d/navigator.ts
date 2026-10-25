// Navegação fácil da loja 3D: a pessoa toca no nome da seção e a câmera
// anda sozinha até lá. Fica fora do componente para o React não reclamar das
// mudanças feitas a cada quadro, e para poder ser testada sem WebGL.

export const NAV_SPEED = 1.5; // m/s, devagar e confortável
export const TURN_SPEED = 2.2; // rad/s

export function angleDiff(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

export class Navigator {
  path: { x: number; z: number }[] = [];
  finalYaw: number | null = null;
  pendingTurn = 0;
  /** Atualizados pela câmera a cada quadro. */
  position = { x: 0, z: 0 };
  yaw = 0;
  go(path: { x: number; z: number }[], yaw: number) {
    this.path = [...path];
    this.finalYaw = yaw;
  }
  turn(delta: number) {
    this.pendingTurn += delta;
  }
  cancel() {
    this.path = [];
    this.finalYaw = null;
    this.pendingTurn = 0;
  }
  track(p: { x: number; z: number }, yaw: number) {
    this.position = { x: p.x, z: p.z };
    this.yaw = yaw;
  }
  /**
   * Um quadro da navegação automática: vira para o próximo ponto do caminho e
   * anda até ele; no fim, vira para a seção. Ajusta `look` e devolve a posição nova.
   */
  step(pos: { x: number; z: number }, look: { yaw: number; pitch: number }, t: number): { x: number; z: number } {
    const out = { ...pos };
    const rotate = (to: number) => {
      const turn = angleDiff(look.yaw, to);
      look.yaw += Math.sign(turn) * Math.min(Math.abs(turn), TURN_SPEED * t);
      return turn;
    };
    if (this.path.length) {
      const target = this.path[0];
      const dx = target.x - pos.x;
      const dz = target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      // Só anda quando já está mais ou menos de frente, como uma pessoa.
      if (Math.abs(rotate(Math.atan2(-dx, -dz))) < 0.6) {
        const stepLen = Math.min(dist, NAV_SPEED * t);
        out.x += (dx / (dist || 1)) * stepLen;
        out.z += (dz / (dist || 1)) * stepLen;
      }
      if (dist < 0.05) this.path.shift();
    } else if (this.finalYaw !== null) {
      if (Math.abs(rotate(this.finalYaw)) < 0.01) this.finalYaw = null;
    }
    if (this.pendingTurn) {
      const d = Math.sign(this.pendingTurn) * Math.min(Math.abs(this.pendingTurn), TURN_SPEED * t);
      look.yaw += d;
      this.pendingTurn -= d;
      if (Math.abs(this.pendingTurn) < 0.001) this.pendingTurn = 0;
    }
    // Olhar levemente para baixo enquanto anda, para ver as prateleiras.
    if (this.path.length || this.finalYaw !== null) look.pitch += (-0.12 - look.pitch) * Math.min(1, t * 3);
    return out;
  }
}
