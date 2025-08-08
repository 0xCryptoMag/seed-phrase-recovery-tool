import type {
	PartialMnemonic,
	PartialWithCandidates,
	RecoverArgs,
	QueryResult,
	RecoveryResult
} from './types';

import { createPublicClient, http, getAddress, Address, fromBytes } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import * as chains from 'viem/chains';
import { payments, networks } from 'bitcoinjs-lib';
import { wordlists } from 'bip39';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';

export async function recover(args: RecoverArgs): Promise<RecoveryResult> {
	const { partialMnemonic, chain, repeatingWords = false } = args;

	// Generate combinations of words for missing positions
	const partialWithCandidates: PartialWithCandidates = [];

	for (let i = 0; i < partialMnemonic.length; i++) {
		const word = partialMnemonic[i];

		if (typeof word === 'string') {
			if (wordlists.english.includes(word)) {
				partialWithCandidates[i] = word;
			} else {
				const candidatesStartsWithWord = wordlists.english.filter((w) =>
					w.startsWith(word)
				);

				if (candidatesStartsWithWord.length === 0)
					partialWithCandidates[i] = undefined;
				if (candidatesStartsWithWord.length === 1)
					partialWithCandidates[i] = candidatesStartsWithWord[0];
				if (candidatesStartsWithWord.length > 1)
					partialWithCandidates[i] = candidatesStartsWithWord;
			}
		} else {
			partialWithCandidates[i] = undefined;
		}
	}

	console.log(
		`Starting recovery with ${
			partialMnemonic.filter((w) => typeof w !== 'string').length
		} missing words...`
	);

	const combinations = generateCombinations(
		partialWithCandidates,
		repeatingWords
	);
	console.log(`Generated ${combinations.length} possible combinations`);

	// Generate bitcoin and ethereum addresses for all combinations
	const possibleAddresses: { ethereum: Address; bitcoin: string }[] = [];
	const possibleCombinations: string[][] = [];

	for (const combination of combinations) {
		try {
			const fullMnemonic = createFullMnemonicFromCandidates(
				partialWithCandidates,
				combination
			);
			const address = generateWalletAddresses(fullMnemonic, chain);

			possibleAddresses.push(address);
			possibleCombinations.push(combination);
		} catch {
			continue;
		}
	}

	console.log(`Generated ${possibleAddresses.length} valid addresses`);

	return {
		possibleAddresses,
		possibleCombinations
	};
}

// Generate all possible combinations of words for missing positions
function generateCombinations(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean = false
): string[][] {
	const missingPositions: number[] = [];
	const candidateLists: (string[] | undefined)[] = [];

	// Find positions of missing words and get their candidate lists
	partialWithCandidates.forEach((word, index) => {
		if (typeof word === 'string') {
			// This position has a known word, skip it
			return;
		} else if (Array.isArray(word)) {
			// This position has specific candidates
			missingPositions.push(index);
			candidateLists.push(word);
		} else {
			// This position has undefined (all words are candidates)
			missingPositions.push(index);
			candidateLists.push(undefined);
		}
	});

	const combinations: string[][] = [];
	const wordList = wordlists.english;

	// Recursively generate all possible combinations for missing positions
	function generatePermutations(current: string[], depth: number) {
		if (depth === missingPositions.length) {
			combinations.push([...current]);
			return;
		}

		const candidates = candidateLists[depth] || wordList;

		for (const word of candidates) {
			// Skip if repeating words is not allowed and word is already used in the full mnemonic
			if (!repeatingWords) {
				const testMnemonic = createFullMnemonicWithMissingWords(
					partialWithCandidates,
					current,
					depth
				);
				if (testMnemonic.includes(word)) {
					continue;
				}
			}
			current[depth] = word;
			generatePermutations(current, depth + 1);
		}
	}

	generatePermutations(new Array(missingPositions.length), 0);
	return combinations;
}

// Helper function to create mnemonic with partial missing words (for validation)
function createFullMnemonicWithMissingWords(
	partialWithCandidates: PartialWithCandidates,
	missingWords: string[],
	wordsToUse: number
): string {
	let wordIndex = 0;
	return partialWithCandidates
		.map((word) => {
			if (typeof word === 'string') {
				return word;
			} else {
				return wordIndex < wordsToUse ? missingWords[wordIndex++] : '*';
			}
		})
		.join(' ');
}

