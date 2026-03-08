// ========================================
// Data Adapter 路由層
// 依 DATA_BACKEND 環境變數選擇 adapter
// ========================================

const backend = process.env.DATA_BACKEND || 'sheets';

let adapter;

if (backend === 'supabase') {
  adapter = require('./adapters/supabase-adapter');
} else {
  adapter = require('./adapters/sheets-adapter');
}

console.log(`[data-adapter] Using backend: ${backend}`);

module.exports = adapter;
