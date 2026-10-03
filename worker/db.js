export function database(env) {
  if (!env.DB) throw new Error('Database binding is unavailable');
  return {
    statement(sql, ...args) { return env.DB.prepare(sql).bind(...args); },
    async rows(sql, ...args) { return (await env.DB.prepare(sql).bind(...args).all()).results; },
    batch(statements) { return env.DB.batch(statements); },
  };
}