// Create full mnemonic from candidates and missing words
function createFullMnemonicFromCandidates(
	partialWithCandidates: PartialWithCandidates,
	missingWords: string[]
): string {
	let wordIndex = 0;
	return partialWithCandidates
		.map((word) => {
			if (typeof word === 'string') {
				return word;
			} else {
				return missingWords[wordIndex++];
			}
		})
		.join(' ');
}

// Generate wallet addresses (Ethereum and Bitcoin) from mnemonic
function generateWalletAddresses(
	mnemonic: string,
	chain: keyof typeof chains | 'bitcoin'
): { ethereum: Address; bitcoin: string } {
	try {
		const ethAccount = mnemonicToAccount(mnemonic);

		const seed = mnemonicToSeedSync(mnemonic);
		const root = HDKey.fromMasterSeed(seed);

		const btcKey = root.derive("m/84'/0'/0'/0");
		if (!btcKey.privateKey || !btcKey.publicKey) {
			throw new Error('Failed to derive Bitcoin key');
		}

		const btcAddress = payments.p2wpkh({
			pubkey: Buffer.from(btcKey.publicKey),
			network: networks.bitcoin
		}).address;

		if (!btcAddress) {
			throw new Error('Failed to generate Bitcoin address');
		}

		return {
			ethereum: ethAccount.address,
			bitcoin: btcAddress
		};
	} catch (error) {
		throw new Error(`Invalid mnemonic: ${error}`);
	}
}

async function queryBalances(
	possibleAddresses: { ethereum: Address; bitcoin: string }[],
	possibleCombinations: string[][],
	chain: keyof typeof chains | 'bitcoin'
): Promise<QueryResult | undefined> {
	let loadedWalletIndex = -1;

	console.log('Checking balances...');
	const balances =
		chain !== 'bitcoin'
			? await checkEthAddresses(possibleAddresses)
			: await checkBitcoinAddresses(possibleAddresses);

	loadedWalletIndex = balances.findIndex((balance) => balance > 0n);

	if (loadedWalletIndex !== -1) {
		const recoveredWallet = possibleAddresses[loadedWalletIndex];
		const missingWords = possibleCombinations[loadedWalletIndex];
		const balance = balances[loadedWalletIndex];

		console.log('Found wallet with balance!');
		console.log('Missing words:', missingWords);
		console.log('Wallet address:', recoveredWallet);
		console.log('Balance:', balance.toString());

		return {
			balances,
			loadedWalletAddress: recoveredWallet,
			loadedWalletCombination: missingWords
		};
	} else {
		console.log('Could not find a wallet with a balance greater than 0');
	}
}

async function checkEthAddresses(addresses: { ethereum: Address }[]) {
	const balances: bigint[] = [];

	const publicClient = createPublicClient({
		chain: chains.mainnet,
		transport: http()
	});

	for (let i = 0; i < addresses.length; i++) {
		try {
			const balance = await publicClient.getBalance({
				address: addresses[i].ethereum
			});
			balances.push(balance);

			console.log(`Checked ${i + 1}/${addresses.length} addresses`);
			console.log(`Checked address: ${addresses[i].ethereum}`);
		} catch (error) {
			console.warn(`Failed to check balance for ${addresses[i]}:`, error);
			balances.push(0n);
		}
	}

	return balances;
}

async function checkBitcoinAddresses(addresses: { bitcoin: string }[]) {
	const balances: bigint[] = [];

	for (let i = 0; i < addresses.length; i++) {
		const res = await fetch(
			`https://blockstream.info/api/address/${addresses[i].bitcoin}`
		);
		if (!res.ok) throw new Error('Failed to fetch balance');
		const data: any = await res.json();
		balances.push(
			BigInt(data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum)
		);
	}

	return balances;
}

// Example usage
if (require.main === module) {
	import('dotenv/config').then(() => {
		const mnemonicString = process.env.MNEMONIC || '';
		const partialMnemonic: PartialMnemonic = mnemonicString
			.split(' ')
			.map((word) => (word === '*' ? undefined : word));
		const chain = (process.env.CHAIN || 'mainnet') as keyof typeof chains;
		const repeatingWords = process.env.REPEATING_WORDS === 'true';
		const checkBalances = process.env.CHECK_BALANCES === 'true';

		// prettier-ignore
		recover({
			partialMnemonic,
			chain,
			repeatingWords
		}).then((result) => {
			if (checkBalances) {
				queryBalances(
					result.possibleAddresses,
					result.possibleCombinations,
					chain
				);
			}
		}).catch(console.error);
	});
}
