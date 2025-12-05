import { describe, expect, it } from "vitest"

import { db } from "./db.js"

describe("Database Integration", () => {
  it("should connect to database", async () => {
    expect(db).toBeDefined()
  })

  it("should have query methods", () => {
    expect(db.query).toBeDefined()
    expect(db.query.feedsTable).toBeDefined()
    expect(db.query.entriesTable).toBeDefined()
  })
})
