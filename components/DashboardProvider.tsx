"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  ParsedFile,
  SchemaProfile,
  SchemaOverrides,
  EntitySet,
  FinancialSummary,
  MediaProduction,
} from "@/lib/types";
import { parseSpreadsheet } from "@/lib/parseFile";
import { inferSchemaClient } from "@/lib/inferSchemaClient";
import { heuristicSchema } from "@/lib/profile";
import { mergeSources } from "@/lib/mergeSources";
import { detectEntities } from "@/lib/entities";
import { deriveFinancials } from "@/lib/deriveFinancials";
import { deriveMediaProduction } from "@/lib/deriveMediaProduction";
import { parseProPayload, toProPayloadCsv } from "@/lib/fromProPayload";
import { FINANCIALS_ENABLED } from "@/lib/features";
import { makeSampleData } from "@/lib/sampleData";

export type Phase = "idle" | "parsing" | "inferring" | "review" | "ready" | "error" | "waiting";

interface State {
  phase: Phase;
  parsed?: ParsedFile;
  entities?: EntitySet;
  schema?: SchemaProfile;
  overrides: SchemaOverrides;
  usedFallback: boolean;
  inferenceNote?: string;
  error?: string;
  locationFilter: string;
  activeTab: string;
  /** True while the AI schema is being refined in the background (data already shown). */
  schemaRefining: boolean;
  /** Gross-profit data from the fullnew export — loaded in the background, undefined until ready. */
  financials?: FinancialSummary;
  /** Media-production status from the new-vals export — loaded in the background, undefined until ready. */
  media?: MediaProduction;
}

type Action =
  | { type: "PARSING" }
  | { type: "WAITING" }
  | { type: "INFERRING"; parsed: ParsedFile; entities: EntitySet }
  | { type: "REVIEW"; schema: SchemaProfile; usedFallback: boolean; note?: string }
  | { type: "READY"; overrides: SchemaOverrides }
  | { type: "READY_WITH_SCHEMA"; schema: SchemaProfile; usedFallback: boolean; note?: string; overrides: SchemaOverrides; refining?: boolean }
  | { type: "UPGRADE_SCHEMA"; schema: SchemaProfile; usedFallback: boolean; note?: string; overrides: SchemaOverrides }
  | { type: "ERROR"; error: string }
  | { type: "SET_LOCATION"; location: string }
  | { type: "SET_TAB"; tab: string }
  | { type: "SET_FINANCIALS"; financials: FinancialSummary }
  | { type: "SET_MEDIA"; media: MediaProduction }
  | { type: "BACK_TO_REVIEW" }
  | { type: "RESET" };

