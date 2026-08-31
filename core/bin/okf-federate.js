#!/usr/bin/env node
import { enforceFloor } from "./floor.js"

enforceFloor()
await import("../lib/cli/okf-federate.ts")
