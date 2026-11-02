import { ApiError } from '#shared/utils/ApiError.js';

// Usage in routes: validate({ body: createItemSchema, query: listItemsSchema })
// Clean, parsed values are put on req.valid.body / req.valid.query / req.valid.params.
// (Express 5 makes req.query read-only, so we never overwrite it.)
export function validate(schemas) {
  return (req, res, next) => {
    const valid = {};
    const errors = [];

    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          errors.push({ in: part, field: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (errors.length) return next(ApiError.badRequest('Validation failed', errors));

    req.valid = valid;
    next();
  };
}
