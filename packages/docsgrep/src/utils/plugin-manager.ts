/**
 * PluginManager - Handles discovery and loading of docsgrep plugins
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from './logger.js';
import { 
  type DocsgrepPlugin, 
  type PluginMetadata, 
  type PluginToolDefinition, 
  type PluginToolHandler 
} from '../types/plugins.js';

export class PluginManager {
  private static plugins: Map<string, DocsgrepPlugin> = new Map();
  private static toolHandlers: Map<string, PluginToolHandler> = new Map();
  private static toolDefinitions: PluginToolDefinition[] = [];

  /**
   * Discover and load all plugins from local node_modules or specified paths
   */
  static async discoverPlugins(searchDir: string = process.cwd()): Promise<void> {
    logger.info("Discovering plugins...", { searchDir });
    
    // 1. Check for config file
    const configPath = path.join(searchDir, 'docsgrep.config.json');
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      if (config.plugins && Array.isArray(config.plugins)) {
        for (const pluginSpec of config.plugins) {
          if (typeof pluginSpec === 'string') {
            // It's a path or package name
            if (pluginSpec.startsWith('.') || pluginSpec.startsWith('/')) {
              await this.loadPlugin(path.resolve(searchDir, pluginSpec));
            } else {
              // It's a package name in node_modules
              await this.loadPlugin(path.join(searchDir, 'node_modules', pluginSpec));
            }
          }
        }
      }
    } catch (e) {
      // Config file not found or invalid, continue with auto-discovery
    }

    // 2. Auto-discovery in node_modules
    const nodeModulesPath = path.join(searchDir, 'node_modules');
    
    try {
      await fs.access(nodeModulesPath);
    } catch (e) {
      logger.debug("No node_modules found for plugin discovery", { searchDir });
      return;
    }

    const dirs = await fs.readdir(nodeModulesPath);
    const pluginDirs = dirs.filter(d => d.startsWith('docsgrep-plugin-') || d.startsWith('@docsgrep/plugin-'));

    for (const dir of pluginDirs) {
      const pluginPath = path.join(nodeModulesPath, dir);
      await this.loadPlugin(pluginPath);
    }
  }

  /**
   * Load a specific plugin from a path
   */
  static async loadPlugin(pluginPath: string): Promise<void> {
    try {
      const packageJsonPath = path.join(pluginPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      const mainFile = packageJson.main || 'index.js';
      const entryPoint = pathToFileURL(path.join(pluginPath, mainFile)).href;
      
      logger.info(`Loading plugin: ${packageJson.name}`, { path: entryPoint });
      
      const module = await import(entryPoint);
      const plugin: DocsgrepPlugin = module.default || module;

      if (!plugin.name || !plugin.tools) {
        throw new Error(`Invalid plugin structure in ${packageJson.name}`);
      }

      this.plugins.set(plugin.name, plugin);
      
      // Register tools
      for (const def of plugin.tools.definitions) {
        this.toolDefinitions.push(def);
        const handler = plugin.tools.handlers[def.name];
        if (handler) {
          this.toolHandlers.set(def.name, handler);
        }
      }

      if (plugin.onLoad) {
        await plugin.onLoad();
      }

      logger.info(`Successfully loaded plugin: ${plugin.name} v${plugin.version}`);
    } catch (error: any) {
      logger.error(`Failed to load plugin at ${pluginPath}: ${error.message}`);
    }
  }

  static getRegisteredToolDefinitions(): PluginToolDefinition[] {
    return this.toolDefinitions;
  }

  static getHandler(toolName: string): PluginToolHandler | undefined {
    return this.toolHandlers.get(toolName);
  }

  static getLoadedPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }
}
