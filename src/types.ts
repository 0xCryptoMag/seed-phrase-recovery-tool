import type { Address } from 'viem';
import * as chains from 'viem/chains';

export type PartialMnemonic = (string | undefined)[];
export type PartialWithCandidates = (string | string[] | undefined)[];
export type Chain = keyof typeof chains | 'bitcoin';
export type PossibleAddress<C extends Chain> = C extends 'bitcoin'
	? { btc: string }
	: { eth: Address };

// prettier-ignore
export type RecoverArgs<C extends Chain> = {
	partialMnemonic: PartialMnemonic;
	repeatingWords?: boolean;
	chain: C;
} & ({
	publicKey: C extends 'bitcoin' ? string : Address;
	queryBalances?: false;
} | {
	publicKey?: C extends 'bitcoin' ? string : Address;
	queryBalances: true;
});
export type QueryResult<C extends Chain> = {
	balances: bigint[];
	loadedWalletAddresses: PossibleAddress<C>[];
	loadedWalletCombinations: string[][];
};
