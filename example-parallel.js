#!/usr/bin/env node

// Example of using the parallel recovery system
const { spawn } = require('child_process');

console.log('🚀 Example: Parallel Seed Phrase Recovery');
console.log('==========================================\n');

// Example 1: Bitcoin recovery with 3 missing words
console.log('Example 1: Bitcoin Recovery (3 missing words)');
console.log(
	'Command: npm run parallel -- --mnemonic "abandon abandon abandon * abandon abandon abandon * abandon abandon abandon * abandon" --chain bitcoin --query-balances --workers 4\n'
);

// Example 2: Ethereum recovery with known address
console.log('Example 2: Ethereum Recovery with Known Address');
console.log(
	'Command: npm run parallel -- --mnemonic "abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon" --chain mainnet --public-key 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 --workers 8\n'
);

// Example 3: Resume interrupted recovery
console.log('Example 3: Resume Interrupted Recovery');
console.log(
	'Command: npm run parallel -- --mnemonic "..." --chain bitcoin --resume --workers 6\n'
);

console.log('To run any of these examples:');
console.log('1. Build the project: npm run build');
console.log('2. Run the command above');
console.log('3. Monitor progress in recovery-progress.json');
console.log('4. Use Ctrl+C to pause, then --resume to continue\n');

console.log('📊 Progress tracking:');
console.log('- Progress is automatically saved to recovery-progress.json');
console.log('- Use --resume flag to continue from where you left off');
console.log('- Progress includes ETA and completion percentage\n');

console.log('⚡ Performance tips:');
console.log('- Adjust --workers based on your CPU cores');
console.log('- Use --chunk-size to balance memory vs. efficiency');
console.log('- Enable early termination with --public-key when possible');
console.log('- Monitor memory usage and adjust --max-old-space-size if needed');