const initialState: State = {
  phase: "idle",
  overrides: { vetoedColumns: [] },
  usedFallback: false,
  locationFilter: "ALL",
  activeTab: "",
  schemaRefining: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PARSING":
      return { ...initialState, phase: "parsing" };
    case "WAITING":
      // Production idle state: loaded, bridge installed, awaiting a PRO push.
      return { ...initialState, phase: "waiting" };
    case "INFERRING":
      return { ...state, phase: "inferring", parsed: action.parsed, entities: action.entities };
    case "REVIEW":
      return {
        ...state,
        phase: "review",
        schema: action.schema,
        usedFallback: action.usedFallback,
        inferenceNote: action.note,
        overrides: { vetoedColumns: [] },
      };
    case "READY":
      // Reset the location filter: the kept columns may have changed in review,
      // so a stale selection could otherwise filter on a now-vetoed column.
      return { ...state, phase: "ready", overrides: action.overrides, locationFilter: "ALL", activeTab: "" };
    case "READY_WITH_SCHEMA":
      // Auto-load path: infer + confirm in one step, no schema-review screen.
      return {
        ...state, phase: "ready", schema: action.schema, usedFallback: action.usedFallback,
        inferenceNote: action.note, overrides: action.overrides, locationFilter: "ALL", activeTab: "",
        schemaRefining: action.refining ?? false,
      };
    case "UPGRADE_SCHEMA":
      // Background AI refinement landed — swap the schema in WITHOUT disturbing the
      // user's current tab / location filter. Everything re-derives from the new schema.
      return {
        ...state, schema: action.schema, usedFallback: action.usedFallback,
        inferenceNote: action.note, overrides: action.overrides, schemaRefining: false,
      };
    case "ERROR":
      return { ...state, phase: "error", error: action.error };
    case "SET_LOCATION":
      return { ...state, locationFilter: action.location };
    case "SET_TAB":
      return { ...state, activeTab: action.tab };
    case "SET_FINANCIALS":
      return { ...state, financials: action.financials };
    case "SET_MEDIA":
      return { ...state, media: action.media };
    case "BACK_TO_REVIEW":
      return { ...state, phase: "review" };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface Ctx extends State {
  loadFile: (file: File) => Promise<void>;
  loadSample: () => Promise<void>;
  loadAutoData: () => Promise<void>;
  /** Ingest a PRO (FileMaker) push: two headerless CSV blocks. */
  loadFromPro: (inventoryCsv: string, staffCsv: string) => Promise<void>;
  /** Enter the production idle state — awaiting a PRO push. */
  enterWaiting: () => void;
  /** Dev-only: reproject the bundled export into the PRO contract and push it. */
  simulateProPush: () => Promise<void>;
  confirmSchema: (overrides: SchemaOverrides) => void;
  backToReview: () => void;
  setLocation: (loc: string) => void;
  setTab: (tab: string) => void;
  reset: () => void;
}

const DashboardCtx = createContext<Ctx | null>(null);

/** Fire-and-forget system-event log (drives the Logs "System" tab). Best-effort. */
function logSystemEvent(name: string, message?: string, meta?: Record<string, unknown>) {
  try {
    fetch("/api/logs/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message, meta }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* ignore */ }
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const runInference = useCallback(async (parsed: ParsedFile) => {
    const entities = detectEntities(parsed);
    dispatch({ type: "INFERRING", parsed, entities });
    try {
      const { schema, usedFallback, note } = await inferSchemaClient(parsed);
      dispatch({ type: "REVIEW", schema, usedFallback, note });
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Inference failed." });
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      dispatch({ type: "PARSING" });
      try {
        const parsed = await parseSpreadsheet(file);
        await runInference(parsed);
      } catch (err) {
        dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not read file." });
      }
    },
    [runInference]
  );

  // Shared no-review ingest: show the instant heuristic schema, then refine with
  // AI in the background and swap it in. Used by both the bundled auto-load and a
  // live PRO push — both land the operator straight on real numbers, no
  // schema-review step, tab + filter preserved across the background upgrade.
  const overridesFor = (s: SchemaProfile): SchemaOverrides => ({
    vetoedColumns: s.columns.filter((c) => c.trust === "deprecated" || c.trust === "duplicate").map((c) => c.name),
  });
  const ingestParsed = useCallback(async (parsed: ParsedFile) => {
    const entities = detectEntities(parsed);
    // 1. Show good data immediately on the instant, client-side heuristic schema.
    //    INFERRING sets parsed + entities; READY_WITH_SCHEMA (same tick) flips to
    //    ready WITHOUT clobbering them.
    const heuristic = heuristicSchema(parsed.rows);
    dispatch({ type: "INFERRING", parsed, entities });
    dispatch({ type: "READY_WITH_SCHEMA", schema: heuristic, usedFallback: true, overrides: overridesFor(heuristic), refining: true });

    // 2. Refine with AI in the background, then swap it in seamlessly.
    try {
      const { schema, usedFallback, note } = await inferSchemaClient(parsed);
      dispatch({ type: "UPGRADE_SCHEMA", schema, usedFallback, note, overrides: overridesFor(schema) });
    } catch {
      dispatch({ type: "UPGRADE_SCHEMA", schema: heuristic, usedFallback: true, overrides: overridesFor(heuristic) });
    }
  }, []);

  // Ingest a live PRO push: two headerless CSV blocks (inventory + staff) mapped
  // through the fixed positional contract into the same ParsedFile shape.
  const loadFromPro = useCallback(async (inventoryCsv: string, staffCsv: string) => {
    dispatch({ type: "PARSING" });
    try {
      const parsed = parseProPayload(inventoryCsv, staffCsv);
      logSystemEvent("pro.push.received", `PRO push received (${parsed.rows.length} rows)`, {
        inventoryBytes: inventoryCsv.length,
        staffBytes: staffCsv.length,
        rows: parsed.rows.length,
      });
      await ingestParsed(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not read the PRO payload.";
      logSystemEvent("pro.push.error", message);
      dispatch({ type: "ERROR", error: message });
    }
  }, [ingestParsed]);

  const enterWaiting = useCallback(() => dispatch({ type: "WAITING" }), []);

  // Auto-load the bundled test export, infer its schema, and land directly on the
  // dashboard — no upload splash, no schema-review step. Dev/local only; in
  // production the app waits for a PRO push instead (see AUTO_LOAD_BUNDLED).
  const loadAutoData = useCallback(async () => {
    dispatch({ type: "PARSING" });
    try {
      // Combine the two exports so the operator never merges spreadsheets by hand:
      // CURATEDV2 = rich per-unit inventory; CuratedFields-TEST = email/staff/
      // round-robin rows + a few extra unit fields. They join on Record UUID.
      const fetchSheet = async (url: string, name: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load ${name} (${res.status}).`);
        const blob = await res.blob();
        return parseSpreadsheet(new File([blob], name, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }));
      };
      // The financials sheet (fullnew) is big and powers only its own tab, so load
      // it in the background — it must never delay the main dashboard. Gated behind
      // FINANCIALS_ENABLED: while the tab is hidden, the sheet is never fetched, so
      // none of its sensitive figures ever reach the browser.
      if (FINANCIALS_ENABLED) {
        fetchSheet("/fullnew.xlsx", "fullnew.xlsx")
          .then((fn) => dispatch({ type: "SET_FINANCIALS", financials: deriveFinancials(fn) }))
          .catch(() => { /* financials are optional — the tab shows a notice if absent */ });
      }

      // The media-production tracker (new-vals) powers the Media tab's pipeline
      // counts. Small + optional, so load it in the background too — it must never
      // delay the main dashboard, and the tab degrades gracefully if it's absent.
      fetchSheet("/new-vals.xlsx", "new-vals.xlsx")
        .then((mv) => dispatch({ type: "SET_MEDIA", media: deriveMediaProduction(mv) }))
        .catch(() => { /* media-production data is optional */ });

      const [v2, v1] = await Promise.all([
        fetchSheet("/CURATEDV2-TESTING.xlsx", "CURATEDV2-TESTING.xlsx"),
        fetchSheet("/CuratedFields-TEST.xlsx", "CuratedFields-TEST.xlsx"),
      ]);
      const parsed = mergeSources(v2, v1);
      await ingestParsed(parsed);
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not auto-load data." });
    }
  }, [ingestParsed]);

  // Dev-only: reproject the bundled export into the PRO CSV contract and push it
  // through the real bridge path (fileMakerReceive → pro:payload → loadFromPro),
  // so the PRO ingest can be exercised in the browser without FileMaker.
  const simulateProPush = useCallback(async () => {
    dispatch({ type: "PARSING" });
    try {
      const fetchSheet = async (url: string, name: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Could not load ${name} (${res.status}).`);
        const blob = await res.blob();
        return parseSpreadsheet(new File([blob], name, {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }));
      };
      const [v2, v1] = await Promise.all([
        fetchSheet("/CURATEDV2-TESTING.xlsx", "CURATEDV2-TESTING.xlsx"),
        fetchSheet("/CuratedFields-TEST.xlsx", "CuratedFields-TEST.xlsx"),
      ]);
      const parsed = mergeSources(v2, v1);
      const { inventoryCsvData, staffCsvData } = toProPayloadCsv(parsed, detectEntities(parsed));
      const envelope = JSON.stringify({ requestId: "simulate", inventoryCsvData, staffCsvData });
      // Prefer the real bridge entry point (exercises the JSON envelope +
      // validation); fall back to the event the provider listens for.
      if (typeof window !== "undefined" && typeof window.fileMakerReceive === "function") {
        window.fileMakerReceive(envelope);
      } else {
        await loadFromPro(inventoryCsvData, staffCsvData);
      }
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not simulate a PRO push." });
    }
  }, [loadFromPro]);

  const loadSample = useCallback(async () => {
    dispatch({ type: "PARSING" });
    try {
      const { rows, columns } = makeSampleData();
      const parsed: ParsedFile = {
        fileName: "sample_inventory.xlsx",
        sheetName: "Sheet1",
        sheetNames: ["Sheet1"],
        rows,
        columns,
      };
      await runInference(parsed);
    } catch (err) {
      dispatch({ type: "ERROR", error: err instanceof Error ? err.message : "Could not load sample." });
    }
  }, [runInference]);

  // Consume a PRO push. The pre-hydration bridge script (installed in the layout
  // head) hands FileMaker's payload to the data layer via a `pro:payload` window
  // event AND buffers it on `window.__proPayload`. We drain the buffer on mount
  // (covers a push that landed before this listener existed) and also listen for
  // later pushes — so a payload is handled whether it arrives before or after
  // mount. Consuming here keeps the bridge fully decoupled from React state.
  useEffect(() => {
    const onPro = (e: Event) => {
      const d = (e as CustomEvent).detail as { inventoryCsvData?: string; staffCsvData?: string } | undefined;
      if (d && typeof d.inventoryCsvData === "string" && typeof d.staffCsvData === "string") {
        loadFromPro(d.inventoryCsvData, d.staffCsvData);
      }
    };
    window.addEventListener("pro:payload", onPro);

    const pending = window.__proPayload;
    if (pending && typeof pending.inventoryCsvData === "string" && typeof pending.staffCsvData === "string") {
      delete window.__proPayload; // consume once
      loadFromPro(pending.inventoryCsvData, pending.staffCsvData);
    }

    return () => window.removeEventListener("pro:payload", onPro);
  }, [loadFromPro]);

  const value: Ctx = {
    ...state,
    loadFile,
    loadSample,
    loadAutoData,
    loadFromPro,
    enterWaiting,
    simulateProPush,
    confirmSchema: (overrides) => dispatch({ type: "READY", overrides }),
    backToReview: () => dispatch({ type: "BACK_TO_REVIEW" }),
    setLocation: (loc) => dispatch({ type: "SET_LOCATION", location: loc }),
    setTab: (tab) => dispatch({ type: "SET_TAB", tab }),
    reset: () => dispatch({ type: "RESET" }),
  };

  return <DashboardCtx.Provider value={value}>{children}</DashboardCtx.Provider>;
}

export function useDashboard(): Ctx {
  const ctx = useContext(DashboardCtx);
  if (!ctx) throw new Error("useDashboard must be used within <DashboardProvider>.");
  return ctx;
}
