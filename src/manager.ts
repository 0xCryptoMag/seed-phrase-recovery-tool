import type { Chain, PartialWithCandidates, PossibleAddress } from './types';

import { join } from 'path';
import { Worker } from 'worker_threads';
import { createCombinationsGenerator } from './create';
import { ProgressTracker } from './progress';
import type { QueryResult } from './query';

// Define the missing types that are used in the worker communication
type WorkerResult = {
	chunkId: number;
	type: 'chunk_complete' | 'match_found' | 'loaded_wallet_found' | 'error';
	addresses: PossibleAddress<Chain>[];
	combinations: string[][];
	queryResult?: QueryResult<Chain>;
	startIndex: bigint;
	endIndex: bigint;
	error?: string;
};

type WorkerMessage = {
	type: 'process_chunk';
	chunkId: number;
	partialWithCandidates: PartialWithCandidates;
	combinationsChunk: string[][];
	chain: Chain;
	publicKey?: string;
	queryBalances: boolean;
	startIndex: bigint;
	totalCombinations: bigint;
};

export type WorkerManagerOptions = {
	numWorkers: number;
	chunkSize: bigint;
	partialWithCandidates: PartialWithCandidates;
	repeatingWords: boolean;
	chain: Chain;
	publicKey?: string;
	queryBalances: boolean;
	totalCombinations: bigint;
	resumeFromIndex?: bigint;
};

export type WorkerTask = {
	chunkId: number;
	combinations: string[][];
	startIndex: bigint;
	worker: Worker;
};

export class WorkerManager {
	private workers: Worker[] = [];
	private taskQueue: WorkerTask[] = [];
	private activeTasks = new Map<number, WorkerTask>();
	private results: {
		addresses: PossibleAddress<Chain>[];
		combinations: string[][];
		queryResult?: QueryResult<Chain>;
	} = { addresses: [], combinations: [] };

	private progressTracker: ProgressTracker;
	private options: WorkerManagerOptions;
	private isRunning = false;
	private generator: ReturnType<typeof createCombinationsGenerator>;
	private isGeneratorExhausted = false;

	constructor(options: WorkerManagerOptions) {
		this.options = options;
		this.progressTracker = new ProgressTracker();
		this.progressTracker.setTotalCombinations(options.totalCombinations);

		if (options.resumeFromIndex) {
			this.progressTracker.updateProgress(options.resumeFromIndex, 0);
		}

		this.generator = createCombinationsGenerator(
			options.partialWithCandidates,
			options.repeatingWords
		);

		if (options.resumeFromIndex) {
			// Keep calling next to skip combinations in manageable chunks
			let remainingToSkip = options.resumeFromIndex;

			while (remainingToSkip >= options.chunkSize) {
				this.generator.next(options.chunkSize);
				remainingToSkip -= options.chunkSize;
			}

			if (remainingToSkip > 0n) {
				this.generator.next(remainingToSkip);
			}
		} else {
			this.generator.next(options.chunkSize);
		}
	}

	async start(): Promise<{
		addresses: PossibleAddress<Chain>[];
		combinations: string[][];
		queryResult?: QueryResult<Chain>;
	}> {
		if (this.isRunning) {
			throw new Error('Worker manager is already running');
		}

		this.isRunning = true;
		this.progressTracker.setStatus('running');

		try {
			this.initializeWorkers();

			await this.processAllChunks();

			this.progressTracker.setStatus('completed');
			return this.results;
		} catch (error) {
			this.progressTracker.setStatus(
				'error',
				error instanceof Error ? error.message : String(error)
			);
			throw error;
		} finally {
			await this.cleanup();
			this.isRunning = false;
		}
	}

	private initializeWorkers(): void {
		for (let i = 0; i < this.options.numWorkers; i++) {
			const worker = new Worker(join(__dirname, 'worker.js'));

			worker.on('error', (error) => {
				console.error(`Worker ${i} error:`, error);
			});

			worker.on('exit', (code) => {
				if (code !== 0) {
					console.error(`Worker ${i} exited with code ${code}`);
				}
			});

			this.workers.push(worker);
		}
	}

