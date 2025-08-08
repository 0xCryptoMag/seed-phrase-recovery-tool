import type { Address } from 'viem';
import * as chains from 'viem/chains';

export type PartialMnemonic = (string | undefined)[];
export type PartialWithCandidates = (string | string[] | undefined)[];

// prettier-ignore
export type RecoverArgs = {
	partialMnemonic: PartialMnemonic;
	repeatingWords?: boolean;
	publicKey?: Address;
} & ({
	queryBalances?: false;
	chain?: keyof typeof chains | 'bitcoin';
} | {
	queryBalances: true;
	chain: keyof typeof chains | 'bitcoin';
})

export type QueryResult = {
	balances: bigint[];
	loadedWalletAddresses: { ethereum: Address; bitcoin: string }[];
	loadedWalletCombinations: string[][];
};
export type RecoveryResult = {
	possibleAddresses: { ethereum: Address; bitcoin: string }[];
	possibleCombinations: string[][];
	queryResult?: QueryResult;
};
