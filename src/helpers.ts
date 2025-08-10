import type { Address } from 'viem';
import type { PartialWithCandidates } from './types';

import { mnemonicToAccount } from 'viem/accounts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { payments, networks } from 'bitcoinjs-lib';
import { wordlists } from 'bip39';

/**
 * Helper function to create mnemonic with partial missing words (for validation)
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param missingWords - The words to use for the missing words
 * @param wordsToUse - The number of words to use for the missing words
 */
export function getPartialMnemonicWithMissingWords(
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

/**
 * Get the upper bound of the number of possible combinations
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param repeatingWords - Whether to allow repeating words
 */
export function getUpperBound(
	partialWithCandidates: PartialWithCandidates,
	repeatingWords: boolean
): bigint {
	const numberMissing = partialWithCandidates.filter(
		(w) => w === undefined
	).length;
	const partials = partialWithCandidates.filter((w) => Array.isArray(w));
	// Don't include partial length in subtraction, because the're candidates
	// are nowhere near 2048
	const loweredAllWords = 2048 - (partialWithCandidates.length - numberMissing);

	if (repeatingWords) {
		return (
			// 2048 ^ number missing *
			2048n ** BigInt(numberMissing) *
			// product of all partial words possible candidates, i.e
			// 2 partials where 1 has 2 candidates and the other 3, returns 6
			BigInt(partials.reduce((acc, curr) => acc * curr.length, 1))
		);
	} else {
		return (
			// product of all partial words possible candidates, i.e
			// 2 partials where 1 has 2 candidates and the other 3, returns 6 *
			BigInt(partials.reduce((acc, curr) => acc * curr.length, 1)) *
			// (2048 - all used words (including partials)) *
			// (2048 - all used words (including partials) - 1) *
			// (2048 - all used words (including partials) - 2) * etc
			new Array(numberMissing)
				.fill(0)
				.reduce((acc, _, i) => acc * BigInt(loweredAllWords - i), 1n)
		);
	}
}

/**
 * Create full mnemonic from a partial mnemonic and a list of combinations of
 * candidates
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param combinationsOfCandidates - The combinations of candidates
 */
export function getFullMnemonicFromCandidates(
	partialWithCandidates: PartialWithCandidates,
	combinationsOfCandidates: string[]
): string {
	let wordIndex = 0;
	return partialWithCandidates
		.map((word) => {
			if (typeof word === 'string') {
				return word;
			} else {
				return combinationsOfCandidates[wordIndex++];
			}
		})
		.join(' ');
}

/**
 * Generate Bitcoin wallet address from mnemonic. Designed to propogate errors
 * and throw
 * @param mnemonic - The mnemonic to generate addresses from
 * @throws
 */
export function getBtcWalletAddress(mnemonic: string): { btc: string } {
	try {
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

		return { btc: btcAddress };
	} catch (error) {
		throw new Error(`Failed to generate Bitcoin address: ${error}`);
	}
}

/**
 * Generate Ethereum wallet address from mnemonic. Designed to propogate errors
 * and throw
 * @param mnemonic - The mnemonic to generate addresses from
 * @throws
 */
export function getEthWalletAddresses(mnemonic: string): { eth: Address } {
	try {
		const ethAccount = mnemonicToAccount(mnemonic);

		return { eth: ethAccount.address };
	} catch (error) {
		throw new Error(`Invalid mnemonic: ${error}`);
	}
}
