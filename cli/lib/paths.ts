import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
export const SITL_TOOL = path.resolve(PROJECT_ROOT, 'tools', 'sitl');
export const SITL_SETUP_SCRIPT = path.join(SITL_TOOL, 'scripts', 'setup-ardupilot.sh');
export const SITL_INDEX = path.join(SITL_TOOL, 'src', 'index.ts');
export const ENV_FILE = path.join(PROJECT_ROOT, '.env.local');
export const ENV_EXAMPLE = path.join(PROJECT_ROOT, '.env.example');
export const NODE_MODULES = path.join(PROJECT_ROOT, 'node_modules');
export const SITL_NODE_MODULES = path.join(SITL_TOOL, 'node_modules');
export const ARDUPILOT_DEFAULT = path.join(os.homedir(), '.ardupilot');
export const PACKAGE_JSON = path.join(PROJECT_ROOT, 'package.json');

// Tool deploy directories (all env files inside are gitignored via .env pattern)
export const MQTT_BRIDGE_DEPLOY = path.resolve(PROJECT_ROOT, 'tools', 'mqtt-bridge', 'deploy');
export const MQTT_BRIDGE_ENV = path.join(MQTT_BRIDGE_DEPLOY, '.env');
export const MQTT_BRIDGE_ENV_EXAMPLE = path.join(MQTT_BRIDGE_DEPLOY, '.env.example');

export const VIDEO_RELAY_DEPLOY = path.resolve(PROJECT_ROOT, 'tools', 'video-relay', 'deploy');
export const VIDEO_RELAY_ENV = path.join(VIDEO_RELAY_DEPLOY, '.env');
export const VIDEO_RELAY_ENV_EXAMPLE = path.join(VIDEO_RELAY_DEPLOY, '.env.example');
