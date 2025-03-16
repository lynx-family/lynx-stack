export type LifecyclePhase =
  | 'beforeMount'
  | 'afterMount'
  | 'beforeUpdate'
  | 'afterUpdate'
  | 'beforeDestroy'
  | 'afterDestroy';

export interface LifecycleHook {
  phase: LifecyclePhase;
  callback: () => Promise<void> | void;
  timeout?: number;
}

export class LifecycleManager {
  private static instance: LifecycleManager;
  private hooks: Map<string, LifecycleHook[]>;
  private defaultTimeout = 5000;

  private constructor() {
    this.hooks = new Map();
  }

  static getInstance(): LifecycleManager {
    if (!this.instance) {
      this.instance = new LifecycleManager();
    }
    return this.instance;
  }

  registerHook(componentId: string, hook: LifecycleHook): void {
    const existingHooks = this.hooks.get(componentId) || [];
    this.hooks.set(componentId, [...existingHooks, hook]);
  }

  async executePhase(
    componentId: string,
    phase: LifecyclePhase,
  ): Promise<void> {
    const hooks = this.hooks.get(componentId) || [];
    const phaseHooks = hooks.filter(hook => hook.phase === phase);

    try {
      await Promise.race([
        Promise.all(phaseHooks.map(hook => hook.callback())),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Lifecycle timeout')),
            Math.max(
              ...phaseHooks.map(hook => hook.timeout || this.defaultTimeout),
            ),
          )
        ),
      ]);
    } catch (error) {
      console.error(`Lifecycle error in ${phase} for ${componentId}:`, error);
      throw error;
    }
  }

  unregisterComponent(componentId: string): void {
    this.hooks.delete(componentId);
  }

  setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }
}
