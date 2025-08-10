import type { Address } from 'viem';
import type {
	Chain,
	PossibleAddress,
	PartialMnemonic,
	PartialWithCandidates
} from './types';

import { wordlists } from 'bip39';
import {
	getPartialMnemonicWithMissingWords,
	getFullMnemonicFromCandidates,
	getEthWalletAddresses,
	getBtcWalletAddress
} from './helpers';

/**
 * Create a sparse array where missing words are undefined and partial words are
 * replaced arrays candidates that start with the partial word
 * @param partialMnemonic - A sparse array of words where the words can be
 * truncated to be interpreted as a partial word
 */
export function createPartialWithCandidates(
	partialMnemonic: PartialMnemonic
): PartialWithCandidates {
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
		`Generated candidates for ${
			partialWithCandidates.filter((w) => w === undefined).length
		} missing words, and ${
			partialWithCandidates.filter((w) => Array.isArray(w)).length
		} partially filled words`
	);

	return partialWithCandidates;
}

/**
 * A generator function that creates a limited number of combinations of the
 * candidates at a time to prevent memory overflow
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param repeatingWords - Whether to allow repeating words in the combinations
 * @param chunkSize - The number of combinations to create at a time
 */
export function* createCombinationsGenerator(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean = false,
	chunkSize: number = 1000
): Generator<string[][], void, unknown> {
	const missingPositions: number[] = [];
	const candidateLists: (string[] | undefined)[] = [];

	partialWithCandidates.forEach((word, index) => {
		if (typeof word === 'string') {
			return;
		} else if (Array.isArray(word)) {
			missingPositions.push(index);
			candidateLists.push(word);
		} else {
			missingPositions.push(index);
			candidateLists.push(undefined);
		}
	});

	const wordList = wordlists.english;
	let combinations: string[][] = [];

	function* permutationsGenerator(
		current: string[],
		depth: number
	): Generator<string[][], void, unknown> {
		if (depth === missingPositions.length) {
			combinations.push([...current]);

			if (combinations.length >= chunkSize) {
				yield combinations;
				combinations = [];
			}
			return;
		}

		const candidates = candidateLists[depth] || wordList;

		for (const word of candidates) {
			if (!repeatingWords) {
				const testMnemonic = getPartialMnemonicWithMissingWords(
					partialWithCandidates,
					current,
					depth
				);
				if (testMnemonic.includes(word)) {
					continue;
				}
			}
			current[depth] = word;
			yield* permutationsGenerator(current, depth + 1);
		}
	}

	yield* permutationsGenerator(new Array(missingPositions.length), 0);

	if (combinations.length > 0) {
		yield combinations;
	}
}

/**
 * Generates all possible addresses by using the partial with candidates and
 * combining it with the combinations of candidates. Not all permutations create
 * VALID mnemonic phrases, so this function finds all valid combinations and
 * returns them along with the addresses they create
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param combinationsOfCandidates - All the combinations of candidates
 */
export function createPossibleAddressesAndCombinations<C extends Chain>(
	partialWithCandidates: PartialWithCandidates,
	combinationsOfCandidates: string[][],
	chain: C
): {
	addressChunks: PossibleAddress<C>[];
	combinationChunks: string[][];
} {
	const addressChunks: PossibleAddress<C>[] = [];
	const combinationChunks: string[][] = [];

	for (const combination of combinationsOfCandidates) {
		try {
			const fullMnemonic = getFullMnemonicFromCandidates(
				partialWithCandidates,
				combination
			);
			const address =
				chain !== 'bitcoin'
					? getEthWalletAddresses(fullMnemonic)
					: getBtcWalletAddress(fullMnemonic);

			addressChunks.push(address as PossibleAddress<C>);
			combinationChunks.push(combination);
		} catch {
			continue;
		}
	}

	console.log(`Found ${addressChunks.length} possible valid addresses`);

	return {
		addressChunks,
		combinationChunks
	};
}
