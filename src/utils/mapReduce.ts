/** A per-shard error captured without aborting the overall run. */
export interface ShardError {
  index: number;
  error: unknown;
}

export interface MapReduceOptions<T, R, O> {
  shards: T[];
  mapFn: (shard: T, index: number) => Promise<R>;
  reduceFn: (results: Array<R | undefined>, errors: ShardError[]) => Promise<O> | O;
  concurrency: number;
}

export interface MapReduceResult<O> {
  output: O;
  errors: ShardError[];
}

/**
 * Runs `mapFn` over every shard with a bounded concurrency pool, preserves
 * result order, captures per-shard rejections without aborting other shards,
 * then calls `reduceFn` with the ordered results array (failed shards are
 * `undefined` at their index) and a list of captured errors.
 */
export async function mapReduce<T, R, O>(
  options: MapReduceOptions<T, R, O>,
): Promise<MapReduceResult<O>> {
  const { shards, mapFn, reduceFn, concurrency } = options;

  const results: Array<R | undefined> = new Array(shards.length).fill(undefined);
  const errors: ShardError[] = [];

  // Bounded pool: maintain at most `concurrency` in-flight promises.
  let nextIndex = 0;
  let inFlight = 0;

  await new Promise<void>((resolve, reject) => {
    function trySchedule(): void {
      while (inFlight < concurrency && nextIndex < shards.length) {
        const i = nextIndex++;
        inFlight++;

        mapFn(shards[i], i)
          .then((result) => {
            results[i] = result;
          })
          .catch((err: unknown) => {
            errors.push({ index: i, error: err });
          })
          .finally(() => {
            inFlight--;
            if (nextIndex < shards.length || inFlight > 0) {
              trySchedule();
            } else {
              resolve();
            }
          });
      }

      // All shards dispatched and nothing in flight — we're done.
      if (nextIndex >= shards.length && inFlight === 0) {
        resolve();
      }
    }

    // Edge case: empty shard list.
    if (shards.length === 0) {
      resolve();
      return;
    }

    trySchedule();
  });

  const output = await reduceFn(results, errors);
  return { output, errors };
}
