import type { Model, FilterQuery, RootFilterQuery } from 'mongoose';
import { getPagination, buildPaginatedResult, type PaginatedResult } from './pagination.js';

export interface PaginateOptions {
  sort?: Record<string, 1 | -1>;
  select?: string;
  populate?: { path: string; select: string }[];
}

/** Paginated find + count in the standard envelope; the return cast covers Mongoose's populated types. */
export const findPaginated = async <TDoc, TResult = TDoc>(
  model: Model<TDoc>,
  filter: RootFilterQuery<TDoc>,
  query: Record<string, unknown> = {},
  options: PaginateOptions = {}
): Promise<PaginatedResult<TResult>> => {
  const pagination = getPagination(query);

  const itemsQuery = model.find(filter as FilterQuery<TDoc>);
  if (options.select) itemsQuery.select(options.select);
  if (options.populate?.length) itemsQuery.populate(options.populate);

  // Both run in parallel: the count does not depend on the page of documents.
  const [items, total] = await Promise.all([
    itemsQuery.sort(options.sort ?? { created_at: -1 }).skip(pagination.skip).limit(pagination.limit).exec(),
    model.countDocuments(filter as FilterQuery<TDoc>).exec()
  ]);

  return buildPaginatedResult<TResult>(items as unknown as TResult[], total, pagination);
};

