export interface CoreConfig {
  debug: boolean;
  performance: {
    enabled: boolean;
    sampleRate: number;
  };
  errorHandling: {
    enabled: boolean;
    reportToServer: boolean;
    endpoint?: string;
  };
  lifecycle: {
    timeout: number;
    asyncOperations: boolean;
  };
  storage: {
    persistence: boolean;
    prefix: string;
  };
}

export class ConfigManager {
  private static instance: ConfigManager;
  private config: CoreConfig;
  private readonly defaultConfig: CoreConfig = {
    debug: process.env['NODE_ENV'] !== 'production',
    performance: {
      enabled: true,
      sampleRate: 0.1,
    },
    errorHandling: {
      enabled: true,
      reportToServer: false,
    },
    lifecycle: {
      timeout: 5000,
      asyncOperations: true,
    },
    storage: {
      persistence: true,
      prefix: 'lynx_',
    },
  };

  private constructor() {
    this.config = this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  getConfig(): CoreConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<CoreConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
    };
    this.saveConfig();
  }

  private loadConfig(): CoreConfig {
    try {
      const saved = localStorage.getItem('lynx_config');
      return saved
        ? { ...this.defaultConfig, ...JSON.parse(saved) }
        : this.defaultConfig;
    } catch {
      return this.defaultConfig;
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('lynx_config', JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  }

  reset(): void {
    this.config = { ...this.defaultConfig };
    this.saveConfig();
  }
}
