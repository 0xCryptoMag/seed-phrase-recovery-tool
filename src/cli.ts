#!/usr/bin/env node

import { recover } from './recover';
import { ProgressTracker } from './progress';
import { getUpperBound } from './helpers';
import { createPartialWithCandidates } from './create';

interface CLIArgs {
	mnemonic: string;
	chain: string;
	publicKey?: string;
	queryBalances: boolean;
	repeatingWords: boolean;
	numWorkers?: number;
	chunkSize?: number;
	resume?: boolean;
}

function parseArgs(): CLIArgs {
	const args = process.argv.slice(2);
	const parsed: Partial<CLIArgs> = {};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case '--mnemonic':
				parsed.mnemonic = args[++i];
				break;
			case '--chain':
				parsed.chain = args[++i];
				break;
			case '--public-key':
				parsed.publicKey = args[++i];
				break;
			case '--query-balances':
				parsed.queryBalances = true;
				break;
			case '--repeating-words':
				parsed.repeatingWords = true;
				break;
			case '--workers':
				parsed.numWorkers = parseInt(args[++i]);
				break;
			case '--chunk-size':
				parsed.chunkSize = parseInt(args[++i]);
				break;
			case '--resume':
				parsed.resume = true;
				break;
			case '--help':
				showHelp();
				process.exit(0);
			default:
				console.error(`Unknown argument: ${args[i]}`);
				showHelp();
				process.exit(1);
		}
	}

	if (!parsed.mnemonic || !parsed.chain) {
		console.error('Missing required arguments');
		showHelp();
		process.exit(1);
	}

	return {
		mnemonic: parsed.mnemonic,
		chain: parsed.chain,
		publicKey: parsed.publicKey,
		queryBalances: parsed.queryBalances || false,
		repeatingWords: parsed.repeatingWords || false,
		numWorkers: parsed.numWorkers || 4,
		chunkSize: parsed.chunkSize || 1000,
		resume: parsed.resume || false
	};
}

function showHelp(): void {
	console.log(`
Seed Phrase Recovery Tool - Parallel Version

Usage: npm run start -- [options]

Required Options:
  --mnemonic <words>     Partial mnemonic with * for missing words
  --chain <chain>        Blockchain to check (mainnet, bitcoin, etc.)

Optional Options:
  --public-key <addr>    Address to match against
  --query-balances       Query blockchain for balances
  --repeating-words      Allow repeating words in combinations
  --workers <num>        Number of worker threads (default: 4)
  --chunk-size <size>    Combinations per chunk (default: 1000)
  --resume               Resume from previous run
  --help                 Show this help

Examples:
  npm run start -- --mnemonic "abandon abandon abandon * abandon abandon abandon * abandon abandon abandon * abandon" --chain bitcoin --query-balances
  
  npm run start -- --mnemonic "abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon * abandon" --chain mainnet --public-key 0x1234... --workers 8
`);
}

async function main(): Promise<void> {
	try {
		const args = parseArgs();

		console.log('🚀 Starting parallel seed phrase recovery...');
		console.log(`📝 Mnemonic: ${args.mnemonic}`);
		console.log(`⛓️  Chain: ${args.chain}`);
		console.log(`🔑 Public Key: ${args.publicKey || 'None'}`);
		console.log(`💰 Query Balances: ${args.queryBalances}`);
		console.log(`🔄 Repeating Words: ${args.repeatingWords}`);
		console.log(`👥 Workers: ${args.numWorkers}`);
		console.log(`📦 Chunk Size: ${args.chunkSize}`);

		// Parse mnemonic
		const partialMnemonic = args.mnemonic
			.split(' ')
			.map((word) => (word === '*' ? undefined : word));

		if (partialMnemonic.length < 12) {
			throw new Error('Mnemonic must be at least 12 words');
		}

		// Check for resume
		if (args.resume) {
			const progressTracker = new ProgressTracker();
			const progress = progressTracker.getProgress();
			if (progress.status === 'running' || progress.status === 'paused') {
				console.log(
					`🔄 Resuming from previous run at ${progress.lastProcessedIndex.toString()} combinations`
				);
			} else {
				console.log('ℹ️  No previous run to resume from, starting fresh');
			}
		}

		// Calculate total combinations
		const partialWithCandidates = createPartialWithCandidates(partialMnemonic);
		const totalCombinations = getUpperBound(
			partialWithCandidates,
			args.repeatingWords
		);
		console.log(
			`🔢 Total possible combinations: ${totalCombinations.toString()}`
		);

		// Start recovery
		const result = await recover({
			partialMnemonic,
			repeatingWords: args.repeatingWords,
			publicKey: args.publicKey as any,
			queryBalances: args.queryBalances,
			chain: args.chain as any
		});

		console.log('✅ Recovery completed!');
		console.log('📊 Results:', result);
	} catch (error) {
		console.error('❌ Recovery failed:', error);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}