	private async processAllChunks(): Promise<void> {
		let currentIndex = this.options.resumeFromIndex || 0n;
		let chunkId = 0;

		return new Promise((resolve, reject) => {
			const processNextChunk = () => {
				const availableWorker = this.workers.find(
					(worker) =>
						!Array.from(this.activeTasks.values()).some(
							(task) => task.worker === worker
						)
				);

				if (!availableWorker) {
					setTimeout(processNextChunk, 100);
					return;
				}

				if (!this.isGeneratorExhausted) {
					const chunk = this.generator.next();

					if (chunk.done) {
						this.isGeneratorExhausted = true;
						this.waitForCompletion(resolve);
						return;
					} else {
						const combinations = chunk.value;
						const startIndex = currentIndex;
						const endIndex = startIndex + BigInt(combinations.length);

						this.processChunkWithWorker(
							availableWorker,
							chunkId,
							combinations,
							startIndex,
							endIndex
						);
						chunkId++;
						currentIndex = endIndex;

						setImmediate(processNextChunk);
						return;
					}
				}
			};

			processNextChunk();
		});
	}

	private waitForCompletion(resolve: () => void): void {
		if (this.activeTasks.size === 0) {
			resolve();
		} else {
			setTimeout(() => this.waitForCompletion(resolve), 100);
		}
	}

	private processChunkWithWorker(
		worker: Worker,
		chunkId: number,
		combinations: string[][],
		startIndex: bigint,
		endIndex: bigint
	): void {
		const task: WorkerTask = {
			chunkId,
			combinations,
			startIndex,
			worker
		};

		this.activeTasks.set(chunkId, task);

		worker.once('message', (result: WorkerResult) => {
			this.handleWorkerResult(result, task);
		});

		worker.postMessage({
			type: 'process_chunk',
			chunkId,
			partialWithCandidates: this.options.partialWithCandidates,
			combinationsChunk: combinations,
			chain: this.options.chain,
			publicKey: this.options.publicKey,
			queryBalances: this.options.queryBalances,
			startIndex,
			totalCombinations: this.options.totalCombinations
		} as WorkerMessage);
	}

	private handleWorkerResult(result: WorkerResult, task: WorkerTask): void {
		this.activeTasks.delete(task.chunkId);

		// Update progress
		this.progressTracker.updateProgress(result.endIndex, 1);

		// Log progress
		const progress = this.progressTracker.getProgressPercentage();
		const eta = this.progressTracker.getEstimatedTimeRemaining(
			Number(this.options.chunkSize)
		);
		console.log(`Progress: ${progress.toFixed(2)}% - ETA: ${eta}`);

		if (result.type === 'match_found') {
			console.log('🎯 Match found!');
			this.results = {
				addresses: result.addresses,
				combinations: result.combinations
			};
			// Stop processing and terminate all workers
			this.isRunning = false;
			this.cleanup();
			return;
		}

		if (result.type === 'loaded_wallet_found') {
			console.log('💰 Loaded wallet found!');
			this.results = {
				addresses: result.addresses,
				combinations: result.combinations,
				queryResult: result.queryResult
			};
			// Stop processing and terminate all workers
			this.isRunning = false;
			this.cleanup();
			return;
		}

		if (result.type === 'error') {
			console.error(`Chunk ${task.chunkId} error:`, result.error);
			// Continue processing other chunks
		}

		// If we need to accumulate results (no early termination)
		if (!this.options.publicKey && !this.options.queryBalances) {
			this.results.addresses.push(...result.addresses);
			this.results.combinations.push(...result.combinations);
		}
	}

	private async cleanup(): Promise<void> {
		// Terminate all workers
		const terminationPromises = this.workers.map((worker) =>
			worker.terminate()
		);
		await Promise.all(terminationPromises);
		this.workers = [];
		this.activeTasks.clear();
	}

	stop(): void {
		this.isRunning = false;
		this.progressTracker.setStatus('paused');
	}

	async gracefulShutdown(): Promise<void> {
		console.log('🛑 Gracefully shutting down worker manager...');
		this.isRunning = false;
		this.progressTracker.setStatus('paused');

		// Wait for active tasks to complete
		while (this.activeTasks.size > 0) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		await this.cleanup();
		console.log('✅ Worker manager shutdown complete');
	}

	getProgress(): any {
		return this.progressTracker.getProgress();
	}

	getActiveTaskCount(): number {
		return this.activeTasks.size;
	}

	getQueueLength(): number {
		return this.taskQueue.length;
	}
}
