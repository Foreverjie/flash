import type { PostgresJsDatabase } from "drizzle-orm/postgres-js"

import type * as schema from "./schemas"

export type DB = PostgresJsDatabase<typeof schema>
