interface InFlightReviewMark<TContext> {
  context: TContext;
  promise: Promise<boolean>;
  preserveDetails: boolean;
}

export class ReviewMarkCoordinator<TKey, TContext> {
  private readonly inFlight = new Map<
    TKey,
    InFlightReviewMark<TContext>[]
  >();

  run(
    key: TKey,
    context: TContext,
    preserveDetails: boolean,
    operation: () => Promise<boolean>
  ): Promise<boolean> {
    const queue = this.inFlight.get(key) ?? [];
    if (!preserveDetails) {
      for (const entry of queue) entry.preserveDetails = false;
    }
    const existing = queue.find((entry) =>
      Object.is(entry.context, context)
    );
    if (existing) {
      if (!preserveDetails) existing.preserveDetails = false;
      return existing.promise;
    }

    const entry: InFlightReviewMark<TContext> = {
      context,
      preserveDetails,
      promise: Promise.resolve(false),
    };
    const previous = queue.at(-1);
    const runOperation = (): Promise<boolean> => {
      try {
        return operation();
      } catch (error) {
        return Promise.reject(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    };
    const operationPromise = previous
      ? previous.promise.then(runOperation, runOperation)
      : runOperation();
    entry.promise = operationPromise.finally(() => {
      const currentQueue = this.inFlight.get(key);
      if (!currentQueue) return;
      const entryIndex = currentQueue.indexOf(entry);
      if (entryIndex !== -1) currentQueue.splice(entryIndex, 1);
      if (currentQueue.length === 0) {
        this.inFlight.delete(key);
      }
    });
    queue.push(entry);
    this.inFlight.set(key, queue);
    return entry.promise;
  }

  shouldPreserveDetails(key: TKey, context: TContext): boolean {
    return (
      this.inFlight
        .get(key)
        ?.find((entry) => Object.is(entry.context, context))
        ?.preserveDetails ?? false
    );
  }
}
