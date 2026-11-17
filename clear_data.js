#!/usr/bin/env node
'use strict';

/**
 * Convenience entrypoint: delegates to kardex-node/scripts/clean-all-data.js
 *
 * Usage:
 *   node clear_data.js                 (Interactive inventory reset)
 *   node clear_data.js --help          (Show help & all options)
 *   node clear_data.js --all --yes     (Non-interactive full wipe)
 */

require('./kardex-node/scripts/clean-all-data.js');
