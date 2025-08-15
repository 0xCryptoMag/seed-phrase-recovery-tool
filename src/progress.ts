import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type ProgressState = {
	lastProcessedIndex: bigint;
	totalCombinations: bigint;
	startTime: string;
	lastUpdateTime: string;
	chunksProcessed: number;
	status: 'running' | 'completed' | 'paused' | 'error';
	error?: string;
};

export class ProgressTracker {
	private progressFilePath: string;
	private state: ProgressState;

	constructor(progressFilePath: string = 'recovery-progress.json') {
		this.progressFilePath = progressFilePath;
		this.state = this.loadProgress();
	}

	private loadProgress(): ProgressState {
		if (existsSync(this.progressFilePath)) {
			try {
				const data = readFileSync(this.progressFilePath, 'utf8');
				const parsed = JSON.parse(data);

				return {
					...parsed,
					lastProcessedIndex: BigInt(parsed.lastProcessedIndex),
					totalCombinations: BigInt(parsed.totalCombinations)
				};
			} catch (error) {
				console.warn('Failed to load progress file, starting fresh');
			}
		}

		return {
			lastProcessedIndex: 0n,
			totalCombinations: 0n,
			startTime: new Date().toISOString(),
			lastUpdateTime: new Date().toISOString(),
			chunksProcessed: 0,
			status: 'running'
		};
	}

	saveProgress(): void {
		try {
			const state = {
				...this.state,
				lastProcessedIndex: this.state.lastProcessedIndex.toString(),
				totalCombinations: this.state.totalCombinations.toString()
			};
			writeFileSync(this.progressFilePath, JSON.stringify(state, null, 2));
		} catch (error) {
			console.error('Failed to save progress:', error);
		}
	}

	updateProgress(processedIndex: bigint, chunksProcessed: number = 1): void {
		this.state.lastProcessedIndex = processedIndex;
		this.state.chunksProcessed += chunksProcessed;
		this.state.lastUpdateTime = new Date().toISOString();
		this.saveProgress();
	}

	setTotalCombinations(total: bigint): void {
		this.state.totalCombinations = total;
		this.saveProgress();
	}

	setStatus(status: ProgressState['status'], error?: string): void {
		this.state.status = status;
		if (error) this.state.error = error;
		this.saveProgress();
	}

	getProgress(): ProgressState {
		return { ...this.state };
	}

	getProgressPercentage(): number {
		if (this.state.totalCombinations === 0n) return 0;
		return Number(
			(this.state.lastProcessedIndex * 100n) / this.state.totalCombinations
		);
	}

	getEstimatedTimeRemaining(chunkSize: number): string {
		if (this.state.chunksProcessed === 0) return 'Unknown';

		const elapsedMs =
			new Date().getTime() - new Date(this.state.startTime).getTime();
		const msPerChunk = elapsedMs / this.state.chunksProcessed;
		const remainingChunks = Number(
			(this.state.totalCombinations - this.state.lastProcessedIndex) /
				BigInt(chunkSize)
		);
		const remainingMs = remainingChunks * msPerChunk;

		const hours = Math.floor(remainingMs / (1000 * 60 * 60));
		const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours}h ${minutes}m`;
		}
		return `${minutes}m`;
	}

	reset(): void {
		this.state = {
			lastProcessedIndex: 0n,
			totalCombinations: 0n,
			startTime: new Date().toISOString(),
			lastUpdateTime: new Date().toISOString(),
			chunksProcessed: 0,
			status: 'running'
		};
		this.saveProgress();
	}
}
