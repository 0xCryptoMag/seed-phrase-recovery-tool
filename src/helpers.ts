import type { Address } from 'viem';
import type { PartialWithCandidates } from './types';

import { mnemonicToAccount } from 'viem/accounts';
import { HDKey } from '@scure/bip32';
import { mnemonicToSeedSync } from '@scure/bip39';
import { payments, networks } from 'bitcoinjs-lib';

/**
 * Helper function to create mnemonic with partial missing words (for validation)
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param missingWords - The words to use for the missing words
 * @param wordsToUse - The number of words to use for the missing words
 */
export function createPartialMnemonicWithMissingWords(
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
 * Create full mnemonic from a partial mnemonic and a list of combinations of
 * candidates
 * @param partialWithCandidates - The partial mnemonic with candidates
 * @param combinationsOfCandidates - The combinations of candidates
 */
export function createFullMnemonicFromCandidates(
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
 * Generate wallet addresses (Ethereum and Bitcoin) from mnemonic. Designed to
 * propogate errors and throw
 * @param mnemonic - The mnemonic to generate addresses from
 * @throws
 */
export function generateWalletAddresses(mnemonic: string): {
	ethereum: Address;
	bitcoin: string;
} {
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
