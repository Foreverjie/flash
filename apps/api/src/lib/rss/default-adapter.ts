/**
 * Default RSS Adapter
 * Handles standard RSS/Atom feeds
 */
import { BaseAdapter } from "./base-adapter.js"
import type { AdapterConfig } from "./types.js"

export class DefaultAdapter extends BaseAdapter {
  constructor(config: AdapterConfig = {}) {
    super("DefaultAdapter", config)
  }

  /**
   * Default adapter can handle any URL
   */
  canHandle(_url: string): boolean {
    return true
  }
}
